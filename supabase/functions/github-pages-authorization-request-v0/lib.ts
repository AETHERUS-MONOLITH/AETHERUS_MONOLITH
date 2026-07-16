export const FIXED = Object.freeze({
  workspaceId: "9abed891-7950-4937-a2aa-4b957d8a4bd1",
  repository: "AETHERUS-MONOLITH/AETHERUS_MONOLITH",
  repositoryId: "1167751543",
  repositoryOwner: "AETHERUS-MONOLITH",
  repositoryOwnerId: "264210171",
  ref: "refs/heads/main",
  actor: "AETHERUS-MONOLITH",
  actorId: "264210171",
  environment: "github-pages",
  issuer: "https://token.actions.githubusercontent.com",
  workflow: "Deploy Pages with runtime config",
  workflowPath: ".github/workflows/pages-runtime-config.yml",
  requestAudience: "https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-authorization-request-v0",
  consumptionAudience: "https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-authorization-consumption-v0",
  artifactName: "github-pages-governable-v0-1",
  target: "https://camilocarlone.com/"
});

const manifestKeys = [
  "schema_version","action_identifier","workspace_id","repository","repository_id","ref","workflow_path","workflow_name","workflow_sha",
  "run_id","run_attempt","requester_actor","requester_actor_id","requester_oidc_evidence_sha256","source_commit_sha","source_tree_sha",
  "runtime_config_evidence_sha256","built_artifact_sha256","operator_resolution_evidence_sha256","artifact_id","artifact_name","artifact_run_id",
  "artifact_run_attempt","artifact_uploaded_at","artifact_expires_at","upload_action_repository","upload_action_commit_sha","deploy_action_repository",
  "deploy_action_commit_sha","environment_name","canonical_public_target","permitted_effect","maximum_artifact_uploads","maximum_deployments",
  "authorization_contract_version","action_manifest_sha256"
].sort();

