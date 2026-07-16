import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const FIXED = Object.freeze({
  schemaVersion: "0.1",
  actionIdentifier: "github_pages_outward_publication@0.1",
  workspaceId: "9abed891-7950-4937-a2aa-4b957d8a4bd1",
  operatorUserId: "4702d528-f7a7-4a04-a991-3176bec69f52",
  repository: "AETHERUS-MONOLITH/AETHERUS_MONOLITH",
  repositoryId: "1167751543",
  repositoryOwner: "AETHERUS-MONOLITH",
  repositoryOwnerId: "264210171",
  ref: "refs/heads/main",
  actor: "AETHERUS-MONOLITH",
  actorId: "264210171",
  environment: "github-pages",
  eventName: "workflow_dispatch",
  target: "https://camilocarlone.com/",
  artifactName: "github-pages-governable-v0-1",
  issuer: "https://token.actions.githubusercontent.com",
  audience: "https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-operator-resolution-v0",
  productionWorkflow: "Deploy Pages with runtime config",
  productionWorkflowPath: ".github/workflows/pages-runtime-config.yml",
  verificationWorkflow: "Verify GitHub Pages governable boundary",
  verificationWorkflowPath: ".github/workflows/github-pages-boundary-verification.yml"
});

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function digestObject(value) {
  return sha256(canonicalJson(value));
}

function base64UrlDecode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("malformed JWT segment");
  return Buffer.from(value, "base64url");
}

function parseJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error("malformed JWT");
  let header;
  let claims;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]).toString("utf8"));
    claims = JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));
  } catch {
    throw new Error("malformed JWT JSON");
  }
  return { parts, header, claims };
}

