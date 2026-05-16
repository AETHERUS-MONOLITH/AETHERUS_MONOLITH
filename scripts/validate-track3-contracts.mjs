#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const dataFiles = [
  'data/docs.json',
  'data/scenarios.json',
  'data/joint-workflow.manifest.json',
  'data/interface-contract.v0.json',
  'data/interface-fixture.example.v0.json',
  'data/interface-fixtures.v0.json',
  'data/nexus-adapter-readiness.v0.json',
  'data/nexus-adapter-contract.stub.v0.json',
  'data/nexus-adapter-mismatch-fixtures.v0.json',
  'data/nexus-adapter-normalization-fixtures.v0.json',
  'data/nexus-import-adapter-preflight.v0.json',
  'data/nexus-source-pin-resolution.v0.json',
  'data/nexus-pinned-source-preflight.v0.json',
  'data/nexus-import-adapter-report-contract.v0.json',
  'data/interface-contract.v1.json',
  'data/nexus-adapter-contract.v1.json',
  'data/nexus-import-adapter-report-contract.v1.json',
  'data/track3-local-report-export-manifest.v1.json',
  'data/conduit-versioning-policy.v1.json',
  'data/nexus-vault-version-compatibility.v1.json',
  'data/nexus-vault-compatibility-evaluation-fixtures.v1.json',
  'data/nexus-vault-compatibility-evidence-packet-contract.v1.json',
  'data/nexus-vault-compatibility-evidence-packet-fixtures.v1.json',
  'data/nexus-vault-candidate-intake-fixtures.v1.json'
];

const track3TextFiles = [
  'data/interface-contract.v0.json',
  'data/interface-fixture.example.v0.json',
  'data/interface-fixtures.v0.json',
  'data/nexus-adapter-readiness.v0.json',
  'data/nexus-adapter-contract.stub.v0.json',
  'data/nexus-adapter-mismatch-fixtures.v0.json',
  'data/nexus-adapter-normalization-fixtures.v0.json',
  'data/nexus-import-adapter-preflight.v0.json',
  'data/nexus-source-pin-resolution.v0.json',
  'data/nexus-pinned-source-preflight.v0.json',
  'data/nexus-import-adapter-report-contract.v0.json',
  'data/interface-contract.v1.json',
  'data/nexus-adapter-contract.v1.json',
  'data/nexus-import-adapter-report-contract.v1.json',
  'data/track3-local-report-export-manifest.v1.json',
  'data/conduit-versioning-policy.v1.json',
  'data/nexus-vault-version-compatibility.v1.json',
  'data/nexus-vault-compatibility-evaluation-fixtures.v1.json',
  'data/nexus-vault-compatibility-evidence-packet-contract.v1.json',
  'data/nexus-vault-compatibility-evidence-packet-fixtures.v1.json',
  'data/nexus-vault-candidate-intake-fixtures.v1.json',
  'docs/TRACK_3_INTERFACE_CONTRACTS.md',
  'docs/TRACK_3_SCHEMA_ALIGNMENT.md',
  'docs/TRACK_3_VALIDATION_HARNESS.md',
  'docs/TRACK_3_LOCAL_FIXTURE_RUNTIME.md',
  'docs/TRACK_3_FIXTURE_SUITE.md',
  'docs/TRACK_3_CONTRACT_INVARIANTS.md',
  'docs/TRACK_3_NEXUS_MVP_VERIFICATION.md',
  'docs/TRACK_3_NEXUS_ADAPTER_CONTRACT.md',
  'docs/TRACK_3_NEXUS_ADAPTER_MISMATCH_TESTS.md',
  'docs/TRACK_3_NEXUS_ADAPTER_NORMALIZER_STUB.md',
  'docs/TRACK_3_NEXUS_ADAPTER_NORMALIZER_SUITE.md',
  'docs/TRACK_3_IMPORT_ADAPTER_PREFLIGHT.md',
  'docs/TRACK_3_IMPORT_ENVIRONMENT_PREFLIGHT.md',
  'docs/TRACK_3_NEXUS_SOURCE_PIN_RESOLUTION.md',
  'docs/TRACK_3_PINNED_NEXUS_SOURCE_PREFLIGHT.md',
  'docs/TRACK_3_POST_COMMIT_IMPORT_READINESS.md',
  'docs/TRACK_3_LOCAL_NEXUS_IMPORT_ADAPTER.md',
  'docs/TRACK_3_NEXUS_IMPORT_ADAPTER_REGRESSION_SUITE.md',
  'docs/TRACK_3_NEXUS_IMPORT_ADAPTER_REPORT_CONTRACT.md',
  'docs/TRACK_3_NEXUS_IMPORT_ADAPTER_FAILURE_INJECTION.md',
  'docs/TRACK_3_NEXUS_IMPORT_ADAPTER_FAILURE_CATEGORY_COMPLETION.md',
  'docs/TRACK_3_CONTRACT_FREEZE_V1.md',
  'docs/TRACK_3_LOCAL_REPORT_EXPORT_BUNDLE.md',
  'docs/TRACK_3_CONDUIT_VERSIONING_STORY_V1.md',
  'docs/TRACK_3_MULTI_VAULT_COMPATIBILITY_EVALUATION_HARNESS_STUB.md',
  'docs/TRACK_3_VAULT_COMPATIBILITY_EVIDENCE_PACKET_CONTRACT.md',
  'docs/TRACK_3_VAULT_CANDIDATE_INTAKE_GATE_STUB.md'
];

const requiredScriptFiles = [
  'scripts/validate-nexus-adapter-normalizer-suite.mjs',
  'scripts/check-nexus-import-environment.mjs',
  'scripts/run-nexus-import-adapter-local.mjs',
  'scripts/run-nexus-import-adapter-regression-suite.mjs',
  'scripts/run-nexus-import-adapter-failure-injection-suite.mjs',
  'scripts/validate-nexus-import-adapter-reports.mjs',
  'scripts/export-track3-local-report-bundle.mjs',
  'scripts/evaluate-nexus-vault-compatibility-stub.mjs',
  'scripts/validate-nexus-vault-compatibility-evidence-packet.mjs',
  'scripts/run-nexus-vault-candidate-intake-gate-stub.mjs'
];

const requiredDocFiles = [
  'docs/TRACK_3_IMPORT_ENVIRONMENT_PREFLIGHT.md',
  'docs/TRACK_3_NEXUS_SOURCE_PIN_RESOLUTION.md',
  'docs/TRACK_3_PINNED_NEXUS_SOURCE_PREFLIGHT.md',
  'docs/TRACK_3_POST_COMMIT_IMPORT_READINESS.md',
  'docs/TRACK_3_LOCAL_NEXUS_IMPORT_ADAPTER.md',
  'docs/TRACK_3_NEXUS_IMPORT_ADAPTER_REGRESSION_SUITE.md',
  'docs/TRACK_3_NEXUS_IMPORT_ADAPTER_REPORT_CONTRACT.md',
  'docs/TRACK_3_NEXUS_IMPORT_ADAPTER_FAILURE_INJECTION.md',
  'docs/TRACK_3_NEXUS_IMPORT_ADAPTER_FAILURE_CATEGORY_COMPLETION.md',
  'docs/TRACK_3_CONTRACT_FREEZE_V1.md',
  'docs/TRACK_3_LOCAL_REPORT_EXPORT_BUNDLE.md',
  'docs/TRACK_3_CONDUIT_VERSIONING_STORY_V1.md',
  'docs/TRACK_3_MULTI_VAULT_COMPATIBILITY_EVALUATION_HARNESS_STUB.md',
  'docs/TRACK_3_VAULT_COMPATIBILITY_EVIDENCE_PACKET_CONTRACT.md',
  'docs/TRACK_3_VAULT_CANDIDATE_INTAKE_GATE_STUB.md'
];

const approvedMaturityLabels = new Set([
  'current_static',
  'current_simulated',
  'future_local_runtime',
  'future_backend',
  'future_authenticated',
  'future_nexus_adapter',
  'not_currently_implemented'
]);

const expectedContractSections = [
  'scenario',
  'gate',
  'verdict',
  'decision_explanation',
  'evidence_requirement',
  'artifact_reference',
  'release_eligibility',
  'trace_event',
  'handoff_receipt',
  'joint_workflow_reference',
  'nexus_adapter_boundary'
];

const allowedContextPattern = /\b(no|not|does not|do not|without|forbidden|forbidden_current|future|requires|required|before use|before public use|candidate|boundary|not_currently_implemented|not-operational|not currently|out of scope|unless|implies|no-)\b/i;

const forbiddenPhrasePatterns = [
  { label: 'runs NEXUS', pattern: /\bruns\s+nexus\b/i },
  { label: 'NEXUS execution', pattern: /\bnexus\s+execution\b/i },
  { label: 'live orchestration', pattern: /\blive\s+orchestration\b/i },
  { label: 'live Joint-Workflow execution', pattern: /\blive\s+joint-workflow\s+execution\b/i },
  { label: 'autonomous orchestration', pattern: /\bautonomous\s+orchestration\b/i },
  { label: 'active multi-joint runtime', pattern: /\bactive\s+multi-joint\s+runtime\b/i },
  { label: 'real Origin commit', pattern: /\breal\s+origin\s+commit\b/i },
  { label: 'real Communicator execution', pattern: /\breal\s+communicator.*execution\b/i },
  { label: 'real Mediator execution', pattern: /\breal\s+mediator.*execution\b/i },
  { label: 'real Drafter execution', pattern: /\breal\s+drafter.*execution\b/i },
  { label: 'real Refiner execution', pattern: /\breal\s+refiner.*execution\b/i },
  { label: 'persistent ledger', pattern: /\bpersistent\s+(audit\s+)?ledger\b/i },
  { label: 'backend trace storage', pattern: /\bbackend\s+trace\s+storage\b/i },
  { label: 'authenticated dashboard', pattern: /\bauthenticated\s+dashboard\b/i },
  { label: 'production SaaS', pattern: /\bproduction\s+saas\b/i },
  { label: 'deployed enterprise platform', pattern: /\bdeployed\s+enterprise\s+platform\b/i },
  { label: 'compliance-certified', pattern: /\bcompliance[-\s]+certified\b/i },
  { label: 'model API execution', pattern: /\bmodel\s+api\s+execution\b/i },
  { label: 'database-backed trace storage', pattern: /\bdatabase[-\s]+backed\s+trace\s+storage\b/i },
  { label: 'operational decision-making', pattern: /\boperational\s+decision[-\s]+making\b/i }
];

const failures = [];
const parsed = new Map();
const approvedVerdictStatuses = new Set(['pass', 'fail', 'escalate']);
const localTraceStatus = 'local_dry_run_not_persistent_not_ledger';
const requiredClaimBoundaryFlags = [
  'not_backend',
  'not_persisted',
  'not_ledger',
  'not_authenticated',
  'not_nexus_integrated',
  'not_model_executing',
  'not_public_operational_behavior'
];

const expectedTrack322BoundaryFalseFlags = [
  'public_runtime',
  'public_ui_wiring',
  'backend',
  'auth',
  'database',
  'persistence',
  'ledger',
  'model_execution',
  'live_orchestration',
  'palisade',
  'weave',
  'claim_escalation'
];

const expectedTrack322FailureCategories = [
  'nexus_path_missing',
  'nexus_commit_mismatch',
  'nexus_working_tree_dirty',
  'fixture_mapping_missing',
  'regulatory_context_missing',
  'manifest_mapping_missing',
  'nexus_execution_failure',
  'malformed_nexus_result',
  'unknown_nexus_verdict',
  'unknown_risk_level',
  'missing_omega_decision',
  'nondeterministic_output',
  'release_eligibility_incoherent',
  'trace_boundary_violation',
  'claim_boundary_violation'
];

const expectedTrack324MigrationStates = [
  'proposed',
  'locally_validated',
  'regression_validated',
  'failure_injection_validated',
  'accepted',
  'deprecated',
  'unsupported'
];

const expectedTrack325FixtureCategories = [
  'current_pinned_vault_supported',
  'unknown_candidate_commit',
  'missing_regression_evidence',
  'missing_failure_injection_evidence',
  'deterministic_identity_failure',
  'trace_boundary_violation',
  'verdict_or_eligibility_semantics_drift',
  'dirty_or_mismatched_source'
];

const expectedTrack325Statuses = [
  'supported_current',
  'candidate_not_evaluated',
  'candidate_blocked',
  'candidate_requires_full_evaluation',
  'incompatible',
  'invalid_fixture'
];

const expectedTrack326PacketFields = [
  'candidate_vault_commit',
  'candidate_source_status',
  'source_cleanliness',
  'source_origin_match',
  'import_adapter_regression_result',
  'failure_injection_result',
  'report_contract_validation_result',
  'deterministic_identity_result',
  'verdict_semantics_result',
  'release_eligibility_semantics_result',
  'trace_boundary_result',
  'ledger_boundary_result',
  'generated_artifacts_boundary_result',
  'public_claim_boundary_result',
  'compatibility_decision',
  'blocking_reasons',
  'evaluator_notes'
];

const expectedTrack326Decisions = [
  'accepted_current_supported',
  'candidate_packet_valid_but_not_supported',
  'candidate_packet_incomplete',
  'candidate_blocked',
  'candidate_incompatible',
  'invalid_packet'
];

const expectedTrack326FixtureIds = [
  'current_supported_vault_packet',
  'complete_non_pinned_candidate_packet_not_supported',
  'missing_regression_result',
  'missing_failure_injection_result',
  'deterministic_identity_failure',
  'verdict_semantics_drift',
  'release_eligibility_drift',
  'trace_boundary_violation',
  'ledger_boundary_violation',
  'dirty_source_packet',
  'generated_artifacts_staged',
  'public_claim_escalation'
];

const expectedTrack327IntakeDecisions = [
  'accepted_current_supported',
  'eligible_for_compatibility_evaluation',
  'blocked_missing_evidence',
  'blocked_failed_evidence',
  'blocked_semantic_drift',
  'blocked_boundary_violation',
  'blocked_source_mismatch',
  'invalid_intake_fixture'
];

const expectedTrack327FixtureIds = [
  'current_supported_vault_intake',
  'complete_non_pinned_candidate',
  'missing_packet',
  'incomplete_packet',
  'failed_deterministic_identity',
  'verdict_semantics_drift',
  'eligibility_semantics_drift',
  'trace_boundary_violation',
  'ledger_boundary_violation',
  'dirty_or_mismatched_source',
  'public_claim_escalation'
];

function relPath(filePath) {
  return path.relative(repoRoot, filePath);
}

function readText(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function addFailure(file, category, message) {
  failures.push({ file, category, message });
}

function parseJson(relativePath) {
  try {
    const value = JSON.parse(readText(relativePath));
    parsed.set(relativePath, value);
    return value;
  } catch (error) {
    addFailure(relativePath, 'JSON parse', error.message);
    return null;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requirePath(root, pathParts, file, category) {
  let current = root;
  for (const part of pathParts) {
    if (!isObject(current) && !Array.isArray(current)) {
      addFailure(file, category, `Missing ${pathParts.join('.')}`);
      return undefined;
    }
    current = current[part];
    if (current === undefined || current === null) {
      addFailure(file, category, `Missing ${pathParts.join('.')}`);
      return undefined;
    }
  }
  return current;
}

function walk(value, visitor, pathParts = []) {
  visitor(value, pathParts);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, [...pathParts, String(index)]));
    return;
  }
  if (isObject(value)) {
    Object.entries(value).forEach(([key, item]) => walk(item, visitor, [...pathParts, key]));
  }
}

function validateMaturityLabels(file, root) {
  walk(root, (value, pathParts) => {
    const key = pathParts[pathParts.length - 1];
    const parentPath = pathParts.slice(0, -1).join('.');
    const isContractFieldStatus = file === 'data/interface-contract.v0.json'
      && key === 'status'
      && parentPath.includes('contracts.');
    const isFieldStatus = key === 'field_status';

    if (!isFieldStatus && !isContractFieldStatus) return;
    if (typeof value !== 'string') {
      addFailure(file, 'Maturity labels', `${pathParts.join('.')} must be a string maturity label`);
      return;
    }
    if (!approvedMaturityLabels.has(value)) {
      addFailure(file, 'Maturity labels', `${pathParts.join('.')} uses unapproved maturity label "${value}"`);
    }
  });
}

function validateContractShape(contract) {
  const file = 'data/interface-contract.v0.json';
  requirePath(contract, ['metadata'], file, 'Contract structure');
  requirePath(contract, ['runtime_status_vocabulary'], file, 'Contract structure');
  requirePath(contract, ['contracts'], file, 'Contract structure');

  const vocabulary = requirePath(contract, ['field_status_vocabulary'], file, 'Contract structure');
  if (Array.isArray(vocabulary)) {
    vocabulary.forEach(label => {
      if (!approvedMaturityLabels.has(label)) {
        addFailure(file, 'Contract structure', `field_status_vocabulary contains unapproved label "${label}"`);
      }
    });
    approvedMaturityLabels.forEach(label => {
      if (!vocabulary.includes(label)) {
        addFailure(file, 'Contract structure', `field_status_vocabulary is missing "${label}"`);
      }
    });
  } else {
    addFailure(file, 'Contract structure', 'field_status_vocabulary must be an array');
  }

  const contracts = contract.contracts || {};
  expectedContractSections.forEach(section => {
    if (!contracts[section]) {
      addFailure(file, 'Contract structure', `contracts.${section} is missing`);
    }
  });
}

