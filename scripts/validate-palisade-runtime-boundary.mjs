import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  evaluatePalisadeDecision,
  isPalisadeBoundaryFailure,
  isPalisadePolicyDecision
} from "../palisade/runtime/v0/palisade-decision-boundary.mjs";
import {
  evaluatePalisadeDecision as evaluateViaValidatorWrapper,
  palisadePolicyPath
} from "./palisade-policy-consumption.mjs";

const casesPath = "palisade/runtime/v0/tests/palisade-decision-boundary.cases.json";
const policyCasesPath = "palisade/policy-bundle.v0/tests/claim-capability-policy.cases.json";
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
  return found;
}

function assertDecision(result, expectedDecision, label) {
  assert(isPalisadePolicyDecision(result), `${label}: expected policy decision`);
  assert(result.decision === expectedDecision, `${label}: expected ${expectedDecision}, got ${result.decision}`);
  assert(result.allowed === (result.decision === "allow"), `${label}: allowed must match decision`);
  assert(result.boundary_failure !== true, `${label}: policy decision must not be a boundary failure`);
  assert(result.runtime_enforcement_status !== "available", `${label}: runtime enforcement must remain unavailable`);
}

function assertBoundaryFailure(result, label, expectedStage) {
  assert(isPalisadeBoundaryFailure(result), `${label}: expected structured boundary failure`);
  assert(result.allowed === false, `${label}: boundary failure must be non-allowing`);
  assert(!("decision" in result), `${label}: boundary failure must not manufacture a policy decision`);
  assert(Array.isArray(result.reasons) && result.reasons.length > 0, `${label}: boundary failure must preserve reasons`);
  assert(typeof result.failure_classification === "string", `${label}: boundary failure must preserve classification`);
  assert(typeof result.provenance === "string", `${label}: boundary failure must preserve provenance`);
  if (expectedStage) assert(result.stage === expectedStage, `${label}: expected stage ${expectedStage}, got ${result.stage}`);
}

function makeTempRepoRoot(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `palisade-${label}-`));
  fs.cpSync("palisade", path.join(root, "palisade"), { recursive: true });
  fs.cpSync("data", path.join(root, "data"), { recursive: true });
  return root;
}

function mutateTempRepo(label, mutator) {
  const root = makeTempRepoRoot(label);
  mutator(root);
  return root;
}

const runtimeCases = readJson(casesPath);
const policyCases = readJson(policyCasesPath);
const policy = readJson(palisadePolicyPath);

assert(runtimeCases.runtime_entry_point === "palisade/runtime/v0/palisade-decision-boundary.mjs", `${casesPath}: runtime entry point mismatch`);
assert(runtimeCases.exported_function === "evaluatePalisadeDecision", `${casesPath}: exported function mismatch`);

const denyInput = caseById(policyCases, "deny-production-workspace-provider-login-only").input;
const requiresEvidenceInput = caseById(policyCases, "requires-evidence-staged-surface-advancement-partial-evidence").input;
const operatorReviewInput = caseById(policyCases, "requires-operator-review-structural-threshold-transition").input;
const runtimeUnavailableInput = caseById(policyCases, "runtime-enforcement-unavailable-current-policy-bundle").input;
const allowInput = caseById(policyCases, "allow-production-workspace-complete-hypothetical-evidence").input;

assertDecision(evaluatePalisadeDecision(denyInput), "deny", "schema-valid deny decision");
assertDecision(evaluatePalisadeDecision(requiresEvidenceInput), "requires_evidence", "schema-valid requires-evidence decision");
assertDecision(evaluatePalisadeDecision(operatorReviewInput), "requires_operator_review", "schema-valid Operator-review decision");
assertDecision(evaluatePalisadeDecision(runtimeUnavailableInput), "runtime_enforcement_unavailable", "schema-valid runtime-unavailable decision");

const allowResult = evaluatePalisadeDecision(allowInput);
assertDecision(allowResult, "allow", "allow-reachable hypothetical fixture");
assert(
  caseById(policyCases, "allow-production-workspace-complete-hypothetical-evidence").fixture_type ===
    "policy_test_fixture_hypothetical_complete_evidence",
  "allow fixture must be explicitly test-only"
);
assert(
  allowInput.current_repository_state_basis.join(" ").includes("not current repository state"),
  "allow fixture basis must state it is not current repository state"
);

const malformedRequest = "not an object";
assertBoundaryFailure(evaluatePalisadeDecision(malformedRequest), "malformed request", "request_validation");

const missingClaim = clone(denyInput);
delete missingClaim.claim_id;
assertBoundaryFailure(evaluatePalisadeDecision(missingClaim), "missing claim ID", "request_validation");

const missingBasis = clone(denyInput);
delete missingBasis.current_repository_state_basis;
assertBoundaryFailure(evaluatePalisadeDecision(missingBasis), "missing current-state basis", "request_validation");

const unknownClaim = clone(denyInput);
unknownClaim.claim_id = "unknown_claim";
assertBoundaryFailure(evaluatePalisadeDecision(unknownClaim), "unknown claim", "request_validation");

