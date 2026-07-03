import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  missingComponents,
  palisadeDecisionSchemaPath,
  palisadeInputSchemaPath,
  palisadeManifestPath,
  palisadePolicyPath
} from "./palisade-policy-engine.mjs";

export const palisadeCurrentStateEvidenceModulePath =
  "palisade/runtime/v0/palisade-current-state-evidence.mjs";
export const palisadeCurrentStateEvidenceContractPath =
  "palisade/runtime/v0/palisade-current-state-evidence-contract.v0.json";
export const interfaceContractPath = "data/interface-contract.v1.json";
export const conduitVersioningPolicyPath = "data/conduit-versioning-policy.v1.json";
export const conduitBindingManifestPath = "conduit/runtime/v0/conduit-binding-manifest.v0.json";
export const canonicalSurface = "conduit_internal_runtime";
export const canonicalClaimId = "runtime_governance_path_sufficiency";
export const canonicalRequestedAction = "evaluate_runtime_path_sufficiency";
export const currentStateConstructionVersion = "0.1.0";

const currentEvidenceStateVocabulary = new Set(["exists", "partial", "stubbed", "absent", "unverified"]);
const noTrustedAuthorizerSource = "no_trusted_invocation_authorizer_implemented";

export class PalisadeCurrentStateEvidenceError extends Error {
  constructor(failure_classification, stage, reasons, details = []) {
    super(reasons.join("; "));
    this.name = "PalisadeCurrentStateEvidenceError";
    this.failure_classification = failure_classification;
    this.stage = stage;
    this.reasons = reasons;
    this.details = details;
  }
}

export function palisadeRepositoryRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

