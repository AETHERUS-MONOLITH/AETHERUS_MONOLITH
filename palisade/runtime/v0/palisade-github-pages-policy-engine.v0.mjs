import { digestObject } from "../../../scripts/lib/github-pages-governable.mjs";

export const githubPagesPalisadePolicyPath =
  "palisade/policy-bundle.v0/policies/github-pages-outward-publication-policy.v0.json";
export const githubPagesPalisadeInputSchemaPath =
  "palisade/policy-bundle.v0/schema/github-pages-outward-publication-input.schema.json";
export const githubPagesPalisadeDecisionSchemaPath =
  "palisade/policy-bundle.v0/schema/github-pages-outward-publication-decision.schema.json";

export const GITHUB_PAGES_POLICY = Object.freeze({
  schema_version: "0.5",
  policy_surface: "github_pages_outward_publication_boundary",
  claim_id: "github_pages_outward_publication_authority",
  requested_action: "github_pages_outward_publication@0.1",
  policy_rule_id: "github-pages-outward-publication-authority-v0",
  action_identifier: "github_pages_outward_publication@0.1",
  workspace_id: "9abed891-7950-4937-a2aa-4b957d8a4bd1",
  repository: "AETHERUS-MONOLITH/AETHERUS_MONOLITH",
  repository_id: "1167751543",
  repository_ref: "refs/heads/main",
  workflow_path: ".github/workflows/pages-runtime-config.yml",
  artifact_name: "github-pages-governable-v0-1",
  canonical_public_target: "https://camilocarlone.com/",
  environment: "github-pages",
  permitted_effect:
    "replace the current GitHub Pages deployment for the canonical target with the exact bound uploaded artifact",
  deploy_executor_sha: "d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e",
  run_attempt: 1,
  artifact_run_attempt: 1
});

export const githubPagesPalisadeInputFields = Object.freeze([
  "schema_version", "policy_surface", "claim_id", "requested_action", "policy_rule_id", "action_identifier",
  "workspace_id", "repository", "repository_id", "repository_ref", "workflow_path", "workflow_sha", "workflow_run_id", "run_attempt",
  "request_id", "authorization_record_id", "execution_identity_sha256", "action_manifest_sha256",
  "artifact_id", "artifact_name", "artifact_run_id", "artifact_run_attempt", "built_artifact_sha256",
  "canonical_public_target", "environment", "permitted_effect", "deploy_executor_sha",
  "phase4_status", "phase4_status_receipt_sha256", "authorization_currently_usable", "authorization_expired", "artifact_expired",
  "operator_assignment_count", "operator_cardinality_exactly_one", "approved_operator_still_valid",
  "request_identity_match", "execution_identity_match", "manifest_digest_match", "artifact_binding_match", "runtime_binding_match",
  "dependency_binding_match", "target_effect_executor_match", "replay_state", "consumption_state"
].sort());

