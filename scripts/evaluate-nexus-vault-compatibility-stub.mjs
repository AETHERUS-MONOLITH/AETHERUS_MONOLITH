#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const outputFile = '.track3-runs/latest-nexus-vault-compatibility-evaluation-report.json';
const fixturesFile = 'data/nexus-vault-compatibility-evaluation-fixtures.v1.json';
const versioningPolicyFile = 'data/conduit-versioning-policy.v1.json';
const compatibilityPolicyFile = 'data/nexus-vault-version-compatibility.v1.json';
const expectedSupportedCommit = 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f';

const boundaryFlags = {
  public_runtime: false,
  public_ui_wiring: false,
  backend: false,
  auth: false,
  database: false,
  persistence: false,
  ledger: false,
  model_execution: false,
  live_orchestration: false,
  palisade: false,
  weave: false,
  alternate_vault_execution: false,
  multi_vault_runtime_support: false,
  claim_escalation: false
};

const allowedStatuses = new Set([
  'supported_current',
  'candidate_not_evaluated',
  'candidate_blocked',
  'candidate_requires_full_evaluation',
  'incompatible',
  'invalid_fixture'
]);

const requiredCategories = [
  'current_pinned_vault_supported',
  'unknown_candidate_commit',
  'missing_regression_evidence',
  'missing_failure_injection_evidence',
  'deterministic_identity_failure',
  'trace_boundary_violation',
  'verdict_or_eligibility_semantics_drift',
  'dirty_or_mismatched_source'
];

const failures = [];

function runCommand(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false
  });
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
}

