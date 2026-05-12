#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const expectedNexusCommit = 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f';
const adapterScript = 'scripts/run-nexus-import-adapter-local.mjs';
const outputDir = '.track3-runs';
const adapterReportFile = '.track3-runs/latest-nexus-import-adapter-local-report.json';
const suiteReportFile = '.track3-runs/latest-nexus-import-adapter-regression-suite-report.json';
const traceStatus = 'local_adapter_run_not_persistent_not_ledger';

const requiredFixtureIds = [
  'happy_path_valid_release',
  'critical_safety_freeze',
  'missing_constraints_escalate',
  'adapter_failure_escalate',
  'idempotency_cache_hit'
];

const executableFixtureIds = new Set(requiredFixtureIds);
const failures = [];

function addFailure(category, message) {
  failures.push({ category, message });
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function runCommand(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false
  });

  return {
    command: [command, ...args].join(' '),
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: result.error ? result.error.message : null
  };
}

function gitValue(args, cwd) {
  const result = runCommand('git', args, cwd);
  return result.status === 0 ? result.stdout : null;
}

function parseArgs(argv) {
  const options = { nexusPath: null };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--nexus-path') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        addFailure('cli', '--nexus-path requires a path value');
        return options;
      }
      options.nexusPath = path.resolve(value);
      index += 1;
      continue;
    }
    addFailure('cli', `Unknown flag: ${arg}`);
  }

  return options;
}

function ensureOutputDir() {
  mkdirSync(path.join(repoRoot, outputDir), { recursive: true });
}

function validateNexusPath(nexusPath) {
  if (!nexusPath) {
    addFailure('nexus_path', '--nexus-path is required');
    return { path: null, head: null, status: 'missing' };
  }
  if (!existsSync(nexusPath)) {
    addFailure('nexus_path', `Path does not exist: ${nexusPath}`);
    return { path: nexusPath, head: null, status: 'missing' };
  }
  if (!existsSync(path.join(nexusPath, '.git'))) {
    addFailure('nexus_path', `Path is not a git repository: ${nexusPath}`);
    return { path: nexusPath, head: null, status: 'not_git_repository' };
  }

  const head = gitValue(['rev-parse', 'HEAD'], nexusPath);
  const status = gitValue(['status', '--porcelain'], nexusPath) || '';
  if (head !== expectedNexusCommit) {
    addFailure('nexus_path', `Expected pinned NEXUS commit ${expectedNexusCommit}, found ${head}`);
  }
  if (status !== '') {
    addFailure('nexus_path', 'Pinned NEXUS source working tree must be clean');
  }

  return {
    path: nexusPath,
    head,
    status: status || 'clean'
  };
}

function boundaryFlagsFalse(value) {
  return [
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database',
    'live_orchestration',
    'public_ui_wiring'
  ].every(flag => value && value[flag] === false);
}

function claimBoundaryTrue(value) {
  return [
    'not_public_runtime',
    'not_persistent',
    'not_ledger',
    'not_backend',
    'not_auth',
    'not_model_execution',
    'not_live_orchestration',
    'not_production'
  ].every(flag => value && value[flag] === true);
}

function runFixture(fixtureId, nexusPath) {
  const command = runCommand(process.execPath, [
    adapterScript,
    '--nexus-path',
    nexusPath,
    '--fixture-id',
    fixtureId
  ]);

  let report = null;
  if (existsSync(path.join(repoRoot, adapterReportFile))) {
    try {
      report = readJson(adapterReportFile);
    } catch (error) {
      addFailure('adapter_report', `${fixtureId}: ${error.message}`);
    }
  } else {
    addFailure('adapter_report', `${fixtureId}: adapter report was not generated`);
  }

  return {
    fixture_id: fixtureId,
    classification: executableFixtureIds.has(fixtureId) ? 'executable_adapter_case' : 'unsupported_mapping_case',
    adapter_command_status: command.status,
    adapter_stdout_summary: command.stdout.split(/\r?\n/).filter(Boolean).slice(0, 10),
    adapter_stderr: command.stderr,
    report
  };
}

