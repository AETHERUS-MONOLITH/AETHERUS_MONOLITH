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
import {
  canonicalSurface,
  makeTestOnlyCompleteEvidenceSnapshot,
  resolveCanonicalPalisadeRuntime
} from "../palisade/runtime/v0/palisade-current-state-evidence.mjs";

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

function envelope(suffix = "current") {
  return {
    request_id: `governed-action-${suffix}`,
    trace_id: `trace-${suffix}`,
    correlation_id: `correlation-${suffix}`,
    contract_version: "1.0.0",
    policy_version: "0.1.0",
    surface: canonicalSurface,
    claim_id: governedRuntimePathClaimId,
    requested_action: governedRuntimePathActionIdentifier
  };
}

function testWitness(request) {
  return {
    witness_version: "test-only.v0",
    request_id: request.request_id,
    trace_id: request.trace_id,
    correlation_id: request.correlation_id,
    surface: request.surface,
    claim_id: request.claim_id,
    requested_action: request.requested_action,
    authorization_status: "approved",
    authorization_scope: "test_only_runtime_governance_path_sufficiency",
    provenance: "explicit_test_only_harness"
  };
}

function testOnlyAllowOptions(request) {
  const { plan } = resolveCanonicalPalisadeRuntime({ envelope: request });
  return {
    testOnlyEvidenceSnapshot: makeTestOnlyCompleteEvidenceSnapshot({ acquisitionPlan: plan }),
    testOnlyCompleteEvidence: true,
    authorizationWitness: testWitness(request)
  };
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

const manifest = readJson(bindingManifestPath);

assert(manifest.selected_action_identifier === governedRuntimePathActionIdentifier, "manifest selected action mismatch");
assert(manifest.selected_palisade_claim_id === governedRuntimePathClaimId, "manifest selected claim mismatch");
assert(manifest.action_registry_created === false, "manifest must record no action registry");
assert(manifest.current_state_evidence_binding?.status === "implemented", "manifest must record evidence binding");

const current = await invokeGovernedConduitAction(envelope("current"));
assert(current.result_class === "policy_blocked", "canonical current evidence must be policy_blocked");
assert(current.policy_decision?.allowed === false, "current evidence allow reachability must not be established");
assert(current.current_state_basis.length > 0, "current basis must be internally generated");
assertDownstreamZero(current, "canonical current evidence");
assertAuditCandidate(current, "canonical current evidence");

const allowRequest = envelope("allow");
let ignoredCallerAdapterCount = 0;
const canonicalBlocked = await invokeGovernedConduitAction(allowRequest, {}, async () => {
  ignoredCallerAdapterCount += 1;
  return { downstream_status: "completed", result_type: "caller_supplied" };
});
assert(canonicalBlocked.result_class === "policy_blocked", "third canonical argument must not select adapter or fixture");
assert(ignoredCallerAdapterCount === 0, "caller-supplied third-argument adapter must be ignored by canonical invocation");
assertDownstreamZero(canonicalBlocked, "canonical blocked with caller adapter");

const canonicalSuccess = await invokeGovernedConduitActionForTestOnly(allowRequest, {}, testOnlyAllowOptions(allowRequest));
assertPermittedRuntimeAssessment(canonicalSuccess, "test-only governed runtime path action");
assert(canonicalSuccess.downstream.invocation_count === 1, "test-only action must execute exactly once");

for (const [label, requestFields] of [
  ["unknown action", { requested_action: "unknown_action" }],
  ["action mismatch", { requested_action: "evaluate_operator_review_need" }],
  ["claim mismatch", { claim_id: "production_workspace_claim" }],
  ["caller authorization", { operator_authorization_state: { status: "approved" } }],
  ["caller evidence", { evidence_state: { current_evidence: [] } }],
  ["caller precomputed result", { precomputed_action_result: { ok: true } }],
  ["skip action", { skip_action: true }],
  ["adapter path", { adapter_path: "caller/module.mjs" }],
  ["policy bypass", { skip_policy: true }],
  ["fixture selector", { complete_evidence_fixture: true }]
]) {
  const result = await invokeGovernedConduitAction({
    ...allowRequest,
    request_id: `governed-action-${label.replaceAll(" ", "-")}`,
    ...requestFields
  });
  assert(result.result_class === "palisade_boundary_failed", `${label}: expected fail-closed boundary failure`);
  assertDownstreamZero(result, label);
}

let throwCount = 0;
const throwResult = await invokeGovernedConduitActionForTestOnly(allowRequest, {}, {
  ...testOnlyAllowOptions(allowRequest),
  actionAdapter: async () => {
    throwCount += 1;
    throw new Error("test-only adapter throw");
  }
});
assert(throwResult.result_class === "downstream_failed", "adapter throw must be downstream_failed");
assert(throwResult.policy_decision?.decision === "allow", "adapter throw must preserve allowing decision");
assert(throwResult.downstream.failure_classification === "action_adapter_exception", "adapter throw classification mismatch");
assert(throwCount === 1, "adapter throw must not retry");
assertDownstreamOnce(throwResult, "adapter throw");
assertAuditCandidate(throwResult, "adapter throw");

let malformedCount = 0;
const malformedResult = await invokeGovernedConduitActionForTestOnly(allowRequest, {}, {
  ...testOnlyAllowOptions(allowRequest),
  actionAdapter: async () => {
    malformedCount += 1;
    return { downstream_status: "completed", result_type: "not_the_domain_result" };
  }
});
assert(malformedResult.result_class === "downstream_failed", "malformed action output must be downstream_failed");
assert(malformedResult.downstream.failure_classification === "malformed_action_result", "malformed action classification mismatch");
assert(malformedCount === 1, "malformed action output must not retry");
assertDownstreamOnce(malformedResult, "malformed action output");

const invalidTransitionLikeResult = await invokeGovernedConduitActionForTestOnly(allowRequest, {}, {
  ...testOnlyAllowOptions(allowRequest),
  actionAdapter: async (invocation) => ({
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
    workspace_context: null,
    tenant_context: null,
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
});
assert(invalidTransitionLikeResult.result_class === "downstream_failed", "invalid action result must fail downstream");
assert(
  invalidTransitionLikeResult.downstream.reasons.some((reason) => reason.includes("current state basis")),
  "invalid action result must report current-state basis mismatch"
);

const badWitness = testWitness(allowRequest);
badWitness.claim_id = "wrong_claim";
const badWitnessResult = await invokeGovernedConduitActionForTestOnly(allowRequest, {}, {
  ...testOnlyAllowOptions(allowRequest),
  authorizationWitness: badWitness
});
assert(badWitnessResult.result_class === "palisade_boundary_failed", "invalid witness must fail closed");
assertDownstreamZero(badWitnessResult, "invalid witness");

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
console.log(`Validated ${governedRuntimePathClaimId} / ${governedRuntimePathActionIdentifier} through evidence-bound canonical Conduit`);
