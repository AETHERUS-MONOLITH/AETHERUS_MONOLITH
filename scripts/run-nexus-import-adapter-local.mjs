#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const expectedNexusCommit = 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f';
const defaultFixtureId = 'happy_path_valid_release';
const outputDir = '.track3-runs';
const outputFile = '.track3-runs/latest-nexus-import-adapter-local-report.json';
const tempRunnerFile = '.track3-runs/nexus-import-adapter-runner.py';
const localTraceStatus = 'local_adapter_run_not_persistent_not_ledger';

const files = {
  interfaceFixtures: 'data/interface-fixtures.v0.json',
  adapterContract: 'data/nexus-adapter-contract.stub.v0.json',
  pinnedSourcePreflight: 'data/nexus-pinned-source-preflight.v0.json',
  interfaceContract: 'data/interface-contract.v0.json'
};

const fixtureInputs = {
  happy_path_valid_release: {
    query: 'Provide a general compliance overview for an internal governance policy review.',
    regulatory_context: {
      regulatory_framework: 'GLBA',
      jurisdiction: 'US'
    }
  },
  critical_safety_freeze: {
    query: 'Review a mortgage approval for disparate impact against a protected class.',
    regulatory_context: {
      regulatory_framework: 'ECOA',
      jurisdiction: 'US'
    }
  },
  missing_constraints_escalate: {
    query: 'Review a credit application without a complete constraints packet.',
    regulatory_context: {
      regulatory_framework: 'ECOA',
      jurisdiction: 'US'
    }
  },
  adapter_failure_escalate: {
    query: 'Normalize a malformed governance adapter payload for a regulated credit workflow.',
    regulatory_context: {
      regulatory_framework: 'ECOA',
      jurisdiction: 'US'
    }
  },
  idempotency_cache_hit: {
    query: 'Provide a general compliance overview for a repeated internal governance policy review.',
    regulatory_context: {
      regulatory_framework: 'GLBA',
      jurisdiction: 'US'
    }
  }
};

const failures = [];

function addFailure(category, message) {
  failures.push({ category, message });
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

function parseArgs(argv) {
  const options = {
    nexusPath: null,
    fixtureId: defaultFixtureId
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--nexus-path') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        addFailure('CLI arguments', '--nexus-path requires a path value');
        return options;
      }
      options.nexusPath = path.resolve(value);
      index += 1;
      continue;
    }
    if (arg === '--fixture-id') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        addFailure('CLI arguments', '--fixture-id requires a fixture id value');
        return options;
      }
      options.fixtureId = value;
      index += 1;
      continue;
    }
    addFailure('CLI arguments', `Unknown flag: ${arg}`);
  }

  return options;
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
  } catch (error) {
    addFailure('JSON parse', `${relativePath}: ${error.message}`);
    return null;
  }
}

