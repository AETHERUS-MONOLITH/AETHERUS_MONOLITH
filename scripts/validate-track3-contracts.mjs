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
  'data/nexus-pinned-source-preflight.v0.json'
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
  'docs/TRACK_3_PINNED_NEXUS_SOURCE_PREFLIGHT.md'
];

const requiredScriptFiles = [
  'scripts/validate-nexus-adapter-normalizer-suite.mjs',
  'scripts/check-nexus-import-environment.mjs'
];

const requiredDocFiles = [
  'docs/TRACK_3_IMPORT_ENVIRONMENT_PREFLIGHT.md',
  'docs/TRACK_3_NEXUS_SOURCE_PIN_RESOLUTION.md',
  'docs/TRACK_3_PINNED_NEXUS_SOURCE_PREFLIGHT.md'
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
validateNexusImportEnvironmentPreflightScript();
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
