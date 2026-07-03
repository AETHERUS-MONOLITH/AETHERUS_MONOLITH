#!/usr/bin/env node
import fs from "node:fs";

import {
  canonicalConduitEntryPoint,
  governedRuntimePathActionIdentifier,
  governedRuntimePathClaimId,
  governedConduitResultClasses,
  invokeGovernedConduitAction,
  palisadeDecisionBoundaryImportPath,
  runtimeGovernancePathAssessmentAdapterId,
  runtimeGovernancePathAssessmentAdapterPath,
  runtimeGovernancePathAssessmentResultType
} from "../conduit/runtime/v0/index.mjs";
import { invokeGovernedConduitActionForTestOnly } from "../conduit/runtime/v0/conduit-governed-invocation.mjs";
import {
  canonicalSurface,
  makeTestOnlyCompleteEvidenceSnapshot,
  resolveCanonicalPalisadeRuntime
} from "../palisade/runtime/v0/palisade-current-state-evidence.mjs";

const manifestPath = "conduit/runtime/v0/conduit-binding-manifest.v0.json";
const bindingPath = "conduit/runtime/v0/conduit-governed-invocation.mjs";
const indexPath = "conduit/runtime/v0/index.mjs";
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

function canonicalRequest(suffix = "current") {
  return {
    request_id: `conduit-${suffix}`,
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

function assertDownstreamZero(result, label) {
  assert(result.downstream?.attempted === false, `${label}: action must not be attempted`);
  assert(result.downstream?.invocation_count === 0, `${label}: action invocation count must be zero`);
}

function assertDownstreamOnce(result, label) {
  assert(result.downstream?.attempted === true, `${label}: action must be attempted`);
  assert(result.downstream?.invocation_count === 1, `${label}: action invocation count must be one`);
}

function assertDistinctResult(result, expectedClass, label) {
  assert(governedConduitResultClasses.has(result.result_class), `${label}: result class must be known`);
  assert(result.result_class === expectedClass, `${label}: expected ${expectedClass}, got ${result.result_class}`);
  if (expectedClass !== "permitted") {
    assert(result.success === false, `${label}: non-permitted result must not be success`);
    assert(result.allowed === false, `${label}: non-permitted result must not be allowed`);
  }
}

const bindingText = fs.readFileSync(bindingPath, "utf8");
const indexText = fs.readFileSync(indexPath, "utf8");
const manifest = readJson(manifestPath);

assert(typeof invokeGovernedConduitAction === "function", "canonical internal import must resolve invokeGovernedConduitAction");
assert(canonicalConduitEntryPoint === "conduit/runtime/v0/index.mjs#invokeGovernedConduitAction", "canonical entry point metadata mismatch");
assert(palisadeDecisionBoundaryImportPath === "palisade/runtime/v0/palisade-decision-boundary.mjs", "Palisade boundary metadata mismatch");
assert(indexText.includes('from "./conduit-governed-invocation.mjs"'), "index must route to governed invocation implementation");
assert(bindingText.includes("evaluatePalisadeCurrentStateDecision"), "binding must invoke evidence-bound Palisade boundary");
assert(bindingText.includes("resolveCanonicalPalisadeRuntime"), "binding must resolve Palisade acquisition plan");
assert(bindingText.includes("acquireConduitCurrentStateEvidence"), "binding must execute fixed Conduit acquisition");
assert(!indexText.includes("invokeGovernedConduitActionForTestOnly"), "canonical index must not export test-only harness");
assert(!indexText.includes("performRuntimeGovernancePathAssessment"), "canonical index must not export direct action adapter");
assert(!bindingText.includes("evaluatePalisadeDecision(palisadeRequest)"), "binding must not evaluate caller-built Palisade request");
assert(!bindingText.includes("repoRoot:"), "binding must not expose caller-supplied repoRoot");

assert(manifest.canonical_internal_export === "conduit/runtime/v0/index.mjs#invokeGovernedConduitAction", "manifest canonical export mismatch");
assert(manifest.selected_action_identifier === governedRuntimePathActionIdentifier, "manifest selected action mismatch");
assert(manifest.selected_palisade_claim_id === governedRuntimePathClaimId, "manifest selected claim mismatch");
assert(manifest.canonical_surface === canonicalSurface, "manifest surface mismatch");
assert(manifest.canonical_caller_policy_state_fields_accepted === false, "manifest must reject caller policy-state fields");
assert(manifest.current_state_evidence_binding?.status === "implemented", "manifest must record evidence binding");
assert(manifest.current_state_evidence_binding?.evidence_contract_self_certifies_sufficiency === false, "manifest must reject self-certification");
assert(manifest.palisade_evaluator_injectable === false, "manifest must record non-injectable evaluator");
assert(manifest.action_registry_created === false, "manifest must record direct fixed binding");
assert(manifest.trusted_production_operator_authorizer_status === "not_implemented", "manifest must not claim production authorizer");

const request = canonicalRequest("current");
const current = await invokeGovernedConduitAction(request);
assertDistinctResult(current, "policy_blocked", "current evidence");
assert(["requires_evidence", "runtime_enforcement_unavailable", "deny", "requires_operator_review"].includes(current.policy_decision?.decision), "current evidence decision must be non-allowing");
assert(current.policy_decision?.allowed === false, "current evidence decision must not allow");
assert(current.policy_decision?.evidence_contract_sha256, "current evidence decision must carry contract hash");
assert(current.current_state_basis.length > 0, "current evidence must include internal basis");
assertDownstreamZero(current, "current evidence");
assert(current.audit_event_candidate?.durable_persistence === false, "audit candidate must not persist");

for (const [label, patch, context = undefined] of [
  ["caller supplied evidence_state", { evidence_state: {} }],
  ["caller supplied runtime state", { runtime_governance_path_state: {} }],
  ["caller supplied basis", { current_repository_state_basis: ["caller"] }],
  ["caller supplied authorization", { operator_authorization_state: { status: "approved" } }],
  ["caller supplied allowed true", { allowed: true }],
  ["caller supplied decision", { decision: "allow" }],
  ["skip policy", { skip_policy: true }],
  ["fail open", { fail_open: true }],
  ["precomputed action result", { precomputed_action_result: { downstream_status: "completed" } }],
  ["skip action", { skip_action: true }],
  ["caller selected old policy", { policy_version: "0.0.1" }],
  ["caller selected future policy", { policy_version: "9.9.9" }],
  ["surface mismatch", { surface: "policy-test-fixture" }],
  ["claim mismatch", { claim_id: "production_workspace_claim" }],
  ["action mismatch", { requested_action: "claim_public_capability" }],
  ["non-empty context", {}, { tenant_context: { tenant_id: "caller" } }]
]) {
  const result = await invokeGovernedConduitAction(
    { ...request, request_id: `conduit-${label.replaceAll(" ", "-")}`, ...patch },
    context
  );
  assertDistinctResult(result, "palisade_boundary_failed", label);
  assertDownstreamZero(result, label);
}

let callerAdapterCount = 0;
const callerAdapterIgnored = await invokeGovernedConduitAction(request, {}, async () => {
  callerAdapterCount += 1;
  return { downstream_status: "completed", result_type: "caller_controlled" };
});
assertDistinctResult(callerAdapterIgnored, "policy_blocked", "caller adapter ignored");
assert(callerAdapterCount === 0, "caller-supplied adapter must be ignored by canonical invocation");
assertDownstreamZero(callerAdapterIgnored, "caller adapter ignored");

const completeRequest = canonicalRequest("allow");
const { plan } = resolveCanonicalPalisadeRuntime({ envelope: completeRequest });
const completeSnapshot = makeTestOnlyCompleteEvidenceSnapshot({ acquisitionPlan: plan });
const allowSuccess = await invokeGovernedConduitActionForTestOnly(completeRequest, {}, {
  testOnlyEvidenceSnapshot: completeSnapshot,
  testOnlyCompleteEvidence: true,
  authorizationWitness: testWitness(completeRequest)
});
assertDistinctResult(allowSuccess, "permitted", "test-only allow success");
assert(allowSuccess.policy_evaluation.attempted === true, "allow success must attempt Palisade evaluation");
assert(allowSuccess.policy_decision?.decision === "allow", "allow success must preserve Palisade allow");
assertDownstreamOnce(allowSuccess, "test-only allow success");
assert(allowSuccess.downstream.adapter_identifier === runtimeGovernancePathAssessmentAdapterId, "allow success adapter id mismatch");
assert(allowSuccess.downstream.result?.result_type === runtimeGovernancePathAssessmentResultType, "allow success result type mismatch");
assert(allowSuccess.downstream.result?.sufficiency_status === "sufficient", "allow success domain assessment mismatch");

let throwCount = 0;
const throwResult = await invokeGovernedConduitActionForTestOnly(completeRequest, {}, {
  testOnlyEvidenceSnapshot: completeSnapshot,
  testOnlyCompleteEvidence: true,
  authorizationWitness: testWitness(completeRequest),
  actionAdapter: async () => {
    throwCount += 1;
    throw new Error("test-only adapter throw");
  }
});
assertDistinctResult(throwResult, "downstream_failed", "test-only adapter throw");
assert(throwResult.downstream.failure_classification === "action_adapter_exception", "adapter throw classification mismatch");
assert(throwCount === 1, "adapter throw must not retry");
assertDownstreamOnce(throwResult, "adapter throw");

const deterministicA = await invokeGovernedConduitAction(request);
const deterministicB = await invokeGovernedConduitAction(request);
assert(JSON.stringify(deterministicA) === JSON.stringify(deterministicB), "identical canonical inputs must produce deterministic results");

const classifications = new Map((manifest.bypass_coverage || []).map((entry) => [entry.path, entry.classification]));
assert(classifications.get("conduit/runtime/v0/index.mjs#invokeGovernedConduitAction") === "canonical_governed", "canonical path must be classified canonical_governed");
assert(
  classifications.get("conduit/runtime/v0/actions/runtime-governance-path-assessment.mjs#performRuntimeGovernancePathAssessment") ===
    "routed_to_canonical",
  "adapter path must be classified routed_to_canonical"
);
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
  console.error("Conduit Palisade binding validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Conduit Palisade binding ok");
console.log(`Validated ${governedRuntimePathClaimId} / ${governedRuntimePathActionIdentifier} through evidence-bound canonical Conduit`);
