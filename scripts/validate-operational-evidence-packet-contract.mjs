import fs from "node:fs";

const contractPath = "data/operational-evidence-packet-contract.v0.json";
const negativeSpaceBacklogPath = "data/product-negative-space-backlog.v0.json";

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

const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

const evidenceClasses = requireArray(contract.required_evidence_classes, "required_evidence_classes");
const evidenceById = new Map();
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

const negativeSpacePhrases = new Set(
  (Array.isArray(negativeSpaceBacklog.mappings) ? negativeSpaceBacklog.mappings : [])
    .map((mapping) => normalize(mapping.source_phrase))
);

for (const item of evidenceClasses) {
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

if (failures.length) {
  console.error("Operational evidence packet contract validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("operational evidence packet contract ok");
console.log(`Required evidence classes: ${requiredEvidenceClassIds.length}`);
console.log(`Claim gates: ${requiredClaimGateIds.length}`);
