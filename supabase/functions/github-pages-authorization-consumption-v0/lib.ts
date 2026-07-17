export const FIXED = Object.freeze({
  issuer: "https://token.actions.githubusercontent.com",
  audience: "https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-authorization-consumption-v0",
  repository: "AETHERUS-MONOLITH/AETHERUS_MONOLITH"
});

export type ArtifactVerificationStatus = "MATCH" | "MISMATCH" | "EXPIRED" | "NOT_FOUND" | "INDETERMINATE";

export type ArtifactObservation = {
  status: ArtifactVerificationStatus;
  reason: string;
  artifact: null | {
    id: unknown;
    name: unknown;
    workflow_run_id: unknown;
    expired: unknown;
    created_at: unknown;
    expires_at: unknown;
  };
  run: null | {
    id: unknown;
    run_attempt: unknown;
    head_sha: unknown;
  };
};

function decode(segment: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("malformed_token");
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function parseJson(segment: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decode(segment)));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new Error("malformed_token");
  }
}

function exact(actual: unknown, expected: unknown, code: string): void {
  if (String(actual) !== String(expected)) throw new Error(code);
}

function requiredString(value: unknown, code: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw new Error(code);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyTrustEnvelope(
  token: string,
  options: {
    fetchImpl?: typeof fetch;
    jwks?: { keys: JsonWebKey[] };
    nowSeconds?: number;
  } = {}
): Promise<Record<string, unknown>> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error("malformed_token");
  const header = parseJson(parts[0]);
  const claims = parseJson(parts[1]);
  exact(header.alg, "RS256", "invalid_algorithm");
  requiredString(header.kid, "unknown_signing_key");

  let jwks = options.jwks;
  if (!jwks) {
    const fetchImpl = options.fetchImpl || fetch;
    const discoveryResponse = await fetchImpl(`${FIXED.issuer}/.well-known/openid-configuration`, { redirect: "error" });
    if (!discoveryResponse.ok) throw new Error("oidc_discovery_indeterminate");
    const discovery = await discoveryResponse.json();
    exact(discovery.issuer, FIXED.issuer, "wrong_issuer");
    exact(discovery.jwks_uri, `${FIXED.issuer}/.well-known/jwks`, "untrusted_jwks_uri");
    const jwksResponse = await fetchImpl(discovery.jwks_uri, { redirect: "error" });
    if (!jwksResponse.ok) throw new Error("jwks_indeterminate");
    jwks = await jwksResponse.json();
  }

  const matches = Array.isArray(jwks?.keys) ? jwks.keys.filter((key) => key.kid === header.kid) : [];
  if (matches.length !== 1) throw new Error("unknown_signing_key");
  const jwk = matches[0];
  if (jwk.kty !== "RSA" || jwk.alg !== "RS256" || jwk.use !== "sig") throw new Error("invalid_signing_key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!verified) throw new Error("invalid_signature");

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  exact(claims.iss, FIXED.issuer, "wrong_issuer");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (audiences.length !== 1 || audiences[0] !== FIXED.audience) throw new Error("wrong_audience");
  for (const field of ["exp", "iat", "nbf"]) if (!Number.isInteger(claims[field])) throw new Error("malformed_token");
  if ((claims.exp as number) <= now - 30) throw new Error("token_expired");
  if ((claims.iat as number) > now + 30 || (claims.nbf as number) > now + 30) throw new Error("token_not_yet_valid");
  requiredString(claims.jti, "malformed_token");
  return claims;
}

function normalizedArtifact(artifact: Record<string, unknown>) {
  const workflowRun = artifact.workflow_run && typeof artifact.workflow_run === "object"
    ? artifact.workflow_run as Record<string, unknown>
    : {};
  return {
    id: artifact.id,
    name: artifact.name,
    workflow_run_id: workflowRun.id,
    expired: artifact.expired,
    created_at: artifact.created_at,
    expires_at: artifact.expires_at
  };
}

function normalizedRun(run: Record<string, unknown>) {
  return { id: run.id, run_attempt: run.run_attempt, head_sha: run.head_sha };
}

function observation(status: ArtifactVerificationStatus, reason: string, artifact: ArtifactObservation["artifact"] = null, run: ArtifactObservation["run"] = null): ArtifactObservation {
  return { status, reason, artifact, run };
}

export async function observeArtifact(
  manifest: unknown,
  githubApiToken: unknown,
  options: { fetchImpl?: typeof fetch; nowMs?: number } = {}
): Promise<ArtifactObservation> {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return observation("INDETERMINATE", "manifest_artifact_identity_unavailable");
  }
  const artifactId = (manifest as Record<string, unknown>).artifact_id;
  const runId = (manifest as Record<string, unknown>).run_id;
  if ((typeof artifactId !== "string" && typeof artifactId !== "number") || (typeof runId !== "string" && typeof runId !== "number")) {
    return observation("INDETERMINATE", "manifest_artifact_identity_unavailable");
  }
  if (typeof githubApiToken !== "string" || githubApiToken.length < 20) {
    return observation("INDETERMINATE", "github_api_credential_unavailable");
  }

  const fetchImpl = options.fetchImpl || fetch;
  const headers = { authorization: `Bearer ${githubApiToken}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
  try {
    const artifactResponse = await fetchImpl(`https://api.github.com/repos/${FIXED.repository}/actions/artifacts/${artifactId}`, { headers, redirect: "error" });
    if (artifactResponse.status === 404) return observation("NOT_FOUND", "artifact_not_found");
    if (artifactResponse.status === 410) return observation("EXPIRED", "artifact_expired");
    if (!artifactResponse.ok) return observation("INDETERMINATE", `artifact_api_${artifactResponse.status}`);
    const artifact = await artifactResponse.json() as Record<string, unknown>;

    const runResponse = await fetchImpl(`https://api.github.com/repos/${FIXED.repository}/actions/runs/${runId}`, { headers, redirect: "error" });
    if (runResponse.status === 404) return observation("NOT_FOUND", "run_not_found", normalizedArtifact(artifact));
    if (!runResponse.ok) return observation("INDETERMINATE", `run_api_${runResponse.status}`, normalizedArtifact(artifact));
    const run = await runResponse.json() as Record<string, unknown>;
    const safeArtifact = normalizedArtifact(artifact);
    const safeRun = normalizedRun(run);
    const expiresAt = typeof artifact.expires_at === "string" ? Date.parse(artifact.expires_at) : Number.NaN;
    if (artifact.expired === true || (Number.isFinite(expiresAt) && expiresAt <= (options.nowMs ?? Date.now()))) {
      return observation("EXPIRED", "artifact_expired", safeArtifact, safeRun);
    }
    return observation("MATCH", "authoritative_lookup_complete", safeArtifact, safeRun);
  } catch {
    return observation("INDETERMINATE", "artifact_api_transport_failure");
  }
}

export function validateConsumptionBody(input: unknown): {
  operation: "consume";
  request_id: string;
  manifest: unknown;
  github_api_token: unknown;
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid_body");
  const body = input as Record<string, unknown>;
  if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(["github_api_token", "manifest", "operation", "request_id"])) throw new Error("invalid_body");
  if (body.operation !== "consume") throw new Error("invalid_body");
  if (typeof body.request_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)) {
    throw new Error("invalid_request_id");
  }
  return body as { operation: "consume"; request_id: string; manifest: unknown; github_api_token: unknown };
}

export function buildObservedBinding(claims: Record<string, unknown>, manifest: unknown, artifactVerification: ArtifactObservation) {
  return { claims, manifest, artifact_verification: artifactVerification };
}
