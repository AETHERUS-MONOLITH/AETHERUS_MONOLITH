#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  boundedLocalConduitContinuation,
  canonicalConduitEntryPoint,
  governedConduitResultClasses,
  invokeGovernedConduitAction,
  palisadeDecisionBoundaryImportPath
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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
  assert(result.downstream?.attempted === false, `${label}: downstream must not be attempted`);
  assert(result.downstream?.invocation_count === 0, `${label}: downstream invocation count must be zero`);
}

function assertDownstreamOnce(result, label) {
  assert(result.downstream?.attempted === true, `${label}: downstream must be attempted`);
  assert(result.downstream?.invocation_count === 1, `${label}: downstream invocation count must be one`);
}

function assertAuditCandidate(result, label) {
  assert(result.audit_event_candidate, `${label}: audit event candidate must be present`);
  assert(result.audit_event_candidate.durable_persistence === false, `${label}: audit candidate must not claim persistence`);
  assert(result.audit_event_candidate.persistence_status === "not_persisted", `${label}: audit candidate must remain not persisted`);
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
  if (expectedClass === "downstream_failed") {
    assert(result.policy_decision?.decision === "allow", `${label}: downstream failure must preserve allowing decision`);
    assert(result.palisade_boundary_failure === null, `${label}: downstream failure must not be boundary failure`);
  }
}

function makeTempRepoRoot(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `conduit-palisade-${label}-`));
  fs.cpSync("palisade", path.join(root, "palisade"), { recursive: true });
  fs.cpSync("data", path.join(root, "data"), { recursive: true });
  return root;
}

async function withCwd(root, callback) {
  const previous = process.cwd();
  process.chdir(root);
  try {
    return await callback();
  } finally {
    process.chdir(previous);
  }
}

const bindingText = fs.readFileSync(bindingPath, "utf8");
const indexText = fs.readFileSync(indexPath, "utf8");
const manifest = readJson(manifestPath);
const cases = readJson(casesPath);
const policyCases = readJson(policyCasesPath);

assert(typeof invokeGovernedConduitAction === "function", "canonical internal import must resolve invokeGovernedConduitAction");
assert(typeof boundedLocalConduitContinuation === "function", "canonical internal import must expose bounded local continuation");
assert(canonicalConduitEntryPoint === "conduit/runtime/v0/index.mjs#invokeGovernedConduitAction", "canonical entry point metadata mismatch");
assert(palisadeDecisionBoundaryImportPath === "palisade/runtime/v0/palisade-decision-boundary.mjs", "Palisade boundary metadata mismatch");
assert(indexText.includes('from "./conduit-governed-invocation.mjs"'), "index must route to governed invocation implementation");
assert(bindingText.includes('from "../../../palisade/runtime/v0/palisade-decision-boundary.mjs"'), "binding must directly import Palisade boundary");
assert(bindingText.includes("evaluatePalisadeDecision(palisadeRequest)"), "binding must directly invoke evaluatePalisadeDecision");
assert(!bindingText.includes("palisade-policy-consumption"), "binding must not import validator consumption wrapper");
assert(!bindingText.includes("evaluatePolicyDecision"), "binding must not use duplicate policy evaluator");
assert(!bindingText.includes("repoRoot:"), "binding must not expose a caller-supplied repoRoot policy source");
assert(!bindingText.includes("disableValidation"), "binding must not expose validation bypass");

assert(manifest.canonical_internal_export === "conduit/runtime/v0/index.mjs#invokeGovernedConduitAction", "manifest canonical export mismatch");
assert(manifest.direct_palisade_invocation === true, "manifest must record direct Palisade invocation");
assert(manifest.palisade_evaluator_injectable === false, "manifest must record non-injectable evaluator");
assert(manifest.duplicate_policy_evaluator === false, "manifest must record no duplicate evaluator");
assert(manifest.internal_executable_gate_status === "implemented", "manifest must record implemented internal gate");
assert(manifest.deployed_enforcement_status === "not_implemented", "manifest must not claim deployment");
assert(manifest.public_enforcement_status === "not_implemented", "manifest must not claim public enforcement");
assert(manifest.production_enforcement_status === "not_implemented", "manifest must not claim production enforcement");
assert(manifest.audit_persistence_status === "not_implemented", "manifest must not claim audit persistence");

