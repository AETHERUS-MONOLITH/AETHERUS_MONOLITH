#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const files = {
  contract: 'data/nexus-import-adapter-report-contract.v0.json',
  singleReport: '.track3-runs/latest-nexus-import-adapter-local-report.json',
  regressionReport: '.track3-runs/latest-nexus-import-adapter-regression-suite-report.json'
};

const expectedNexusCommit = 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f';
const traceStatus = 'local_adapter_run_not_persistent_not_ledger';
const failures = [];

function addFailure(category, file, message) {
  failures.push({ category, file, message });
}

function readJson(relativePath, category = 'report_shape_failure') {
  try {
    return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
  } catch (error) {
    addFailure(category, relativePath, error.message);
    return null;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasPath(root, dottedPath) {
  let current = root;
  for (const part of dottedPath.split('.')) {
    if (!isObject(current) && !Array.isArray(current)) return false;
    if (current[part] === undefined || current[part] === null) return false;
    current = current[part];
  }
  return true;
}

function requireFields(file, report, fields, category = 'report_shape_failure') {
  fields.forEach(field => {
    if (!hasPath(report, field)) {
      addFailure(category, file, `Missing required field ${field}`);
    }
  });
}

function requireFalseFlags(file, object, label) {
  [
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend',
    'auth',
    'database',
    'live_orchestration',
    'public_ui_wiring'
  ].forEach(flag => {
    if (!object || object[flag] !== false) {
      addFailure('boundary_flag_failure', file, `${label}.${flag} must be false`);
    }
  });
}

function requireClaimBoundary(file, boundary) {
  [
    'not_public_runtime',
    'not_persistent',
    'not_ledger',
    'not_backend',
    'not_auth',
    'not_model_execution',
    'not_live_orchestration',
    'not_production'
  ].forEach(flag => {
    if (!boundary || boundary[flag] !== true) {
      addFailure('claim_boundary_failure', file, `claim_boundary.${flag} must be true`);
    }
  });
}

function validateContract(contract) {
  const file = files.contract;
  if (!contract) return;

  [
    'metadata',
    'required_success_report_fields',
    'required_regression_report_fields',
    'required_failure_report_fields',
    'allowed_failure_categories',
    'release_eligibility_invariants',
    'trace_boundary_invariants',
    'claim_boundary_invariants'
  ].forEach(field => {
    if (!contract[field]) {
      addFailure('report_contract_missing', file, `Missing ${field}`);
    }
  });

  const metadata = contract.metadata || {};
  if (metadata.status !== 'local_report_contract') {
    addFailure('report_contract_missing', file, 'metadata.status must be local_report_contract');
  }
  if (metadata.pinned_nexus_commit !== expectedNexusCommit) {
    addFailure('pinned_source_failure', file, 'metadata.pinned_nexus_commit must match pinned NEXUS commit');
  }
  requireFalseFlags(file, metadata, 'metadata');

  const trace = contract.trace_boundary_invariants || {};
  if (trace.trace_status !== traceStatus) {
    addFailure('trace_boundary_failure', file, `trace_boundary_invariants.trace_status must be ${traceStatus}`);
  }

  const allowedFailures = new Set(contract.allowed_failure_categories || []);
  [
    'nexus_path_missing',
    'nexus_commit_mismatch',
    'nexus_working_tree_dirty',
    'fixture_mapping_missing',
    'regulatory_context_missing',
    'manifest_mapping_missing',
    'nexus_execution_failure',
    'malformed_nexus_result',
    'unknown_nexus_verdict',
    'unknown_risk_level',
    'missing_omega_decision',
    'nondeterministic_output',
    'release_eligibility_incoherent',
    'trace_boundary_violation',
    'claim_boundary_violation'
  ].forEach(category => {
    if (!allowedFailures.has(category)) {
      addFailure('report_contract_missing', file, `allowed_failure_categories missing ${category}`);
    }
  });
}

function validateTraceBoundary(file, trace) {
  if (!trace || trace.trace_status !== traceStatus) {
    addFailure('trace_boundary_failure', file, `trace boundary must use ${traceStatus}`);
  }
  if (!trace || trace.not_persistent !== true || trace.not_ledger !== true) {
    addFailure('trace_boundary_failure', file, 'trace boundary must state not_persistent and not_ledger');
  }
  const text = JSON.stringify(trace || {}).toLowerCase();
  if (hasUnboundedLedgerClaim(text)) {
    addFailure('ledger_boundary_failure', file, 'trace boundary contains prohibited ledger/storage language');
  }
}

function hasUnboundedLedgerClaim(text) {
  const normalized = text
    .replace(/not a persistent ledger/g, '')
    .replace(/not persistent ledger/g, '')
    .replace(/non-persistent\/non-ledger/g, '')
    .replace(/non-persistent and non-ledger/g, '')
    .replace(/non-ledger/g, '')
    .replace(/not_ledger/g, '')
    .replace(/not ledger/g, '');
  return /persistent ledger|immutable ledger|hash-chain|database trace|production audit/.test(normalized);
}

function validateAuditBoundary(file, value, label) {
  const text = JSON.stringify(value || {}).toLowerCase();
  if (/ledger_valid"\s*:\s*true/.test(text) || hasUnboundedLedgerClaim(text) || /production ledger/.test(text)) {
    addFailure('ledger_boundary_failure', file, `${label} treats audit output as ledger-valid`);
  }
}

function validateNexusBoundary(file, boundary) {
  if (!boundary || boundary.nexus_commit !== expectedNexusCommit) {
    addFailure('pinned_source_failure', file, 'nexus_boundary.nexus_commit must match pinned NEXUS commit');
  }
  if (!boundary || boundary.nexus_execution_scope !== 'local_pinned_source_only') {
    addFailure('pinned_source_failure', file, 'nexus_boundary.nexus_execution_scope must be local_pinned_source_only');
  }
  if (!boundary || boundary.python_execution_scope !== 'local_adapter_subprocess_only') {
    addFailure('pinned_source_failure', file, 'nexus_boundary.python_execution_scope must be local_adapter_subprocess_only');
  }
  if (boundary && boundary.nexus_source_modified !== false) {
    addFailure('pinned_source_failure', file, 'nexus_boundary.nexus_source_modified must be false');
  }
  if (boundary && boundary.dependency_installation_performed !== false) {
    addFailure('pinned_source_failure', file, 'nexus_boundary.dependency_installation_performed must be false');
  }
}

function validateReleaseCoherence(file, verdict, release, deterministic, stopConditions) {
  if ((verdict === 'fail' || verdict === 'escalate') && release && release.eligible === true) {
    addFailure('release_eligibility_failure', file, `${verdict} verdict must not be release-eligible`);
  }
  if (deterministic && deterministic.status === 'fail' && release && release.eligible === true) {
    addFailure('deterministic_identity_failure', file, 'failed deterministic identity must not be release-eligible');
  }
  if (Array.isArray(stopConditions) && stopConditions.length && release && release.eligible === true) {
    addFailure('release_eligibility_failure', file, 'report with stop conditions must not be release-eligible');
  }
}

function validateSingleReport(contract, report) {
  const file = files.singleReport;
  if (!report) return;

  requireFields(file, report, contract.required_success_report_fields || []);
  requireFalseFlags(file, report.meta, 'meta');
  requireClaimBoundary(file, report.claim_boundary);
  validateNexusBoundary(file, report.nexus_boundary);
  validateTraceBoundary(file, report.trace_boundary);
  validateAuditBoundary(file, report.raw_nexus_result_boundary, 'raw_nexus_result_boundary');

  const verdict = report.normalized_interface_result && report.normalized_interface_result.normalized_verdict;
  const stopConditions = report.stop_conditions || report.stop_conditions_triggered || [];
  validateReleaseCoherence(file, verdict, report.release_eligibility, report.deterministic_identity, stopConditions);
}

function validateRegressionReport(contract, report) {
  const file = files.regressionReport;
  if (!report) return;

  requireFields(file, report, contract.required_regression_report_fields || []);
  requireFalseFlags(file, report.meta, 'meta');
  requireClaimBoundary(file, report.claim_boundary);
  validateNexusBoundary(file, report.nexus_boundary);

  const traceSummary = report.trace_boundary_summary || {};
  if (traceSummary.trace_status !== traceStatus || traceSummary.all_local_non_persistent_non_ledger !== true) {
    addFailure('trace_boundary_failure', file, 'trace_boundary_summary must be local/non-persistent/non-ledger');
  }
  validateAuditBoundary(file, traceSummary, 'trace_boundary_summary');

  const fixtures = Array.isArray(report.fixture_results) ? report.fixture_results : [];
  fixtures.forEach(fixture => {
    if (fixture.trace_status !== traceStatus) {
      addFailure('trace_boundary_failure', file, `${fixture.fixture_id} trace_status must be ${traceStatus}`);
    }
    validateAuditBoundary(file, fixture.audit_log_boundary, `${fixture.fixture_id}.audit_log_boundary`);
    validateReleaseCoherence(
      file,
      fixture.normalized_verdict,
      { eligible: fixture.release_eligible === true },
      { status: fixture.deterministic_identity },
      fixture.stop_conditions || []
    );
  });

  const release = report.release_eligibility_summary || {};
  if (release.coherence_status !== 'passed') {
    addFailure('release_eligibility_failure', file, 'release_eligibility_summary.coherence_status must be passed');
  }
  const deterministic = report.deterministic_identity_summary || {};
  if ((deterministic.fail || 0) > 0) {
    addFailure('deterministic_identity_failure', file, 'deterministic_identity_summary.fail must be 0');
  }
}

function validateFailureReport(contract, report, file) {
  requireFields(file, report, contract.required_failure_report_fields || [], 'report_shape_failure');
  const allowed = new Set(contract.allowed_failure_categories || []);
  if (report.failure_category && !allowed.has(report.failure_category)) {
    addFailure('report_shape_failure', file, `failure_category ${report.failure_category} is not allowed`);
  }
  requireFalseFlags(file, report.meta, 'meta');
  requireClaimBoundary(file, report.claim_boundary);
  validateTraceBoundary(file, report.trace_boundary);
  validateReleaseCoherence(file, report.normalized_verdict, report.release_eligibility, null, report.stop_conditions || []);
  validateAuditBoundary(file, report.raw_error_boundary, 'raw_error_boundary');
}

const contract = readJson(files.contract, 'report_contract_missing');
const singleReport = existsSync(path.join(repoRoot, files.singleReport))
  ? readJson(files.singleReport)
  : null;
const regressionReport = existsSync(path.join(repoRoot, files.regressionReport))
  ? readJson(files.regressionReport)
  : null;

validateContract(contract);
if (contract) {
  if (singleReport) {
    if (singleReport.failure_category) {
      validateFailureReport(contract, singleReport, files.singleReport);
    } else {
      validateSingleReport(contract, singleReport);
    }
  }
  if (regressionReport) validateRegressionReport(contract, regressionReport);
}

console.log('NEXUS import adapter report validation');
console.log('');
console.log('Files validated:');
console.log(`- ${files.contract}`);
if (singleReport) console.log(`- ${files.singleReport}`);
if (regressionReport) console.log(`- ${files.regressionReport}`);
console.log('');

if (!failures.length) {
  console.log('Result: PASS');
} else {
  console.log('Result: FAIL');
  console.log('');
  const grouped = new Map();
  failures.forEach(failure => {
    const key = `${failure.category}::${failure.file}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(failure.message);
  });
  grouped.forEach((messages, key) => {
    const [category, file] = key.split('::');
    console.log(`${category} — ${file}`);
    messages.forEach(message => console.log(`  - ${message}`));
    console.log('');
  });
  process.exitCode = 1;
}
