#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
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
  'data/interface-fixtures.v0.json'
];

const track3TextFiles = [
  'data/interface-contract.v0.json',
  'data/interface-fixture.example.v0.json',
  'data/interface-fixtures.v0.json',
  'docs/TRACK_3_INTERFACE_CONTRACTS.md',
  'docs/TRACK_3_SCHEMA_ALIGNMENT.md',
  'docs/TRACK_3_VALIDATION_HARNESS.md',
  'docs/TRACK_3_LOCAL_FIXTURE_RUNTIME.md',
  'docs/TRACK_3_FIXTURE_SUITE.md',
  'docs/TRACK_3_CONTRACT_INVARIANTS.md'
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

track3TextFiles.forEach(validateOperationalClaimScan);

const filesValidated = [
  ...new Set([
    ...dataFiles,
    ...track3TextFiles,
    ...Array.from(parsed.keys())
  ])
].sort();

printResults(filesValidated);

if (failures.length) {
  process.exitCode = 1;
}
