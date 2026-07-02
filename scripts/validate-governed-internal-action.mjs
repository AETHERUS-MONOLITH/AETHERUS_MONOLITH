#!/usr/bin/env node
import fs from "node:fs";

import {
  governedRuntimePathActionIdentifier,
  governedRuntimePathClaimId,
  invokeGovernedConduitAction,
  runtimeGovernancePathAssessmentAdapterId,
  runtimeGovernancePathAssessmentResultType
} from "../conduit/runtime/v0/index.mjs";
import { invokeGovernedConduitActionForTestOnly } from "../conduit/runtime/v0/conduit-governed-invocation.mjs";

const policyCasesPath = "palisade/policy-bundle.v0/tests/claim-capability-policy.cases.json";
const bindingManifestPath = "conduit/runtime/v0/conduit-binding-manifest.v0.json";
const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function caseInput(caseSet, id) {
  const found = caseSet.cases.find((testCase) => testCase.id === id);
  if (!found) throw new Error(`Missing policy case ${id}`);
  return found.input;
}

function context(suffix) {
  return {
    workspace_context: {
      workspace_id: `workspace-${suffix}`,
      status: "local_internal_only"
    },
    tenant_context: {
      tenant_id: `tenant-${suffix}`,
      status: "local_internal_only"
    }
  };
}

function makeEnvelope(input, suffix) {
  return {
    request_id: `governed-action-${suffix}`,
    trace_id: `trace-${suffix}`,
    correlation_id: `correlation-${suffix}`,
    contract_version: "1.0.0",
    policy_version: "0.1.0",
    ...clone(input),
    surface: "conduit_internal_runtime"
  };
}

function makeCompleteRuntimePathRequest(suffix = "allow") {
  const input = clone(caseInput(policyCases, "allow-production-workspace-complete-hypothetical-evidence"));
  input.surface = "policy-test-fixture";
  input.claim_id = governedRuntimePathClaimId;
  input.requested_action = governedRuntimePathActionIdentifier;
  input.evidence_state.required_evidence = ["runtime_governance_path"];
  input.evidence_state.evidence_notes = [
    "Hypothetical complete-evidence fixture only for governed runtime-path action tests."
  ];
  input.current_repository_state_basis = [
    "policy test fixture only; not current repository state"
  ];
  return makeEnvelope(input, suffix);
}

function makeRequiresEvidenceRequest(suffix = "requires-evidence") {
  const input = clone(caseInput(policyCases, "runtime-enforcement-unavailable-current-policy-bundle"));
  input.evidence_state.denied_claims = [];
  input.evidence_state.missing_evidence = ["user_workspace_input"];
  input.evidence_state.required_evidence = ["runtime_governance_path"];
  return makeEnvelope(input, suffix);
}

function makeRuntimeUnavailableRequest(suffix = "runtime-unavailable") {
  return makeEnvelope(caseInput(policyCases, "runtime-enforcement-unavailable-current-policy-bundle"), suffix);
}

function assertDownstreamZero(result, label) {
  assert(result.downstream?.attempted === false, `${label}: action must not be attempted`);
  assert(result.downstream?.invocation_count === 0, `${label}: invocation count must be zero`);
}

function assertDownstreamOnce(result, label) {
  assert(result.downstream?.attempted === true, `${label}: action must be attempted`);
  assert(result.downstream?.invocation_count === 1, `${label}: invocation count must be one`);
}

function assertAuditCandidate(result, label) {
  const audit = result.audit_event_candidate || {};
  assert(audit.durable_persistence === false, `${label}: audit candidate must not persist`);
  assert(audit.persistence_status === "not_persisted", `${label}: audit candidate persistence status mismatch`);
  assert(audit.action_identifier === result.requested_action, `${label}: audit action identifier mismatch`);
  if (result.downstream?.attempted) {
    assert(audit.adapter_identifier === runtimeGovernancePathAssessmentAdapterId, `${label}: audit adapter id mismatch`);
    assert(audit.action_attempt_status === "attempted", `${label}: audit action attempt mismatch`);
  }
}

