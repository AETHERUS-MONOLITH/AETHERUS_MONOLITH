import assert from "node:assert/strict";
import { constants, generateKeyPairSync, sign, webcrypto } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildArtifactEvidence,
  FIXED,
  validateArtifactApiResponse,
  verifyGitHubOidcToken
} from "../scripts/lib/github-pages-governable.mjs";
import { validateContract, validateRepository } from "../scripts/validate-github-pages-governable-deployment-action.mjs";

globalThis.crypto ||= webcrypto;
const now = 2_000_000_000;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "fixture-key", alg: "RS256", use: "sig" };

const body = {
  classification: "production_action",
  repository: FIXED.repository,
  ref: FIXED.ref,
  run_id: "99112233",
  workflow_sha: "a".repeat(40),
  workspace_id: FIXED.workspaceId
};

function claims(overrides = {}) {
  return {
    iss: FIXED.issuer,
    aud: FIXED.audience,
    exp: now + 300,
    iat: now - 10,
    nbf: now - 10,
    jti: "fixture-jti",
    repository: FIXED.repository,
    repository_id: FIXED.repositoryId,
    repository_owner: FIXED.repositoryOwner,
    repository_owner_id: FIXED.repositoryOwnerId,
    repository_visibility: "public",
    ref: FIXED.ref,
    ref_type: "branch",
    workflow: FIXED.productionWorkflow,
    workflow_ref: `${FIXED.repository}/${FIXED.productionWorkflowPath}@${FIXED.ref}`,
    workflow_sha: body.workflow_sha,
    environment: FIXED.environment,
    event_name: FIXED.eventName,
    actor: FIXED.actor,
    actor_id: FIXED.actorId,
    run_id: body.run_id,
    run_attempt: "1",
    runner_environment: "github-hosted",
    ...overrides
  };
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function token(payload = claims(), header = { alg: "RS256", kid: "fixture-key", typ: "JWT" }, signer = privateKey) {
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signature = sign("sha256", Buffer.from(signingInput), { key: signer, padding: constants.RSA_PKCS1_PADDING });
  return Promise.resolve(`${signingInput}.${signature.toString("base64url")}`);
}

async function rejected(payload, expected, requestBody = body, header) {
  await assert.rejects(() => token(payload, header).then((value) => verifyGitHubOidcToken(value, requestBody, { jwks: { keys: [jwk] }, nowSeconds: now })), expected);
}

test("valid locally signed GitHub OIDC token is accepted", async () => {
  const value = await token();
  const result = await verifyGitHubOidcToken(value, body, { jwks: { keys: [jwk] }, nowSeconds: now });
  assert.equal(result.classification, "production_action");
});

test("OIDC verifier rejects invalid issuer and audience", async () => {
  await rejected(claims({ iss: "https://issuer.invalid" }), /issuer mismatch/);
  await rejected(claims({ aud: "wrong-audience" }), /audience mismatch/);
});

test("OIDC verifier rejects invalid signature, algorithm, and key identity", async () => {
  const bad = await token();
  const parts = bad.split(".");
  parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
  await assert.rejects(() => verifyGitHubOidcToken(parts.join("."), body, { jwks: { keys: [jwk] }, nowSeconds: now }), /invalid signature/);
  await rejected(claims(), /algorithm mismatch/, body, { alg: "ES256", kid: "fixture-key" });
  await assert.rejects(() => token().then((value) => verifyGitHubOidcToken(value, body, { jwks: { keys: [{ ...jwk, kid: "unknown" }] }, nowSeconds: now })), /unknown or ambiguous/);
});

test("OIDC verifier rejects expired, premature, and missing-JTI tokens", async () => {
  await rejected(claims({ exp: now - 31 }), /expired/);
  await rejected(claims({ nbf: now + 31 }), /not yet valid/);
  const missing = claims();
  delete missing.jti;
  await rejected(missing, /JWT ID/);
});

test("OIDC verifier rejects every fixed identity mismatch", async () => {
  const cases = [
    ["repository", "wrong/repository"], ["workflow", "Wrong workflow"], ["workflow_sha", "b".repeat(40)],
    ["environment", "other"], ["event_name", "push"], ["actor", "other"], ["actor_id", "1"],
    ["run_id", "2"], ["run_attempt", "2"]
  ];
  for (const [field, value] of cases) await rejected(claims({ [field]: value }), new RegExp(field.replace("_", ".*"), "i"));
});

test("canonical action contract rejects changed identities and multiplicity", async () => {
  const contract = JSON.parse(await fs.readFile("data/github-pages-governable-deployment-action.v0.json", "utf8"));
  assert.equal(validateContract(contract), contract);
  for (const [field, value] of [
    ["action_version", "0.2"], ["workspace_id", "wrong"], ["repository", "wrong/repo"],
    ["canonical_public_target", "https://other.invalid/"], ["artifact_name", "second"], ["maximum_deployments", 2]
  ]) assert.throws(() => validateContract({ ...contract, [field]: value }), new RegExp(field));
  assert.throws(() => validateContract({ ...contract, immutable_actions: [...contract.immutable_actions, contract.immutable_actions[0]] }), /four immutable/);
});

test("artifact digests are deterministic and change with bytes; symlinks are rejected", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pages-evidence-"));
  await fs.mkdir(path.join(root, "nested"));
  await fs.writeFile(path.join(root, "nested", "a.txt"), "one");
  const first = await buildArtifactEvidence(root);
  const second = await buildArtifactEvidence(root);
  assert.deepEqual(first, second);
  await fs.writeFile(path.join(root, "nested", "a.txt"), "two");
  assert.notEqual((await buildArtifactEvidence(root)).built_artifact_sha256, first.built_artifact_sha256);
  await fs.symlink(path.join(root, "nested", "a.txt"), path.join(root, "link"));
  await assert.rejects(() => buildArtifactEvidence(root), /symlink rejected/);
});

