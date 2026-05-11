#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const files = {
  contract: 'data/nexus-adapter-contract.stub.v0.json',
  fixtures: 'data/nexus-adapter-normalization-fixtures.v0.json',
  scenarios: 'data/scenarios.json',
  interfaceContract: 'data/interface-contract.v0.json',
  interfaceFixtures: 'data/interface-fixtures.v0.json',
  outputDir: '.track3-runs',
  outputFile: '.track3-runs/latest-nexus-adapter-normalizer-stub-report.json'
};

const requiredCategories = [
  'nexus_like_release_candidate',
  'nexus_like_escalation_candidate',
  'nexus_like_freeze_candidate',
  'nexus_like_repair_candidate',
  'nexus_like_audit_log_reference',
  'nexus_like_manifest_routing',
  'nexus_like_deterministic_duplicate'
];

const failures = [];

function addFailure(category, message) {
  failures.push({ category, message });
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
  } catch (error) {
    addFailure('JSON parse', `${relativePath}: ${error.message}`);
    return null;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

function validateBoundaryFlags(file, item, label) {
  if (item.integration_status !== 'not_integrated') {
    addFailure('Boundary flags', `${file}:${label} integration_status must be not_integrated`);
  }
  [
    'nexus_execution',
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend'
  ].forEach(flag => {
    if (item[flag] !== false) {
      addFailure('Boundary flags', `${file}:${label} ${flag} must be false`);
    }
  });
}

function validateFixtureShape(fixture, scenarioIds) {
  const label = fixture.fixture_id || 'unknown_fixture';
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
      addFailure('Fixture shape', `${label} missing ${key}`);
    }
  });

  if (fixture.source_scenario_id && !scenarioIds.has(fixture.source_scenario_id)) {
    addFailure('Scenario reference', `${label} references unknown scenario ${fixture.source_scenario_id}`);
  }

  validateBoundaryFlags(files.fixtures, fixture, label);

  const text = JSON.stringify(fixture).toLowerCase();
  if (/\bledger_valid"\s*:\s*true/.test(text) || /\bpersistent ledger\b|\bproduction ledger\b/.test(text)) {
    addFailure('Ledger boundary', `${label} must not claim ledger validity`);
  }
  if (/\bruns\s+nexus\b|\bnexus powers\b|\blive governance kernel\b|\bproduction runtime\b/.test(text)) {
    addFailure('Claim boundary', `${label} contains unbounded operational language`);
  }

  const trace = fixture.expected_trace_boundary || {};
  if (trace.trace_status !== 'local_dry_run_not_persistent_not_ledger') {
    addFailure('Trace boundary', `${label} trace status must be local_dry_run_not_persistent_not_ledger`);
  }
  if (trace.not_persistent !== true || trace.not_ledger !== true) {
    addFailure('Trace boundary', `${label} trace boundary must state not_persistent and not_ledger`);
  }
}

function expectedReleaseReason(category) {
  return {
    nexus_like_release_candidate: 'Simulated NEXUS-like release decision with passing gates and satisfied fixture evidence.',
    nexus_like_escalation_candidate: 'Simulated NEXUS-like escalation blocks release eligibility.',
    nexus_like_freeze_candidate: 'Simulated freeze condition blocks release eligibility.',
    nexus_like_repair_candidate: 'Simulated repair condition requires escalation and blocks release eligibility.',
    nexus_like_audit_log_reference: 'Audit-log reference remains non-ledger and prevents operational release evidence.',
    nexus_like_manifest_routing: 'Simulated manifest-routed escalation blocks release eligibility.',
    nexus_like_deterministic_duplicate: 'Repeated simulated NEXUS-like results normalize to identical decision-relevant fields.'
  }[category] || 'Local adapter normalizer stub result.';
}

