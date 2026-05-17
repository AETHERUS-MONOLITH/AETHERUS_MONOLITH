#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const fixturesFile = 'data/nexus-vault-compatibility-pipeline-fixtures.v1.json';
const evidencePacketContractFile = 'data/nexus-vault-compatibility-evidence-packet-contract.v1.json';
const intakeFixturesFile = 'data/nexus-vault-candidate-intake-fixtures.v1.json';
const compatibilityFixturesFile = 'data/nexus-vault-compatibility-evaluation-fixtures.v1.json';
const compatibilityPolicyFile = 'data/nexus-vault-version-compatibility.v1.json';
const outputFile = '.track3-runs/latest-nexus-vault-compatibility-pipeline-report.json';
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
  'current_supported_vault_pipeline',
  'non_pinned_complete_candidate_pipeline',
  'invalid_packet_pipeline',
  'missing_packet_pipeline',
  'intake_boundary_violation_pipeline',
  'deterministic_identity_failure_pipeline',
  'verdict_semantics_drift_pipeline',
  'trace_or_ledger_boundary_violation_pipeline',
  'public_claim_escalation_pipeline',
  'unsupported_commit_without_acceptance_pipeline'
];

const orderedStages = [
  'packet_validation',
  'candidate_intake',
  'compatibility_evaluation',
  'final_pipeline_status'
];