function summarizeResult(run) {
  const report = run.report;
  if (!report) {
    return {
      fixture_id: run.fixture_id,
      classification: run.classification,
      normalized_verdict: 'escalate',
      release_eligible: false,
      deterministic_identity: 'unknown',
      trace_status: traceStatus,
      stop_conditions: ['adapter report missing'],
      passed: false
    };
  }

  const normalized = report.normalized_interface_result || {};
  const release = report.release_eligibility || {};
  const deterministic = report.deterministic_identity || {};
  const trace = report.trace_boundary || {};
  const stopConditions = Array.isArray(report.stop_conditions_triggered)
    ? report.stop_conditions_triggered
    : [];

  const resultFailures = [];
  if (run.adapter_command_status !== 0) {
    resultFailures.push('adapter command failed');
  }
  if (!boundaryFlagsFalse(report.meta)) {
    resultFailures.push('report boundary flags loosened');
  }
  if (!claimBoundaryTrue(report.claim_boundary)) {
    resultFailures.push('claim boundary flags loosened');
  }
  if (trace.trace_status !== traceStatus || trace.not_persistent !== true || trace.not_ledger !== true) {
    resultFailures.push('trace boundary is not local/non-persistent/non-ledger');
  }
  if (report.nexus_boundary && report.nexus_boundary.nexus_commit !== expectedNexusCommit) {
    resultFailures.push('NEXUS commit drifted');
  }
  if (report.nexus_boundary && report.nexus_boundary.nexus_execution_scope !== 'local_pinned_source_only') {
    resultFailures.push('NEXUS execution scope drifted');
  }
  if ((normalized.normalized_verdict === 'fail' || normalized.normalized_verdict === 'escalate') && release.eligible === true) {
    resultFailures.push('blocking verdict is release-eligible');
  }
  if (release.eligible === true && deterministic.status === 'fail') {
    resultFailures.push('release-eligible result has failed deterministic identity');
  }
  if (stopConditions.length && release.eligible === true) {
    resultFailures.push('release eligibility true despite stop conditions');
  }

  return {
    fixture_id: run.fixture_id,
    classification: run.classification,
    normalized_verdict: normalized.normalized_verdict || 'missing',
    normalized_gate_results: normalized.normalized_gate_results || [],
    release_eligible: release.eligible === true,
    release_reason: release.reason || '',
    deterministic_identity: deterministic.status || 'unknown',
    trace_status: trace.trace_status || 'missing',
    stop_conditions: stopConditions,
    audit_log_boundary: report.raw_nexus_result_boundary && report.raw_nexus_result_boundary.audit_log_reference,
    passed: resultFailures.length === 0,
    failures: resultFailures
  };
}