const sha1 = /^[0-9a-f]{40}$/;
const sha256 = /^[0-9a-f]{64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const positiveIntegerString = /^[1-9][0-9]*$/;

function exact(actual, expected, label, errors) {
  if (actual !== expected) errors.push(`${label}_mismatch`);
}

export function validateGithubPagesPalisadeInputV0(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return ["input_not_object"];
  const fields = Object.keys(input).sort();
  if (JSON.stringify(fields) !== JSON.stringify(githubPagesPalisadeInputFields)) errors.push("input_fields_mismatch");
  for (const field of [
    "schema_version", "policy_surface", "claim_id", "requested_action", "policy_rule_id", "action_identifier",
    "workspace_id", "repository", "repository_id", "repository_ref", "workflow_path", "artifact_name",
    "canonical_public_target", "environment", "permitted_effect", "deploy_executor_sha", "run_attempt", "artifact_run_attempt"
  ]) exact(input[field], GITHUB_PAGES_POLICY[field], field, errors);
  for (const field of ["request_id", "authorization_record_id"]) if (!uuid.test(input[field] || "")) errors.push(`${field}_invalid`);
  for (const field of ["execution_identity_sha256", "action_manifest_sha256", "built_artifact_sha256", "phase4_status_receipt_sha256"])
    if (!sha256.test(input[field] || "")) errors.push(`${field}_invalid`);
  if (!sha1.test(input.workflow_sha || "")) errors.push("workflow_sha_invalid");
  for (const field of ["workflow_run_id", "artifact_id", "artifact_run_id"])
    if (!positiveIntegerString.test(input[field] || "")) errors.push(`${field}_invalid`);
  if (!Number.isInteger(input.operator_assignment_count) || input.operator_assignment_count < 0) errors.push("operator_assignment_count_invalid");
  for (const field of [
    "authorization_currently_usable", "authorization_expired", "artifact_expired", "operator_cardinality_exactly_one",
    "approved_operator_still_valid", "request_identity_match", "execution_identity_match", "manifest_digest_match",
    "artifact_binding_match", "runtime_binding_match", "dependency_binding_match", "target_effect_executor_match"
  ]) if (typeof input[field] !== "boolean") errors.push(`${field}_invalid`);
  if (!["pending", "authorized", "rejected", "consumed", "consumption_failed", "expired"].includes(input.phase4_status)) errors.push("phase4_status_invalid");
  if (!["unused", "used", "indeterminate"].includes(input.replay_state)) errors.push("replay_state_invalid");
  if (!["not_consumed", "consumed", "failed", "indeterminate"].includes(input.consumption_state)) errors.push("consumption_state_invalid");
  return errors;
}

const allowPredicates = Object.freeze([
  ["authorization_state_authorized", (input) => input.phase4_status === "authorized"],
  ["authorization_currently_usable", (input) => input.authorization_currently_usable === true],
  ["authorization_not_expired", (input) => input.authorization_expired === false],
  ["artifact_not_expired", (input) => input.artifact_expired === false],
  ["operator_cardinality_exactly_one", (input) => input.operator_cardinality_exactly_one === true && input.operator_assignment_count === 1],
  ["approved_operator_still_valid", (input) => input.approved_operator_still_valid === true],
  ["request_identity_match", (input) => input.request_identity_match === true],
  ["execution_identity_match", (input) => input.execution_identity_match === true],
  ["manifest_digest_match", (input) => input.manifest_digest_match === true],
  ["artifact_binding_match", (input) => input.artifact_binding_match === true],
  ["runtime_binding_match", (input) => input.runtime_binding_match === true],
  ["dependency_binding_match", (input) => input.dependency_binding_match === true],
  ["target_effect_executor_match", (input) => input.target_effect_executor_match === true],
  ["replay_state_unused", (input) => input.replay_state === "unused"],
  ["consumption_state_not_consumed", (input) => input.consumption_state === "not_consumed"]
]);

export function evaluateGithubPagesOutwardPublicationV0(input) {
  const validationErrors = validateGithubPagesPalisadeInputV0(input);
  if (validationErrors.length > 0) {
    return {
      decision: "requires_evidence",
      allowed: false,
      reason_codes: ["mandatory_policy_input_invalid"],
      required_evidence: [...githubPagesPalisadeInputFields],
      missing_evidence: validationErrors,
      policy_input_sha256: input && typeof input === "object" ? digestObject(input) : null
    };
  }
  if (input.phase4_status === "pending") {
    return {
      decision: "requires_operator_review", allowed: false,
      reason_codes: ["phase4_operator_decision_pending"], required_evidence: ["phase4_terminal_operator_decision"],
      missing_evidence: ["operator_decision"], policy_input_sha256: digestObject(input)
    };
  }
  const failed = allowPredicates.filter(([, predicate]) => !predicate(input)).map(([name]) => name);
  if (failed.length > 0) {
    return {
      decision: "deny", allowed: false, reason_codes: failed,
      required_evidence: allowPredicates.map(([name]) => name), missing_evidence: [], policy_input_sha256: digestObject(input)
    };
  }
  return {
    decision: "allow", allowed: true, reason_codes: ["all_mandatory_policy_predicates_established"],
    required_evidence: allowPredicates.map(([name]) => name), missing_evidence: [], policy_input_sha256: digestObject(input)
  };
}

export function runtimeUnavailableGithubPagesDecisionV0(reasonCode = "authoritative_runtime_unavailable") {
  return {
    decision: "runtime_enforcement_unavailable", allowed: false, reason_codes: [reasonCode],
    required_evidence: ["authoritative_phase4_status", "palisade_persistence", "operator_cardinality"],
    missing_evidence: [reasonCode]
  };
}