function assertPermittedRuntimeAssessment(result, label) {
  assert(result.result_class === "permitted", `${label}: expected permitted`);
  assert(result.success === true, `${label}: expected success`);
  assert(result.allowed === true, `${label}: expected allowed`);
  assert(result.policy_decision?.decision === "allow", `${label}: expected Palisade allow`);
  assert(result.policy_decision.claim_id === governedRuntimePathClaimId, `${label}: decision claim mismatch`);
  assert(result.policy_decision.requested_action === governedRuntimePathActionIdentifier, `${label}: decision action mismatch`);
  assertDownstreamOnce(result, label);
  const actionResult = result.downstream.result || {};
  assert(actionResult.result_type === runtimeGovernancePathAssessmentResultType, `${label}: result type mismatch`);
  assert(actionResult.adapter_identifier === runtimeGovernancePathAssessmentAdapterId, `${label}: adapter id mismatch`);
  assert(actionResult.action_identifier === governedRuntimePathActionIdentifier, `${label}: action id mismatch`);
  assert(actionResult.claim_id === governedRuntimePathClaimId, `${label}: claim id mismatch`);
  assert(actionResult.request_id === result.request_id, `${label}: request id mismatch`);
  assert(actionResult.trace_id === result.trace_id, `${label}: trace id mismatch`);
  assert(actionResult.correlation_id === result.correlation_id, `${label}: correlation id mismatch`);
  assert(actionResult.sufficiency_status === "sufficient", `${label}: runtime path must be sufficient after allow`);
  assert(Array.isArray(actionResult.runtime_path_components), `${label}: components missing`);
  assert(actionResult.runtime_path_components.length === 8, `${label}: expected eight runtime path components`);
  assert(actionResult.unsatisfied_components.length === 0, `${label}: no unsatisfied components expected`);
  for (const boundary of [
    "durable_persistence",
    "public_execution",
    "deployment",
    "vault_nexus_execution",
    "model_execution",
    "operational_release_execution",
    "cross_invocation_replay_protection"
  ]) {
    assert(actionResult.boundaries?.[boundary] === false, `${label}: boundary ${boundary} must be false`);
  }
  assertAuditCandidate(result, label);
}

const policyCases = readJson(policyCasesPath);
const manifest = readJson(bindingManifestPath);

assert(manifest.selected_action_identifier === governedRuntimePathActionIdentifier, "manifest selected action mismatch");
assert(manifest.selected_palisade_claim_id === governedRuntimePathClaimId, "manifest selected claim mismatch");
assert(manifest.action_registry_created === false, "manifest must record no action registry");

const allowRequest = makeCompleteRuntimePathRequest("allow");
let ignoredCallerAdapterCount = 0;
const canonicalSuccess = await invokeGovernedConduitAction(allowRequest, context("allow"), async () => {
  ignoredCallerAdapterCount += 1;
  return { downstream_status: "completed", result_type: "caller_supplied" };
});
assertPermittedRuntimeAssessment(canonicalSuccess, "canonical governed runtime path action");
assert(ignoredCallerAdapterCount === 0, "caller-supplied third-argument adapter must be ignored by canonical invocation");
assert(canonicalSuccess.downstream.invocation_count === 1, "canonical action must execute exactly once");

for (const [label, request, expectedDecision] of [
  ["requires evidence", makeRequiresEvidenceRequest(), "requires_evidence"],
  ["runtime unavailable", makeRuntimeUnavailableRequest(), "runtime_enforcement_unavailable"],
  [
    "operator review",
    {
      ...makeCompleteRuntimePathRequest("operator-review"),
      operator_authorization_state: {
        status: "requested",
        review_required: true,
        review_reason: "test-only unresolved Operator review"
      }
    },
    "requires_operator_review"
  ]
]) {
  const result = await invokeGovernedConduitAction(request, context(label));
  assert(result.result_class === "policy_blocked", `${label}: expected policy_blocked`);
  assert(result.policy_decision?.decision === expectedDecision, `${label}: decision mismatch`);
  assertDownstreamZero(result, label);
  assertAuditCandidate(result, label);
}

for (const [label, requestFields] of [
  ["unknown action", { requested_action: "unknown_action" }],
  ["action mismatch", { requested_action: "evaluate_operator_review_need" }],
  ["claim mismatch", { claim_id: "production_workspace_claim" }],
  ["caller precomputed result", { precomputed_action_result: { ok: true } }],
  ["skip action", { skip_action: true }],
  ["adapter path", { adapter_path: "caller/module.mjs" }],
  ["policy bypass", { skip_policy: true }]
]) {
  const result = await invokeGovernedConduitAction(
    { ...allowRequest, request_id: `governed-action-${label.replaceAll(" ", "-")}`, ...requestFields },
    context(label)
  );
  assert(result.result_class === "palisade_boundary_failed", `${label}: expected fail-closed boundary failure`);
  assertDownstreamZero(result, label);
}

