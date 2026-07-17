import fs from "node:fs/promises";
import { invokeGithubPagesOutwardPublicationV0 } from "../conduit/runtime/v0/index.mjs";

const directory = process.env.EVIDENCE_DIRECTORY || `${process.env.RUNNER_TEMP}/github-pages-governable-evidence`;
const tokenPath = process.env.CONDUIT_INVOCATION_OIDC_TOKEN_PATH;
if (!tokenPath) throw new Error("CONDUIT_INVOCATION_OIDC_TOKEN_PATH is required");

const [token, request, status, manifest, decision] = await Promise.all([
  fs.readFile(tokenPath, "utf8"),
  fs.readFile(`${directory}/authorization-request-receipt.json`, "utf8").then(JSON.parse),
  fs.readFile(`${directory}/authorization-decision-receipt.json`, "utf8").then(JSON.parse),
  fs.readFile(`${directory}/final-action-manifest.json`, "utf8").then(JSON.parse),
  fs.readFile(`${directory}/palisade-decision-receipt.json`, "utf8").then(JSON.parse)
]);

const envelope = {
  schema_version: "0.5",
  request_id: request.request_id,
  trace_id: request.request_id,
  correlation_id: request.request_id,
  action_identifier: manifest.action_identifier,
  policy_surface: "github_pages_outward_publication_boundary",
  claim_id: "github_pages_outward_publication_authority",
  requested_action: "github_pages_outward_publication@0.1",
  workspace_id: manifest.workspace_id,
  repository: manifest.repository,
  repository_id: String(manifest.repository_id),
  repository_ref: manifest.ref,
  workflow_path: manifest.workflow_path,
  workflow_sha: manifest.workflow_sha,
  workflow_run_id: String(manifest.run_id),
  run_attempt: manifest.run_attempt,
  authorization_record_id: status.authorization_record_id,
  execution_identity_sha256: status.execution_identity_sha256,
  action_manifest_sha256: manifest.action_manifest_sha256,
  artifact_id: String(manifest.artifact_id),
  artifact_name: manifest.artifact_name,
  artifact_run_id: String(manifest.artifact_run_id),
  artifact_run_attempt: manifest.artifact_run_attempt,
  built_artifact_sha256: manifest.built_artifact_sha256,
  canonical_public_target: manifest.canonical_public_target,
  environment: manifest.environment_name,
  permitted_effect: manifest.permitted_effect,
  deploy_executor_sha: manifest.deploy_action_commit_sha,
  phase4_status_receipt_sha256: status.phase4_status_receipt_sha256,
  palisade_decision_id: decision.palisade_decision_id,
  palisade_decision_sha256: decision.palisade_decision_sha256
};

const result = await invokeGithubPagesOutwardPublicationV0(envelope, token);
await fs.writeFile(`${directory}/conduit-invocation-receipt.json`, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
const permit = {
  classification: "phase5_governed_deployment_permit",
  action_identifier: envelope.action_identifier,
  request_id: envelope.request_id,
  authorization_record_id: envelope.authorization_record_id,
  action_manifest_sha256: envelope.action_manifest_sha256,
  artifact_id: envelope.artifact_id,
  artifact_name: envelope.artifact_name,
  target: envelope.canonical_public_target,
  palisade_decision_id: envelope.palisade_decision_id,
  palisade_decision_sha256: envelope.palisade_decision_sha256,
  conduit_invocation_id: result.conduit_invocation_id,
  conduit_invocation_sha256: result.conduit_invocation_sha256,
  governed_invocation_sha256: result.governed_invocation_sha256,
  consumption_receipt_sha256: result.consumption_receipt_sha256,
  deployment_permit: result.deployment_permit,
  maximum_deployments: 1
};
await fs.writeFile(`${directory}/deployment-permit.json`, `${JSON.stringify(permit, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`conduit_invocation_id=${result.conduit_invocation_id}\n`);