function buildSuiteReport(options, nexusStatus, fixtureResults) {
  const aetherusCommit = gitValue(['rev-parse', 'HEAD'], repoRoot);
  const summaries = fixtureResults.map(summarizeResult);
  summaries.forEach(summary => {
    summary.failures.forEach(message => addFailure('fixture_result', `${summary.fixture_id}: ${message}`));
  });

  const executed = summaries.filter(item => item.classification === 'executable_adapter_case');
  const unsupported = summaries.filter(item => item.classification === 'unsupported_mapping_case');
  const expectedFailClosed = summaries.filter(item => item.classification === 'expected_fail_closed_case');
  const stopConditions = summaries.flatMap(item => item.stop_conditions.map(stop => `${item.fixture_id}: ${stop}`));

  return {
    meta: {
      generated_at: new Date().toISOString(),
      script_name: 'scripts/run-nexus-import-adapter-regression-suite.mjs',
      track_phase: '3.18',
      run_mode: 'local_nexus_import_adapter_regression_suite',
      public_runtime: false,
      persistence: false,
      ledger: false,
      model_execution: false,
      backend: false,
      auth: false,
      database: false,
      live_orchestration: false,
      public_ui_wiring: false
    },
    nexus_boundary: {
      nexus_source_path: options.nexusPath,
      nexus_commit: nexusStatus.head,
      nexus_execution: true,
      nexus_execution_scope: 'local_pinned_source_only',
      python_execution: true,
      python_execution_scope: 'local_adapter_subprocess_only',
      nexus_source_modified: false,
      dependency_installation_performed: false
    },
    source: {
      aetherus_commit: aetherusCommit,
      adapter_script: adapterScript,
      fixture_source: 'data/interface-fixtures.v0.json'
    },
    suite_summary: {
      total_fixtures: summaries.length,
      executed_adapter_cases: executed.length,
      unsupported_mapping_cases: unsupported.length,
      expected_fail_closed_cases: expectedFailClosed.length,
      passed_cases: summaries.filter(item => item.passed).length,
      failed_cases: summaries.filter(item => !item.passed).length,
      stop_conditions: stopConditions
    },
    fixture_results: summaries,
    deterministic_identity_summary: {
      pass: summaries.filter(item => item.deterministic_identity === 'pass').length,
      fail: summaries.filter(item => item.deterministic_identity === 'fail').length,
      unknown: summaries.filter(item => item.deterministic_identity === 'unknown').length
    },
    release_eligibility_summary: {
      eligible: summaries.filter(item => item.release_eligible).map(item => item.fixture_id),
      blocked: summaries.filter(item => !item.release_eligible).map(item => item.fixture_id),
      coherence_status: summaries.some(item => item.failures.some(message => message.includes('release')))
        ? 'failed'
        : 'passed'
    },
    trace_boundary_summary: {
      trace_status: traceStatus,
      all_local_non_persistent_non_ledger: summaries.every(item => item.trace_status === traceStatus),
      jsonl_audit_output_boundary: 'local audit-log output only, not persistent ledger behavior'
    },
    claim_boundary: {
      not_public_runtime: true,
      not_persistent: true,
      not_ledger: true,
      not_backend: true,
      not_auth: true,
      not_model_execution: true,
      not_live_orchestration: true,
      not_production: true
    }
  };
}

function printSummary(report) {
  console.log('Track 3.18 local NEXUS import-adapter regression suite');
  console.log('');
  console.log(`Fixtures attempted: ${report.fixture_results.map(item => item.fixture_id).join(', ')}`);
  console.log(`Executed adapter cases: ${report.suite_summary.executed_adapter_cases}`);
  console.log(`Passed cases: ${report.suite_summary.passed_cases}`);
  console.log(`Failed cases: ${report.suite_summary.failed_cases}`);
  console.log(`Eligible: ${report.release_eligibility_summary.eligible.join(', ') || 'none'}`);
  console.log(`Blocked: ${report.release_eligibility_summary.blocked.join(', ') || 'none'}`);
  console.log(`Deterministic identity pass/fail/unknown: ${report.deterministic_identity_summary.pass}/${report.deterministic_identity_summary.fail}/${report.deterministic_identity_summary.unknown}`);
  console.log(`Output: ${suiteReportFile}`);
  console.log('');
  console.log('Boundary: local pinned NEXUS execution only; no public runtime, backend, persistence, ledger, auth, model execution, or live orchestration.');
}

const options = parseArgs(process.argv.slice(2));
ensureOutputDir();

let fixtureIds = requiredFixtureIds;
try {
  const fixtureSuite = readJson('data/interface-fixtures.v0.json');
  const availableIds = new Set((fixtureSuite.fixtures || []).map(item => item.scenario && item.scenario.id).filter(Boolean));
  requiredFixtureIds.forEach(id => {
    if (!availableIds.has(id)) addFailure('fixture_set', `Missing required fixture ${id}`);
  });
  fixtureIds = requiredFixtureIds.filter(id => availableIds.has(id));
} catch (error) {
  addFailure('fixture_set', error.message);
}

const nexusStatus = validateNexusPath(options.nexusPath);
const fixtureRuns = failures.length ? [] : fixtureIds.map(id => runFixture(id, options.nexusPath));
const report = buildSuiteReport(options, nexusStatus, fixtureRuns);

writeFileSync(path.join(repoRoot, suiteReportFile), `${JSON.stringify(report, null, 2)}\n`);
printSummary(report);

if (failures.length) {
  console.log('');
  console.log('Result: FAIL');
  failures.forEach(failure => console.log(`- ${failure.category}: ${failure.message}`));
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Result: PASS');
}
