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
  audience: "https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-operator-resolution-v0"
});

type RequestBody = {
  classification: "production_action" | "non_deploying_topology_verification";
  repository: string;
  ref: string;
  run_id: string;
  workflow_sha: string;
  workspace_id: string;
};

function decode(segment: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("malformed JWT segment");
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseJson(segment: string): Record<string, unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(decode(segment)));
  } catch {
    throw new Error("malformed JWT JSON");
  }
}

function exact(actual: unknown, expected: unknown, label: string): void {
  if (String(actual) !== String(expected)) throw new Error(`${label} mismatch`);
}

function requiredString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} is required`);
}

function workflowFor(classification: RequestBody["classification"]) {
  if (classification === "production_action") {
    return { name: "Deploy Pages with runtime config", path: ".github/workflows/pages-runtime-config.yml" };
  }
  if (classification === "non_deploying_topology_verification") {
    return { name: "Verify GitHub Pages governable boundary", path: ".github/workflows/github-pages-boundary-verification.yml" };
  }
  throw new Error("unsupported classification");
}

export async function verifyGitHubOidc(token: string, body: RequestBody) {
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
  const signatureValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!signatureValid) throw new Error("invalid signature");

  const now = Math.floor(Date.now() / 1000);
  const skew = 30;
  exact(claims.iss, FIXED.issuer, "issuer");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (audiences.length !== 1 || audiences[0] !== FIXED.audience) throw new Error("audience mismatch");
  for (const field of ["exp", "iat", "nbf"]) {
    if (!Number.isInteger(claims[field])) throw new Error(`${field} is required`);
  }
  if ((claims.exp as number) <= now - skew) throw new Error("token expired");
  if ((claims.iat as number) > now + skew) throw new Error("issued-at is premature");
  if ((claims.nbf as number) > now + skew) throw new Error("token not yet valid");
  requiredString(claims.jti, "JWT ID");

  const workflow = workflowFor(body.classification);
  const expected: Record<string, string> = {
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
    event_name: "workflow_dispatch",
    actor: FIXED.actor,
    actor_id: FIXED.actorId,
    run_attempt: "1",
    runner_environment: "github-hosted"
  };
  for (const [field, value] of Object.entries(expected)) exact(claims[field], value, field);
  requiredString(claims.workflow_sha, "workflow_sha");
  requiredString(claims.run_id, "run_id");

  const expectedBodyKeys = ["classification", "ref", "repository", "run_id", "workflow_sha", "workspace_id"];
  if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(expectedBodyKeys)) throw new Error("request body fields mismatch");
  exact(body.workspace_id, FIXED.workspaceId, "body workspace_id");
  exact(body.repository, claims.repository, "body repository");
  exact(body.ref, claims.ref, "body ref");
  exact(body.workflow_sha, claims.workflow_sha, "body workflow_sha");
  exact(body.run_id, claims.run_id, "body run_id");
  return { classification: body.classification, claims };
}