for (const requiredCase of [
  "canonical_internal_import_resolves",
  "allow_attempts_downstream_once",
  "deny_blocks_downstream",
  "requires_evidence_blocks_downstream",
  "operator_review_blocks_downstream",
  "runtime_enforcement_unavailable_blocks_downstream",
  "downstream_throw_classified",
  "downstream_reject_classified",
  "malformed_downstream_result_classified",
  "no_active_governed_bypass_remains"
]) {
  assert(cases.covered_cases.includes(requiredCase), `${casesPath}: missing coverage claim ${requiredCase}`);
}

const denyRequest = makeRequest(caseById(policyCases, "deny-production-workspace-provider-login-only"), "deny");
const requiresEvidenceRequest = makeRequest(
  caseById(policyCases, "requires-evidence-staged-surface-advancement-partial-evidence"),
  "requires-evidence"
);
const operatorReviewRequest = makeRequest(
  caseById(policyCases, "requires-operator-review-structural-threshold-transition"),
  "operator-review"
);
const runtimeUnavailableRequest = makeRequest(
  caseById(policyCases, "runtime-enforcement-unavailable-current-policy-bundle"),
  "runtime-unavailable"
);
const allowRequest = makeRequest(
  caseById(policyCases, "allow-production-workspace-complete-hypothetical-evidence"),
  "allow"
);

let downstreamCount = 0;
const executionOrder = [];
const allowSuccess = await invokeGovernedConduitAction(allowRequest, context("allow"), async (invocation) => {
  downstreamCount += 1;
  executionOrder.push("downstream");
  assert(invocation.policy_decision?.decision === "allow", "downstream must receive allowing policy decision");
  assert(invocation.audit_event_candidate?.durable_persistence === false, "downstream audit candidate must not be persisted");
  return {
    downstream_status: "completed",
    observed_policy_decision: invocation.policy_decision.decision,
    observed_trace_id: invocation.request.trace_id
  };
});
assertDistinctResult(allowSuccess, "permitted", "allow success");
assert(allowSuccess.policy_evaluation.attempted === true, "allow success must attempt Palisade evaluation");
assert(allowSuccess.policy_decision?.decision === "allow", "allow success must preserve Palisade allow");
assert(allowSuccess.policy_decision.allowed === true, "allow success must preserve allowed true");
assertDownstreamOnce(allowSuccess, "allow success");
assert(downstreamCount === 1, "allow success must invoke downstream exactly once");
assert(executionOrder.join(",") === "downstream", "downstream must only run after allowing decision is available");
assert(allowSuccess.trace_id === allowRequest.trace_id, "trace ID must propagate");
assert(allowSuccess.correlation_id === allowRequest.correlation_id, "correlation ID must propagate");
assert(allowSuccess.workspace_context?.workspace_id === "workspace-allow", "workspace context must propagate");
assert(allowSuccess.tenant_context?.tenant_id === "tenant-allow", "tenant context must propagate");
assertAuditCandidate(allowSuccess, "allow success");

for (const [label, request, expectedDecision] of [
  ["deny", denyRequest, "deny"],
  ["requires evidence", requiresEvidenceRequest, "requires_evidence"],
  ["operator review", operatorReviewRequest, "requires_operator_review"],
  ["runtime unavailable", runtimeUnavailableRequest, "runtime_enforcement_unavailable"]
]) {
  let count = 0;
  const result = await invokeGovernedConduitAction(request, context(label), async () => {
    count += 1;
    return { downstream_status: "completed" };
  });
  assertDistinctResult(result, "policy_blocked", label);
  assert(result.policy_decision?.decision === expectedDecision, `${label}: expected policy decision ${expectedDecision}`);
  assertDownstreamZero(result, label);
  assert(count === 0, `${label}: downstream callback must not run`);
  assertAuditCandidate(result, label);
}