function validateFixtureAlignment(fixture, scenarios, options = {}) {
  const file = options.file || 'data/interface-fixture.example.v0.json';
  const label = options.label || 'fixture';
  requirePath(fixture, ['metadata'], file, 'Fixture alignment');
  const scenario = requirePath(fixture, ['scenario'], file, 'Fixture alignment');
  if (!scenario) return;

  [
    'scenario_input',
    'governance_manifest_reference',
    'verdict',
    'decision_explanation',
    'evidence_requirements',
    'release_eligibility',
    'runtime_status'
  ].forEach(key => requirePath(scenario, [key], file, 'Fixture alignment'));

  if (!scenario.gates && !scenario.gate_results) {
    addFailure(file, 'Fixture alignment', 'Scenario must include gates or gate_results');
  }

  const scenarioIds = new Set((scenarios.scenarios || []).map(item => item.id));
  if (options.expectedScenarioId && scenario.id !== options.expectedScenarioId) {
    addFailure(file, 'Scenario derivation', `Expected fixture scenario id "happy_path_valid_release", found "${scenario.id}"`);
  }
  if (!scenarioIds.has(scenario.id)) {
    addFailure(file, 'Scenario derivation', `${label} references missing scenario id "${scenario.id}"`);
  }

  const sourceScenario = fixture.metadata && fixture.metadata.source_scenario;
  if (sourceScenario && !sourceScenario.includes(scenario.id)) {
    addFailure(file, 'Scenario derivation', `${label} metadata.source_scenario does not reference ${scenario.id}: ${sourceScenario}`);
  }

  const traceEvents = scenario.trace_events;
  if (!traceEvents) {
    addFailure(file, 'Fixture alignment', 'Scenario must include trace_events');
    return;
  }

  const traceBoundary = JSON.stringify(traceEvents).toLowerCase();
  if (!traceBoundary.includes('illustrative') && !traceBoundary.includes('placeholder')) {
    addFailure(file, 'Fixture alignment', 'trace_events must be clearly marked illustrative or placeholder');
  }
  if (!traceBoundary.includes('not persistent') && !traceBoundary.includes('not a persistent ledger')) {
    addFailure(file, 'Fixture alignment', 'trace_events must state they are not persistent ledger records');
  }

  validateRuntimeBoundaryFlags(file, scenario, label);
  validateTraceStatus(file, scenario, label);
  validateVerdictVocabulary(file, scenario, label);
  validateReleaseEligibilityCoherence(file, scenario, label);
}

function validateRuntimeBoundaryFlags(file, scenario, label) {
  const boundary = scenario.claim_boundary || {};
  const scenarioText = JSON.stringify(scenario).toLowerCase();

  requiredClaimBoundaryFlags.forEach(flag => {
    if (boundary[flag] !== true) {
      addFailure(file, 'Runtime boundary invariants', `${label} must encode claim_boundary.${flag}: true`);
    }
  });

  [
    ['backend', /not[_\s-]backend|no backend/],
    ['persistence', /not[_\s-]persisted|not persistent|no persistence/],
    ['ledger', /not[_\s-]ledger|not persistent ledger|not a persistent ledger|no ledger/],
    ['NEXUS execution', /not nexus execution|no nexus|not[_\s-]nexus[_\s-]integrated|not_currently_implemented/],
    ['model execution', /not model execution|not-model-executing|not[_\s-]model[_\s-]executing|no model/],
    ['public operational behavior', /not public operational behavior|not[_\s-]public[_\s-]operational[_\s-]behavior|no public operational/]
  ].forEach(([boundaryName, boundaryPattern]) => {
    if (!boundaryPattern.test(scenarioText)) {
      addFailure(file, 'Runtime boundary invariants', `${label} does not clearly bound ${boundaryName}`);
    }
  });
}

function validateTraceStatus(file, scenario, label) {
  const traceEvents = scenario.trace_events;
  if (!traceEvents || !Array.isArray(traceEvents.items)) {
    addFailure(file, 'Trace boundary invariants', `${label} must include trace_events.items`);
    return;
  }

  traceEvents.items.forEach((event, index) => {
    if (event.trace_status !== localTraceStatus) {
      addFailure(file, 'Trace boundary invariants', `${label} trace_events.items[${index}].trace_status must be ${localTraceStatus}`);
    }
    const text = JSON.stringify(event).toLowerCase();
    if (/\bledger record\b|\bimmutable ledger entry\b|\bpersistent audit record\b|\bproduction trace\b/.test(text)) {
      addFailure(file, 'Trace boundary invariants', `${label} trace event ${index} uses prohibited trace terminology`);
    }
  });
}

function validateVerdictVocabulary(file, scenario, label) {
  const status = scenario.verdict && scenario.verdict.status;
  if (!approvedVerdictStatuses.has(status)) {
    addFailure(file, 'Verdict invariants', `${label} has unapproved verdict status "${status}"`);
  }
}

function validateReleaseEligibilityCoherence(file, scenario, label) {
  const eligible = scenario.release_eligibility && scenario.release_eligibility.eligible === true;
  if (!eligible) return;

  const verdictStatus = scenario.verdict && scenario.verdict.status;
  if (verdictStatus === 'fail' || verdictStatus === 'escalate') {
    addFailure(file, 'Release eligibility invariants', `${label} is release-eligible with blocking verdict "${verdictStatus}"`);
  }

  const gateResults = Array.isArray(scenario.gate_results) ? scenario.gate_results : [];
  if (!gateResults.length) {
    addFailure(file, 'Release eligibility invariants', `${label} is release-eligible without gate results`);
  }
  gateResults.forEach(result => {
    if (['fail', 'escalate', 'blocked'].includes(result.status)) {
      addFailure(file, 'Release eligibility invariants', `${label} is release-eligible with blocking gate ${result.gate_id}:${result.status}`);
    }
  });

  const requirements = Array.isArray(scenario.evidence_requirements) ? scenario.evidence_requirements : [];
  requirements.forEach((requirement, index) => {
    const status = requirement.required_for_status;
    if (
      requirement.evidence_present === false
      && (status === 'static_interface_seed' || status === 'deterministic_static_simulation')
    ) {
      addFailure(file, 'Release eligibility invariants', `${label} is release-eligible while current-status evidence requirement ${index} is unresolved`);
    }
  });
}

function validateFixtureSuite(suite, scenarios) {
  const file = 'data/interface-fixtures.v0.json';
  requirePath(suite, ['metadata'], file, 'Fixture suite');
  requirePath(suite, ['fixture_policy'], file, 'Fixture suite');
  const fixtures = requirePath(suite, ['fixtures'], file, 'Fixture suite');

  if (!Array.isArray(fixtures) || !fixtures.length) {
    addFailure(file, 'Fixture suite', 'fixtures must be a non-empty array');
    return;
  }

  const scenarioIds = new Set((scenarios.scenarios || []).map(item => item.id));
  const fixtureCounts = new Map();

  fixtures.forEach((fixture, index) => {
    const scenarioId = fixture && fixture.scenario && fixture.scenario.id;
    if (scenarioId) fixtureCounts.set(scenarioId, (fixtureCounts.get(scenarioId) || 0) + 1);
    validateFixtureAlignment(fixture, scenarios, {
      file,
      label: `fixtures[${index}]`
    });

    if (scenarioId && !scenarioIds.has(scenarioId)) {
      addFailure(file, 'Scenario coverage invariants', `Orphan suite fixture references unknown scenario ${scenarioId}`);
    }
  });

  scenarioIds.forEach(id => {
    const count = fixtureCounts.get(id) || 0;
    if (count === 0) {
      addFailure(file, 'Scenario coverage invariants', `Missing suite fixture for scenario ${id}`);
    }
    if (count > 1) {
      addFailure(file, 'Scenario coverage invariants', `Duplicate suite fixtures for scenario ${id}: ${count}`);
    }
  });
}

function validateManifestAlignment(contract, fixture, fixtureFile = 'data/interface-fixture.example.v0.json') {
  const files = [
    ['data/interface-contract.v0.json', JSON.stringify(contract)],
    [fixtureFile, JSON.stringify(fixture)]
  ];

  files.forEach(([file, text]) => {
    const lower = text.toLowerCase();
    if (lower.includes('joint-workflow') && !/(reference|mapping|future|not_currently_implemented|not-operational|candidate)/i.test(text)) {
      addFailure(file, 'Joint-Workflow alignment', 'Joint-Workflow is referenced without reference/mapping/future/not-currently-implemented context');
    }
    if (lower.includes('nexus') && !/(future|not_currently_implemented|no nexus|not generated by backend runtime, nexus|not-operational|boundary)/i.test(text)) {
      addFailure(file, 'NEXUS boundary', 'NEXUS is referenced without future/not-currently-implemented boundary context');
    }
  });
}

function validateNexusAdapterReadiness(readiness) {
  const file = 'data/nexus-adapter-readiness.v0.json';
  requirePath(readiness, ['metadata'], file, 'NEXUS adapter readiness');
  requirePath(readiness, ['inspected_repository'], file, 'NEXUS adapter readiness');
  requirePath(readiness, ['readiness_level'], file, 'NEXUS adapter readiness');
  requirePath(readiness, ['execution_surface'], file, 'NEXUS adapter readiness');
  requirePath(readiness, ['input_contract_status'], file, 'NEXUS adapter readiness');
  requirePath(readiness, ['output_contract_status'], file, 'NEXUS adapter readiness');
  requirePath(readiness, ['test_status'], file, 'NEXUS adapter readiness');
  requirePath(readiness, ['ledger_boundary_status'], file, 'NEXUS adapter readiness');
  requirePath(readiness, ['recommended_adapter_strategy'], file, 'NEXUS adapter readiness');
  requirePath(readiness, ['claim_boundaries'], file, 'NEXUS adapter readiness');

  const allowedReadinessLevels = new Set([
    'not_ready',
    'documentation_only',
    'fixture_exchange_ready',
    'cli_wrapper_ready',
    'import_adapter_ready',
    'service_adapter_ready'
  ]);
  if (!allowedReadinessLevels.has(readiness.readiness_level)) {
    addFailure(file, 'NEXUS adapter readiness', `readiness_level uses unapproved value "${readiness.readiness_level}"`);
  }

  const integrationStatus = readiness.metadata && readiness.metadata.integration_status;
  if (integrationStatus !== 'not_integrated') {
    addFailure(file, 'NEXUS adapter readiness', `metadata.integration_status must be "not_integrated", found "${integrationStatus}"`);
  }
  const claimBoundaryStatus = readiness.metadata && readiness.metadata.claim_boundary_status;
  if (claimBoundaryStatus !== 'bounded') {
    addFailure(file, 'NEXUS adapter readiness', `metadata.claim_boundary_status must be "bounded", found "${claimBoundaryStatus}"`);
  }

  const strategy = readiness.recommended_adapter_strategy || {};
  [
    'public_site_wiring',
    'backend_required_now',
    'auth_required_now',
    'persistence_required_now',
    'model_calls_allowed_now'
  ].forEach(flag => {
    if (strategy[flag] !== false) {
      addFailure(file, 'NEXUS adapter readiness', `recommended_adapter_strategy.${flag} must be false`);
    }
  });

  const ledgerBoundary = readiness.ledger_boundary_status || {};
  if (ledgerBoundary.aetherus_ledger_claim_allowed !== false) {
    addFailure(file, 'NEXUS adapter readiness', 'ledger_boundary_status.aetherus_ledger_claim_allowed must be false');
  }
  if (ledgerBoundary.hash_chaining_verified !== false) {
    addFailure(file, 'NEXUS adapter readiness', 'ledger_boundary_status.hash_chaining_verified must be false unless separately verified');
  }

  const text = JSON.stringify(readiness).toLowerCase();
  if (text.includes('integrated into the live site') && !text.includes('not_integrated')) {
    addFailure(file, 'NEXUS adapter readiness', 'Live-site integration language must remain explicitly bounded');
  }
}

function validateNexusAdapterContractStub(stub) {
  const file = 'data/nexus-adapter-contract.stub.v0.json';
  requirePath(stub, ['metadata'], file, 'NEXUS adapter contract stub');
  requirePath(stub, ['verified_nexus_surface'], file, 'NEXUS adapter contract stub');
  requirePath(stub, ['adapter_input_stub'], file, 'NEXUS adapter contract stub');
  requirePath(stub, ['nexus_payload_stub'], file, 'NEXUS adapter contract stub');
  requirePath(stub, ['nexus_result_stub'], file, 'NEXUS adapter contract stub');
  requirePath(stub, ['normalized_interface_result_stub'], file, 'NEXUS adapter contract stub');
  requirePath(stub, ['mismatch_policy'], file, 'NEXUS adapter contract stub');
  requirePath(stub, ['forbidden_claims'], file, 'NEXUS adapter contract stub');

  const metadata = stub.metadata || {};
  if (metadata.status !== 'stub_only') {
    addFailure(file, 'NEXUS adapter contract stub', `metadata.status must be "stub_only", found "${metadata.status}"`);
  }
  if (metadata.integration_status !== 'not_integrated') {
    addFailure(file, 'NEXUS adapter contract stub', `metadata.integration_status must be "not_integrated", found "${metadata.integration_status}"`);
  }

  [
    'nexus_execution',
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, 'NEXUS adapter contract stub', `metadata.${flag} must be false`);
    }
  });

  const verified = stub.verified_nexus_surface || {};
  if (verified.inspected_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, 'NEXUS adapter contract stub', `verified_nexus_surface.inspected_commit must match ab95cbbd24df5817c4e363d24b3b199ac8af6c6f`);
  }

  const readinessOrder = new Map([
    ['not_ready', 0],
    ['documentation_only', 1],
    ['fixture_exchange_ready', 2],
    ['cli_wrapper_ready', 3],
    ['import_adapter_ready', 4],
    ['service_adapter_ready', 5]
  ]);
  const readiness = verified.readiness_level;
  if (!readinessOrder.has(readiness)) {
    addFailure(file, 'NEXUS adapter contract stub', `verified_nexus_surface.readiness_level uses unapproved value "${readiness}"`);
  } else if (readinessOrder.get(readiness) > readinessOrder.get('import_adapter_ready')) {
    addFailure(file, 'NEXUS adapter contract stub', `verified_nexus_surface.readiness_level must not exceed import_adapter_ready`);
  }

  const surfaces = new Set(verified.execution_surfaces || []);
  ['python_import', 'cli_demo_runner'].forEach(surface => {
    if (!surfaces.has(surface)) {
      addFailure(file, 'NEXUS adapter contract stub', `verified_nexus_surface.execution_surfaces missing "${surface}"`);
    }
  });

  const ledgerBoundary = new Set(verified.ledger_boundary || []);
  if (!ledgerBoundary.has('not_production_ledger')) {
    addFailure(file, 'NEXUS adapter contract stub', 'verified_nexus_surface.ledger_boundary must include not_production_ledger');
  }
  if (!ledgerBoundary.has('hash_chaining_not_implemented')) {
    addFailure(file, 'NEXUS adapter contract stub', 'verified_nexus_surface.ledger_boundary must include hash_chaining_not_implemented');
  }

  const runtimeFlags = stub.adapter_input_stub && stub.adapter_input_stub.runtime_boundary_flags;
  [
    'not_integrated',
    'not_backend',
    'not_authenticated',
    'not_persistent',
    'not_ledger',
    'not_model_executing',
    'not_public_runtime'
  ].forEach(flag => {
    if (!runtimeFlags || runtimeFlags[flag] !== true) {
      addFailure(file, 'NEXUS adapter contract stub', `adapter_input_stub.runtime_boundary_flags.${flag} must be true`);
    }
  });

  const normalizedBoundary = stub.normalized_interface_result_stub && stub.normalized_interface_result_stub.claim_boundary;
  [
    'not_integrated',
    'not_backend',
    'not_authenticated',
    'not_persistent',
    'not_ledger',
    'not_model_executing',
    'not_public_runtime'
  ].forEach(flag => {
    if (!normalizedBoundary || normalizedBoundary[flag] !== true) {
      addFailure(file, 'NEXUS adapter contract stub', `normalized_interface_result_stub.claim_boundary.${flag} must be true`);
    }
  });
}

function validateNexusAdapterMismatchFixtures(suite, contract) {
  const file = 'data/nexus-adapter-mismatch-fixtures.v0.json';
  requirePath(suite, ['metadata'], file, 'NEXUS adapter mismatch fixtures');
  requirePath(suite, ['fixture_policy'], file, 'NEXUS adapter mismatch fixtures');
  const fixtures = requirePath(suite, ['fixtures'], file, 'NEXUS adapter mismatch fixtures');

  if (!Array.isArray(fixtures) || !fixtures.length) {
    addFailure(file, 'NEXUS adapter mismatch fixtures', 'fixtures must be a non-empty array');
    return;
  }

  const metadata = suite.metadata || {};
  if (metadata.integration_status !== 'not_integrated') {
    addFailure(file, 'NEXUS adapter mismatch fixtures', 'metadata.integration_status must be not_integrated');
  }
  [
    'nexus_execution',
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, 'NEXUS adapter mismatch fixtures', `metadata.${flag} must be false`);
    }
  });

  const policy = contract && contract.mismatch_policy ? contract.mismatch_policy : {};
  const categoryCounts = new Map();
  fixtures.forEach((fixture, index) => {
    const label = fixture.fixture_id || `fixtures[${index}]`;
    [
      'fixture_id',
      'mismatch_category',
      'input_stub',
      'simulated_nexus_like_result',
      'expected_adapter_behavior',
      'expected_normalized_verdict',
      'expected_release_eligibility',
      'expected_trace_boundary',
      'expected_claim_boundary',
      'integration_status'
    ].forEach(key => {
      if (fixture[key] === undefined || fixture[key] === null) {
        addFailure(file, 'NEXUS adapter mismatch fixtures', `${label} missing ${key}`);
      }
    });

    categoryCounts.set(fixture.mismatch_category, (categoryCounts.get(fixture.mismatch_category) || 0) + 1);
    if (!policy[fixture.mismatch_category]) {
      addFailure(file, 'NEXUS adapter mismatch fixtures', `${label} category is not present in contract mismatch_policy`);
    }
    if (fixture.integration_status !== 'not_integrated') {
      addFailure(file, 'NEXUS adapter mismatch fixtures', `${label} integration_status must be not_integrated`);
    }
    [
      'nexus_execution',
      'public_runtime',
      'persistence',
      'ledger',
      'model_execution',
      'backend'
    ].forEach(flag => {
      if (fixture[flag] !== false) {
        addFailure(file, 'NEXUS adapter mismatch fixtures', `${label} ${flag} must be false`);
      }
    });
    if (fixture.expected_normalized_verdict !== 'escalate') {
      addFailure(file, 'NEXUS adapter mismatch fixtures', `${label} must normalize to escalate`);
    }
    if (fixture.expected_release_eligibility !== false) {
      addFailure(file, 'NEXUS adapter mismatch fixtures', `${label} must block release eligibility`);
    }

    const traceStatus = fixture.expected_trace_boundary && fixture.expected_trace_boundary.trace_status;
    if (!traceStatus || !traceStatus.includes('not_persistent') || !traceStatus.includes('not_ledger')) {
      addFailure(file, 'NEXUS adapter mismatch fixtures', `${label} trace boundary must be non-persistent and non-ledger`);
    }
  });

  Object.keys(policy).forEach(category => {
    const count = categoryCounts.get(category) || 0;
    if (count === 0) {
      addFailure(file, 'NEXUS adapter mismatch fixtures', `Missing fixture for mismatch_policy category ${category}`);
    }
    if (count > 1) {
      addFailure(file, 'NEXUS adapter mismatch fixtures', `Duplicate fixtures for mismatch_policy category ${category}: ${count}`);
    }
  });
}

