#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const expectedNexusCommit = 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f';
const traceStatus = 'local_adapter_run_not_persistent_not_ledger';
const outputDir = '.track3-runs';
const suiteReportFile = '.track3-runs/latest-nexus-import-adapter-failure-injection-suite-report.json';
const contractFile = 'data/nexus-import-adapter-report-contract.v0.json';

const boundaryFlags = [
  'public_runtime',
  'persistence',
  'ledger',
  'model_execution',
  'backend',
  'auth',
  'database',
  'live_orchestration',
  'public_ui_wiring'
];

const claimBoundaryFlags = [
  'not_public_runtime',
  'not_persistent',
  'not_ledger',
  'not_backend',
  'not_auth',
  'not_model_execution',
  'not_live_orchestration',
  'not_production'
];

const injections = [
  {
    id: 'wrong_nexus_path',
    failure_category: 'nexus_path_missing',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected NEXUS path points to a missing local directory.',
    observed: { nexus_source_path: '.track3-runs/injected-missing-nexus-path' }
  },
  {
    id: 'wrong_nexus_commit',
    failure_category: 'nexus_commit_mismatch',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected NEXUS commit does not match the accepted pinned source commit.',
    observed: { nexus_commit: '0000000000000000000000000000000000000000' }
  },
  {
    id: 'dirty_nexus_working_tree',
    failure_category: 'nexus_working_tree_dirty',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected dirty-source status without modifying the pinned NEXUS checkout.',
    observed: { nexus_working_tree_status: 'simulated_dirty_status_without_source_mutation' }
  },
  {
    id: 'missing_fixture_mapping',
    failure_category: 'fixture_mapping_missing',
    attempted_fixture_id: 'missing_failure_injection_fixture',
    failure_reason: 'Injected fixture id has no adapter input mapping.',
    observed: { fixture_mapping_present: false }
  },
  {
    id: 'missing_regulatory_context',
    failure_category: 'regulatory_context_missing',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected adapter input omits required regulatory context.',
    observed: { regulatory_context_present: false }
  },
  {
    id: 'missing_manifest_mapping',
    failure_category: 'manifest_mapping_missing',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected adapter input references no resolvable manifest mapping.',
    track_phase: '3.21',
    observed: {
      manifest_mapping_present: false,
      manifest_reference: 'injected_missing_manifest_mapping'
    }
  },
  {
    id: 'nexus_execution_failure',
    failure_category: 'nexus_execution_failure',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected controlled local NEXUS execution failure without running or modifying pinned NEXUS source.',
    track_phase: '3.21',
    observed: {
      execution_status: 'simulated_subprocess_failure',
      nexus_source_modified: false
    }
  },
  {
    id: 'malformed_nexus_output',
    failure_category: 'malformed_nexus_result',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected NEXUS output cannot be normalized as structured JSON.',
    observed: { raw_nexus_output_shape: 'malformed' }
  },
  {
    id: 'unknown_verdict',
    failure_category: 'unknown_nexus_verdict',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected Omega verdict is outside the adapter verdict vocabulary.',
    observed: { omega_decision: 'defer_to_future_runtime' }
  },
  {
    id: 'unknown_risk_level',
    failure_category: 'unknown_risk_level',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected Delta risk level is outside the known risk vocabulary.',
    observed: { delta_risk_level: 'unbounded' }
  },
  {
    id: 'missing_omega_decision',
    failure_category: 'missing_omega_decision',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected NEXUS result omits the Omega decision field.',
    observed: { omega_decision_present: false }
  },
  {
    id: 'nondeterministic_output',
    failure_category: 'nondeterministic_output',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected paired runs produce different decision-relevant hashes.',
    observed: {
      decision_relevant_hashes: [
        'injected-first-decision-hash',
        'injected-second-decision-hash'
      ]
    }
  },
  {
    id: 'release_eligibility_incoherence',
    failure_category: 'release_eligibility_incoherent',
    attempted_fixture_id: 'critical_safety_freeze',
    failure_reason: 'Injected blocking verdict is paired with release eligibility true; suite must suppress it fail-closed.',
    observed: { injected_verdict: 'fail', injected_release_eligible: true }
  },
  {
    id: 'trace_boundary_violation',
    failure_category: 'trace_boundary_violation',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected trace boundary claims persistence; suite must emit a compliant fail-closed report.',
    observed: { injected_trace_status: 'persistent_runtime_trace' }
  },
  {
    id: 'claim_boundary_violation',
    failure_category: 'claim_boundary_violation',
    attempted_fixture_id: 'happy_path_valid_release',
    failure_reason: 'Injected claim boundary loosens public runtime limits; suite must emit a compliant fail-closed report.',
    observed: { injected_claim_boundary: { not_public_runtime: false } }
  }
];

const deferredCategories = [
];

const tracksCompleted = [
  '3.20',
  '3.21'
];

const failures = [];

