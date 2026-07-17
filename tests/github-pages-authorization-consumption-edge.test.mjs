import assert from "node:assert/strict";
import { constants, generateKeyPairSync, sign, webcrypto } from "node:crypto";
import test from "node:test";
import {
  buildObservedBinding,
  FIXED,
  observeArtifact,
  validateConsumptionBody,
  verifyTrustEnvelope
} from "../supabase/functions/github-pages-authorization-consumption-v0/lib.ts";

globalThis.crypto ||= webcrypto;
const now = 2_000_000_000;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "fixture-key", alg: "RS256", use: "sig" };

function claims(overrides = {}) {
  return {
    iss: FIXED.issuer,
    aud: FIXED.audience,
    exp: now + 300,
    iat: now - 10,
    nbf: now - 10,
    jti: "fixture-jti",
    repository: "substituted/repository",
    repository_id: "999",
    actor: "substituted-actor",
    actor_id: "998",
    workflow: "substituted-workflow",
    workflow_sha: "b".repeat(40),
    run_id: "44",
    run_attempt: "2",
    sha: "c".repeat(40),
    ...overrides
  };
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function token(payload = claims(), signer = privateKey) {
  const signingInput = `${encode({ alg: "RS256", kid: "fixture-key", typ: "JWT" })}.${encode(payload)}`;
  const signature = sign("sha256", Buffer.from(signingInput), { key: signer, padding: constants.RSA_PKCS1_PADDING });
  return `${signingInput}.${signature.toString("base64url")}`;
}

function response(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

test("trusted consumption envelope accepts action-specific claim substitutions for database adjudication", async () => {
  const substituted = claims();
  assert.deepEqual(await verifyTrustEnvelope(token(substituted), { jwks: { keys: [jwk] }, nowSeconds: now }), substituted);
});

test("untrusted consumption envelopes are rejected before database adjudication", async () => {
  await assert.rejects(() => verifyTrustEnvelope(token(claims({ iss: "https://issuer.invalid" })), { jwks: { keys: [jwk] }, nowSeconds: now }), /wrong_issuer/);
  await assert.rejects(() => verifyTrustEnvelope(token(claims({ aud: "wrong" })), { jwks: { keys: [jwk] }, nowSeconds: now }), /wrong_audience/);
  const altered = token().split(".");
  altered[2] = `${altered[2][0] === "A" ? "B" : "A"}${altered[2].slice(1)}`;
  await assert.rejects(() => verifyTrustEnvelope(altered.join("."), { jwks: { keys: [jwk] }, nowSeconds: now }), /invalid_signature/);
});

test("artifact observation distinguishes match, mismatch-independent lookup, expiry, not-found, and indeterminate", async () => {
  const manifest = { artifact_id: 17, run_id: 23 };
  const artifact = { id: 17, name: "candidate", workflow_run: { id: 23 }, expired: false, created_at: "2033-05-18T03:33:20.000Z", expires_at: "2033-05-19T03:33:20.000Z" };
  const run = { id: 23, run_attempt: 7, head_sha: "d".repeat(40) };
  const matchingFetch = async (url) => url.includes("/artifacts/") ? response(200, artifact) : response(200, run);
  const matched = await observeArtifact(manifest, "t".repeat(20), { fetchImpl: matchingFetch, nowMs: now * 1000 });
  assert.equal(matched.status, "MATCH");
  assert.equal(matched.run.run_attempt, 7, "binding comparison remains database-owned");
  assert.equal((await observeArtifact(manifest, "t".repeat(20), { fetchImpl: async () => response(404, {}) })).status, "NOT_FOUND");
  assert.equal((await observeArtifact(manifest, "t".repeat(20), { fetchImpl: async () => response(410, {}) })).status, "EXPIRED");
  assert.equal((await observeArtifact(manifest, "t".repeat(20), { fetchImpl: async () => response(503, {}) })).status, "INDETERMINATE");
  assert.equal((await observeArtifact(manifest, "t".repeat(20), { fetchImpl: async () => { throw new Error("transport"); } })).status, "INDETERMINATE");
});

test("observed binding contains the complete signed claim set and no GitHub credential", () => {
  const signedClaims = claims();
  const artifactVerification = { status: "NOT_FOUND", reason: "artifact_not_found", artifact: null, run: null };
  const observed = buildObservedBinding(signedClaims, { artifact_id: 17 }, artifactVerification);
  assert.deepEqual(observed.claims, signedClaims);
  assert.equal(JSON.stringify(observed).includes("github_api_token"), false);
});

test("malformed request IDs are rejected without a database-capable observed request", () => {
  assert.throws(() => validateConsumptionBody({ operation: "consume", request_id: "unknown", manifest: {}, github_api_token: "t".repeat(20) }), /invalid_request_id/);
  assert.equal(validateConsumptionBody({ operation: "consume", request_id: "123e4567-e89b-12d3-a456-426614174000", manifest: {}, github_api_token: "t".repeat(20) }).operation, "consume");
});
