export const PHASE5_FIXED = Object.freeze({
  issuer: "https://token.actions.githubusercontent.com",
  repository: "AETHERUS-MONOLITH/AETHERUS_MONOLITH",
  repositoryId: "1167751543",
  repositoryOwner: "AETHERUS-MONOLITH",
  repositoryOwnerId: "264210171",
  ref: "refs/heads/main",
  actor: "AETHERUS-MONOLITH",
  actorId: "264210171",
  environment: "github-pages",
  workflow: "Deploy Pages with runtime config",
  workflowPath: ".github/workflows/pages-runtime-config.yml",
  palisadeAudience: "https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-palisade-evaluation-v0",
  conduitAudience: "https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-conduit-invocation-v0"
});

function decode(segment: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("malformed_token");
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function parse(segment: string): Record<string, unknown> {
  try {
    const value = JSON.parse(new TextDecoder().decode(decode(segment)));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new Error("malformed_token"); }
}

function exact(actual: unknown, expected: unknown, code: string) {
  if (String(actual) !== String(expected)) throw new Error(code);
}

export async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyPhase5GithubOidc(
  token: string,
  audience: string,
  binding: { workflow_run_id: unknown; workflow_sha: unknown },
  options: { fetchImpl?: typeof fetch; jwks?: { keys: JsonWebKey[] }; nowSeconds?: number } = {}
) {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error("malformed_token");
  const header = parse(parts[0]);
  const claims = parse(parts[1]);
  exact(header.alg, "RS256", "invalid_algorithm");
  if (typeof header.kid !== "string" || !header.kid) throw new Error("unknown_signing_key");
  let jwks = options.jwks;
  if (!jwks) {
    const fetchImpl = options.fetchImpl || fetch;
    const discoveryResponse = await fetchImpl(`${PHASE5_FIXED.issuer}/.well-known/openid-configuration`, { redirect: "error" });
    if (!discoveryResponse.ok) throw new Error("oidc_discovery_indeterminate");
    const discovery = await discoveryResponse.json();
    exact(discovery.issuer, PHASE5_FIXED.issuer, "wrong_issuer");
    exact(discovery.jwks_uri, `${PHASE5_FIXED.issuer}/.well-known/jwks`, "untrusted_jwks_uri");
    const jwksResponse = await fetchImpl(discovery.jwks_uri, { redirect: "error" });
    if (!jwksResponse.ok) throw new Error("jwks_indeterminate");
    jwks = await jwksResponse.json();
  }
  const matches = Array.isArray(jwks?.keys) ? jwks.keys.filter((key) => key.kid === header.kid) : [];
  if (matches.length !== 1) throw new Error("unknown_signing_key");
  const jwk = matches[0];
  if (jwk.kty !== "RSA" || jwk.alg !== "RS256" || jwk.use !== "sig") throw new Error("invalid_signing_key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) {
    throw new Error("invalid_signature");
  }
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  exact(claims.iss, PHASE5_FIXED.issuer, "wrong_issuer");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (audiences.length !== 1 || audiences[0] !== audience) throw new Error("wrong_audience");
  for (const field of ["exp", "iat", "nbf"]) if (!Number.isInteger(claims[field])) throw new Error("malformed_token");
  if ((claims.exp as number) <= now - 30) throw new Error("token_expired");
  if ((claims.iat as number) > now + 30 || (claims.nbf as number) > now + 30) throw new Error("token_not_yet_valid");
  const expected: Record<string, string> = {
    repository: PHASE5_FIXED.repository, repository_id: PHASE5_FIXED.repositoryId,
    repository_owner: PHASE5_FIXED.repositoryOwner, repository_owner_id: PHASE5_FIXED.repositoryOwnerId,
    repository_visibility: "public", ref: PHASE5_FIXED.ref, ref_type: "branch",
    workflow: PHASE5_FIXED.workflow, workflow_ref: `${PHASE5_FIXED.repository}/${PHASE5_FIXED.workflowPath}@${PHASE5_FIXED.ref}`,
    environment: PHASE5_FIXED.environment, event_name: "workflow_dispatch", actor: PHASE5_FIXED.actor,
    actor_id: PHASE5_FIXED.actorId, run_attempt: "1", runner_environment: "github-hosted"
  };
  for (const [field, value] of Object.entries(expected)) exact(claims[field], value, `${field}_mismatch`);
  exact(claims.run_id, binding.workflow_run_id, "run_id_mismatch");
  exact(claims.workflow_sha, binding.workflow_sha, "workflow_sha_mismatch");
  return claims;
}
