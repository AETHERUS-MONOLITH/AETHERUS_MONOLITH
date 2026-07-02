import fs from "node:fs";
import {
  allowedPalisadeDecisions,
  buildPolicyInput,
  decisionShapeErrors,
  evaluatePalisadeDecision,
  palisadeDecisionSchemaPath,
  palisadeInputSchemaPath,
  palisadeManifestPath,
  palisadePolicyPath
} from "./palisade-policy-consumption.mjs";

const contractPath = "data/operational-evidence-packet-contract.v0.json";
const negativeSpaceBacklogPath = "data/product-negative-space-backlog.v0.json";
const operationalConsumerContractPath = "palisade/policy-bundle.v0/consumers/operational-evidence-packet-contract-consumer.v0.json";
const palisadeBundlePath = "palisade/policy-bundle.v0/";
const integrationReadinessPath = "palisade/policy-bundle.v0/integration-readiness.v0.json";
const policyCasesPath = "palisade/policy-bundle.v0/tests/claim-capability-policy.cases.json";

const requiredTopLevelFields = [
  "contract_id",
  "version",
  "status",
  "purpose",
  "current_claim_status",
  "operational_use_threshold_status",
  "required_evidence_classes",
  "claim_gates",
  "disallowed_claims_until_threshold_met",
  "relationship_to_product_negative_space_backlog",
  "validation_requirements",
  "non_implementation_boundary"
];

const requiredStatuses = {
  status: "contract_defined",
  operational_use_threshold_status: "threshold_not_met",
  current_claim_status: "operational_use_not_currently_claimable"
};

const requiredEvidenceClassIds = [
  "real_input_output_artifact",
  "input_hash",
  "output_hash",
  "artifact_hash_binding",
  "persistent_trace_storage",
  "append_only_ledger_semantics",
  "hash_chain_verification",
  "backend_validation",
  "authenticated_actor_identity",
  "actor_to_trace_attribution",
  "reproducible_execution_log",
  "deterministic_run_record",
  "test_result_artifact",
  "validator_report_artifact",
  "security_review_record",
  "retention_model",
  "runtime_execution_boundary",
  "escalation_or_freeze_record",
  "release_decision_record"
];

const allowedNonCompleteStatuses = new Set([
  "not_attached",
  "not_implemented",
  "required_for_future_threshold"
]);

const requiredEvidenceFields = [
  "id",
  "description",
  "source_from_negative_space_backlog",
  "required_for_operational_use",
  "current_status",
  "build_dependency",
  "claim_effect_if_missing"
];

const requiredClaimGateIds = [
  "current_staged_product_surface_allowed",
  "current_deterministic_interface_and_requirements_allowed",
  "operational_deployment_disallowed",
  "live_ai_execution_disallowed",
  "persistent_production_audit_ledger_disallowed",
  "backend_validated_operational_governance_disallowed",
  "customer_tenant_production_saas_disallowed",
  "future_operational_use_threshold_allowed"
];

const requiredDisallowedClaims = [
  "operational deployment",
  "live AI execution",
  "persistent production audit ledger",
  "backend-validated operational governance",
  "customer workspace",
  "tenant isolation",
  "production SaaS"
];

const nonImplementationFalseFields = [
  "backend_implementation",
  "database_implementation",
  "persistence_implementation",
  "ledger_implementation",
  "auth_behavior_change",
  "runtime_execution",
  "model_api_call",
  "public_nexus_execution",
  "palisade_or_weave_implementation",
  "billing",
  "monitoring_dashboard",
  "tenant_isolation",
  "customer_workspace",
  "production_saas",
  "operational_use_claim"
];

const requiredOperationalConsumerFields = [
  "consumer_id",
  "consumer_path",
  "consumer_type",
  "governed_surface",
  "source_policy_bundle",
  "policy_file",
  "policy_input_schema",
  "policy_decision_schema",
  "operational_evidence_contract",
  "consumed_policy_decisions",
  "evidence_class_mappings",
  "claim_to_evidence_threshold_mappings",
  "required_policy_input_fields",
  "required_policy_decision_fields",
  "current_evidence_sources",
  "evidence_state_normalization",
  "evidence_completeness_rules",
  "evidence_verification_rules",
  "evidence_applicability_rules",
  "contradiction_handling",
  "stale_evidence_handling",
  "fail_closed_behavior",
  "no_overclaim_behavior",
  "operator_review_handling",
  "runtime_enforcement_status_handling",
  "release_authority_handling",
  "hypothetical_fixture_boundary",
  "preserved_existing_checks",
  "forbidden_inferences",
  "non_claims",
  "next_integration_boundary"
];

