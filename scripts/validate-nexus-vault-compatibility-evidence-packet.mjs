#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const contractFile = 'data/nexus-vault-compatibility-evidence-packet-contract.v1.json';
const fixturesFile = 'data/nexus-vault-compatibility-evidence-packet-fixtures.v1.json';
const compatibilityPolicyFile = 'data/nexus-vault-version-compatibility.v1.json';
const outputFile = '.track3-runs/latest-nexus-vault-compatibility-evidence-packet-validation-report.json';
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
  active_vault_switch: false,
  multi_vault_runtime_support: false,
  claim_escalation: false
};

const requiredFixtureIds = [
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

function missingRequiredFields(packet, requiredFields) {
  return requiredFields.filter(field => packet[field] === undefined || packet[field] === null);
}

function deriveDecision(packet, contract) {
  const requiredFields = contract.required_packet_fields || [];
  const missing = missingRequiredFields(packet, requiredFields);
  if (missing.length) {
    return {
      decision: 'invalid_packet',
      valid: false,
      blocking_reasons: [`missing required fields: ${missing.join(', ')}`]
    };
  }

  if (!/^[a-f0-9]{40}$/.test(packet.candidate_vault_commit)) {
    return {
      decision: 'invalid_packet',
      valid: false,
      blocking_reasons: ['candidate_vault_commit must be a 40-character lowercase hex commit']
    };
  }

  if (packet.candidate_source_status !== 'source_preflight_pass' || packet.source_cleanliness !== 'clean' || packet.source_origin_match !== 'matches_candidate_commit') {
    return {
      decision: 'candidate_blocked',
      valid: true,
      blocking_reasons: ['candidate source status, cleanliness, or origin match blocks the packet']
    };
  }

  if (packet.import_adapter_regression_result !== 'pass') {
    return {
      decision: 'candidate_packet_incomplete',
      valid: true,
      blocking_reasons: ['import-adapter regression result is missing or not passing']
    };
  }

  if (packet.failure_injection_result !== 'pass') {
    return {
      decision: 'candidate_packet_incomplete',
      valid: true,
      blocking_reasons: ['failure-injection result is missing or not passing']
    };
  }

  if (packet.report_contract_validation_result !== 'pass') {
    return {
      decision: 'candidate_packet_incomplete',
      valid: true,
      blocking_reasons: ['report contract validation result is missing or not passing']
    };
  }

  if (packet.deterministic_identity_result !== 'pass') {
    return {
      decision: 'candidate_blocked',
      valid: true,
      blocking_reasons: ['deterministic identity failed']
    };
  }

  if (packet.verdict_semantics_result !== 'matches_v1') {
    return {
      decision: 'candidate_incompatible',
      valid: true,
      blocking_reasons: ['verdict semantics drifted']
    };
  }

  if (packet.release_eligibility_semantics_result !== 'matches_v1') {
    return {
      decision: 'candidate_incompatible',
      valid: true,
      blocking_reasons: ['release eligibility semantics drifted']
    };
  }

  if (packet.trace_boundary_result !== 'local_non_persistent_non_ledger') {
    return {
      decision: 'candidate_incompatible',
      valid: true,
      blocking_reasons: ['trace boundary violation']
    };
  }

  if (packet.ledger_boundary_result !== 'not_ledger') {
    return {
      decision: 'candidate_incompatible',
      valid: true,
      blocking_reasons: ['ledger boundary violation']
    };
  }

  if (packet.generated_artifacts_boundary_result !== 'not_staged') {
    return {
      decision: 'candidate_blocked',
      valid: true,
      blocking_reasons: ['generated .track3-runs artifacts are staged']
    };
  }

  if (packet.public_claim_boundary_result !== 'bounded') {
    return {
      decision: 'candidate_blocked',
      valid: true,
      blocking_reasons: ['public runtime claim escalation']
    };
  }

  if (packet.candidate_vault_commit === expectedSupportedCommit) {
    return {
      decision: 'accepted_current_supported',
      valid: true,
      blocking_reasons: []
    };
  }

  return {
    decision: 'candidate_packet_valid_but_not_supported',
    valid: true,
    blocking_reasons: ['complete non-pinned evidence packet is not support acceptance in this pass']
  };
}

const contract = readJson(contractFile);
const fixtures = readJson(fixturesFile);
const compatibilityPolicy = readJson(compatibilityPolicyFile);
const supportedCommit = compatibilityPolicy.current_supported_vault && compatibilityPolicy.current_supported_vault.supported_commit;

if (supportedCommit !== expectedSupportedCommit) {
  addFailure('supported_vault_commit', `Expected supported Vault commit ${expectedSupportedCommit}, found ${supportedCommit || 'missing'}`);
}
if (contract.supported_vault_commit !== expectedSupportedCommit || fixtures.supported_vault_commit !== expectedSupportedCommit) {
  addFailure('supported_vault_commit', 'Contract and fixture supported Vault commit must remain pinned');
}

requiredFixtureIds.forEach(fixtureId => {
  if (!fixtures.required_fixture_ids || !fixtures.required_fixture_ids.includes(fixtureId)) {
    addFailure('fixture_contract', `required_fixture_ids missing ${fixtureId}`);
  }
});

const allowedDecisions = new Set(contract.allowed_compatibility_decisions || []);
const fixtureResults = (fixtures.fixtures || []).map(fixture => {
  const packet = fixture.packet || {};
  const derived = deriveDecision(packet, contract);
  const decisionAllowed = allowedDecisions.has(packet.compatibility_decision);
  const expectationMatched = derived.decision === fixture.expected_decision
    && derived.decision === packet.compatibility_decision
    && derived.valid === fixture.expected_valid
    && decisionAllowed;
  const nonPinnedAccepted = packet.candidate_vault_commit !== expectedSupportedCommit
    && packet.compatibility_decision === 'accepted_current_supported';

  if (!expectationMatched) {
    addFailure(fixture.fixture_id || 'unknown_fixture', `Expected ${fixture.expected_decision}/${fixture.expected_valid}, derived ${derived.decision}/${derived.valid}`);
  }
  if (nonPinnedAccepted) {
    addFailure(fixture.fixture_id, 'non-pinned candidate attempted accepted_current_supported');
  }

  return {
    fixture_id: fixture.fixture_id,
    candidate_vault_commit: packet.candidate_vault_commit || null,
    compatibility_decision: packet.compatibility_decision || 'invalid_packet',
    derived_decision: derived.decision,
    valid: derived.valid,
    passed: expectationMatched && !nonPinnedAccepted,
    blocking_reasons: derived.blocking_reasons.length ? derived.blocking_reasons : packet.blocking_reasons || [],
    evaluator_notes: packet.evaluator_notes || '',
    metadata_only: true
  };
});

mkdirSync(path.join(repoRoot, '.track3-runs'), { recursive: true });

const report = {
  meta: {
    generated_at: new Date().toISOString(),
    script_name: 'scripts/validate-nexus-vault-compatibility-evidence-packet.mjs',
    track_phase: '3.26',
    run_mode: 'local_vault_compatibility_evidence_packet_validation',
    evidence_packet_contract_version: contract.metadata && contract.metadata.version,
    ...boundaryFlags
  },
  source: {
    aetherus_commit: gitValue(['rev-parse', 'HEAD']),
    supported_vault_commit: supportedCommit,
    contract_file: contractFile,
    fixtures_file: fixturesFile,
    compatibility_policy_file: compatibilityPolicyFile
  },
  summary: {
    evaluated_fixture_count: fixtureResults.length,
    passed_count: fixtureResults.filter(result => result.passed).length,
    failed_count: fixtureResults.filter(result => !result.passed).length
  },
  fixture_results: fixtureResults,
  boundary_summary: {
    validates_metadata_evidence_packet_shape_only: true,
    evaluates_alternate_vault_code: false,
    executes_alternate_vault_code: false,
    switches_active_vault: false,
    creates_multi_vault_runtime_support: false,
    active_vault_remains_pinned: expectedSupportedCommit,
    public_runtime_wiring_authorized: false
  },
  failures
};

writeJson(outputFile, report);

console.log('Track 3.26 NEXUS Vault compatibility evidence packet validation');
console.log('');
console.log(`Fixtures evaluated: ${report.summary.evaluated_fixture_count}`);
console.log(`Passed: ${report.summary.passed_count}`);
console.log(`Failed: ${report.summary.failed_count}`);
console.log(`Output: ${outputFile}`);
console.log('');
console.log('Boundary: metadata/evidence-packet shape validation only; no alternate Vault execution, active Vault switch, public runtime, backend, persistence, ledger, auth, database, Palisade, Weave, multi-Vault runtime support, or live orchestration.');

if (failures.length) {
  console.log('');
  console.log('Result: FAIL');
  failures.forEach(failure => console.log(`- ${failure.label}: ${failure.message}`));
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Result: PASS');
}