export function stableCanonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableCanonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableCanonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function deterministicHash(value) {
  return sha256Text(stableCanonicalJson(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function readUtf8(repoRoot, relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(repoRoot, relativePath) {
  return JSON.parse(readUtf8(repoRoot, relativePath));
}

function recordDeclaredVersion(parsed) {
  if (!isObject(parsed)) return null;
  return (
    parsed.version ||
    parsed.metadata?.version ||
    parsed.bundle_id?.version ||
    parsed.contract_version ||
    parsed.runtime_version ||
    null
  );
}

function recordDeclaredStatus(parsed) {
  if (!isObject(parsed)) return null;
  return parsed.status || parsed.metadata?.status || parsed.integration_status?.runtime_service || null;
}

function sourceRecordById(snapshot) {
  return new Map((snapshot.records || []).map((record) => [record.source_id, record]));
}

function sourceEvidence(recordsById, sourceIds) {
  return sourceIds
    .map((sourceId) => recordsById.get(sourceId))
    .filter(Boolean)
    .map((record) => `${record.source_id}:${record.repository_path}:${record.sha256 || "unavailable"}`);
}

function componentState(state, evidence) {
  return {
    state,
    verified: state === "exists",
    evidence: evidence.length > 0 ? evidence : ["no validated current-state artifact acquired"]
  };
}

function validateRepositoryPath(record, label) {
  const value = record.repository_path;
  const errors = [];
  if (typeof value !== "string" || value.trim() === "") errors.push(`${label}: repository_path must be a non-empty string`);
  if (path.isAbsolute(value)) errors.push(`${label}: absolute paths are prohibited`);
  if (value.includes("..")) errors.push(`${label}: path traversal is prohibited`);
  if (value.startsWith(".track3-runs/") || value.includes("/.track3-runs/")) {
    errors.push(`${label}: ignored run outputs are prohibited`);
  }
  if (/^[a-z]+:\/\//i.test(value)) errors.push(`${label}: network URLs are prohibited`);
  if (value.startsWith("geo/")) errors.push(`${label}: GEO artifacts are not Palisade runtime authority`);
  return errors;
}

function validateEvidenceContract(contract) {
  const errors = [];
  if (!isObject(contract)) errors.push("evidence contract must be an object");
  if (contract.contract_id !== "palisade-current-state-evidence-contract.v0") {
    errors.push("unexpected evidence contract id");
  }
  if (contract.version !== "0.1.0") errors.push("unexpected evidence contract version");
  if (contract.owner !== "Palisade") errors.push("evidence contract owner must be Palisade");
  if (contract.contract_path !== palisadeCurrentStateEvidenceContractPath) {
    errors.push("evidence contract path mismatch");
  }
  if (!Array.isArray(contract.source_authority_records) || contract.source_authority_records.length === 0) {
    errors.push("evidence contract must contain source_authority_records");
  }
  if (contract.production_workspace_threshold || contract.runtime_governance_path || contract.component_order) {
    errors.push("evidence contract must not restate Palisade component lists or thresholds");
  }

  const seenIds = new Set();
  const seenPaths = new Set();
  for (const [index, record] of (contract.source_authority_records || []).entries()) {
    const label = `source_authority_records[${index}]`;
    if (!isObject(record)) {
      errors.push(`${label}: source record must be an object`);
      continue;
    }
    for (const field of [
      "source_id",
      "repository_path",
      "owning_layer",
      "artifact_class",
      "parser_expectation",
      "required_acquisition",
      "authority_classification",
      "evidence_meaning",
      "update_mechanism",
      "provenance",
      "acquisition_order"
    ]) {
      if (!(field in record)) errors.push(`${label}: missing ${field}`);
    }
    if (seenIds.has(record.source_id)) errors.push(`${label}: duplicate source_id ${record.source_id}`);
    if (seenPaths.has(record.repository_path)) errors.push(`${label}: duplicate repository_path ${record.repository_path}`);
    seenIds.add(record.source_id);
    seenPaths.add(record.repository_path);
    if (!["json", "text"].includes(record.parser_expectation)) {
      errors.push(`${label}: unsupported parser_expectation ${record.parser_expectation}`);
    }
    if (record.required_acquisition !== true) {
      errors.push(`${label}: canonical sources must be required for this pass`);
    }
    if (!Number.isInteger(record.acquisition_order)) {
      errors.push(`${label}: acquisition_order must be an integer`);
    }
    errors.push(...validateRepositoryPath(record, label));
  }

  if (errors.length > 0) {
    throw new PalisadeCurrentStateEvidenceError("malformed_evidence_contract", "evidence_contract_validation", errors);
  }
}

function loadContract(repoRoot) {
  let bytes;
  let parsed;
  try {
    bytes = readUtf8(repoRoot, palisadeCurrentStateEvidenceContractPath);
  } catch (error) {
    throw new PalisadeCurrentStateEvidenceError("missing_evidence_contract", "evidence_contract_loading", [
      `Unable to read ${palisadeCurrentStateEvidenceContractPath}: ${error.message}`
    ]);
  }
  try {
    parsed = JSON.parse(bytes);
  } catch (error) {
    throw new PalisadeCurrentStateEvidenceError("malformed_evidence_contract", "evidence_contract_loading", [
      `Unable to parse ${palisadeCurrentStateEvidenceContractPath}: ${error.message}`
    ]);
  }
  validateEvidenceContract(parsed);
  return {
    contract: parsed,
    contract_sha256: sha256Text(bytes),
    contract_byte_count: Buffer.byteLength(bytes)
  };
}

export function loadCanonicalPalisadeArtifacts(repoRoot = palisadeRepositoryRoot()) {
  return {
    manifest: readJson(repoRoot, palisadeManifestPath),
    policy: readJson(repoRoot, palisadePolicyPath),
    inputSchema: readJson(repoRoot, palisadeInputSchemaPath),
    decisionSchema: readJson(repoRoot, palisadeDecisionSchemaPath),
    interfaceContract: readJson(repoRoot, interfaceContractPath),
    conduitVersioningPolicy: readJson(repoRoot, conduitVersioningPolicyPath),
    conduitBindingManifest: readJson(repoRoot, conduitBindingManifestPath)
  };
}

export function resolveCanonicalPalisadeRuntime({
  repoRoot = palisadeRepositoryRoot(),
  envelope = null
} = {}) {
  const loadedContract = loadContract(repoRoot);
  const artifacts = loadCanonicalPalisadeArtifacts(repoRoot);
  const { contract, contract_sha256 } = loadedContract;
  const expectedContractVersion = artifacts.interfaceContract.metadata?.version;
  const expectedPolicyVersion = artifacts.manifest.version;
  const binding = artifacts.conduitBindingManifest;
  const policyRule = (artifacts.policy.rules || []).find((rule) => rule.claim_id === canonicalClaimId);
  const errors = [];

  if (expectedContractVersion !== "1.0.0") errors.push(`unsupported canonical contract version ${expectedContractVersion || "missing"}`);
  if (expectedPolicyVersion !== "0.1.0") errors.push(`unsupported canonical policy version ${expectedPolicyVersion || "missing"}`);
  if (artifacts.policy.version !== expectedPolicyVersion) errors.push("policy artifact version does not match manifest version");
  if (binding.selected_palisade_claim_id !== canonicalClaimId) errors.push("binding manifest claim does not match canonical claim");
  if (binding.selected_requested_action !== canonicalRequestedAction) errors.push("binding manifest action does not match canonical action");
  if (binding.selected_action_identifier !== canonicalRequestedAction) errors.push("binding manifest action identifier mismatch");
  if (!policyRule) errors.push(`canonical policy rule not found for ${canonicalClaimId}`);
  if (policyRule && !policyRule.requested_actions?.includes(canonicalRequestedAction)) {
    errors.push(`canonical policy rule does not support ${canonicalRequestedAction}`);
  }
  if (contract.fixed_governed_tuple?.surface !== canonicalSurface) errors.push("evidence contract fixed surface mismatch");
  if (contract.fixed_governed_tuple?.claim_id !== canonicalClaimId) errors.push("evidence contract fixed claim mismatch");
  if (contract.fixed_governed_tuple?.requested_action !== canonicalRequestedAction) {
    errors.push("evidence contract fixed action mismatch");
  }

  if (envelope) {
    if (envelope.contract_version !== expectedContractVersion) {
      errors.push(`unsupported canonical contract version assertion ${envelope.contract_version || "missing"}`);
    }
    if (envelope.policy_version !== expectedPolicyVersion) {
      errors.push(`unsupported canonical policy version assertion ${envelope.policy_version || "missing"}`);
    }
    if (envelope.surface !== canonicalSurface) errors.push(`unsupported governed surface ${envelope.surface || "missing"}`);
    if (envelope.claim_id !== canonicalClaimId) errors.push(`unsupported governed claim ${envelope.claim_id || "missing"}`);
    if (envelope.requested_action !== canonicalRequestedAction) {
      errors.push(`unsupported governed action ${envelope.requested_action || "missing"}`);
    }
  }

  if (errors.length > 0) {
    throw new PalisadeCurrentStateEvidenceError("unsupported_canonical_version", "canonical_runtime_resolution", errors);
  }

  const sourcePlan = contract.source_authority_records
    .map((record) => ({
      source_id: record.source_id,
      repository_path: record.repository_path,
      owning_layer: record.owning_layer,
      artifact_class: record.artifact_class,
      authority_classification: record.authority_classification,
      evidence_meaning: record.evidence_meaning,
      update_mechanism: record.update_mechanism,
      parser_expectation: record.parser_expectation,
      required_acquisition: record.required_acquisition,
      provenance: record.provenance,
      acquisition_order: record.acquisition_order
    }))
    .sort((left, right) => left.acquisition_order - right.acquisition_order || left.source_id.localeCompare(right.source_id));

  const sourcePlanProjection = sourcePlan.map((record) => ({
    source_id: record.source_id,
    repository_path: record.repository_path,
    parser_expectation: record.parser_expectation,
    required_acquisition: record.required_acquisition,
    acquisition_order: record.acquisition_order
  }));

  const plan = {
    acquisition_plan_version: contract.acquisition_plan_version,
    contract_id: contract.contract_id,
    contract_version: contract.version,
    contract_path: palisadeCurrentStateEvidenceContractPath,
    contract_sha256,
    canonical_policy_version: expectedPolicyVersion,
    canonical_contract_version: expectedContractVersion,
    fixed_surface: canonicalSurface,
    fixed_claim_id: canonicalClaimId,
    fixed_requested_action: canonicalRequestedAction,
    source_plan: sourcePlan,
    source_plan_projection: sourcePlanProjection,
    source_plan_projection_hash: deterministicHash(sourcePlanProjection)
  };
  plan.acquisition_plan_hash = deterministicHash({
    acquisition_plan_version: plan.acquisition_plan_version,
    contract_id: plan.contract_id,
    contract_version: plan.contract_version,
    contract_path: plan.contract_path,
    contract_sha256: plan.contract_sha256,
    canonical_policy_version: plan.canonical_policy_version,
    canonical_contract_version: plan.canonical_contract_version,
    fixed_surface: plan.fixed_surface,
    fixed_claim_id: plan.fixed_claim_id,
    fixed_requested_action: plan.fixed_requested_action,
    source_plan_projection: plan.source_plan_projection
  });

  return { plan, artifacts, contract, contract_byte_count: loadedContract.contract_byte_count };
}

function validateSnapshotAgainstPlan(snapshot, plan) {
  const errors = [];
  if (!isObject(snapshot)) errors.push("evidence snapshot must be an object");
  if (snapshot.contract_id !== plan.contract_id) errors.push("snapshot contract id mismatch");
  if (snapshot.contract_version !== plan.contract_version) errors.push("snapshot contract version mismatch");
  if (snapshot.contract_path !== plan.contract_path) errors.push("snapshot contract path mismatch");
  if (snapshot.contract_sha256 !== plan.contract_sha256) errors.push("snapshot contract hash mismatch");
  if (snapshot.acquisition_plan_hash !== plan.acquisition_plan_hash) errors.push("snapshot acquisition-plan hash mismatch");
  if (snapshot.source_plan_projection_hash !== plan.source_plan_projection_hash) {
    errors.push("snapshot source-plan projection hash mismatch");
  }
  if (!Array.isArray(snapshot.records)) errors.push("snapshot records must be an array");

  const planById = new Map(plan.source_plan.map((record) => [record.source_id, record]));
  const snapshotIds = new Set();
  const records = snapshot.records || [];
  if (records.length !== plan.source_plan.length) {
    errors.push(`snapshot record count ${records.length} does not match plan count ${plan.source_plan.length}`);
  }
  records.forEach((record, index) => {
    const planned = plan.source_plan[index];
    if (!planned) return;
    if (record.source_id !== planned.source_id) {
      errors.push(`snapshot record ${index} source_id ${record.source_id || "missing"} does not match plan ${planned.source_id}`);
    }
    if (snapshotIds.has(record.source_id)) errors.push(`duplicate snapshot source_id ${record.source_id}`);
    snapshotIds.add(record.source_id);
    if (!planById.has(record.source_id)) errors.push(`snapshot contains unplanned source ${record.source_id}`);
    if (record.repository_path !== planned.repository_path) errors.push(`${record.source_id}: repository_path mismatch`);
    if (record.parser_expectation !== planned.parser_expectation) errors.push(`${record.source_id}: parser_expectation mismatch`);
    if (record.existence_status !== "exists") errors.push(`${record.source_id}: required source does not exist`);
    if (record.read_status !== "read") errors.push(`${record.source_id}: required source was not read`);
    if (planned.parser_expectation === "json" && record.parse_status !== "parsed") {
      errors.push(`${record.source_id}: required JSON source did not parse`);
    }
    if (planned.parser_expectation === "text" && record.parse_status !== "not_applicable") {
      errors.push(`${record.source_id}: text source parse status must be not_applicable`);
    }
    if (typeof record.sha256 !== "string" || record.sha256.length !== 64) {
      errors.push(`${record.source_id}: missing deterministic sha256`);
    }
    if (record.provenance !== planned.provenance) errors.push(`${record.source_id}: provenance mismatch`);
    if (record.repository_path?.startsWith(".track3-runs/") || record.repository_path?.includes("/.track3-runs/")) {
      errors.push(`${record.source_id}: ignored run output cannot be evidence`);
    }
  });

  if (snapshot.snapshot_hash !== deterministicHash({
    contract_id: snapshot.contract_id,
    contract_version: snapshot.contract_version,
    contract_path: snapshot.contract_path,
    contract_sha256: snapshot.contract_sha256,
    acquisition_plan_hash: snapshot.acquisition_plan_hash,
    source_plan_projection_hash: snapshot.source_plan_projection_hash,
    records
  })) {
    errors.push("snapshot hash mismatch");
  }

  if (errors.length > 0) {
    throw new PalisadeCurrentStateEvidenceError(
      errors.some((error) => error.includes("hash mismatch")) ? "evidence_contract_identity_mismatch" : "policy_evidence_acquisition_failed",
      "evidence_snapshot_validation",
      errors
    );
  }
}

function evidenceRecordHasCurrentAuthority(record) {
  if (record.parse_status !== "parsed" && record.parse_status !== "not_applicable") return false;
  if (["deprecated", "superseded", "future", "planned"].includes(record.declared_status)) return false;
  return record.existence_status === "exists" && record.read_status === "read" && typeof record.sha256 === "string";
}

function runtimeStateFromEvidence(policy, snapshot) {
  const records = sourceRecordById(snapshot);
  const mapping = {
    user_workspace_input: ["public_surface_execution_audit", "readme_static_surface_record"],
    Facade: ["public_surface_execution_audit", "readme_static_surface_record"],
    Conduit: ["conduit_binding_manifest", "conduit_governed_invocation_module", "conduit_current_state_acquisition_module"],
    Palisade_policy_decision: [
      "palisade_claim_capability_policy",
      "palisade_policy_bundle_manifest",
      "palisade_policy_input_schema",
      "palisade_policy_decision_schema",
      "palisade_current_state_constructor_module"
    ],
    Vault_NEXUS_evaluation: ["nexus_adapter_readiness"],
    evidence_audit_record: ["operational_evidence_packet_contract"],
    release_state_decision: ["product_negative_space_backlog"],
    surfaced_result: ["public_surface_execution_audit", "readme_static_surface_record"]
  };

  return Object.fromEntries(
    policy.runtime_governance_path.ordered_components.map((component) => {
      const sourceIds = mapping[component] || [];
      const sourceRecords = sourceIds.map((sourceId) => records.get(sourceId)).filter(Boolean);
      const evidence = sourceEvidence(records, sourceIds);
      const hasEvidence = sourceRecords.some(evidenceRecordHasCurrentAuthority);
      let state = hasEvidence ? "partial" : "absent";

      if (
        component === "Palisade_policy_decision" &&
        sourceRecords.every(evidenceRecordHasCurrentAuthority) &&
        records.get("palisade_claim_capability_policy")?.parsed_facts?.owner === "Palisade"
      ) {
        state = "exists";
      }
      if (
        component === "Conduit" &&
        sourceRecords.every(evidenceRecordHasCurrentAuthority) &&
        records.get("conduit_binding_manifest")?.parsed_facts?.canonical_internal_export ===
          "conduit/runtime/v0/index.mjs#invokeGovernedConduitAction"
      ) {
        state = "exists";
      }
      if (component === "Vault_NEXUS_evaluation") state = "stubbed";
      if (component === "release_state_decision") state = "absent";
      if (!currentEvidenceStateVocabulary.has(state)) state = "unverified";
      return [component, componentState(state, evidence)];
    })
  );
}

function productionStateFromEvidence(policy, snapshot) {
  const records = sourceRecordById(snapshot);
  const mapping = {
    real_authenticated_shell: ["readme_static_surface_record"],
    applied_live_workspace_data_model: ["interface_contract_v1"],
    server_side_authorization: ["interface_contract_v1"],
    tenant_scoped_persistence: ["interface_contract_v1"],
    verified_membership_account_separation: ["interface_contract_v1"],
    operational_workspace_surfaces_backed_by_capability: ["public_surface_execution_audit"],
    durable_evidence_audit_trail: ["operational_evidence_packet_contract"],
    runtime_governance_path_for_real_user_workspace_input: ["palisade_runtime_manifest", "conduit_binding_manifest"]
  };

  return Object.fromEntries(
    policy.production_workspace_threshold.required_components.map((component) => {
      const sourceIds = mapping[component] || [];
      const sourceRecords = sourceIds.map((sourceId) => records.get(sourceId)).filter(Boolean);
      const state = sourceRecords.some(evidenceRecordHasCurrentAuthority) ? "partial" : "absent";
      return [component, componentState(state, sourceEvidence(records, sourceIds))];
    })
  );
}

function constructNoWitnessAuthorization(policyRule) {
  return {
    status: "not_requested",
    review_required: policyRule?.operator_review_gate === true,
    review_reason: policyRule?.operator_review_gate === true ? noTrustedAuthorizerSource : "",
    positive_witness: "absent",
    verified: false,
    source: noTrustedAuthorizerSource,
    provenance: "canonical_invocation_no_witness"
  };
}

function validateTestOnlyWitness(witness, envelope) {
  if (witness == null) return null;
  const errors = [];
  if (!isObject(witness)) errors.push("test-only authorization witness must be an object");
  for (const [field, expected] of [
    ["request_id", envelope.request_id],
    ["trace_id", envelope.trace_id],
    ["correlation_id", envelope.correlation_id],
    ["surface", canonicalSurface],
    ["claim_id", canonicalClaimId],
    ["requested_action", canonicalRequestedAction]
  ]) {
    if (witness?.[field] !== expected) errors.push(`test witness ${field} mismatch`);
  }
  if (witness?.witness_version !== "test-only.v0") errors.push("test witness version mismatch");
  if (witness?.authorization_scope !== "test_only_runtime_governance_path_sufficiency") {
    errors.push("test witness scope mismatch");
  }
  if (witness?.authorization_status !== "approved") errors.push("test witness must be approved");
  if (witness?.provenance !== "explicit_test_only_harness") errors.push("test witness provenance mismatch");
  if (errors.length > 0) {
    throw new PalisadeCurrentStateEvidenceError("authorization_witness_invalid", "authorization_witness_validation", errors);
  }
  return {
    status: "approved",
    review_required: false,
    review_reason: "test-only witness approved for structural allow reachability",
    positive_witness: "present",
    verified: true,
    source: "explicit_test_only_harness",
    provenance: "explicit_test_only_harness"
  };
}

function basisFromSnapshot(plan, snapshot) {
  return [
    `evidence_contract:${plan.contract_id}@${plan.contract_version}:${plan.contract_sha256}`,
    `acquisition_plan:${plan.acquisition_plan_hash}`,
    `evidence_snapshot:${snapshot.snapshot_hash}`,
    ...snapshot.records.map((record) =>
      `source:${record.source_id}:${record.repository_path}:sha256=${record.sha256}:parse=${record.parse_status}:status=${record.declared_status || "unspecified"}`
    )
  ];
}

export function constructCurrentStatePolicyInput({
  envelope,
  acquisitionPlan,
  evidenceSnapshot,
  authorizationWitness = null,
  repoRoot = palisadeRepositoryRoot()
}) {
  const { plan, artifacts } = resolveCanonicalPalisadeRuntime({ repoRoot, envelope });
  if (stableCanonicalJson(plan) !== stableCanonicalJson(acquisitionPlan)) {
    throw new PalisadeCurrentStateEvidenceError("acquisition_plan_mismatch", "acquisition_plan_validation", [
      "Palisade acquisition plan and supplied acquisition plan differ"
    ]);
  }
  validateSnapshotAgainstPlan(evidenceSnapshot, plan);

  const policy = artifacts.policy;
  const policyRule = (policy.rules || []).find((rule) => rule.claim_id === canonicalClaimId);
  const runtimeState = runtimeStateFromEvidence(policy, evidenceSnapshot);
  const productionState = productionStateFromEvidence(policy, evidenceSnapshot);
  const runtimeMissing = missingComponents(runtimeState, policy.runtime_governance_path.ordered_components);
  const productionMissing = missingComponents(productionState, policy.production_workspace_threshold.required_components);
  const authorizationState = validateTestOnlyWitness(authorizationWitness, envelope) || constructNoWitnessAuthorization(policyRule);
  const currentStateBasis = basisFromSnapshot(plan, evidenceSnapshot);
  const deniedClaims = [];

  if (policy.runtime_enforcement?.current_status === "unavailable") {
    deniedClaims.push("runtime_enforcement");
  }

  const policyInput = {
    surface: canonicalSurface,
    claim_id: canonicalClaimId,
    requested_action: canonicalRequestedAction,
    evidence_state: {
      current_evidence: evidenceSnapshot.records.map((record) => `${record.source_id}:${record.sha256}`),
      missing_evidence: Array.from(new Set([...runtimeMissing, ...productionMissing])),
      required_evidence: ["runtime_governance_path"],
      denied_claims: deniedClaims,
      evidence_notes: [
        "Constructed by Palisade from Conduit-acquired repository evidence.",
        "Evidence contract authorizes acquisition but does not self-certify sufficiency."
      ]
    },
    production_workspace_threshold_state: productionState,
    runtime_governance_path_state: runtimeState,
    operator_authorization_state: authorizationState,
    current_repository_state_basis: currentStateBasis
  };

  const construction = {
    construction_version: currentStateConstructionVersion,
    contract_id: plan.contract_id,
    contract_version: plan.contract_version,
    contract_path: plan.contract_path,
    contract_sha256: plan.contract_sha256,
    acquisition_plan_hash: plan.acquisition_plan_hash,
    source_plan_projection_hash: plan.source_plan_projection_hash,
    evidence_snapshot_hash: evidenceSnapshot.snapshot_hash,
    current_state_basis_hash: deterministicHash(currentStateBasis),
    policy_input_hash: deterministicHash(policyInput),
    authorization_state_hash: deterministicHash(authorizationState),
    policy_input: policyInput,
    acquisition_plan: plan,
    evidence_snapshot: clone(evidenceSnapshot),
    canonical_versions: {
      contract_version: plan.canonical_contract_version,
      policy_version: plan.canonical_policy_version
    },
    canonical_tuple: {
      surface: canonicalSurface,
      claim_id: canonicalClaimId,
      requested_action: canonicalRequestedAction
    }
  };
  return construction;
}

export function annotateDecisionWithCurrentStateBinding(decision, construction) {
  return {
    ...decision,
    evidence_contract_id: construction.contract_id,
    evidence_contract_version: construction.contract_version,
    evidence_contract_sha256: construction.contract_sha256,
    acquisition_plan_hash: construction.acquisition_plan_hash,
    evidence_snapshot_hash: construction.evidence_snapshot_hash,
    current_state_basis_hash: construction.current_state_basis_hash,
    policy_input_hash: construction.policy_input_hash,
    authorization_state_hash: construction.authorization_state_hash
  };
}

export function makeTestOnlyCompleteEvidenceSnapshot({ acquisitionPlan }) {
  const records = acquisitionPlan.source_plan.map((source) => ({
    source_id: source.source_id,
    repository_path: source.repository_path,
    owning_layer: source.owning_layer,
    artifact_class: source.artifact_class,
    authority_classification: source.authority_classification,
    evidence_meaning: source.evidence_meaning,
    update_mechanism: source.update_mechanism,
    required_acquisition: source.required_acquisition,
    parser_expectation: source.parser_expectation,
    existence_status: "exists",
    read_status: "read",
    parse_status: source.parser_expectation === "json" ? "parsed" : "not_applicable",
    declared_version: "test-only.complete-evidence",
    declared_status: "test_only_complete",
    byte_count: 1,
    sha256: sha256Text(`test-only:${source.source_id}`),
    acquisition_version: "test-only.v0",
    provenance: source.provenance,
    parsed_facts: {
      owner: source.owning_layer,
      status: "test_only_complete",
      canonical_internal_export: "conduit/runtime/v0/index.mjs#invokeGovernedConduitAction"
    },
    error_classification: null
  }));
  return {
    snapshot_version: "test-only.v0",
    contract_id: acquisitionPlan.contract_id,
    contract_version: acquisitionPlan.contract_version,
    contract_path: acquisitionPlan.contract_path,
    contract_sha256: acquisitionPlan.contract_sha256,
    acquisition_plan_hash: acquisitionPlan.acquisition_plan_hash,
    source_plan_projection_hash: acquisitionPlan.source_plan_projection_hash,
    records,
    snapshot_hash: deterministicHash({
      contract_id: acquisitionPlan.contract_id,
      contract_version: acquisitionPlan.contract_version,
      contract_path: acquisitionPlan.contract_path,
      contract_sha256: acquisitionPlan.contract_sha256,
      acquisition_plan_hash: acquisitionPlan.acquisition_plan_hash,
      source_plan_projection_hash: acquisitionPlan.source_plan_projection_hash,
      records
    })
  };
}

export function completeRuntimeStateForTestOnly(policy, evidenceSnapshot) {
  const records = sourceRecordById(evidenceSnapshot);
  return Object.fromEntries(
    policy.runtime_governance_path.ordered_components.map((component) => [
      component,
      componentState("exists", [`test_only_complete:${component}`, ...sourceEvidence(records, [])])
    ])
  );
}

export function completeProductionStateForTestOnly(policy) {
  return Object.fromEntries(
    policy.production_workspace_threshold.required_components.map((component) => [
      component,
      componentState("exists", [`test_only_complete:${component}`])
    ])
  );
}

export function constructTestOnlyCompletePolicyInput({
  envelope,
  acquisitionPlan,
  evidenceSnapshot,
  authorizationWitness,
  repoRoot = palisadeRepositoryRoot()
}) {
  const construction = constructCurrentStatePolicyInput({
    envelope,
    acquisitionPlan,
    evidenceSnapshot,
    authorizationWitness,
    repoRoot
  });
  const { policy } = loadCanonicalPalisadeArtifacts(repoRoot);
  const policyInput = {
    ...construction.policy_input,
    evidence_state: {
      current_evidence: evidenceSnapshot.records.map((record) => `test_only_complete:${record.source_id}:${record.sha256}`),
      missing_evidence: [],
      required_evidence: ["runtime_governance_path"],
      denied_claims: [],
      evidence_notes: [
        "Explicit test-only complete-evidence fixture.",
        "This fixture is not current repository evidence and is unreachable through the canonical export."
      ]
    },
    production_workspace_threshold_state: completeProductionStateForTestOnly(policy),
    runtime_governance_path_state: completeRuntimeStateForTestOnly(policy, evidenceSnapshot),
    current_repository_state_basis: [
      ...construction.policy_input.current_repository_state_basis,
      "test_only_complete_evidence_fixture:not_current_repository_state"
    ]
  };
  return {
    ...construction,
    policy_input: policyInput,
    current_state_basis_hash: deterministicHash(policyInput.current_repository_state_basis),
    policy_input_hash: deterministicHash(policyInput)
  };
}

export function evidenceRecordFacts(parsed) {
  return {
    owner: parsed?.owner || parsed?.metadata?.owner || null,
    version: recordDeclaredVersion(parsed),
    status: recordDeclaredStatus(parsed),
    canonical_internal_export: parsed?.canonical_internal_export || null,
    selected_palisade_claim_id: parsed?.selected_palisade_claim_id || null,
    selected_requested_action: parsed?.selected_requested_action || null
  };
}
