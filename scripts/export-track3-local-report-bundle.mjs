#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const outputDir = '.track3-runs';
const archiveRoot = 'track3-local-report-export';
const specFile = 'data/track3-local-report-export-manifest.v1.json';
const expectedNexusCommit = 'ab95cbbd24df5817c4e363d24b3b199ac8af6c6f';
const pinnedNexusSourcePath = '/Users/camilocarlone/Documents/Codex/2026-05-08/repository-orientation-gpt-handoff-analysis-only/nexus-mvp-pinned-ab95cbb';
const latestManifestPath = '.track3-runs/latest-track3-local-report-export-manifest.json';
const latestSummaryPath = '.track3-runs/latest-track3-local-report-export-summary.json';

const requiredCoreReports = [
  '.track3-runs/latest-nexus-import-adapter-local-report.json',
  '.track3-runs/latest-nexus-import-adapter-regression-suite-report.json',
  '.track3-runs/latest-nexus-import-adapter-failure-injection-suite-report.json'
];

const optionalEvidenceFiles = [
  '.track3-runs/latest-local-fixture-report.json',
  '.track3-runs/latest-local-fixture-suite-report.json',
  '.track3-runs/latest-nexus-import-environment-preflight.json',
  '.track3-runs/latest-nexus-adapter-normalizer-stub-report.json'
];

const validationCommands = [
  {
    id: 'nexus_import_adapter_reports',
    command: 'node',
    args: ['scripts/validate-nexus-import-adapter-reports.mjs']
  },
  {
    id: 'track3_contracts',
    command: 'node',
    args: ['scripts/validate-track3-contracts.mjs']
  }
];

function fail(message) {
  console.error(`Track 3 local report export failed: ${message}`);
  process.exit(1);
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
    signal: result.signal,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
}

