import fs from "node:fs";

const protectedShellPath = "protected-shell.html";
const scriptPath = "js/protected-workspace.js";
const functionPath = "supabase/functions/live-governed-evaluation-v0/index.ts";
const libraryPath = "supabase/functions/live-governed-evaluation-v0/lib.mjs";
const migrationPath = "supabase/migrations/20260917073248_live_governed_evaluation_v0.sql";
const previewWorkspacePath = "workspace.html";
const taaRoutePath = "the-apologetic-authority/index.html";
const recordPath = "data/direct-ui-membrane-protected-workspace-interaction.v0.json";

const requiredShellPhrases = [
  "Live governed evaluation",
  "Active Intelligence",
  "Stage input",
  "Run governed evaluation",
  "Load deterministic fixture",
  "Run fixture review",
  "Object details",
  "Inspect evidence",
  "Decision → Result",
  "No external release action"
];

const requiredScriptPhrases = [
  "LIVE_RUN_TYPE",
  "LIVE_FUNCTION_NAME",
  "INTELLIGENCE_LABELS",
  "stageLiveEvaluation",
  "runLiveEvaluation",
  "stageLocalCandidate",
  "runLocalReview",
  "functions.invoke",
  "data_classification: \"non_sensitive\"",
  "external_processing_consent: true",
  "live_governed_evaluation_runs",
  "input_not_duplicated_in_workspace_snapshot: true"
];

const requiredFunctionPhrases = [
  "auth.getUser()",
  "workspace_memberships",
  "OPENAI_API_KEY",
  "https://api.openai.com/v1/responses",
  "AETHERUS_NEXUS_EXECUTION_URL",
  "live_governed_evaluation_runs",
  "live_governed_evaluation_events",
  "failClosed",
  "external_release_action_performed: false"
];

const forbiddenBrowserPatterns = [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bdocument\.cookie\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bnavigator\.serviceWorker\b/,
  /\bsupabase\.rpc\b/,
  /\bcreateClient\s*\(/,
  /OPENAI_API_KEY/,
  /AETHERUS_NEXUS_EXECUTION_TOKEN/
];

const forbiddenPositiveClaims = [
  /production audit ledger (is )?(active|implemented|available|live)/i,
  /compliance certification (is )?(active|implemented|available|live)/i,
  /external release authority (is )?(active|implemented|available|live)/i,
  /autonomous multi-agent/i,
  /release approved/i,
  /approved for release/i
];

function fail(message) { throw new Error(message); }
function readText(filePath) { return fs.readFileSync(filePath, "utf8"); }
function assertIncludes(value, phrase, label) {
  if (!value.includes(phrase)) fail(label + ": missing " + phrase);
}

for (const filePath of [
  protectedShellPath, scriptPath, functionPath, libraryPath, migrationPath,
  previewWorkspacePath, taaRoutePath, recordPath
]) {
  if (!fs.existsSync(filePath)) fail(filePath + " is missing");
}

const shell = readText(protectedShellPath);
const script = readText(scriptPath);
const edgeFunction = readText(functionPath);
const library = readText(libraryPath);
const migration = readText(migrationPath);
const preview = readText(previewWorkspacePath);
const taa = readText(taaRoutePath);
const record = JSON.parse(readText(recordPath));

for (const phrase of requiredShellPhrases) assertIncludes(shell, phrase, protectedShellPath);
for (const phrase of requiredScriptPhrases) assertIncludes(script, phrase, scriptPath);
for (const phrase of requiredFunctionPhrases) assertIncludes(edgeFunction, phrase, functionPath);

for (const intelligence of ["communicator", "mediator", "drafter", "refiner", "origin"]) {
  assertIncludes(shell, "value=\"" + intelligence + "\"", protectedShellPath);
  assertIncludes(library, intelligence + ": Object.freeze", libraryPath);
}

for (const hook of [
  "data-action=\"stage-live-evaluation\"",
  "data-action=\"run-live-evaluation\"",
  "data-action=\"stage-local-candidate\"",
  "data-action=\"run-local-review\""
]) {
  assertIncludes(shell, hook, protectedShellPath);
}

for (const pattern of forbiddenBrowserPatterns) {
  if (pattern.test(script)) fail(scriptPath + ": forbidden browser-side secret/state/network pattern " + pattern);
}
for (const pair of [[protectedShellPath, shell], [scriptPath, script]]) {
  for (const pattern of forbiddenPositiveClaims) {
    if (pattern.test(pair[1])) fail(pair[0] + ": forbidden positive claim " + pattern);
  }
}

for (const phrase of ["Run governed evaluation", "data-live-evaluation-input", "live-governed-evaluation-v0"]) {
  if (preview.includes(phrase)) fail(previewWorkspacePath + ": live protected interaction leaked into preview workspace");
  if (taa.includes(phrase)) fail(taaRoutePath + ": live protected interaction leaked into TAA route");
}

for (const table of ["live_governed_evaluation_runs", "live_governed_evaluation_events"]) {
  assertIncludes(migration, "create table public." + table, migrationPath);
  assertIncludes(migration, "alter table public." + table + " enable row level security", migrationPath);
}
assertIncludes(migration, "auth.uid()", migrationPath);
assertIncludes(migration, "reject_live_governed_evaluation_event_mutation", migrationPath);

if (record.schema_version !== "0.2") fail(recordPath + ": schema_version must be 0.2");
if (record.live_run?.run_type !== "live_governed_evaluation_v0") fail(recordPath + ": live run type mismatch");
if (record.live_run?.one_intelligence_per_run !== true) fail(recordPath + ": one intelligence per run must be true");
if (record.live_run?.five_independent_intelligence_contracts?.length !== 5) fail(recordPath + ": five Intelligence contracts required");
for (const flag of [
  "authenticated_user_workspace_binding",
  "server_side_model_execution",
  "persistent_run_identity",
  "persistent_events_and_result"
]) {
  if (record.live_run?.[flag] !== true) fail(recordPath + ": live_run." + flag + " must be true");
}
for (const flag of [
  "production_audit_ledger",
  "compliance_certification",
  "external_release_authority",
  "generalized_orchestration",
  "autonomous_multi_agent_runtime",
  "operational_observability_maturity"
]) {
  if (record.non_claims?.[flag] !== false) fail(recordPath + ": non_claims." + flag + " must be false");
}
if (record.fixture_path?.distinguishable_from_live_run !== true) fail(recordPath + ": fixture must remain distinguishable");
if (record.guard_boundary?.protected_shell_guard_preserved !== true) fail(recordPath + ": protected shell guard must be preserved");
if (record.guard_boundary?.auth_script_changed !== false) fail(recordPath + ": auth script change flag must be false");
if (record.guard_boundary?.provider_loop_changed !== false) fail(recordPath + ": provider loop change flag must be false");

console.log("direct ui membrane protected workspace interaction ok");