const malformedConduit = await invokeGovernedConduitAction("not an object", {}, async () => {
  fail("malformed Conduit request must not invoke downstream");
});
assertDistinctResult(malformedConduit, "palisade_boundary_failed", "malformed Conduit request");
assertDownstreamZero(malformedConduit, "malformed Conduit request");
assert(malformedConduit.policy_evaluation.attempted === false, "malformed Conduit request must fail before Palisade");

const malformedConstructionRequest = makeRequest(caseById(policyCases, "deny-production-workspace-provider-login-only"), "malformed-construction");
malformedConstructionRequest.evidence_state.current_evidence = [1n];
const malformedConstruction = await invokeGovernedConduitAction(malformedConstructionRequest, context("malformed-construction"), async () => {
  fail("malformed Palisade construction must not invoke downstream");
});
assertDistinctResult(malformedConstruction, "palisade_boundary_failed", "malformed Palisade request construction");
assertDownstreamZero(malformedConstruction, "malformed Palisade request construction");
assert(malformedConstruction.policy_evaluation.attempted === false, "malformed construction must fail before Palisade");

const unknownClaimRequest = makeRequest(caseById(policyCases, "deny-production-workspace-provider-login-only"), "unknown-claim");
unknownClaimRequest.claim_id = "unknown_claim";
const unknownClaim = await invokeGovernedConduitAction(unknownClaimRequest, context("unknown-claim"));
assertDistinctResult(unknownClaim, "palisade_boundary_failed", "unknown claim");
assertDownstreamZero(unknownClaim, "unknown claim");
assert(unknownClaim.policy_evaluation.attempted === true, "unknown claim must reach Palisade and fail closed");
assert(unknownClaim.palisade_boundary_failure.provenance === "palisade/policy-bundle.v0/schema/policy-input.schema.json", "unknown claim must preserve boundary provenance");

const unsupportedContract = { ...denyRequest, request_id: "conduit-unsupported-contract", contract_version: "9.9.9" };
const unsupportedContractResult = await invokeGovernedConduitAction(unsupportedContract, context("unsupported-contract"));
assertDistinctResult(unsupportedContractResult, "palisade_boundary_failed", "unsupported contract");
assertDownstreamZero(unsupportedContractResult, "unsupported contract");

const unsupportedPolicy = { ...denyRequest, request_id: "conduit-unsupported-policy", policy_version: "9.9.9" };
const unsupportedPolicyResult = await invokeGovernedConduitAction(unsupportedPolicy, context("unsupported-policy"));
assertDistinctResult(unsupportedPolicyResult, "palisade_boundary_failed", "unsupported policy");
assertDownstreamZero(unsupportedPolicyResult, "unsupported policy");

const bypassAttempts = [
  ["caller supplied allowed true", { allowed: true }],
  ["caller supplied decision", { decision: "allow" }],
  ["caller supplied evaluator", {}, { evaluator: () => ({ decision: "allow", allowed: true }) }],
  ["skip policy", { skip_policy: true }],
  ["fail open", { fail_open: true }]
];
for (const [label, requestFields, contextFields = {}] of bypassAttempts) {
  let count = 0;
  const result = await invokeGovernedConduitAction(
    { ...denyRequest, request_id: `conduit-${label.replaceAll(" ", "-")}`, ...requestFields },
    { ...context(label), ...contextFields },
    async () => {
      count += 1;
      return { downstream_status: "completed" };
    }
  );
  assertDistinctResult(result, "palisade_boundary_failed", label);
  assertDownstreamZero(result, label);
  assert(count === 0, `${label}: downstream callback must not run`);
}