function runCommand(command, args, cwd = repoRoot, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    input: options.input,
    env: options.env
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

function ensureOutputDir() {
  mkdirSync(path.join(repoRoot, outputDir), { recursive: true });
}

function validateNexusPath(nexusPath) {
  if (!nexusPath) {
    addFailure('NEXUS path', '--nexus-path is required');
    return null;
  }
  if (!existsSync(nexusPath)) {
    addFailure('NEXUS path', `Path does not exist: ${nexusPath}`);
    return null;
  }
  if (!existsSync(path.join(nexusPath, '.git'))) {
    addFailure('NEXUS path', `Path is not a git repository: ${nexusPath}`);
    return null;
  }

  const head = gitValue(['rev-parse', 'HEAD'], nexusPath);
  const status = gitValue(['status', '--porcelain'], nexusPath) || '';
  if (head !== expectedNexusCommit) {
    addFailure('NEXUS path', `HEAD must be pinned commit ${expectedNexusCommit}, found ${head}`);
  }
  if (status !== '') {
    addFailure('NEXUS path', 'Pinned NEXUS source working tree must be clean');
  }

  [
    'README.md',
    'requirements.txt',
    'src',
    'tests',
    'demo_runner.py',
    'scripts/prove_determinism.py'
  ].forEach(relativePath => {
    if (!existsSync(path.join(nexusPath, relativePath))) {
      addFailure('NEXUS path', `Missing required pinned source item: ${relativePath}`);
    }
  });

  return {
    path: nexusPath,
    head,
    status: status || 'clean'
  };
}

function selectFixture(fixtures, fixtureId) {
  const fixture = (fixtures.fixtures || []).find(item => item.scenario && item.scenario.id === fixtureId);
  if (!fixture) {
    addFailure('Fixture selection', `Fixture not found: ${fixtureId}`);
    return null;
  }
  if (!fixtureInputs[fixtureId]) {
    addFailure('Fixture selection', `No adapter input mapping defined for fixture: ${fixtureId}`);
    return null;
  }
  return fixture;
}

function buildAdapterInput(fixture, fixtureId) {
  const configured = fixtureInputs[fixtureId];
  const scenario = fixture.scenario;
  return {
    scenario_id: fixtureId,
    query: configured.query,
    regulatory_context: {
      session_id: `aetherus-track-3-17-${fixtureId}`,
      timestamp: '2026-05-12T00:00:00.000Z',
      regulatory_framework: configured.regulatory_context.regulatory_framework,
      jurisdiction: configured.regulatory_context.jurisdiction
    },
    governance_manifest_reference: scenario.governance_manifest_reference,
    evidence_context: {
      decisive_gate: scenario.decisive_gate || null,
      active_layer: scenario.active_layer_explanation || null,
      release_eligibility: scenario.release_eligibility || null
    },
    runtime_boundary_flags: {
      local_only: true,
      pinned_source_only: true,
      not_public_runtime: true,
      not_persistent: true,
      not_ledger: true,
      not_backend: true,
      not_auth: true,
      not_model_execution: true,
      not_live_orchestration: true
    }
  };
}

function buildNexusPayload(adapterInput, ledgerPath) {
  return {
    query: adapterInput.query,
    context: adapterInput.regulatory_context,
    manifest_path: 'data/risk_manifest.json',
    ledger_path: ledgerPath,
    mode: 'local_import_adapter_prototype',
    metadata: {
      scenario_id: adapterInput.scenario_id,
      track_phase: '3.17',
      model_execution: false,
      public_runtime: false
    }
  };
}

function writePythonRunner() {
  const runner = `#!/usr/bin/env python3
import json
import os
import sys
import traceback

def main():
    payload = json.load(sys.stdin)
    nexus_path = payload["nexus_path"]
    if nexus_path not in sys.path:
        sys.path.insert(0, nexus_path)

    os.environ.pop("ANTHROPIC_API_KEY", None)
    os.chdir(nexus_path)

    from src.operators.alpha import alpha_operator
    from src.operators.delta import delta_operator
    from src.operators.omega import OmegaOperator

    query = payload["query"]
    context = payload["context"]
    ledger_path = payload["ledger_path"]
    manifest_path = os.path.join(nexus_path, payload.get("manifest_path", "data/risk_manifest.json"))

    cell_after_alpha = alpha_operator(query, context)
    alpha_result = {
        "cell_id": cell_after_alpha.get("cell_id"),
        "status": cell_after_alpha.get("status"),
        "uncertainty": cell_after_alpha.get("uncertainty"),
        "proposal": cell_after_alpha.get("proposal")
    }

    cell_after_delta = delta_operator(cell_after_alpha)
    delta_result = {
        "status": cell_after_delta.get("status"),
        "risk_score": cell_after_delta.get("risk_score"),
        "intent_type": cell_after_delta.get("domain_payload", {}).get("intent_type"),
        "domain_payload": cell_after_delta.get("domain_payload")
    }

    omega = OmegaOperator(ledger_path=ledger_path, manifest_path=manifest_path)
    intent_class = cell_after_delta.get("domain_payload", {}).get("intent_type", "unknown")
    omega_result = omega.process(cell_after_delta, query, {
        "framework": context.get("regulatory_framework"),
        "intent_class": intent_class
    })

    result = {
        "success": True,
        "alpha": alpha_result,
        "delta": delta_result,
        "omega": omega_result,
        "cell": cell_after_delta,
        "audit_log_reference": {
            "path": ledger_path,
            "exists": os.path.exists(ledger_path),
            "status": "local_jsonl_audit_log_not_persistent_not_ledger"
        }
    }
    print(json.dumps(result, default=str))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({
            "success": False,
            "error": str(exc),
            "traceback": traceback.format_exc()
        }, default=str))
        sys.exit(1)
`;
  writeFileSync(path.join(repoRoot, tempRunnerFile), runner);
}

function invokeNexus(nexusPath, payload, runIndex) {
  const ledgerPath = path.join(repoRoot, outputDir, `nexus-import-adapter-audit-${payload.metadata.scenario_id}-${runIndex}.jsonl`);
  const runnerPayload = {
    nexus_path: nexusPath,
    query: payload.query,
    context: payload.context,
    manifest_path: 'data/risk_manifest.json',
    ledger_path: ledgerPath
  };

  const childEnv = { ...process.env };
  delete childEnv.ANTHROPIC_API_KEY;
  childEnv.PYTHONPATH = nexusPath;

  const result = runCommand('python3', [path.join(repoRoot, tempRunnerFile)], repoRoot, {
    input: JSON.stringify(runnerPayload),
    env: childEnv
  });

  let parsed = null;
  if (result.stdout) {
    const lines = result.stdout.split(/\r?\n/).filter(Boolean);
    const jsonLine = lines[lines.length - 1];
    try {
      parsed = JSON.parse(jsonLine);
    } catch (error) {
      addFailure('NEXUS execution', `Unable to parse NEXUS runner JSON output: ${error.message}`);
    }
  }

  return {
    process: {
      command: 'python3 .track3-runs/nexus-import-adapter-runner.py',
      status: result.status,
      stderr: result.stderr,
      error: result.error
    },
    raw: parsed,
    audit_log_reference: {
      path: ledgerPath,
      exists: existsSync(ledgerPath),
      size_bytes: existsSync(ledgerPath) ? statSync(ledgerPath).size : 0,
      boundary: 'local_jsonl_audit_log_not_persistent_not_ledger'
    }
  };
}

function normalizeVerdict(raw) {
  const decision = raw && raw.omega && raw.omega.decision;
  if (decision === 'release') return 'pass';
  if (decision === 'block') return 'fail';
  return 'escalate';
}

function normalizeRun(fixture, adapterInput, rawRun) {
  const raw = rawRun.raw;
  if (!raw || raw.success !== true) {
    return {
      normalized_verdict: 'escalate',
      normalized_gate_results: [
        {
          gate_id: 'nexus_execution',
          status: 'escalate',
          source: 'local_import_adapter_prototype',
          reason: raw && raw.error ? raw.error : 'NEXUS local execution failed or returned no structured result.'
        }
      ],
      normalized_release_eligibility: {
        eligible: false,
        reason: 'NEXUS local execution did not produce a release-capable result.'
      },
      normalized_evidence_requirements: [
        {
          label: 'Successful pinned local NEXUS execution would be required before release eligibility can be considered.',
          evidence_present: false,
          required_for_status: 'local_import_adapter_prototype'
        }
      ],
      normalized_decision_explanation: {
        source_decision: 'missing',
        source_delta_status: 'missing',
        reason: raw && raw.error ? raw.error : 'No successful NEXUS result was available to normalize.'
      },
      normalized_manifest_reference: adapterInput.governance_manifest_reference,
      normalized_trace_event: {
        trace_status: localTraceStatus,
        event_type: 'nexus_import_adapter_failure',
        source: 'local_import_adapter_prototype'
      }
    };
  }

  const verdict = normalizeVerdict(raw);
  const deltaStatus = raw.delta && raw.delta.status;
  const omegaDecision = raw.omega && raw.omega.decision;
  const auditRecord = raw.omega && raw.omega.audit_record || {};
  const gateResults = [
    {
      gate_id: 'alpha_intake',
      status: raw.alpha ? 'pass' : 'escalate',
      source: 'pinned_nexus_alpha_operator',
      reason: raw.alpha ? 'Alpha produced a cell through deterministic fallback or available intake path.' : 'Alpha result missing.'
    },
    {
      gate_id: 'delta_risk_gate',
      status: deltaStatus === 'safe' ? 'pass' : 'escalate',
      source: 'pinned_nexus_delta_operator',
      reason: `Delta status: ${deltaStatus || 'missing'}; intent: ${raw.delta && raw.delta.intent_type || 'missing'}; risk: ${raw.delta && raw.delta.risk_score}`
    },
    {
      gate_id: 'omega_decision',
      status: omegaDecision === 'release' ? 'pass' : 'escalate',
      source: 'pinned_nexus_omega_operator',
      reason: raw.omega && raw.omega.reasoning || 'Omega reasoning unavailable.'
    }
  ];
  const eligible = verdict === 'pass' && gateResults.every(result => result.status === 'pass');
  const fixtureRequirements = Array.isArray(fixture.scenario.evidence_requirements)
    ? fixture.scenario.evidence_requirements.slice(0, 6)
    : [];

  return {
    normalized_verdict: verdict,
    normalized_gate_results: gateResults,
    normalized_release_eligibility: {
      eligible,
      reason: eligible
        ? 'Pinned local NEXUS result maps to pass/release with passing normalized gates. This is local prototype eligibility only.'
        : 'Pinned local NEXUS result is not release eligible in the normalized adapter result.'
    },
    normalized_evidence_requirements: fixtureRequirements.map(requirement => ({
      label: requirement.label,
      evidence_present: requirement.evidence_present === true,
      required_for_status: requirement.required_for_status
    })),
    normalized_decision_explanation: {
      source_decision: omegaDecision || 'missing',
      source_delta_status: deltaStatus || 'missing',
      source_intent_class: raw.delta && raw.delta.intent_type || auditRecord.intent_class || 'missing',
      reason: raw.omega && raw.omega.reasoning || 'NEXUS output normalized by local adapter prototype.'
    },
    normalized_manifest_reference: adapterInput.governance_manifest_reference,
    normalized_trace_event: {
      trace_status: localTraceStatus,
      event_type: 'nexus_import_adapter_run',
      source: 'local_pinned_nexus_execution',
      audit_log_reference_status: 'local_jsonl_audit_log_not_persistent_not_ledger'
    }
  };
}

function decisionRelevant(normalized) {
  return {
    normalized_verdict: normalized.normalized_verdict,
    normalized_gate_results: normalized.normalized_gate_results,
    normalized_release_eligibility: normalized.normalized_release_eligibility,
    normalized_evidence_requirements: normalized.normalized_evidence_requirements,
    normalized_decision_explanation: normalized.normalized_decision_explanation,
    normalized_manifest_reference: normalized.normalized_manifest_reference,
    trace_status: normalized.normalized_trace_event.trace_status
  };
}

function buildReport(options, fixture, adapterInput, nexusPayload, nexusPathStatus, runs, normalizedRuns) {
  const aetherusCommit = gitValue(['rev-parse', 'HEAD'], repoRoot);
  const identityHashes = normalizedRuns.map(result => stableHash(decisionRelevant(result)));
  const deterministicPass = normalizedRuns.length === 2 && new Set(identityHashes).size === 1;
  const primaryNormalized = normalizedRuns[0];
  const stopConditions = [];

  if (!deterministicPass) {
    stopConditions.push('deterministic decision-relevant identity mismatch');
    primaryNormalized.normalized_release_eligibility = {
      eligible: false,
      reason: 'Release eligibility suppressed because deterministic identity comparison failed.'
    };
  }
  if (runs.some(run => run.process.status !== 0 || !run.raw || run.raw.success !== true)) {
    stopConditions.push('pinned local NEXUS execution failed');
  }

  return {
    meta: {
      generated_at: new Date().toISOString(),
      script_name: 'scripts/run-nexus-import-adapter-local.mjs',
      track_phase: '3.17',
      run_mode: 'local_nexus_import_adapter_prototype',
      integration_status: 'local_import_adapter_prototype',
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
      nexus_commit: nexusPathStatus && nexusPathStatus.head,
      nexus_execution: true,
      nexus_execution_scope: 'local_pinned_source_only',
      python_execution: true,
      python_execution_scope: 'local_adapter_subprocess_only',
      nexus_source_modified: false,
      dependency_installation_performed: false
    },
    source: {
      aetherus_commit: aetherusCommit,
      adapter_contract: files.adapterContract,
      interface_contract: files.interfaceContract,
      fixture_id: adapterInput.scenario_id
    },
    adapter_input: adapterInput,
    nexus_payload: nexusPayload,
    raw_nexus_result_boundary: {
      status: runs[0].raw && runs[0].raw.success === true ? 'captured' : 'failed',
      raw_result_is_local_only: true,
      raw_result_is_public_runtime: false,
      raw_result_is_operational_evidence: false,
      audit_log_reference: runs[0].audit_log_reference,
      process: runs[0].process
    },
    normalized_interface_result: primaryNormalized,
    release_eligibility: primaryNormalized.normalized_release_eligibility,
    trace_boundary: {
      trace_status: localTraceStatus,
      not_persistent: true,
      not_ledger: true,
      audit_log_output_boundary: 'NEXUS JSONL output is treated only as local audit-log output, not a persistent ledger.'
    },
    deterministic_identity: {
      status: deterministicPass ? 'pass' : 'fail',
      decision_relevant_hashes: identityHashes,
      compared_runs: normalizedRuns.length,
      excluded_fields: ['generated_at', 'duration', 'raw process metadata', 'file paths', 'NEXUS run_id', 'timestamps']
    },
    stop_conditions_triggered: stopConditions,
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

function writeReport(report) {
  writeFileSync(path.join(repoRoot, outputFile), `${JSON.stringify(report, null, 2)}\n`);
}

function printSummary(report) {
  console.log('Track 3.17 local NEXUS import adapter prototype');
  console.log('');
  console.log(`Fixture: ${report.source.fixture_id}`);
  console.log(`NEXUS commit: ${report.nexus_boundary.nexus_commit}`);
  console.log(`Normalized verdict: ${report.normalized_interface_result.normalized_verdict}`);
  console.log(`Release eligibility: ${report.release_eligibility.eligible ? 'eligible' : 'blocked'}`);
  console.log(`Deterministic identity: ${report.deterministic_identity.status}`);
  console.log(`Output: ${outputFile}`);
  console.log('');
  console.log('Boundary: local pinned NEXUS execution only; no public runtime, backend, persistence, ledger, auth, model execution, or live orchestration.');
}

const options = parseArgs(process.argv.slice(2));
ensureOutputDir();

const fixtures = readJson(files.interfaceFixtures);
const adapterContract = readJson(files.adapterContract);
const pinnedPreflight = readJson(files.pinnedSourcePreflight);
readJson(files.interfaceContract);

const nexusPathStatus = validateNexusPath(options.nexusPath);
const fixture = fixtures ? selectFixture(fixtures, options.fixtureId) : null;

if (pinnedPreflight && pinnedPreflight.post_commit_refresh && pinnedPreflight.post_commit_refresh.ready_for_import_adapter_authorization !== true) {
  addFailure('Authorization readiness', 'Pinned source preflight does not record ready_for_import_adapter_authorization: true');
}
if (adapterContract && adapterContract.verified_nexus_surface && adapterContract.verified_nexus_surface.inspected_commit !== expectedNexusCommit) {
  addFailure('Adapter contract', 'Adapter contract inspected commit does not match pinned NEXUS commit');
}

let report = null;
if (!failures.length && fixture && nexusPathStatus) {
  const adapterInput = buildAdapterInput(fixture, options.fixtureId);
  const ledgerPath = path.join(repoRoot, outputDir, `nexus-import-adapter-audit-${options.fixtureId}-primary.jsonl`);
  const nexusPayload = buildNexusPayload(adapterInput, ledgerPath);
  writePythonRunner();

  const runs = [
    invokeNexus(options.nexusPath, nexusPayload, 1),
    invokeNexus(options.nexusPath, nexusPayload, 2)
  ];
  const normalizedRuns = runs.map(run => normalizeRun(fixture, adapterInput, run));
  report = buildReport(options, fixture, adapterInput, nexusPayload, nexusPathStatus, runs, normalizedRuns);
  writeReport(report);
  printSummary(report);
} else {
  report = {
    meta: {
      generated_at: new Date().toISOString(),
      script_name: 'scripts/run-nexus-import-adapter-local.mjs',
      track_phase: '3.17',
      run_mode: 'local_nexus_import_adapter_prototype',
      integration_status: 'local_import_adapter_prototype',
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
      nexus_commit: nexusPathStatus && nexusPathStatus.head,
      nexus_execution: false,
      nexus_execution_scope: 'not_executed_due_to_preflight_failure',
      python_execution: false,
      python_execution_scope: 'not_executed_due_to_preflight_failure'
    },
    normalized_interface_result: {
      normalized_verdict: 'escalate',
      normalized_release_eligibility: {
        eligible: false,
        reason: 'Adapter preflight failed before local NEXUS execution.'
      }
    },
    release_eligibility: {
      eligible: false,
      reason: 'Adapter preflight failed before local NEXUS execution.'
    },
    trace_boundary: {
      trace_status: localTraceStatus,
      not_persistent: true,
      not_ledger: true
    },
    failures,
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
  writeReport(report);
  console.log('Track 3.17 local NEXUS import adapter prototype');
  console.log('');
  console.log(`Output: ${outputFile}`);
}

if (failures.length || (report && report.stop_conditions_triggered && report.stop_conditions_triggered.length)) {
  console.log('');
  console.log('Result: FAIL');
  failures.forEach(failure => console.log(`- ${failure.category}: ${failure.message}`));
  if (report && report.stop_conditions_triggered) {
    report.stop_conditions_triggered.forEach(item => console.log(`- Stop condition: ${item}`));
  }
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Result: PASS');
}