function validateNexusAdapterNormalizationFixtures(suite) {
  const file = 'data/nexus-adapter-normalization-fixtures.v0.json';
  const requiredCategories = new Set([
    'nexus_like_release_candidate',
    'nexus_like_escalation_candidate',
    'nexus_like_freeze_candidate',
    'nexus_like_repair_candidate',
    'nexus_like_audit_log_reference',
    'nexus_like_manifest_routing',
    'nexus_like_deterministic_duplicate'
  ]);

  requirePath(suite, ['metadata'], file, 'NEXUS adapter normalization fixtures');
  requirePath(suite, ['fixture_policy'], file, 'NEXUS adapter normalization fixtures');
  const fixtures = requirePath(suite, ['fixtures'], file, 'NEXUS adapter normalization fixtures');

  if (!Array.isArray(fixtures) || !fixtures.length) {
    addFailure(file, 'NEXUS adapter normalization fixtures', 'fixtures must be a non-empty array');
    return;
  }

  const metadata = suite.metadata || {};
  if (metadata.reference_nexus_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, 'NEXUS adapter normalization fixtures', 'metadata.reference_nexus_commit must match ab95cbbd24df5817c4e363d24b3b199ac8af6c6f');
  }
  if (metadata.integration_status !== 'not_integrated') {
    addFailure(file, 'NEXUS adapter normalization fixtures', 'metadata.integration_status must be not_integrated');
  }
  [
    'nexus_execution',
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, 'NEXUS adapter normalization fixtures', `metadata.${flag} must be false`);
    }
  });

  const categoryCounts = new Map();
  fixtures.forEach((fixture, index) => {
    const label = fixture.fixture_id || `fixtures[${index}]`;
    [
      'fixture_id',
      'normalization_category',
      'adapter_input_stub',
      'simulated_nexus_like_result',
      'expected_normalized_interface_result',
      'expected_verdict',
      'expected_release_eligibility',
      'expected_gate_results',
      'expected_evidence_requirements',
      'expected_trace_boundary',
      'expected_claim_boundary',
      'integration_status'
    ].forEach(key => {
      if (fixture[key] === undefined || fixture[key] === null) {
        addFailure(file, 'NEXUS adapter normalization fixtures', `${label} missing ${key}`);
      }
    });

    categoryCounts.set(fixture.normalization_category, (categoryCounts.get(fixture.normalization_category) || 0) + 1);

    if (fixture.integration_status !== 'not_integrated') {
      addFailure(file, 'NEXUS adapter normalization fixtures', `${label} integration_status must be not_integrated`);
    }
    [
      'nexus_execution',
      'public_runtime',
      'persistence',
      'ledger',
      'model_execution',
      'backend'
    ].forEach(flag => {
      if (fixture[flag] !== false) {
        addFailure(file, 'NEXUS adapter normalization fixtures', `${label} ${flag} must be false`);
      }
    });

    if (!approvedVerdictStatuses.has(fixture.expected_verdict)) {
      addFailure(file, 'NEXUS adapter normalization fixtures', `${label} expected_verdict must be pass, fail, or escalate`);
    }
    if ((fixture.expected_verdict === 'fail' || fixture.expected_verdict === 'escalate') && fixture.expected_release_eligibility === true) {
      addFailure(file, 'NEXUS adapter normalization fixtures', `${label} cannot be release eligible with ${fixture.expected_verdict}`);
    }

    const traceStatus = fixture.expected_trace_boundary && fixture.expected_trace_boundary.trace_status;
    if (traceStatus !== 'local_dry_run_not_persistent_not_ledger') {
      addFailure(file, 'NEXUS adapter normalization fixtures', `${label} trace boundary must be local_dry_run_not_persistent_not_ledger`);
    }
    if (!fixture.expected_trace_boundary || fixture.expected_trace_boundary.not_persistent !== true || fixture.expected_trace_boundary.not_ledger !== true) {
      addFailure(file, 'NEXUS adapter normalization fixtures', `${label} trace boundary must state not_persistent and not_ledger`);
    }

    const text = JSON.stringify(fixture).toLowerCase();
    if (/\bledger_valid"\s*:\s*true/.test(text) || /\bpersistent ledger\b|\bproduction ledger\b/.test(text)) {
      addFailure(file, 'NEXUS adapter normalization fixtures', `${label} must not claim ledger validity`);
    }
    if (/\bruns\s+nexus\b|\bnexus powers\b|\blive governance kernel\b|\bproduction runtime\b/.test(text)) {
      addFailure(file, 'NEXUS adapter normalization fixtures', `${label} contains unbounded operational language`);
    }
  });

  requiredCategories.forEach(category => {
    const count = categoryCounts.get(category) || 0;
    if (count === 0) {
      addFailure(file, 'NEXUS adapter normalization fixtures', `Missing fixture for ${category}`);
    }
    if (count > 1) {
      addFailure(file, 'NEXUS adapter normalization fixtures', `Duplicate fixtures for ${category}: ${count}`);
    }
  });
}

function validateNexusImportAdapterPreflight(preflight) {
  const file = 'data/nexus-import-adapter-preflight.v0.json';
  requirePath(preflight, ['metadata'], file, 'NEXUS import adapter preflight');
  requirePath(preflight, ['reference_commits'], file, 'NEXUS import adapter preflight');
  requirePath(preflight, ['required_conditions'], file, 'NEXUS import adapter preflight');
  requirePath(preflight, ['future_adapter_scope'], file, 'NEXUS import adapter preflight');
  requirePath(preflight, ['stop_conditions'], file, 'NEXUS import adapter preflight');
  requirePath(preflight, ['required_future_report_fields'], file, 'NEXUS import adapter preflight');
  requirePath(preflight, ['claim_boundary'], file, 'NEXUS import adapter preflight');

  const metadata = preflight.metadata || {};
  if (metadata.status !== 'preflight_only') {
    addFailure(file, 'NEXUS import adapter preflight', `metadata.status must be preflight_only, found "${metadata.status}"`);
  }
  if (metadata.integration_status !== 'not_integrated') {
    addFailure(file, 'NEXUS import adapter preflight', `metadata.integration_status must be not_integrated, found "${metadata.integration_status}"`);
  }

  [
    'nexus_execution',
    'python_execution',
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, 'NEXUS import adapter preflight', `metadata.${flag} must be false`);
    }
  });

  const referenceCommits = preflight.reference_commits || {};
  if (referenceCommits.aetherus_baseline !== '3bab5579813fb9f18ac73288fc05c84c9802c9c8') {
    addFailure(file, 'NEXUS import adapter preflight', 'reference_commits.aetherus_baseline must match 3bab5579813fb9f18ac73288fc05c84c9802c9c8');
  }
  if (referenceCommits.nexus_reference_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, 'NEXUS import adapter preflight', 'reference_commits.nexus_reference_commit must match ab95cbbd24df5817c4e363d24b3b199ac8af6c6f');
  }

  const requiredConditions = preflight.required_conditions || {};
  [
    'repository',
    'dependency',
    'execution',
    'adapter_contract',
    'boundary',
    'security',
    'rollback'
  ].forEach(key => {
    if (!Array.isArray(requiredConditions[key]) || !requiredConditions[key].length) {
      addFailure(file, 'NEXUS import adapter preflight', `required_conditions.${key} must be a non-empty array`);
    }
  });

  const scope = preflight.future_adapter_scope || {};
  if (!Array.isArray(scope.allowed_if_authorized) || !scope.allowed_if_authorized.length) {
    addFailure(file, 'NEXUS import adapter preflight', 'future_adapter_scope.allowed_if_authorized must be a non-empty array');
  }
  if (!Array.isArray(scope.forbidden_without_separate_authorization) || !scope.forbidden_without_separate_authorization.length) {
    addFailure(file, 'NEXUS import adapter preflight', 'future_adapter_scope.forbidden_without_separate_authorization must be a non-empty array');
  }

  const stopText = Array.isArray(preflight.stop_conditions)
    ? preflight.stop_conditions.join(' ').toLowerCase()
    : '';
  [
    ['NEXUS commit mismatch', /nexus commit mismatch/],
    ['nondeterministic output', /nondeterministic/],
    ['missing Omega decision', /missing omega decision/],
    ['JSONL audit treated as ledger', /jsonl audit.*ledger/],
    ['release eligibility true after fail/escalate', /release eligibility true after fail\/escalate/],
    ['public claim escalation', /public claim escalation/]
  ].forEach(([label, pattern]) => {
    if (!pattern.test(stopText)) {
      addFailure(file, 'NEXUS import adapter preflight', `stop_conditions must include ${label}`);
    }
  });

  const reportFields = new Set(preflight.required_future_report_fields || []);
  [
    'meta.track_phase',
    'meta.run_mode',
    'meta.integration_status',
    'meta.nexus_execution',
    'meta.public_runtime',
    'meta.persistence',
    'meta.ledger',
    'meta.model_execution',
    'meta.backend',
    'source.aetherus_commit',
    'source.nexus_commit',
    'source.adapter_contract_file',
    'source.fixture_id',
    'adapter_input',
    'nexus_invocation_boundary',
    'raw_nexus_result_boundary',
    'normalized_interface_result',
    'release_eligibility',
    'trace_boundary',
    'claim_boundary',
    'failure_mode'
  ].forEach(field => {
    if (!reportFields.has(field)) {
      addFailure(file, 'NEXUS import adapter preflight', `required_future_report_fields missing ${field}`);
    }
  });

  const claimBoundary = preflight.claim_boundary || {};
  if (!Array.isArray(claimBoundary.allowed_after_track_3_12) || !claimBoundary.allowed_after_track_3_12.length) {
    addFailure(file, 'NEXUS import adapter preflight', 'claim_boundary.allowed_after_track_3_12 must be a non-empty array');
  }
  const forbidden = Array.isArray(claimBoundary.forbidden_after_track_3_12)
    ? claimBoundary.forbidden_after_track_3_12.join(' ').toLowerCase()
    : '';
  [
    'aetherus_monolith runs nexus',
    'nexus powers the public interface',
    'nexus-integrated system',
    'live governance kernel',
    'persistent nexus ledger',
    'production runtime'
  ].forEach(phrase => {
    if (!forbidden.includes(phrase)) {
      addFailure(file, 'NEXUS import adapter preflight', `claim_boundary.forbidden_after_track_3_12 missing "${phrase}"`);
    }
  });
}

function validateNexusImportEnvironmentPreflightScript() {
  const file = 'scripts/check-nexus-import-environment.mjs';
  if (!existsSync(path.join(repoRoot, file))) {
    addFailure(file, 'NEXUS import environment preflight', 'Environment preflight script is missing');
    return;
  }

  const text = readText(file);
  const prohibitedInvocationPatterns = [
    { label: 'pytest invocation', pattern: /(?:spawnSync|runCommand)\s*\([^)]*['"]pytest['"]/i },
    { label: 'demo_runner.py invocation', pattern: /(?:spawnSync|runCommand)\s*\([^)]*demo_runner\.py/i },
    { label: 'prove_determinism.py invocation', pattern: /(?:spawnSync|runCommand)\s*\([^)]*prove_determinism\.py/i },
    { label: 'pip install invocation', pattern: /(?:spawnSync|runCommand)\s*\([^)]*['"]pip(?:3)?['"][^)]*install/i },
    { label: 'npm install invocation', pattern: /(?:spawnSync|runCommand)\s*\([^)]*['"]npm['"][^)]*install/i },
    { label: 'python import execution', pattern: /(?:spawnSync|runCommand)\s*\([^)]*['"]python3?['"][^)]*['"]-c['"][^)]*import/i }
  ];

  prohibitedInvocationPatterns.forEach(({ label, pattern }) => {
    if (pattern.test(text)) {
      addFailure(file, 'NEXUS import environment preflight', `Script contains prohibited ${label}`);
    }
  });

  [
    'integration_status',
    'nexus_execution',
    'python_execution',
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database'
  ].forEach(flag => {
    if (!text.includes(flag)) {
      addFailure(file, 'NEXUS import environment preflight', `Script must include boundary flag ${flag}`);
    }
  });
}

function validateNexusSourcePinResolution(resolution) {
  const file = 'data/nexus-source-pin-resolution.v0.json';
  requirePath(resolution, ['metadata'], file, 'NEXUS source pin resolution');
  requirePath(resolution, ['expected_nexus_commit'], file, 'NEXUS source pin resolution');
  requirePath(resolution, ['observed_nexus_path'], file, 'NEXUS source pin resolution');
  requirePath(resolution, ['observed_nexus_head'], file, 'NEXUS source pin resolution');
  requirePath(resolution, ['observed_branch'], file, 'NEXUS source pin resolution');
  requirePath(resolution, ['expected_commit_present_locally'], file, 'NEXUS source pin resolution');
  requirePath(resolution, ['working_tree_status'], file, 'NEXUS source pin resolution');
  requirePath(resolution, ['stop_condition_status'], file, 'NEXUS source pin resolution');
  requirePath(resolution, ['import_adapter_authorized'], file, 'NEXUS source pin resolution');
  requirePath(resolution, ['recommended_source_strategy'], file, 'NEXUS source pin resolution');
  requirePath(resolution, ['required_next_conditions'], file, 'NEXUS source pin resolution');
  requirePath(resolution, ['claim_boundary'], file, 'NEXUS source pin resolution');

  const metadata = resolution.metadata || {};
  if (metadata.status !== 'source_pin_resolution_only') {
    addFailure(file, 'NEXUS source pin resolution', `metadata.status must be source_pin_resolution_only, found "${metadata.status}"`);
  }
  if (metadata.integration_status !== 'not_integrated') {
    addFailure(file, 'NEXUS source pin resolution', `metadata.integration_status must be not_integrated, found "${metadata.integration_status}"`);
  }

  [
    'nexus_execution',
    'python_execution',
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, 'NEXUS source pin resolution', `metadata.${flag} must be false`);
    }
  });

  if (resolution.expected_nexus_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, 'NEXUS source pin resolution', 'expected_nexus_commit must match ab95cbbd24df5817c4e363d24b3b199ac8af6c6f');
  }
  if (resolution.observed_nexus_head !== 'acd8b2abfd3ea66ed6d91fb908c761774bdf110d') {
    addFailure(file, 'NEXUS source pin resolution', 'observed_nexus_head must match acd8b2abfd3ea66ed6d91fb908c761774bdf110d');
  }
  if (resolution.import_adapter_authorized !== false) {
    addFailure(file, 'NEXUS source pin resolution', 'import_adapter_authorized must be false');
  }

  const stop = resolution.stop_condition_status || {};
  if (!['blocked', 'not_ready'].includes(stop.status)) {
    addFailure(file, 'NEXUS source pin resolution', 'stop_condition_status.status must be blocked or not_ready');
  }
  if (stop.import_adapter_ready !== false) {
    addFailure(file, 'NEXUS source pin resolution', 'stop_condition_status.import_adapter_ready must be false');
  }
  const stopText = JSON.stringify(stop).toLowerCase();
  if (!stopText.includes('does not match') && !stopText.includes('mismatch')) {
    addFailure(file, 'NEXUS source pin resolution', 'stop_condition_status must document the observed commit mismatch');
  }

  if (resolution.expected_commit_present_locally !== true) {
    addFailure(file, 'NEXUS source pin resolution', 'expected_commit_present_locally must be true for the inspected local path');
  }

  const strategyText = JSON.stringify(resolution.recommended_source_strategy || {}).toLowerCase();
  if (!strategyText.includes('pinned commit') && !strategyText.includes('clean')) {
    addFailure(file, 'NEXUS source pin resolution', 'recommended_source_strategy must recommend a clean pinned source path');
  }
}

function validateNexusPinnedSourcePreflight(preflight) {
  const file = 'data/nexus-pinned-source-preflight.v0.json';
  requirePath(preflight, ['metadata'], file, 'NEXUS pinned source preflight');
  requirePath(preflight, ['pinned_nexus_commit'], file, 'NEXUS pinned source preflight');
  requirePath(preflight, ['previous_non_authoritative_path'], file, 'NEXUS pinned source preflight');
  requirePath(preflight, ['previous_non_authoritative_head'], file, 'NEXUS pinned source preflight');
  requirePath(preflight, ['clean_source_strategy'], file, 'NEXUS pinned source preflight');
  requirePath(preflight, ['clean_source_path'], file, 'NEXUS pinned source preflight');
  requirePath(preflight, ['clean_source_head_or_source_commit'], file, 'NEXUS pinned source preflight');
  requirePath(preflight, ['clean_source_status'], file, 'NEXUS pinned source preflight');
  requirePath(preflight, ['environment_preflight_status'], file, 'NEXUS pinned source preflight');
  requirePath(preflight, ['ready_for_import_adapter_authorization'], file, 'NEXUS pinned source preflight');
  requirePath(preflight, ['import_adapter_authorized'], file, 'NEXUS pinned source preflight');
  requirePath(preflight, ['claim_boundary'], file, 'NEXUS pinned source preflight');

  const metadata = preflight.metadata || {};
  if (metadata.status !== 'pinned_source_preflight_only') {
    addFailure(file, 'NEXUS pinned source preflight', `metadata.status must be pinned_source_preflight_only, found "${metadata.status}"`);
  }
  if (metadata.integration_status !== 'not_integrated') {
    addFailure(file, 'NEXUS pinned source preflight', `metadata.integration_status must be not_integrated, found "${metadata.integration_status}"`);
  }

  [
    'nexus_execution',
    'python_execution',
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, 'NEXUS pinned source preflight', `metadata.${flag} must be false`);
    }
  });

  if (preflight.pinned_nexus_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, 'NEXUS pinned source preflight', 'pinned_nexus_commit must match ab95cbbd24df5817c4e363d24b3b199ac8af6c6f');
  }
  if (preflight.clean_source_head_or_source_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, 'NEXUS pinned source preflight', 'clean_source_head_or_source_commit must match the pinned NEXUS commit');
  }
  if (preflight.previous_non_authoritative_head !== 'acd8b2abfd3ea66ed6d91fb908c761774bdf110d') {
    addFailure(file, 'NEXUS pinned source preflight', 'previous_non_authoritative_head must match acd8b2abfd3ea66ed6d91fb908c761774bdf110d');
  }
  if (preflight.import_adapter_authorized !== false) {
    addFailure(file, 'NEXUS pinned source preflight', 'import_adapter_authorized must be false');
  }
  if (preflight.ready_for_import_adapter_authorization === true && preflight.clean_source_head_or_source_commit !== preflight.pinned_nexus_commit) {
    addFailure(file, 'NEXUS pinned source preflight', 'ready_for_import_adapter_authorization requires clean_source_head_or_source_commit to match pinned_nexus_commit');
  }

  const sourceStatus = preflight.clean_source_status || {};
  if (sourceStatus.matches_pinned_commit !== true) {
    addFailure(file, 'NEXUS pinned source preflight', 'clean_source_status.matches_pinned_commit must be true');
  }
  if (sourceStatus.working_tree_status !== 'clean') {
    addFailure(file, 'NEXUS pinned source preflight', 'clean_source_status.working_tree_status must be clean');
  }

  const envStatus = preflight.environment_preflight_status || {};
  if (envStatus.command_result !== 'pass') {
    addFailure(file, 'NEXUS pinned source preflight', 'environment_preflight_status.command_result must be pass');
  }
  if (envStatus.nexus_commit_status !== 'matches_pinned_commit') {
    addFailure(file, 'NEXUS pinned source preflight', 'environment_preflight_status.nexus_commit_status must be matches_pinned_commit');
  }
  if (envStatus.source_path_stop_condition_resolved !== true) {
    addFailure(file, 'NEXUS pinned source preflight', 'environment_preflight_status.source_path_stop_condition_resolved must be true');
  }

  const refresh = preflight.post_commit_refresh;
  if (!isObject(refresh)) {
    addFailure(file, 'NEXUS pinned source preflight', 'post_commit_refresh must be present');
    return;
  }
  if (refresh.aetherus_baseline !== 'c25d23b38a399ab00c933525e7996acbbf23be09') {
    addFailure(file, 'NEXUS pinned source preflight', 'post_commit_refresh.aetherus_baseline must match c25d23b38a399ab00c933525e7996acbbf23be09');
  }
  if (refresh.clean_source_head_or_source_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, 'NEXUS pinned source preflight', 'post_commit_refresh.clean_source_head_or_source_commit must match the pinned NEXUS commit');
  }
  if (refresh.import_adapter_authorized !== false) {
    addFailure(file, 'NEXUS pinned source preflight', 'post_commit_refresh.import_adapter_authorized must be false');
  }
  if (refresh.integration_status !== 'not_integrated') {
    addFailure(file, 'NEXUS pinned source preflight', 'post_commit_refresh.integration_status must be not_integrated');
  }

  [
    'nexus_execution',
    'python_execution',
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database'
  ].forEach(flag => {
    if (refresh[flag] !== false) {
      addFailure(file, 'NEXUS pinned source preflight', `post_commit_refresh.${flag} must be false`);
    }
  });

  if (refresh.claim_boundary_status !== 'bounded') {
    addFailure(file, 'NEXUS pinned source preflight', 'post_commit_refresh.claim_boundary_status must be bounded');
  }

  const authorization = preflight.track_3_17_authorization;
  if (!isObject(authorization)) {
    addFailure(file, 'NEXUS pinned source preflight', 'track_3_17_authorization must be present for scoped local adapter authorization');
    return;
  }
  if (authorization.track_phase !== '3.17') {
    addFailure(file, 'NEXUS pinned source preflight', 'track_3_17_authorization.track_phase must be 3.17');
  }
  if (authorization.import_adapter_authorized_for_track_3_17 !== true) {
    addFailure(file, 'NEXUS pinned source preflight', 'track_3_17_authorization.import_adapter_authorized_for_track_3_17 must be true');
  }
  if (authorization.import_adapter_authorized !== false) {
    addFailure(file, 'NEXUS pinned source preflight', 'track_3_17_authorization.import_adapter_authorized must remain false for unrestricted/general authorization');
  }
  if (authorization.authorization_scope !== 'local_only_pinned_source_import_adapter_prototype') {
    addFailure(file, 'NEXUS pinned source preflight', 'track_3_17_authorization.authorization_scope must be local_only_pinned_source_import_adapter_prototype');
  }
  if (authorization.authorized_nexus_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, 'NEXUS pinned source preflight', 'track_3_17_authorization.authorized_nexus_commit must match the pinned NEXUS commit');
  }
  if (authorization.integration_status !== 'not_integrated') {
    addFailure(file, 'NEXUS pinned source preflight', 'track_3_17_authorization.integration_status must remain not_integrated');
  }
  [
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database',
    'live_orchestration',
    'public_ui_wiring'
  ].forEach(flag => {
    if (authorization[flag] !== false) {
      addFailure(file, 'NEXUS pinned source preflight', `track_3_17_authorization.${flag} must be false`);
    }
  });
}

