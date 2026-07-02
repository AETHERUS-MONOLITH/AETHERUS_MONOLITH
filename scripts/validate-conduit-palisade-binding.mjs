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

const casesPath = "conduit/runtime/v0/tests/conduit-palisade-binding.cases.json";
const manifestPath = "conduit/runtime/v0/conduit-binding-manifest.v0.json";
const policyCasesPath = "palisade/policy-bundle.v0/tests/claim-capability-policy.cases.json";
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function caseById(caseSet, id) {
  const found = caseSet.cases.find((testCase) => testCase.id === id);
  if (!found) throw new Error(`Missing policy case ${id}`);
  return found.input;
}

function makeRequest(input, suffix) {
  return {
    request_id: `conduit-${suffix}`,
    trace_id: `trace-${suffix}`,
    correlation_id: `correlation-${suffix}`,
    contract_version: "1.0.0",
    policy_version: "0.1.0",
    ...clone(input),
    surface: "conduit_internal_runtime"
  };
}

function makeCompleteRuntimePathRequest(policyCases, suffix) {
  const input = clone(caseById(policyCases, "allow-production-workspace-complete-hypothetical-evidence"));
  input.claim_id = governedRuntimePathClaimId;
  input.requested_action = governedRuntimePathActionIdentifier;
  input.evidence_state.required_evidence = ["runtime_governance_path"];
  input.evidence_state.evidence_notes = ["Hypothetical complete-evidence fixture only."];
  input.current_repository_state_basis = ["policy test fixture only; not current repository state"];
  return makeRequest(input, suffix);
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
  if (expectedClass === "policy_blocked") {
    assert(result.policy_decision, `${label}: policy_blocked must preserve policy decision`);
    assert(result.palisade_boundary_failure === null, `${label}: policy_blocked must not be boundary failure`);
  }
  if (expectedClass === "palisade_boundary_failed") {
    assert(result.palisade_boundary_failure, `${label}: boundary failure must be preserved`);
    assert(!result.policy_decision, `${label}: boundary failure must not manufacture policy decision`);
  }
}

const bindingText = fs.readFileSync(bindingPath, "utf8");
const indexText = fs.readFileSync(indexPath, "utf8");
const manifest = readJson(manifestPath);
const cases = readJson(casesPath);
const policyCases = readJson(policyCasesPath);

assert(typeof invokeGovernedConduitAction === "function", "canonical internal import must resolve invokeGovernedConduitAction");
assert(canonicalConduitEntryPoint === "conduit/runtime/v0/index.mjs#invokeGovernedConduitAction", "canonical entry point metadata mismatch");
assert(palisadeDecisionBoundaryImportPath === "palisade/runtime/v0/palisade-decision-boundary.mjs", "Palisade boundary metadata mismatch");
assert(indexText.includes('from "./conduit-governed-invocation.mjs"'), "index must route to governed invocation implementation");
assert(bindingText.includes('from "../../../palisade/runtime/v0/palisade-decision-boundary.mjs"'), "binding must directly import Palisade boundary");
assert(bindingText.includes("evaluatePalisadeDecision(palisadeRequest)"), "binding must directly invoke evaluatePalisadeDecision");
assert(bindingText.includes("performRuntimeGovernancePathAssessment"), "binding must import the repository-owned action adapter");
assert(!indexText.includes("invokeGovernedConduitActionForTestOnly"), "canonical index must not export test-only adapter injection");
assert(!indexText.includes("boundedLocalConduitContinuation"), "canonical index must not export the retired acknowledgement adapter");
assert(!bindingText.includes("palisade-policy-consumption"), "binding must not import validator consumption wrapper");
assert(!bindingText.includes("evaluatePolicyDecision"), "binding must not use duplicate policy evaluator");
assert(!bindingText.includes("repoRoot:"), "binding must not expose a caller-supplied repoRoot policy source");

