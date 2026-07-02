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

const readmePath = "README.md";
const configPath = "data/readme-artifact-classification-sobriety.v0.json";
const readmeConsumerContractPath = "palisade/policy-bundle.v0/consumers/readme-current-state-truth-consumer.v0.json";
const palisadeBundlePath = "palisade/policy-bundle.v0/";
const integrationReadinessPath = "palisade/policy-bundle.v0/integration-readiness.v0.json";
const policyCasesPath = "palisade/policy-bundle.v0/tests/claim-capability-policy.cases.json";

const failures = [];
const requiredReadmeContractFields = [
  "consumer_id",
  "consumer_path",
  "consumer_type",
  "governed_surface",
  "source_policy_bundle",
  "policy_file",
  "policy_input_schema",
  "policy_decision_schema",
  "consumed_policy_decisions",
  "readme_claim_mappings",
  "required_policy_input_fields",
  "required_policy_decision_fields",
  "current_evidence_sources",
  "fail_closed_behavior",
  "no_overclaim_behavior",
  "operator_review_handling",
  "runtime_enforcement_status_handling",
  "hypothetical_fixture_boundary",
  "preserved_existing_checks",
  "forbidden_capability_claims",
  "non_claims",
  "next_integration_boundary"
];

const requiredReadmeClaimClasses = [
  "production_workspace_maturity",
  "authenticated_production_workspace_availability",
  "tenant_scoped_persistence_maturity",
  "server_side_authorization_or_rls_maturity",
  "runtime_governance_path_sufficiency",
  "palisade_runtime_enforcement",
  "public_nexus_runtime_execution",
  "model_api_execution",
  "operational_release_authority",
  "durable_evidence_or_audit_capability",
  "deployed_conduit_vault_integration",
  "weave_orchestration_availability",
  "bounded_preview_static_local_or_repository_state",
  "repository_owned_artifact_existence"
];

const capabilityBlockDecisions = new Set([
  "deny",
  "requires_evidence",
  "requires_operator_review",
  "runtime_enforcement_unavailable"
]);

function fail(message) {
  failures.push(message);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\n/).length;
}

function assertIncludes(text, phrase, label) {
  if (!text.toLowerCase().includes(String(phrase).toLowerCase())) {
    fail(`${label} missing required phrase: ${phrase}`);
  }
}

function lineText(text, index) {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end);
}

function nearbyText(text, index, radius = 260) {
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + radius));
}

function isNegatedBoundaryContext(text, index) {
  return /\b(does not imply|does not provide|does not complete|does not claim|not a current claim|not a completed|not current|not currently|not yet claimable|not operational evidence|not operational use achieved|not public|not instantiated|not runnable|no )\b/i.test(
    lineText(text, index)
  );
}