const unsupportedContractRoot = mutateTempRepo("unsupported-contract", (root) => {
  const file = path.join(root, "data/interface-contract.v1.json");
  const contract = readJson(file);
  contract.metadata.version = "9.9.9";
  writeJson(file, contract);
});
assertBoundaryFailure(
  evaluatePalisadeDecision(denyInput, { repoRoot: unsupportedContractRoot }),
  "unsupported request contract version",
  "version_compatibility"
);

const unsupportedPolicyRoot = mutateTempRepo("unsupported-policy", (root) => {
  const file = path.join(root, "palisade/policy-bundle.v0/manifest.json");
  const manifest = readJson(file);
  manifest.version = "9.9.9";
  writeJson(file, manifest);
});
assertBoundaryFailure(
  evaluatePalisadeDecision(denyInput, { repoRoot: unsupportedPolicyRoot }),
  "unsupported policy version",
  "version_compatibility"
);

const missingPolicyRoot = mutateTempRepo("missing-policy", (root) => {
  fs.unlinkSync(path.join(root, palisadePolicyPath));
});
assertBoundaryFailure(
  evaluatePalisadeDecision(denyInput, { repoRoot: missingPolicyRoot }),
  "missing policy artifact",
  "policy_loading"
);

const malformedPolicyRoot = mutateTempRepo("malformed-policy", (root) => {
  fs.writeFileSync(path.join(root, palisadePolicyPath), "{");
});
assertBoundaryFailure(
  evaluatePalisadeDecision(denyInput, { repoRoot: malformedPolicyRoot }),
  "malformed policy artifact",
  "policy_loading"
);

const malformedDecisionRoot = mutateTempRepo("malformed-decision", (root) => {
  const file = path.join(root, palisadePolicyPath);
  const mutatedPolicy = readJson(file);
  mutatedPolicy.runtime_enforcement.current_state_basis = 17;
  writeJson(file, mutatedPolicy);
});
assertBoundaryFailure(
  evaluatePalisadeDecision(runtimeUnavailableInput, { repoRoot: malformedDecisionRoot }),
  "malformed decision output",
  "decision_validation"
);

const contradictoryEvidence = clone(denyInput);
contradictoryEvidence.production_workspace_threshold_state.real_authenticated_shell = {
  state: "exists",
  verified: false,
  evidence: ["contradictory test-only evidence"]
};
assertBoundaryFailure(evaluatePalisadeDecision(contradictoryEvidence), "contradictory evidence state", "request_contract_validation");

const missingNestedEvidence = clone(denyInput);
delete missingNestedEvidence.production_workspace_threshold_state.real_authenticated_shell.evidence;
assertBoundaryFailure(evaluatePalisadeDecision(missingNestedEvidence), "full nested schema validation", "request_validation");

const callerAllowed = clone(denyInput);
callerAllowed.allowed = true;
assertBoundaryFailure(evaluatePalisadeDecision(callerAllowed), "caller-supplied allowed true", "request_validation");

const runtimeOverride = clone(denyInput);
runtimeOverride.runtime_enforcement_status = "available";
assertBoundaryFailure(evaluatePalisadeDecision(runtimeOverride), "attempted runtime-status override", "request_validation");

const policyBypass = clone(denyInput);
policyBypass.policy_bypass = true;
assertBoundaryFailure(evaluatePalisadeDecision(policyBypass, { disableValidation: true }), "attempted policy bypass", "request_validation");

const deterministicA = evaluatePalisadeDecision(requiresEvidenceInput);
const deterministicB = evaluatePalisadeDecision(requiresEvidenceInput);
assert(JSON.stringify(deterministicA) === JSON.stringify(deterministicB), "identical valid requests must produce identical decisions");

const failureA = evaluatePalisadeDecision(unknownClaim);
const failureB = evaluatePalisadeDecision(unknownClaim);
assert(JSON.stringify(failureA) === JSON.stringify(failureB), "identical invalid requests must produce identical boundary failures");

const policyDeny = evaluatePalisadeDecision(denyInput);
const boundaryFailure = evaluatePalisadeDecision(unknownClaim);
assert(policyDeny.decision === "deny", "policy deny fixture must return deny");
assertBoundaryFailure(boundaryFailure, "policy deny distinct from boundary failure");
assert(policyDeny.boundary_failure !== true, "valid policy deny must not be represented as boundary failure");

const wrapperDecision = evaluateViaValidatorWrapper(policy, denyInput);
assert(wrapperDecision.decision === policyDeny.decision, "validator wrapper regression must preserve decision");
assert(
  wrapperDecision.runtime_enforcement_status === policyDeny.runtime_enforcement_status,
  "validator wrapper regression must preserve runtime enforcement status"
);

if (failures.length) {
  console.error("Palisade runtime boundary validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Palisade runtime boundary ok");
console.log(`Validated ${runtimeCases.covered_cases.length} runtime boundary coverage claims through direct module invocation`);