function gitValue(args, cwd = repoRoot) {
  const result = runCommand('git', args, cwd);
  if (result.status !== 0) return null;
  return result.stdout;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  writeFileSync(path.join(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function sanitizeTimestamp(timestamp) {
  return timestamp.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function fileExists(relativePath) {
  return existsSync(path.join(repoRoot, relativePath));
}

function listOutputFiles() {
  const absolute = path.join(repoRoot, outputDir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute)
    .filter(name => statSync(path.join(absolute, name)).isFile())
    .map(name => `${outputDir}/${name}`)
    .sort();
}

function collectFailureInjectionReports() {
  return listOutputFiles()
    .filter(file => /^\.track3-runs\/nexus-import-adapter-failure-injection-\d{2}-.+\.json$/.test(file))
    .sort();
}

function collectAuditLogs() {
  return listOutputFiles()
    .filter(file => /^\.track3-runs\/nexus-import-adapter-audit-.+\.jsonl$/.test(file))
    .sort();
}

function archivePathFor(relativePath, category) {
  const name = relativePath.replace(/^\.track3-runs\//, '');
  return `${archiveRoot}/${category}/${name}`;
}

function addSourceEntry(entries, relativePath, category, required) {
  const absolute = path.join(repoRoot, relativePath);
  const content = readFileSync(absolute);
  entries.push({
    source_path: relativePath,
    archive_path: archivePathFor(relativePath, category),
    category,
    required,
    size_bytes: content.length,
    sha256: sha256(content),
    content
  });
}

function addGeneratedEntry(entries, archivePath, category, value) {
  const content = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  entries.push({
    source_path: null,
    archive_path: archivePath,
    category,
    required: true,
    size_bytes: content.length,
    sha256: sha256(content),
    content
  });
}

function collectEntries(validationSummary, pinnedSourceMetadata, boundarySummary) {
  const entries = [];

  requiredCoreReports.forEach(relativePath => {
    if (!fileExists(relativePath)) {
      fail(`required core report is missing: ${relativePath}`);
    }
    addSourceEntry(entries, relativePath, 'reports', true);
  });

  const failureReports = collectFailureInjectionReports();
  if (failureReports.length < 15) {
    fail(`expected at least 15 failure-injection detail reports, found ${failureReports.length}`);
  }
  failureReports.forEach(relativePath => addSourceEntry(entries, relativePath, 'failure-injection', true));

  optionalEvidenceFiles.forEach(relativePath => {
    if (fileExists(relativePath)) addSourceEntry(entries, relativePath, 'optional-evidence', false);
  });
  collectAuditLogs().forEach(relativePath => addSourceEntry(entries, relativePath, 'audit-output', false));

  addGeneratedEntry(
    entries,
    `${archiveRoot}/generated/track3-local-report-export-validation-summary.json`,
    'generated-validation-summary',
    validationSummary
  );
  addGeneratedEntry(
    entries,
    `${archiveRoot}/generated/track3-pinned-source-metadata.json`,
    'generated-pinned-source-metadata',
    pinnedSourceMetadata
  );
  addGeneratedEntry(
    entries,
    `${archiveRoot}/generated/track3-local-report-export-boundary-summary.json`,
    'generated-boundary-summary',
    boundarySummary
  );

  return entries.sort((a, b) => a.archive_path.localeCompare(b.archive_path));
}

function octal(value, length) {
  const text = value.toString(8);
  return `${text.padStart(length - 1, '0')}\0`;
}

function splitTarName(name) {
  if (Buffer.byteLength(name) <= 100) return { name, prefix: '' };

  const parts = name.split('/');
  for (let index = 1; index < parts.length; index += 1) {
    const prefix = parts.slice(0, index).join('/');
    const rest = parts.slice(index).join('/');
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(rest) <= 100) {
      return { name: rest, prefix };
    }
  }
  fail(`archive path is too long for ustar: ${name}`);
}

function tarHeader(entry) {
  const header = Buffer.alloc(512, 0);
  const split = splitTarName(entry.archive_path);
  header.write(split.name, 0, 100, 'utf8');
  header.write(octal(0o644, 8), 100, 8, 'ascii');
  header.write(octal(0, 8), 108, 8, 'ascii');
  header.write(octal(0, 8), 116, 8, 'ascii');
  header.write(octal(entry.content.length, 12), 124, 12, 'ascii');
  header.write(octal(0, 12), 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write('0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  header.write('track3', 265, 32, 'ascii');
  header.write('track3', 297, 32, 'ascii');
  if (split.prefix) header.write(split.prefix, 345, 155, 'utf8');

  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return header;
}

function buildTarGz(entries) {
  const chunks = [];
  entries.forEach(entry => {
    chunks.push(tarHeader(entry));
    chunks.push(entry.content);
    const padding = (512 - (entry.content.length % 512)) % 512;
    if (padding) chunks.push(Buffer.alloc(padding, 0));
  });
  chunks.push(Buffer.alloc(1024, 0));
  const gzipped = gzipSync(Buffer.concat(chunks), { level: 9 });
  gzipped[4] = 0;
  gzipped[5] = 0;
  gzipped[6] = 0;
  gzipped[7] = 0;
  gzipped[9] = 255;
  return gzipped;
}

mkdirSync(path.join(repoRoot, outputDir), { recursive: true });

const spec = readJson(specFile);
const generatedAt = new Date().toISOString();
const runId = sanitizeTimestamp(generatedAt);
const archivePath = `.track3-runs/track3-local-report-export-${runId}.tar.gz`;
const aetherusCommit = gitValue(['rev-parse', 'HEAD']);
const aetherusBranch = gitValue(['rev-parse', '--abbrev-ref', 'HEAD']);
const nexusHead = gitValue(['rev-parse', 'HEAD'], pinnedNexusSourcePath);
const nexusStatus = gitValue(['status', '--short'], pinnedNexusSourcePath);

if (!aetherusCommit) fail('unable to resolve AETHERUS commit');
if (nexusHead !== expectedNexusCommit) {
  fail(`pinned NEXUS commit mismatch: expected ${expectedNexusCommit}, found ${nexusHead || 'unknown'}`);
}
if (nexusStatus !== '') {
  fail('pinned NEXUS source working tree must be clean');
}

const validationResults = validationCommands.map(item => ({
  id: item.id,
  ...runCommand(item.command, item.args)
}));
const failedValidation = validationResults.find(item => item.status !== 0);
if (failedValidation) {
  fail(`validation command failed: ${failedValidation.command}`);
}

const validationSummary = {
  generated_at: generatedAt,
  validation_results: validationResults.map(item => ({
    id: item.id,
    command: item.command,
    status: item.status,
    result: item.status === 0 ? 'PASS' : 'FAIL',
    stdout: item.stdout,
    stderr: item.stderr
  }))
};

const pinnedSourceMetadata = {
  aetherus_commit: aetherusCommit,
  aetherus_branch: aetherusBranch,
  nexus_commit: nexusHead,
  nexus_expected_commit: expectedNexusCommit,
  nexus_source_path: pinnedNexusSourcePath,
  nexus_working_tree_clean: nexusStatus === '',
  export_spec_file: specFile,
  export_spec_version: spec.metadata && spec.metadata.version
};

const boundarySummary = {
  generated_reports_are_local_evidence_artifacts: true,
  export_archive_is_repository_source_of_truth: false,
  export_archive_is_production_ledger: false,
  export_archive_is_persistent_audit_infrastructure: false,
  export_archive_makes_public_runtime_claims_claimable: false,
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
  claim_escalation: false,
  conduit_fail_closed_behavior_is_palisade_work: false
};

const entries = collectEntries(validationSummary, pinnedSourceMetadata, boundarySummary);
const manifestPayloadFiles = entries.map(({ content, ...entry }) => entry);

const manifest = {
  metadata: {
    name: 'AETHERUS Track 3 Local Report Export Manifest',
    version: '1.0.0',
    track_phase: '3.23',
    generated_at: generatedAt,
    run_id: runId,
    archive_root: archiveRoot,
    export_spec_file: specFile
  },
  source: pinnedSourceMetadata,
  selection: {
    required_core_reports: requiredCoreReports,
    required_failure_injection_detail_minimum: 15,
    optional_evidence_files: optionalEvidenceFiles,
    included_file_count: manifestPayloadFiles.length
  },
  boundary_summary: boundarySummary,
  validation_summary: validationSummary.validation_results.map(item => ({
    id: item.id,
    command: item.command,
    result: item.result,
    status: item.status
  })),
  files: manifestPayloadFiles
};

const manifestContent = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
const archiveEntries = [
  ...entries,
  {
    source_path: latestManifestPath,
    archive_path: `${archiveRoot}/manifest/track3-local-report-export-manifest.json`,
    category: 'generated-manifest',
    required: true,
    size_bytes: manifestContent.length,
    sha256: sha256(manifestContent),
    content: manifestContent
  }
].sort((a, b) => a.archive_path.localeCompare(b.archive_path));

const archiveBuffer = buildTarGz(archiveEntries);
writeFileSync(path.join(repoRoot, archivePath), archiveBuffer);
writeJson(latestManifestPath, manifest);

const summary = {
  generated_at: generatedAt,
  run_id: runId,
  archive_path: archivePath,
  archive_size_bytes: archiveBuffer.length,
  archive_sha256: sha256(archiveBuffer),
  manifest_path: latestManifestPath,
  manifest_sha256: sha256(manifestContent),
  included_file_count: manifestPayloadFiles.length,
  validation_results: manifest.validation_summary,
  boundary_summary: boundarySummary
};
writeJson(latestSummaryPath, summary);

console.log('Track 3.23 local report export bundle');
console.log('');
console.log(`Archive: ${archivePath}`);
console.log(`Manifest: ${latestManifestPath}`);
console.log(`Summary: ${latestSummaryPath}`);
console.log(`Included files: ${manifestPayloadFiles.length}`);
console.log(`Archive SHA256: ${summary.archive_sha256}`);
console.log('');
console.log('Boundary: local evidence export only; no public runtime, backend, persistence, ledger, auth, database, Palisade, Weave, model execution, or live orchestration.');
console.log('');
console.log('Result: PASS');
