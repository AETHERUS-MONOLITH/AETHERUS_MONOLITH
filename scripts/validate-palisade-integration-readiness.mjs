import fs from "node:fs";

const mapPath = "palisade/policy-bundle.v0/integration-readiness.v0.json";
const expectedBaseline = "1fdb76258cee0fde22c20320b6d047e872b9f6f7";

const requiredTopLevelFields = [
  "map_id",
  "baseline_commit",
  "policy_bundle_reference",
  "current_palisade_state",
  "non_claims",
  "candidate_consumers",
  "consumer_priority_order",
  "consumer_contract_requirements",
  "blocked_consumers",
  "first_recommended_consumer",
  "required_next_pass",
  "implementation_risks",
  "claim_boundary_preservation",
  "runtime_enforcement_boundary",
  "evidence_required_before_runtime_enforcement",
  "runtime_governance_path_assessment",
  "production_workspace_threshold_relevance"
];

const requiredCandidateFields = [
  "consumer_id",
  "consumer_type",
  "current_consumption_state",
  "current_location",
  "boundary_logic_currently_lives_in",
  "policy_decisions_needed",
  "required_input_mapping",
  "required_decision_mapping",
  "implementation_preconditions",
  "forbidden_overclaims",
  "risk_if_integrated_now",
  "recommended_timing",
  "classification",
  "rationale"
];

const requiredConsumerIds = [
  "palisade_policy_bundle_validator",
  "public_surface_execution_audit_validator",
  "product_language_boundary_validator",
  "readme_current_state_truth_validator",
  "documentation_surface_inventory_validator",
  "operational_evidence_packet_contract_validator",
  "direct_ui_protected_workspace_validators",
  "public_surface_state_data",
  "claim_language_checks",
  "conduit_contracts",
  "future_runtime_release_state_decision_path",
  "future_weave_orchestration_path"
];

const requiredConsumerTypes = [
  "validator",
  "public_surface_state",
  "claim_language",
  "repository_contract",
  "conduit_contract",
  "runtime_candidate",
  "orchestration_candidate"
];

const allowedConsumptionStates = new Set([
  "none",
  "indirectly_aligned",
  "structurally_ready",
  "blocked",
  "should_not_consume_yet"
]);

const allowedBoundaryHomes = new Set([
  "copy",
  "validator",
  "static_data",
  "fixture",
  "handoff_constraint",
  "Palisade_policy",
  "repository_contract",
  "unknown"
]);

const allowedTimings = new Set([
  "immediate_next_pass",
  "after_contract_alignment",
  "after_runtime_path_exists",
  "not_until_operator_authorized"
]);

const allowedClassifications = new Set([
  "disciplined_staging",
  "implementation_ready",
  "blocked",
  "evasive_if_pursued_now"
]);

const requiredInputFields = [
  "surface",
  "claim_id",
  "requested_action",
  "evidence_state",
  "production_workspace_threshold_state",
  "runtime_governance_path_state",
  "operator_authorization_state",
  "current_repository_state_basis"
];

const requiredDecisionFields = [
  "decision",
  "allowed",
  "reasons",
  "required_evidence",
  "missing_evidence",
  "operator_review_required",
  "runtime_enforcement_status",
  "next_evidence_threshold"
];

const runtimePathComponents = [
  "user_workspace_input",
  "Facade",
  "Conduit",
  "Palisade_policy_decision",
  "Vault_NEXUS_evaluation",
  "evidence_audit_record",
  "release_state_decision",
  "surfaced_result"
];

const productionWorkspaceConditions = [
  "real_authenticated_shell",
  "applied_live_workspace_data_model",
  "server_side_authorization",
  "tenant_scoped_persistence",
  "verified_membership_account_separation",
  "operational_workspace_surfaces_backed_by_capability",
  "durable_evidence_audit_trail",
  "runtime_governance_path_for_real_user_workspace_input"
];

