#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const contractPath = 'data/nexus-adapter-contract.stub.v0.json';
const fixturesPath = 'data/nexus-adapter-mismatch-fixtures.v0.json';
const failures = [];

const requiredCategories = [
  'unknown_nexus_verdict',
  'unknown_risk_level',
  'missing_omega_decision',
  'audit_log_present_but_not_ledger_valid',
  'missing_regulatory_context',
  'missing_manifest_mapping',
  'unsupported_scenario_domain',
  'non_deterministic_output',
  'nexus_execution_failure',
  'malformed_alpha_delta_omega_shape'
];

function addFailure(file, category, message) {
  failures.push({ file, category, message });
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
  } catch (error) {
    addFailure(relativePath, 'JSON parse', error.message);
    return null;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, file, category, label) {
  if (!isObject(value)) {
    addFailure(file, category, `${label} must be an object`);
    return false;
  }
  return true;
}

function validateBooleanFlags(file, fixture) {
  const expectedFalse = [
    'nexus_execution',
    'public_runtime',
    'persistence',
    'ledger',
    'model_execution',
    'backend'
  ];

  if (fixture.integration_status !== 'not_integrated') {
    addFailure(file, 'Boundary flags', `${fixture.fixture_id} integration_status must be not_integrated`);
  }
  expectedFalse.forEach(flag => {
    if (fixture[flag] !== false) {
      addFailure(file, 'Boundary flags', `${fixture.fixture_id} ${flag} must be false`);
    }
  });
}

function validateExpectedFailSafe(file, fixture) {
  if (fixture.expected_normalized_verdict !== 'escalate') {
    addFailure(file, 'Fail-safe behavior', `${fixture.fixture_id} must normalize to escalate`);
  }
  if (fixture.expected_release_eligibility !== false) {
    addFailure(file, 'Fail-safe behavior', `${fixture.fixture_id} must block release eligibility`);
  }

  const behavior = fixture.expected_adapter_behavior || {};
  if (!behavior.behavior || !behavior.reason) {
    addFailure(file, 'Fail-safe behavior', `${fixture.fixture_id} must include expected_adapter_behavior.behavior and reason`);
  }
}

function validateTraceBoundary(file, fixture) {
  const boundary = fixture.expected_trace_boundary || {};
  const traceStatus = boundary.trace_status || '';
  if (!traceStatus.includes('not_persistent') || !traceStatus.includes('not_ledger')) {
    addFailure(file, 'Trace boundary', `${fixture.fixture_id} trace status must remain non-persistent and non-ledger`);
  }

  const text = JSON.stringify(fixture).toLowerCase();
  if (/\bledger_valid"\s*:\s*true/.test(text) || /\bproduction ledger\b/.test(text) || /\bpersistent ledger\b/.test(text)) {
    addFailure(file, 'Trace boundary', `${fixture.fixture_id} must not claim ledger validity`);
  }
}

function validateClaimBoundary(file, fixture) {
  const boundary = fixture.expected_claim_boundary || {};
  if (boundary.not_actual_nexus_execution !== true) {
    addFailure(file, 'Claim boundary', `${fixture.fixture_id} must state not_actual_nexus_execution`);
  }
  if (boundary.not_public_runtime !== true) {
    addFailure(file, 'Claim boundary', `${fixture.fixture_id} must state not_public_runtime`);
  }
  if (boundary.not_ledger_valid !== true) {
    addFailure(file, 'Claim boundary', `${fixture.fixture_id} must state not_ledger_valid`);
  }

  const text = JSON.stringify(fixture).toLowerCase();
  const prohibited = [
    /\bactual nexus execution\b/,
    /\bruns nexus\b/,
    /\bintegrated into live site\b/,
    /\bnexus powers public interface\b/,
    /\blive governance kernel\b/,
    /\bproduction runtime\b/
  ];

  prohibited.forEach(pattern => {
    if (pattern.test(text)) {
      addFailure(file, 'Claim boundary', `${fixture.fixture_id} contains unbounded operational language matching ${pattern}`);
    }
  });
}