function isBoundedCurrentStateContext(text, index) {
  return /\b(not yet claimable|does not imply|does not provide|does not create|does not complete|does not claim|not a current claim|not full|not public|not operational|not instantiated|not runnable|not production|no public|no live|no production|remain unclaimable|remains unclaimable|unclaimable|requires|required before|before .* claim|without claiming|until .* verified|future threshold event|current limits|current-state limits|repository-held|repository-owned|static|preview|browser-side|local|stubbed|bounded)\b/i.test(
    nearbyText(text, index)
  );
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`);
    return [];
  }
  return value;
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
    return null;
  }
  return value;
}

function assertIncludesAll(actual, required, label) {
  const actualArray = assertArray(actual, label);
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

function ensureEvidenceSourcesExist(contract) {
  for (const source of assertArray(contract.current_evidence_sources, `${readmeConsumerContractPath}.current_evidence_sources`)) {
    if (!fs.existsSync(source)) fail(`${readmeConsumerContractPath}: current evidence source missing: ${source}`);
    if (source === policyCasesPath || source.includes("/tests/")) {
      fail(`${readmeConsumerContractPath}: hypothetical policy fixtures must not be current README evidence`);
    }
  }
}

function validateCurrentEvidenceRecords() {
  const integration = fs.existsSync(integrationReadinessPath) ? readJson(integrationReadinessPath) : {};
  const liveProvider = fs.existsSync("data/direct-ui-membrane-live-provider-loop-verification.v0.json")
    ? readJson("data/direct-ui-membrane-live-provider-loop-verification.v0.json")
    : {};
  const persistence = fs.existsSync("data/direct-ui-membrane-protected-workspace-persistence.v0.json")
    ? readJson("data/direct-ui-membrane-protected-workspace-persistence.v0.json")
    : {};
  const operationalEvidence = fs.existsSync("data/operational-evidence-packet-contract.v0.json")
    ? readJson("data/operational-evidence-packet-contract.v0.json")
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
    "not_claimable_maturity_states.operational_release_authority",
    "not_claimable_maturity_states.palisade_birth",
    "not_claimable_maturity_states.weave_birth",
    "not_claimable_maturity_states.public_nexus_runtime",
    "not_claimable_maturity_states.model_api_execution",
    "not_claimable_maturity_states.production_authorization_maturity"
  ]) {
    assertFalse(persistence, field, "data/direct-ui-membrane-protected-workspace-persistence.v0.json");
  }

  if (operationalEvidence.operational_use_threshold_status !== "threshold_not_met") {
    fail("data/operational-evidence-packet-contract.v0.json: operational_use_threshold_status must remain threshold_not_met");
  }
  if (operationalEvidence.current_claim_status !== "operational_use_not_currently_claimable") {
    fail("data/operational-evidence-packet-contract.v0.json: current_claim_status must keep operational use unclaimable");
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
}

function assertDecisionShape(decision, requiredFields) {
  decisionShapeErrors(decision, requiredFields).forEach((error) => fail(`${readmeConsumerContractPath}: ${error}`));
}

function validateReadmePalisadeConsumption(readmeText) {
  const requiredFiles = [
    palisadeManifestPath,
    palisadePolicyPath,
    palisadeInputSchemaPath,
    palisadeDecisionSchemaPath,
    readmeConsumerContractPath
  ];
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) fail(`${file}: required Palisade README consumption file is missing`);
  }
  if (requiredFiles.some((file) => !fs.existsSync(file))) return new Map();

  const policy = readJson(palisadePolicyPath);
  const inputSchema = readJson(palisadeInputSchemaPath);
  const decisionSchema = readJson(palisadeDecisionSchemaPath);
  const consumerContract = readJson(readmeConsumerContractPath);

  for (const field of requiredReadmeContractFields) {
    if (!(field in consumerContract)) fail(`${readmeConsumerContractPath}: missing required field ${field}`);
  }
  if (consumerContract.consumer_id !== "readme_current_state_truth_validator") {
    fail(`${readmeConsumerContractPath}: consumer_id must be readme_current_state_truth_validator`);
  }
  if (consumerContract.consumer_path !== "scripts/validate-readme-artifact-classification-sobriety.mjs") {
    fail(`${readmeConsumerContractPath}: consumer_path must point to validate-readme-artifact-classification-sobriety.mjs`);
  }
  if (consumerContract.consumer_type !== "validator") fail(`${readmeConsumerContractPath}: consumer_type must be validator`);
  if (consumerContract.governed_surface !== "README") fail(`${readmeConsumerContractPath}: governed_surface must be README`);
  if (consumerContract.source_policy_bundle !== palisadeBundlePath) {
    fail(`${readmeConsumerContractPath}: source_policy_bundle must be ${palisadeBundlePath}`);
  }
  if (consumerContract.policy_file !== palisadePolicyPath) {
    fail(`${readmeConsumerContractPath}: policy_file must be ${palisadePolicyPath}`);
  }
  if (consumerContract.policy_input_schema !== palisadeInputSchemaPath) {
    fail(`${readmeConsumerContractPath}: policy_input_schema must be ${palisadeInputSchemaPath}`);
  }
  if (consumerContract.policy_decision_schema !== palisadeDecisionSchemaPath) {
    fail(`${readmeConsumerContractPath}: policy_decision_schema must be ${palisadeDecisionSchemaPath}`);
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

  ensureEvidenceSourcesExist(consumerContract);
  validateCurrentEvidenceRecords();

  const policyClaimIds = new Set((policy.rules || []).map((rule) => rule.claim_id));
  const consumedPolicyDecisions = assertArray(
    consumerContract.consumed_policy_decisions,
    `${readmeConsumerContractPath}.consumed_policy_decisions`
  );
  for (const claimId of consumedPolicyDecisions) {
    if (!policyClaimIds.has(claimId)) {
      fail(`${readmeConsumerContractPath}: consumed policy decision lacks policy rule: ${claimId}`);
    }
  }

  const claimMappings = assertArray(
    consumerContract.readme_claim_mappings,
    `${readmeConsumerContractPath}.readme_claim_mappings`
  );
  const mappedClasses = new Set();
  const mappedClaimIds = new Set();
  const decisionsByClass = new Map();

  for (const [index, mapping] of claimMappings.entries()) {
    const label = `${readmeConsumerContractPath}.readme_claim_mappings[${index}]`;
    if (!assertObject(mapping, label)) continue;
    for (const field of [
      "claim_class",
      "mapping_type",
      "palisade_claim_id",
      "requested_action",
      "allowed_only_when",
      "blocks_when_decision_is",
      "repository_evidence_sources",
      "current_state_qualifier_rule"
    ]) {
      if (!(field in mapping)) fail(`${label}: missing ${field}`);
    }
    if (!policyClaimIds.has(mapping.palisade_claim_id)) {
      fail(`${mapping.claim_class}: Palisade claim mapping has no policy rule`);
    }
    mappedClasses.add(mapping.claim_class);
    mappedClaimIds.add(mapping.palisade_claim_id);

    for (const source of assertArray(mapping.repository_evidence_sources, `${label}.repository_evidence_sources`)) {
      if (!fs.existsSync(source)) fail(`${mapping.claim_class}: repository evidence source missing: ${source}`);
      if (source === policyCasesPath || source.includes("/tests/")) {
        fail(`${mapping.claim_class}: hypothetical policy fixtures must not be used as current evidence`);
      }
    }

    const input = buildPolicyInput(mapping, policy, {
      surface: "README",
      currentEvidence: [
        "README current-state target",
        "README sobriety validator configuration",
        "current synchronized repository evidence records",
        "Palisade policy artifact"
      ],
      evidenceNote: "Constructed by README current-state truth validator from synchronized repository evidence.",
      currentRepositoryStateBasis: [
        readmePath,
        configPath,
        readmeConsumerContractPath,
        palisadePolicyPath,
        integrationReadinessPath
      ]
    });
    for (const field of consumerContract.required_policy_input_fields || []) {
      if (!(field in input)) fail(`${mapping.claim_class}: constructed Palisade policy input missing ${field}`);
    }
    if (input.current_repository_state_basis.some((source) => source === policyCasesPath || source.includes("/tests/"))) {
      fail(`${mapping.claim_class}: constructed input used hypothetical policy fixtures as current evidence`);
    }

    const decision = evaluatePalisadeDecision(policy, input);
    assertDecisionShape(decision, consumerContract.required_policy_decision_fields || []);
    decisionsByClass.set(mapping.claim_class, decision);

    if (mapping.mapping_type === "capability_assertion") {
      for (const blockedDecision of assertArray(mapping.blocks_when_decision_is, `${label}.blocks_when_decision_is`)) {
        if (!capabilityBlockDecisions.has(blockedDecision)) {
          fail(`${mapping.claim_class}: unsupported Palisade blocking decision ${blockedDecision}`);
        }
      }
      if (decision.decision === "requires_evidence" && decision.allowed) {
        fail(`${mapping.claim_class}: requires_evidence must not grant README claim permission`);
      }
      if (decision.decision === "requires_operator_review" && decision.allowed) {
        fail(`${mapping.claim_class}: requires_operator_review must not grant permission without explicit authorization`);
      }
      if (decision.decision === "runtime_enforcement_unavailable" && decision.allowed) {
        fail(`${mapping.claim_class}: runtime_enforcement_unavailable must not grant runtime claim permission`);
      }
      if (decision.decision === "allow" && decision.missing_evidence.length > 0) {
        fail(`${mapping.claim_class}: allow decision lacks complete current evidence`);
      }

      for (const patternText of assertArray(mapping.readme_claim_patterns, `${label}.readme_claim_patterns`)) {
        const pattern = new RegExp(patternText, "gi");
        let match;
        while ((match = pattern.exec(readmeText))) {
          if (isNegatedBoundaryContext(readmeText, match.index) || isBoundedCurrentStateContext(readmeText, match.index)) {
            continue;
          }
          if (!decision.allowed) {
            fail(
              `${readmePath}: ${mapping.claim_class} maps to ${mapping.palisade_claim_id} and is blocked by Palisade decision ${decision.decision} at line ${lineNumber(readmeText, match.index)}`
            );
          }
        }
      }
    } else if (mapping.mapping_type === "bounded_current_state_classification") {
      for (const blockedCondition of assertArray(mapping.blocks_when_decision_is, `${label}.blocks_when_decision_is`)) {
        if (typeof blockedCondition !== "string" || blockedCondition.trim() === "") {
          fail(`${mapping.claim_class}: bounded classification block conditions must be non-empty strings`);
        }
      }
      const classificationPatterns = assertArray(mapping.classification_patterns, `${label}.classification_patterns`);
      for (const patternText of classificationPatterns) {
        const pattern = new RegExp(patternText, "gi");
        let match;
        while ((match = pattern.exec(readmeText))) {
          const context = nearbyText(readmeText, match.index).toLowerCase();
          if (/\b(production .*exists|operational .*exists|runtime enforcement exists|public nexus runtime exists|model api execution exists)\b/i.test(context)) {
            fail(
              `${readmePath}: bounded classification ${mapping.claim_class} appears to imply unsupported operational capability at line ${lineNumber(readmeText, match.index)}`
            );
          }
        }
      }
    } else {
      fail(`${mapping.claim_class}: mapping_type must be capability_assertion or bounded_current_state_classification`);
    }
  }

  for (const claimClass of requiredReadmeClaimClasses) {
    if (!mappedClasses.has(claimClass)) fail(`${readmeConsumerContractPath}: missing README claim mapping for ${claimClass}`);
  }
  for (const claimId of consumedPolicyDecisions) {
    if (!mappedClaimIds.has(claimId)) {
      fail(`${readmeConsumerContractPath}: consumed policy decision lacks README claim mapping: ${claimId}`);
    }
  }

  const fixtureBoundary = consumerContract.hypothetical_fixture_boundary || {};
  if (!/reachability/i.test(fixtureBoundary.policy_test_fixtures || "")) {
    fail(`${readmeConsumerContractPath}: hypothetical_fixture_boundary must limit policy fixtures to reachability`);
  }
  if (!/fail/i.test(fixtureBoundary.validator_behavior || "")) {
    fail(`${readmeConsumerContractPath}: hypothetical_fixture_boundary must fail when fixtures authorize current claims`);
  }
  if (consumerContract.operator_review_handling?.current_repository_authorization_state !== "not_requested") {
    fail(`${readmeConsumerContractPath}: Operator authorization state must remain not_requested`);
  }
  if (!/Blocks/i.test(consumerContract.runtime_enforcement_status_handling?.runtime_enforcement_unavailable || "")) {
    fail(`${readmeConsumerContractPath}: runtime_enforcement_unavailable must block runtime claims`);
  }
  if (!consumerContract.preserved_existing_checks?.includes("restricted_claim_patterns")) {
    fail(`${readmeConsumerContractPath}: contract must preserve existing restricted_claim_patterns checks`);
  }

  return decisionsByClass;
}

if (!fs.existsSync(readmePath)) fail(`${readmePath} is missing`);
if (!fs.existsSync(configPath)) fail(`${configPath} is missing`);

const readmeText = fs.existsSync(readmePath) ? readText(readmePath) : "";
const config = fs.existsSync(configPath) ? JSON.parse(readText(configPath)) : {};

if (config.schema_version !== "1.0") fail(`${configPath}: schema_version must be 1.0`);
if (config.target !== readmePath) fail(`${configPath}: target must be ${readmePath}`);

const requiredArtifactClasses = Array.isArray(config.required_artifact_classes)
  ? config.required_artifact_classes
  : [];
const requiredBoundaryPhrases = Array.isArray(config.required_boundary_phrases)
  ? config.required_boundary_phrases
  : [];
const restrictedClaimPatterns = Array.isArray(config.restricted_claim_patterns)
  ? config.restricted_claim_patterns
  : [];

for (const artifactClass of requiredArtifactClasses) {
  assertIncludes(readmeText, artifactClass, readmePath);
}

for (const phrase of requiredBoundaryPhrases) {
  assertIncludes(readmeText, phrase, readmePath);
}

for (const item of restrictedClaimPatterns) {
  if (!item || typeof item !== "object") {
    fail(`${configPath}: restricted_claim_patterns entries must be objects`);
    continue;
  }
  if (!item.id || !item.pattern || !item.reason) {
    fail(`${configPath}: restricted claim pattern is missing id, pattern, or reason`);
    continue;
  }
  const pattern = new RegExp(item.pattern, "i");
  const match = pattern.exec(readmeText);
  if (match) {
    if (isNegatedBoundaryContext(readmeText, match.index) || isBoundedCurrentStateContext(readmeText, match.index)) continue;
    fail(`${item.id}: ${item.reason} at README line ${lineNumber(readmeText, match.index)}`);
  }
}

const requiredDistinctions = [
  "The public surface renders and links selected artifacts",
  "the repository records additional artifacts",
  "the system runs only the browser-side behavior and bounded protected-shell behavior"
];

for (const phrase of requiredDistinctions) {
  assertIncludes(readmeText, phrase, readmePath);
}

const boundary = config.non_implementation_boundary || {};
for (const field of [
  "runtime_behavior_changed",
  "backend_added",
  "database_connected",
  "supabase_migration_applied",
  "operational_use_claimed"
]) {
  if (boundary[field] !== false) {
    fail(`${configPath}: non_implementation_boundary.${field} must be false`);
  }
}

const readmePalisadeDecisions = validateReadmePalisadeConsumption(readmeText);

if (failures.length) {
  console.error("README artifact classification sobriety validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("README artifact classification sobriety ok");
console.log(`Artifact classes checked: ${requiredArtifactClasses.length}`);
console.log(`Boundary phrases checked: ${requiredBoundaryPhrases.length}`);
console.log(`Palisade-governed README claim classes checked: ${readmePalisadeDecisions.size}`);
