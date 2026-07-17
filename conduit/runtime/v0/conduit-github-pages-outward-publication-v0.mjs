import { digestObject } from "../../../scripts/lib/github-pages-governable.mjs";

export const githubPagesConduitEndpoint =
  "https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-conduit-invocation-v0";

export const githubPagesConduitEnvelopeFields = Object.freeze([
  "schema_version", "request_id", "trace_id", "correlation_id",
  "action_identifier", "policy_surface", "claim_id", "requested_action",
  "workspace_id", "repository", "repository_id", "repository_ref",
  "workflow_path", "workflow_sha", "workflow_run_id", "run_attempt",
  "authorization_record_id", "execution_identity_sha256", "action_manifest_sha256",
  "artifact_id", "artifact_name", "artifact_run_id", "artifact_run_attempt", "built_artifact_sha256",
  "canonical_public_target", "environment", "permitted_effect", "deploy_executor_sha",
  "phase4_status_receipt_sha256", "palisade_decision_id", "palisade_decision_sha256"
].sort());

export const githubPagesConduitProhibitedFields = new Set([
  "allowed", "decision", "policy_decision", "precomputed_decision", "authorization_status",
  "authorization_witness", "operator_approval", "consumption_result", "consumption_receipt",
  "deployment_permit", "policy_evaluator", "custom_adapter", "action_override", "target_override",
  "dependency_override", "artifact_override", "fail_open", "allow_on_failure", "skip_policy",
  "skip_consumption", "skip_validation", "test_fixture", "service_credential", "database_role",
  "github_api_token"
]);

const fixed = Object.freeze({
  schema_version: "0.5", action_identifier: "github_pages_outward_publication@0.1",
  policy_surface: "github_pages_outward_publication_boundary", claim_id: "github_pages_outward_publication_authority",
  requested_action: "github_pages_outward_publication@0.1", workspace_id: "9abed891-7950-4937-a2aa-4b957d8a4bd1",
  repository: "AETHERUS-MONOLITH/AETHERUS_MONOLITH", repository_id: "1167751543", repository_ref: "refs/heads/main",
  workflow_path: ".github/workflows/pages-runtime-config.yml", run_attempt: 1, artifact_name: "github-pages-governable-v0-1",
  artifact_run_attempt: 1, canonical_public_target: "https://camilocarlone.com/", environment: "github-pages",
  permitted_effect: "replace the current GitHub Pages deployment for the canonical target with the exact bound uploaded artifact",
  deploy_executor_sha: "d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e"
});

function findProhibited(value, prefix = "request") {
  if (!value || typeof value !== "object") return [];
  const found = [];
  for (const [key, nested] of Object.entries(value)) {
    const path = `${prefix}.${key}`;
    if (githubPagesConduitProhibitedFields.has(key)) found.push(path);
    if (nested && typeof nested === "object") found.push(...findProhibited(nested, path));
  }
  return found;
}

export function validateGithubPagesConduitEnvelopeV0(envelope) {
  const errors = [];
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return ["envelope_not_object"];
  const prohibited = findProhibited(envelope);
  if (prohibited.length) errors.push(`prohibited_fields:${prohibited.join(",")}`);
  if (JSON.stringify(Object.keys(envelope).sort()) !== JSON.stringify(githubPagesConduitEnvelopeFields)) errors.push("envelope_fields_mismatch");
  for (const [field, value] of Object.entries(fixed)) if (envelope[field] !== value) errors.push(`${field}_mismatch`);
  for (const field of ["request_id", "trace_id", "correlation_id", "authorization_record_id", "palisade_decision_id"])
    if (typeof envelope[field] !== "string" || envelope[field].length === 0) errors.push(`${field}_invalid`);
  for (const field of ["execution_identity_sha256", "action_manifest_sha256", "built_artifact_sha256", "phase4_status_receipt_sha256", "palisade_decision_sha256"])
    if (!/^[0-9a-f]{64}$/.test(envelope[field] || "")) errors.push(`${field}_invalid`);
  if (!/^[0-9a-f]{40}$/.test(envelope.workflow_sha || "")) errors.push("workflow_sha_invalid");
  for (const field of ["workflow_run_id", "artifact_id", "artifact_run_id"])
    if (!/^[1-9][0-9]*$/.test(envelope[field] || "")) errors.push(`${field}_invalid`);
  return errors;
}

