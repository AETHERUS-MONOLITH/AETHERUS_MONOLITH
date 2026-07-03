#!/usr/bin/env node
import fs from "node:fs";

import {
  invokeGovernedConduitAction,
  governedRuntimePathActionIdentifier,
  governedRuntimePathClaimId
} from "../conduit/runtime/v0/index.mjs";
import { invokeGovernedConduitActionForTestOnly } from "../conduit/runtime/v0/conduit-governed-invocation.mjs";
import {
  canonicalSurface,
  deterministicHash,
  makeTestOnlyCompleteEvidenceSnapshot,
  palisadeCurrentStateEvidenceContractPath,
  resolveCanonicalPalisadeRuntime
} from "../palisade/runtime/v0/palisade-current-state-evidence.mjs";
import { acquireConduitCurrentStateEvidence } from "../conduit/runtime/v0/conduit-current-state-evidence.mjs";

const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalRequest(suffix = "current") {
  return {
    request_id: `palisade-current-state-${suffix}`,
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

function assertZeroDownstream(result, label) {
  assert(result.downstream?.attempted === false, `${label}: downstream must not be attempted`);
  assert(result.downstream?.invocation_count === 0, `${label}: invocation count must be zero`);
}

function assertBoundary(result, label) {
  assert(result.result_class === "palisade_boundary_failed", `${label}: expected palisade_boundary_failed`);
  assert(result.allowed === false, `${label}: boundary result must be non-allowing`);
  assertZeroDownstream(result, label);
}

const contract = JSON.parse(fs.readFileSync(palisadeCurrentStateEvidenceContractPath, "utf8"));
assert(contract.owner === "Palisade", "evidence contract owner must be Palisade");
assert(!("runtime_governance_path" in contract), "evidence contract must not restate runtime component list");
assert(!("production_workspace_threshold" in contract), "evidence contract must not restate production threshold list");
assert(
  contract.non_claims.some((claim) => claim.includes("does not prove any component")),
  "evidence contract must explicitly reject self-certification"
);
assert(
  contract.source_authority_records.every((source) => !source.repository_path.startsWith("geo/")),
  "evidence contract must not select GEO sources"
);
assert(
  contract.source_authority_records.every((source) => !source.repository_path.startsWith(".track3-runs/")),
  "evidence contract must not select ignored run outputs"
);

const request = canonicalRequest("current");
const { plan } = resolveCanonicalPalisadeRuntime({ envelope: request });
const snapshot = acquireConduitCurrentStateEvidence(plan);

assert(plan.contract_id === contract.contract_id, "plan contract id mismatch");
assert(plan.contract_version === contract.version, "plan contract version mismatch");
assert(plan.contract_path === palisadeCurrentStateEvidenceContractPath, "plan contract path mismatch");
assert(typeof plan.contract_sha256 === "string" && plan.contract_sha256.length === 64, "plan contract hash missing");
assert(snapshot.contract_sha256 === plan.contract_sha256, "snapshot contract hash mismatch");
assert(snapshot.acquisition_plan_hash === plan.acquisition_plan_hash, "snapshot acquisition plan hash mismatch");
assert(snapshot.records.length === plan.source_plan.length, "snapshot record count mismatch");
assert(snapshot.records.every((record) => record.sha256 && record.repository_path), "snapshot records must carry path and hash");

const currentA = await invokeGovernedConduitAction(request);
const currentB = await invokeGovernedConduitAction(request);
assert(currentA.result_class === "policy_blocked", "current evidence must be policy_blocked");
assert(currentA.allowed === false, "current evidence must not allow");
assert(currentA.policy_decision?.allowed === false, "current Palisade decision must be non-allowing");
assert(currentA.current_state_basis.length > 0, "current-state basis must be nonempty");
assert(currentA.policy_decision?.evidence_contract_sha256 === plan.contract_sha256, "decision contract hash mismatch");
assert(currentA.policy_decision?.acquisition_plan_hash === plan.acquisition_plan_hash, "decision plan hash mismatch");
assertZeroDownstream(currentA, "current evidence");
assert(
  currentA.policy_decision?.missing_evidence?.includes("release_state_decision"),
  "authorized source existence must not satisfy release_state_decision"
);

const determinismA = {
  contract_hash: currentA.policy_decision.evidence_contract_sha256,
  plan_hash: currentA.policy_decision.acquisition_plan_hash,
  snapshot_hash: currentA.policy_decision.evidence_snapshot_hash,
  basis_hash: currentA.policy_decision.current_state_basis_hash,
  decision_hash: deterministicHash(currentA.policy_decision),
  basis_count: currentA.current_state_basis.length,
  downstream_count: currentA.downstream.invocation_count
};
const determinismB = {
  contract_hash: currentB.policy_decision.evidence_contract_sha256,
  plan_hash: currentB.policy_decision.acquisition_plan_hash,
  snapshot_hash: currentB.policy_decision.evidence_snapshot_hash,
  basis_hash: currentB.policy_decision.current_state_basis_hash,
  decision_hash: deterministicHash(currentB.policy_decision),
  basis_count: currentB.current_state_basis.length,
  downstream_count: currentB.downstream.invocation_count
};
assert(JSON.stringify(determinismA) === JSON.stringify(determinismB), "current evidence invocation must be deterministic");

for (const [label, patch, context = undefined] of [
  ["caller evidence_state", { evidence_state: {} }],
  ["caller production state", { production_workspace_threshold_state: {} }],
  ["caller runtime state", { runtime_governance_path_state: {} }],
  ["caller repository basis", { current_repository_state_basis: ["caller"] }],
  ["caller authorization", { operator_authorization_state: { status: "approved" } }],
  ["nested evidence", { request_id: { evidence_state: {} } }],
  ["aliased evidence source", { evidence_provider: "caller" }],
  ["older policy version", { policy_version: "0.0.1" }],
  ["future policy version", { policy_version: "9.9.9" }],
  ["contract mismatch", { contract_version: "9.9.9" }],
  ["surface mismatch", { surface: "other_surface" }],
  ["claim mismatch", { claim_id: "production_workspace_claim" }],
  ["action mismatch", { requested_action: "claim_public_capability" }],
  ["caller repoRoot", { repoRoot: "/tmp" }],
  ["caller source path", { source_path: "README.md" }],
  ["caller adapter", { action_adapter: "caller" }],
  ["non-empty context", {}, { workspace_context: { workspace_id: "caller" } }],
  ["context authorization", {}, { authorization_witness: { status: "approved" } }]
]) {
  const result = await invokeGovernedConduitAction({ ...request, request_id: `override-${label.replaceAll(" ", "-")}`, ...patch }, context);
  assertBoundary(result, label);
}

const mismatchedSnapshot = clone(snapshot);
mismatchedSnapshot.contract_sha256 = "0".repeat(64);
mismatchedSnapshot.snapshot_hash = deterministicHash({
  contract_id: mismatchedSnapshot.contract_id,
  contract_version: mismatchedSnapshot.contract_version,
  contract_path: mismatchedSnapshot.contract_path,
  contract_sha256: mismatchedSnapshot.contract_sha256,
  acquisition_plan_hash: mismatchedSnapshot.acquisition_plan_hash,
  source_plan_projection_hash: mismatchedSnapshot.source_plan_projection_hash,
  records: mismatchedSnapshot.records
});
const mismatchResult = await invokeGovernedConduitActionForTestOnly(request, {}, { testOnlyEvidenceSnapshot: mismatchedSnapshot });
assertBoundary(mismatchResult, "contract hash mismatch");
assert(
  mismatchResult.palisade_boundary_failure?.failure_classification === "evidence_contract_identity_mismatch",
  "contract hash mismatch classification"
);

const malformedSnapshot = clone(snapshot);
malformedSnapshot.records[0].parse_status = "malformed";
malformedSnapshot.snapshot_hash = deterministicHash({
  contract_id: malformedSnapshot.contract_id,
  contract_version: malformedSnapshot.contract_version,
  contract_path: malformedSnapshot.contract_path,
  contract_sha256: malformedSnapshot.contract_sha256,
  acquisition_plan_hash: malformedSnapshot.acquisition_plan_hash,
  source_plan_projection_hash: malformedSnapshot.source_plan_projection_hash,
  records: malformedSnapshot.records
});
const malformedResult = await invokeGovernedConduitActionForTestOnly(request, {}, { testOnlyEvidenceSnapshot: malformedSnapshot });
assertBoundary(malformedResult, "malformed required source");

const completeRequest = canonicalRequest("complete");
const completePlan = resolveCanonicalPalisadeRuntime({ envelope: completeRequest }).plan;
const completeSnapshot = makeTestOnlyCompleteEvidenceSnapshot({ acquisitionPlan: completePlan });
const allowResult = await invokeGovernedConduitActionForTestOnly(completeRequest, {}, {
  testOnlyEvidenceSnapshot: completeSnapshot,
  testOnlyCompleteEvidence: true,
  authorizationWitness: testWitness(completeRequest)
});
assert(allowResult.result_class === "permitted", "test-only complete evidence must permit");
assert(allowResult.policy_decision?.decision === "allow", "test-only complete evidence must reach allow");
assert(allowResult.downstream?.attempted === true, "test-only allow must attempt downstream");
assert(allowResult.downstream?.invocation_count === 1, "test-only allow must run action once");

const badWitness = testWitness(completeRequest);
badWitness.request_id = "wrong";
const badWitnessResult = await invokeGovernedConduitActionForTestOnly(completeRequest, {}, {
  testOnlyEvidenceSnapshot: completeSnapshot,
  testOnlyCompleteEvidence: true,
  authorizationWitness: badWitness
});
assertBoundary(badWitnessResult, "invalid test witness");
assert(
  badWitnessResult.palisade_boundary_failure?.failure_classification === "authorization_witness_invalid",
  "invalid test witness classification"
);

const canonicalFixtureAttempt = await invokeGovernedConduitAction({
  ...completeRequest,
  request_id: "canonical-fixture-attempt",
  test_fixture: "complete"
});
assertBoundary(canonicalFixtureAttempt, "canonical fixture attempt");

if (failures.length > 0) {
  console.error("Palisade current-state evidence binding validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Palisade current-state evidence binding ok");
console.log(`contract_hash=${plan.contract_sha256}`);
console.log(`plan_hash=${plan.acquisition_plan_hash}`);
console.log(`snapshot_hash=${snapshot.snapshot_hash}`);
console.log(`state_basis_hash=${currentA.policy_decision.current_state_basis_hash}`);
console.log(`decision_hash=${determinismA.decision_hash}`);
console.log(`basis_count=${currentA.current_state_basis.length}`);
console.log(`current_downstream_count=${currentA.downstream.invocation_count}`);
console.log(`test_only_downstream_count=${allowResult.downstream.invocation_count}`);