function validateLocalNexusImportAdapterScript() {
  const file = 'scripts/run-nexus-import-adapter-local.mjs';
  if (!existsSync(path.join(repoRoot, file))) {
    addFailure(file, 'Local NEXUS import adapter', 'Local import adapter script is missing');
    return;
  }

  const text = readText(file);
  [
    ['explicit --nexus-path requirement', /--nexus-path is required/],
    ['pinned NEXUS commit check', /expectedNexusCommit\s*=\s*'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f'/],
    ['local report output path', /\.track3-runs\/latest-nexus-import-adapter-local-report\.json/],
    ['temporary runner under ignored output directory', /\.track3-runs\/nexus-import-adapter-runner\.py/],
    ['deterministic model API boundary', /delete childEnv\.ANTHROPIC_API_KEY/],
    ['public runtime boundary flag', /public_runtime:\s*false/],
    ['persistence boundary flag', /persistence:\s*false/],
    ['ledger boundary flag', /ledger:\s*false/],
    ['model execution boundary flag', /model_execution:\s*false/],
    ['backend boundary flag', /backend:\s*false/],
    ['auth boundary flag', /auth:\s*false/],
    ['database boundary flag', /database:\s*false/],
    ['live orchestration boundary flag', /live_orchestration:\s*false/],
    ['public UI wiring boundary flag', /public_ui_wiring:\s*false/],
    ['local adapter trace boundary', /local_adapter_run_not_persistent_not_ledger/],
    ['local pinned source execution scope', /local_pinned_source_only/]
  ].forEach(([label, pattern]) => {
    if (!pattern.test(text)) {
      addFailure(file, 'Local NEXUS import adapter', `Script missing ${label}`);
    }
  });

  const prohibitedPatterns = [
    { label: 'dependency installation', pattern: /\b(?:pip3?|npm)\s+install\b|['"]install['"]/i },
    { label: 'public UI wiring', pattern: /\bdocument\.|\bwindow\.|querySelector|addEventListener/i },
    { label: 'public HTML modification target', pattern: /index\.html/i },
    { label: 'production browser JS modification target', pattern: /js\/(?:app|docs|pipeline|grid|governance-engine|trace-viewer)\.js/i },
    { label: 'network fetch', pattern: /\bfetch\s*\(|https?:\/\//i },
    { label: 'model API environment assignment', pattern: /ANTHROPIC_API_KEY\s*=/i }
  ];

  prohibitedPatterns.forEach(({ label, pattern }) => {
    if (pattern.test(text)) {
      addFailure(file, 'Local NEXUS import adapter', `Script contains prohibited ${label}`);
    }
  });
}

function validateLocalNexusImportAdapterReportIfPresent() {
  const file = '.track3-runs/latest-nexus-import-adapter-local-report.json';
  const absolute = path.join(repoRoot, file);
  if (!existsSync(absolute)) return;

  let report;
  try {
    report = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    addFailure(file, 'Local NEXUS import adapter report', error.message);
    return;
  }

  const meta = report.meta || {};
  if (meta.integration_status !== 'local_import_adapter_prototype') {
    addFailure(file, 'Local NEXUS import adapter report', 'meta.integration_status must be local_import_adapter_prototype');
  }
  [
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database',
    'live_orchestration',
    'public_ui_wiring'
  ].forEach(flag => {
    if (meta[flag] !== false) {
      addFailure(file, 'Local NEXUS import adapter report', `meta.${flag} must be false`);
    }
  });

  const nexusBoundary = report.nexus_boundary || {};
  if (nexusBoundary.nexus_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, 'Local NEXUS import adapter report', 'nexus_boundary.nexus_commit must match pinned NEXUS commit');
  }
  if (nexusBoundary.nexus_execution !== true) {
    addFailure(file, 'Local NEXUS import adapter report', 'nexus_boundary.nexus_execution must be true for the generated local adapter report');
  }
  if (nexusBoundary.nexus_execution_scope !== 'local_pinned_source_only') {
    addFailure(file, 'Local NEXUS import adapter report', 'nexus_boundary.nexus_execution_scope must be local_pinned_source_only');
  }
  if (nexusBoundary.python_execution !== true) {
    addFailure(file, 'Local NEXUS import adapter report', 'nexus_boundary.python_execution must be true for the generated local adapter report');
  }
  if (nexusBoundary.python_execution_scope !== 'local_adapter_subprocess_only') {
    addFailure(file, 'Local NEXUS import adapter report', 'nexus_boundary.python_execution_scope must be local_adapter_subprocess_only');
  }
  if (nexusBoundary.nexus_source_modified !== false) {
    addFailure(file, 'Local NEXUS import adapter report', 'nexus_boundary.nexus_source_modified must be false');
  }
  if (nexusBoundary.dependency_installation_performed !== false) {
    addFailure(file, 'Local NEXUS import adapter report', 'nexus_boundary.dependency_installation_performed must be false');
  }

  const traceBoundary = report.trace_boundary || {};
  if (traceBoundary.trace_status !== 'local_adapter_run_not_persistent_not_ledger') {
    addFailure(file, 'Local NEXUS import adapter report', 'trace_boundary.trace_status must be local_adapter_run_not_persistent_not_ledger');
  }
  if (traceBoundary.not_persistent !== true || traceBoundary.not_ledger !== true) {
    addFailure(file, 'Local NEXUS import adapter report', 'trace_boundary must state not_persistent and not_ledger');
  }

  const claimBoundary = report.claim_boundary || {};
  [
    'not_public_runtime',
    'not_persistent',
    'not_ledger',
    'not_backend',
    'not_auth',
    'not_model_execution',
    'not_live_orchestration',
    'not_production'
  ].forEach(flag => {
    if (claimBoundary[flag] !== true) {
      addFailure(file, 'Local NEXUS import adapter report', `claim_boundary.${flag} must be true`);
    }
  });
}

function validateLocalNexusImportAdapterRegressionSuiteScript() {
  const file = 'scripts/run-nexus-import-adapter-regression-suite.mjs';
  if (!existsSync(path.join(repoRoot, file))) {
    addFailure(file, 'Local NEXUS import adapter regression suite', 'Regression suite script is missing');
    return;
  }

  const text = readText(file);
  [
    ['pinned NEXUS commit check', /expectedNexusCommit\s*=\s*'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f'/],
    ['local regression report output path', /\.track3-runs\/latest-nexus-import-adapter-regression-suite-report\.json/],
    ['local adapter invocation', /scripts\/run-nexus-import-adapter-local\.mjs/],
    ['public runtime boundary flag', /public_runtime:\s*false/],
    ['persistence boundary flag', /persistence:\s*false/],
    ['ledger boundary flag', /ledger:\s*false/],
    ['model execution boundary flag', /model_execution:\s*false/],
    ['backend boundary flag', /backend:\s*false/],
    ['auth boundary flag', /auth:\s*false/],
    ['database boundary flag', /database:\s*false/],
    ['live orchestration boundary flag', /live_orchestration:\s*false/],
    ['public UI wiring boundary flag', /public_ui_wiring:\s*false/],
    ['local adapter trace boundary', /local_adapter_run_not_persistent_not_ledger/],
    ['local pinned source execution scope', /local_pinned_source_only/]
  ].forEach(([label, pattern]) => {
    if (!pattern.test(text)) {
      addFailure(file, 'Local NEXUS import adapter regression suite', `Script missing ${label}`);
    }
  });

  const prohibitedPatterns = [
    { label: 'dependency installation', pattern: /\b(?:pip3?|npm)\s+install\b|['"]install['"]/i },
    { label: 'public UI wiring', pattern: /\bdocument\.|\bwindow\.|querySelector|addEventListener/i },
    { label: 'public HTML modification target', pattern: /index\.html/i },
    { label: 'production browser JS modification target', pattern: /js\/(?:app|docs|pipeline|grid|governance-engine|trace-viewer)\.js/i },
    { label: 'network fetch', pattern: /\bfetch\s*\(|https?:\/\//i },
    { label: 'model API environment assignment', pattern: /ANTHROPIC_API_KEY\s*=/i }
  ];

  prohibitedPatterns.forEach(({ label, pattern }) => {
    if (pattern.test(text)) {
      addFailure(file, 'Local NEXUS import adapter regression suite', `Script contains prohibited ${label}`);
    }
  });
}

function validateLocalNexusImportAdapterRegressionReportIfPresent() {
  const file = '.track3-runs/latest-nexus-import-adapter-regression-suite-report.json';
  const absolute = path.join(repoRoot, file);
  if (!existsSync(absolute)) return;

  let report;
  try {
    report = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    addFailure(file, 'Local NEXUS import adapter regression report', error.message);
    return;
  }

  const meta = report.meta || {};
  if (meta.run_mode !== 'local_nexus_import_adapter_regression_suite') {
    addFailure(file, 'Local NEXUS import adapter regression report', 'meta.run_mode must be local_nexus_import_adapter_regression_suite');
  }
  [
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database',
    'live_orchestration',
    'public_ui_wiring'
  ].forEach(flag => {
    if (meta[flag] !== false) {
      addFailure(file, 'Local NEXUS import adapter regression report', `meta.${flag} must be false`);
    }
  });

  const nexusBoundary = report.nexus_boundary || {};
  if (nexusBoundary.nexus_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, 'Local NEXUS import adapter regression report', 'nexus_boundary.nexus_commit must match pinned NEXUS commit');
  }
  if (nexusBoundary.nexus_execution !== true) {
    addFailure(file, 'Local NEXUS import adapter regression report', 'nexus_boundary.nexus_execution must be true for the local regression suite report');
  }
  if (nexusBoundary.nexus_execution_scope !== 'local_pinned_source_only') {
    addFailure(file, 'Local NEXUS import adapter regression report', 'nexus_boundary.nexus_execution_scope must be local_pinned_source_only');
  }
  if (nexusBoundary.python_execution !== true) {
    addFailure(file, 'Local NEXUS import adapter regression report', 'nexus_boundary.python_execution must be true for the local regression suite report');
  }
  if (nexusBoundary.python_execution_scope !== 'local_adapter_subprocess_only') {
    addFailure(file, 'Local NEXUS import adapter regression report', 'nexus_boundary.python_execution_scope must be local_adapter_subprocess_only');
  }
  if (nexusBoundary.nexus_source_modified !== false) {
    addFailure(file, 'Local NEXUS import adapter regression report', 'nexus_boundary.nexus_source_modified must be false');
  }
  if (nexusBoundary.dependency_installation_performed !== false) {
    addFailure(file, 'Local NEXUS import adapter regression report', 'nexus_boundary.dependency_installation_performed must be false');
  }

  const summary = report.suite_summary || {};
  if (summary.total_fixtures !== 5) {
    addFailure(file, 'Local NEXUS import adapter regression report', 'suite_summary.total_fixtures must be 5');
  }
  if (summary.failed_cases !== 0) {
    addFailure(file, 'Local NEXUS import adapter regression report', 'suite_summary.failed_cases must be 0');
  }

  const fixtureResults = Array.isArray(report.fixture_results) ? report.fixture_results : [];
  if (fixtureResults.length !== 5) {
    addFailure(file, 'Local NEXUS import adapter regression report', 'fixture_results must include five fixtures');
  }
  fixtureResults.forEach(result => {
    if (result.trace_status !== 'local_adapter_run_not_persistent_not_ledger') {
      addFailure(file, 'Local NEXUS import adapter regression report', `${result.fixture_id} trace_status must be local_adapter_run_not_persistent_not_ledger`);
    }
    if ((result.normalized_verdict === 'fail' || result.normalized_verdict === 'escalate') && result.release_eligible === true) {
      addFailure(file, 'Local NEXUS import adapter regression report', `${result.fixture_id} has blocking verdict but release_eligible true`);
    }
    if (result.release_eligible === true && result.deterministic_identity === 'fail') {
      addFailure(file, 'Local NEXUS import adapter regression report', `${result.fixture_id} is release-eligible with failed deterministic identity`);
    }
    const auditBoundary = JSON.stringify(result.audit_log_boundary || {}).toLowerCase();
    if (auditBoundary.includes('persistent ledger') || auditBoundary.includes('production ledger')) {
      addFailure(file, 'Local NEXUS import adapter regression report', `${result.fixture_id} audit boundary claims ledger behavior`);
    }
  });

  const traceSummary = report.trace_boundary_summary || {};
  if (traceSummary.trace_status !== 'local_adapter_run_not_persistent_not_ledger') {
    addFailure(file, 'Local NEXUS import adapter regression report', 'trace_boundary_summary.trace_status must be local_adapter_run_not_persistent_not_ledger');
  }
  if (traceSummary.all_local_non_persistent_non_ledger !== true) {
    addFailure(file, 'Local NEXUS import adapter regression report', 'trace_boundary_summary.all_local_non_persistent_non_ledger must be true');
  }

  const claimBoundary = report.claim_boundary || {};
  [
    'not_public_runtime',
    'not_persistent',
    'not_ledger',
    'not_backend',
    'not_auth',
    'not_model_execution',
    'not_live_orchestration',
    'not_production'
  ].forEach(flag => {
    if (claimBoundary[flag] !== true) {
      addFailure(file, 'Local NEXUS import adapter regression report', `claim_boundary.${flag} must be true`);
    }
  });
}

function validateNexusImportAdapterReportContract(contract) {
  const file = 'data/nexus-import-adapter-report-contract.v0.json';
  requirePath(contract, ['metadata'], file, 'NEXUS import adapter report contract');
  requirePath(contract, ['required_success_report_fields'], file, 'NEXUS import adapter report contract');
  requirePath(contract, ['required_regression_report_fields'], file, 'NEXUS import adapter report contract');
  requirePath(contract, ['required_failure_report_fields'], file, 'NEXUS import adapter report contract');
  requirePath(contract, ['allowed_failure_categories'], file, 'NEXUS import adapter report contract');
  requirePath(contract, ['release_eligibility_invariants'], file, 'NEXUS import adapter report contract');
  requirePath(contract, ['trace_boundary_invariants'], file, 'NEXUS import adapter report contract');
  requirePath(contract, ['claim_boundary_invariants'], file, 'NEXUS import adapter report contract');

  const metadata = contract.metadata || {};
  if (metadata.status !== 'local_report_contract') {
    addFailure(file, 'NEXUS import adapter report contract', `metadata.status must be local_report_contract, found "${metadata.status}"`);
  }
  if (metadata.pinned_nexus_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, 'NEXUS import adapter report contract', 'metadata.pinned_nexus_commit must match pinned NEXUS commit');
  }
  [
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database',
    'live_orchestration',
    'public_ui_wiring'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, 'NEXUS import adapter report contract', `metadata.${flag} must be false`);
    }
  });

  const successFields = new Set(contract.required_success_report_fields || []);
  [
    'meta',
    'nexus_boundary',
    'source',
    'adapter_input',
    'nexus_payload',
    'raw_nexus_result_boundary',
    'normalized_interface_result',
    'release_eligibility',
    'trace_boundary',
    'claim_boundary',
    'deterministic_identity',
    'stop_conditions'
  ].forEach(field => {
    if (!successFields.has(field)) {
      addFailure(file, 'NEXUS import adapter report contract', `required_success_report_fields missing ${field}`);
    }
  });

  const regressionFields = new Set(contract.required_regression_report_fields || []);
  [
    'meta',
    'nexus_boundary',
    'suite_summary',
    'fixture_results',
    'deterministic_identity_summary',
    'release_eligibility_summary',
    'trace_boundary_summary',
    'claim_boundary',
    'stop_conditions'
  ].forEach(field => {
    if (!regressionFields.has(field)) {
      addFailure(file, 'NEXUS import adapter report contract', `required_regression_report_fields missing ${field}`);
    }
  });

  const failureFields = new Set(contract.required_failure_report_fields || []);
  [
    'meta',
    'failure_category',
    'failure_reason',
    'source',
    'attempted_fixture_id',
    'nexus_boundary',
    'normalized_verdict',
    'release_eligibility',
    'trace_boundary',
    'claim_boundary',
    'stop_conditions',
    'raw_error_boundary'
  ].forEach(field => {
    if (!failureFields.has(field)) {
      addFailure(file, 'NEXUS import adapter report contract', `required_failure_report_fields missing ${field}`);
    }
  });

  const categories = new Set(contract.allowed_failure_categories || []);
  [
    'nexus_path_missing',
    'nexus_commit_mismatch',
    'nexus_working_tree_dirty',
    'fixture_mapping_missing',
    'regulatory_context_missing',
    'manifest_mapping_missing',
    'nexus_execution_failure',
    'malformed_nexus_result',
    'unknown_nexus_verdict',
    'unknown_risk_level',
    'missing_omega_decision',
    'nondeterministic_output',
    'release_eligibility_incoherent',
    'trace_boundary_violation',
    'claim_boundary_violation'
  ].forEach(category => {
    if (!categories.has(category)) {
      addFailure(file, 'NEXUS import adapter report contract', `allowed_failure_categories missing ${category}`);
    }
  });

  const trace = contract.trace_boundary_invariants || {};
  if (trace.trace_status !== 'local_adapter_run_not_persistent_not_ledger') {
    addFailure(file, 'NEXUS import adapter report contract', 'trace_boundary_invariants.trace_status must be local_adapter_run_not_persistent_not_ledger');
  }
  const claim = contract.claim_boundary_invariants || {};
  [
    'public_runtime',
    'backend',
    'auth',
    'database',
    'persistence',
    'model_execution',
    'live_orchestration',
    'public_ui_wiring',
    'production_runtime',
    'compliance_certification'
  ].forEach(flag => {
    if (claim[flag] !== false) {
      addFailure(file, 'NEXUS import adapter report contract', `claim_boundary_invariants.${flag} must be false`);
    }
  });
}

function validateBoundaryFalseFlags(file, metadata, category) {
  expectedTrack322BoundaryFalseFlags.forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, category, `metadata.${flag} must be false`);
    }
  });
}