function gitValue(args, cwd = repoRoot) {
  const result = runCommand('git', args, cwd);
  return result.status === 0 ? result.stdout : null;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  writeFileSync(path.join(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function addFailure(label, message) {
  failures.push({ label, message });
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function completeEvidencePresent(evidence) {
  return evidence.complete_evaluation_packet === true
    && evidence.source_preflight === 'pass'
    && evidence.import_adapter_regression === 'pass'
    && evidence.report_validation === 'pass'
    && evidence.failure_injection === 'pass'
    && evidence.deterministic_identity === 'pass'
    && evidence.trace_boundary === 'local_non_persistent_non_ledger'
    && evidence.release_eligibility_coherence === 'pass'
    && evidence.adapter_output_contract === 'matches_v1'
    && evidence.claim_boundary === 'bounded'
    && (!evidence.verdict_enum || evidence.verdict_enum === 'matches_v1');
}

function invalidFixtureReason(fixture, fixtures) {
  if (!isObject(fixture)) return 'fixture must be an object';
  if (typeof fixture.fixture_id !== 'string' || !fixture.fixture_id) return 'fixture_id is required';
  if (!requiredCategories.includes(fixture.category)) return `unsupported fixture category ${fixture.category}`;
  if (!isObject(fixture.candidate_vault)) return 'candidate_vault is required';
  if (typeof fixture.candidate_vault.commit !== 'string' || !/^[a-f0-9]{40}$/.test(fixture.candidate_vault.commit)) {
    return 'candidate_vault.commit must be a 40-character lowercase hex commit';
  }
  if (!isObject(fixture.evaluation_evidence)) return 'evaluation_evidence is required';
  if (!allowedStatuses.has(fixture.expected_status)) return `expected_status ${fixture.expected_status} is not allowed`;
  if (!fixtures.allowed_statuses.includes(fixture.expected_status)) return `expected_status ${fixture.expected_status} is not declared by fixture contract`;
  return null;
}

function evaluateFixture(fixture, fixtures, supportedCommit) {
  const invalidReason = invalidFixtureReason(fixture, fixtures);
  if (invalidReason) {
    return {
      fixture_id: fixture && fixture.fixture_id || 'invalid_fixture',
      category: fixture && fixture.category || 'invalid_fixture',
      status: 'invalid_fixture',
      supported: false,
      reasons: [invalidReason]
    };
  }

  const candidate = fixture.candidate_vault;
  const evidence = fixture.evaluation_evidence;
  const reasons = [];
  let status = 'candidate_not_evaluated';
  let supported = false;

  if (candidate.source_clean !== true || candidate.commit_metadata_consistent !== true) {
    status = 'candidate_blocked';
    reasons.push('candidate source is dirty or commit metadata is inconsistent');
  } else if (candidate.commit === supportedCommit) {
    if (completeEvidencePresent(evidence)) {
      status = 'supported_current';
      supported = true;
      reasons.push('candidate commit matches the accepted supported Vault commit');
      reasons.push('required local evidence is coherent');
    } else {
      status = 'candidate_blocked';
      reasons.push('current supported commit fixture is missing required local evidence');
    }
  } else if (evidence.complete_evaluation_packet !== true) {
    status = 'candidate_requires_full_evaluation';
    reasons.push('candidate commit is not the accepted supported Vault commit');
    reasons.push('complete evaluation evidence packet is absent');
  } else if (evidence.import_adapter_regression !== 'pass') {
    status = 'candidate_blocked';
    reasons.push('import-adapter regression evidence is missing');
  } else if (evidence.failure_injection !== 'pass') {
    status = 'candidate_blocked';
    reasons.push('failure-injection evidence is missing');
  } else if (evidence.deterministic_identity !== 'pass') {
    status = 'candidate_blocked';
    reasons.push('deterministic identity check failed');
  } else if (evidence.trace_boundary !== 'local_non_persistent_non_ledger') {
    status = 'incompatible';
    reasons.push('trace boundary treats local audit/log output as persistent ledger');
  } else if (
    evidence.release_eligibility_coherence !== 'pass'
    || evidence.adapter_output_contract !== 'matches_v1'
    || evidence.verdict_enum === 'drift'
  ) {
    status = 'incompatible';
    reasons.push('verdict, release eligibility, or report-contract semantics drifted');
  } else if (completeEvidencePresent(evidence)) {
    status = 'candidate_not_evaluated';
    reasons.push('complete metadata packet is present, but Track 3.24 policy has not accepted any alternate Vault commit');
  } else {
    status = 'candidate_blocked';
    reasons.push('candidate evidence packet is incomplete or incoherent');
  }

  return {
    fixture_id: fixture.fixture_id,
    category: fixture.category,
    candidate_commit: candidate.commit,
    status,
    supported,
    reasons,
    deterministic_identity_result: evidence.deterministic_identity || 'not_provided',
    trace_boundary_result: evidence.trace_boundary || 'not_provided',
    release_eligibility_coherence_result: evidence.release_eligibility_coherence || 'not_provided',
    expected_status: fixture.expected_status,
    expected_supported: fixture.expected_supported,
    passed_expectation: status === fixture.expected_status && supported === fixture.expected_supported
  };
}

const fixtures = readJson(fixturesFile);
const versioningPolicy = readJson(versioningPolicyFile);
const compatibilityPolicy = readJson(compatibilityPolicyFile);

const supportedCommit = compatibilityPolicy.current_supported_vault && compatibilityPolicy.current_supported_vault.supported_commit;
if (supportedCommit !== expectedSupportedCommit) {
  addFailure('supported_vault_commit', `Expected supported Vault commit ${expectedSupportedCommit}, found ${supportedCommit || 'missing'}`);
}
if (versioningPolicy.metadata && versioningPolicy.metadata.multi_vault_runtime_support !== false) {
  addFailure('boundary', 'Versioning policy must not claim multi-Vault runtime support');
}
if (compatibilityPolicy.unsupported_commit_policy && compatibilityPolicy.unsupported_commit_policy.no_other_vault_commit_supported_yet !== true) {
  addFailure('compatibility_policy', 'Compatibility policy must state no other Vault commit is supported yet');
}

requiredCategories.forEach(category => {
  if (!fixtures.required_categories || !fixtures.required_categories.includes(category)) {
    addFailure('fixture_contract', `required_categories missing ${category}`);
  }
});

const fixtureResults = (fixtures.fixtures || []).map(fixture => evaluateFixture(fixture, fixtures, supportedCommit));
fixtureResults.forEach(result => {
  if (!result.passed_expectation) {
    addFailure(result.fixture_id, `Expected ${result.expected_status}/${result.expected_supported}, got ${result.status}/${result.supported}`);
  }
});

const unsupportedMarkedSupported = fixtureResults.filter(result => result.candidate_commit !== supportedCommit && result.supported === true);
unsupportedMarkedSupported.forEach(result => {
  addFailure(result.fixture_id, 'unsupported candidate commit was marked supported');
});

mkdirSync(path.join(repoRoot, '.track3-runs'), { recursive: true });

const report = {
  meta: {
    generated_at: new Date().toISOString(),
    script_name: 'scripts/evaluate-nexus-vault-compatibility-stub.mjs',
    track_phase: '3.25',
    run_mode: 'local_nexus_vault_compatibility_metadata_evaluation_stub',
    ...boundaryFlags
  },
  source: {
    aetherus_commit: gitValue(['rev-parse', 'HEAD']),
    supported_vault_commit: supportedCommit,
    versioning_policy: versioningPolicyFile,
    compatibility_policy: compatibilityPolicyFile,
    fixtures_file: fixturesFile
  },
  summary: {
    evaluated_fixture_count: fixtureResults.length,
    passed_expectations: fixtureResults.filter(result => result.passed_expectation).length,
    failed_expectations: fixtureResults.filter(result => !result.passed_expectation).length,
    supported_current: fixtureResults.filter(result => result.status === 'supported_current').length,
    blocked_or_incompatible: fixtureResults.filter(result => ['candidate_blocked', 'incompatible'].includes(result.status)).length,
    requires_full_evaluation: fixtureResults.filter(result => result.status === 'candidate_requires_full_evaluation').length
  },
  fixture_results: fixtureResults,
  boundary_summary: {
    harness_is_local_only_metadata_evaluation: true,
    imports_nexus: false,
    executes_nexus: false,
    clones_alternate_vault_sources: false,
    mutates_pinned_vault: false,
    switches_active_vault: false,
    creates_runtime_multi_vault_routing: false,
    creates_public_runtime_support: false,
    active_vault_remains_pinned: expectedSupportedCommit,
    public_runtime_wiring_authorized: false
  },
  failures
};

writeJson(outputFile, report);

console.log('Track 3.25 NEXUS Vault compatibility evaluation harness stub');
console.log('');
console.log(`Fixtures evaluated: ${report.summary.evaluated_fixture_count}`);
console.log(`Passed expectations: ${report.summary.passed_expectations}`);
console.log(`Failed expectations: ${report.summary.failed_expectations}`);
console.log(`Output: ${outputFile}`);
console.log('');
console.log('Boundary: local compatibility metadata evaluation only; no alternate Vault execution, active Vault switch, public runtime, backend, persistence, ledger, auth, database, Palisade, Weave, multi-Vault runtime support, or live orchestration.');

if (failures.length) {
  console.log('');
  console.log('Result: FAIL');
  failures.forEach(failure => console.log(`- ${failure.label}: ${failure.message}`));
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Result: PASS');
}