test("uploaded artifact identity rejects name, ID, run, attempt, expiry, and ambiguity", () => {
  const artifact = { id: 7, name: FIXED.artifactName, expired: false, workflow_run: { id: 9 } };
  const run = { id: 9, run_attempt: 1 };
  assert.equal(validateArtifactApiResponse({ artifacts: [artifact], run, artifactId: 7, runId: 9 }), artifact);
  assert.throws(() => validateArtifactApiResponse({ artifacts: [], run, artifactId: 7, runId: 9 }), /ambiguous/);
  assert.throws(() => validateArtifactApiResponse({ artifacts: [{ ...artifact, name: "wrong" }], run, artifactId: 7, runId: 9 }), /name/);
  assert.throws(() => validateArtifactApiResponse({ artifacts: [{ ...artifact, id: 8 }], run, artifactId: 7, runId: 9 }), /ID/);
  assert.throws(() => validateArtifactApiResponse({ artifacts: [{ ...artifact, expired: true }], run, artifactId: 7, runId: 9 }), /expired/);
  assert.throws(() => validateArtifactApiResponse({ artifacts: [artifact], run: { ...run, run_attempt: 2 }, artifactId: 7, runId: 9 }), /attempt/);
});

test("database bridge is fixed, server-only, and non-mutating", async () => {
  const sql = await fs.readFile("supabase/migrations/20260716_0001_github_pages_operator_resolution_bridge_v0.sql", "utf8");
  assert.match(sql, /resolve_github_pages_operator_evidence_v0\(\)/);
  assert.match(sql, /resolve_current_operator_principal_core\(fixed_workspace_id\)/);
  assert.match(sql, /4702d528-f7a7-4a04-a991-3176bec69f52/);
  assert.match(sql, /revoke all .* from anon/i);
  assert.match(sql, /grant execute .* to service_role/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete|merge|truncate)\b/i);
});

test("static workflow cardinality and immutable references validate", async () => {
  assert.equal(await validateRepository(), true);
});