function decode(segment: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("malformed JWT segment");
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function parseJson(segment: string): Record<string, unknown> {
  try { return JSON.parse(new TextDecoder().decode(decode(segment))); }
  catch { throw new Error("malformed JWT JSON"); }
}

function exact(actual: unknown, expected: unknown, label: string): void {
  if (String(actual) !== String(expected)) throw new Error(`${label} mismatch`);
}

function requiredString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} is required`);
}

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().map((key) => [key, canonicalize(object[key])]));
  }
  return value;
}

export function canonicalJson(value: unknown): string { return JSON.stringify(canonicalize(value)); }

export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyGitHubOidc(token: string, audience: string, binding: { run_id: unknown; workflow_sha: unknown; source_commit_sha: unknown }) {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error("malformed JWT");
  const header = parseJson(parts[0]);
  const claims = parseJson(parts[1]);
  exact(header.alg, "RS256", "algorithm");
  requiredString(header.kid, "key identity");
  const discoveryResponse = await fetch(`${FIXED.issuer}/.well-known/openid-configuration`, { redirect: "error" });
  if (!discoveryResponse.ok) throw new Error("OIDC discovery unavailable");
  const discovery = await discoveryResponse.json();
  exact(discovery.issuer, FIXED.issuer, "discovery issuer");
  exact(discovery.jwks_uri, `${FIXED.issuer}/.well-known/jwks`, "JWKS URI");
  const jwksResponse = await fetch(discovery.jwks_uri, { redirect: "error" });
  if (!jwksResponse.ok) throw new Error("JWKS unavailable");
  const jwks = await jwksResponse.json();
  const matches = Array.isArray(jwks.keys) ? jwks.keys.filter((key: JsonWebKey) => key.kid === header.kid) : [];
  if (matches.length !== 1) throw new Error("unknown or ambiguous key identity");
  const jwk = matches[0] as JsonWebKey;
  if (jwk.kty !== "RSA" || jwk.alg !== "RS256" || jwk.use !== "sig") throw new Error("invalid signing key metadata");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) {
    throw new Error("invalid signature");
  }
  const now = Math.floor(Date.now() / 1000);
  exact(claims.iss, FIXED.issuer, "issuer");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (audiences.length !== 1 || audiences[0] !== audience) throw new Error("audience mismatch");
  for (const field of ["exp","iat","nbf"]) if (!Number.isInteger(claims[field])) throw new Error(`${field} is required`);
  if ((claims.exp as number) <= now - 30 || (claims.iat as number) > now + 30 || (claims.nbf as number) > now + 30) throw new Error("token time boundary invalid");
  requiredString(claims.jti, "JWT ID");
  const expected: Record<string,string> = {
    repository: FIXED.repository, repository_id: FIXED.repositoryId, repository_owner: FIXED.repositoryOwner,
    repository_owner_id: FIXED.repositoryOwnerId, repository_visibility: "public", ref: FIXED.ref, ref_type: "branch",
    workflow: FIXED.workflow, workflow_ref: `${FIXED.repository}/${FIXED.workflowPath}@${FIXED.ref}`, environment: FIXED.environment,
    event_name: "workflow_dispatch", actor: FIXED.actor, actor_id: FIXED.actorId, run_attempt: "1", runner_environment: "github-hosted"
  };
  for (const [field,value] of Object.entries(expected)) exact(claims[field], value, field);
  exact(claims.run_id, binding.run_id, "run ID binding");
  exact(claims.workflow_sha, binding.workflow_sha, "workflow SHA binding");
  exact(claims.sha, binding.source_commit_sha, "source commit binding");
  return claims;
}

export async function validateManifest(input: unknown): Promise<{ manifest: Record<string,unknown>; requestKeySha256: string }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("manifest must be an object");
  const manifest = input as Record<string,unknown>;
  if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(manifestKeys)) throw new Error("manifest fields mismatch");
  const digest = manifest.action_manifest_sha256;
  if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) throw new Error("manifest digest invalid");
  const withoutDigest = { ...manifest };
  delete withoutDigest.action_manifest_sha256;
  if (await sha256(canonicalJson(withoutDigest)) !== digest) throw new Error("manifest digest mismatch");
  const fixed: Record<string,unknown> = {
    schema_version:"0.1", action_identifier:"github_pages_outward_publication@0.1", workspace_id:FIXED.workspaceId,
    repository:FIXED.repository, repository_id:FIXED.repositoryId, ref:FIXED.ref, workflow_path:FIXED.workflowPath,
    workflow_name:FIXED.workflow, run_attempt:1, requester_actor:FIXED.actor, requester_actor_id:FIXED.actorId,
    artifact_name:FIXED.artifactName, artifact_run_attempt:1, upload_action_repository:"actions/upload-pages-artifact",
    upload_action_commit_sha:"56afc609e74202658d3ffba0e8f6dda462b719fa", deploy_action_repository:"actions/deploy-pages",
    deploy_action_commit_sha:"d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e", environment_name:FIXED.environment,
    canonical_public_target:FIXED.target, maximum_artifact_uploads:1, maximum_deployments:1,
    permitted_effect:"replace the current GitHub Pages deployment for the canonical target with the exact bound uploaded artifact",
    authorization_contract_version:"github-pages-publication-authorization-v0"
  };
  for (const [field,value] of Object.entries(fixed)) exact(manifest[field],value,`manifest ${field}`);
  exact(manifest.artifact_run_id,manifest.run_id,"artifact run ID");
  for (const field of ["workflow_sha","source_commit_sha","source_tree_sha"]) if (typeof manifest[field] !== "string" || !/^[0-9a-f]{40}$/.test(manifest[field] as string)) throw new Error(`${field} invalid`);
  for (const field of ["requester_oidc_evidence_sha256","runtime_config_evidence_sha256","built_artifact_sha256","operator_resolution_evidence_sha256"]) if (typeof manifest[field] !== "string" || !/^[0-9a-f]{64}$/.test(manifest[field] as string)) throw new Error(`${field} invalid`);
  for (const field of ["artifact_uploaded_at","artifact_expires_at"]) if (typeof manifest[field] !== "string" || !Number.isFinite(Date.parse(manifest[field] as string))) throw new Error(`${field} invalid`);
  if (Date.parse(manifest.artifact_expires_at as string) <= Date.now()) throw new Error("artifact expired");
  const requestKeyInput = ["action_identifier","workspace_id","repository","repository_id","ref","workflow_sha","run_id","run_attempt","artifact_id","built_artifact_sha256","action_manifest_sha256","canonical_public_target"].map((field)=>String(manifest[field])).join("\x1f");
  return { manifest, requestKeySha256: await sha256(requestKeyInput) };
}

export async function verifyArtifact(manifest: Record<string,unknown>, token: string): Promise<void> {
  if (typeof token !== "string" || token.length < 20) throw new Error("GitHub API credential unavailable");
  const headers = { authorization:`Bearer ${token}`, accept:"application/vnd.github+json", "x-github-api-version":"2022-11-28" };
  const artifactResponse = await fetch(`https://api.github.com/repos/${FIXED.repository}/actions/artifacts/${manifest.artifact_id}`, { headers, redirect:"error" });
  if (!artifactResponse.ok) throw new Error(`GitHub artifact API status ${artifactResponse.status}`);
  const artifact = await artifactResponse.json();
  const runResponse = await fetch(`https://api.github.com/repos/${FIXED.repository}/actions/runs/${manifest.run_id}`, { headers, redirect:"error" });
  if (!runResponse.ok) throw new Error(`GitHub run API status ${runResponse.status}`);
  const run = await runResponse.json();
  exact(artifact.id,manifest.artifact_id,"artifact ID"); exact(artifact.name,FIXED.artifactName,"artifact name");
  exact(artifact.workflow_run?.id,manifest.run_id,"artifact run"); exact(artifact.expired,false,"artifact expiry state");
  exact(artifact.created_at,manifest.artifact_uploaded_at,"artifact upload time"); exact(artifact.expires_at,manifest.artifact_expires_at,"artifact expiry time");
  exact(run.id,manifest.run_id,"workflow run ID"); exact(run.run_attempt,1,"workflow run attempt");
  exact(run.head_sha,manifest.source_commit_sha,"workflow run source commit");
  if (Date.parse(artifact.expires_at) <= Date.now()) throw new Error("artifact expired");
}