let throwCount = 0;
const throwResult = await invokeGovernedConduitActionForTestOnly(allowRequest, context("throw"), async () => {
  throwCount += 1;
  throw new Error("test-only adapter throw");
});
assert(throwResult.result_class === "downstream_failed", "adapter throw must be downstream_failed");
assert(throwResult.policy_decision?.decision === "allow", "adapter throw must preserve allowing decision");
assert(throwResult.downstream.failure_classification === "action_adapter_exception", "adapter throw classification mismatch");
assert(throwCount === 1, "adapter throw must not retry");
assertDownstreamOnce(throwResult, "adapter throw");
assertAuditCandidate(throwResult, "adapter throw");

let rejectCount = 0;
const rejectResult = await invokeGovernedConduitActionForTestOnly(allowRequest, context("reject"), async () => {
  rejectCount += 1;
  return Promise.reject(new Error("test-only adapter rejection"));
});
assert(rejectResult.result_class === "downstream_failed", "adapter rejection must be downstream_failed");
assert(rejectCount === 1, "adapter rejection must not retry");
assertDownstreamOnce(rejectResult, "adapter rejection");

let malformedCount = 0;
const malformedResult = await invokeGovernedConduitActionForTestOnly(allowRequest, context("malformed"), async () => {
  malformedCount += 1;
  return { downstream_status: "completed", result_type: "not_the_domain_result" };
});
assert(malformedResult.result_class === "downstream_failed", "malformed action output must be downstream_failed");
assert(malformedResult.downstream.failure_classification === "malformed_action_result", "malformed action classification mismatch");
assert(malformedCount === 1, "malformed action output must not retry");
assertDownstreamOnce(malformedResult, "malformed action output");

const invalidTransitionLikeResult = await invokeGovernedConduitActionForTestOnly(
  allowRequest,
  context("invalid-state-basis"),
  async (invocation) => ({
    downstream_status: "completed",
    adapter_identifier: runtimeGovernancePathAssessmentAdapterId,
    adapter_classification: "repository_owned_internal_domain_adapter",
    result_type: runtimeGovernancePathAssessmentResultType,
    action_identifier: governedRuntimePathActionIdentifier,
    claim_id: governedRuntimePathClaimId,
    requested_action: governedRuntimePathActionIdentifier,
    request_id: invocation.request.request_id,
    trace_id: invocation.request.trace_id,
    correlation_id: invocation.request.correlation_id,
    workspace_context: invocation.context.workspace_context,
    tenant_context: invocation.context.tenant_context,
    current_state_basis: ["wrong-state-basis"],
    runtime_path_components: [],
    satisfied_components: [],
    unsatisfied_components: ["user_workspace_input"],
    sufficiency_status: "insufficient",
    boundaries: {
      durable_persistence: false,
      public_execution: false,
      deployment: false,
      vault_nexus_execution: false,
      model_execution: false,
      operational_release_execution: false,
      cross_invocation_replay_protection: false
    }
  })
);
assert(invalidTransitionLikeResult.result_class === "downstream_failed", "invalid action result must fail downstream");
assert(
  invalidTransitionLikeResult.downstream.reasons.some((reason) => reason.includes("current state basis")),
  "invalid action result must report current-state basis mismatch"
);

const currentEvidenceResult = await invokeGovernedConduitAction(makeRequiresEvidenceRequest("current-evidence"), context("current"));
assert(currentEvidenceResult.result_class === "policy_blocked", "current evidence must not permit the selected action");
assert(currentEvidenceResult.policy_decision?.allowed === false, "current evidence allow reachability must not be established");
assertDownstreamZero(currentEvidenceResult, "current evidence");

const classifications = new Map((manifest.bypass_coverage || []).map((entry) => [entry.path, entry.classification]));
assert(classifications.get("conduit/runtime/v0/index.mjs#invokeGovernedConduitAction") === "canonical_governed", "canonical path classification mismatch");
for (const [coveredPath, classification] of classifications.entries()) {
  assert(
    [
      "canonical_governed",
      "routed_to_canonical",
      "inactive",
      "deprecated",
      "test_only",
      "non_governed",
      "out_of_scope"
    ].includes(classification),
    `${coveredPath}: invalid bypass classification ${classification}`
  );
}
const activeBypasses = [...classifications.entries()].filter(
  ([, classification]) =>
    ![
      "canonical_governed",
      "routed_to_canonical",
      "non_governed",
      "out_of_scope",
      "test_only",
      "inactive",
      "deprecated"
    ].includes(classification)
);
assert(activeBypasses.length === 0, `active bypasses remain: ${JSON.stringify(activeBypasses)}`);

if (failures.length > 0) {
  console.error("Governed internal action validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Governed internal action ok");
console.log(`Validated ${governedRuntimePathClaimId} / ${governedRuntimePathActionIdentifier} through canonical Conduit`);
