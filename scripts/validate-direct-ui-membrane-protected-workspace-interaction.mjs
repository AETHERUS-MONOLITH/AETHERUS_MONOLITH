import fs from "node:fs";

const protectedShellPath = "protected-shell.html";
const scriptPath = "js/protected-workspace.js";
const previewWorkspacePath = "workspace.html";
const taaRoutePath = "the-apologetic-authority/index.html";
const recordPath = "data/direct-ui-membrane-protected-workspace-interaction.v0.json";

const requiredShellPhrases = [
  "Stage candidate",
  "Run local review",
  "local release candidate",
  "sample release candidate",
  "Review blocked",
  "Incomplete operational evidence",
  "Operational evidence packet missing",
  "Release authority unavailable",
  "Operational evidence pending",
  "tenant and customer context outside this frame",
  "Save workspace state",
  "Load saved workspace state",
  "no external release action is performed",
  "Evidence Packet",
  "Release Review",
  "Trace / Activity"
];

const requiredScriptPhrases = [
  "localReleaseCandidate",
  "reviewState",
  "addEventListener",
  "stageLocalCandidate",
  "runLocalReview",
  "Evidence Packet populated from local candidate state.",
  "Review blocked: incomplete operational evidence.",
  "Release authority unavailable; no external release action performed."
];

const forbiddenRuntimePatterns = [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bdocument\.cookie\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bnavigator\.serviceWorker\b/,
  /\bsupabase\.rpc\b/,
  /\bsupabase\.functions\b/,
  /\bcreateClient\s*\(/,
  /\/api\//
];

const forbiddenPositiveClaimPatterns = [
  /\bcustomer workspace (is )?(active|implemented|available|live|exists)\b/i,
  /\btenant isolation (is )?(active|implemented|available|live|exists)\b/i,
  /\bdatabase[- ]backed (persistence|workspace|storage) (is )?(active|implemented|available|live|exists)\b/i,
  /\bRLS (is )?(active|implemented|available|live|exists)\b/i,
  /\bbilling (is )?(active|implemented|available|live|exists)\b/i,
  /\bmonitoring (is )?(active|implemented|available|live|exists)\b/i,
  /\bbackend runtime (is )?(active|implemented|available|live|exists)\b/i,
  /\bproduction dashboard (is )?(active|implemented|available|live|exists)\b/i,
  /\boperational use (is )?(active|implemented|available|live|exists)\b/i,
  /\bpublic NEXUS runtime (is )?(active|implemented|available|live|exists)\b/i,
  /\bmodel API execution (is )?(active|implemented|available|live|exists)\b/i,
  /\breal release authority (is )?(active|implemented|available|live|exists)\b/i,
  /\brelease approved\b/i,
  /\bapproved for release\b/i,
  /\bdeployment approved\b/i,
  /\bcompliance enforced\b/i,
  /\bDOI minted\b/i,
  /\barchive deposited\b/i,
  /\bSearch Console submitted\b/i,
  /\bLinkedIn published\b/i,
  /\bLessWrong published\b/i,
  /\barXiv submitted\b/i
];

function fail(message) {
  throw new Error(message);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function assertIncludes(text, value, label) {
  if (!text.includes(value)) fail(`${label}: missing ${value}`);
}

for (const filePath of [protectedShellPath, scriptPath, previewWorkspacePath, taaRoutePath, recordPath]) {
  if (!fs.existsSync(filePath)) fail(`${filePath} is missing`);
}

const protectedShell = readText(protectedShellPath);
const script = readText(scriptPath);
const previewWorkspace = readText(previewWorkspacePath);
const taaRoute = readText(taaRoutePath);
const record = readJson(recordPath);

for (const phrase of requiredShellPhrases) {
  assertIncludes(protectedShell, phrase, protectedShellPath);
}

for (const phrase of requiredScriptPhrases) {
  assertIncludes(script, phrase, scriptPath);
}

if (!protectedShell.includes(`data-action="stage-local-candidate"`)) {
  fail(`${protectedShellPath}: missing local candidate staging control`);
}
if (!protectedShell.includes(`data-action="run-local-review"`)) {
  fail(`${protectedShellPath}: missing local review control`);
}
if (!protectedShell.includes(`src="${scriptPath}"`)) {
  fail(`${protectedShellPath}: missing protected workspace script include`);
}

for (const [filePath, text] of [
  [protectedShellPath, protectedShell],
  [scriptPath, script]
]) {
  for (const pattern of forbiddenRuntimePatterns) {
    if (pattern.test(text)) fail(`${filePath}: forbidden runtime/state/network pattern ${pattern}`);
  }
  for (const pattern of forbiddenPositiveClaimPatterns) {
    if (pattern.test(text)) fail(`${filePath}: forbidden positive claim ${pattern}`);
  }
}

if (!previewWorkspace.includes("Unauthenticated preview workspace")) {
  fail(`${previewWorkspacePath}: must remain the unauthenticated preview workspace`);
}
for (const phrase of ["Release Review", "Run local review", "local release candidate", "Review blocked"]) {
  if (previewWorkspace.includes(phrase)) {
    fail(`${previewWorkspacePath}: protected interaction must not be added to preview workspace`);
  }
  if (taaRoute.includes(phrase)) {
    fail(`${taaRoutePath}: protected interaction must not be added to TAA route`);
  }
}

if (record.schema_version !== "0.1") fail(`${recordPath}: schema_version must be 0.1`);
if (record.surface_file !== protectedShellPath) fail(`${recordPath}: surface_file mismatch`);
if (record.script_file !== scriptPath) fail(`${recordPath}: script_file mismatch`);
for (const flag of [
  "browser_side",
  "in_memory_interaction_preserved"
]) {
  if (record.state_boundary?.[flag] !== true) fail(`${recordPath}: state_boundary.${flag} must be true`);
}
if (record.state_boundary?.in_memory_only !== false) {
  fail(`${recordPath}: state_boundary.in_memory_only must be false after persistence wiring`);
}
for (const flag of [
  "local_storage_used",
  "session_storage_used",
  "cookies_used",
  "api_calls_used",
  "service_worker_used"
]) {
  if (record.state_boundary?.[flag] !== false) fail(`${recordPath}: state_boundary.${flag} must be false`);
}
for (const flag of [
  "network_calls_used",
  "supabase_writes_used",
  "database_calls_used"
]) {
  if (record.state_boundary?.[flag] !== true) fail(`${recordPath}: state_boundary.${flag} must be true`);
}
for (const flag of [
  "backend",
  "persistence",
  "tenant_isolation",
  "rls",
  "billing",
  "monitoring",
  "production_release_authority",
  "public_nexus_runtime",
  "model_api_execution",
  "operational_use",
  "doi_archive_search_publication_distribution"
]) {
  if (record.non_claims?.[flag] !== false) fail(`${recordPath}: non_claims.${flag} must be false`);
}
if (record.guard_boundary?.protected_shell_guard_preserved !== true) {
  fail(`${recordPath}: protected shell guard must be preserved`);
}
if (record.guard_boundary?.auth_script_changed !== false) {
  fail(`${recordPath}: auth script change flag must be false`);
}
if (record.guard_boundary?.provider_loop_changed !== false) {
  fail(`${recordPath}: provider loop change flag must be false`);
}
if (record.guard_boundary?.supabase_infrastructure_changed !== true) {
  fail(`${recordPath}: Supabase infrastructure change flag must be true`);
}

console.log("direct ui membrane protected workspace interaction ok");
