import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildArtifactEvidence, canonicalJson, digestObject, FIXED, sha256, validateOperatorEvidence } from "./lib/github-pages-governable.mjs";

const evidenceDirectory = process.env.EVIDENCE_DIRECTORY || `${process.env.RUNNER_TEMP || "."}/github-pages-governable-evidence`;

async function write(name, value) {
  await fs.mkdir(evidenceDirectory, { recursive: true });
  await fs.writeFile(`${evidenceDirectory}/${name}`, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function read(name) {
  return JSON.parse(await fs.readFile(`${evidenceDirectory}/${name}`, "utf8"));
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function exact(actual, expected, label) {
  if (String(actual) !== String(expected)) throw new Error(`${label} mismatch`);
}

function exactKeys(value, required, label) {
  const actual = Object.keys(value).sort();
  const expected = [...required].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error(`${label} fields mismatch`);
}

async function sourceEvidence() {
  exact(process.env.GITHUB_REPOSITORY, FIXED.repository, "repository");
  exact(process.env.GITHUB_REPOSITORY_ID, FIXED.repositoryId, "repository ID");
  exact(process.env.GITHUB_REPOSITORY_OWNER, FIXED.repositoryOwner, "repository owner");
  exact(process.env.GITHUB_REPOSITORY_OWNER_ID, FIXED.repositoryOwnerId, "repository owner ID");
  exact(process.env.GITHUB_REF, FIXED.ref, "ref");
  exact(process.env.GITHUB_ACTOR, FIXED.actor, "actor");
  exact(process.env.GITHUB_ACTOR_ID, FIXED.actorId, "actor ID");
  exact(process.env.GITHUB_TRIGGERING_ACTOR, FIXED.actor, "triggering actor");
  exact(process.env.GITHUB_RUN_ATTEMPT, "1", "run attempt");
  exact(process.env.GITHUB_EVENT_NAME, FIXED.eventName, "event name");
  exact(git("rev-parse", "HEAD"), process.env.GITHUB_SHA, "checked-out commit");
  if (git("status", "--porcelain", "--untracked-files=no")) throw new Error("tracked checkout must be clean");
  const body = {
    schema_version: FIXED.schemaVersion,
    source_commit_sha: process.env.GITHUB_SHA,
    source_tree_sha: git("rev-parse", `${process.env.GITHUB_SHA}^{tree}`),
    workflow_sha: process.env.GITHUB_WORKFLOW_SHA,
    repository: FIXED.repository,
    repository_id: FIXED.repositoryId,
    repository_owner: FIXED.repositoryOwner,
    repository_owner_id: FIXED.repositoryOwnerId,
    ref: FIXED.ref,
    workflow: FIXED.productionWorkflow,
    run_id: process.env.GITHUB_RUN_ID,
    run_attempt: 1,
    requester_actor: FIXED.actor,
    requester_actor_id: FIXED.actorId
  };
  await write("source-evidence.json", { ...body, source_evidence_sha256: digestObject(body) });
}

async function artifactEvidence() {
  const fields = ["AETHERUS_SUPABASE_URL", "AETHERUS_SUPABASE_PUBLISHABLE_KEY"];
  for (const name of fields) if (!process.env[name]) throw new Error(`missing required runtime field ${name}`);
  const runtimeDigestInput = { schema_version: FIXED.schemaVersion, fields: fields.map((name) => [name, process.env[name]]) };
  const runtime = {
    schema_version: FIXED.schemaVersion,
    field_names: fields,
    runtime_config_evidence_sha256: digestObject(runtimeDigestInput)
  };
  const artifact = await buildArtifactEvidence(process.env.SITE_DIRECTORY || "_site");
  await write("runtime-config-evidence.json", runtime);
  await write("built-artifact-evidence.json", { schema_version: FIXED.schemaVersion, ...artifact });
}

async function operatorEvidence() {
  const file = process.env.OPERATOR_RESPONSE_PATH;
  if (!file) throw new Error("OPERATOR_RESPONSE_PATH is required");
  const response = validateOperatorEvidence(JSON.parse(await fs.readFile(file, "utf8")));
  exact(response.operator_principal_id, FIXED.operatorPrincipalId, "Operator principal");
  exact(response.authority_version, FIXED.operatorAuthorityVersion, "Operator authority version");
  await write("operator-resolution-evidence.json", {
    schema_version: FIXED.schemaVersion,
    evidence: response,
    operator_resolution_evidence_sha256: digestObject(response)
  });
}

async function finalManifestEvidence() {
  const contract = JSON.parse(await fs.readFile("contracts/github-pages-publication-final-manifest-v0.json", "utf8"));
  const action = JSON.parse(await fs.readFile("data/github-pages-governable-deployment-action.v0.json", "utf8"));
  const source = await read("source-evidence.json");
  const runtime = await read("runtime-config-evidence.json");
  const built = await read("built-artifact-evidence.json");
  const operator = await read("operator-resolution-evidence.json");
  const uploaded = await read("uploaded-artifact-evidence.json");
  const oidcPath = process.env.AUTHORIZATION_REQUEST_OIDC_TOKEN_PATH;
  if (!oidcPath) throw new Error("AUTHORIZATION_REQUEST_OIDC_TOKEN_PATH is required");
  const oidcToken = await fs.readFile(oidcPath);
  if (oidcToken.length < 32) throw new Error("requester OIDC token is invalid");
  const manifest = {
    schema_version: FIXED.schemaVersion,
    action_identifier: FIXED.actionIdentifier,
    workspace_id: FIXED.workspaceId,
    repository: FIXED.repository,
    repository_id: FIXED.repositoryId,
    ref: FIXED.ref,
    workflow_path: FIXED.productionWorkflowPath,
    workflow_name: FIXED.productionWorkflow,
    workflow_sha: source.workflow_sha,
    run_id: source.run_id,
    run_attempt: source.run_attempt,
    requester_actor: FIXED.actor,
    requester_actor_id: FIXED.actorId,
    requester_oidc_evidence_sha256: sha256(oidcToken),
    source_commit_sha: source.source_commit_sha,
    source_tree_sha: source.source_tree_sha,
    runtime_config_evidence_sha256: runtime.runtime_config_evidence_sha256,
    built_artifact_sha256: built.built_artifact_sha256,
    operator_resolution_evidence_sha256: operator.operator_resolution_evidence_sha256,
    artifact_id: uploaded.artifact_id,
    artifact_name: uploaded.artifact_name,
    artifact_run_id: uploaded.artifact_run_id,
    artifact_run_attempt: uploaded.artifact_run_attempt,
    artifact_uploaded_at: uploaded.artifact_uploaded_at,
    artifact_expires_at: uploaded.artifact_expires_at,
    upload_action_repository: "actions/upload-pages-artifact",
    upload_action_commit_sha: "56afc609e74202658d3ffba0e8f6dda462b719fa",
    deploy_action_repository: "actions/deploy-pages",
    deploy_action_commit_sha: "d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e",
    environment_name: FIXED.environment,
    canonical_public_target: FIXED.target,
    permitted_effect: action.permitted_effect,
    maximum_artifact_uploads: 1,
    maximum_deployments: 1,
    authorization_contract_version: FIXED.authorizationContractVersion
  };
  exactKeys(manifest, contract.required_fields, "final manifest");
  const actionManifestSha256 = digestObject(manifest);
  await write("final-action-manifest.json", { ...manifest, action_manifest_sha256: actionManifestSha256 });
  process.stdout.write(`action_manifest_sha256=${actionManifestSha256}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const stage = process.argv[2];
  if (stage === "source") await sourceEvidence();
  else if (stage === "artifact") await artifactEvidence();
  else if (stage === "operator") await operatorEvidence();
  else throw new Error("expected source, artifact, or operator stage");
}

export { artifactEvidence, finalManifestEvidence, operatorEvidence, sourceEvidence };
