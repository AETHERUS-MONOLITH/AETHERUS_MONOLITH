#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const fixturesFile = 'data/nexus-vault-candidate-intake-fixtures.v1.json';
const evidencePacketContractFile = 'data/nexus-vault-compatibility-evidence-packet-contract.v1.json';
const compatibilityPolicyFile = 'data/nexus-vault-version-compatibility.v1.json';
const outputFile = '.track3-runs/latest-nexus-vault-candidate-intake-gate-report.json';
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

const allowedIntakeDecisions = new Set([
  'accepted_current_supported',
  'eligible_for_compatibility_evaluation',
  'blocked_missing_evidence',
  'blocked_failed_evidence',
  'blocked_semantic_drift',
  'blocked_boundary_violation',
  'blocked_source_mismatch',
  'invalid_intake_fixture'
]);

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

function missingRequiredFields(packet, requiredFields) {
  return requiredFields.filter(field => packet[field] === undefined || packet[field] === null);
}

function blockingReasons(packet, fallback) {
  if (packet && Array.isArray(packet.blocking_reasons) && packet.blocking_reasons.length) {
    return packet.blocking_reasons;
  }
  return [fallback];
}

function deriveIntakeDecision(packet, contract) {
  if (!isObject(packet)) {
    return {
      decision: 'blocked_missing_evidence',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: ['candidate evidence packet is missing']
    };
  }

  const requiredFields = contract.required_packet_fields || [];
  const missing = missingRequiredFields(packet, requiredFields);
  if (missing.length) {
    return {
      decision: 'blocked_missing_evidence',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: [`candidate evidence packet missing required fields: ${missing.join(', ')}`]
    };
  }

  if (!/^[a-f0-9]{40}$/.test(packet.candidate_vault_commit)) {
    return {
      decision: 'invalid_intake_fixture',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: ['candidate_vault_commit must be a 40-character lowercase hex commit']
    };
  }

  if (packet.candidate_source_status !== 'source_preflight_pass' || packet.source_cleanliness !== 'clean' || packet.source_origin_match !== 'matches_candidate_commit') {
    return {
      decision: 'blocked_source_mismatch',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: blockingReasons(packet, 'candidate source is dirty or mismatched')
    };
  }

  if (packet.import_adapter_regression_result !== 'pass' || packet.failure_injection_result !== 'pass' || packet.report_contract_validation_result !== 'pass') {
    return {
      decision: 'blocked_missing_evidence',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: blockingReasons(packet, 'required regression, failure-injection, or report validation evidence is missing')
    };
  }

  if (packet.deterministic_identity_result !== 'pass') {
    return {
      decision: 'blocked_failed_evidence',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: blockingReasons(packet, 'deterministic identity failed')
    };
  }

  if (packet.verdict_semantics_result !== 'matches_v1' || packet.release_eligibility_semantics_result !== 'matches_v1') {
    return {
      decision: 'blocked_semantic_drift',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: blockingReasons(packet, 'verdict or release eligibility semantics drifted')
    };
  }

  if (
    packet.trace_boundary_result !== 'local_non_persistent_non_ledger'
    || packet.ledger_boundary_result !== 'not_ledger'
    || packet.generated_artifacts_boundary_result !== 'not_staged'
    || packet.public_claim_boundary_result !== 'bounded'
  ) {
    return {
      decision: 'blocked_boundary_violation',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: blockingReasons(packet, 'candidate packet violates trace, ledger, generated-artifact, or public-claim boundaries')
    };
  }

  if (packet.candidate_vault_commit === expectedSupportedCommit) {
    return {
      decision: 'accepted_current_supported',
      can_proceed_to_compatibility_evaluation: false,
      supported: true,
      blocking_reasons: []
    };
  }

  return {
    decision: 'eligible_for_compatibility_evaluation',
    can_proceed_to_compatibility_evaluation: true,
    supported: false,
    blocking_reasons: ['eligible for compatibility evaluation only; this is not support acceptance']
  };
}

function invalidFixtureReason(fixture, intakeFixtures) {
  if (!isObject(fixture)) return 'fixture must be an object';
  if (typeof fixture.fixture_id !== 'string' || !fixture.fixture_id) return 'fixture_id is required';
  if (!allowedIntakeDecisions.has(fixture.expected_intake_decision)) return `expected_intake_decision ${fixture.expected_intake_decision} is not allowed`;
  if (!intakeFixtures.allowed_intake_decisions.includes(fixture.expected_intake_decision)) {
    return `expected_intake_decision ${fixture.expected_intake_decision} is not declared by fixture contract`;
  }
  if (typeof fixture.expected_can_proceed_to_compatibility_evaluation !== 'boolean') {
    return 'expected_can_proceed_to_compatibility_evaluation must be boolean';
  }
  if (typeof fixture.expected_supported !== 'boolean') return 'expected_supported must be boolean';
  return null;
}

const intakeFixtures = readJson(fixturesFile);
const evidencePacketContract = readJson(evidencePacketContractFile);
const compatibilityPolicy = readJson(compatibilityPolicyFile);

const supportedCommit = compatibilityPolicy.current_supported_vault && compatibilityPolicy.current_supported_vault.supported_commit;
if (supportedCommit !== expectedSupportedCommit) {
  addFailure('supported_vault_commit', `Expected supported Vault commit ${expectedSupportedCommit}, found ${supportedCommit || 'missing'}`);
}
if (intakeFixtures.supported_vault_commit !== expectedSupportedCommit || evidencePacketContract.supported_vault_commit !== expectedSupportedCommit) {
  addFailure('supported_vault_commit', 'Intake fixtures and evidence packet contract must remain pinned to the accepted Vault commit');
}
if (compatibilityPolicy.unsupported_commit_policy && compatibilityPolicy.unsupported_commit_policy.no_other_vault_commit_supported_yet !== true) {
  addFailure('compatibility_policy', 'Compatibility policy must state no other Vault commit is supported yet');
}