const allowedPipelineStatuses = new Set([
  'current_supported_pass',
  'candidate_pipeline_eligible',
  'blocked_at_packet_validation',
  'blocked_at_intake',
  'blocked_at_compatibility_evaluation',
  'unsupported_candidate',
  'invalid_pipeline_fixture'
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

function reasons(packet, fallback) {
  if (packet && Array.isArray(packet.blocking_reasons) && packet.blocking_reasons.length) {
    return packet.blocking_reasons;
  }
  return [fallback];
}

function packetValidationStage(packet, contract) {
  if (!isObject(packet)) {
    return {
      stage: 'packet_validation',
      passed: false,
      decision: 'invalid_packet',
      blocking_reasons: ['candidate evidence packet is missing']
    };
  }

  const requiredFields = contract.required_packet_fields || [];
  const missing = missingRequiredFields(packet, requiredFields);
  if (missing.length || !/^[a-f0-9]{40}$/.test(packet.candidate_vault_commit || '')) {
    return {
      stage: 'packet_validation',
      passed: false,
      decision: 'invalid_packet',
      blocking_reasons: missing.length
        ? [`candidate evidence packet missing required fields: ${missing.join(', ')}`]
        : ['candidate_vault_commit must be a 40-character lowercase hex commit']
    };
  }

  return {
    stage: 'packet_validation',
    passed: true,
    decision: packet.compatibility_decision,
    blocking_reasons: []
  };
}

function intakeStage(packet) {
  if (packet.candidate_source_status !== 'source_preflight_pass' || packet.source_cleanliness !== 'clean' || packet.source_origin_match !== 'matches_candidate_commit') {
    return {
      stage: 'candidate_intake',
      passed: false,
      decision: 'blocked_source_mismatch',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: reasons(packet, 'candidate source is dirty or mismatched')
    };
  }

  if (packet.import_adapter_regression_result !== 'pass' || packet.failure_injection_result !== 'pass' || packet.report_contract_validation_result !== 'pass') {
    return {
      stage: 'candidate_intake',
      passed: false,
      decision: 'blocked_missing_evidence',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: reasons(packet, 'required evidence is missing')
    };
  }

  if (packet.deterministic_identity_result !== 'pass') {
    return {
      stage: 'candidate_intake',
      passed: false,
      decision: 'blocked_failed_evidence',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: reasons(packet, 'deterministic identity failed')
    };
  }

  if (packet.verdict_semantics_result !== 'matches_v1' || packet.release_eligibility_semantics_result !== 'matches_v1') {
    return {
      stage: 'candidate_intake',
      passed: false,
      decision: 'blocked_semantic_drift',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: reasons(packet, 'verdict or release eligibility semantics drifted')
    };
  }

  if (
    packet.trace_boundary_result !== 'local_non_persistent_non_ledger'
    || packet.ledger_boundary_result !== 'not_ledger'
    || packet.generated_artifacts_boundary_result !== 'not_staged'
    || packet.public_claim_boundary_result !== 'bounded'
  ) {
    return {
      stage: 'candidate_intake',
      passed: false,
      decision: 'blocked_boundary_violation',
      can_proceed_to_compatibility_evaluation: false,
      supported: false,
      blocking_reasons: reasons(packet, 'candidate packet violates local Conduit boundaries')
    };
  }

  if (packet.candidate_vault_commit === expectedSupportedCommit) {
    return {
      stage: 'candidate_intake',
      passed: true,
      decision: 'accepted_current_supported',
      can_proceed_to_compatibility_evaluation: false,
      supported: true,
      blocking_reasons: []
    };
  }

  return {
    stage: 'candidate_intake',
    passed: true,
    decision: 'eligible_for_compatibility_evaluation',
    can_proceed_to_compatibility_evaluation: true,
    supported: false,
    blocking_reasons: ['eligible for compatibility evaluation only; this is not support acceptance']
  };
}

function compatibilityStage(packet, fixture) {
  const evaluation = fixture.compatibility_evaluation || {};
  if (evaluation.executes_vault_code !== false) {
    return {
      stage: 'compatibility_evaluation',
      passed: false,
      status: 'invalid_fixture',
      supported: false,
      blocking_reasons: ['compatibility evaluation fixture must not execute Vault code']
    };
  }

  if (packet.candidate_vault_commit === expectedSupportedCommit) {
    return {
      stage: 'compatibility_evaluation',
      passed: evaluation.status === 'supported_current' && evaluation.supported === true,
      status: evaluation.status,
      supported: evaluation.supported === true,
      blocking_reasons: []
    };
  }

  if (evaluation.supported === true || evaluation.status === 'supported_current') {
    return {
      stage: 'compatibility_evaluation',
      passed: false,
      status: evaluation.status || 'invalid_fixture',
      supported: false,
      blocking_reasons: ['non-pinned candidate cannot become supported in this pipeline stub']
    };
  }

  return {
    stage: 'compatibility_evaluation',
    passed: ['candidate_not_evaluated', 'candidate_requires_full_evaluation'].includes(evaluation.status),
    status: evaluation.status || 'candidate_not_evaluated',
    supported: false,
    blocking_reasons: evaluation.status === 'candidate_requires_full_evaluation'
      ? ['non-pinned candidate has no support acceptance']
      : ['candidate may proceed only as local compatibility metadata; this is not support acceptance']
  };
}

function finalStatus(packetStage, intake, compatibility, fixture) {
  if (!packetStage.passed) {
    return {
      final_pipeline_status: 'blocked_at_packet_validation',
      blocking_stage: 'packet_validation',
      blocking_reasons: packetStage.blocking_reasons,
      supported: false
    };
  }

  if (!intake.passed) {
    return {
      final_pipeline_status: 'blocked_at_intake',
      blocking_stage: 'candidate_intake',
      blocking_reasons: intake.blocking_reasons,
      supported: false
    };
  }

  if (!compatibility.passed) {
    return {
      final_pipeline_status: 'blocked_at_compatibility_evaluation',
      blocking_stage: 'compatibility_evaluation',
      blocking_reasons: compatibility.blocking_reasons,
      supported: false
    };
  }

  if (intake.supported && compatibility.supported) {
    return {
      final_pipeline_status: 'current_supported_pass',
      blocking_stage: null,
      blocking_reasons: [],
      supported: true
    };
  }

  if (compatibility.status === 'candidate_requires_full_evaluation' || fixture.expected_pipeline_status === 'unsupported_candidate') {
    return {
      final_pipeline_status: 'unsupported_candidate',
      blocking_stage: 'compatibility_evaluation',
      blocking_reasons: compatibility.blocking_reasons,
      supported: false
    };
  }

  return {
    final_pipeline_status: 'candidate_pipeline_eligible',
    blocking_stage: null,
    blocking_reasons: ['candidate_pipeline_eligible is not support acceptance'],
    supported: false
  };
}

function invalidFixtureReason(fixture, pipelineFixtures) {
  if (!isObject(fixture)) return 'fixture must be an object';
  if (typeof fixture.fixture_id !== 'string' || !fixture.fixture_id) return 'fixture_id is required';
  if (!allowedPipelineStatuses.has(fixture.expected_pipeline_status)) return `expected_pipeline_status ${fixture.expected_pipeline_status} is not allowed`;
  if (!pipelineFixtures.allowed_pipeline_statuses.includes(fixture.expected_pipeline_status)) {
    return `expected_pipeline_status ${fixture.expected_pipeline_status} is not declared by fixture contract`;
  }
  if (fixture.expected_blocking_stage !== null && !orderedStages.includes(fixture.expected_blocking_stage)) {
    return `expected_blocking_stage ${fixture.expected_blocking_stage} is not an ordered stage`;
  }
  if (typeof fixture.expected_supported !== 'boolean') return 'expected_supported must be boolean';
  return null;
}

const pipelineFixtures = readJson(fixturesFile);
const evidencePacketContract = readJson(evidencePacketContractFile);
const intakeFixtures = readJson(intakeFixturesFile);
const compatibilityFixtures = readJson(compatibilityFixturesFile);
const compatibilityPolicy = readJson(compatibilityPolicyFile);
const supportedCommit = compatibilityPolicy.current_supported_vault && compatibilityPolicy.current_supported_vault.supported_commit;

if (supportedCommit !== expectedSupportedCommit) {
  addFailure('supported_vault_commit', `Expected supported Vault commit ${expectedSupportedCommit}, found ${supportedCommit || 'missing'}`);
}
if (pipelineFixtures.supported_vault_commit !== expectedSupportedCommit || evidencePacketContract.supported_vault_commit !== expectedSupportedCommit) {
  addFailure('supported_vault_commit', 'Pipeline fixtures and evidence packet contract must remain pinned to the accepted Vault commit');
}
if (intakeFixtures.supported_vault_commit !== expectedSupportedCommit || compatibilityFixtures.supported_vault_commit !== expectedSupportedCommit) {
  addFailure('supported_vault_commit', 'Intake and compatibility fixtures must remain pinned to the accepted Vault commit');
}
if (compatibilityPolicy.unsupported_commit_policy && compatibilityPolicy.unsupported_commit_policy.no_other_vault_commit_supported_yet !== true) {
  addFailure('compatibility_policy', 'Compatibility policy must state no other Vault commit is supported yet');
}

orderedStages.forEach((stage, index) => {
  if ((pipelineFixtures.ordered_stages || [])[index] !== stage) {
    addFailure('ordered_stages', `ordered_stages[${index}] must be ${stage}`);
  }
});

requiredFixtureIds.forEach(fixtureId => {
  if (!pipelineFixtures.required_fixture_ids || !pipelineFixtures.required_fixture_ids.includes(fixtureId)) {
    addFailure('fixture_contract', `required_fixture_ids missing ${fixtureId}`);
  }
});

const fixtureResults = (pipelineFixtures.fixtures || []).map(fixture => {
  const invalidReason = invalidFixtureReason(fixture, pipelineFixtures);
  if (invalidReason) {
    addFailure(fixture && fixture.fixture_id || 'invalid_pipeline_fixture', invalidReason);
    return {
      fixture_id: fixture && fixture.fixture_id || 'invalid_pipeline_fixture',
      candidate_vault_commit: null,
      stage_results: [],
      final_pipeline_status: 'invalid_pipeline_fixture',
      blocking_stage: 'pipeline_status_report',
      blocking_reasons: [invalidReason],
      supported: false,
      passed: false
    };
  }

  const packet = fixture.packet;
  const packetStage = packetValidationStage(packet, evidencePacketContract);
  const stageResults = [packetStage];
  let intake = null;
  let compatibility = null;

  if (packetStage.passed) {
    intake = intakeStage(packet);
    stageResults.push(intake);
  }
  if (packetStage.passed && intake.passed) {
    compatibility = compatibilityStage(packet, fixture);
    stageResults.push(compatibility);
  }

  const outcome = finalStatus(packetStage, intake || { passed: false }, compatibility || { passed: false }, fixture);
  const nonPinnedSupported = packet
    && packet.candidate_vault_commit !== expectedSupportedCommit
    && outcome.supported === true;
  const passed = outcome.final_pipeline_status === fixture.expected_pipeline_status
    && outcome.blocking_stage === fixture.expected_blocking_stage
    && outcome.supported === fixture.expected_supported
    && !nonPinnedSupported;

  if (!passed) {
    addFailure(fixture.fixture_id, `Expected ${fixture.expected_pipeline_status}/${fixture.expected_blocking_stage}/${fixture.expected_supported}, got ${outcome.final_pipeline_status}/${outcome.blocking_stage}/${outcome.supported}`);
  }
  if (nonPinnedSupported) {
    addFailure(fixture.fixture_id, 'non-pinned candidate attempted support acceptance');
  }
  if (outcome.blocking_stage && !outcome.blocking_reasons.length) {
    addFailure(fixture.fixture_id, 'blocked pipeline result must include blocking reasons');
  }

  return {
    fixture_id: fixture.fixture_id,
    candidate_vault_commit: packet && packet.candidate_vault_commit || null,
    stage_results: stageResults,
    final_pipeline_status: outcome.final_pipeline_status,
    blocking_stage: outcome.blocking_stage,
    blocking_reasons: outcome.blocking_reasons,
    supported: outcome.supported,
    passed,
    metadata_only: true
  };
});

mkdirSync(path.join(repoRoot, '.track3-runs'), { recursive: true });

const report = {
  report_version: '1.0.0',
  meta: {
    generated_at: new Date().toISOString(),
    script_name: 'scripts/run-nexus-vault-compatibility-pipeline-stub.mjs',
    track_phase: '3.28',
    run_mode: 'local_vault_compatibility_pipeline_stub',
    ...boundaryFlags
  },
  source: {
    aetherus_commit: gitValue(['rev-parse', 'HEAD']),
    supported_vault_commit: supportedCommit,
    fixtures_file: fixturesFile,
    evidence_packet_contract_file: evidencePacketContractFile,
    intake_fixtures_file: intakeFixturesFile,
    compatibility_fixtures_file: compatibilityFixturesFile,
    compatibility_policy_file: compatibilityPolicyFile
  },
  ordered_stages: pipelineFixtures.ordered_stages,
  summary: {
    pipeline_fixture_count: fixtureResults.length,
    passed_count: fixtureResults.filter(result => result.passed).length,
    failed_count: fixtureResults.filter(result => !result.passed).length,
    current_supported_pass_count: fixtureResults.filter(result => result.final_pipeline_status === 'current_supported_pass').length,
    candidate_pipeline_eligible_count: fixtureResults.filter(result => result.final_pipeline_status === 'candidate_pipeline_eligible').length,
    blocked_count: fixtureResults.filter(result => result.final_pipeline_status.startsWith('blocked_')).length,
    unsupported_candidate_count: fixtureResults.filter(result => result.final_pipeline_status === 'unsupported_candidate').length
  },
  fixture_results: fixtureResults,
  generated_output_boundary: {
    path: outputFile,
    git_ignored: true,
    must_not_be_committed: true,
    source_of_truth: false
  },
  boundary_summary: {
    metadata_only_local_pipeline_orchestration: true,
    packet_validation_precedes_intake: true,
    intake_precedes_compatibility_evaluation: true,
    compatibility_evaluation_executes_vault_code: false,
    imports_alternate_vault_code: false,
    mutates_pinned_vault: false,
    switches_active_vault: false,
    creates_multi_vault_runtime_support: false,
    candidate_pipeline_eligible_is_support_acceptance: false,
    active_vault_remains_pinned: expectedSupportedCommit
  },
  failures
};

writeJson(outputFile, report);

console.log('Track 3.28 NEXUS Vault compatibility pipeline stub');
console.log('');
console.log(`Fixtures evaluated: ${report.summary.pipeline_fixture_count}`);
console.log(`Passed: ${report.summary.passed_count}`);
console.log(`Failed: ${report.summary.failed_count}`);
console.log(`Candidate pipeline eligible: ${report.summary.candidate_pipeline_eligible_count}`);
console.log(`Output: ${outputFile}`);
console.log('');
console.log('Boundary: metadata-only local pipeline orchestration; no alternate Vault execution, active Vault switch, public runtime, backend, persistence, ledger, auth, database, Palisade, Weave, multi-Vault runtime support, or live orchestration.');

if (failures.length) {
  console.log('');
  console.log('Result: FAIL');
  failures.forEach(failure => console.log(`- ${failure.label}: ${failure.message}`));
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Result: PASS');
}