function normalizeVerdict(source) {
  const stateChamber = source.omega && source.omega.state_chamber;
  const decision = source.omega && source.omega.decision;

  if (stateChamber === 'freeze') return 'fail';
  if (stateChamber === 'repair') return 'escalate';
  if (decision === 'release') return 'pass';
  if (decision === 'escalate') return 'escalate';
  return 'escalate';
}

function normalizeGateResults(source) {
  const gateResults = Array.isArray(source.gate_results) ? source.gate_results : [];
  return gateResults.map(result => ({
    gate_id: result.gate_id,
    status: result.status,
    source: result.source || 'simulated_nexus_like_result'
  }));
}

function normalizeEvidenceRequirements(source) {
  const requirements = Array.isArray(source.evidence_requirements) ? source.evidence_requirements : [];
  return requirements.map(requirement => ({
    label: requirement.label,
    evidence_present: requirement.evidence_present === true,
    required_for_status: requirement.required_for_status || 'local_adapter_normalizer_stub'
  }));
}

function buildDecisionRelevantResult(fixture, source) {
  const normalizedVerdict = normalizeVerdict(source);
  const normalizedGateResults = normalizeGateResults(source);
  const normalizedEvidenceRequirements = normalizeEvidenceRequirements(source);
  const allGatesPass = normalizedGateResults.every(result => result.status === 'pass');
  const allEvidencePresent = normalizedEvidenceRequirements.every(item => item.evidence_present === true);
  const auditLogNotLedger = source.audit_log_reference && source.audit_log_reference.ledger_valid !== true;
  const eligible = normalizedVerdict === 'pass' && allGatesPass && allEvidencePresent && !auditLogNotLedger;
  const manifestReference = source.manifest_route && source.manifest_route.manifest_reference
    ? source.manifest_route.manifest_reference
    : fixture.adapter_input_stub.governance_manifest_reference;

  return {
    normalized_verdict: normalizedVerdict,
    normalized_gate_results: normalizedGateResults,
    normalized_release_eligibility: {
      eligible,
      reason: expectedReleaseReason(fixture.normalization_category)
    },
    normalized_evidence_requirements: normalizedEvidenceRequirements,
    normalized_decision_explanation: {
      source_decision: source.omega && source.omega.decision || 'missing',
      source_delta_status: source.delta && source.delta.status || 'missing',
      reason: source.omega && source.omega.reasoning || 'Simulated NEXUS-like result normalized by local stub.'
    },
    normalized_manifest_reference: manifestReference,
    normalized_trace_event: {
      trace_status: 'local_dry_run_not_persistent_not_ledger',
      event_type: 'adapter_normalization',
      source: 'simulated_nexus_like_result'
    }
  };
}

function normalizeFixture(fixture, referenceNexusCommit) {
  const result = fixture.simulated_nexus_like_result;
  const source = Array.isArray(result.repeat_results) ? result.repeat_results[0] : result;
  const decisionRelevant = buildDecisionRelevantResult(fixture, source);
  const decisionHash = stableHash(decisionRelevant);

  let deterministicIdentity = null;
  if (Array.isArray(result.repeat_results)) {
    const hashes = result.repeat_results.map(item => stableHash(buildDecisionRelevantResult(fixture, item)));
    deterministicIdentity = {
      match: new Set(hashes).size === 1,
      hashes
    };
  }

  return {
    meta: {
      track_phase: '3.10',
      run_mode: 'local_adapter_normalizer_stub',
      integration_status: 'not_integrated',
      nexus_execution: false,
      public_runtime: false,
      persistence: false,
      ledger: false,
      model_execution: false,
      backend: false
    },
    source: {
      adapter_contract: files.contract,
      normalization_fixture: fixture.fixture_id,
      referenced_scenario_id: fixture.source_scenario_id || null,
      reference_nexus_commit: referenceNexusCommit
    },
    ...decisionRelevant,
    normalized_result_identity: decisionHash,
    deterministic_identity: deterministicIdentity,
    claim_boundary: {
      not_integrated: true,
      not_actual_nexus_execution: true,
      not_public_runtime: true,
      not_persistent: true,
      not_ledger: true,
      not_model_executing: true,
      not_backend: true
    }
  };
}