const requiredGovernedEvidenceClasses = [
  "production_workspace_maturity",
  "authenticated_workspace_availability",
  "applied_live_workspace_data_model",
  "server_side_authorization",
  "rls_or_equivalent_authorization_enforcement",
  "tenant_scoped_persistence",
  "membership_account_separation",
  "runtime_governance_path_sufficiency",
  "palisade_policy_decision_availability",
  "conduit_contract_or_execution_readiness",
  "vault_nexus_evaluation_availability",
  "durable_evidence_audit_record_capability",
  "release_state_decision_capability",
  "operational_release_authority",
  "operator_review_escalation",
  "public_nexus_runtime_execution",
  "model_api_execution",
  "deployed_palisade_runtime_enforcement",
  "weave_orchestration_availability",
  "bounded_repository_evidence_classification",
  "evidence_packet_completeness_vs_operational_verification"
];

const requiredThresholdClaimClasses = [
  "production_workspace_maturity",
  "runtime_governance_path_sufficiency",
  "operational_release_authority",
  "public_nexus_runtime_execution",
  "model_api_execution",
  "repository_owned_contract_classification"
];

const capabilityBlockDecisions = new Set([
  "deny",
  "requires_evidence",
  "requires_operator_review",
  "runtime_enforcement_unavailable"
]);

const classificationEvidenceClasses = new Set([
  "bounded_repository_evidence_classification",
  "palisade_policy_decision_availability"
]);

const failures = [];