assert(manifest.canonical_internal_export === "conduit/runtime/v0/index.mjs#invokeGovernedConduitAction", "manifest canonical export mismatch");
assert(manifest.selected_action_identifier === governedRuntimePathActionIdentifier, "manifest selected action mismatch");
assert(manifest.selected_palisade_claim_id === governedRuntimePathClaimId, "manifest selected claim mismatch");
assert(manifest.downstream_adapter_path.includes(runtimeGovernancePathAssessmentAdapterPath), "manifest adapter path mismatch");
assert(manifest.direct_palisade_invocation === true, "manifest must record direct Palisade invocation");
assert(manifest.palisade_evaluator_injectable === false, "manifest must record non-injectable evaluator");
assert(manifest.duplicate_policy_evaluator === false, "manifest must record no duplicate evaluator");
assert(manifest.action_registry_created === false, "manifest must record direct fixed binding");
assert(manifest.internal_executable_gate_status === "implemented", "manifest must record implemented internal gate");
assert(manifest.substantive_governed_internal_action_adapter_status.includes("implemented"), "manifest must record substantive adapter implementation");
assert(manifest.deployed_enforcement_status === "not_implemented", "manifest must not claim deployment");
assert(manifest.public_enforcement_status === "not_implemented", "manifest must not claim public enforcement");
assert(manifest.production_enforcement_status === "not_implemented", "manifest must not claim production enforcement");
assert(manifest.audit_persistence_status === "not_implemented", "manifest must not claim audit persistence");
assert(manifest.cross_invocation_replay_protection_status === "not_implemented", "manifest must not claim replay protection");

for (const requiredCase of [
  "selected_runtime_path_action_identity_validated",
  "allow_attempts_governed_action_once",
  "requires_evidence_blocks_action",
  "operator_review_blocks_action",
  "runtime_enforcement_unavailable_blocks_action",
  "caller_adapter_cannot_substitute_action",
  "same_invocation_request_decision_action_binding_enforced",
  "state_basis_mismatch_fails_closed",
  "no_active_governed_bypass_remains"
]) {
  assert(cases.covered_cases.includes(requiredCase), `${casesPath}: missing coverage claim ${requiredCase}`);
}

const allowRequest = makeCompleteRuntimePathRequest(policyCases, "allow");
const allowSuccess = await invokeGovernedConduitAction(allowRequest, context("allow"));
assertDistinctResult(allowSuccess, "permitted", "allow success");
assert(allowSuccess.policy_evaluation.attempted === true, "allow success must attempt Palisade evaluation");
assert(allowSuccess.policy_decision?.decision === "allow", "allow success must preserve Palisade allow");
assert(allowSuccess.policy_decision.claim_id === governedRuntimePathClaimId, "allow success claim mismatch");
assert(allowSuccess.policy_decision.requested_action === governedRuntimePathActionIdentifier, "allow success action mismatch");
assertDownstreamOnce(allowSuccess, "allow success");
assert(allowSuccess.downstream.adapter_identifier === runtimeGovernancePathAssessmentAdapterId, "allow success adapter id mismatch");
assert(allowSuccess.downstream.result?.result_type === runtimeGovernancePathAssessmentResultType, "allow success result type mismatch");
assert(allowSuccess.downstream.result?.sufficiency_status === "sufficient", "allow success domain assessment mismatch");
assert(allowSuccess.audit_event_candidate?.durable_persistence === false, "allow success audit candidate must not persist");
assert(allowSuccess.audit_event_candidate?.bounded_result_type === runtimeGovernancePathAssessmentResultType, "audit candidate bounded result type mismatch");