function compareExpected(fixture, normalized) {
  const label = fixture.fixture_id;
  const expected = fixture.expected_normalized_interface_result || {};

  if (normalized.normalized_verdict !== fixture.expected_verdict) {
    addFailure('Normalization expectation', `${label} expected verdict ${fixture.expected_verdict}, got ${normalized.normalized_verdict}`);
  }
  if (normalized.normalized_verdict !== expected.normalized_verdict) {
    addFailure('Normalization expectation', `${label} expected normalized_verdict ${expected.normalized_verdict}, got ${normalized.normalized_verdict}`);
  }
  if (normalized.normalized_release_eligibility.eligible !== fixture.expected_release_eligibility) {
    addFailure('Release eligibility', `${label} expected release eligibility ${fixture.expected_release_eligibility}, got ${normalized.normalized_release_eligibility.eligible}`);
  }
  if (normalized.normalized_release_eligibility.eligible !== expected.normalized_release_eligibility?.eligible) {
    addFailure('Release eligibility', `${label} expected result release eligibility ${expected.normalized_release_eligibility?.eligible}`);
  }
  if (normalized.normalized_release_eligibility.reason !== expected.normalized_release_eligibility?.reason) {
    addFailure('Release eligibility', `${label} release reason mismatch`);
  }
  if (normalized.normalized_manifest_reference !== expected.normalized_manifest_reference) {
    addFailure('Manifest reference', `${label} expected manifest ${expected.normalized_manifest_reference}, got ${normalized.normalized_manifest_reference}`);
  }
  if (normalized.normalized_trace_event.trace_status !== expected.normalized_trace_event?.trace_status) {
    addFailure('Trace boundary', `${label} trace status mismatch`);
  }
  if (normalized.normalized_trace_event.event_type !== expected.normalized_trace_event?.event_type) {
    addFailure('Trace boundary', `${label} event type mismatch`);
  }

  const gateSummary = normalized.normalized_gate_results.map(result => ({
    gate_id: result.gate_id,
    status: result.status
  }));
  if (stableStringify(gateSummary) !== stableStringify(fixture.expected_gate_results)) {
    addFailure('Gate results', `${label} gate results mismatch`);
  }

  const evidenceSummary = normalized.normalized_evidence_requirements.map(item => ({
    label: item.label,
    evidence_present: item.evidence_present
  }));
  if (stableStringify(evidenceSummary) !== stableStringify(fixture.expected_evidence_requirements)) {
    addFailure('Evidence requirements', `${label} evidence requirements mismatch`);
  }

  if (
    (normalized.normalized_verdict === 'fail' || normalized.normalized_verdict === 'escalate')
    && normalized.normalized_release_eligibility.eligible === true
  ) {
    addFailure('Release eligibility', `${label} cannot be release-eligible with ${normalized.normalized_verdict}`);
  }

  if (normalized.normalized_trace_event.trace_status !== 'local_dry_run_not_persistent_not_ledger') {
    addFailure('Trace boundary', `${label} must remain local dry-run not persistent not ledger`);
  }

  if (fixture.normalization_category === 'nexus_like_deterministic_duplicate') {
    if (!normalized.deterministic_identity || normalized.deterministic_identity.match !== true) {
      addFailure('Determinism', `${label} expected repeated normalized results to match`);
    }
    if (expected.deterministic_identity_match !== true) {
      addFailure('Determinism', `${label} expected fixture must declare deterministic_identity_match`);
    }
  }
}

function validateCategoryCoverage(fixtures) {
  const counts = new Map();
  fixtures.forEach(fixture => {
    counts.set(fixture.normalization_category, (counts.get(fixture.normalization_category) || 0) + 1);
  });

  requiredCategories.forEach(category => {
    const count = counts.get(category) || 0;
    if (count === 0) addFailure('Category coverage', `Missing normalization fixture for ${category}`);
    if (count > 1) addFailure('Category coverage', `Duplicate normalization fixtures for ${category}: ${count}`);
  });
}

