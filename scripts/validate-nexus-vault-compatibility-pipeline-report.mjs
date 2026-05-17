#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const contractFile = 'data/nexus-vault-compatibility-pipeline-report-contract.v1.json';
const fixturesFile = 'data/nexus-vault-compatibility-pipeline-report-fixtures.v1.json';
const generatedReportFile = '.track3-runs/latest-nexus-vault-compatibility-pipeline-report.json';
const outputFile = '.track3-runs/latest-nexus-vault-compatibility-pipeline-report-validation-report.json';
const expectedSupportedCommit = 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f';
const reportContractMarkers = {
  unsupported_candidate: true,
  candidate_intake: true
};

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
  if (current !== undefined && current !== null) delete current[parts[parts.length - 1]];
}

function applyMutations(report, mutations) {
  const next = clone(report);
  (mutations || []).forEach(mutation => {
    if (mutation.op === 'set') setPath(next, mutation.path, mutation.value);
    if (mutation.op === 'delete') deletePath(next, mutation.path);
  });
  return next;
}

function validateReport(report, contract, label, options = {}) {
  const errors = [];
  const allowedStatuses = new Set(contract.allowed_final_pipeline_statuses || []);
  const blockingStatuses = new Set(contract.blocking_statuses || []);
  const nonSupportStatuses = new Set(contract.non_support_statuses || []);
  const expectedStages = contract.required_pipeline_stage_order || [];

  function fail(message) {
    errors.push(message);
  }

  if (!isObject(report)) {
    return { valid: false, errors: ['report must be an object'] };
  }

  (contract.required_report_fields || []).forEach(field => {
    if (getPath(report, field) === undefined) fail(`missing required report field ${field}`);
  });

  if (report.report_version !== contract.report_version) {
    fail(`report_version must be ${contract.report_version}`);
  }
  if (typeof getPath(report, 'meta.generated_at') !== 'string') {
    fail('meta.generated_at must be present');
  }
  const aetherusCommit = getPath(report, 'source.aetherus_commit');
  if (typeof aetherusCommit !== 'string' || !/^[a-f0-9]{40}$/.test(aetherusCommit)) {
    fail('source.aetherus_commit must record a 40-character commit');
  }
  if (getPath(report, 'source.supported_vault_commit') !== expectedSupportedCommit) {
    fail(`source.supported_vault_commit must be ${expectedSupportedCommit}`);
  }

  const orderedStages = report.ordered_stages || [];
  expectedStages.forEach((stage, index) => {
    if (orderedStages[index] !== stage) fail(`ordered_stages[${index}] must be ${stage}`);
  });

  const fixtureResults = Array.isArray(report.fixture_results) ? report.fixture_results : [];
  if (!Array.isArray(report.fixture_results)) fail('fixture_results must be an array');
  if (getPath(report, 'summary.pipeline_fixture_count') !== fixtureResults.length) {
    fail('summary.pipeline_fixture_count must equal fixture_results length');
  }
  const passedCount = fixtureResults.filter(result => result.passed === true).length;
  const failedCount = fixtureResults.filter(result => result.passed === false).length;
  if (getPath(report, 'summary.passed_count') !== passedCount) fail('summary.passed_count must match passed fixture count');
  if (getPath(report, 'summary.failed_count') !== failedCount) fail('summary.failed_count must match failed fixture count');

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
    if (getPath(report, field) !== expected) fail(`${field} must be ${expected}`);
  });

  fixtureResults.forEach((result, index) => {
    const itemLabel = `${label}.fixture_results[${index}]`;
    (contract.required_per_fixture_fields || []).forEach(field => {
      if (result[field] === undefined) fail(`${itemLabel} missing ${field}`);
    });

    if (!allowedStatuses.has(result.final_pipeline_status)) {
      fail(`${itemLabel} uses unsupported final_pipeline_status ${result.final_pipeline_status}`);
    }
    if (result.metadata_only !== true) fail(`${itemLabel}.metadata_only must be true`);

    const candidateCommit = result.candidate_vault_commit;
    const isPinned = candidateCommit === expectedSupportedCommit;
    if (!isPinned && result.final_pipeline_status === 'current_supported_pass') {
      fail(`${itemLabel} non-pinned candidate cannot end current_supported_pass`);
    }
    if (!isPinned && result.supported === true) {
      fail(`${itemLabel} non-pinned candidate cannot be supported`);
    }
    if (result.final_pipeline_status === 'current_supported_pass' && (!isPinned || result.supported !== true)) {
      fail(`${itemLabel} current_supported_pass requires pinned commit and supported true`);
    }
    if (nonSupportStatuses.has(result.final_pipeline_status) && result.supported !== false) {
      fail(`${itemLabel} ${result.final_pipeline_status} is not support acceptance`);
    }

    const isBlocked = blockingStatuses.has(result.final_pipeline_status);
    if (isBlocked) {
      if (typeof result.blocking_stage !== 'string') fail(`${itemLabel} blocked status requires blocking_stage`);
      if (!Array.isArray(result.blocking_reasons) || result.blocking_reasons.length === 0) {
        fail(`${itemLabel} blocked status requires blocking_reasons`);
      }
    }

    if (Array.isArray(result.stage_results)) {
      let previousIndex = -1;
      result.stage_results.forEach(stageResult => {
        const stageIndex = expectedStages.indexOf(stageResult.stage);
        if (stageIndex === -1 || stageResult.stage === 'final_pipeline_status') {
          fail(`${itemLabel} has invalid stage ${stageResult.stage}`);
        }
        if (stageIndex < previousIndex) fail(`${itemLabel} stage order is not monotonic`);
        previousIndex = stageIndex;
      });
    }
  });

  if (options.runtime && getPath(report, 'generated_output_boundary.path') !== generatedReportFile) {
    fail(`generated_output_boundary.path must be ${generatedReportFile}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function buildFixtureReport(fixture, fixtures) {
  const template = fixtures.report_templates && fixtures.report_templates[fixture.template];
  if (!template) return null;
  return applyMutations(template, fixture.mutations);
}

const contract = readJson(contractFile);
const fixtures = readJson(fixturesFile);

if (contract.supported_vault_commit !== expectedSupportedCommit || fixtures.supported_vault_commit !== expectedSupportedCommit) {
  addFailure('supported_vault_commit', 'Report contract and fixtures must remain pinned to the accepted Vault commit');
}

(fixtures.required_fixture_ids || []).forEach(fixtureId => {
  if (!(fixtures.fixtures || []).some(fixture => fixture.fixture_id === fixtureId)) {
    addFailure('fixture_contract', `Missing required fixture ${fixtureId}`);
  }
});

const fixtureResults = (fixtures.fixtures || []).map(fixture => {
  const report = buildFixtureReport(fixture, fixtures);
  const validation = validateReport(report, contract, fixture.fixture_id);
  const passed = validation.valid === fixture.expected_valid;
  if (!passed) {
    addFailure(fixture.fixture_id, `Expected valid=${fixture.expected_valid}, got valid=${validation.valid}`);
  }
  return {
    fixture_id: fixture.fixture_id,
    expected_valid: fixture.expected_valid,
    actual_valid: validation.valid,
    passed,
    blocking_reasons: validation.errors,
    metadata_only: true
  };
});

let runtimeReportResult = {
  report_path: generatedReportFile,
  exists: existsSync(path.join(repoRoot, generatedReportFile)),
  valid: false,
  blocking_reasons: []
};

if (!runtimeReportResult.exists) {
  runtimeReportResult.blocking_reasons.push('generated compatibility pipeline report is missing');
  addFailure('runtime_report', 'Generated compatibility pipeline report is missing');
} else {
  const runtimeReport = readJson(generatedReportFile);
  const validation = validateReport(runtimeReport, contract, 'runtime_report', { runtime: true });
  runtimeReportResult = {
    report_path: generatedReportFile,
    exists: true,
    valid: validation.valid,
    blocking_reasons: validation.errors
  };
  if (!validation.valid) {
    addFailure('runtime_report', `Generated compatibility pipeline report failed validation: ${validation.errors.join('; ')}`);
  }
}

const trackedTrack3Runs = gitValue(['ls-files', '.track3-runs']);
if (trackedTrack3Runs) {
  addFailure('.track3-runs', 'Generated .track3-runs reports must not be committed');
}

mkdirSync(path.join(repoRoot, '.track3-runs'), { recursive: true });

const report = {
  meta: {
    generated_at: new Date().toISOString(),
    script_name: 'scripts/validate-nexus-vault-compatibility-pipeline-report.mjs',
    track_phase: '3.29',
    run_mode: 'local_vault_compatibility_pipeline_report_validation',
    report_contract_version: contract.metadata && contract.metadata.version,
    ...boundaryFlags
  },
  source: {
    aetherus_commit: gitValue(['rev-parse', 'HEAD']),
    supported_vault_commit: expectedSupportedCommit,
    report_contract_file: contractFile,
    report_fixtures_file: fixturesFile,
    runtime_report_file: generatedReportFile
  },
  summary: {
    evaluated_fixture_count: fixtureResults.length,
    passed_count: fixtureResults.filter(result => result.passed).length,
    failed_count: fixtureResults.filter(result => !result.passed).length,
    runtime_report_valid: runtimeReportResult.valid
  },
  fixture_results: fixtureResults,
  runtime_report_result: runtimeReportResult,
  boundary_summary: {
    validates_report_shape_and_boundary_assertions_only: true,
    evaluates_alternate_vault_code: false,
    executes_alternate_vault_code: false,
    switches_active_vault: false,
    creates_multi_vault_runtime_support: false,
    public_runtime_wiring_authorized: false,
    generated_track3_runs_reports_committed: Boolean(trackedTrack3Runs)
  },
  failures
};

writeJson(outputFile, report);

console.log('Track 3.29 NEXUS Vault compatibility pipeline report validation');
console.log('');
console.log(`Fixtures evaluated: ${report.summary.evaluated_fixture_count}`);
console.log(`Passed: ${report.summary.passed_count}`);
console.log(`Failed: ${report.summary.failed_count}`);
console.log(`Runtime report valid: ${report.summary.runtime_report_valid}`);
console.log(`Output: ${outputFile}`);
console.log('');
console.log('Boundary: report shape and boundary assertion validation only; no alternate Vault execution, active Vault switch, public runtime, backend, persistence, ledger, auth, database, Palisade, Weave, multi-Vault runtime support, or live orchestration.');

if (failures.length) {
  console.log('');
  console.log('Result: FAIL');
  failures.forEach(failure => console.log(`- ${failure.label}: ${failure.message}`));
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Result: PASS');
}