const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
    return false;
  }
  return true;
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`);
    return false;
  }
  return true;
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label} must be a non-empty string`);
    return false;
  }
  return true;
}

function assertIncludesAll(actual, required, label) {
  if (!assertArray(actual, label)) return;
  for (const item of required) {
    if (!actual.includes(item)) fail(`${label} missing ${item}`);
  }
}

function uniqueValues(items, field) {
  return new Set(items.map((item) => item && item[field]).filter(Boolean));
}

if (!fs.existsSync(mapPath)) {
  fail(`${mapPath} is missing`);
}

if (failures.length === 0) {
  const rawText = fs.readFileSync(mapPath, "utf8");
  if (/\blater\b/i.test(rawText)) {
    fail(`${mapPath}: "later" must not be used as a substitute for concrete preconditions`);
  }
  if (/\bminimal\b/i.test(rawText)) {
    fail(`${mapPath}: rejected Palisade construction term appears`);
  }
  if (/\b(runtime_enforcement_implemented|deployed_enforcement_membrane_exists|production_workspace_maturity_exists|public_nexus_runtime_execution_exists|model_api_execution_exists)\s*:\s*true\b/i.test(rawText)) {
    fail(`${mapPath}: map claims a forbidden operational state exists`);
  }

  const map = readJson(mapPath);
  assertObject(map, mapPath);

  for (const field of requiredTopLevelFields) {
    if (!(field in map)) fail(`${mapPath}: missing top-level field ${field}`);
  }

  if (map.baseline_commit !== expectedBaseline) {
    fail(`${mapPath}: baseline_commit must be ${expectedBaseline}`);
  }

  const currentState = map.current_palisade_state || {};
  for (const falseField of [
    "deployed_enforcement_membrane_exists",
    "runtime_policy_engine_exists",
    "production_policy_service_exists",
    "public_runtime_gate_exists",
    "operational_enforcement_layer_exists"
  ]) {
    if (currentState[falseField] !== false) {
      fail(`${mapPath}: current_palisade_state.${falseField} must be false`);
    }
  }

  const runtimeBoundary = map.runtime_enforcement_boundary || {};
  for (const falseField of [
    "runtime_enforcement_implemented",
    "deployed_enforcement_membrane_exists",
    "public_runtime_gate_exists",
    "policy_service_exists",
    "validator_consumption_is_runtime_enforcement"
  ]) {
    if (runtimeBoundary[falseField] !== false) {
      fail(`${mapPath}: runtime_enforcement_boundary.${falseField} must be false`);
    }
  }

  assertArray(map.non_claims, `${mapPath}.non_claims`);
  assertArray(map.candidate_consumers, `${mapPath}.candidate_consumers`);
  const candidateIds = uniqueValues(map.candidate_consumers || [], "consumer_id");
  for (const id of requiredConsumerIds) {
    if (!candidateIds.has(id)) fail(`${mapPath}: missing candidate consumer ${id}`);
  }

  const candidateTypes = uniqueValues(map.candidate_consumers || [], "consumer_type");
  for (const type of requiredConsumerTypes) {
    if (!candidateTypes.has(type)) fail(`${mapPath}: missing candidate consumer type ${type}`);
  }

  for (const [index, consumer] of (map.candidate_consumers || []).entries()) {
    const label = `${mapPath}.candidate_consumers[${index}]`;
    if (!assertObject(consumer, label)) continue;
    for (const field of requiredCandidateFields) {
      if (!(field in consumer)) fail(`${label}: missing ${field}`);
    }
    if (!requiredConsumerTypes.includes(consumer.consumer_type)) {
      fail(`${consumer.consumer_id}: invalid consumer_type ${consumer.consumer_type}`);
    }
    if (!allowedConsumptionStates.has(consumer.current_consumption_state)) {
      fail(`${consumer.consumer_id}: invalid current_consumption_state`);
    }
    assertString(consumer.current_location, `${consumer.consumer_id}.current_location`);
    if (assertArray(consumer.boundary_logic_currently_lives_in, `${consumer.consumer_id}.boundary_logic_currently_lives_in`)) {
      for (const home of consumer.boundary_logic_currently_lives_in) {
        if (!allowedBoundaryHomes.has(home)) {
          fail(`${consumer.consumer_id}: invalid boundary_logic_currently_lives_in value ${home}`);
        }
      }
    }
    assertArray(consumer.policy_decisions_needed, `${consumer.consumer_id}.policy_decisions_needed`);
    assertObject(consumer.required_input_mapping, `${consumer.consumer_id}.required_input_mapping`);
    assertObject(consumer.required_decision_mapping, `${consumer.consumer_id}.required_decision_mapping`);
    assertArray(consumer.implementation_preconditions, `${consumer.consumer_id}.implementation_preconditions`);
    assertArray(consumer.forbidden_overclaims, `${consumer.consumer_id}.forbidden_overclaims`);
    assertString(consumer.risk_if_integrated_now, `${consumer.consumer_id}.risk_if_integrated_now`);
    if (!allowedTimings.has(consumer.recommended_timing)) {
      fail(`${consumer.consumer_id}: invalid recommended_timing`);
    }
    if (!allowedClassifications.has(consumer.classification)) {
      fail(`${consumer.consumer_id}: invalid classification`);
    }
    assertString(consumer.rationale, `${consumer.consumer_id}.rationale`);
  }

  const first = map.first_recommended_consumer || {};
  if (!assertObject(first, `${mapPath}.first_recommended_consumer`)) {
    fail(`${mapPath}: first_recommended_consumer is missing`);
  } else {
    if (first.consumer_id !== "product_language_boundary_validator") {
      fail(`${mapPath}: first_recommended_consumer must be product_language_boundary_validator`);
    }
    if (first.can_be_implementation_pass_immediately_after_this_one !== true) {
      fail(`${mapPath}: first_recommended_consumer must be immediately implementable`);
    }
    if (first.no_intervening_map_or_readiness_pass_required !== true) {
      fail(`${mapPath}: first_recommended_consumer must not require another map or readiness pass`);
    }
    if (!assertArray(first.connects_within_next_two_to_three_passes, `${mapPath}.first_recommended_consumer.connects_within_next_two_to_three_passes`) || first.connects_within_next_two_to_three_passes.length === 0) {
      fail(`${mapPath}: first consumer must connect to a concrete two-to-three-pass path`);
    }
    const contract = first.bounded_next_pass_contract || {};
    if (!assertObject(contract, `${mapPath}.first_recommended_consumer.bounded_next_pass_contract`)) {
      fail(`${mapPath}: first consumer lacks a bounded next-pass contract`);
    } else {
      if (contract.source_policy_bundle_path !== "palisade/policy-bundle.v0/") {
        fail(`${mapPath}: bounded contract must reference palisade/policy-bundle.v0/`);
      }
      assertIncludesAll(
        contract.policy_input_fields_consumed,
        requiredInputFields,
        `${mapPath}.first_recommended_consumer.bounded_next_pass_contract.policy_input_fields_consumed`
      );
      assertIncludesAll(
        contract.decision_fields_consumed,
        requiredDecisionFields,
        `${mapPath}.first_recommended_consumer.bounded_next_pass_contract.decision_fields_consumed`
      );
      for (const field of [
        "required_evidence_handling",
        "missing_evidence_handling",
        "operator_review_required_handling",
        "runtime_enforcement_status_handling",
        "fail_closed_behavior",
        "no_overclaim_behavior",
        "validation_command_that_must_pass_after_integration"
      ]) {
        assertString(contract[field], `${mapPath}.first_recommended_consumer.bounded_next_pass_contract.${field}`);
      }
    }
  }

  const requiredNextPass = map.required_next_pass || {};
  assertObject(requiredNextPass, `${mapPath}.required_next_pass`);
  if (requiredNextPass.type !== "implementation") {
    fail(`${mapPath}: required_next_pass.type must be implementation`);
  }
  const nextPassText = JSON.stringify(requiredNextPass);
  if (/\b(mapping|readiness|boundary-analysis)\s+pass\b/i.test(requiredNextPass.name || "")) {
    fail(`${mapPath}: required_next_pass must not recommend another mapping, readiness, or boundary-analysis pass`);
  }
  if (!/product-language validator/i.test(nextPassText)) {
    fail(`${mapPath}: required_next_pass must target the selected first consumer path`);
  }

  const contractRequirements = map.consumer_contract_requirements?.product_language_boundary_validator;
  if (!assertObject(contractRequirements, `${mapPath}.consumer_contract_requirements.product_language_boundary_validator`)) {
    fail(`${mapPath}: missing first-consumer contract requirements`);
  } else {
    assertIncludesAll(
      contractRequirements.policy_input_fields_consumed,
      requiredInputFields,
      `${mapPath}.consumer_contract_requirements.product_language_boundary_validator.policy_input_fields_consumed`
    );
    assertIncludesAll(
      contractRequirements.decision_fields_consumed,
      requiredDecisionFields,
      `${mapPath}.consumer_contract_requirements.product_language_boundary_validator.decision_fields_consumed`
    );
  }

  if (!assertArray(map.blocked_consumers, `${mapPath}.blocked_consumers`) || map.blocked_consumers.length === 0) {
    fail(`${mapPath}: blocked_consumers must list blocked paths and reasons`);
  }

  const pathAssessment = map.runtime_governance_path_assessment || {};
  if (pathAssessment.operational !== false) {
    fail(`${mapPath}: runtime_governance_path_assessment.operational must be false`);
  }
  const assessedComponents = new Set((pathAssessment.components || []).map((item) => item && item.component));
  for (const component of runtimePathComponents) {
    if (!assessedComponents.has(component)) {
      fail(`${mapPath}: runtime governance path assessment missing ${component}`);
    }
  }
  if (pathAssessment.sufficiency !== "not_sufficient") {
    fail(`${mapPath}: runtime governance path must not be marked sufficient`);
  }

  const threshold = map.production_workspace_threshold_relevance || {};
  const thresholdConditions = new Set((threshold.conditions || []).map((item) => item && item.condition));
  for (const condition of productionWorkspaceConditions) {
    if (!thresholdConditions.has(condition)) {
      fail(`${mapPath}: production workspace threshold relevance missing ${condition}`);
    }
  }

  const blockedRuntimeConsumers = new Set((map.blocked_consumers || []).map((item) => item && item.consumer_id));
  for (const id of ["future_runtime_release_state_decision_path", "future_weave_orchestration_path"]) {
    if (!blockedRuntimeConsumers.has(id)) {
      fail(`${mapPath}: ${id} must be blocked`);
    }
  }

  const firstConsumer = (map.candidate_consumers || []).find(
    (consumer) => consumer.consumer_id === first.consumer_id
  );
  if (!firstConsumer) {
    fail(`${mapPath}: first recommended consumer must exist in candidate_consumers`);
  } else {
    if (firstConsumer.recommended_timing !== "immediate_next_pass") {
      fail(`${firstConsumer.consumer_id}: recommended_timing must be immediate_next_pass`);
    }
    if (firstConsumer.classification !== "implementation_ready") {
      fail(`${firstConsumer.consumer_id}: classification must be implementation_ready`);
    }
  }

  const forbiddenFirstConsumerPattern = /\b(conduit|vault|runtime|weave)\b/i;
  if (forbiddenFirstConsumerPattern.test(first.consumer_id || "")) {
    fail(`${mapPath}: Conduit, Vault, runtime, or Weave cannot be the first consumer without explicit Operator authorization`);
  }
}

if (failures.length) {
  console.error("Palisade integration readiness validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Palisade integration readiness map ok");
console.log(`Validated ${mapPath}`);
