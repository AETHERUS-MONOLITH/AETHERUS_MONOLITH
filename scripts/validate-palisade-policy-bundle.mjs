import fs from "node:fs";
import path from "node:path";

import { evaluatePolicyDecision } from "../palisade/runtime/v0/palisade-policy-engine.mjs";

const bundleRoot = "palisade/policy-bundle.v0";
const manifestPath = path.posix.join(bundleRoot, "manifest.json");
const inputSchemaPath = path.posix.join(bundleRoot, "schema/policy-input.schema.json");
const decisionSchemaPath = path.posix.join(bundleRoot, "schema/policy-decision.schema.json");
const policyPath = path.posix.join(bundleRoot, "policies/claim-capability-policy.json");
const casesPath = path.posix.join(bundleRoot, "tests/claim-capability-policy.cases.json");

const requiredFiles = [
  manifestPath,
  inputSchemaPath,
  decisionSchemaPath,
  policyPath,
  casesPath
];

const manifestFields = [
  "bundle_id",
  "version",
  "owner",
  "status",
  "claim_boundary",
  "policy_scope",
  "evidence_inputs",
  "decision_outputs",
  "production_workspace_threshold",
  "runtime_governance_path",
  "integration_status",
  "evolution_threshold",
  "non_claims"
];

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

const evidenceStateFields = [
  "current_evidence",
  "missing_evidence",
  "required_evidence",
  "denied_claims",
  "evidence_notes"
];

const requiredDecisionFields = [
  "decision",
  "claim_id",
  "surface",
  "requested_action",
  "allowed",
  "reasons",
  "required_evidence",
  "missing_evidence",
  "operator_review_required",
  "runtime_enforcement_status",
  "current_state_basis",
  "next_evidence_threshold"
];

const decisionOutputs = [
  "allow",
  "deny",
  "requires_evidence",
  "requires_operator_review",
  "runtime_enforcement_unavailable"
];

const productionComponents = [
  "real_authenticated_shell",
  "applied_live_workspace_data_model",
  "server_side_authorization",
  "tenant_scoped_persistence",
  "verified_membership_account_separation",
  "operational_workspace_surfaces_backed_by_capability",
  "durable_evidence_audit_trail",
  "runtime_governance_path_for_real_user_workspace_input"
];

const runtimeComponents = [
  "user_workspace_input",
  "Facade",
  "Conduit",
  "Palisade_policy_decision",
  "Vault_NEXUS_evaluation",
  "evidence_audit_record",
  "release_state_decision",
  "surfaced_result"
];

const allowedComponentStates = new Set(["exists", "partial", "stubbed", "absent", "unverified"]);
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

function assertIncludesAll(actual, required, label) {
  if (!Array.isArray(actual)) {
    fail(`${label} must be an array`);
    return;
  }
  for (const item of required) {
    if (!actual.includes(item)) fail(`${label} missing ${item}`);
  }
}

function schemaRequired(schema, pointer) {
  let current = schema;
  for (const segment of pointer) {
    current = current?.[segment];
  }
  return Array.isArray(current?.required) ? current.required : [];
}

function componentSatisfied(component) {
  return component?.state === "exists" && component?.verified === true;
}

function allComponentsSatisfied(state, components) {
  return components.every((component) => componentSatisfied(state?.[component]));
}

function missingComponents(state, components) {
  return components.filter((component) => !componentSatisfied(state?.[component]));
}

function assertComponentStateSet(state, required, label) {
  if (!assertObject(state, label)) return;
  for (const component of required) {
    const entry = state[component];
    if (!assertObject(entry, `${label}.${component}`)) continue;
    if (!allowedComponentStates.has(entry.state)) {
      fail(`${label}.${component}.state must be exists, partial, stubbed, absent, or unverified`);
    }
    if (typeof entry.verified !== "boolean") {
      fail(`${label}.${component}.verified must be boolean`);
    }
    assertArray(entry.evidence, `${label}.${component}.evidence`);
  }
}

function assertDecisionShape(decision, label) {
  if (!assertObject(decision, label)) return;
  for (const field of requiredDecisionFields) {
    if (!(field in decision)) fail(`${label} missing ${field}`);
  }
  if (!decisionOutputs.includes(decision.decision)) fail(`${label}.decision has invalid value`);
  if (decision.allowed !== (decision.decision === "allow")) {
    fail(`${label}.allowed must match the allow decision`);
  }
  assertArray(decision.reasons, `${label}.reasons`);
  assertArray(decision.required_evidence, `${label}.required_evidence`);
  assertArray(decision.missing_evidence, `${label}.missing_evidence`);
  if (typeof decision.operator_review_required !== "boolean") {
    fail(`${label}.operator_review_required must be boolean`);
  }
  if (!["available", "unavailable", "not_applicable"].includes(decision.runtime_enforcement_status)) {
    fail(`${label}.runtime_enforcement_status is invalid`);
  }
  assertArray(decision.current_state_basis, `${label}.current_state_basis`);
  if (!assertObject(decision.next_evidence_threshold, `${label}.next_evidence_threshold`)) return;
  assertArray(decision.next_evidence_threshold.components, `${label}.next_evidence_threshold.components`);
}