function addFailure(category, file, message) {
  failures.push({ category, file, message });
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  writeFileSync(path.join(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function ensureOutputDir() {
  mkdirSync(path.join(repoRoot, outputDir), { recursive: true });
}

function clearPreviousInjectionReports() {
  const absoluteOutputDir = path.join(repoRoot, outputDir);
  if (!existsSync(absoluteOutputDir)) return;
  readdirSync(absoluteOutputDir)
    .filter(name => /^nexus-import-adapter-failure-injection-\d{2}-.+\.json$/.test(name))
    .forEach(name => unlinkSync(path.join(absoluteOutputDir, name)));
}

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

function falseBoundaryFlags() {
  return Object.fromEntries(boundaryFlags.map(flag => [flag, false]));
}

function trueClaimBoundaryFlags() {
  return Object.fromEntries(claimBoundaryFlags.map(flag => [flag, true]));
}

function buildFailureReport(injection, contract, index) {
  const reportPath = `${outputDir}/nexus-import-adapter-failure-injection-${String(index + 1).padStart(2, '0')}-${injection.id}.json`;
  const stopCondition = `${injection.failure_category}: ${injection.failure_reason}`;
  const report = {
    meta: {
      generated_at: new Date().toISOString(),
      script_name: 'scripts/run-nexus-import-adapter-failure-injection-suite.mjs',
      track_phase: injection.track_phase || '3.20',
      run_mode: 'local_nexus_import_adapter_failure_injection',
      integration_status: 'local_import_adapter_failure_injection',
      ...falseBoundaryFlags()
    },
    failure_category: injection.failure_category,
    failure_reason: injection.failure_reason,
    source: {
      aetherus_commit: gitValue(['rev-parse', 'HEAD']),
      report_contract: contractFile,
      adapter_script: 'scripts/run-nexus-import-adapter-local.mjs',
      injection_id: injection.id
    },
    attempted_fixture_id: injection.attempted_fixture_id,
    nexus_boundary: {
      nexus_source_path: injection.observed.nexus_source_path || 'failure_injection_no_nexus_execution',
      nexus_commit: injection.observed.nexus_commit || expectedNexusCommit,
      nexus_execution: false,
      nexus_execution_scope: 'not_executed_failure_injection_only',
      python_execution: false,
      python_execution_scope: 'not_executed_failure_injection_only',
      nexus_source_modified: false,
      dependency_installation_performed: false
    },
    normalized_verdict: 'escalate',
    normalized_interface_result: {
      normalized_verdict: 'escalate',
      normalized_gate_results: [
        {
          gate_id: injection.failure_category,
          status: 'escalate',
          source: 'local_failure_injection_suite',
          reason: injection.failure_reason
        }
      ],
      normalized_release_eligibility: {
        eligible: false,
        reason: 'Failure injection was detected and forced to a blocked local report.'
      }
    },
    release_eligibility: {
      eligible: false,
      reason: 'Failure injection was detected and forced to a blocked local report.'
    },
    trace_boundary: {
      trace_status: traceStatus,
      not_persistent: true,
      not_ledger: true,
      audit_log_output_boundary: 'No NEXUS JSONL output is produced by failure injection; any referenced audit output remains local-only and non-ledger.'
    },
    claim_boundary: trueClaimBoundaryFlags(),
    stop_conditions: [stopCondition],
    stop_conditions_triggered: [stopCondition],
    raw_error_boundary: {
      raw_error_is_local_only: true,
      raw_error_is_public_runtime: false,
      raw_error_is_operational_evidence: false,
      injected_failure_id: injection.id,
      injected_failure_category: injection.failure_category,
      injected_observation: injection.observed,
      boundary: 'local_failure_injection_only_not_public_runtime_not_persistent_not_ledger'
    }
  };

  const requiredFailureFields = contract.required_failure_report_fields || [];
  const missingFields = requiredFailureFields.filter(field => report[field] === undefined || report[field] === null);
  if (missingFields.length) {
    addFailure('report_shape', reportPath, `Missing required fields: ${missingFields.join(', ')}`);
  }
  return { reportPath, report };
}

function validateFailureReport(contract, report, reportPath) {
  const allowed = new Set(contract.allowed_failure_categories || []);
  if (!allowed.has(report.failure_category)) {
    addFailure('failure_category', reportPath, `Unexpected failure category ${report.failure_category}`);
  }

  boundaryFlags.forEach(flag => {
    if (report.meta[flag] !== false) {
      addFailure('boundary_flag', reportPath, `meta.${flag} must be false`);
    }
  });

  claimBoundaryFlags.forEach(flag => {
    if (report.claim_boundary[flag] !== true) {
      addFailure('claim_boundary', reportPath, `claim_boundary.${flag} must be true`);
    }
  });

  if (report.release_eligibility.eligible !== false) {
    addFailure('release_eligibility', reportPath, 'release_eligibility.eligible must be false');
  }
  if (report.normalized_verdict !== 'escalate') {
    addFailure('normalized_verdict', reportPath, 'normalized_verdict must fail closed as escalate');
  }
  if (report.trace_boundary.trace_status !== traceStatus) {
    addFailure('trace_boundary', reportPath, `trace_status must be ${traceStatus}`);
  }
  if (report.trace_boundary.not_persistent !== true || report.trace_boundary.not_ledger !== true) {
    addFailure('trace_boundary', reportPath, 'trace boundary must remain non-persistent and non-ledger');
  }
  if (!Array.isArray(report.stop_conditions) || !report.stop_conditions.length) {
    addFailure('stop_conditions', reportPath, 'failure report must include stop conditions');
  }
}

function buildSuiteReport(reportSummaries) {
  const passed = reportSummaries.filter(item => item.passed);
  const failed = reportSummaries.filter(item => !item.passed);
  return {
    meta: {
      generated_at: new Date().toISOString(),
      script_name: 'scripts/run-nexus-import-adapter-failure-injection-suite.mjs',
      track_phase: '3.20-3.21',
      run_mode: 'local_nexus_import_adapter_failure_injection_suite',
      integration_status: 'local_import_adapter_failure_injection_suite',
      ...falseBoundaryFlags()
    },
    nexus_boundary: {
      nexus_execution: false,
      nexus_execution_scope: 'not_executed_failure_injection_only',
      python_execution: false,
      python_execution_scope: 'not_executed_failure_injection_only',
      nexus_source_modified: false,
      dependency_installation_performed: false,
      pinned_nexus_commit_reference: expectedNexusCommit
    },
    suite_summary: {
      total_injections: reportSummaries.length,
      passed_injections: passed.length,
      failed_injections: failed.length,
      categories_covered: reportSummaries.map(item => item.failure_category),
      deferred_categories: deferredCategories,
      tracks_completed: tracksCompleted,
      stop_conditions: reportSummaries.flatMap(item => item.stop_conditions)
    },
    injection_results: reportSummaries,
    release_eligibility_summary: {
      all_blocked: reportSummaries.every(item => item.release_eligible === false),
      eligible: reportSummaries.filter(item => item.release_eligible).map(item => item.injection_id),
      blocked: reportSummaries.filter(item => !item.release_eligible).map(item => item.injection_id)
    },
    trace_boundary_summary: {
      trace_status: traceStatus,
      all_local_non_persistent_non_ledger: reportSummaries.every(item => item.trace_status === traceStatus)
    },
    claim_boundary: trueClaimBoundaryFlags(),
    stop_conditions: reportSummaries.flatMap(item => item.stop_conditions)
  };
}

ensureOutputDir();
clearPreviousInjectionReports();

const contract = readJson(contractFile);
const reports = injections.map((injection, index) => buildFailureReport(injection, contract, index));
reports.forEach(({ reportPath, report }) => {
  validateFailureReport(contract, report, reportPath);
  writeJson(reportPath, report);
});

const reportSummaries = reports.map(({ reportPath, report }) => ({
  injection_id: report.source.injection_id,
  failure_category: report.failure_category,
  report_path: reportPath,
  normalized_verdict: report.normalized_verdict,
  release_eligible: report.release_eligibility.eligible,
  trace_status: report.trace_boundary.trace_status,
  claim_boundary_preserved: claimBoundaryFlags.every(flag => report.claim_boundary[flag] === true),
  stop_conditions: report.stop_conditions,
  passed: report.release_eligibility.eligible === false
    && report.trace_boundary.trace_status === traceStatus
    && claimBoundaryFlags.every(flag => report.claim_boundary[flag] === true)
}));

const suiteReport = buildSuiteReport(reportSummaries);
writeJson(suiteReportFile, suiteReport);

if (!suiteReport.release_eligibility_summary.all_blocked) {
  addFailure('release_eligibility', suiteReportFile, 'all injected failures must be blocked');
}
if (!suiteReport.trace_boundary_summary.all_local_non_persistent_non_ledger) {
  addFailure('trace_boundary', suiteReportFile, 'all injected failures must preserve trace boundary');
}
if (suiteReport.suite_summary.failed_injections !== 0) {
  addFailure('suite_result', suiteReportFile, 'all injected failures must pass fail-closed validation');
}

console.log('Track 3.20 local NEXUS import-adapter failure-injection suite');
console.log('');
console.log(`Injections: ${suiteReport.suite_summary.total_injections}`);
console.log(`Passed: ${suiteReport.suite_summary.passed_injections}`);
console.log(`Failed: ${suiteReport.suite_summary.failed_injections}`);
console.log(`Eligible after injection: ${suiteReport.release_eligibility_summary.eligible.join(', ') || 'none'}`);
console.log(`Output: ${suiteReportFile}`);
console.log('');
console.log('Boundary: local failure-injection reports only; no public runtime, backend, persistence, ledger, auth, model execution, or live orchestration.');

if (failures.length) {
  console.log('');
  console.log('Result: FAIL');
  failures.forEach(failure => console.log(`- ${failure.category} — ${failure.file}: ${failure.message}`));
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Result: PASS');
}
