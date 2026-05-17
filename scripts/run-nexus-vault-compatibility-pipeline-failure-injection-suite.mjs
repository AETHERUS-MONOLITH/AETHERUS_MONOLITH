#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const injectionFixturesFile = 'data/nexus-vault-compatibility-pipeline-failure-injection-fixtures.v1.json';
const pipelineFixturesFile = 'data/nexus-vault-compatibility-pipeline-fixtures.v1.json';
const reportContractFile = 'data/nexus-vault-compatibility-pipeline-report-contract.v1.json';
const reportFixturesFile = 'data/nexus-vault-compatibility-pipeline-report-fixtures.v1.json';
const outputFile = '.track3-runs/latest-nexus-vault-compatibility-pipeline-failure-injection-report.json';
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

const requiredCategories = [
  'non_pinned_candidate_marked_current_supported',
  'unsupported_candidate_marked_supported',
  'candidate_pipeline_eligible_treated_as_acceptance',
  'skipped_packet_validation_stage',
  'skipped_candidate_intake_stage',
  'skipped_compatibility_evaluation_stage',
  'invalid_stage_order',
  'blocked_status_without_blocking_reasons',
  'blocked_status_without_blocking_stage',
  'wrong_supported_vault_commit',
  'missing_supported_vault_commit',
  'alternate_vault_execution_claim',
  'active_vault_switch_claim',
  'runtime_multi_vault_support_claim',
  'public_runtime_wiring_claim',
  'metadata_only_assertion_missing',
  'generated_track3_runs_staged_claim',
  'persistent_ledger_claim_from_local_report',
  'verdict_semantics_drift_not_blocked',
  'release_eligibility_drift_not_blocked',
  'trace_boundary_violation_not_blocked',
  'dirty_or_mismatched_source_not_blocked'
];

const allowedExpectedOutcomes = new Set([
  'injected_failure_blocked',
  'injected_failure_rejected',
  'invalid_injection_fixture',
  'injection_expectation_failed'
]);