function validateExpectedMembers(file, category, values, expected, label) {
  const actual = new Set(Array.isArray(values) ? values : []);
  expected.forEach(value => {
    if (!actual.has(value)) {
      addFailure(file, category, `${label} missing ${value}`);
    }
  });
  if (actual.size !== expected.length) {
    addFailure(file, category, `${label} must contain exactly ${expected.length} entries`);
  }
}

function validateTrack322FreezeMetadata(file, contract, expectedSourceContract) {
  const category = 'Track 3.22 contract freeze';
  requirePath(contract, ['metadata'], file, category);

  const metadata = contract.metadata || {};
  if (metadata.version !== '1.0.0') {
    addFailure(file, category, `metadata.version must be 1.0.0, found "${metadata.version}"`);
  }
  if (metadata.track_phase !== '3.22') {
    addFailure(file, category, `metadata.track_phase must be 3.22, found "${metadata.track_phase}"`);
  }
  if (metadata.status !== 'frozen_contract_artifact') {
    addFailure(file, category, `metadata.status must be frozen_contract_artifact, found "${metadata.status}"`);
  }
  if (metadata.source_contract !== expectedSourceContract) {
    addFailure(file, category, `metadata.source_contract must be ${expectedSourceContract}`);
  }
  validateBoundaryFalseFlags(file, metadata, category);
}

function validateInterfaceContractV1(contract) {
  const file = 'data/interface-contract.v1.json';
  const category = 'Track 3.22 interface freeze';
  validateTrack322FreezeMetadata(file, contract, 'data/interface-contract.v0.json');

  requirePath(contract, ['v0_evidence_chain'], file, category);
  requirePath(contract, ['frozen_boundary'], file, category);
  requirePath(contract, ['field_status_vocabulary'], file, category);
  requirePath(contract, ['runtime_status_vocabulary'], file, category);
  requirePath(contract, ['frozen_contract_objects'], file, category);
  requirePath(contract, ['deterministic_identity_expectations'], file, category);
  requirePath(contract, ['verdict_semantics'], file, category);
  requirePath(contract, ['trace_boundary'], file, category);
  requirePath(contract, ['non_goals'], file, category);
  requirePath(contract, ['prohibited_interpretations'], file, category);

  validateExpectedMembers(
    file,
    category,
    contract.verdict_semantics && contract.verdict_semantics.allowed_verdict_statuses,
    ['pass', 'fail', 'escalate'],
    'verdict_semantics.allowed_verdict_statuses'
  );

  const boundary = contract.frozen_boundary || {};
  [
    'local_only',
    'not_public_operational_behavior',
    'not_nexus_integrated',
    'not_backend',
    'not_authenticated',
    'not_persistent',
    'not_ledger',
    'not_model_executing'
  ].forEach(flag => {
    if (boundary[flag] !== true) {
      addFailure(file, category, `frozen_boundary.${flag} must be true`);
    }
  });

  const trace = contract.trace_boundary || {};
  if (trace.current_interface_trace_status !== 'local_dry_run_not_persistent_not_ledger') {
    addFailure(file, category, 'trace_boundary.current_interface_trace_status must be local_dry_run_not_persistent_not_ledger');
  }
  if (trace.adapter_trace_status !== 'local_adapter_run_not_persistent_not_ledger') {
    addFailure(file, category, 'trace_boundary.adapter_trace_status must be local_adapter_run_not_persistent_not_ledger');
  }
  ['trace_is_persistent', 'trace_is_ledger', 'trace_is_database_record', 'trace_is_production_audit_evidence'].forEach(flag => {
    if (trace[flag] !== false) {
      addFailure(file, category, `trace_boundary.${flag} must be false`);
    }
  });
}

function validateNexusAdapterContractV1(contract) {
  const file = 'data/nexus-adapter-contract.v1.json';
  const category = 'Track 3.22 NEXUS adapter freeze';
  validateTrack322FreezeMetadata(file, contract, 'data/nexus-adapter-contract.stub.v0.json');

  requirePath(contract, ['pinned_vault_source_metadata'], file, category);
  requirePath(contract, ['verified_nexus_surface'], file, category);
  requirePath(contract, ['adapter_boundary'], file, category);
  requirePath(contract, ['deterministic_identity_expectations'], file, category);
  requirePath(contract, ['allowed_verdict_semantics'], file, category);
  requirePath(contract, ['allowed_failure_categories'], file, category);
  requirePath(contract, ['fail_closed_policy'], file, category);
  requirePath(contract, ['claim_boundary'], file, category);
  requirePath(contract, ['non_goals'], file, category);
  requirePath(contract, ['prohibited_interpretations'], file, category);

  const source = contract.pinned_vault_source_metadata || {};
  if (source.pinned_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, category, 'pinned_vault_source_metadata.pinned_commit must match pinned NEXUS commit');
  }
  if (source.source_must_remain_unmodified !== true) {
    addFailure(file, category, 'pinned_vault_source_metadata.source_must_remain_unmodified must be true');
  }
  if (source.dependency_installation_authorized !== false) {
    addFailure(file, category, 'pinned_vault_source_metadata.dependency_installation_authorized must be false');
  }

  validateExpectedMembers(
    file,
    category,
    contract.allowed_verdict_semantics && contract.allowed_verdict_semantics.allowed_normalized_verdicts,
    ['pass', 'fail', 'escalate'],
    'allowed_verdict_semantics.allowed_normalized_verdicts'
  );
  validateExpectedMembers(
    file,
    category,
    contract.allowed_failure_categories,
    expectedTrack322FailureCategories,
    'allowed_failure_categories'
  );

  const policy = contract.fail_closed_policy || {};
  if (policy.default_failure_verdict !== 'escalate') {
    addFailure(file, category, 'fail_closed_policy.default_failure_verdict must be escalate');
  }
  if (policy.release_eligible_on_failure !== false) {
    addFailure(file, category, 'fail_closed_policy.release_eligible_on_failure must be false');
  }
  if (policy.stop_condition_required !== true) {
    addFailure(file, category, 'fail_closed_policy.stop_condition_required must be true');
  }
  if (policy.trace_boundary_required !== 'local_adapter_run_not_persistent_not_ledger') {
    addFailure(file, category, 'fail_closed_policy.trace_boundary_required must be local_adapter_run_not_persistent_not_ledger');
  }

  const claim = contract.claim_boundary || {};
  [
    'not_integrated_publicly',
    'not_backend',
    'not_authenticated',
    'not_persistent',
    'not_ledger',
    'not_model_executing',
    'not_public_runtime',
    'not_palisade',
    'not_weave'
  ].forEach(flag => {
    if (claim[flag] !== true) {
      addFailure(file, category, `claim_boundary.${flag} must be true`);
    }
  });
}

function validateNexusImportAdapterReportContractV1(contract) {
  const file = 'data/nexus-import-adapter-report-contract.v1.json';
  const category = 'Track 3.22 report contract freeze';
  validateTrack322FreezeMetadata(file, contract, 'data/nexus-import-adapter-report-contract.v0.json');

  requirePath(contract, ['required_success_report_fields'], file, category);
  requirePath(contract, ['required_regression_report_fields'], file, category);
  requirePath(contract, ['required_failure_report_fields'], file, category);
  requirePath(contract, ['allowed_failure_categories'], file, category);
  requirePath(contract, ['failure_category_coverage'], file, category);
  requirePath(contract, ['release_eligibility_invariants'], file, category);
  requirePath(contract, ['trace_boundary_invariants'], file, category);
  requirePath(contract, ['claim_boundary_invariants'], file, category);
  requirePath(contract, ['deterministic_identity_expectations'], file, category);
  requirePath(contract, ['pinned_vault_source_metadata'], file, category);
  requirePath(contract, ['prohibited_interpretations'], file, category);

  const metadata = contract.metadata || {};
  if (metadata.pinned_nexus_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, category, 'metadata.pinned_nexus_commit must match pinned NEXUS commit');
  }

  validateExpectedMembers(file, category, contract.allowed_failure_categories, expectedTrack322FailureCategories, 'allowed_failure_categories');

  const coverage = contract.failure_category_coverage || {};
  if (coverage.expected_count !== 15) {
    addFailure(file, category, 'failure_category_coverage.expected_count must be 15');
  }
  if (coverage.coverage_status !== 'complete_15_of_15_after_track_3_21') {
    addFailure(file, category, 'failure_category_coverage.coverage_status must be complete_15_of_15_after_track_3_21');
  }

  const trace = contract.trace_boundary_invariants || {};
  if (trace.trace_status !== 'local_adapter_run_not_persistent_not_ledger') {
    addFailure(file, category, 'trace_boundary_invariants.trace_status must be local_adapter_run_not_persistent_not_ledger');
  }
  if (trace.not_persistent !== true || trace.not_ledger !== true) {
    addFailure(file, category, 'trace_boundary_invariants must state not_persistent and not_ledger');
  }

  const claim = contract.claim_boundary_invariants || {};
  [
    'public_runtime',
    'public_ui_wiring',
    'backend',
    'auth',
    'database',
    'persistence',
    'ledger',
    'model_execution',
    'live_orchestration',
    'production_runtime',
    'enterprise_deployment',
    'compliance_certification',
    'palisade',
    'weave',
    'claim_escalation'
  ].forEach(flag => {
    if (claim[flag] !== false) {
      addFailure(file, category, `claim_boundary_invariants.${flag} must be false`);
    }
  });

  const source = contract.pinned_vault_source_metadata || {};
  if (source.pinned_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, category, 'pinned_vault_source_metadata.pinned_commit must match pinned NEXUS commit');
  }
  if (source.source_must_remain_unmodified !== true) {
    addFailure(file, category, 'pinned_vault_source_metadata.source_must_remain_unmodified must be true');
  }
}

function validateTrack323ExportManifestContract(contract) {
  const file = 'data/track3-local-report-export-manifest.v1.json';
  const category = 'Track 3.23 local report export manifest';

  requirePath(contract, ['metadata'], file, category);
  requirePath(contract, ['output_paths'], file, category);
  requirePath(contract, ['stable_file_selection'], file, category);
  requirePath(contract, ['manifest_requirements'], file, category);
  requirePath(contract, ['pinned_source'], file, category);
  requirePath(contract, ['boundary_invariants'], file, category);

  const metadata = contract.metadata || {};
  if (metadata.version !== '1.0.0') {
    addFailure(file, category, `metadata.version must be 1.0.0, found "${metadata.version}"`);
  }
  if (metadata.track_phase !== '3.23') {
    addFailure(file, category, `metadata.track_phase must be 3.23, found "${metadata.track_phase}"`);
  }
  if (metadata.status !== 'local_export_manifest_contract') {
    addFailure(file, category, `metadata.status must be local_export_manifest_contract, found "${metadata.status}"`);
  }
  validateBoundaryFalseFlags(file, metadata, category);

  const output = contract.output_paths || {};
  if (output.archive_pattern !== '.track3-runs/track3-local-report-export-<timestamp>.tar.gz') {
    addFailure(file, category, 'output_paths.archive_pattern must remain under ignored .track3-runs/');
  }
  if (output.latest_manifest !== '.track3-runs/latest-track3-local-report-export-manifest.json') {
    addFailure(file, category, 'output_paths.latest_manifest must remain under ignored .track3-runs/');
  }
  if (output.latest_summary !== '.track3-runs/latest-track3-local-report-export-summary.json') {
    addFailure(file, category, 'output_paths.latest_summary must remain under ignored .track3-runs/');
  }

  const selection = contract.stable_file_selection || {};
  const required = new Set(selection.required_core_reports || []);
  [
    '.track3-runs/latest-nexus-import-adapter-local-report.json',
    '.track3-runs/latest-nexus-import-adapter-regression-suite-report.json',
    '.track3-runs/latest-nexus-import-adapter-failure-injection-suite-report.json'
  ].forEach(report => {
    if (!required.has(report)) {
      addFailure(file, category, `stable_file_selection.required_core_reports missing ${report}`);
    }
  });

  const detailPattern = Array.isArray(selection.required_detail_patterns)
    ? selection.required_detail_patterns.find(item => item && item.pattern === '.track3-runs/nexus-import-adapter-failure-injection-*.json')
    : null;
  if (!detailPattern) {
    addFailure(file, category, 'stable_file_selection.required_detail_patterns must include failure-injection details');
  } else if (detailPattern.minimum_count !== 15) {
    addFailure(file, category, 'failure-injection required_detail_patterns.minimum_count must be 15');
  }

  const excluded = new Set(selection.excluded_patterns || []);
  [
    '.track3-runs/track3-local-report-export-*.tar.gz',
    '.track3-runs/latest-track3-local-report-export-manifest.json',
    '.track3-runs/latest-track3-local-report-export-summary.json',
    '.track3-runs/nexus-import-adapter-runner.py'
  ].forEach(pattern => {
    if (!excluded.has(pattern)) {
      addFailure(file, category, `stable_file_selection.excluded_patterns missing ${pattern}`);
    }
  });

  const requirements = contract.manifest_requirements || {};
  [
    'record_run_timestamp_separately_from_hashes',
    'record_aetherus_commit',
    'record_pinned_nexus_commit',
    'record_pinned_nexus_source_path',
    'record_file_paths',
    'record_size_bytes',
    'record_sha256',
    'record_inclusion_category',
    'record_validation_summary',
    'record_boundary_summary'
  ].forEach(flag => {
    if (requirements[flag] !== true) {
      addFailure(file, category, `manifest_requirements.${flag} must be true`);
    }
  });

  const pinned = contract.pinned_source || {};
  if (pinned.nexus_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, category, 'pinned_source.nexus_commit must match pinned NEXUS commit');
  }

  const boundary = contract.boundary_invariants || {};
  [
    'export_archive_committed',
    'generated_manifest_committed',
    'export_is_repository_source_of_truth',
    'export_is_production_ledger',
    'export_is_persistent_audit_infrastructure',
    'export_makes_public_runtime_claims_claimable',
    'conduit_fail_closed_behavior_is_palisade_work'
  ].forEach(flag => {
    if (boundary[flag] !== false) {
      addFailure(file, category, `boundary_invariants.${flag} must be false`);
    }
  });
}

