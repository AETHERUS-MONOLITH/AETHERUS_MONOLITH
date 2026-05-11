#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const files = {
  contract: 'data/nexus-adapter-contract.stub.v0.json',
  normalizationFixtures: 'data/nexus-adapter-normalization-fixtures.v0.json',
  mismatchFixtures: 'data/nexus-adapter-mismatch-fixtures.v0.json',
  interfaceContract: 'data/interface-contract.v0.json',
  scenarios: 'data/scenarios.json',
  normalizer: 'scripts/run-nexus-adapter-normalizer-stub.mjs',
  normalizerReport: '.track3-runs/latest-nexus-adapter-normalizer-stub-report.json'
};

const referenceNexusCommit = 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f';
const traceStatus = 'local_dry_run_not_persistent_not_ledger';
const failures = [];

function addFailure(category, message) {
  failures.push({ category, message });
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
  } catch (error) {
    addFailure('fixture_shape_failure', `${relativePath}: ${error.message}`);
    return null;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function runNormalizer() {
  const result = spawnSync(process.execPath, [files.normalizer], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    addFailure(
      'positive_case_failure',
      `Normalizer command failed with exit code ${result.status}.\n${result.stdout || ''}${result.stderr || ''}`.trim()
    );
    return false;
  }
  return true;
}

function hasFalseBoundaryFlags(item) {
  return [
    'nexus_execution',
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend'
  ].every(flag => item && item[flag] === false);
}

function validateCommonBoundary(item, label, category = 'claim_boundary_failure') {
  if (!item || item.integration_status !== 'not_integrated') {
    addFailure(category, `${label} integration_status must be not_integrated`);
  }
  if (!hasFalseBoundaryFlags(item)) {
    addFailure(category, `${label} must keep nexus_execution/public_runtime/persistence/ledger/model_execution/backend false`);
  }
}

function validateNoOperationalText(value, label) {
  const text = JSON.stringify(value).toLowerCase();
  if (/\bruns\s+nexus\b|\bnexus powers\b|\blive governance kernel\b|\bproduction runtime\b|\bnexus-integrated system\b/.test(text)) {
    addFailure('claim_boundary_failure', `${label} contains unbounded operational language`);
  }
  if (/\bledger_valid"\s*:\s*true|\bpersistent ledger\b|\bproduction ledger\b/.test(text)) {
    addFailure('trace_boundary_failure', `${label} claims ledger validity`);
  }
}

function validatePositiveCases(normalizationFixtures, report) {
  const byCategory = new Map();
  (normalizationFixtures.fixtures || []).forEach(fixture => byCategory.set(fixture.normalization_category, fixture));
  const byFixtureId = new Map((report.results || []).map(result => [result.source.normalization_fixture, result]));

  const expected = [
    ['nexus_like_release_candidate', 'pass', true],
    ['nexus_like_escalation_candidate', 'escalate', false],
    ['nexus_like_freeze_candidate', ['fail', 'escalate'], false],
    ['nexus_like_repair_candidate', 'escalate', false],
    ['nexus_like_audit_log_reference', 'pass', false],
    ['nexus_like_manifest_routing', 'escalate', false],
    ['nexus_like_deterministic_duplicate', 'pass', true]
  ];

  expected.forEach(([category, expectedVerdict, expectedEligibility]) => {
    const fixture = byCategory.get(category);
    if (!fixture) {
      addFailure('positive_case_failure', `Missing positive fixture category ${category}`);
      return;
    }
    validateCommonBoundary(fixture, fixture.fixture_id);
    validateNoOperationalText(fixture, fixture.fixture_id);

    const result = byFixtureId.get(fixture.fixture_id);
    if (!result) {
      addFailure('positive_case_failure', `Missing normalizer report result for ${fixture.fixture_id}`);
      return;
    }

    const expectedVerdicts = Array.isArray(expectedVerdict) ? expectedVerdict : [expectedVerdict];
    if (!expectedVerdicts.includes(result.normalized_verdict)) {
      addFailure('positive_case_failure', `${fixture.fixture_id} expected ${expectedVerdicts.join('/')} got ${result.normalized_verdict}`);
    }

    if (result.normalized_release_eligibility.eligible !== expectedEligibility) {
      addFailure('release_eligibility_failure', `${fixture.fixture_id} expected eligibility ${expectedEligibility}`);
    }

    if (
      (result.normalized_verdict === 'fail' || result.normalized_verdict === 'escalate')
      && result.normalized_release_eligibility.eligible === true
    ) {
      addFailure('release_eligibility_failure', `${fixture.fixture_id} has blocking verdict but release eligibility true`);
    }

    if (result.normalized_trace_event.trace_status !== traceStatus) {
      addFailure('trace_boundary_failure', `${fixture.fixture_id} trace status must be ${traceStatus}`);
    }

    if (category === 'nexus_like_audit_log_reference') {
      const auditRef = fixture.simulated_nexus_like_result.audit_log_reference;
      if (!auditRef || auditRef.ledger_valid !== false || auditRef.hash_chaining !== false) {
        addFailure('trace_boundary_failure', `${fixture.fixture_id} audit-log reference must stay non-ledger-valid`);
      }
    }

    if (category === 'nexus_like_manifest_routing' && !result.normalized_manifest_reference) {
      addFailure('positive_case_failure', `${fixture.fixture_id} must preserve a manifest reference`);
    }
  });
}

function validateMismatchCases(mismatchFixtures) {
  (mismatchFixtures.fixtures || []).forEach(fixture => {
    validateCommonBoundary(fixture, fixture.fixture_id, 'mismatch_case_failure');
    validateNoOperationalText(fixture, fixture.fixture_id);

    if (fixture.expected_normalized_verdict !== 'escalate') {
      addFailure('mismatch_case_failure', `${fixture.fixture_id} must fail closed to escalate`);
    }
    if (fixture.expected_release_eligibility !== false) {
      addFailure('release_eligibility_failure', `${fixture.fixture_id} mismatch fixture must block release eligibility`);
    }

    const boundary = fixture.expected_trace_boundary || {};
    if (!boundary.trace_status || !boundary.trace_status.includes('not_persistent') || !boundary.trace_status.includes('not_ledger')) {
      addFailure('trace_boundary_failure', `${fixture.fixture_id} must keep local/non-persistent/non-ledger trace boundary`);
    }
  });
}

function validateCrossSuite(normalizationFixtures, mismatchFixtures, report) {
  [normalizationFixtures, mismatchFixtures].forEach((suite, index) => {
    const label = index === 0 ? 'normalization fixtures' : 'mismatch fixtures';
    const commit = suite.metadata && (suite.metadata.reference_nexus_commit || suite.metadata.inspected_commit);
    if (commit && commit !== referenceNexusCommit) {
      addFailure('fixture_shape_failure', `${label} references ${commit}, expected ${referenceNexusCommit}`);
    }
  });

  (report.results || []).forEach(result => {
    validateCommonBoundary(result.meta, `${result.source.normalization_fixture} result meta`);
    if (result.normalized_trace_event.trace_status !== traceStatus) {
      addFailure('trace_boundary_failure', `${result.source.normalization_fixture} normalized trace status drifted`);
    }
    if (
      (result.normalized_verdict === 'fail' || result.normalized_verdict === 'escalate')
      && result.normalized_release_eligibility.eligible
    ) {
      addFailure('release_eligibility_failure', `${result.source.normalization_fixture} blocking result became release-eligible`);
    }
  });
}

function validateDeterministicIdentity(report) {
  const result = (report.results || []).find(item => item.source.normalization_fixture === 'normalize_nexus_like_deterministic_duplicate');
  if (!result) {
    addFailure('deterministic_identity_failure', 'Missing deterministic duplicate normalizer result');
    return;
  }
  if (!result.deterministic_identity || result.deterministic_identity.match !== true) {
    addFailure('deterministic_identity_failure', 'Deterministic duplicate result did not report matching identities');
    return;
  }
  const unique = new Set(result.deterministic_identity.hashes || []);
  if (unique.size !== 1) {
    addFailure('deterministic_identity_failure', 'Deterministic duplicate hashes do not match');
  }

  const decisionRelevant = {
    normalized_verdict: result.normalized_verdict,
    normalized_gate_results: result.normalized_gate_results,
    normalized_release_eligibility: result.normalized_release_eligibility,
    normalized_evidence_requirements: result.normalized_evidence_requirements,
    normalized_decision_explanation: result.normalized_decision_explanation,
    normalized_manifest_reference: result.normalized_manifest_reference,
    normalized_trace_event: result.normalized_trace_event
  };
  if (stableHash(decisionRelevant) !== result.normalized_result_identity) {
    addFailure('deterministic_identity_failure', 'Normalized result identity does not match decision-relevant field hash');
  }
}

function printResults() {
  console.log('NEXUS adapter normalizer positive/negative suite validation');
  console.log('');
  console.log('Files validated:');
  [
    files.contract,
    files.normalizationFixtures,
    files.mismatchFixtures,
    files.interfaceContract,
    files.scenarios,
    files.normalizerReport
  ].forEach(file => console.log(`- ${file}`));
  console.log('');

  if (!failures.length) {
    console.log('Result: PASS');
    return;
  }

  console.log('Result: FAIL');
  console.log('');
  const grouped = new Map();
  failures.forEach(failure => {
    if (!grouped.has(failure.category)) grouped.set(failure.category, []);
    grouped.get(failure.category).push(failure.message);
  });
  grouped.forEach((messages, category) => {
    console.log(`${category}:`);
    messages.forEach(message => console.log(`  - ${message}`));
    console.log('');
  });
}

const contract = readJson(files.contract);
const normalizationFixtures = readJson(files.normalizationFixtures);
const mismatchFixtures = readJson(files.mismatchFixtures);
readJson(files.interfaceContract);
readJson(files.scenarios);

if (contract) validateCommonBoundary(contract.metadata, 'adapter contract metadata');
if (normalizationFixtures) validateCommonBoundary(normalizationFixtures.metadata, 'normalization fixture metadata');
if (mismatchFixtures) validateCommonBoundary(mismatchFixtures.metadata, 'mismatch fixture metadata');

if (runNormalizer()) {
  const report = readJson(files.normalizerReport);
  if (normalizationFixtures && report) validatePositiveCases(normalizationFixtures, report);
  if (mismatchFixtures) validateMismatchCases(mismatchFixtures);
  if (normalizationFixtures && mismatchFixtures && report) validateCrossSuite(normalizationFixtures, mismatchFixtures, report);
  if (report) validateDeterministicIdentity(report);
}

printResults();

if (failures.length) {
  process.exitCode = 1;
}
