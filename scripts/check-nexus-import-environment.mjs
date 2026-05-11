#!/usr/bin/env node
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const expectedAetherusBaseline = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
  shell: false
}).stdout.trim();
const expectedNexusCommit = 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f';
const outputDir = '.track3-runs';
const outputFile = '.track3-runs/latest-nexus-import-environment-preflight.json';

const boundaryFlags = {
  integration_status: 'not_integrated',
  nexus_execution: false,
  python_execution: false,
  public_runtime: false,
  persistence: false,
  ledger: false,
  model_execution: false,
  backend: false,
  auth: false,
  database: false
};

const failures = [];

function addFailure(category, message) {
  failures.push({ category, message });
}

function parseArgs(argv) {
  const options = {
    nexusPath: null,
    requirePython: false
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
    if (arg === '--require-python') {
      options.requirePython = true;
      continue;
    }
    addFailure('CLI arguments', `Unknown flag: ${arg}`);
  }

  return options;
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

function fileExists(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function dirExists(dirPath) {
  try {
    return statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function parseJson(relativePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'))
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

function inspectAetherusRepository() {
  const branch = gitValue(['branch', '--show-current'], repoRoot);
  const head = gitValue(['rev-parse', 'HEAD'], repoRoot);
  const originMain = gitValue(['rev-parse', 'origin/main'], repoRoot);
  const status = gitValue(['status', '--porcelain'], repoRoot) || '';
  const preflight = parseJson('data/nexus-import-adapter-preflight.v0.json');

  const validationFiles = [
    'data/nexus-import-adapter-preflight.v0.json',
    'data/nexus-adapter-readiness.v0.json',
    'data/nexus-adapter-contract.stub.v0.json',
    'data/nexus-adapter-mismatch-fixtures.v0.json',
    'data/nexus-adapter-normalization-fixtures.v0.json',
    'scripts/validate-track3-contracts.mjs',
    'scripts/validate-nexus-adapter-mismatches.mjs',
    'scripts/run-nexus-adapter-normalizer-stub.mjs',
    'scripts/validate-nexus-adapter-normalizer-suite.mjs',
    'docs/TRACK_3_IMPORT_ADAPTER_PREFLIGHT.md'
  ].map(relativePath => ({
    file: relativePath,
    exists: fileExists(path.join(repoRoot, relativePath))
  }));

  return {
    branch,
    head,
    origin_main: originMain,
    expected_baseline: expectedAetherusBaseline,
    baseline_matches: head === expectedAetherusBaseline,
    working_tree_clean: status.length === 0,
    working_tree_status: status || 'clean',
    validation_files: validationFiles,
    preflight_json: {
      file: 'data/nexus-import-adapter-preflight.v0.json',
      exists: fileExists(path.join(repoRoot, 'data/nexus-import-adapter-preflight.v0.json')),
      parses: preflight.ok,
      error: preflight.ok ? null : preflight.error
    }
  };
}

function inspectNexusRepository(nexusPath) {
  if (!nexusPath) {
    return {
      nexus_path_status: 'not_provided',
      path: null,
      note: 'Future import adapter requires an explicit --nexus-path value.'
    };
  }

  const exists = dirExists(nexusPath);
  if (!exists) {
    return {
      nexus_path_status: 'missing',
      path: nexusPath,
      exists: false
    };
  }

  const gitDir = path.join(nexusPath, '.git');
  const appearsGitRepository = dirExists(gitDir) || fileExists(gitDir);
  const head = appearsGitRepository ? gitValue(['rev-parse', 'HEAD'], nexusPath) : null;
  const branch = appearsGitRepository ? gitValue(['branch', '--show-current'], nexusPath) : null;
  const status = appearsGitRepository ? gitValue(['status', '--porcelain'], nexusPath) || '' : null;

  const requiredFiles = [
    {
      label: 'README',
      candidates: ['README.md', 'README']
    },
    {
      label: 'requirements/dependency file',
      candidates: ['requirements.txt', 'pyproject.toml', 'setup.py', 'setup.cfg']
    },
    {
      label: 'source or package module directory',
      candidates: ['src', 'nexus', 'nexus_mvp']
    },
    {
      label: 'tests directory',
      candidates: ['tests']
    },
    {
      label: 'demo runner',
      candidates: ['demo_runner.py']
    },
    {
      label: 'determinism proof script',
      candidates: ['scripts/prove_determinism.py']
    }
  ].map(group => {
    const found = group.candidates.filter(candidate => {
      const target = path.join(nexusPath, candidate);
      return fileExists(target) || dirExists(target);
    });
    return {
      label: group.label,
      candidates: group.candidates,
      found,
      present: found.length > 0
    };
  });

  const dependencyDeclarations = [
    'requirements.txt',
    'pyproject.toml',
    'setup.py',
    'setup.cfg'
  ].map(relativePath => {
    const fullPath = path.join(nexusPath, relativePath);
    return {
      file: relativePath,
      exists: fileExists(fullPath),
      size_bytes: fileExists(fullPath) ? statSync(fullPath).size : null
    };
  });

  return {
    nexus_path_status: 'provided',
    path: nexusPath,
    exists: true,
    appears_git_repository: appearsGitRepository,
    branch,
    head,
    expected_commit: expectedNexusCommit,
    commit_matches: head === expectedNexusCommit,
    working_tree_clean: status === '',
    working_tree_status: status || (appearsGitRepository ? 'clean' : 'not_a_git_repository'),
    required_files: requiredFiles,
    dependency_declarations: dependencyDeclarations
  };
}

function commandVersion(command, args) {
  const result = runCommand(command, args);
  return {
    available: result.status === 0,
    command: result.command,
    version: result.status === 0 ? result.stdout || result.stderr : null,
    error: result.status === 0 ? null : result.error || result.stderr || 'command unavailable'
  };
}

function checkOutputIgnored(relativePath) {
  const result = runCommand('git', ['check-ignore', relativePath], repoRoot);
  return {
    path: relativePath,
    ignored: result.status === 0,
    check_output: result.stdout || result.stderr || null
  };
}

function buildReadiness(aetherus, nexus, environment, outputIgnored, options) {
  const missingPreconditions = [];
  const warnings = [];
  const stopConditionsTriggered = [];

  if (!aetherus.baseline_matches) {
    stopConditionsTriggered.push('AETHERUS baseline mismatch');
  }
  if (!aetherus.working_tree_clean) {
    missingPreconditions.push('AETHERUS working tree is not clean.');
  }
  if (!aetherus.preflight_json.exists || !aetherus.preflight_json.parses) {
    stopConditionsTriggered.push('Preflight JSON missing or invalid');
  }
  aetherus.validation_files
    .filter(item => !item.exists)
    .forEach(item => missingPreconditions.push(`Required AETHERUS validation file missing: ${item.file}`));

  if (nexus.nexus_path_status === 'not_provided') {
    missingPreconditions.push('NEXUS path not provided. Future import adapter requires explicit --nexus-path.');
  } else if (nexus.nexus_path_status === 'missing') {
    stopConditionsTriggered.push('NEXUS path missing');
  } else {
    if (!nexus.appears_git_repository) {
      stopConditionsTriggered.push('NEXUS path is not a git repository');
    }
    if (!nexus.commit_matches) {
      stopConditionsTriggered.push('NEXUS commit mismatch');
    }
    if (!nexus.working_tree_clean) {
      stopConditionsTriggered.push('NEXUS working tree dirty');
    }
    nexus.required_files
      .filter(item => !item.present)
      .forEach(item => stopConditionsTriggered.push(`Required NEXUS file group missing: ${item.label}`));
  }

  if (!environment.git.available) {
    stopConditionsTriggered.push('git unavailable');
  }
  if (options.requirePython && !environment.python3.available) {
    stopConditionsTriggered.push('Python unavailable while --require-python was supplied');
  }
  if (!environment.python3.available && !options.requirePython) {
    warnings.push('python3 unavailable; not required for this preflight run.');
  }
  if (!outputIgnored.ignored) {
    stopConditionsTriggered.push('Generated output path is not ignored by git');
  }

  return {
    import_adapter_authorized: false,
    import_adapter_ready_for_authorization: missingPreconditions.length === 0 && stopConditionsTriggered.length === 0,
    missing_preconditions: missingPreconditions,
    warnings,
    stop_conditions_triggered: stopConditionsTriggered
  };
}

function validateBoundaryFlags() {
  Object.entries(boundaryFlags).forEach(([key, value]) => {
    if (key === 'integration_status') {
      if (value !== 'not_integrated') addFailure('Boundary flags', 'integration_status must be not_integrated');
      return;
    }
    if (value !== false) addFailure('Boundary flags', `${key} must be false`);
  });
}

function writeReport(report) {
  const outputDirPath = path.join(repoRoot, outputDir);
  mkdirSync(outputDirPath, { recursive: true });
  writeFileSync(path.join(repoRoot, outputFile), `${JSON.stringify(report, null, 2)}\n`);
}

function printSummary(report) {
  const readiness = report.future_authorization_status;
  console.log('Track 3.13 NEXUS import environment preflight');
  console.log('');
  console.log(`AETHERUS HEAD: ${report.aetherus.head || 'unknown'} (${report.aetherus.baseline_matches ? 'matches baseline' : 'baseline mismatch'})`);
  console.log(`NEXUS path: ${report.nexus.nexus_path_status}`);
  if (report.nexus.nexus_path_status === 'provided') {
    console.log(`NEXUS HEAD: ${report.nexus.head || 'unknown'} (${report.nexus.commit_matches ? 'matches reference' : 'commit mismatch'})`);
  }
  console.log(`python3: ${report.environment.python3.available ? report.environment.python3.version : 'unavailable'}`);
  console.log(`Future import adapter ready for authorization: ${readiness.import_adapter_ready_for_authorization ? 'yes' : 'no'}`);
  console.log(`Output: ${outputFile}`);
  console.log('');
  console.log('No NEXUS import or execution occurred. No Python code from NEXUS was executed.');
  if (readiness.missing_preconditions.length) {
    console.log('');
    console.log('Missing preconditions:');
    readiness.missing_preconditions.forEach(item => console.log(`- ${item}`));
  }
  if (readiness.stop_conditions_triggered.length) {
    console.log('');
    console.log('Stop conditions triggered:');
    readiness.stop_conditions_triggered.forEach(item => console.log(`- ${item}`));
  }
}

const options = parseArgs(process.argv.slice(2));
validateBoundaryFlags();

const aetherus = inspectAetherusRepository();
const nexus = inspectNexusRepository(options.nexusPath);
const environment = {
  node: {
    available: true,
    command: 'node --version',
    version: process.version
  },
  git: commandVersion('git', ['--version']),
  python3: commandVersion('python3', ['--version']),
  dependency_installation_performed: false,
  nexus_code_executed: false
};
const outputIgnored = checkOutputIgnored(outputFile);
const futureAuthorizationStatus = buildReadiness(aetherus, nexus, environment, outputIgnored, options);

const report = {
  meta: {
    generated_at: new Date().toISOString(),
    script_name: 'scripts/check-nexus-import-environment.mjs',
    track_phase: '3.13',
    run_mode: 'nexus_import_environment_preflight',
    ...boundaryFlags
  },
  reference_commits: {
    aetherus_expected_baseline: expectedAetherusBaseline,
    nexus_reference_commit: expectedNexusCommit
  },
  aetherus,
  nexus,
  environment,
  output: {
    file: outputFile,
    ignored_by_git: outputIgnored.ignored
  },
  future_authorization_status: futureAuthorizationStatus,
  claim_boundary: {
    import_adapter_authorized: false,
    not_nexus_integrated: true,
    not_nexus_executing: true,
    not_python_executing_nexus_code: true,
    not_public_runtime: true,
    not_persistent: true,
    not_ledger: true,
    not_backend: true,
    not_authenticated: true,
    not_model_executing: true
  }
};

try {
  writeReport(report);
} catch (error) {
  addFailure('Output', `Unable to write ${outputFile}: ${error.message}`);
}

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