function validateTrack323ExportScript() {
  const file = 'scripts/export-track3-local-report-bundle.mjs';
  if (!existsSync(path.join(repoRoot, file))) {
    addFailure(file, 'Track 3.23 local report exporter', 'Export script is missing');
    return;
  }

  const text = readText(file);
  [
    ['export manifest contract input', /data\/track3-local-report-export-manifest\.v1\.json/],
    ['archive output under ignored reports directory', /\.track3-runs\/track3-local-report-export-/],
    ['latest export manifest output', /\.track3-runs\/latest-track3-local-report-export-manifest\.json/],
    ['latest export summary output', /\.track3-runs\/latest-track3-local-report-export-summary\.json/],
    ['SHA256 hashing', /sha256/],
    ['pinned NEXUS commit reference', /ab95cbbd24df5817c4e363d24b3b199ac8af6c6f/],
    ['pinned NEXUS source path', /nexus-mvp-pinned-ab95cbb/],
    ['report validator capture', /validate-nexus-import-adapter-reports\.mjs/],
    ['Track 3 contract validator capture', /validate-track3-contracts\.mjs/],
    ['failure-injection detail minimum', /expected at least 15 failure-injection detail reports/],
    ['local-only boundary output', /local evidence export only/],
    ['Palisade boundary flag', /palisade:\s*false/],
    ['Weave boundary flag', /weave:\s*false/],
    ['claim escalation boundary flag', /claim_escalation:\s*false/]
  ].forEach(([label, pattern]) => {
    if (!pattern.test(text)) {
      addFailure(file, 'Track 3.23 local report exporter', `Script missing ${label}`);
    }
  });

  const prohibitedPatterns = [
    { label: 'dependency installation', pattern: /\b(?:pip3?|npm)\s+install\b|['"]install['"]/i },
    { label: 'public UI wiring', pattern: /\bdocument\.|\bwindow\.|querySelector|addEventListener/i },
    { label: 'public HTML modification target', pattern: /index\.html/i },
    { label: 'production browser JS modification target', pattern: /js\/(?:app|docs|pipeline|grid|governance-engine|trace-viewer)\.js/i },
    { label: 'network fetch', pattern: /\bfetch\s*\(|https?:\/\//i },
    { label: 'model API environment assignment', pattern: /ANTHROPIC_API_KEY\s*=/i }
  ];

  prohibitedPatterns.forEach(({ label, pattern }) => {
    if (pattern.test(text)) {
      addFailure(file, 'Track 3.23 local report exporter', `Script contains prohibited ${label}`);
    }
  });
}

function validateTrack324PolicyMetadata(file, contract, expectedStatus, category) {
  requirePath(contract, ['metadata'], file, category);
  const metadata = contract.metadata || {};
  if (metadata.version !== '1.0.0') {
    addFailure(file, category, `metadata.version must be 1.0.0, found "${metadata.version}"`);
  }
  if (metadata.track_phase !== '3.24') {
    addFailure(file, category, `metadata.track_phase must be 3.24, found "${metadata.track_phase}"`);
  }
  if (metadata.status !== expectedStatus) {
    addFailure(file, category, `metadata.status must be ${expectedStatus}, found "${metadata.status}"`);
  }
  [
    ...expectedTrack322BoundaryFalseFlags,
    'multi_vault_runtime_support'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, category, `metadata.${flag} must be false`);
    }
  });
}

function validateConduitVersioningPolicy(policy) {
  const file = 'data/conduit-versioning-policy.v1.json';
  const category = 'Track 3.24 Conduit versioning policy';
  validateTrack324PolicyMetadata(file, policy, 'local_contract_policy', category);

  requirePath(policy, ['conduit_v1_surface'], file, category);
  requirePath(policy, ['version_change_categories'], file, category);
  requirePath(policy, ['migration_states'], file, category);
  requirePath(policy, ['stop_conditions'], file, category);
  requirePath(policy, ['non_goals'], file, category);

  const surface = policy.conduit_v1_surface || {};
  if (surface.surface_version !== '1.0.0') {
    addFailure(file, category, 'conduit_v1_surface.surface_version must be 1.0.0');
  }

  const artifactPaths = new Set((surface.artifacts || []).map(item => item && item.path));
  [
    'data/interface-contract.v1.json',
    'data/nexus-adapter-contract.v1.json',
    'data/nexus-import-adapter-report-contract.v1.json',
    'data/track3-local-report-export-manifest.v1.json'
  ].forEach(artifact => {
    if (!artifactPaths.has(artifact)) {
      addFailure(file, category, `conduit_v1_surface.artifacts missing ${artifact}`);
    }
  });

  const pinned = surface.pinned_vault_metadata || {};
  if (pinned.supported_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, category, 'pinned_vault_metadata.supported_commit must match pinned NEXUS commit');
  }
  if (pinned.support_status !== 'accepted_single_pinned_commit') {
    addFailure(file, category, 'pinned_vault_metadata.support_status must be accepted_single_pinned_commit');
  }

  const categories = policy.version_change_categories || {};
  ['patch', 'minor', 'major'].forEach(changeCategory => {
    if (!isObject(categories[changeCategory])) {
      addFailure(file, category, `version_change_categories.${changeCategory} must be present`);
    }
  });
  if (categories.patch && categories.patch.requires_new_major_version !== false) {
    addFailure(file, category, 'version_change_categories.patch.requires_new_major_version must be false');
  }
  if (categories.minor && categories.minor.requires_new_major_version !== false) {
    addFailure(file, category, 'version_change_categories.minor.requires_new_major_version must be false');
  }
  if (categories.major && categories.major.requires_new_major_version !== true) {
    addFailure(file, category, 'version_change_categories.major.requires_new_major_version must be true');
  }

  const majorText = JSON.stringify(categories.major || {}).toLowerCase();
  [
    'breaking schema change',
    'changed verdict semantics',
    'changed release eligibility semantics',
    'changed trace-boundary semantics',
    'changed vault adapter assumptions'
  ].forEach(phrase => {
    if (!majorText.includes(phrase)) {
      addFailure(file, category, `version_change_categories.major must include ${phrase}`);
    }
  });

  const states = new Set((policy.migration_states || []).map(item => item && item.state));
  expectedTrack324MigrationStates.forEach(state => {
    if (!states.has(state)) {
      addFailure(file, category, `migration_states missing ${state}`);
    }
  });

  validateTrack324StopConditions(file, category, policy.stop_conditions || []);
}

function validateTrack324StopConditions(file, category, stopConditions) {
  const text = Array.isArray(stopConditions) ? stopConditions.join(' ').toLowerCase() : '';
  [
    'nexus source commit mismatch',
    'dirty pinned nexus source',
    'adapter output contract drift',
    'verdict enum drift',
    'release eligibility incoherence',
    'deterministic identity failure',
    'trace boundary treated as persistent ledger',
    'generated .track3-runs/ artifacts staged',
    'public runtime claim escalation',
    'palisade runtime dependency introduced without authorization',
    'weave runtime dependency introduced without authorization',
    'facade runtime dependency introduced without authorization'
  ].forEach(phrase => {
    if (!text.includes(phrase)) {
      addFailure(file, category, `stop conditions missing ${phrase}`);
    }
  });
}

function validateNexusVaultCompatibilityPolicy(policy) {
  const file = 'data/nexus-vault-version-compatibility.v1.json';
  const category = 'Track 3.24 NEXUS Vault compatibility policy';
  validateTrack324PolicyMetadata(file, policy, 'local_compatibility_policy', category);

  requirePath(policy, ['current_supported_vault'], file, category);
  requirePath(policy, ['compatibility_matrix'], file, category);
  requirePath(policy, ['unsupported_commit_policy'], file, category);
  requirePath(policy, ['future_vault_acceptance_requirements'], file, category);
  requirePath(policy, ['future_vault_stop_conditions'], file, category);
  requirePath(policy, ['boundary_invariants'], file, category);

  const current = policy.current_supported_vault || {};
  if (current.supported_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, category, 'current_supported_vault.supported_commit must match pinned NEXUS commit');
  }
  if (current.compatibility_state !== 'accepted') {
    addFailure(file, category, 'current_supported_vault.compatibility_state must be accepted');
  }
  if (current.runtime_support !== 'local_pinned_source_only') {
    addFailure(file, category, 'current_supported_vault.runtime_support must be local_pinned_source_only');
  }
  if (current.is_only_supported_commit !== true) {
    addFailure(file, category, 'current_supported_vault.is_only_supported_commit must be true');
  }

  const matrix = policy.compatibility_matrix || [];
  if (matrix.length !== 1) {
    addFailure(file, category, 'compatibility_matrix must contain exactly one currently supported commit');
  }
  const entry = matrix[0] || {};
  if (entry.commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, category, 'compatibility_matrix[0].commit must match pinned NEXUS commit');
  }
  if (entry.state !== 'accepted') {
    addFailure(file, category, 'compatibility_matrix[0].state must be accepted');
  }
  if (entry.multi_vault_runtime_support !== false) {
    addFailure(file, category, 'compatibility_matrix[0].multi_vault_runtime_support must be false');
  }

  const unsupported = policy.unsupported_commit_policy || {};
  if (unsupported.default_state_for_unlisted_commits !== 'unsupported') {
    addFailure(file, category, 'unsupported_commit_policy.default_state_for_unlisted_commits must be unsupported');
  }
  [
    'no_other_vault_commit_supported_yet',
    'must_not_infer_multi_vault_runtime_support',
    'must_not_use_unlisted_commit_for_accepted_conduit_evidence'
  ].forEach(flag => {
    if (unsupported[flag] !== true) {
      addFailure(file, category, `unsupported_commit_policy.${flag} must be true`);
    }
  });

  const requirementsText = JSON.stringify(policy.future_vault_acceptance_requirements || []).toLowerCase();
  [
    'source preflight',
    'import-adapter regression suite pass',
    'nexus import-adapter report validation pass',
    'failure-injection suite pass',
    'deterministic identity checks pass',
    'trace boundary remains non-persistent and non-ledger',
    'claim boundary remains bounded'
  ].forEach(phrase => {
    if (!requirementsText.includes(phrase)) {
      addFailure(file, category, `future_vault_acceptance_requirements missing ${phrase}`);
    }
  });

  validateTrack324StopConditions(file, category, policy.future_vault_stop_conditions || []);

  const boundary = policy.boundary_invariants || {};
  [
    'compatibility_matrix_implies_multi_vault_runtime_support',
    'compatibility_policy_authorizes_public_runtime',
    'compatibility_policy_authorizes_backend',
    'compatibility_policy_authorizes_persistence',
    'compatibility_policy_authorizes_ledger',
    'compatibility_policy_authorizes_palisade',
    'compatibility_policy_authorizes_weave'
  ].forEach(flag => {
    if (boundary[flag] !== false) {
      addFailure(file, category, `boundary_invariants.${flag} must be false`);
    }
  });
}

function validateTrack325VaultCompatibilityFixtures(suite, compatibilityPolicy) {
  const file = 'data/nexus-vault-compatibility-evaluation-fixtures.v1.json';
  const category = 'Track 3.25 Vault compatibility evaluation fixtures';

  requirePath(suite, ['metadata'], file, category);
  requirePath(suite, ['supported_vault_commit'], file, category);
  requirePath(suite, ['allowed_statuses'], file, category);
  requirePath(suite, ['required_categories'], file, category);
  requirePath(suite, ['fixture_policy'], file, category);
  requirePath(suite, ['fixtures'], file, category);

  const metadata = suite.metadata || {};
  if (metadata.version !== '1.0.0') {
    addFailure(file, category, `metadata.version must be 1.0.0, found "${metadata.version}"`);
  }
  if (metadata.track_phase !== '3.25') {
    addFailure(file, category, `metadata.track_phase must be 3.25, found "${metadata.track_phase}"`);
  }
  if (metadata.status !== 'local_harness_stub_fixtures') {
    addFailure(file, category, `metadata.status must be local_harness_stub_fixtures, found "${metadata.status}"`);
  }
  [
    ...expectedTrack322BoundaryFalseFlags,
    'alternate_vault_execution',
    'multi_vault_runtime_support'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, category, `metadata.${flag} must be false`);
    }
  });

  if (suite.supported_vault_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, category, 'supported_vault_commit must match the accepted pinned Vault commit');
  }
  const policySupportedCommit = compatibilityPolicy
    && compatibilityPolicy.current_supported_vault
    && compatibilityPolicy.current_supported_vault.supported_commit;
  if (policySupportedCommit && suite.supported_vault_commit !== policySupportedCommit) {
    addFailure(file, category, 'supported_vault_commit must match data/nexus-vault-version-compatibility.v1.json');
  }

  validateExpectedMembers(file, category, suite.allowed_statuses, expectedTrack325Statuses, 'allowed_statuses');
  validateExpectedMembers(file, category, suite.required_categories, expectedTrack325FixtureCategories, 'required_categories');

  const fixturePolicy = suite.fixture_policy || {};
  [
    'evaluate_metadata_only',
    'must_not_import_nexus',
    'must_not_execute_nexus',
    'must_not_clone_alternate_vault_sources',
    'must_not_switch_active_vault',
    'unsupported_candidate_commits_require_complete_evaluation_packet',
    'current_supported_commit_only'
  ].forEach(flag => {
    if (fixturePolicy[flag] !== true) {
      addFailure(file, category, `fixture_policy.${flag} must be true`);
    }
  });

  const fixtures = Array.isArray(suite.fixtures) ? suite.fixtures : [];
  const categoryCounts = new Map();
  fixtures.forEach((fixture, index) => {
    const label = fixture.fixture_id || `fixtures[${index}]`;
    [
      'fixture_id',
      'category',
      'candidate_vault',
      'evaluation_evidence',
      'expected_status',
      'expected_supported',
      'expected_reasons'
    ].forEach(key => {
      if (fixture[key] === undefined || fixture[key] === null) {
        addFailure(file, category, `${label} missing ${key}`);
      }
    });

    categoryCounts.set(fixture.category, (categoryCounts.get(fixture.category) || 0) + 1);
    if (!expectedTrack325FixtureCategories.includes(fixture.category)) {
      addFailure(file, category, `${label} uses unsupported category ${fixture.category}`);
    }
    if (!expectedTrack325Statuses.includes(fixture.expected_status)) {
      addFailure(file, category, `${label} uses unsupported expected_status ${fixture.expected_status}`);
    }

    const candidate = fixture.candidate_vault || {};
    if (typeof candidate.commit !== 'string' || !/^[a-f0-9]{40}$/.test(candidate.commit)) {
      addFailure(file, category, `${label} candidate_vault.commit must be 40 lowercase hex characters`);
    }
    if (fixture.category === 'current_pinned_vault_supported') {
      if (candidate.commit !== suite.supported_vault_commit) {
        addFailure(file, category, `${label} must use the supported pinned Vault commit`);
      }
      if (fixture.expected_status !== 'supported_current' || fixture.expected_supported !== true) {
        addFailure(file, category, `${label} must be expected as supported_current`);
      }
    } else {
      if (candidate.commit === suite.supported_vault_commit) {
        addFailure(file, category, `${label} non-current fixture must not use the supported pinned Vault commit`);
      }
      if (fixture.expected_supported !== false) {
        addFailure(file, category, `${label} unsupported candidate must not be expected supported`);
      }
      if (fixture.expected_status === 'supported_current') {
        addFailure(file, category, `${label} unsupported candidate must not be expected supported_current`);
      }
    }
  });

  expectedTrack325FixtureCategories.forEach(requiredCategory => {
    const count = categoryCounts.get(requiredCategory) || 0;
    if (count === 0) {
      addFailure(file, category, `Missing fixture category ${requiredCategory}`);
    }
  });
}