const requiresEvidenceInput = clone(caseById(policyCases, "runtime-enforcement-unavailable-current-policy-bundle"));
requiresEvidenceInput.evidence_state.denied_claims = [];
requiresEvidenceInput.evidence_state.missing_evidence = ["user_workspace_input"];
const requiresEvidence = await invokeGovernedConduitAction(makeRequest(requiresEvidenceInput, "requires-evidence"), context("requires-evidence"));
assertDistinctResult(requiresEvidence, "policy_blocked", "requires evidence");
assert(requiresEvidence.policy_decision?.decision === "requires_evidence", "requires evidence decision mismatch");
assertDownstreamZero(requiresEvidence, "requires evidence");

const runtimeUnavailable = await invokeGovernedConduitAction(
  makeRequest(caseById(policyCases, "runtime-enforcement-unavailable-current-policy-bundle"), "runtime-unavailable"),
  context("runtime-unavailable")
);
assertDistinctResult(runtimeUnavailable, "policy_blocked", "runtime unavailable");
assert(runtimeUnavailable.policy_decision?.decision === "runtime_enforcement_unavailable", "runtime unavailable decision mismatch");
assertDownstreamZero(runtimeUnavailable, "runtime unavailable");

const unrelatedClaimAllow = makeRequest(caseById(policyCases, "allow-production-workspace-complete-hypothetical-evidence"), "unrelated-claim");
const unrelatedResult = await invokeGovernedConduitAction(unrelatedClaimAllow, context("unrelated-claim"));
assertDistinctResult(unrelatedResult, "palisade_boundary_failed", "unrelated claim");
assertDownstreamZero(unrelatedResult, "unrelated claim");

let callerAdapterCount = 0;
const callerAdapterIgnored = await invokeGovernedConduitAction(allowRequest, context("caller-adapter"), async () => {
  callerAdapterCount += 1;
  return { downstream_status: "completed", result_type: "caller_controlled" };
});
assertDistinctResult(callerAdapterIgnored, "permitted", "caller adapter ignored");
assert(callerAdapterCount === 0, "caller-supplied adapter must be ignored");
assert(callerAdapterIgnored.downstream.result?.adapter_identifier === runtimeGovernancePathAssessmentAdapterId, "canonical adapter must still run");

for (const [label, requestFields, contextFields = {}] of [
  ["caller supplied allowed true", { allowed: true }],
  ["caller supplied decision", { decision: "allow" }],
  ["caller supplied evaluator", {}, { evaluator: () => ({ decision: "allow", allowed: true }) }],
  ["skip policy", { skip_policy: true }],
  ["fail open", { fail_open: true }],
  ["precomputed action result", { precomputed_action_result: { downstream_status: "completed" } }],
  ["skip action", { skip_action: true }]
]) {
  const result = await invokeGovernedConduitAction(
    { ...allowRequest, request_id: `conduit-${label.replaceAll(" ", "-")}`, ...requestFields },
    { ...context(label), ...contextFields }
  );
  assertDistinctResult(result, "palisade_boundary_failed", label);
  assertDownstreamZero(result, label);
}

const deterministicRequest = makeRequest(requiresEvidenceInput, "deterministic");
const deterministicA = await invokeGovernedConduitAction(deterministicRequest, context("deterministic"));
const deterministicB = await invokeGovernedConduitAction(deterministicRequest, context("deterministic"));
assert(JSON.stringify(deterministicA) === JSON.stringify(deterministicB), "identical blocked inputs must produce deterministic results");

const classifications = new Map((manifest.bypass_coverage || []).map((entry) => [entry.path, entry.classification]));
assert(classifications.get("conduit/runtime/v0/index.mjs#invokeGovernedConduitAction") === "canonical_governed", "canonical path must be classified canonical_governed");
assert(
  classifications.get("conduit/runtime/v0/actions/runtime-governance-path-assessment.mjs#performRuntimeGovernancePathAssessment") ===
    "routed_to_canonical",
  "adapter path must be classified routed_to_canonical"
);
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
  console.error("Conduit Palisade binding validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Conduit Palisade binding ok");
console.log(`Validated ${cases.covered_cases.length} canonical binding coverage claims through ${canonicalConduitEntryPoint}`);