export function governedGithubPagesInvocationTupleV0(envelope, conduitInvocationId) {
  return {
    action_identifier: envelope.action_identifier, policy_surface: envelope.policy_surface, claim_id: envelope.claim_id,
    requested_action: envelope.requested_action, request_id: envelope.request_id,
    authorization_record_id: envelope.authorization_record_id, execution_identity_sha256: envelope.execution_identity_sha256,
    action_manifest_sha256: envelope.action_manifest_sha256, workspace_id: envelope.workspace_id,
    repository_id: envelope.repository_id, repository_ref: envelope.repository_ref, workflow_path: envelope.workflow_path,
    workflow_sha: envelope.workflow_sha, workflow_run_id: envelope.workflow_run_id, run_attempt: envelope.run_attempt,
    artifact_id: envelope.artifact_id, artifact_name: envelope.artifact_name, built_artifact_sha256: envelope.built_artifact_sha256,
    canonical_public_target: envelope.canonical_public_target, environment: envelope.environment,
    permitted_effect: envelope.permitted_effect, deploy_executor_sha: envelope.deploy_executor_sha,
    phase4_status_receipt_sha256: envelope.phase4_status_receipt_sha256, palisade_decision_id: envelope.palisade_decision_id,
    palisade_decision_sha256: envelope.palisade_decision_sha256, conduit_invocation_id: conduitInvocationId
  };
}

export function governedGithubPagesInvocationSha256V0(envelope, conduitInvocationId) {
  return digestObject(governedGithubPagesInvocationTupleV0(envelope, conduitInvocationId));
}

export function validateGithubPagesConduitResultV0(result, envelope) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Conduit result must be an object");
  for (const [field, expected] of [
    ["request_id", envelope.request_id], ["authorization_record_id", envelope.authorization_record_id],
    ["action_manifest_sha256", envelope.action_manifest_sha256], ["artifact_id", envelope.artifact_id],
    ["workflow_run_id", envelope.workflow_run_id], ["run_attempt", envelope.run_attempt],
    ["canonical_public_target", envelope.canonical_public_target], ["deploy_executor_sha", envelope.deploy_executor_sha],
    ["palisade_decision_id", envelope.palisade_decision_id], ["palisade_decision_sha256", envelope.palisade_decision_sha256],
    ["state", "consumed"], ["deployment_permit", true]
  ]) if (String(result[field]) !== String(expected)) throw new Error(`Conduit result ${field} mismatch`);
  for (const field of ["conduit_invocation_id", "conduit_invocation_sha256", "governed_invocation_sha256", "consumption_receipt_sha256", "result_sha256"])
    if (typeof result[field] !== "string" || result[field].length === 0) throw new Error(`Conduit result ${field} missing`);
  return result;
}

export async function invokeGithubPagesOutwardPublicationV0(envelope, oidcToken, fetchImpl = fetch) {
  const errors = validateGithubPagesConduitEnvelopeV0(envelope);
  if (errors.length) throw new Error(`Conduit envelope rejected: ${errors.join(", ")}`);
  if (typeof oidcToken !== "string" || oidcToken.length < 32) throw new Error("Conduit OIDC token unavailable");
  const response = await fetchImpl(githubPagesConduitEndpoint, {
    method: "POST", headers: { authorization: `Bearer ${oidcToken}`, "content-type": "application/json" },
    body: JSON.stringify(envelope), redirect: "error"
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`Conduit endpoint returned non-JSON status ${response.status}`); }
  if (!response.ok) throw new Error(`Conduit invocation failed with ${response.status}: ${payload.failure_code || payload.error || "fail_closed"}`);
  return validateGithubPagesConduitResultV0(payload, envelope);
}