function validateTrack325VaultCompatibilityHarnessScript() {
  const file = 'scripts/evaluate-nexus-vault-compatibility-stub.mjs';
  if (!existsSync(path.join(repoRoot, file))) {
    addFailure(file, 'Track 3.25 Vault compatibility harness stub', 'Harness script is missing');
    return;
  }

  const text = readText(file);
  [
    ['fixture input', /data\/nexus-vault-compatibility-evaluation-fixtures\.v1\.json/],
    ['versioning policy input', /data\/conduit-versioning-policy\.v1\.json/],
    ['compatibility policy input', /data\/nexus-vault-version-compatibility\.v1\.json/],
    ['ignored report output', /\.track3-runs\/latest-nexus-vault-compatibility-evaluation-report\.json/],
    ['supported current status', /supported_current/],
    ['candidate not evaluated status', /candidate_not_evaluated/],
    ['candidate blocked status', /candidate_blocked/],
    ['candidate requires full evaluation status', /candidate_requires_full_evaluation/],
    ['incompatible status', /incompatible/],
    ['invalid fixture status', /invalid_fixture/],
    ['supported pinned Vault commit', /ab95cbbd24df5817c4e363d24b3b199ac8af6c6f/],
    ['local metadata boundary output', /local compatibility metadata evaluation only/],
    ['alternate Vault execution boundary flag', /alternate_vault_execution:\s*false/],
    ['multi-Vault runtime support boundary flag', /multi_vault_runtime_support:\s*false/],
    ['active Vault switch boundary', /switches_active_vault:\s*false/]
  ].forEach(([label, pattern]) => {
    if (!pattern.test(text)) {
      addFailure(file, 'Track 3.25 Vault compatibility harness stub', `Script missing ${label}`);
    }
  });

  const prohibitedPatterns = [
    { label: 'NEXUS import execution', pattern: /from\s+['"].*nexus|import\s+.*nexus|python.*-c.*import/i },
    { label: 'alternate clone', pattern: /\bgit\s+clone\b|['"]clone['"]/i },
    { label: 'dependency installation', pattern: /\b(?:pip3?|npm)\s+install\b|['"]install['"]/i },
    { label: 'public UI wiring', pattern: /\bdocument\.|\bwindow\.|querySelector|addEventListener/i },
    { label: 'public HTML modification target', pattern: /index\.html/i },
    { label: 'production browser JS modification target', pattern: /js\/(?:app|docs|pipeline|grid|governance-engine|trace-viewer)\.js/i },
    { label: 'network fetch', pattern: /\bfetch\s*\(|https?:\/\//i },
    { label: 'model API environment assignment', pattern: /ANTHROPIC_API_KEY\s*=/i }
  ];

  prohibitedPatterns.forEach(({ label, pattern }) => {
    if (pattern.test(text)) {
      addFailure(file, 'Track 3.25 Vault compatibility harness stub', `Script contains prohibited ${label}`);
    }
  });
}

function validateTrack326EvidencePacketContract(contract) {
  const file = 'data/nexus-vault-compatibility-evidence-packet-contract.v1.json';
  const category = 'Track 3.26 Vault compatibility evidence packet contract';

  requirePath(contract, ['metadata'], file, category);
  requirePath(contract, ['supported_vault_commit'], file, category);
  requirePath(contract, ['required_packet_fields'], file, category);
  requirePath(contract, ['allowed_compatibility_decisions'], file, category);
  requirePath(contract, ['passing_result_values'], file, category);
  requirePath(contract, ['blocking_rules'], file, category);
  requirePath(contract, ['report_output'], file, category);
  requirePath(contract, ['boundary_invariants'], file, category);

  const metadata = contract.metadata || {};
  if (metadata.version !== '1.0.0') {
    addFailure(file, category, `metadata.version must be 1.0.0, found "${metadata.version}"`);
  }
  if (metadata.track_phase !== '3.26') {
    addFailure(file, category, `metadata.track_phase must be 3.26, found "${metadata.track_phase}"`);
  }
  if (metadata.status !== 'local_evidence_packet_contract') {
    addFailure(file, category, `metadata.status must be local_evidence_packet_contract, found "${metadata.status}"`);
  }
  [
    ...expectedTrack322BoundaryFalseFlags,
    'alternate_vault_execution',
    'active_vault_switch',
    'multi_vault_runtime_support'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, category, `metadata.${flag} must be false`);
    }
  });

  if (contract.supported_vault_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, category, 'supported_vault_commit must match accepted pinned Vault commit');
  }
  validateExpectedMembers(file, category, contract.required_packet_fields, expectedTrack326PacketFields, 'required_packet_fields');
  validateExpectedMembers(file, category, contract.allowed_compatibility_decisions, expectedTrack326Decisions, 'allowed_compatibility_decisions');

  const reportOutput = contract.report_output || {};
  if (reportOutput.path !== '.track3-runs/latest-nexus-vault-compatibility-evidence-packet-validation-report.json') {
    addFailure(file, category, 'report_output.path must remain under ignored .track3-runs/');
  }
  if (reportOutput.git_ignored !== true || reportOutput.must_not_be_committed !== true) {
    addFailure(file, category, 'report_output must be ignored and not committed');
  }

  const boundary = contract.boundary_invariants || {};
  [
    'validates_metadata_shape_only',
    'evaluates_alternate_vault_code',
    'executes_alternate_vault_code',
    'switches_active_vault',
    'creates_multi_vault_runtime_support',
    'authorizes_public_runtime',
    'reclassifies_conduit_as_palisade'
  ].forEach(flag => {
    const expected = flag === 'validates_metadata_shape_only';
    if (boundary[flag] !== expected) {
      addFailure(file, category, `boundary_invariants.${flag} must be ${expected}`);
    }
  });
}

function validateTrack326EvidencePacketFixtures(suite, contract) {
  const file = 'data/nexus-vault-compatibility-evidence-packet-fixtures.v1.json';
  const category = 'Track 3.26 Vault compatibility evidence packet fixtures';

  requirePath(suite, ['metadata'], file, category);
  requirePath(suite, ['supported_vault_commit'], file, category);
  requirePath(suite, ['required_fixture_ids'], file, category);
  requirePath(suite, ['fixtures'], file, category);

  const metadata = suite.metadata || {};
  if (metadata.version !== '1.0.0') {
    addFailure(file, category, `metadata.version must be 1.0.0, found "${metadata.version}"`);
  }
  if (metadata.track_phase !== '3.26') {
    addFailure(file, category, `metadata.track_phase must be 3.26, found "${metadata.track_phase}"`);
  }
  if (metadata.status !== 'local_evidence_packet_fixture_set') {
    addFailure(file, category, `metadata.status must be local_evidence_packet_fixture_set, found "${metadata.status}"`);
  }
  [
    ...expectedTrack322BoundaryFalseFlags,
    'alternate_vault_execution',
    'active_vault_switch',
    'multi_vault_runtime_support'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, category, `metadata.${flag} must be false`);
    }
  });

  if (suite.supported_vault_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, category, 'supported_vault_commit must match accepted pinned Vault commit');
  }
  if (contract && contract.supported_vault_commit && suite.supported_vault_commit !== contract.supported_vault_commit) {
    addFailure(file, category, 'supported_vault_commit must match the evidence packet contract');
  }
  validateExpectedMembers(file, category, suite.required_fixture_ids, expectedTrack326FixtureIds, 'required_fixture_ids');

  const allowedDecisions = new Set(contract && contract.allowed_compatibility_decisions || []);
  const requiredFields = contract && contract.required_packet_fields || expectedTrack326PacketFields;
  const fixtures = Array.isArray(suite.fixtures) ? suite.fixtures : [];
  const fixtureIds = new Set();

  fixtures.forEach((fixture, index) => {
    const label = fixture.fixture_id || `fixtures[${index}]`;
    fixtureIds.add(fixture.fixture_id);
    requirePath(fixture, ['packet'], file, category);
    requirePath(fixture, ['expected_decision'], file, category);
    requirePath(fixture, ['expected_valid'], file, category);

    const packet = fixture.packet || {};
    requiredFields.forEach(field => {
      if (packet[field] === undefined || packet[field] === null) {
        addFailure(file, category, `${label} packet missing ${field}`);
      }
    });
    if (!allowedDecisions.has(packet.compatibility_decision)) {
      addFailure(file, category, `${label} uses unsupported compatibility_decision ${packet.compatibility_decision}`);
    }
    if (fixture.expected_decision !== packet.compatibility_decision) {
      addFailure(file, category, `${label} expected_decision must match packet.compatibility_decision`);
    }
    if (packet.candidate_vault_commit !== suite.supported_vault_commit && packet.compatibility_decision === 'accepted_current_supported') {
      addFailure(file, category, `${label} non-pinned candidate must not be accepted_current_supported`);
    }
    if (packet.candidate_vault_commit === suite.supported_vault_commit && packet.compatibility_decision !== 'accepted_current_supported') {
      addFailure(file, category, `${label} pinned candidate must remain accepted_current_supported`);
    }
    if (packet.compatibility_decision !== 'accepted_current_supported' && (!Array.isArray(packet.blocking_reasons) || !packet.blocking_reasons.length)) {
      addFailure(file, category, `${label} non-accepted packet must include blocking_reasons`);
    }
  });

  expectedTrack326FixtureIds.forEach(fixtureId => {
    if (!fixtureIds.has(fixtureId)) {
      addFailure(file, category, `Missing fixture ${fixtureId}`);
    }
  });
}

