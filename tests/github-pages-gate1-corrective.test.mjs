import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  FIXED,
  REJECTION_REASON_CODES,
  canonicalJson,
  classifyRejection,
  createDatabaseParameters,
  sha256,
  validateManifest,
  verifyArtifact,
  verifyGitHubOidc,
  verifyRequesterEvidence
} from "../supabase/functions/github-pages-authorization-request-v0/lib.ts";

const workflowPath = ".github/workflows/pages-runtime-config.yml";
const requestIndexPath = "supabase/functions/github-pages-authorization-request-v0/index.ts";

function sha256Node(value) {
  return createHash("sha256").update(value).digest("hex");
}

function baseManifest(overrides = {}) {
  const value = {
    schema_version: "0.1",
    action_identifier: "github_pages_outward_publication@0.1",
    workspace_id: FIXED.workspaceId,
    repository: FIXED.repository,
    repository_id: FIXED.repositoryId,
    ref: FIXED.ref,
    workflow_path: FIXED.workflowPath,
    workflow_name: FIXED.workflow,
    workflow_sha: "a".repeat(40),
    run_id: 990001,
    run_attempt: 1,
    requester_actor: FIXED.actor,
    requester_actor_id: FIXED.actorId,
    requester_oidc_evidence_sha256: "1".repeat(64),
    source_commit_sha: "b".repeat(40),
    source_tree_sha: "c".repeat(40),
    runtime_config_evidence_sha256: "2".repeat(64),
    built_artifact_sha256: "3".repeat(64),
    operator_resolution_evidence_sha256: "4".repeat(64),
    artifact_id: 880001,
    artifact_name: FIXED.artifactName,
    artifact_run_id: 990001,
    artifact_run_attempt: 1,
    artifact_uploaded_at: "2033-05-18T03:33:20.000Z",
    artifact_expires_at: "2033-05-19T03:33:20.000Z",
    upload_action_repository: "actions/upload-pages-artifact",
    upload_action_commit_sha: "56afc609e74202658d3ffba0e8f6dda462b719fa",
    deploy_action_repository: "actions/deploy-pages",
    deploy_action_commit_sha: "d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e",
    environment_name: FIXED.environment,
    canonical_public_target: FIXED.target,
    permitted_effect: "replace the current GitHub Pages deployment for the canonical target with the exact bound uploaded artifact",
    maximum_artifact_uploads: 1,
    maximum_deployments: 1,
    authorization_contract_version: "github-pages-publication-authorization-v0",
    ...overrides
  };
  const withoutDigest = { ...value };
  delete withoutDigest.action_manifest_sha256;
  return { ...withoutDigest, action_manifest_sha256: sha256Node(canonicalJson(withoutDigest)) };
}

function baseClaims(manifest, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: FIXED.issuer,
    aud: FIXED.requestAudience,
    sub: `repo:${FIXED.repository}:environment:${FIXED.environment}`,
    repository: FIXED.repository,
    repository_id: FIXED.repositoryId,
    repository_owner: FIXED.repositoryOwner,
    repository_owner_id: FIXED.repositoryOwnerId,
    repository_visibility: "public",
    ref: FIXED.ref,
    ref_type: "branch",
    sha: manifest.source_commit_sha,
    workflow: FIXED.workflow,
    workflow_ref: `${FIXED.repository}/${FIXED.workflowPath}@${FIXED.ref}`,
    workflow_sha: manifest.workflow_sha,
    run_id: String(manifest.run_id),
    run_number: "1",
    run_attempt: "1",
    actor: FIXED.actor,
    actor_id: FIXED.actorId,
    triggering_actor: FIXED.actor,
    event_name: "workflow_dispatch",
    environment: FIXED.environment,
    runner_environment: "github-hosted",
    jti: "synthetic-jti",
    iat: now - 10,
    nbf: now - 10,
    exp: now + 300,
    ...overrides
  };
}

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" });
Object.assign(publicJwk, { alg: "RS256", use: "sig", kid: "synthetic-key" });