let throwCount = 0;
const downstreamThrow = await invokeGovernedConduitAction(allowRequest, context("throw"), async () => {
  throwCount += 1;
  throw new Error("bounded downstream throw");
});
assertDistinctResult(downstreamThrow, "downstream_failed", "downstream throws");
assertDownstreamOnce(downstreamThrow, "downstream throws");
assert(throwCount === 1, "downstream throw must not retry");
assert(downstreamThrow.downstream.failure_classification === "downstream_exception", "downstream throw classification mismatch");

let rejectCount = 0;
const downstreamReject = await invokeGovernedConduitAction(allowRequest, context("reject"), async () => {
  rejectCount += 1;
  return Promise.reject(new Error("bounded downstream reject"));
});
assertDistinctResult(downstreamReject, "downstream_failed", "downstream rejects");
assertDownstreamOnce(downstreamReject, "downstream rejects");
assert(rejectCount === 1, "downstream reject must not retry");

let malformedCount = 0;
const malformedDownstream = await invokeGovernedConduitAction(allowRequest, context("malformed-downstream"), async () => {
  malformedCount += 1;
  return { downstream_status: "ambiguous" };
});
assertDistinctResult(malformedDownstream, "downstream_failed", "malformed downstream");
assertDownstreamOnce(malformedDownstream, "malformed downstream");
assert(malformedCount === 1, "malformed downstream result must not retry");
assert(malformedDownstream.downstream.failure_classification === "malformed_downstream_result", "malformed downstream classification mismatch");
assert(malformedDownstream.policy_decision.decision === "allow", "malformed downstream must preserve allowing decision");
assert(malformedDownstream.result_class !== "permitted", "downstream failure must not report governed success");

const deterministicA = await invokeGovernedConduitAction(denyRequest, context("deterministic"));
const deterministicB = await invokeGovernedConduitAction(denyRequest, context("deterministic"));
assert(JSON.stringify(deterministicA) === JSON.stringify(deterministicB), "identical blocked inputs must produce deterministic results");

const malformedDecisionRoot = makeTempRepoRoot("malformed-decision");
const policyPath = path.join(malformedDecisionRoot, "palisade/policy-bundle.v0/policies/claim-capability-policy.json");
const mutatedPolicy = readJson(policyPath);
mutatedPolicy.runtime_enforcement.current_state_basis = 17;
writeJson(policyPath, mutatedPolicy);
const malformedDecisionResult = await withCwd(malformedDecisionRoot, async () =>
  invokeGovernedConduitAction(runtimeUnavailableRequest, context("malformed-decision"), async () => {
    fail("malformed Palisade decision must not invoke downstream");
  })
);
assertDistinctResult(malformedDecisionResult, "palisade_boundary_failed", "malformed Palisade decision");
assertDownstreamZero(malformedDecisionResult, "malformed Palisade decision");
assert(malformedDecisionResult.palisade_boundary_failure.stage === "decision_validation", "malformed decision must preserve validation stage");

const classifications = new Map((manifest.bypass_coverage || []).map((entry) => [entry.path, entry.classification]));
assert(classifications.get("conduit/runtime/v0/index.mjs#invokeGovernedConduitAction") === "canonical_governed", "canonical path must be classified canonical_governed");
assert(classifications.get("conduit/runtime/v0/conduit-governed-invocation.mjs#invokeGovernedConduitAction") === "routed_to_canonical", "implementation export must be routed_to_canonical");
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
  ([, classification]) => !["canonical_governed", "routed_to_canonical", "non_governed", "out_of_scope", "test_only", "inactive", "deprecated"].includes(classification)
);
assert(activeBypasses.length === 0, `active bypasses remain: ${JSON.stringify(activeBypasses)}`);

if (failures.length > 0) {
  console.error("Conduit Palisade binding validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Conduit Palisade binding ok");
console.log(`Validated ${cases.covered_cases.length} canonical binding coverage claims through ${canonicalConduitEntryPoint}`);
