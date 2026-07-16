import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { buildArtifactEvidence, canonicalJson, digestObject, FIXED, validateOperatorEvidence } from "./lib/github-pages-governable.mjs";

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
  await write("operator-resolution-evidence.json", {
    schema_version: FIXED.schemaVersion,
    evidence: response,
    operator_resolution_evidence_sha256: digestObject(response)
  });
}

async function manifestEvidence() {
  const contract = JSON.parse(await fs.readFile("data/github-pages-governable-deployment-action.v0.json", "utf8"));
  const source = await read("source-evidence.json");
  const runtime = await read("runtime-config-evidence.json");
  const artifact = await read("built-artifact-evidence.json");
  const operator = await read("operator-resolution-evidence.json");
  const manifest = {
    schema_version: FIXED.schemaVersion,
    action_type: contract.action_type,
    action_version: contract.action_version,
    action_identifier: contract.action_identifier,
    workspace_id: contract.workspace_id,
    repository: contract.repository,
    repository_id: contract.repository_id,
    repository_ref: contract.repository_ref,
    production_workflow_path: contract.production_workflow_path,
    production_workflow_name: contract.production_workflow_name,
    requester: contract.requester,
    run_id: source.run_id,
    run_attempt: source.run_attempt,
    pages_environment: contract.pages_environment,
    source_commit_sha: source.source_commit_sha,
    source_tree_sha: source.source_tree_sha,
    workflow_sha: source.workflow_sha,
    runtime_config_evidence_sha256: runtime.runtime_config_evidence_sha256,
    built_artifact_sha256: artifact.built_artifact_sha256,
    operator_resolution_evidence_sha256: operator.operator_resolution_evidence_sha256,
    immutable_actions: contract.immutable_actions,
    artifact_name: contract.artifact_name,
    canonical_public_target: contract.canonical_public_target,
    permitted_effect: contract.permitted_effect,
    maximum_artifact_uploads: contract.maximum_artifact_uploads,
    maximum_deployments: contract.maximum_deployments,
    evidence_classification: "action_evidence_not_authorization_evidence"
  };
  await write("action-manifest.json", { ...manifest, action_manifest_sha256: digestObject(manifest) });
  process.stdout.write(`action_manifest_sha256=${digestObject(manifest)}\n`);
}

const stage = process.argv[2];
if (stage === "source") await sourceEvidence();
else if (stage === "artifact") await artifactEvidence();
else if (stage === "operator") await operatorEvidence();
else if (stage === "manifest") await manifestEvidence();
else throw new Error("expected source, artifact, operator, or manifest stage");

export { artifactEvidence, manifestEvidence, operatorEvidence, sourceEvidence };