function validateCategorySpecificFixture(file, fixture) {
  const result = fixture.simulated_nexus_like_result;
  const input = fixture.input_stub || {};

  switch (fixture.mismatch_category) {
    case 'unknown_nexus_verdict':
      if (!result || !result.omega || result.omega.decision === undefined) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} must include an unknown omega decision`);
      }
      if (['release', 'escalate', 'abstain', 'block'].includes(result.omega && result.omega.decision)) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} omega decision must be outside known NEXUS vocabulary`);
      }
      break;
    case 'unknown_risk_level':
      if (!result || !result.delta || result.delta.risk_level === undefined) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} must include an unknown risk_level`);
      }
      if (['low', 'medium', 'high', 'blocked', 'safe'].includes(result.delta && result.delta.risk_level)) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} risk_level must be outside known local vocabulary`);
      }
      break;
    case 'missing_omega_decision':
      if (result && result.omega && result.omega.decision !== undefined) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} must omit omega.decision`);
      }
      break;
    case 'audit_log_present_but_not_ledger_valid':
      if (!result || !result.audit_log_reference) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} must include audit_log_reference`);
      }
      if (result && result.audit_log_reference && result.audit_log_reference.ledger_valid !== false) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} audit_log_reference.ledger_valid must be false`);
      }
      break;
    case 'missing_regulatory_context':
      if (input.regulatory_context !== null) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} must have null regulatory_context`);
      }
      break;
    case 'missing_manifest_mapping':
      if (input.governance_manifest_reference !== null) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} must have null governance_manifest_reference`);
      }
      break;
    case 'unsupported_scenario_domain':
      if (input.domain === 'fintech') {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} must use an unsupported non-fintech domain`);
      }
      break;
    case 'non_deterministic_output':
      if (!result || !Array.isArray(result.repeat_results) || result.repeat_results.length < 2) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} must include at least two repeat_results`);
      } else {
        const serialized = result.repeat_results.map(item => JSON.stringify(item));
        if (new Set(serialized).size === 1) {
          addFailure(file, 'Category semantics', `${fixture.fixture_id} repeat_results must differ`);
        }
      }
      break;
    case 'nexus_execution_failure':
      if (!result || result.success !== false || !result.error) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} must contain a simulated failure object`);
      }
      break;
    case 'malformed_alpha_delta_omega_shape':
      if (isObject(result.alpha) && isObject(result.delta) && isObject(result.omega)) {
        addFailure(file, 'Category semantics', `${fixture.fixture_id} must contain malformed Alpha/Delta/Omega shapes`);
      }
      break;
    default:
      addFailure(file, 'Category semantics', `${fixture.fixture_id} has unknown category ${fixture.mismatch_category}`);
  }
}

function validateFixtures(contract, suite) {
  const file = fixturesPath;
  if (!requireObject(contract, contractPath, 'Contract', 'contract')) return;
  if (!requireObject(suite, file, 'Fixture suite', 'suite')) return;

  const policy = contract.mismatch_policy || {};
  requiredCategories.forEach(category => {
    if (!policy[category]) {
      addFailure(contractPath, 'Mismatch policy', `Contract mismatch_policy missing ${category}`);
    }
  });

  if (!suite.metadata || suite.metadata.integration_status !== 'not_integrated') {
    addFailure(file, 'Suite metadata', 'metadata.integration_status must be not_integrated');
  }
  ['nexus_execution', 'public_runtime', 'persistence', 'ledger', 'model_execution', 'backend'].forEach(flag => {
    if (!suite.metadata || suite.metadata[flag] !== false) {
      addFailure(file, 'Suite metadata', `metadata.${flag} must be false`);
    }
  });

  if (!Array.isArray(suite.fixtures) || !suite.fixtures.length) {
    addFailure(file, 'Fixture suite', 'fixtures must be a non-empty array');
    return;
  }

  const byCategory = new Map();
  suite.fixtures.forEach((fixture, index) => {
    const label = fixture && fixture.fixture_id ? fixture.fixture_id : `fixtures[${index}]`;
    if (!requireObject(fixture, file, 'Fixture structure', label)) return;

    [
      'fixture_id',
      'mismatch_category',
      'input_stub',
      'simulated_nexus_like_result',
      'expected_adapter_behavior',
      'expected_normalized_verdict',
      'expected_release_eligibility',
      'expected_trace_boundary',
      'expected_claim_boundary',
      'integration_status'
    ].forEach(key => {
      if (fixture[key] === undefined || fixture[key] === null) {
        addFailure(file, 'Fixture structure', `${label} missing ${key}`);
      }
    });

    byCategory.set(fixture.mismatch_category, (byCategory.get(fixture.mismatch_category) || 0) + 1);
    if (!policy[fixture.mismatch_category]) {
      addFailure(file, 'Mismatch policy alignment', `${label} category ${fixture.mismatch_category} is not present in contract mismatch_policy`);
    }

    validateBooleanFlags(file, fixture);
    validateExpectedFailSafe(file, fixture);
    validateTraceBoundary(file, fixture);
    validateClaimBoundary(file, fixture);
    validateCategorySpecificFixture(file, fixture);
  });

  requiredCategories.forEach(category => {
    const count = byCategory.get(category) || 0;
    if (count === 0) {
      addFailure(file, 'Mismatch category coverage', `Missing fixture for ${category}`);
    }
    if (count > 1) {
      addFailure(file, 'Mismatch category coverage', `Duplicate fixtures for ${category}: ${count}`);
    }
  });
}

function printResults() {
  console.log('NEXUS adapter mismatch validation');
  console.log('');
  console.log('Files validated:');
  console.log(`- ${contractPath}`);
  console.log(`- ${fixturesPath}`);
  console.log('');

  if (!failures.length) {
    console.log('Result: PASS');
    return;
  }

  console.log('Result: FAIL');
  console.log('');

  const grouped = new Map();
  failures.forEach(failure => {
    const key = `${failure.file}::${failure.category}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(failure.message);
  });

  grouped.forEach((messages, key) => {
    const [file, category] = key.split('::');
    console.log(`${file} — ${category}`);
    messages.forEach(message => console.log(`  - ${message}`));
    console.log('');
  });
}

const contract = readJson(contractPath);
const suite = readJson(fixturesPath);

validateFixtures(contract, suite);
printResults();

if (failures.length) {
  process.exitCode = 1;
}