function fail(message) {
  failures.push(message);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`);
    return [];
  }
  return value;
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
    return null;
  }
  return value;
}

function assertIncludesAll(actual, required, label) {
  const actualArray = requireArray(actual, label);
  for (const item of required) {
    if (!actualArray.includes(item)) fail(`${label} missing ${item}`);
  }
}

function fieldExists(value, fieldPath) {
  return fieldPath.split(".").every((part) => {
    if (!value || typeof value !== "object") return false;
    value = value[part];
    return value !== undefined;
  });
}

function assertFalse(value, fieldPath, label) {
  if (!fieldExists(value, fieldPath)) {
    fail(`${label}: missing evidence field ${fieldPath}`);
    return;
  }
  const actual = fieldPath.split(".").reduce((current, part) => current?.[part], value);
  if (actual !== false) fail(`${label}: ${fieldPath} must remain false`);
}

function assertTrue(value, fieldPath, label) {
  if (!fieldExists(value, fieldPath)) {
    fail(`${label}: missing evidence field ${fieldPath}`);
    return;
  }
  const actual = fieldPath.split(".").reduce((current, part) => current?.[part], value);
  if (actual !== true) fail(`${label}: ${fieldPath} must remain true`);
}

function assertDecisionShape(decision, requiredFields) {
  decisionShapeErrors(decision, requiredFields).forEach((error) => fail(`${operationalConsumerContractPath}: ${error}`));
}

function buildEvidenceById(contract) {
  const evidenceById = new Map();
  const evidenceClasses = requireArray(contract.required_evidence_classes, "required_evidence_classes");

  for (const item of evidenceClasses) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      fail("each evidence class must be an object");
      continue;
    }
    for (const field of requiredEvidenceFields) {
      if (!(field in item)) fail(`${item.id || "unknown evidence class"} missing ${field}`);
    }
    if (evidenceById.has(item.id)) fail(`duplicate evidence class: ${item.id}`);
    evidenceById.set(item.id, item);

    if (item.required_for_operational_use !== true) {
      fail(`${item.id}: required_for_operational_use must be true`);
    }
    if (!allowedNonCompleteStatuses.has(item.current_status)) {
      fail(`${item.id}: current_status must be a non-complete threshold status`);
    }
    if (!Array.isArray(item.source_from_negative_space_backlog) || item.source_from_negative_space_backlog.length === 0) {
      fail(`${item.id}: source_from_negative_space_backlog must list at least one source phrase`);
    }
    if (!Array.isArray(item.build_dependency) || item.build_dependency.length === 0) {
      fail(`${item.id}: build_dependency must list at least one construction dependency`);
    }
    if (/evidence currently exists|currently operational|already implemented|already attached|already validated/i.test(item.description || "")) {
      fail(`${item.id}: description suggests current operational evidence exists`);
    }
  }

  for (const id of requiredEvidenceClassIds) {
    if (!evidenceById.has(id)) fail(`missing required evidence class: ${id}`);
  }

  return evidenceById;
}

function validateExistingContractShape(contract, negativeSpaceBacklog) {
  for (const field of requiredTopLevelFields) {
    if (!(field in contract)) fail(`missing top-level field: ${field}`);
  }

  for (const [field, expected] of Object.entries(requiredStatuses)) {
    if (contract[field] !== expected) {
      fail(`${field} must be ${expected}`);
    }
  }

  if (/operational_use_currently_claimable|operational_use_claimed|operationally_deployed|current_operational_use/i.test(contract.current_claim_status || "")) {
    fail("current_claim_status implies current operational use");
  }

  const evidenceById = buildEvidenceById(contract);

  const negativeSpacePhrases = new Set(
    (Array.isArray(negativeSpaceBacklog.mappings) ? negativeSpaceBacklog.mappings : [])
      .map((mapping) => normalize(mapping.source_phrase))
  );

  for (const item of evidenceById.values()) {
    const sourcePhrases = Array.isArray(item.source_from_negative_space_backlog)
      ? item.source_from_negative_space_backlog
      : [];
    for (const phrase of sourcePhrases) {
      if (!negativeSpacePhrases.has(normalize(phrase))) {
        fail(`${item.id}: source phrase "${phrase}" is not present in ${negativeSpaceBacklogPath}`);
      }
    }
  }

  const claimGates = requireArray(contract.claim_gates, "claim_gates");
  const claimGateIds = new Set(claimGates.map((gate) => gate && gate.id));
  for (const id of requiredClaimGateIds) {
    if (!claimGateIds.has(id)) fail(`missing required claim gate: ${id}`);
  }

  const claimGateText = JSON.stringify(claimGates);
  for (const requiredText of [
    "staged governance product surface",
    "deterministic governance interface logic and operational evidence requirements",
    "operationally deployed",
    "executing live AI",
    "persistent production audit ledger",
    "backend-validated operational governance infrastructure",
    "customer-ready, tenant-isolated, or production SaaS",
    "Operational use is a legitimate future threshold event"
  ]) {
    if (!claimGateText.includes(requiredText)) fail(`claim_gates missing required claim text: ${requiredText}`);
  }

  const disallowedClaims = requireArray(
    contract.disallowed_claims_until_threshold_met,
    "disallowed_claims_until_threshold_met"
  );
  const normalizedDisallowedClaims = new Set(disallowedClaims.map(normalize));
  for (const claim of requiredDisallowedClaims) {
    if (!normalizedDisallowedClaims.has(normalize(claim))) {
      fail(`disallowed_claims_until_threshold_met missing ${claim}`);
    }
  }

  const relationship = contract.relationship_to_product_negative_space_backlog || {};
  if (relationship.source_path !== negativeSpaceBacklogPath) {
    fail(`relationship_to_product_negative_space_backlog.source_path must be ${negativeSpaceBacklogPath}`);
  }

  const allContractText = JSON.stringify(contract);
  if (!/Operational use is a legitimate future threshold event/i.test(allContractText)) {
    fail("contract must explicitly state that operational use is a legitimate future threshold event");
  }
  if (/operational_use_currently_claimable|operational_use_claimed|currently operationally deployed|current production SaaS/i.test(allContractText)) {
    fail("contract suggests current operational use");
  }

  const boundary = contract.non_implementation_boundary || {};
  if (boundary.introduced_by_this_pass !== "contract_only_threshold_definition") {
    fail("non_implementation_boundary.introduced_by_this_pass must be contract_only_threshold_definition");
  }
  for (const field of nonImplementationFalseFields) {
    if (boundary[field] !== false) {
      fail(`non_implementation_boundary.${field} must be false`);
    }
  }

  const boundaryText = JSON.stringify(boundary);
  for (const forbiddenImplementation of [
    "backend",
    "database",
    "persistence",
    "ledger",
    "auth",
    "runtime execution",
    "model API"
  ]) {
    if (!boundaryText.toLowerCase().includes(forbiddenImplementation.toLowerCase())) {
      fail(`non_implementation_boundary must mention no ${forbiddenImplementation} implementation was introduced`);
    }
  }

  return evidenceById;
}

function validateCurrentEvidenceRecords() {
  const integration = fs.existsSync(integrationReadinessPath) ? readJson(integrationReadinessPath) : {};
  const liveProvider = fs.existsSync("data/direct-ui-membrane-live-provider-loop-verification.v0.json")
    ? readJson("data/direct-ui-membrane-live-provider-loop-verification.v0.json")
    : {};
  const persistence = fs.existsSync("data/direct-ui-membrane-protected-workspace-persistence.v0.json")
    ? readJson("data/direct-ui-membrane-protected-workspace-persistence.v0.json")
    : {};
  const publicAudit = fs.existsSync("data/public-surface-execution-audit.v0.json")
    ? readJson("data/public-surface-execution-audit.v0.json")
    : {};
  const nexusReadiness = fs.existsSync("data/nexus-adapter-readiness.v0.json")
    ? readJson("data/nexus-adapter-readiness.v0.json")
    : {};
  const vaultPipeline = fs.existsSync("data/nexus-vault-compatibility-pipeline-fixtures.v1.json")
    ? readJson("data/nexus-vault-compatibility-pipeline-fixtures.v1.json")
    : {};

  for (const field of [
    "current_palisade_state.deployed_enforcement_membrane_exists",
    "current_palisade_state.runtime_policy_engine_exists",
    "current_palisade_state.production_policy_service_exists",
    "current_palisade_state.public_runtime_gate_exists",
    "current_palisade_state.operational_enforcement_layer_exists"
  ]) {
    assertFalse(integration, field, integrationReadinessPath);
  }

  assertTrue(liveProvider, "provider_login_verified", "data/direct-ui-membrane-live-provider-loop-verification.v0.json");
  assertTrue(liveProvider, "callback_session_recognition_verified", "data/direct-ui-membrane-live-provider-loop-verification.v0.json");
  assertTrue(liveProvider, "protected_shell_admission_verified", "data/direct-ui-membrane-live-provider-loop-verification.v0.json");
  for (const field of [
    "backend_implemented",
    "database_access_implemented",
    "persistence_implemented",
    "rls_implemented",
    "tenant_isolation_implemented",
    "customer_workspace_implemented",
    "billing_implemented",
    "production_saas_claimed"
  ]) {
    assertFalse(liveProvider, field, "data/direct-ui-membrane-live-provider-loop-verification.v0.json");
  }

  assertTrue(
    persistence,
    "claimable_narrow_state.bounded_protected_shell_persistence_loop_verified",
    "data/direct-ui-membrane-protected-workspace-persistence.v0.json"
  );
  for (const field of [
    "not_claimable_maturity_states.production_saas",
    "not_claimable_maturity_states.customer_workspace_maturity",
    "not_claimable_maturity_states.tenant_isolation_maturity",
    "not_claimable_maturity_states.broad_authorization_assurance",
    "not_claimable_maturity_states.operational_use",
    "not_claimable_maturity_states.operational_release_authority",
    "not_claimable_maturity_states.production_audit_ledger",
    "not_claimable_maturity_states.palisade_birth",
    "not_claimable_maturity_states.weave_birth",
    "not_claimable_maturity_states.public_nexus_runtime",
    "not_claimable_maturity_states.model_api_execution",
    "not_claimable_maturity_states.production_authorization_maturity"
  ]) {
    assertFalse(persistence, field, "data/direct-ui-membrane-protected-workspace-persistence.v0.json");
  }

  if (!Array.isArray(publicAudit.findings) || publicAudit.findings.length === 0) {
    fail("data/public-surface-execution-audit.v0.json: findings must remain available for current evidence context");
  }
  if (nexusReadiness.metadata?.integration_status !== "not_integrated") {
    fail("data/nexus-adapter-readiness.v0.json: integration_status must remain not_integrated");
  }
  if (nexusReadiness.recommended_adapter_strategy?.model_calls_allowed_now !== false) {
    fail("data/nexus-adapter-readiness.v0.json: model_calls_allowed_now must remain false");
  }
  if (vaultPipeline.metadata?.public_runtime !== false || vaultPipeline.metadata?.model_execution !== false) {
    fail("data/nexus-vault-compatibility-pipeline-fixtures.v1.json: public runtime and model execution must remain false");
  }
  if (vaultPipeline.metadata?.palisade !== false || vaultPipeline.metadata?.weave !== false) {
    fail("data/nexus-vault-compatibility-pipeline-fixtures.v1.json: Palisade and Weave runtime flags must remain false");
  }
}

function ensureNoHypotheticalEvidenceSource(source, label) {
  if (source === policyCasesPath || source.includes("/tests/") || source.includes(".track3-runs")) {
    fail(`${label}: ${source} must not be used as current operational evidence`);
  }
}

function validateOperationalPalisadeConsumption(contract, evidenceById) {
  const requiredFiles = [
    palisadeManifestPath,
    palisadePolicyPath,
    palisadeInputSchemaPath,
    palisadeDecisionSchemaPath,
    operationalConsumerContractPath,
    contractPath
  ];
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) fail(`${file}: required operational-evidence Palisade consumption file is missing`);
  }
  if (requiredFiles.some((file) => !fs.existsSync(file))) return new Map();

  const policy = readJson(palisadePolicyPath);
  const inputSchema = readJson(palisadeInputSchemaPath);
  const decisionSchema = readJson(palisadeDecisionSchemaPath);
  const consumerContract = readJson(operationalConsumerContractPath);

  for (const field of requiredOperationalConsumerFields) {
    if (!(field in consumerContract)) fail(`${operationalConsumerContractPath}: missing required field ${field}`);
  }
  if (consumerContract.consumer_id !== "operational_evidence_packet_contract_validator") {
    fail(`${operationalConsumerContractPath}: consumer_id must be operational_evidence_packet_contract_validator`);
  }
  if (consumerContract.consumer_path !== "scripts/validate-operational-evidence-packet-contract.mjs") {
    fail(`${operationalConsumerContractPath}: consumer_path must point to validate-operational-evidence-packet-contract.mjs`);
  }
  if (consumerContract.consumer_type !== "validator") fail(`${operationalConsumerContractPath}: consumer_type must be validator`);
  if (consumerContract.governed_surface !== "operational_evidence_packet_contract") {
    fail(`${operationalConsumerContractPath}: governed_surface must be operational_evidence_packet_contract`);
  }
  if (consumerContract.source_policy_bundle !== palisadeBundlePath) {
    fail(`${operationalConsumerContractPath}: source_policy_bundle must be ${palisadeBundlePath}`);
  }
  if (consumerContract.policy_file !== palisadePolicyPath) {
    fail(`${operationalConsumerContractPath}: policy_file must be ${palisadePolicyPath}`);
  }
  if (consumerContract.policy_input_schema !== palisadeInputSchemaPath) {
    fail(`${operationalConsumerContractPath}: policy_input_schema must be ${palisadeInputSchemaPath}`);
  }
  if (consumerContract.policy_decision_schema !== palisadeDecisionSchemaPath) {
    fail(`${operationalConsumerContractPath}: policy_decision_schema must be ${palisadeDecisionSchemaPath}`);
  }
  if (consumerContract.operational_evidence_contract !== contractPath) {
    fail(`${operationalConsumerContractPath}: operational_evidence_contract must be ${contractPath}`);
  }

  assertIncludesAll(
    inputSchema.required,
    consumerContract.required_policy_input_fields,
    `${palisadeInputSchemaPath}: policy input schema required fields`
  );
  assertIncludesAll(
    decisionSchema.required,
    consumerContract.required_policy_decision_fields,
    `${palisadeDecisionSchemaPath}: policy decision schema required fields`
  );
  assertIncludesAll(
    decisionSchema.properties?.decision?.enum,
    Array.from(allowedPalisadeDecisions),
    `${palisadeDecisionSchemaPath}: policy decision enum`
  );

  const policyClaimIds = new Set((policy.rules || []).map((rule) => rule.claim_id));
  const consumedPolicyDecisions = requireArray(
    consumerContract.consumed_policy_decisions,
    `${operationalConsumerContractPath}.consumed_policy_decisions`
  );
  for (const claimId of consumedPolicyDecisions) {
    if (!policyClaimIds.has(claimId)) {
      fail(`${operationalConsumerContractPath}: consumed policy decision lacks policy rule: ${claimId}`);
    }
  }

  for (const source of requireArray(consumerContract.current_evidence_sources, `${operationalConsumerContractPath}.current_evidence_sources`)) {
    if (!fs.existsSync(source)) fail(`${operationalConsumerContractPath}: current evidence source missing: ${source}`);
    ensureNoHypotheticalEvidenceSource(source, `${operationalConsumerContractPath}.current_evidence_sources`);
  }

  validateCurrentEvidenceRecords();

  const mappings = requireArray(
    consumerContract.evidence_class_mappings,
    `${operationalConsumerContractPath}.evidence_class_mappings`
  );
  const mappedEvidenceClasses = new Set();
  const mappedClaimIds = new Set();
  const decisionsByEvidenceClass = new Map();

  for (const [index, mapping] of mappings.entries()) {
    const label = `${operationalConsumerContractPath}.evidence_class_mappings[${index}]`;
    if (!requireObject(mapping, label)) continue;
    for (const field of [
      "evidence_class",
      "palisade_claim_id",
      "requested_action",
      "operational_evidence_class_ids",
      "current_state",
      "verification_state",
      "applicability_state",
      "necessary_but_not_sufficient",
      "repository_evidence_sources",
      "blocked_decisions"
    ]) {
      if (!(field in mapping)) fail(`${label}: missing ${field}`);
    }
    if (!policyClaimIds.has(mapping.palisade_claim_id)) {
      fail(`${mapping.evidence_class}: Palisade claim mapping has no policy rule`);
    }
    mappedEvidenceClasses.add(mapping.evidence_class);
    mappedClaimIds.add(mapping.palisade_claim_id);

    const operationalEvidenceClassIds = requireArray(mapping.operational_evidence_class_ids, `${label}.operational_evidence_class_ids`);
    for (const evidenceClassId of operationalEvidenceClassIds) {
      if (!evidenceById.has(evidenceClassId)) {
        fail(`${mapping.evidence_class}: mapped operational evidence class does not exist: ${evidenceClassId}`);
      }
    }
    for (const source of requireArray(mapping.repository_evidence_sources, `${label}.repository_evidence_sources`)) {
      if (!fs.existsSync(source)) fail(`${mapping.evidence_class}: repository evidence source missing: ${source}`);
      ensureNoHypotheticalEvidenceSource(source, `${mapping.evidence_class}.repository_evidence_sources`);
    }
    if (mapping.necessary_but_not_sufficient !== true) {
      fail(`${mapping.evidence_class}: mapped evidence must be necessary but not sufficient by itself`);
    }

    const missingEvidence = operationalEvidenceClassIds.filter((id) => {
      const item = evidenceById.get(id);
      return !item || allowedNonCompleteStatuses.has(item.current_status);
    });
    const requiredEvidence = Array.from(new Set([
      ...operationalEvidenceClassIds,
      ...(mapping.required_evidence || [])
    ]));
    const policyMapping = {
      ...mapping,
      claim_class: mapping.evidence_class,
      required_evidence: requiredEvidence,
      missing_evidence: Array.from(new Set([...(mapping.missing_evidence || []), ...missingEvidence]))
    };

    const input = buildPolicyInput(policyMapping, policy, {
      surface: "operational_evidence_packet_contract",
      currentEvidence: [
        "operational evidence packet contract",
        "product negative-space backlog",
        "current synchronized repository evidence records",
        "Palisade policy artifact"
      ],
      evidenceNote: "Constructed by operational-evidence packet contract validator from synchronized repository evidence.",
      currentRepositoryStateBasis: [
        contractPath,
        negativeSpaceBacklogPath,
        operationalConsumerContractPath,
        palisadePolicyPath,
        integrationReadinessPath
      ]
    });

    for (const field of consumerContract.required_policy_input_fields || []) {
      if (!(field in input)) fail(`${mapping.evidence_class}: constructed Palisade policy input missing ${field}`);
    }
    if (input.current_repository_state_basis.some((source) => source === policyCasesPath || source.includes("/tests/") || source.includes(".track3-runs"))) {
      fail(`${mapping.evidence_class}: constructed input used test, hypothetical, or ignored generated evidence as current evidence`);
    }

    const decision = evaluatePalisadeDecision(policy, input);
    assertDecisionShape(decision, consumerContract.required_policy_decision_fields || []);
    decisionsByEvidenceClass.set(mapping.evidence_class, decision);

    const blockedDecisions = requireArray(mapping.blocked_decisions, `${label}.blocked_decisions`);
    if (!classificationEvidenceClasses.has(mapping.evidence_class)) {
      for (const blockedDecision of blockedDecisions) {
        if (!capabilityBlockDecisions.has(blockedDecision)) {
          fail(`${mapping.evidence_class}: unsupported Palisade blocking decision ${blockedDecision}`);
        }
      }
      if (decision.decision === "allow") {
        fail(`${mapping.evidence_class}: current repository evidence unexpectedly allows governed claim advancement`);
      }
      if (decision.decision === "requires_evidence" && decision.allowed) {
        fail(`${mapping.evidence_class}: requires_evidence must not grant evidence sufficiency`);
      }
      if (decision.decision === "requires_operator_review" && decision.allowed) {
        fail(`${mapping.evidence_class}: requires_operator_review must not grant evidence sufficiency`);
      }
      if (decision.decision === "runtime_enforcement_unavailable" && decision.allowed) {
        fail(`${mapping.evidence_class}: runtime_enforcement_unavailable must not grant runtime claim permission`);
      }
    }

    if (mapping.evidence_class === "deployed_palisade_runtime_enforcement" && decision.decision !== "runtime_enforcement_unavailable") {
      fail("deployed_palisade_runtime_enforcement must be blocked by runtime_enforcement_unavailable");
    }
    if (mapping.evidence_class === "operational_release_authority" && decision.allowed) {
      fail("operational_release_authority must remain blocked under current repository evidence");
    }
  }

  for (const evidenceClass of requiredGovernedEvidenceClasses) {
    if (!mappedEvidenceClasses.has(evidenceClass)) {
      fail(`${operationalConsumerContractPath}: missing evidence-class mapping for ${evidenceClass}`);
    }
  }
  for (const claimId of consumedPolicyDecisions) {
    if (!mappedClaimIds.has(claimId)) {
      fail(`${operationalConsumerContractPath}: consumed policy decision lacks evidence-class mapping: ${claimId}`);
    }
  }

  const thresholdMappings = requireArray(
    consumerContract.claim_to_evidence_threshold_mappings,
    `${operationalConsumerContractPath}.claim_to_evidence_threshold_mappings`
  );
  const thresholdClasses = new Set();
  for (const [index, threshold] of thresholdMappings.entries()) {
    const label = `${operationalConsumerContractPath}.claim_to_evidence_threshold_mappings[${index}]`;
    if (!requireObject(threshold, label)) continue;
    for (const field of ["claim_class", "palisade_claim_id", "required_evidence_classes", "decision_required", "current_result"]) {
      if (!(field in threshold)) fail(`${label}: missing ${field}`);
    }
    if (!policyClaimIds.has(threshold.palisade_claim_id)) {
      fail(`${threshold.claim_class}: threshold Palisade claim mapping has no policy rule`);
    }
    thresholdClasses.add(threshold.claim_class);
    for (const evidenceClass of requireArray(threshold.required_evidence_classes, `${label}.required_evidence_classes`)) {
      if (!mappedEvidenceClasses.has(evidenceClass)) {
        fail(`${threshold.claim_class}: threshold references unmapped evidence class ${evidenceClass}`);
      }
    }
    if (threshold.current_result === "blocked" && threshold.decision_required !== "allow") {
      fail(`${threshold.claim_class}: blocked claim thresholds must require allow before advancement`);
    }
  }
  for (const claimClass of requiredThresholdClaimClasses) {
    if (!thresholdClasses.has(claimClass)) {
      fail(`${operationalConsumerContractPath}: missing claim-to-evidence threshold mapping for ${claimClass}`);
    }
  }

  const normalization = consumerContract.evidence_state_normalization || {};
  for (const state of [
    "required",
    "missing",
    "absent",
    "exists",
    "partial",
    "complete",
    "unverified",
    "verified",
    "stale",
    "current",
    "contradictory",
    "inapplicable",
    "local-only",
    "preview-only",
    "stubbed",
    "policy-represented-only",
    "test-only",
    "hypothetical"
  ]) {
    if (!(state in normalization)) fail(`${operationalConsumerContractPath}: evidence_state_normalization missing ${state}`);
  }
  if (!/Contract validity is not packet completeness/i.test(JSON.stringify(consumerContract.evidence_completeness_rules))) {
    fail(`${operationalConsumerContractPath}: completeness rules must preserve contract-validity distinction`);
  }
  if (!/Packet completeness is not evidence verification/i.test(JSON.stringify(consumerContract.evidence_verification_rules))) {
    fail(`${operationalConsumerContractPath}: verification rules must preserve completeness versus verification distinction`);
  }
  if (!/runtime_enforcement_unavailable/i.test(JSON.stringify(consumerContract.runtime_enforcement_status_handling))) {
    fail(`${operationalConsumerContractPath}: runtime enforcement handling must consume runtime_enforcement_unavailable`);
  }
  if (!/Contract validity, packet completeness, and Operator review alone are not release authority/i.test(JSON.stringify(consumerContract.release_authority_handling))) {
    fail(`${operationalConsumerContractPath}: release authority handling must block contract/review-only authority`);
  }
  if (consumerContract.operator_review_handling?.current_repository_authorization_state !== "not_requested") {
    fail(`${operationalConsumerContractPath}: Operator authorization state must remain not_requested`);
  }
  if (!/reachability/i.test(consumerContract.hypothetical_fixture_boundary?.policy_test_fixtures || "")) {
    fail(`${operationalConsumerContractPath}: hypothetical fixtures must be reachability-only`);
  }
  if (!consumerContract.preserved_existing_checks?.includes("required non-complete evidence class statuses")) {
    fail(`${operationalConsumerContractPath}: preserved_existing_checks must include existing evidence-status checks`);
  }
  if (!consumerContract.forbidden_inferences?.includes("contract validity implies evidence fulfillment")) {
    fail(`${operationalConsumerContractPath}: forbidden_inferences must block contract-validity escalation`);
  }

  return decisionsByEvidenceClass;
}

if (!fs.existsSync(contractPath)) {
  fail(`${contractPath} is missing`);
}
if (!fs.existsSync(negativeSpaceBacklogPath)) {
  fail(`${negativeSpaceBacklogPath} is missing`);
}

const contract = fs.existsSync(contractPath) ? readJson(contractPath) : {};
const negativeSpaceBacklog = fs.existsSync(negativeSpaceBacklogPath)
  ? readJson(negativeSpaceBacklogPath)
  : {};

const evidenceById = validateExistingContractShape(contract, negativeSpaceBacklog);
const operationalPalisadeDecisions = validateOperationalPalisadeConsumption(contract, evidenceById);

if (failures.length) {
  console.error("Operational evidence packet contract validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("operational evidence packet contract ok");
console.log(`Required evidence classes: ${requiredEvidenceClassIds.length}`);
console.log(`Claim gates: ${requiredClaimGateIds.length}`);
console.log(`Palisade-governed evidence classes checked: ${operationalPalisadeDecisions.size}`);