requiredFixtureIds.forEach(fixtureId => {
  if (!intakeFixtures.required_fixture_ids || !intakeFixtures.required_fixture_ids.includes(fixtureId)) {
    addFailure('fixture_contract', `required_fixture_ids missing ${fixtureId}`);
  }
});

const fixtureResults = (intakeFixtures.fixtures || []).map(fixture => {
  const invalidReason = invalidFixtureReason(fixture, intakeFixtures);
  const derived = invalidReason
    ? {
      decision: 'invalid_intake_fixture',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: [invalidReason]
    }
    : deriveIntakeDecision(fixture.packet, evidencePacketContract);

  const nonPinnedSupported = fixture.packet
    && fixture.packet.candidate_vault_commit !== expectedSupportedCommit
    && derived.supported === true;
  const nonPinnedAccepted = fixture.packet
    && fixture.packet.candidate_vault_commit !== expectedSupportedCommit
    && derived.decision === 'accepted_current_supported';
  const blockedWithoutReasons = derived.decision.startsWith('blocked_') && !derived.blocking_reasons.length;
  const passed = derived.decision === fixture.expected_intake_decision
    && derived.can_proceed_to_compatibility_evaluation === fixture.expected_can_proceed_to_compatibility_evaluation
    && derived.supported === fixture.expected_supported
    && !nonPinnedSupported
    && !nonPinnedAccepted
    && !blockedWithoutReasons;

  if (!passed) {
    addFailure(fixture.fixture_id || 'unknown_fixture', `Expected ${fixture.expected_intake_decision}/${fixture.expected_can_proceed_to_compatibility_evaluation}/${fixture.expected_supported}, got ${derived.decision}/${derived.can_proceed_to_compatibility_evaluation}/${derived.supported}`);
  }
  if (nonPinnedSupported || nonPinnedAccepted) {
    addFailure(fixture.fixture_id, 'non-pinned candidate attempted support acceptance');
  }
  if (blockedWithoutReasons) {
    addFailure(fixture.fixture_id, 'blocked intake decision must include blocking reasons');
  }

  return {
    fixture_id: fixture.fixture_id,
    candidate_vault_commit: fixture.packet && fixture.packet.candidate_vault_commit || null,
    intake_decision: derived.decision,
    can_proceed_to_compatibility_evaluation: derived.can_proceed_to_compatibility_evaluation,
    supported: derived.supported,
    passed,
    blocking_reasons: derived.blocking_reasons,
    metadata_only: true
  };
});

mkdirSync(path.join(repoRoot, '.track3-runs'), { recursive: true });

const report = {
  meta: {
    generated_at: new Date().toISOString(),
    script_name: 'scripts/run-nexus-vault-candidate-intake-gate-stub.mjs',
    track_phase: '3.27',
    run_mode: 'local_vault_candidate_intake_gate_stub',
    ...boundaryFlags
  },
  source: {
    aetherus_commit: gitValue(['rev-parse', 'HEAD']),
    supported_vault_commit: supportedCommit,
    fixtures_file: fixturesFile,
    evidence_packet_contract_file: evidencePacketContractFile,
    compatibility_policy_file: compatibilityPolicyFile
  },
  summary: {
    intake_fixture_count: fixtureResults.length,
    passed_count: fixtureResults.filter(result => result.passed).length,
    failed_count: fixtureResults.filter(result => !result.passed).length,
    eligible_for_compatibility_evaluation_count: fixtureResults.filter(result => result.intake_decision === 'eligible_for_compatibility_evaluation').length,
    accepted_current_supported_count: fixtureResults.filter(result => result.intake_decision === 'accepted_current_supported').length,
    blocked_count: fixtureResults.filter(result => result.intake_decision.startsWith('blocked_')).length
  },
  fixture_results: fixtureResults,
  boundary_summary: {
    metadata_evidence_intake_only: true,
    executes_alternate_vault_code: false,
    imports_alternate_vault_code: false,
    mutates_pinned_vault: false,
    switches_active_vault: false,
    creates_multi_vault_runtime_support: false,
    eligible_for_compatibility_evaluation_is_support_acceptance: false,
    active_vault_remains_pinned: expectedSupportedCommit
  },
  failures
};

writeJson(outputFile, report);

console.log('Track 3.27 NEXUS Vault candidate intake gate stub');
console.log('');
console.log(`Fixtures evaluated: ${report.summary.intake_fixture_count}`);
console.log(`Passed: ${report.summary.passed_count}`);
console.log(`Failed: ${report.summary.failed_count}`);
console.log(`Eligible for compatibility evaluation: ${report.summary.eligible_for_compatibility_evaluation_count}`);
console.log(`Output: ${outputFile}`);
console.log('');
console.log('Boundary: metadata/evidence intake only; no alternate Vault execution, active Vault switch, public runtime, backend, persistence, ledger, auth, database, Palisade, Weave, multi-Vault runtime support, or live orchestration.');

if (failures.length) {
  console.log('');
  console.log('Result: FAIL');
  failures.forEach(failure => console.log(`- ${failure.label}: ${failure.message}`));
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Result: PASS');
}