function validateTrack326EvidencePacketValidatorScript() {
  const file = 'scripts/validate-nexus-vault-compatibility-evidence-packet.mjs';
  if (!existsSync(path.join(repoRoot, file))) {
    addFailure(file, 'Track 3.26 evidence packet validator', 'Evidence packet validator script is missing');
    return;
  }

  const text = readText(file);
  [
    ['contract input', /data\/nexus-vault-compatibility-evidence-packet-contract\.v1\.json/],
    ['fixture input', /data\/nexus-vault-compatibility-evidence-packet-fixtures\.v1\.json/],
    ['compatibility policy input', /data\/nexus-vault-version-compatibility\.v1\.json/],
    ['ignored report output', /\.track3-runs\/latest-nexus-vault-compatibility-evidence-packet-validation-report\.json/],
    ['accepted current supported decision', /accepted_current_supported/],
    ['complete non-pinned not supported decision', /candidate_packet_valid_but_not_supported/],
    ['candidate packet incomplete decision', /candidate_packet_incomplete/],
    ['candidate blocked decision', /candidate_blocked/],
    ['candidate incompatible decision', /candidate_incompatible/],
    ['invalid packet decision', /invalid_packet/],
    ['supported pinned Vault commit', /ab95cbbd24df5817c4e363d24b3b199ac8af6c6f/],
    ['metadata-only boundary output', /metadata\/evidence-packet shape validation only/],
    ['alternate Vault execution boundary flag', /alternate_vault_execution:\s*false/],
    ['active Vault switch boundary flag', /active_vault_switch:\s*false/],
    ['multi-Vault runtime support boundary flag', /multi_vault_runtime_support:\s*false/]
  ].forEach(([label, pattern]) => {
    if (!pattern.test(text)) {
      addFailure(file, 'Track 3.26 evidence packet validator', `Script missing ${label}`);
    }
  });

  const prohibitedPatterns = [
    { label: 'NEXUS import execution', pattern: /from\s+['"].*nexus|import\s+.*nexus|python.*-c.*import/i },
    { label: 'alternate clone', pattern: /\bgit\s+clone\b|['"]clone['"]/i },
    { label: 'dependency installation', pattern: /\b(?:pip3?|npm)\s+install\b|['"]install['"]/i },
    { label: 'public UI wiring', pattern: /\bdocument\.|\bwindow\.|querySelector|addEventListener/i },
    { label: 'public HTML modification target', pattern: /index\.html/i },
    { label: 'production browser JS modification target', pattern: /js\/(?:app|docs|pipeline|grid|governance-engine|trace-viewer)\.js/i },
    { label: 'network fetch', pattern: /\bfetch\s*\(|https?:\/\//i },
    { label: 'model API environment assignment', pattern: /ANTHROPIC_API_KEY\s*=/i }
  ];

  prohibitedPatterns.forEach(({ label, pattern }) => {
    if (pattern.test(text)) {
      addFailure(file, 'Track 3.26 evidence packet validator', `Script contains prohibited ${label}`);
    }
  });
}

function validateTrack327CandidateIntakeFixtures(suite, evidencePacketContract) {
  const file = 'data/nexus-vault-candidate-intake-fixtures.v1.json';
  const category = 'Track 3.27 Vault candidate intake fixtures';

  requirePath(suite, ['metadata'], file, category);
  requirePath(suite, ['supported_vault_commit'], file, category);
  requirePath(suite, ['allowed_intake_decisions'], file, category);
  requirePath(suite, ['required_fixture_ids'], file, category);
  requirePath(suite, ['fixture_policy'], file, category);
  requirePath(suite, ['fixtures'], file, category);

  const metadata = suite.metadata || {};
  if (metadata.version !== '1.0.0') {
    addFailure(file, category, `metadata.version must be 1.0.0, found "${metadata.version}"`);
  }
  if (metadata.track_phase !== '3.27') {
    addFailure(file, category, `metadata.track_phase must be 3.27, found "${metadata.track_phase}"`);
  }
  if (metadata.status !== 'local_candidate_intake_gate_fixtures') {
    addFailure(file, category, `metadata.status must be local_candidate_intake_gate_fixtures, found "${metadata.status}"`);
  }
  [
    ...expectedTrack322BoundaryFalseFlags,
    'alternate_vault_execution',
    'active_vault_switch',
    'multi_vault_runtime_support'
  ].forEach(flag => {
    if (metadata[flag] !== false) {
      addFailure(file, category, `metadata.${flag} must be false`);
    }
  });

  if (suite.supported_vault_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure(file, category, 'supported_vault_commit must match accepted pinned Vault commit');
  }
  if (evidencePacketContract && evidencePacketContract.supported_vault_commit && suite.supported_vault_commit !== evidencePacketContract.supported_vault_commit) {
    addFailure(file, category, 'supported_vault_commit must match the evidence packet contract');
  }

  validateExpectedMembers(file, category, suite.allowed_intake_decisions, expectedTrack327IntakeDecisions, 'allowed_intake_decisions');
  validateExpectedMembers(file, category, suite.required_fixture_ids, expectedTrack327FixtureIds, 'required_fixture_ids');

  const fixturePolicy = suite.fixture_policy || {};
  [
    'evaluate_metadata_only',
    'must_not_import_nexus',
    'must_not_execute_nexus',
    'must_not_use_network',
    'must_not_mutate_pinned_vault',
    'must_not_switch_active_vault',
    'must_not_create_runtime_multi_vault_support',
    'non_pinned_candidate_can_only_be_eligible',
    'eligible_for_compatibility_evaluation_is_not_support_acceptance'
  ].forEach(flag => {
    if (fixturePolicy[flag] !== true) {
      addFailure(file, category, `fixture_policy.${flag} must be true`);
    }
  });

  const allowedDecisions = new Set(suite.allowed_intake_decisions || []);
  const requiredFields = evidencePacketContract && evidencePacketContract.required_packet_fields || expectedTrack326PacketFields;
  const fixtures = Array.isArray(suite.fixtures) ? suite.fixtures : [];
  const fixtureIds = new Set();

  fixtures.forEach((fixture, index) => {
    const label = fixture.fixture_id || `fixtures[${index}]`;
    fixtureIds.add(fixture.fixture_id);
    requirePath(fixture, ['fixture_id'], file, category);
    requirePath(fixture, ['expected_intake_decision'], file, category);
    requirePath(fixture, ['expected_can_proceed_to_compatibility_evaluation'], file, category);
    requirePath(fixture, ['expected_supported'], file, category);

    if (!allowedDecisions.has(fixture.expected_intake_decision)) {
      addFailure(file, category, `${label} uses unsupported expected_intake_decision ${fixture.expected_intake_decision}`);
    }
    if (typeof fixture.expected_can_proceed_to_compatibility_evaluation !== 'boolean') {
      addFailure(file, category, `${label} expected_can_proceed_to_compatibility_evaluation must be boolean`);
    }
    if (typeof fixture.expected_supported !== 'boolean') {
      addFailure(file, category, `${label} expected_supported must be boolean`);
    }

    if (fixture.fixture_id === 'missing_packet') {
      if (fixture.packet !== null) {
        addFailure(file, category, 'missing_packet fixture must use packet: null');
      }
      if (fixture.expected_intake_decision !== 'blocked_missing_evidence') {
        addFailure(file, category, 'missing_packet fixture must be blocked_missing_evidence');
      }
      return;
    }

    if (!isObject(fixture.packet)) {
      addFailure(file, category, `${label} packet must be present`);
      return;
    }

    const packet = fixture.packet;
    requiredFields.forEach(field => {
      if (packet[field] === undefined || packet[field] === null) {
        addFailure(file, category, `${label} packet missing ${field}`);
      }
    });
    if (typeof packet.candidate_vault_commit !== 'string' || !/^[a-f0-9]{40}$/.test(packet.candidate_vault_commit)) {
      addFailure(file, category, `${label} candidate_vault_commit must be 40 lowercase hex characters`);
    }
    if (packet.candidate_vault_commit !== suite.supported_vault_commit && fixture.expected_intake_decision === 'accepted_current_supported') {
      addFailure(file, category, `${label} non-pinned candidate must not be accepted_current_supported`);
    }
    if (packet.candidate_vault_commit !== suite.supported_vault_commit && fixture.expected_supported === true) {
      addFailure(file, category, `${label} non-pinned candidate must not be marked supported`);
    }
    if (fixture.expected_intake_decision === 'eligible_for_compatibility_evaluation' && fixture.expected_supported !== false) {
      addFailure(file, category, `${label} eligible_for_compatibility_evaluation must not be support acceptance`);
    }
    if (fixture.expected_intake_decision.startsWith('blocked_') && (!Array.isArray(packet.blocking_reasons) || !packet.blocking_reasons.length)) {
      addFailure(file, category, `${label} blocked intake fixture must include blocking_reasons`);
    }
    if (packet.generated_artifacts_boundary_result === 'staged') {
      addFailure(file, category, `${label} must not stage generated .track3-runs artifacts`);
    }
  });

  expectedTrack327FixtureIds.forEach(fixtureId => {
    if (!fixtureIds.has(fixtureId)) {
      addFailure(file, category, `Missing fixture ${fixtureId}`);
    }
  });
}

function validateTrack327CandidateIntakeGateScript() {
  const file = 'scripts/run-nexus-vault-candidate-intake-gate-stub.mjs';
  if (!existsSync(path.join(repoRoot, file))) {
    addFailure(file, 'Track 3.27 Vault candidate intake gate', 'Candidate intake gate script is missing');
    return;
  }

  const text = readText(file);
  [
    ['fixture input', /data\/nexus-vault-candidate-intake-fixtures\.v1\.json/],
    ['evidence packet contract input', /data\/nexus-vault-compatibility-evidence-packet-contract\.v1\.json/],
    ['compatibility policy input', /data\/nexus-vault-version-compatibility\.v1\.json/],
    ['ignored report output', /\.track3-runs\/latest-nexus-vault-candidate-intake-gate-report\.json/],
    ['accepted current supported decision', /accepted_current_supported/],
    ['eligible for compatibility evaluation decision', /eligible_for_compatibility_evaluation/],
    ['blocked missing evidence decision', /blocked_missing_evidence/],
    ['blocked failed evidence decision', /blocked_failed_evidence/],
    ['blocked semantic drift decision', /blocked_semantic_drift/],
    ['blocked boundary violation decision', /blocked_boundary_violation/],
    ['blocked source mismatch decision', /blocked_source_mismatch/],
    ['invalid intake fixture decision', /invalid_intake_fixture/],
    ['supported pinned Vault commit', /ab95cbbd24df5817c4e363d24b3b199ac8af6c6f/],
    ['metadata intake boundary output', /metadata\/evidence intake only/],
    ['alternate Vault execution boundary flag', /alternate_vault_execution:\s*false/],
    ['active Vault switch boundary flag', /active_vault_switch:\s*false/],
    ['multi-Vault runtime support boundary flag', /multi_vault_runtime_support:\s*false/],
    ['eligibility not support acceptance boundary', /eligible_for_compatibility_evaluation_is_support_acceptance:\s*false/]
  ].forEach(([label, pattern]) => {
    if (!pattern.test(text)) {
      addFailure(file, 'Track 3.27 Vault candidate intake gate', `Script missing ${label}`);
    }
  });

  const prohibitedPatterns = [
    { label: 'NEXUS import execution', pattern: /from\s+['"].*nexus|import\s+.*nexus|python.*-c.*import/i },
    { label: 'dependency installation', pattern: /\b(?:pip3?|npm)\s+install\b|['"]install['"]/i },
    { label: 'public UI wiring', pattern: /\bdocument\.|\bwindow\.|querySelector|addEventListener/i },
    { label: 'public HTML modification target', pattern: /index\.html/i },
    { label: 'production browser JS modification target', pattern: /js\/(?:app|docs|pipeline|grid|governance-engine|trace-viewer)\.js/i },
    { label: 'network fetch', pattern: /\bfetch\s*\(|https?:\/\//i },
    { label: 'model API environment assignment', pattern: /ANTHROPIC_API_KEY\s*=/i }
  ];

  prohibitedPatterns.forEach(({ label, pattern }) => {
    if (pattern.test(text)) {
      addFailure(file, 'Track 3.27 Vault candidate intake gate', `Script contains prohibited ${label}`);
    }
  });
}

function validateNexusImportAdapterReportsScript() {
  const file = 'scripts/validate-nexus-import-adapter-reports.mjs';
  if (!existsSync(path.join(repoRoot, file))) {
    addFailure(file, 'NEXUS import adapter report validator', 'Report validator script is missing');
    return;
  }

  const text = readText(file);
  [
    ['report contract input', /data\/nexus-import-adapter-report-contract\.v0\.json/],
    ['local report path', /\.track3-runs\/latest-nexus-import-adapter-local-report\.json/],
    ['regression report path', /\.track3-runs\/latest-nexus-import-adapter-regression-suite-report\.json/],
    ['pinned NEXUS commit check', /ab95cbbd24df5817c4e363d24b3b199ac8af6c6f/],
    ['trace boundary check', /local_adapter_run_not_persistent_not_ledger/],
    ['release eligibility failure group', /release_eligibility_failure/],
    ['ledger boundary failure group', /ledger_boundary_failure/],
    ['deterministic identity failure group', /deterministic_identity_failure/],
    ['claim boundary failure group', /claim_boundary_failure/]
  ].forEach(([label, pattern]) => {
    if (!pattern.test(text)) {
      addFailure(file, 'NEXUS import adapter report validator', `Script missing ${label}`);
    }
  });

  const prohibitedPatterns = [
    { label: 'dependency installation', pattern: /\b(?:pip3?|npm)\s+install\b|['"]install['"]/i },
    { label: 'public UI wiring', pattern: /\bdocument\.|\bwindow\.|querySelector|addEventListener/i },
    { label: 'public HTML modification target', pattern: /index\.html/i },
    { label: 'production browser JS modification target', pattern: /js\/(?:app|docs|pipeline|grid|governance-engine|trace-viewer)\.js/i },
    { label: 'network fetch', pattern: /\bfetch\s*\(|https?:\/\//i }
  ];

  prohibitedPatterns.forEach(({ label, pattern }) => {
    if (pattern.test(text)) {
      addFailure(file, 'NEXUS import adapter report validator', `Script contains prohibited ${label}`);
    }
  });
}

function validateNexusImportAdapterFailureInjectionScript() {
  const file = 'scripts/run-nexus-import-adapter-failure-injection-suite.mjs';
  if (!existsSync(path.join(repoRoot, file))) {
    addFailure(file, 'NEXUS import adapter failure injection', 'Failure-injection suite script is missing');
    return;
  }

  const text = readText(file);
  [
    ['Track 3.20 phase marker', /'3\.20'|3\.20-3\.21/],
    ['local suite report output path', /\.track3-runs\/latest-nexus-import-adapter-failure-injection-suite-report\.json/],
    ['individual failure report output pattern', /nexus-import-adapter-failure-injection-/],
    ['report contract input', /data\/nexus-import-adapter-report-contract\.v0\.json/],
    ['pinned NEXUS commit reference', /ab95cbbd24df5817c4e363d24b3b199ac8af6c6f/],
    ['local adapter trace boundary', /local_adapter_run_not_persistent_not_ledger/],
    ['Track 3.21 completion marker', /3\.20-3\.21|tracksCompleted/],
    ['manifest mapping missing injection', /manifest_mapping_missing/],
    ['NEXUS execution failure injection', /nexus_execution_failure/],
    ['release eligibility incoherence injection', /release_eligibility_incoherent/],
    ['trace boundary violation injection', /trace_boundary_violation/],
    ['claim boundary violation injection', /claim_boundary_violation/],
    ['public runtime boundary flag', /public_runtime/],
    ['persistence boundary flag', /persistence/],
    ['ledger boundary flag', /ledger/],
    ['model execution boundary flag', /model_execution/],
    ['backend boundary flag', /backend/],
    ['auth boundary flag', /auth/],
    ['database boundary flag', /database/],
    ['live orchestration boundary flag', /live_orchestration/],
    ['public UI wiring boundary flag', /public_ui_wiring/]
  ].forEach(([label, pattern]) => {
    if (!pattern.test(text)) {
      addFailure(file, 'NEXUS import adapter failure injection', `Script missing ${label}`);
    }
  });

  const prohibitedPatterns = [
    { label: 'dependency installation', pattern: /\b(?:pip3?|npm)\s+install\b|['"]install['"]/i },
    { label: 'public UI wiring', pattern: /\bdocument\.|\bwindow\.|querySelector|addEventListener/i },
    { label: 'public HTML modification target', pattern: /index\.html/i },
    { label: 'production browser JS modification target', pattern: /js\/(?:app|docs|pipeline|grid|governance-engine|trace-viewer)\.js/i },
    { label: 'network fetch', pattern: /\bfetch\s*\(|https?:\/\//i },
    { label: 'model API environment assignment', pattern: /ANTHROPIC_API_KEY\s*=/i }
  ];

  prohibitedPatterns.forEach(({ label, pattern }) => {
    if (pattern.test(text)) {
      addFailure(file, 'NEXUS import adapter failure injection', `Script contains prohibited ${label}`);
    }
  });
}

function validateNexusImportAdapterFailureInjectionReportIfPresent() {
  const file = '.track3-runs/latest-nexus-import-adapter-failure-injection-suite-report.json';
  const absolute = path.join(repoRoot, file);
  if (!existsSync(absolute)) return;

  let report;
  try {
    report = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    addFailure(file, 'NEXUS import adapter failure injection report', error.message);
    return;
  }

  const meta = report.meta || {};
  if (meta.run_mode !== 'local_nexus_import_adapter_failure_injection_suite') {
    addFailure(file, 'NEXUS import adapter failure injection report', 'meta.run_mode must be local_nexus_import_adapter_failure_injection_suite');
  }
  [
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database',
    'live_orchestration',
    'public_ui_wiring'
  ].forEach(flag => {
    if (meta[flag] !== false) {
      addFailure(file, 'NEXUS import adapter failure injection report', `meta.${flag} must be false`);
    }
  });

  const nexusBoundary = report.nexus_boundary || {};
  if (nexusBoundary.nexus_execution !== false || nexusBoundary.python_execution !== false) {
    addFailure(file, 'NEXUS import adapter failure injection report', 'failure-injection suite must not execute NEXUS or Python');
  }
  if (nexusBoundary.nexus_source_modified !== false) {
    addFailure(file, 'NEXUS import adapter failure injection report', 'nexus_boundary.nexus_source_modified must be false');
  }
  if (nexusBoundary.dependency_installation_performed !== false) {
    addFailure(file, 'NEXUS import adapter failure injection report', 'nexus_boundary.dependency_installation_performed must be false');
  }

  const summary = report.suite_summary || {};
  if (summary.total_injections !== 15) {
    addFailure(file, 'NEXUS import adapter failure injection report', 'suite_summary.total_injections must be 15');
  }
  if (summary.failed_injections !== 0) {
    addFailure(file, 'NEXUS import adapter failure injection report', 'suite_summary.failed_injections must be 0');
  }

  const covered = new Set(summary.categories_covered || []);
  [
    'nexus_path_missing',
    'nexus_commit_mismatch',
    'nexus_working_tree_dirty',
    'fixture_mapping_missing',
    'regulatory_context_missing',
    'manifest_mapping_missing',
    'nexus_execution_failure',
    'malformed_nexus_result',
    'unknown_nexus_verdict',
    'unknown_risk_level',
    'missing_omega_decision',
    'nondeterministic_output',
    'release_eligibility_incoherent',
    'trace_boundary_violation',
    'claim_boundary_violation'
  ].forEach(category => {
    if (!covered.has(category)) {
      addFailure(file, 'NEXUS import adapter failure injection report', `categories_covered missing ${category}`);
    }
  });

  const release = report.release_eligibility_summary || {};
  if (release.all_blocked !== true) {
    addFailure(file, 'NEXUS import adapter failure injection report', 'release_eligibility_summary.all_blocked must be true');
  }
  if (Array.isArray(release.eligible) && release.eligible.length > 0) {
    addFailure(file, 'NEXUS import adapter failure injection report', 'no injected failure may be release eligible');
  }

  const trace = report.trace_boundary_summary || {};
  if (trace.trace_status !== 'local_adapter_run_not_persistent_not_ledger') {
    addFailure(file, 'NEXUS import adapter failure injection report', 'trace_boundary_summary.trace_status must be local_adapter_run_not_persistent_not_ledger');
  }
  if (trace.all_local_non_persistent_non_ledger !== true) {
    addFailure(file, 'NEXUS import adapter failure injection report', 'trace_boundary_summary.all_local_non_persistent_non_ledger must be true');
  }

  const results = Array.isArray(report.injection_results) ? report.injection_results : [];
  if (results.length !== 15) {
    addFailure(file, 'NEXUS import adapter failure injection report', 'injection_results must include 15 entries');
  }
  results.forEach(result => {
    if (result.release_eligible !== false) {
      addFailure(file, 'NEXUS import adapter failure injection report', `${result.injection_id} must be blocked`);
    }
    if (result.trace_status !== 'local_adapter_run_not_persistent_not_ledger') {
      addFailure(file, 'NEXUS import adapter failure injection report', `${result.injection_id} trace boundary drifted`);
    }
    if (result.claim_boundary_preserved !== true) {
      addFailure(file, 'NEXUS import adapter failure injection report', `${result.injection_id} claim boundary drifted`);
    }
    if (result.passed !== true) {
      addFailure(file, 'NEXUS import adapter failure injection report', `${result.injection_id} did not pass fail-closed validation`);
    }
  });

  const claimBoundary = report.claim_boundary || {};
  [
    'not_public_runtime',
    'not_persistent',
    'not_ledger',
    'not_backend',
    'not_auth',
    'not_model_execution',
    'not_live_orchestration',
    'not_production'
  ].forEach(flag => {
    if (claimBoundary[flag] !== true) {
      addFailure(file, 'NEXUS import adapter failure injection report', `claim_boundary.${flag} must be true`);
    }
  });
}

function sentenceContext(lines, index) {
  return lines
    .slice(Math.max(0, index - 20), Math.min(lines.length, index + 3))
    .join(' ')
    .trim();
}

function validateOperationalClaimScan(file) {
  const text = readText(file);
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    forbiddenPhrasePatterns.forEach(({ label, pattern }) => {
      if (!pattern.test(line)) return;
      const context = sentenceContext(lines, index);
      if (!allowedContextPattern.test(context)) {
        addFailure(
          file,
          'Operational claim scan',
          `Potential unbounded claim "${label}" at line ${index + 1}: ${line.trim()}`
        );
      }
    });
  });
}

function validateAllDataJsonFilesParsed() {
  const dataDir = path.join(repoRoot, 'data');
  readdirSync(dataDir)
    .filter(name => name.endsWith('.json'))
    .sort()
    .forEach(name => {
      const relative = relPath(path.join(dataDir, name));
      if (!parsed.has(relative)) parseJson(relative);
    });
}

function validateRequiredScriptFiles() {
  requiredScriptFiles.forEach(file => {
    if (!existsSync(path.join(repoRoot, file))) {
      addFailure(file, 'Required script', 'Required Track 3 validation script is missing');
    }
  });
}

function validateRequiredDocFiles() {
  requiredDocFiles.forEach(file => {
    if (!existsSync(path.join(repoRoot, file))) {
      addFailure(file, 'Required documentation', 'Required Track 3 documentation file is missing');
    }
  });
}

function printResults(filesValidated) {
  console.log('Track 3 contract validation');
  console.log('');
  console.log('Files validated:');
  filesValidated.forEach(file => console.log(`- ${file}`));
  console.log('');

  if (!failures.length) {
    console.log('Result: PASS');
    return;
  }

  console.log('Result: FAIL');
  console.log('');

  const grouped = new Map();
  failures.forEach(failure => {
    const key = `${failure.file}::${failure.category}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(failure.message);
  });

  grouped.forEach((messages, key) => {
    const [file, category] = key.split('::');
    console.log(`${file} — ${category}`);
    messages.forEach(message => console.log(`  - ${message}`));
    console.log('');
  });
}

const docs = parseJson('data/docs.json');
const scenarios = parseJson('data/scenarios.json');
const manifest = parseJson('data/joint-workflow.manifest.json');
const contract = parseJson('data/interface-contract.v0.json');
const fixture = parseJson('data/interface-fixture.example.v0.json');
const fixtureSuite = parseJson('data/interface-fixtures.v0.json');
const nexusReadiness = parseJson('data/nexus-adapter-readiness.v0.json');
const nexusAdapterStub = parseJson('data/nexus-adapter-contract.stub.v0.json');
const nexusMismatchFixtures = parseJson('data/nexus-adapter-mismatch-fixtures.v0.json');
const nexusNormalizationFixtures = parseJson('data/nexus-adapter-normalization-fixtures.v0.json');
const nexusImportPreflight = parseJson('data/nexus-import-adapter-preflight.v0.json');
const nexusSourcePinResolution = parseJson('data/nexus-source-pin-resolution.v0.json');
const nexusPinnedSourcePreflight = parseJson('data/nexus-pinned-source-preflight.v0.json');
const nexusImportAdapterReportContract = parseJson('data/nexus-import-adapter-report-contract.v0.json');
const interfaceContractV1 = parseJson('data/interface-contract.v1.json');
const nexusAdapterContractV1 = parseJson('data/nexus-adapter-contract.v1.json');
const nexusImportAdapterReportContractV1 = parseJson('data/nexus-import-adapter-report-contract.v1.json');
const track3LocalReportExportManifest = parseJson('data/track3-local-report-export-manifest.v1.json');
const conduitVersioningPolicy = parseJson('data/conduit-versioning-policy.v1.json');
const nexusVaultVersionCompatibility = parseJson('data/nexus-vault-version-compatibility.v1.json');
const nexusVaultCompatibilityEvaluationFixtures = parseJson('data/nexus-vault-compatibility-evaluation-fixtures.v1.json');
const nexusVaultEvidencePacketContract = parseJson('data/nexus-vault-compatibility-evidence-packet-contract.v1.json');
const nexusVaultEvidencePacketFixtures = parseJson('data/nexus-vault-compatibility-evidence-packet-fixtures.v1.json');
const nexusVaultCandidateIntakeFixtures = parseJson('data/nexus-vault-candidate-intake-fixtures.v1.json');

validateAllDataJsonFilesParsed();

if (contract) {
  validateContractShape(contract);
  validateMaturityLabels('data/interface-contract.v0.json', contract);
}

if (fixture) {
  validateMaturityLabels('data/interface-fixture.example.v0.json', fixture);
}

if (fixture && scenarios) {
  validateFixtureAlignment(fixture, scenarios, {
    expectedScenarioId: 'happy_path_valid_release'
  });
}
if (fixtureSuite) {
  validateMaturityLabels('data/interface-fixtures.v0.json', fixtureSuite);
}
if (fixtureSuite && scenarios) validateFixtureSuite(fixtureSuite, scenarios);
if (contract && fixture && manifest) validateManifestAlignment(contract, fixture);
if (contract && fixtureSuite && manifest) validateManifestAlignment(contract, fixtureSuite, 'data/interface-fixtures.v0.json');
if (nexusReadiness) validateNexusAdapterReadiness(nexusReadiness);
if (nexusAdapterStub) validateNexusAdapterContractStub(nexusAdapterStub);
if (nexusMismatchFixtures && nexusAdapterStub) validateNexusAdapterMismatchFixtures(nexusMismatchFixtures, nexusAdapterStub);
if (nexusNormalizationFixtures) validateNexusAdapterNormalizationFixtures(nexusNormalizationFixtures);
if (nexusImportPreflight) validateNexusImportAdapterPreflight(nexusImportPreflight);
if (nexusSourcePinResolution) validateNexusSourcePinResolution(nexusSourcePinResolution);
if (nexusPinnedSourcePreflight) validateNexusPinnedSourcePreflight(nexusPinnedSourcePreflight);
if (nexusImportAdapterReportContract) validateNexusImportAdapterReportContract(nexusImportAdapterReportContract);
if (interfaceContractV1) validateInterfaceContractV1(interfaceContractV1);
if (nexusAdapterContractV1) validateNexusAdapterContractV1(nexusAdapterContractV1);
if (nexusImportAdapterReportContractV1) validateNexusImportAdapterReportContractV1(nexusImportAdapterReportContractV1);
if (track3LocalReportExportManifest) validateTrack323ExportManifestContract(track3LocalReportExportManifest);
if (conduitVersioningPolicy) validateConduitVersioningPolicy(conduitVersioningPolicy);
if (nexusVaultVersionCompatibility) validateNexusVaultCompatibilityPolicy(nexusVaultVersionCompatibility);
if (nexusVaultCompatibilityEvaluationFixtures) {
  validateTrack325VaultCompatibilityFixtures(nexusVaultCompatibilityEvaluationFixtures, nexusVaultVersionCompatibility);
}
if (nexusVaultEvidencePacketContract) validateTrack326EvidencePacketContract(nexusVaultEvidencePacketContract);
if (nexusVaultEvidencePacketFixtures) {
  validateTrack326EvidencePacketFixtures(nexusVaultEvidencePacketFixtures, nexusVaultEvidencePacketContract);
}
if (nexusVaultCandidateIntakeFixtures) {
  validateTrack327CandidateIntakeFixtures(nexusVaultCandidateIntakeFixtures, nexusVaultEvidencePacketContract);
}
validateNexusImportEnvironmentPreflightScript();
validateLocalNexusImportAdapterScript();
validateLocalNexusImportAdapterReportIfPresent();
validateLocalNexusImportAdapterRegressionSuiteScript();
validateLocalNexusImportAdapterRegressionReportIfPresent();
validateNexusImportAdapterReportsScript();
validateNexusImportAdapterFailureInjectionScript();
validateNexusImportAdapterFailureInjectionReportIfPresent();
validateTrack323ExportScript();
validateTrack325VaultCompatibilityHarnessScript();
validateTrack326EvidencePacketValidatorScript();
validateTrack327CandidateIntakeGateScript();
validateRequiredScriptFiles();
validateRequiredDocFiles();

track3TextFiles.forEach(validateOperationalClaimScan);

const filesValidated = [
  ...new Set([
    ...dataFiles,
    ...track3TextFiles,
    ...requiredScriptFiles,
    ...Array.from(parsed.keys())
  ])
].sort();

printResults(filesValidated);

if (failures.length) {
  process.exitCode = 1;
}