function signedToken(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "synthetic-key", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const input = `${header}.${payload}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}

async function withOidcFetch(callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/.well-known/openid-configuration")) {
      return Response.json({ issuer: FIXED.issuer, jwks_uri: `${FIXED.issuer}/.well-known/jwks` });
    }
    if (url.endsWith("/.well-known/jwks")) return Response.json({ keys: [publicJwk] });
    throw new Error(`unexpected synthetic fetch: ${url}`);
  };
  try { return await callback(); }
  finally { globalThis.fetch = originalFetch; }
}

test("database create parameters preserve the validated manifest as a JSON object", async () => {
  const validated = await validateManifest(baseManifest());
  const parameters = createDatabaseParameters(validated);
  assert.equal(typeof parameters[0], "object");
  assert.equal(parameters[0], validated.manifest);
  assert.notEqual(typeof parameters[0], "string");
});

test("all required bounded reason codes are present and externally suppressed", async () => {
  const required = [
    "route_mismatch", "request_too_large", "invalid_bearer_syntax", "body_parse_failed", "body_shape_invalid",
    "create_field_set_mismatch", "manifest_validation_failed", "oidc_signature_failed", "oidc_issuer_mismatch",
    "oidc_audience_mismatch", "oidc_temporal_invalid", "oidc_repository_mismatch", "oidc_repository_id_mismatch",
    "oidc_owner_mismatch", "oidc_actor_mismatch", "oidc_actor_id_mismatch", "oidc_triggering_actor_mismatch",
    "oidc_workflow_mismatch", "oidc_workflow_sha_mismatch", "oidc_ref_mismatch", "oidc_event_mismatch",
    "oidc_run_mismatch", "oidc_run_attempt_mismatch", "oidc_source_commit_mismatch",
    "requester_oidc_evidence_mismatch", "artifact_authentication_failed", "artifact_not_found", "artifact_mismatch",
    "artifact_run_mismatch", "artifact_attempt_mismatch", "artifact_expired", "database_credential_unavailable",
    "database_connection_failed", "database_request_rejected", "database_result_cardinality_mismatch",
    "internal_indeterminate_failure"
  ];
  assert.deepEqual([...REJECTION_REASON_CODES], required);
  const source = await fs.readFile(requestIndexPath, "utf8");
  assert.match(source, /return json\(401,\{error:"authorization_request_denied"\}\)/);
  assert.doesNotMatch(source, /return json\(401,\{error:classifyRejection/);
});

test("signed synthetic OIDC substitutions fail with exact bounded classifications", async () => {
  const manifest = baseManifest();
  const valid = signedToken(baseClaims(manifest));
  await withOidcFetch(async () => {
    const observed = await verifyGitHubOidc(valid, FIXED.requestAudience, {
      run_id: manifest.run_id,
      workflow_sha: manifest.workflow_sha,
      source_commit_sha: manifest.source_commit_sha
    });
    assert.equal(observed.repository, FIXED.repository);
    await verifyRequesterEvidence(valid, await sha256(valid));
    await assert.rejects(() => verifyRequesterEvidence(valid, "0".repeat(64)), (error) => {
      assert.equal(classifyRejection("requester_evidence", error), "requester_oidc_evidence_mismatch");
      return true;
    });
    const tampered = `${valid.slice(0, -1)}${valid.endsWith("a") ? "b" : "a"}`;
    await assert.rejects(
      () => verifyGitHubOidc(tampered, FIXED.requestAudience, {
        run_id: manifest.run_id,
        workflow_sha: manifest.workflow_sha,
        source_commit_sha: manifest.source_commit_sha
      }),
      (error) => {
        assert.equal(classifyRejection("oidc_validation", error), "oidc_signature_failed");
        return true;
      }
    );

    const cases = [
      ["issuer", { iss: "https://issuer.invalid" }, "oidc_issuer_mismatch"],
      ["audience", { aud: "https://audience.invalid" }, "oidc_audience_mismatch"],
      ["repository", { repository: "substituted/repository" }, "oidc_repository_mismatch"],
      ["repository ID", { repository_id: "1" }, "oidc_repository_id_mismatch"],
      ["owner", { repository_owner: "substituted" }, "oidc_owner_mismatch"],
      ["owner ID", { repository_owner_id: "1" }, "oidc_owner_mismatch"],
      ["actor", { actor: "substituted" }, "oidc_actor_mismatch"],
      ["actor ID", { actor_id: "1" }, "oidc_actor_id_mismatch"],
      ["triggering actor", { triggering_actor: "substituted" }, "oidc_triggering_actor_mismatch"],
      ["workflow", { workflow: "Substituted workflow" }, "oidc_workflow_mismatch"],
      ["workflow ref", { workflow_ref: "substituted/ref" }, "oidc_workflow_mismatch"],
      ["ref", { ref: "refs/heads/substituted" }, "oidc_ref_mismatch"],
      ["event", { event_name: "push" }, "oidc_event_mismatch"],
      ["run attempt", { run_attempt: "2" }, "oidc_run_attempt_mismatch"],
      ["temporal", { exp: 1 }, "oidc_temporal_invalid"]
    ];
    for (const [label, overrides, reason] of cases) {
      const token = signedToken(baseClaims(manifest, overrides));
      await assert.rejects(
        () => verifyGitHubOidc(token, FIXED.requestAudience, {
          run_id: manifest.run_id,
          workflow_sha: manifest.workflow_sha,
          source_commit_sha: manifest.source_commit_sha
        }),
        (error) => {
          assert.equal(classifyRejection("oidc_validation", error), reason, label);
          return true;
        },
        label
      );
    }
    for (const [label, binding, reason] of [
      ["run ID", { run_id: 1, workflow_sha: manifest.workflow_sha, source_commit_sha: manifest.source_commit_sha }, "oidc_run_mismatch"],
      ["workflow SHA", { run_id: manifest.run_id, workflow_sha: "d".repeat(40), source_commit_sha: manifest.source_commit_sha }, "oidc_workflow_sha_mismatch"],
      ["source commit", { run_id: manifest.run_id, workflow_sha: manifest.workflow_sha, source_commit_sha: "e".repeat(40) }, "oidc_source_commit_mismatch"]
    ]) {
      await assert.rejects(
        () => verifyGitHubOidc(valid, FIXED.requestAudience, binding),
        (error) => {
          assert.equal(classifyRejection("oidc_validation", error), reason, label);
          return true;
        }
      );
    }
  });
});

test("artifact verification accepts the exact tuple and classifies bounded failures", async () => {
  const manifest = baseManifest();
  const exactArtifact = {
    id: manifest.artifact_id,
    name: manifest.artifact_name,
    expired: false,
    created_at: manifest.artifact_uploaded_at,
    expires_at: manifest.artifact_expires_at,
    workflow_run: { id: manifest.run_id }
  };
  const exactRun = { id: manifest.run_id, run_attempt: 1, head_sha: manifest.source_commit_sha };
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => Response.json(String(input).includes("/actions/artifacts/") ? exactArtifact : exactRun);
    await verifyArtifact(manifest, "synthetic-github-api-token");
    const cases = [
      ["wrong artifact", { ...exactArtifact, id: 7 }, exactRun, "artifact_mismatch"],
      ["wrong name", { ...exactArtifact, name: "wrong" }, exactRun, "artifact_mismatch"],
      ["wrong run", { ...exactArtifact, workflow_run: { id: 7 } }, exactRun, "artifact_run_mismatch"],
      ["wrong attempt", exactArtifact, { ...exactRun, run_attempt: 2 }, "artifact_attempt_mismatch"],
      ["wrong source", exactArtifact, { ...exactRun, head_sha: "f".repeat(40) }, "artifact_run_mismatch"],
      ["expired", { ...exactArtifact, expired: true }, exactRun, "artifact_expired"]
    ];
    for (const [label, artifact, run, reason] of cases) {
      globalThis.fetch = async (input) => Response.json(String(input).includes("/actions/artifacts/") ? artifact : run);
      await assert.rejects(() => verifyArtifact(manifest, "synthetic-github-api-token"), (error) => {
        assert.equal(classifyRejection("artifact_verification", error), reason, label);
        return true;
      });
    }
    for (const [status, reason] of [[401, "artifact_authentication_failed"], [404, "artifact_not_found"], [500, "internal_indeterminate_failure"]]) {
      globalThis.fetch = async () => new Response("{}", { status });
      await assert.rejects(() => verifyArtifact(manifest, "synthetic-github-api-token"), (error) => {
        assert.equal(classifyRejection("artifact_verification", error), reason);
        return true;
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runtime builders and validators emit no reversible canary values while preserving the public runtime file", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "aetherus-gate1-request-diagnostic-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const site = path.join(root, "site");
  const evidence = path.join(root, "evidence");
  const tokenPath = path.join(root, "oidc-token");
  const runtimePath = path.join(site, "js", "aetherus-runtime-config.js");
  const urlCanary = "https://runtime.invalid/RUNTIMEURLCANARY7?value=%2Fgate-1";
  const keyCanary = "sb_publishable_PUBLISHKEYCANARY9-+/=gate1";
  const commonEnv = {
    ...process.env,
    AETHERUS_SUPABASE_URL: urlCanary,
    AETHERUS_SUPABASE_PUBLISHABLE_KEY: keyCanary,
    EVIDENCE_DIRECTORY: evidence,
    SITE_DIRECTORY: site,
    RUNTIME_CONFIG_OUTPUT: runtimePath
  };
  const executions = [];
  for (const args of [
    ["scripts/generate-github-pages-runtime-config.mjs"],
    ["scripts/build-github-pages-deployment-evidence.mjs", "artifact"]
  ]) {
    const result = spawnSync(process.execPath, args, { encoding: "utf8", env: commonEnv });
    assert.equal(result.status, 0, result.stderr);
    executions.push(result.stdout, result.stderr);
  }
  const syntheticFiles = {
    "source-evidence.json": {
      workflow_sha: "a".repeat(40), run_id: "990001", run_attempt: 1,
      source_commit_sha: "b".repeat(40), source_tree_sha: "c".repeat(40)
    },
    "operator-resolution-evidence.json": { operator_resolution_evidence_sha256: "4".repeat(64) },
    "uploaded-artifact-evidence.json": {
      artifact_id: 880001, artifact_name: FIXED.artifactName, artifact_run_id: 990001, artifact_run_attempt: 1,
      artifact_uploaded_at: "2033-05-18T03:33:20.000Z", artifact_expires_at: "2033-05-19T03:33:20.000Z"
    }
  };
  await fs.mkdir(evidence, { recursive: true });
  for (const [name, value] of Object.entries(syntheticFiles)) {
    await fs.writeFile(path.join(evidence, name), `${JSON.stringify(value)}\n`);
  }
  await fs.writeFile(tokenPath, "synthetic-non-production-oidc-token-material");
  for (const [args, extraEnv] of [
    [["scripts/build-github-pages-final-action-manifest.mjs"], { AUTHORIZATION_REQUEST_OIDC_TOKEN_PATH: tokenPath }],
    [["scripts/validate-github-pages-governable-deployment-action.mjs"], {}]
  ]) {
    const result = spawnSync(process.execPath, args, { encoding: "utf8", env: { ...commonEnv, ...extraEnv } });
    assert.equal(result.status, 0, result.stderr);
    executions.push(result.stdout, result.stderr);
  }
  const output = executions.join("\n");
  const representations = new Set();
  for (const value of [urlCanary, keyCanary]) {
    representations.add(value);
    representations.add(encodeURIComponent(value));
    representations.add(JSON.stringify(value).slice(1, -1));
    representations.add(Buffer.from(value).toString("base64"));
    representations.add(`'${value.replaceAll("'", "'\\''")}'`);
  }
  representations.add("RUNTIMEURLCANARY7");
  representations.add("PUBLISHKEYCANARY9");
  for (const representation of representations) {
    assert.equal(output.includes(representation), false, `reversible canary occurrence: ${representation.slice(0, 24)}`);
  }
  const generated = await fs.readFile(runtimePath, "utf8");
  assert.match(generated, /globalThis\.AETHERUS_SUPABASE_PUBLIC_CONFIG/);
  assert.ok(generated.includes(urlCanary));
  assert.ok(generated.includes(keyCanary));
});

test("workflow keeps one upload and one deploy, uses masked secrets, and has no tracing or raw echo", async () => {
  const workflow = await fs.readFile(workflowPath, "utf8");
  assert.equal((workflow.match(/actions\/upload-pages-artifact@/g) || []).length, 1);
  assert.equal((workflow.match(/actions\/deploy-pages@/g) || []).length, 1);
  assert.equal((workflow.match(/secrets\.AETHERUS_SUPABASE_URL/g) || []).length, 2);
  assert.equal((workflow.match(/secrets\.AETHERUS_SUPABASE_PUBLISHABLE_KEY/g) || []).length, 2);
  assert.doesNotMatch(workflow, /vars\.AETHERUS_SUPABASE_(URL|PUBLISHABLE_KEY)/);
  assert.doesNotMatch(workflow, /\bset\s+-x\b|printenv|process\.env\s*\)|console\.log\(process\.env/);
});