for (const filePath of requiredFiles) {
  if (!fs.existsSync(filePath)) fail(`missing required file: ${filePath}`);
}

if (failures.length === 0) {
  const artifactText = requiredFiles.map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n");
  if (/\bminimal\b/i.test(artifactText)) {
    fail(`${bundleRoot}: rejected Palisade construction term appears`);
  }
  if (/\b(is|creates|provides|claims)\b.{0,80}\bproduction enforcement service maturity\b/i.test(artifactText)) {
    fail(`${bundleRoot}: artifact claims production enforcement service maturity`);
  }
  if (/\b(is|creates|provides|claims)\b.{0,80}\bPalisade runtime maturity\b/i.test(artifactText)) {
    fail(`${bundleRoot}: artifact claims Palisade runtime maturity`);
  }
  if (/\bsufficiently present\b|\bsufficiently connected\b/i.test(artifactText)) {
    fail(`${bundleRoot}: runtime sufficiency must be expressed as explicit component checks`);
  }

  const manifest = readJson(manifestPath);
  const inputSchema = readJson(inputSchemaPath);
  const decisionSchema = readJson(decisionSchemaPath);
  const policy = readJson(policyPath);
  const caseSet = readJson(casesPath);

  for (const field of manifestFields) {
    if (!(field in manifest)) fail(`${manifestPath}: missing ${field}`);
  }
  if (manifest.owner !== "Palisade") fail(`${manifestPath}: owner must be Palisade`);
  if (manifest.status !== "construction") fail(`${manifestPath}: status must be construction`);
  assertIncludesAll(manifest.evidence_inputs, requiredInputFields, `${manifestPath}.evidence_inputs`);
  assertIncludesAll(manifest.decision_outputs, decisionOutputs, `${manifestPath}.decision_outputs`);
  if (!manifest.evolution_threshold) fail(`${manifestPath}: missing evolution_threshold`);
  assertIncludesAll(
    manifest.production_workspace_threshold?.required_components,
    productionComponents,
    `${manifestPath}.production_workspace_threshold.required_components`
  );
  assertIncludesAll(
    manifest.runtime_governance_path?.path,
    runtimeComponents,
    `${manifestPath}.runtime_governance_path.path`
  );
  const runtimeRuleText = JSON.stringify(manifest.runtime_governance_path || {});
  for (const required of ["every required path component", "exists", "verified"]) {
    if (!runtimeRuleText.includes(required)) {
      fail(`${manifestPath}: runtime governance path sufficiency rule must mention ${required}`);
    }
  }

  assertIncludesAll(schemaRequired(inputSchema, []), requiredInputFields, `${inputSchemaPath}.required`);
  assertIncludesAll(
    schemaRequired(inputSchema, ["properties", "evidence_state"]),
    evidenceStateFields,
    `${inputSchemaPath}.properties.evidence_state.required`
  );
  assertIncludesAll(
    schemaRequired(inputSchema, ["$defs", "productionWorkspaceThresholdState"]),
    productionComponents,
    `${inputSchemaPath} production threshold shape`
  );
  assertIncludesAll(
    schemaRequired(inputSchema, ["$defs", "runtimeGovernancePathState"]),
    runtimeComponents,
    `${inputSchemaPath} runtime path shape`
  );
  assertIncludesAll(schemaRequired(decisionSchema, []), requiredDecisionFields, `${decisionSchemaPath}.required`);
  assertIncludesAll(
    decisionSchema.properties?.decision?.enum,
    decisionOutputs,
    `${decisionSchemaPath}.properties.decision.enum`
  );

  assertIncludesAll(
    policy.production_workspace_threshold?.required_components,
    productionComponents,
    `${policyPath}.production_workspace_threshold.required_components`
  );
  assertIncludesAll(
    policy.runtime_governance_path?.ordered_components,
    runtimeComponents,
    `${policyPath}.runtime_governance_path.ordered_components`
  );
  if (policy.runtime_governance_path?.sufficiency_rule?.type !== "all_components_exist_and_verified") {
    fail(`${policyPath}: runtime path sufficiency must be deterministic`);
  }
  assertIncludesAll(policy.decision_outputs, decisionOutputs, `${policyPath}.decision_outputs`);
  const ruleClaimIds = new Set((policy.rules || []).map((rule) => rule.claim_id));
  for (const claimId of [
    "production_workspace_claim",
    "public_nexus_runtime_execution_claim",
    "model_api_execution_claim",
    "operational_release_authority_claim",
    "staged_surface_advancement",
    "runtime_governance_path_sufficiency",
    "operator_review_escalation"
  ]) {
    if (!ruleClaimIds.has(claimId)) fail(`${policyPath}: missing rule for ${claimId}`);
  }

  if (!Array.isArray(caseSet.cases) || caseSet.cases.length === 0) {
    fail(`${casesPath}: cases must be a non-empty array`);
  }

  const coverage = {
    providerLoginOnly: false,
    callbackOnly: false,
    boundedPersistenceOnly: false,
    publicNexusRuntime: false,
    modelApiExecution: false,
    releaseAuthority: false,
    allowReachable: false,
    stagedRequiresEvidence: false,
    operatorReview: false
  };

  for (const [index, testCase] of (caseSet.cases || []).entries()) {
    const label = `${casesPath}.cases[${index}]`;
    if (!assertObject(testCase, label)) continue;
    for (const field of ["id", "description", "fixture_type", "input", "expected_decision"]) {
      if (!(field in testCase)) fail(`${label} missing ${field}`);
    }
    const input = testCase.input;
    if (!assertObject(input, `${label}.input`)) continue;
    for (const field of requiredInputFields) {
      if (!(field in input)) fail(`${testCase.id}: input missing ${field}`);
    }
    if (!assertObject(input.evidence_state, `${testCase.id}.evidence_state`)) continue;
    for (const field of evidenceStateFields) {
      assertArray(input.evidence_state[field], `${testCase.id}.evidence_state.${field}`);
    }
    assertComponentStateSet(
      input.production_workspace_threshold_state,
      productionComponents,
      `${testCase.id}.production_workspace_threshold_state`
    );
    assertComponentStateSet(
      input.runtime_governance_path_state,
      runtimeComponents,
      `${testCase.id}.runtime_governance_path_state`
    );

    const actual = evaluatePolicyDecision(policy, input);
    assertDecisionShape(actual, `${testCase.id}.actual_decision`);

    for (const field of ["decision", "allowed", "operator_review_required", "runtime_enforcement_status"]) {
      if (actual[field] !== testCase.expected_decision?.[field]) {
        fail(`${testCase.id}: expected ${field} ${testCase.expected_decision?.[field]}, got ${actual[field]}`);
      }
    }

    const currentEvidence = input.evidence_state.current_evidence || [];
    if (
      input.claim_id === "production_workspace_claim" &&
      currentEvidence.includes("provider_login") &&
      actual.decision === "deny"
    ) {
      coverage.providerLoginOnly = true;
    }
    if (
      input.claim_id === "production_workspace_claim" &&
      currentEvidence.includes("callback_recognition") &&
      currentEvidence.includes("protected_route_admission") &&
      actual.decision === "deny"
    ) {
      coverage.callbackOnly = true;
    }
    if (
      input.claim_id === "production_workspace_claim" &&
      currentEvidence.includes("bounded_save_load_persistence") &&
      actual.decision === "deny"
    ) {
      coverage.boundedPersistenceOnly = true;
    }
    if (input.claim_id === "public_nexus_runtime_execution_claim" && actual.decision === "deny") {
      coverage.publicNexusRuntime = true;
    }
    if (input.claim_id === "model_api_execution_claim" && actual.decision === "deny") {
      coverage.modelApiExecution = true;
    }
    if (input.claim_id === "operational_release_authority_claim" && actual.decision === "deny") {
      coverage.releaseAuthority = true;
    }
    if (input.claim_id === "staged_surface_advancement" && actual.decision === "requires_evidence") {
      coverage.stagedRequiresEvidence = true;
    }
    if (input.claim_id === "operator_review_escalation" && actual.decision === "requires_operator_review") {
      coverage.operatorReview = true;
    }
    if (actual.decision === "allow") {
      if (testCase.fixture_type !== "policy_test_fixture_hypothetical_complete_evidence") {
        fail(`${testCase.id}: allow fixture must be clearly marked as policy test fixture`);
      }
      const basisText = input.current_repository_state_basis.join(" ");
      if (!/not current repository state/i.test(basisText)) {
        fail(`${testCase.id}: hypothetical allow fixture must state it is not current repository state`);
      }
      if (
        allComponentsSatisfied(input.production_workspace_threshold_state, productionComponents) &&
        allComponentsSatisfied(input.runtime_governance_path_state, runtimeComponents)
      ) {
        coverage.allowReachable = true;
      } else {
        fail(`${testCase.id}: allow is only reachable when required thresholds are complete`);
      }
    }
  }

  for (const [key, passed] of Object.entries(coverage)) {
    if (!passed) fail(`${casesPath}: missing required test coverage for ${key}`);
  }
}

if (failures.length) {
  console.error("Palisade policy bundle validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Palisade policy bundle ok");
console.log(`Validated ${requiredFiles.length} files and policy cases from ${casesPath}`);
