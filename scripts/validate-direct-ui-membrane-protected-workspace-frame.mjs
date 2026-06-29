import fs from "node:fs";

const protectedShellPath = "protected-shell.html";
const previewWorkspacePath = "workspace.html";
const taaRoutePath = "the-apologetic-authority/index.html";
const recordPath = "data/direct-ui-membrane-protected-workspace-frame.v0.json";
const callbackScriptPath = "js/supabase-auth-callback.js";

const requiredProtectedShellPhrases = [
  "Protected workspace frame",
  "Protected workspace path",
  "AETHERUS Review Workspace",
  "Workspace Overview",
  "Evidence Packet",
  "Release Review",
  "Trace / Activity",
  "Settings / Members",
  "Stage candidate",
  "Run local review",
  "Save workspace state",
  "Load saved workspace state",
  "No evidence packet is loaded yet.",
  "No release candidate is queued.",
  "No persistent activity has been recorded.",
  "No members are configured in this frame.",
  "This frame can save and load bounded release-review workspace state"
];

const requiredNavigationTargets = [
  "#workspace-overview",
  "#evidence-packet",
  "#release-review",
  "#trace-activity",
  "#settings-members"
];

const protectedBoundaryPhrases = [
  "Protected workspace admission depends on recognized Supabase session state",
  "Denial without a session is expected guard behavior",
  "data-protected-shell-boundary",
  "js/supabase-protected-shell.js",
  "Authenticated save/load loop",
  "Session-scoped Supabase state",
  "Operational evidence pending",
  "Customer data outside scope",
  "Static evaluation mode",
  "Not a production SaaS interface",
  "Not an operational release system"
];

const forbiddenPositiveClaims = [
  /\bcustomer workspace (is )?(active|implemented|available|live|exists)\b/i,
  /\btenant isolation (is )?(active|implemented|available|live|exists)\b/i,
  /\bdatabase[- ]backed (persistence|workspace|storage) (is )?(active|implemented|available|live|exists)\b/i,
  /\bRLS (is )?(active|implemented|available|live|exists)\b/i,
  /\bbilling (is )?(active|implemented|available|live|exists)\b/i,
  /\bmonitoring (is )?(active|implemented|available|live|exists)\b/i,
  /\bproduction dashboard (is )?(active|implemented|available|live|exists)\b/i,
  /\bbackend runtime (is )?(active|implemented|available|live|exists)\b/i,
  /\boperational use (is )?(active|implemented|available|live|exists)\b/i,
  /\boperational workflow (is )?(active|implemented|available|live|exists)\b/i,
  /\bproduction audit ledger (is )?(active|implemented|available|live|exists)\b/i,
  /\bPalisade (is )?(active|implemented|available|live|exists)\b/i,
  /\bWeave (is )?(active|implemented|available|live|exists)\b/i,
  /\bpublic NEXUS runtime (is )?(active|implemented|available|live|exists)\b/i,
  /\bmodel API execution (is )?(active|implemented|available|live|exists)\b/i
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

if (!fs.existsSync(protectedShellPath)) fail(`${protectedShellPath} is missing`);
if (!fs.existsSync(previewWorkspacePath)) fail(`${previewWorkspacePath} is missing`);
if (!fs.existsSync(taaRoutePath)) fail(`${taaRoutePath} is missing`);
if (!fs.existsSync(recordPath)) fail(`${recordPath} is missing`);
if (!fs.existsSync(callbackScriptPath)) fail(`${callbackScriptPath} is missing`);

const protectedShell = readText(protectedShellPath);
const previewWorkspace = readText(previewWorkspacePath);
const taaRoute = readText(taaRoutePath);
const record = readJson(recordPath);
const callbackScript = readText(callbackScriptPath);

for (const phrase of requiredProtectedShellPhrases) {
  assertIncludes(protectedShell, phrase, protectedShellPath);
}

for (const phrase of protectedBoundaryPhrases) {
  assertIncludes(protectedShell, phrase, protectedShellPath);
}

for (const target of requiredNavigationTargets) {
  assertIncludes(protectedShell, `href="${target}"`, `${protectedShellPath} navigation`);
}

if (!previewWorkspace.includes("Interactive workspace preview")) {
  fail(`${previewWorkspacePath}: must remain the interactive workspace preview`);
}

for (const phrase of [
  "Workspace Overview",
  "Evidence Packet",
  "Release Review",
  "Trace / Activity",
  "Settings / Members"
]) {
  if (taaRoute.includes(phrase)) {
    fail(`${taaRoutePath}: workspace functionality must not be placed under the TAA route`);
  }
}

for (const pattern of forbiddenPositiveClaims) {
  if (pattern.test(protectedShell)) fail(`${protectedShellPath}: forbidden positive claim ${pattern}`);
}

if (record.schema_version !== "0.1") fail(`${recordPath}: schema_version must be 0.1`);
if (record.surface_file !== protectedShellPath) fail(`${recordPath}: surface_file mismatch`);
if (record.placement?.protected_workspace_frame !== protectedShellPath) {
  fail(`${recordPath}: protected workspace placement mismatch`);
}
if (record.placement?.unauthenticated_preview_workspace !== previewWorkspacePath) {
  fail(`${recordPath}: preview workspace placement mismatch`);
}
if (record.placement?.taa_route_workspace_functionality_added !== false) {
  fail(`${recordPath}: TAA route workspace functionality flag must be false`);
}

for (const flag of [
  "production_customer_workspace",
  "tenant_isolated",
  "operational_use_evidence",
  "monitoring_dashboard",
  "nexus_execution",
  "model_api_execution",
  "billing",
  "production_saas"
]) {
  if (record.non_claims?.[flag] !== false) fail(`${recordPath}: non_claims.${flag} must be false`);
}

if (record.non_claims?.database_backed !== true) {
  fail(`${recordPath}: database_backed must reflect bounded persistence wiring`);
}
if (record.non_claims?.rls_implemented !== true) {
  fail(`${recordPath}: rls_implemented must reflect externally applied live substrate`);
}

if (!protectedShell.includes('js/protected-workspace.js')) {
  fail(`${protectedShellPath}: missing protected workspace interaction script`);
}

if (record.guard_boundary?.protected_shell_guard_preserved !== true) {
  fail(`${recordPath}: protected shell guard must be preserved`);
}
if (record.guard_boundary?.denial_without_session_preserved !== true) {
  fail(`${recordPath}: denial without session must be preserved`);
}
if (record.guard_boundary?.auth_script_changed !== true) {
  fail(`${recordPath}: auth script change flag must reflect callback route visibility fix`);
}
if (record.guard_boundary?.auth_script_change_scope !== "callback_success_auto_enters_protected_shell") {
  fail(`${recordPath}: auth script change scope mismatch`);
}
if (record.guard_boundary?.auth_script_changed_file !== callbackScriptPath) {
  fail(`${recordPath}: auth script changed file mismatch`);
}
if (record.guard_boundary?.callback_success_auto_entry_target !== protectedShellPath) {
  fail(`${recordPath}: callback auto-entry target mismatch`);
}
if (!callbackScript.includes('new URL("protected-shell.html", globalThis.location.href)')) {
  fail(`${callbackScriptPath}: callback success must resolve protected-shell.html`);
}
if (!callbackScript.includes("globalThis.location.assign")) {
  fail(`${callbackScriptPath}: callback success must enter the protected shell route`);
}
if (record.guard_boundary?.supabase_infrastructure_changed !== true) {
  fail(`${recordPath}: Supabase infrastructure change flag must be true`);
}

console.log("direct ui membrane protected workspace frame ok");