const blockingStatuses = new Set([
  'blocked_at_packet_validation',
  'blocked_at_intake',
  'blocked_at_compatibility_evaluation',
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pathParts(pathExpression) {
  return pathExpression.split('.').map(part => (/^\d+$/.test(part) ? Number(part) : part));
}

function getPath(value, pathExpression) {
  let current = value;
  for (const part of pathParts(pathExpression)) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function setPath(value, pathExpression, nextValue) {
  const parts = pathParts(pathExpression);
  let current = value;
  parts.slice(0, -1).forEach(part => {
    if (!isObject(current[part]) && !Array.isArray(current[part])) current[part] = {};
    current = current[part];
  });
  current[parts[parts.length - 1]] = nextValue;
}

function deletePath(value, pathExpression) {
  const parts = pathParts(pathExpression);
  let current = value;
  parts.slice(0, -1).forEach(part => {
    current = current && current[part];
  });
  if (current !== undefined && current !== null) {
    if (Array.isArray(current) && typeof parts[parts.length - 1] === 'number') {
      current.splice(parts[parts.length - 1], 1);
    } else {
      delete current[parts[parts.length - 1]];
    }
  }
}

function applyMutations(report, mutations) {
  const next = clone(report);
  (mutations || []).forEach(mutation => {
    if (mutation.op === 'set') setPath(next, mutation.path, mutation.value);
    if (mutation.op === 'delete') deletePath(next, mutation.path);
  });
  return next;
}

function validateRequiredReportFields(report, contract, errors) {
  (contract.required_report_fields || []).forEach(field => {
    if (getPath(report, field) === undefined) errors.push(`missing required report field ${field}`);
  });
}

function validateReport(report, contract, label) {
  const errors = [];
  const allowedStatuses = new Set(contract.allowed_final_pipeline_statuses || []);
  const nonSupportStatuses = new Set(contract.non_support_statuses || []);
  const expectedStages = contract.required_pipeline_stage_order || [];

  if (!isObject(report)) return { valid: false, errors: ['report must be an object'] };

  validateRequiredReportFields(report, contract, errors);

  if (report.report_version !== contract.report_version) errors.push(`report_version must be ${contract.report_version}`);
  if (getPath(report, 'source.supported_vault_commit') !== expectedSupportedCommit) {
    errors.push(`source.supported_vault_commit must be ${expectedSupportedCommit}`);
  }

  expectedStages.forEach((stage, index) => {
    if ((report.ordered_stages || [])[index] !== stage) errors.push(`ordered_stages[${index}] must be ${stage}`);
  });

  [
    ['meta.public_runtime', false],
    ['meta.public_ui_wiring', false],
    ['meta.alternate_vault_execution', false],
    ['meta.active_vault_switch', false],
    ['meta.multi_vault_runtime_support', false],
    ['boundary_summary.metadata_only_local_pipeline_orchestration', true],
    ['boundary_summary.packet_validation_precedes_intake', true],
    ['boundary_summary.intake_precedes_compatibility_evaluation', true],
    ['boundary_summary.compatibility_evaluation_executes_vault_code', false],
    ['boundary_summary.imports_alternate_vault_code', false],
    ['boundary_summary.switches_active_vault', false],
    ['boundary_summary.creates_multi_vault_runtime_support', false],
    ['boundary_summary.candidate_pipeline_eligible_is_support_acceptance', false],
    ['generated_output_boundary.git_ignored', true],
    ['generated_output_boundary.must_not_be_committed', true],
    ['generated_output_boundary.source_of_truth', false]
  ].forEach(([field, expected]) => {
    if (getPath(report, field) !== expected) errors.push(`${field} must be ${expected}`);
  });

  const fixtureResults = Array.isArray(report.fixture_results) ? report.fixture_results : [];
  if (!Array.isArray(report.fixture_results)) errors.push(`${label}.fixture_results must be an array`);
  if (getPath(report, 'summary.pipeline_fixture_count') !== fixtureResults.length) {
    errors.push('summary.pipeline_fixture_count must equal fixture_results length');
  }

  fixtureResults.forEach((result, index) => {
    const itemLabel = `${label}.fixture_results[${index}]`;
    (contract.required_per_fixture_fields || []).forEach(field => {
      if (result[field] === undefined) errors.push(`${itemLabel} missing ${field}`);
    });

    if (!allowedStatuses.has(result.final_pipeline_status)) {
      errors.push(`${itemLabel} uses unsupported final_pipeline_status ${result.final_pipeline_status}`);
    }
    if (result.metadata_only !== true) errors.push(`${itemLabel}.metadata_only must be true`);

    const candidateCommit = result.candidate_vault_commit;
    const isPinned = candidateCommit === expectedSupportedCommit;
    if (!isPinned && result.final_pipeline_status === 'current_supported_pass') {
      errors.push(`${itemLabel} non-pinned candidate cannot end current_supported_pass`);
    }
    if (!isPinned && result.supported === true) {
      errors.push(`${itemLabel} non-pinned candidate cannot be supported`);
    }
    if (nonSupportStatuses.has(result.final_pipeline_status) && result.supported !== false) {
      errors.push(`${itemLabel} ${result.final_pipeline_status} is not support acceptance`);
    }

    if (blockingStatuses.has(result.final_pipeline_status)) {
      if (typeof result.blocking_stage !== 'string') errors.push(`${itemLabel} blocked status requires blocking_stage`);
      if (!Array.isArray(result.blocking_reasons) || result.blocking_reasons.length === 0) {
        errors.push(`${itemLabel} blocked status requires blocking_reasons`);
      }
    }

    if (!Array.isArray(result.stage_results)) {
      errors.push(`${itemLabel}.stage_results must be an array`);
      return;
    }

    const requiredCompletedStages = result.final_pipeline_status === 'current_supported_pass' || result.final_pipeline_status === 'candidate_pipeline_eligible'
      ? ['packet_validation', 'candidate_intake', 'compatibility_evaluation']
      : [];
    requiredCompletedStages.forEach(stage => {
      if (!result.stage_results.some(stageResult => stageResult.stage === stage)) {
        errors.push(`${itemLabel} missing required completed stage ${stage}`);
      }
    });

    let previousIndex = -1;
    result.stage_results.forEach(stageResult => {
      const stageIndex = expectedStages.indexOf(stageResult.stage);
      if (stageIndex === -1 || stageResult.stage === 'final_pipeline_status') {
        errors.push(`${itemLabel} has invalid stage ${stageResult.stage}`);
      }
      if (stageIndex < previousIndex) errors.push(`${itemLabel} stage order is not monotonic`);
      previousIndex = stageIndex;
    });
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

function buildFixtureReport(injection, reportFixtures) {
  const template = reportFixtures.report_templates && reportFixtures.report_templates[injection.template];
  if (!template) return null;
  return applyMutations(template, injection.mutations);
}

function validateCategorySpecificFailure(injection, report) {
  const errors = [];
  const firstResult = Array.isArray(report && report.fixture_results) ? report.fixture_results[0] : null;
  const finalStatus = firstResult && firstResult.final_pipeline_status;
  const isBlocked = blockingStatuses.has(finalStatus);
  const intakeStage = firstResult && Array.isArray(firstResult.stage_results)
    ? firstResult.stage_results.find(stage => stage.stage === 'candidate_intake')
    : null;

  if (injection.category === 'verdict_semantics_drift_not_blocked' && intakeStage && intakeStage.verdict_semantics_result === 'drifted' && !isBlocked) {
    errors.push('verdict semantics drift must be blocked before compatibility acceptance');
  }
  if (injection.category === 'release_eligibility_drift_not_blocked' && intakeStage && intakeStage.release_eligibility_semantics_result === 'drifted' && !isBlocked) {
    errors.push('release eligibility semantics drift must be blocked before compatibility acceptance');
  }
  if (injection.category === 'trace_boundary_violation_not_blocked' && intakeStage && intakeStage.trace_boundary_result !== undefined && !isBlocked) {
    errors.push('trace boundary violation must be blocked and must not become persistent ledger evidence');
  }
  if (injection.category === 'dirty_or_mismatched_source_not_blocked' && intakeStage && intakeStage.candidate_source_status !== undefined && !isBlocked) {
    errors.push('dirty or mismatched candidate source must be blocked before compatibility evaluation');
  }

  return errors;
}

function actualOutcome(validation, categoryErrors, report) {
  const firstResult = Array.isArray(report && report.fixture_results) ? report.fixture_results[0] : null;
  if (!validation.valid || categoryErrors.length) return 'injected_failure_rejected';
  if (firstResult && blockingStatuses.has(firstResult.final_pipeline_status)) return 'injected_failure_blocked';
  return 'injection_expectation_failed';
}

const injections = readJson(injectionFixturesFile);
const pipelineFixtures = readJson(pipelineFixturesFile);
const reportContract = readJson(reportContractFile);
const reportFixtures = readJson(reportFixturesFile);

if (injections.supported_vault_commit !== expectedSupportedCommit || pipelineFixtures.supported_vault_commit !== expectedSupportedCommit || reportContract.supported_vault_commit !== expectedSupportedCommit) {
  addFailure('supported_vault_commit', 'Failure-injection suite, pipeline fixtures, and report contract must remain pinned to the accepted Vault commit');
}

requiredCategories.forEach(category => {
  if (!(injections.required_categories || []).includes(category)) {
    addFailure('fixture_contract', `required_categories missing ${category}`);
  }
});

const seenCategories = new Set();
const injectionResults = (injections.injections || []).map((injection, index) => {
  const invalidReasons = [];
  const injectionLabel = injection.injection_id || `injections[${index}]`;

  if (!isObject(injection)) invalidReasons.push('injection fixture must be an object');
  if (typeof injection.injection_id !== 'string' || !injection.injection_id) invalidReasons.push('injection_id is required');
  if (!requiredCategories.includes(injection.category)) invalidReasons.push(`category ${injection.category} is not required by Track 3.30`);
  if (!allowedExpectedOutcomes.has(injection.expected_outcome)) invalidReasons.push(`expected_outcome ${injection.expected_outcome} is not allowed`);
  if (!Array.isArray(injection.mutations)) invalidReasons.push('mutations must be an array');
  if (injection.category) seenCategories.add(injection.category);

  const report = invalidReasons.length ? null : buildFixtureReport(injection, reportFixtures);
  if (!report && !invalidReasons.length) invalidReasons.push(`template ${injection.template} is missing`);

  if (invalidReasons.length) {
    const passed = injection.expected_outcome === 'invalid_injection_fixture';
    if (!passed) addFailure(injectionLabel, invalidReasons.join('; '));
    return {
      injection_id: injectionLabel,
      category: injection.category || null,
      invalid_state_summary: injection.invalid_state_summary || null,
      expected_outcome: injection.expected_outcome || null,
      actual_outcome: 'invalid_injection_fixture',
      passed,
      blocking_reason: invalidReasons.join('; '),
      metadata_only: true
    };
  }

  const validation = validateReport(report, reportContract, injection.injection_id);
  const categoryErrors = validateCategorySpecificFailure(injection, report);
  const outcome = actualOutcome(validation, categoryErrors, report);
  const passed = outcome === injection.expected_outcome && outcome !== 'injection_expectation_failed';
  const blockingReasons = [...validation.errors, ...categoryErrors];

  if (!passed) {
    addFailure(injection.injection_id, `Expected ${injection.expected_outcome}, got ${outcome}`);
  }
  if (outcome === 'injection_expectation_failed') {
    addFailure(injection.injection_id, 'Injected invalid state was not blocked or rejected');
  }

  return {
    injection_id: injection.injection_id,
    category: injection.category,
    invalid_state_summary: injection.invalid_state_summary,
    expected_outcome: injection.expected_outcome,
    actual_outcome: outcome,
    passed,
    blocking_reason: blockingReasons.length ? blockingReasons.join('; ') : 'injected invalid state was not blocked or rejected',
    metadata_only: true
  };
});

requiredCategories.forEach(category => {
  if (!seenCategories.has(category)) {
    addFailure('fixture_contract', `Missing injection category ${category}`);
  }
});

const trackedTrack3Runs = gitValue(['ls-files', '.track3-runs']);
if (trackedTrack3Runs) {
  addFailure('.track3-runs', 'Generated .track3-runs reports must not be committed');
}

mkdirSync(path.join(repoRoot, '.track3-runs'), { recursive: true });

const report = {
  meta: {
    generated_at: new Date().toISOString(),
    script_name: 'scripts/run-nexus-vault-compatibility-pipeline-failure-injection-suite.mjs',
    track_phase: '3.30',
    run_mode: 'local_vault_compatibility_pipeline_failure_injection',
    failure_injection_suite_version: injections.suite_version,
    ...boundaryFlags
  },
  source: {
    aetherus_commit: gitValue(['rev-parse', 'HEAD']),
    supported_vault_commit: expectedSupportedCommit,
    failure_injection_fixtures_file: injectionFixturesFile,
    pipeline_fixtures_file: pipelineFixturesFile,
    report_contract_file: reportContractFile,
    report_fixtures_file: reportFixturesFile
  },
  summary: {
    injection_count: injectionResults.length,
    passed_count: injectionResults.filter(result => result.passed).length,
    failed_count: injectionResults.filter(result => !result.passed).length,
    injected_failure_blocked_count: injectionResults.filter(result => result.actual_outcome === 'injected_failure_blocked').length,
    injected_failure_rejected_count: injectionResults.filter(result => result.actual_outcome === 'injected_failure_rejected').length
  },
  injection_results: injectionResults,
  boundary_summary: {
    metadata_only_local_failure_injection: true,
    evaluates_alternate_vault_code: false,
    executes_alternate_vault_code: false,
    switches_active_vault: false,
    creates_multi_vault_runtime_support: false,
    public_runtime_wiring_authorized: false,
    candidate_pipeline_eligible_is_support_acceptance: false,
    generated_track3_runs_reports_committed: Boolean(trackedTrack3Runs),
    local_reports_are_persistent_ledger: false
  },
  generated_output_boundary: {
    path: outputFile,
    git_ignored: true,
    must_not_be_committed: true,
    source_of_truth: false
  },
  failures
};

writeJson(outputFile, report);

console.log('Track 3.30 NEXUS Vault compatibility pipeline failure-injection suite');
console.log('');
console.log(`Injections evaluated: ${report.summary.injection_count}`);
console.log(`Passed: ${report.summary.passed_count}`);
console.log(`Failed: ${report.summary.failed_count}`);
console.log(`Rejected: ${report.summary.injected_failure_rejected_count}`);
console.log(`Blocked: ${report.summary.injected_failure_blocked_count}`);
console.log(`Output: ${outputFile}`);
console.log('');
console.log('Boundary: metadata-only local failure injection; no alternate Vault execution, active Vault switch, public runtime, backend, persistence, ledger, auth, database, Palisade, Weave, multi-Vault runtime support, or live orchestration.');

if (failures.length) {
  console.log('');
  console.log('Result: FAIL');
  failures.forEach(failure => console.log(`- ${failure.label}: ${failure.message}`));
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Result: PASS');
}