function validateNoFabrication(fixture, normalized) {
  const input = fixture.adapter_input_stub || {};
  if (!input.regulatory_context) {
    addFailure('No fabrication', `${fixture.fixture_id} must not fabricate missing regulatory context`);
  }
  if (!input.governance_manifest_reference && normalized.normalized_manifest_reference) {
    addFailure('No fabrication', `${fixture.fixture_id} must not fabricate manifest mapping`);
  }
}

function main() {
  const contract = readJson(files.contract);
  const fixturesFile = readJson(files.fixtures);
  const scenarios = readJson(files.scenarios);
  readJson(files.interfaceContract);
  readJson(files.interfaceFixtures);

  if (!contract || !fixturesFile || !scenarios) {
    return null;
  }

  validateBoundaryFlags(files.fixtures, fixturesFile.metadata || {}, 'metadata');
  if (fixturesFile.metadata.reference_nexus_commit !== 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f') {
    addFailure('Reference commit', 'reference_nexus_commit must match ab95cbbd24df5817c4e363d24b3b199ac8af6c6f');
  }

  const fixtures = Array.isArray(fixturesFile.fixtures) ? fixturesFile.fixtures : [];
  const scenarioIds = new Set((scenarios.scenarios || []).map(item => item.id));
  validateCategoryCoverage(fixtures);

  const normalizedResults = fixtures.map(fixture => {
    validateFixtureShape(fixture, scenarioIds);
    const normalized = normalizeFixture(fixture, fixturesFile.metadata.reference_nexus_commit);
    compareExpected(fixture, normalized);
    validateNoFabrication(fixture, normalized);
    return normalized;
  });

  const report = {
    meta: {
      generated_at: new Date().toISOString(),
      script_name: 'scripts/run-nexus-adapter-normalizer-stub.mjs',
      track_phase: '3.10',
      run_mode: 'local_adapter_normalizer_stub',
      integration_status: 'not_integrated',
      nexus_execution: false,
      public_runtime: false,
      persistence: false,
      ledger: false,
      model_execution: false,
      backend: false
    },
    source: {
      adapter_contract: files.contract,
      normalization_fixtures: files.fixtures,
      scenarios: files.scenarios,
      reference_nexus_commit: fixturesFile.metadata.reference_nexus_commit
    },
    invariant_status: failures.length ? 'failed' : 'passed',
    claim_boundary_status: 'bounded',
    results: normalizedResults,
    failures
  };

  mkdirSync(path.join(repoRoot, files.outputDir), { recursive: true });
  writeFileSync(path.join(repoRoot, files.outputFile), `${JSON.stringify(report, null, 2)}\n`);

  return report;
}

const report = main();

console.log('Track 3.10 NEXUS adapter normalizer stub');
console.log('');
if (report) {
  console.log(`Fixtures: ${report.results.length}`);
  console.log(`Categories: ${report.results.map(item => item.source.normalization_fixture).join(', ')}`);
  console.log(`Output: ${files.outputFile}`);
  console.log('');
}

if (failures.length) {
  console.log('Result: FAIL');
  const grouped = new Map();
  failures.forEach(failure => {
    if (!grouped.has(failure.category)) grouped.set(failure.category, []);
    grouped.get(failure.category).push(failure.message);
  });
  grouped.forEach((messages, category) => {
    console.log(`${category}:`);
    messages.forEach(message => console.log(`  - ${message}`));
  });
  process.exitCode = 1;
} else {
  console.log('Result: PASS');
  console.log('');
  console.log('Boundary: simulated NEXUS-like result normalization only; no NEXUS import, Python execution, backend, persistence, ledger, auth, model execution, or public runtime.');
}