function exact(value, expected, label) {
  if (String(value) !== String(expected)) throw new Error(`${label} mismatch`);
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} is required`);
}

export function expectedWorkflowContext(classification) {
  if (classification === "production_action") {
    return { name: FIXED.productionWorkflow, path: FIXED.productionWorkflowPath };
  }
  if (classification === "non_deploying_topology_verification") {
    return { name: FIXED.verificationWorkflow, path: FIXED.verificationWorkflowPath };
  }
  throw new Error("unsupported request classification");
}

export function validateOidcClaims(claims, body, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("request body must be an object");
  const allowedBodyKeys = ["classification", "repository", "ref", "run_id", "workflow_sha", "workspace_id"];
  const actualKeys = Object.keys(body).sort();
  if (canonicalJson(actualKeys) !== canonicalJson(allowedBodyKeys.sort())) throw new Error("request body fields mismatch");

  const workflow = expectedWorkflowContext(body.classification);
  const skew = 30;
  exact(claims.iss, FIXED.issuer, "issuer");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (audiences.length !== 1 || audiences[0] !== FIXED.audience) throw new Error("audience mismatch");
  for (const field of ["exp", "iat", "nbf"]) {
    if (!Number.isInteger(claims[field])) throw new Error(`${field} is required`);
  }
  if (claims.exp <= nowSeconds - skew) throw new Error("token expired");
  if (claims.iat > nowSeconds + skew) throw new Error("issued-at is premature");
  if (claims.nbf > nowSeconds + skew) throw new Error("token not yet valid");
  requiredString(claims.jti, "JWT ID");

  const expected = {
    repository: FIXED.repository,
    repository_id: FIXED.repositoryId,
    repository_owner: FIXED.repositoryOwner,
    repository_owner_id: FIXED.repositoryOwnerId,
    repository_visibility: "public",
    ref: FIXED.ref,
    ref_type: "branch",
    workflow: workflow.name,
    workflow_ref: `${FIXED.repository}/${workflow.path}@${FIXED.ref}`,
    environment: FIXED.environment,
    event_name: FIXED.eventName,
    actor: FIXED.actor,
    actor_id: FIXED.actorId,
    run_attempt: "1",
    runner_environment: "github-hosted"
  };
  for (const [key, value] of Object.entries(expected)) exact(claims[key], value, key);
  requiredString(claims.workflow_sha, "workflow_sha");
  requiredString(claims.run_id, "run_id");

  exact(body.workspace_id, FIXED.workspaceId, "body workspace_id");
  exact(body.repository, claims.repository, "body repository");
  exact(body.ref, claims.ref, "body ref");
  exact(body.workflow_sha, claims.workflow_sha, "body workflow_sha");
  exact(body.run_id, claims.run_id, "body run_id");
  return { claims, classification: body.classification, workflow };
}

export async function verifyGitHubOidcToken(token, body, options = {}) {
  const { parts, header, claims } = parseJwt(token);
  exact(header.alg, "RS256", "algorithm");
  requiredString(header.kid, "key identity");
  const jwks = options.jwks || await fetchGitHubJwks(options.fetchImpl || fetch);
  if (!jwks || !Array.isArray(jwks.keys)) throw new Error("JWKS unavailable");
  const matches = jwks.keys.filter((key) => key.kid === header.kid);
  if (matches.length !== 1) throw new Error("unknown or ambiguous key identity");
  const key = matches[0];
  if (key.kty !== "RSA" || key.alg !== "RS256" || key.use !== "sig") throw new Error("invalid signing key metadata");
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    base64UrlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error("invalid signature");
  return validateOidcClaims(claims, body, options.nowSeconds);
}

export async function fetchGitHubJwks(fetchImpl) {
  const discoveryUrl = `${FIXED.issuer}/.well-known/openid-configuration`;
  const discoveryResponse = await fetchImpl(discoveryUrl, { redirect: "error" });
  if (!discoveryResponse.ok) throw new Error("OIDC discovery unavailable");
  const discovery = await discoveryResponse.json();
  const expectedJwks = `${FIXED.issuer}/.well-known/jwks`;
  exact(discovery.issuer, FIXED.issuer, "discovery issuer");
  exact(discovery.jwks_uri, expectedJwks, "JWKS URI");
  const jwksResponse = await fetchImpl(expectedJwks, { redirect: "error" });
  if (!jwksResponse.ok) throw new Error("JWKS unavailable");
  return jwksResponse.json();
}

async function walk(root, relative = "") {
  const directory = path.join(root, relative);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`symlink rejected: ${entry.name}`);
    const child = path.posix.join(relative.split(path.sep).join(path.posix.sep), entry.name);
    if (child.startsWith("../") || path.posix.isAbsolute(child)) throw new Error("path traversal rejected");
    if (entry.isDirectory()) files.push(...await walk(root, child));
    else if (entry.isFile()) files.push(child);
    else throw new Error(`non-regular artifact entry rejected: ${child}`);
  }
  return files;
}

export async function buildArtifactEvidence(root) {
  const paths = (await walk(root)).sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
  const files = [];
  for (const relativePath of paths) {
    const normalized = path.posix.normalize(relativePath);
    if (normalized !== relativePath || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
      throw new Error(`unsafe artifact path: ${relativePath}`);
    }
    const bytes = await fs.readFile(path.join(root, relativePath));
    files.push({ path: relativePath, byte_length: bytes.length, sha256: sha256(bytes) });
  }
  return { files, built_artifact_sha256: digestObject(files) };
}

export function validateOperatorEvidence(value) {
  const expectedKeys = [
    "authority_class", "authority_version", "operator_principal_id", "principal_type",
    "resolution_status", "resolved_at", "status", "workspace_id"
  ];
  if (!value || canonicalJson(Object.keys(value).sort()) !== canonicalJson(expectedKeys)) throw new Error("Operator evidence fields mismatch");
  exact(value.workspace_id, FIXED.workspaceId, "Operator workspace");
  exact(value.principal_type, "human_operator", "principal_type");
  exact(value.authority_class, "workspace_operator_principal", "authority_class");
  exact(value.status, "active", "status");
  exact(value.resolution_status, "resolved", "resolution_status");
  for (const key of ["operator_principal_id", "authority_version", "resolved_at"]) requiredString(value[key], key);
  return value;
}

export function validateArtifactApiResponse({ artifacts, run, artifactId, runId }) {
  if (!Array.isArray(artifacts) || artifacts.length !== 1) throw new Error("artifact identity is ambiguous");
  const artifact = artifacts[0];
  exact(artifact.name, FIXED.artifactName, "artifact name");
  exact(artifact.id, artifactId, "artifact ID");
  exact(artifact.workflow_run?.id, runId, "artifact workflow run ID");
  if (artifact.expired !== false) throw new Error("artifact is expired");
  exact(run.id, runId, "workflow run ID");
  exact(run.run_attempt, 1, "run attempt");
  return artifact;
}
