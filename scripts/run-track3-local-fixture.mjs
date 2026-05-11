#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const files = {
  contract: 'data/interface-contract.v0.json',
  fixture: 'data/interface-fixture.example.v0.json',
  suite: 'data/interface-fixtures.v0.json',
  scenarios: 'data/scenarios.json',
  manifest: 'data/joint-workflow.manifest.json',
  validator: 'scripts/validate-track3-contracts.mjs',
  outputDir: '.track3-runs',
  outputFile: '.track3-runs/latest-local-fixture-report.json',
  suiteOutputFile: '.track3-runs/latest-local-fixture-suite-report.json'
};

const failures = [];
const isSuiteMode = process.argv.slice(2).includes('--suite');

function addFailure(category, message) {
  failures.push({ category, message });
}

function readText(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    addFailure('JSON parse', `${relativePath}: ${error.message}`);
    return null;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableHash(input) {
  return createHash('sha256').update(input).digest('hex');
}

function requireField(object, key, category, label) {
  if (!isObject(object) || object[key] === undefined || object[key] === null) {
    addFailure(category, `${label} is missing ${key}`);
    return false;
  }
  return true;
}

function runContractValidator() {
  const result = spawnSync(process.execPath, [files.validator], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    addFailure(
      'Contract validation',
      `Existing validator failed with exit code ${result.status}.\n${result.stdout || ''}${result.stderr || ''}`.trim()
    );
    return false;
  }

  return true;
}

function validateFixtureShape(fixture, scenarios, options = {}) {
  const label = options.label || files.fixture;
  requireField(fixture, 'metadata', 'Fixture shape', label);
  requireField(fixture, 'scenario', 'Fixture shape', label);

  const scenario = fixture.scenario;
  if (!isObject(scenario)) return null;

  [
    'scenario_input',
    'verdict',
    'decision_explanation',
    'evidence_requirements',
    'release_eligibility',
    'runtime_status'
  ].forEach(key => requireField(scenario, key, 'Fixture shape', 'fixture.scenario'));

  if (!scenario.gates && !scenario.gate_results) {
    addFailure('Fixture shape', 'fixture.scenario must include gates or gate_results');
  }

  if (options.expectedScenarioId && scenario.id !== options.expectedScenarioId) {
    addFailure('Scenario reference', `Expected fixture scenario id happy_path_valid_release, found ${scenario.id || 'missing'}`);
  }

  const scenarioIds = new Set((scenarios && scenarios.scenarios || []).map(item => item.id));
  if (!scenarioIds.has(scenario.id)) {
    addFailure('Scenario reference', `Fixture references scenario id ${scenario.id || 'missing'}, which does not exist in data/scenarios.json`);
  }

  const traceEventsText = JSON.stringify(scenario.trace_events || {}).toLowerCase();
  if (!traceEventsText.includes('illustrative') && !traceEventsText.includes('placeholder')) {
    addFailure('Trace boundary', 'fixture.scenario.trace_events must be marked illustrative or placeholder');
  }
  if (
    traceEventsText.includes('ledger')
    && !traceEventsText.includes('not a persistent ledger')
    && !traceEventsText.includes('not persistent ledger')
  ) {
    addFailure('Trace boundary', 'fixture.scenario.trace_events must not claim generated ledger behavior');
  }

  const fixtureText = JSON.stringify(fixture).toLowerCase();
  if (/\bruns\s+nexus\b|\bnexus execution\b|\bnexus-integrated\b/.test(fixtureText) && !/no nexus|not_currently_implemented|does not|not generated|boundary/.test(fixtureText)) {
    addFailure('NEXUS boundary', 'Fixture appears to claim NEXUS execution or integration without a boundary');
  }

  return scenario;
}

function validateFixtureSuite(suite, scenarios) {
  requireField(suite, 'metadata', 'Suite shape', files.suite);
  requireField(suite, 'fixture_policy', 'Suite shape', files.suite);
  requireField(suite, 'fixtures', 'Suite shape', files.suite);

  if (!Array.isArray(suite.fixtures) || !suite.fixtures.length) {
    addFailure('Suite shape', 'data/interface-fixtures.v0.json must contain a non-empty fixtures array');
    return [];
  }

  const scenarioIds = new Set((scenarios && scenarios.scenarios || []).map(item => item.id));
  const fixtureIds = new Set();

  suite.fixtures.forEach((fixture, index) => {
    const scenario = validateFixtureShape(fixture, scenarios, {
      label: `suite.fixtures[${index}]`
    });
    if (scenario && scenario.id) fixtureIds.add(scenario.id);

    const text = JSON.stringify(fixture).toLowerCase();
    [
      ['backend', /not backend|no backend/],
      ['persistence', /not persisted|not persistent|no persistence/],
      ['ledger', /not ledger|not persistent ledger|not a persistent ledger|no ledger/],
      ['NEXUS execution', /not nexus execution|no nexus|not_currently_implemented/],
      ['model execution', /not model execution|not model-executing|no model/],
      ['public operational behavior', /not public operational behavior|no public operational/]
    ].forEach(([boundaryName, boundaryPattern]) => {
      if (!boundaryPattern.test(text)) {
        addFailure('Suite boundary', `${scenario && scenario.id || `fixture ${index}`} does not clearly bound ${boundaryName}`);
      }
    });
  });

  scenarioIds.forEach(id => {
    if (!fixtureIds.has(id)) {
      addFailure('Suite coverage', `Missing suite fixture for ${id}`);
    }
  });

  return suite.fixtures;
}

function summarizeScenarioInput(input) {
  return {
    field_status: input.field_status || 'current_simulated',
    summary: input.summary || '',
    job_ticket_reference: input.job_ticket_reference || null,
    constraints_packet_reference: input.constraints_packet_reference || null
  };
}

function summarizeGateResults(gateResults = []) {
  return gateResults.map(result => ({
    gate_id: result.gate_id,
    status: result.status,
    stage_key: result.stage_key,
    field_status: result.field_status || 'current_simulated',
    note: result.note || ''
  }));
}

function summarizeEvidenceRequirements(items = []) {
  return items.map(item => ({
    label: item.label,
    required_for_status: item.required_for_status,
    evidence_present: item.evidence_present === true,
    field_status: item.field_status || 'current_static'
  }));
}

function buildLocalTraceEvents(scenario, fixtureHash) {
  const traceSource = scenario.trace_events && Array.isArray(scenario.trace_events.items)
    ? scenario.trace_events.items
    : [];

  return traceSource.map((event, index) => {
    const localIdSeed = `${scenario.id}:${event.id || index}:${event.action_type || 'event'}:${fixtureHash}`;
    return {
      id: `LOCAL-DRY-RUN-${String(index + 1).padStart(2, '0')}-${stableHash(localIdSeed).slice(0, 10).toUpperCase()}`,
      sequence: index + 1,
      trace_status: 'local_dry_run_not_persistent_not_ledger',
      source_event_id: event.id || null,
      agent_id: event.agent_id || 'fixture',
      action_type: event.action_type || 'fixture_event',
      payload_ref: event.payload_ref || null,
      note: 'Generated by local fixture dry-run scaffold from static example fixture data.'
    };
  });
}

function buildReport({
  contract,
  fixture,
  scenarios,
  manifest,
  fixtureText,
  fixtureFile = files.fixture,
  trackPhase = '3.4',
  runMode = 'local_fixture_dry_run'
}) {
  const scenario = fixture.scenario;
  const fixtureHash = stableHash(fixtureText);
  const phaseSlug = trackPhase.replace('.', '-');
  const runId = `track${phaseSlug}-${stableHash(`${fixtureFile}:${scenario.id}:${fixtureHash}`).slice(0, 16)}`;

  return {
    meta: {
      generated_at: new Date().toISOString(),
      script_name: 'scripts/run-track3-local-fixture.mjs',
      track_phase: trackPhase,
      run_mode: runMode,
      run_id: runId,
      public_runtime: false,
      persistence: false,
      ledger: false,
      nexus_execution: false,
      model_execution: false
    },
    source: {
      fixture_file: fixtureFile,
      scenario_id: scenario.id,
      contract_file: files.contract,
      joint_workflow_manifest_file: files.manifest,
      scenario_registry_file: files.scenarios,
      contract_name: contract.metadata && contract.metadata.name,
      manifest_name: manifest.name,
      fixture_hash_sha256: fixtureHash,
      source_scenario_exists: (scenarios.scenarios || []).some(item => item.id === scenario.id)
    },
    scenario_input_summary: summarizeScenarioInput(scenario.scenario_input || {}),
    gate_results_summary: summarizeGateResults(scenario.gate_results || []),
    verdict_summary: {
      status: scenario.verdict && scenario.verdict.status,
      subtype: scenario.verdict && scenario.verdict.subtype,
      reason: scenario.verdict && scenario.verdict.reason,
      field_status: scenario.verdict && scenario.verdict.field_status,
      runtime_derivation_status: scenario.verdict && scenario.verdict.runtime_derivation_status
    },
    decision_explanation_summary: {
      why_verdict: scenario.decision_explanation && scenario.decision_explanation.why_verdict,
      determining_condition: scenario.decision_explanation && scenario.decision_explanation.determining_condition,
      decisive_rule_or_gate: scenario.decision_explanation && scenario.decision_explanation.decisive_rule_or_gate,
      different_verdict_requires: scenario.decision_explanation && scenario.decision_explanation.different_verdict_requires,
      field_status: scenario.decision_explanation && scenario.decision_explanation.field_status
    },
    evidence_requirements_summary: summarizeEvidenceRequirements(scenario.evidence_requirements || []),
    release_eligibility_summary: {
      eligible: scenario.release_eligibility && scenario.release_eligibility.eligible === true,
      label: scenario.release_eligibility && scenario.release_eligibility.label,
      explanation: scenario.release_eligibility && scenario.release_eligibility.explanation,
      field_status: scenario.release_eligibility && scenario.release_eligibility.field_status
    },
    local_trace_events: buildLocalTraceEvents(scenario, fixtureHash),
    claim_boundary: {
      status: 'local fixture runtime scaffold only',
      not_backend: true,
      not_persisted: true,
      not_ledger: true,
      not_authenticated: true,
      not_nexus_integrated: true,
      not_model_executing: true,
      not_public_operational_behavior: true,
      statement: 'This local dry-run transforms static fixture data into a deterministic report. It is not Joint-Workflow runtime execution, NEXUS execution, persistent trace storage, ledger behavior, authenticated workflow, model execution, backend orchestration, or public operational behavior.'
    }
  };
}

function writeJsonReport(report, relativePath) {
  const outputDir = path.join(repoRoot, files.outputDir);
  const outputPath = path.join(repoRoot, relativePath);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outputPath;
}

function printFailures() {
  console.error('Track 3.4 local fixture dry-run: FAIL');
  console.error('');

  const grouped = new Map();
  failures.forEach(failure => {
    if (!grouped.has(failure.category)) grouped.set(failure.category, []);
    grouped.get(failure.category).push(failure.message);
  });

  grouped.forEach((messages, category) => {
    console.error(`${category}:`);
    messages.forEach(message => console.error(`- ${message}`));
    console.error('');
  });
}

function printSummary(report, outputPath) {
  console.log(`${report.meta.track_phase === '3.5' ? 'Track 3.5 fixture suite dry-run' : 'Track 3.4 local fixture dry-run'}: PASS`);
  console.log('');
  console.log(`Run id: ${report.meta.run_id}`);
  console.log(`Scenario: ${report.source.scenario_id}`);
  console.log(`Verdict: ${report.verdict_summary.status}${report.verdict_summary.subtype ? ` / ${report.verdict_summary.subtype}` : ''}`);
  console.log(`Release eligibility: ${report.release_eligibility_summary.label}`);
  console.log(`Local trace-like events: ${report.local_trace_events.length}`);
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
  console.log('');
  console.log('Boundary: local fixture dry-run only; no backend, persistence, ledger, auth, NEXUS execution, model execution, or public operational behavior.');
}

function buildSuiteReport({ contract, suite, scenarios, manifest, suiteText }) {
  const suiteHash = stableHash(suiteText);
  const fixtureReports = suite.fixtures.map(fixture => buildReport({
    contract,
    fixture,
    scenarios,
    manifest,
    fixtureText: JSON.stringify(fixture),
    fixtureFile: files.suite,
    trackPhase: '3.5',
    runMode: 'local_fixture_suite_dry_run'
  }));

  return {
    meta: {
      generated_at: new Date().toISOString(),
      script_name: 'scripts/run-track3-local-fixture.mjs',
      track_phase: '3.5',
      run_mode: 'local_fixture_suite_dry_run',
      suite_run_id: `track3-5-suite-${stableHash(`${files.suite}:${suiteHash}`).slice(0, 16)}`,
      public_runtime: false,
      persistence: false,
      ledger: false,
      nexus_execution: false,
      model_execution: false
    },
    source: {
      suite_file: files.suite,
      contract_file: files.contract,
      joint_workflow_manifest_file: files.manifest,
      scenario_registry_file: files.scenarios,
      fixture_count: fixtureReports.length,
      scenario_ids: fixtureReports.map(report => report.source.scenario_id),
      suite_hash_sha256: suiteHash,
      manifest_name: manifest.name
    },
    fixture_reports: fixtureReports,
    claim_boundary: {
      status: 'local fixture suite scaffold only',
      not_backend: true,
      not_persisted: true,
      not_ledger: true,
      not_authenticated: true,
      not_nexus_integrated: true,
      not_model_executing: true,
      not_public_operational_behavior: true,
      statement: 'This suite dry-run transforms static fixture data into deterministic local reports. It is not Joint-Workflow runtime execution, NEXUS execution, persistent trace storage, ledger behavior, authenticated workflow, model execution, backend orchestration, or public operational behavior.'
    }
  };
}

function printSuiteSummary(report, outputPath) {
  console.log('Track 3.5 fixture suite dry-run: PASS');
  console.log('');
  console.log(`Suite run id: ${report.meta.suite_run_id}`);
  console.log(`Fixtures: ${report.source.fixture_count}`);
  console.log(`Scenarios: ${report.source.scenario_ids.join(', ')}`);
  console.log(`Output: ${path.relative(repoRoot, outputPath)}`);
  console.log('');
  console.log('Boundary: local fixture suite dry-run only; no backend, persistence, ledger, auth, NEXUS execution, model execution, or public operational behavior.');
}

runContractValidator();

const contract = readJson(files.contract);
const fixtureText = (() => {
  try {
    return readText(files.fixture);
  } catch (error) {
    addFailure('File read', `${files.fixture}: ${error.message}`);
    return '{}';
  }
})();
const fixture = (() => {
  try {
    return JSON.parse(fixtureText);
  } catch (error) {
    addFailure('JSON parse', `${files.fixture}: ${error.message}`);
    return null;
  }
})();
const suiteText = (() => {
  if (!isSuiteMode) return null;
  try {
    return readText(files.suite);
  } catch (error) {
    addFailure('File read', `${files.suite}: ${error.message}`);
    return '{}';
  }
})();
const suite = (() => {
  if (!isSuiteMode) return null;
  try {
    return JSON.parse(suiteText);
  } catch (error) {
    addFailure('JSON parse', `${files.suite}: ${error.message}`);
    return null;
  }
})();
const scenarios = readJson(files.scenarios);
const manifest = readJson(files.manifest);

if (isSuiteMode) {
  if (suite && scenarios) validateFixtureSuite(suite, scenarios);
} else if (fixture && scenarios) {
  validateFixtureShape(fixture, scenarios, {
    expectedScenarioId: 'happy_path_valid_release'
  });
}

if (failures.length || !contract || !scenarios || !manifest || (!isSuiteMode && !fixture) || (isSuiteMode && !suite)) {
  printFailures();
  process.exit(1);
}

if (isSuiteMode) {
  const report = buildSuiteReport({ contract, suite, scenarios, manifest, suiteText });
  const outputPath = writeJsonReport(report, files.suiteOutputFile);
  printSuiteSummary(report, outputPath);
} else {
  const report = buildReport({ contract, fixture, scenarios, manifest, fixtureText });
  const outputPath = writeJsonReport(report, files.outputFile);
  printSummary(report, outputPath);
}
