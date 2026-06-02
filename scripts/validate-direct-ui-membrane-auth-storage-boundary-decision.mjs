import fs from "node:fs/promises";

const recordPath = "data/direct-ui-membrane-auth-storage-boundary-decision.v0.json";
const clientPath = "js/supabase-client.js";
const loginPath = "js/supabase-login-initiation.js";
const preconditionPath = "js/supabase-auth-precondition.js";
const callbackScriptPath = "js/supabase-auth-callback.js";
const protectedShellPath = "js/supabase-protected-shell.js";
const diagnosticsPath = "data/direct-ui-membrane-callback-exchange-diagnostics.v0.json";
const expectedBaseline = "997135813e79ff07e4bf2ba0432be361d513ae4a";

const allowedDecisionClassifications = [
  "auth_storage_not_permitted",
  "pkce_verifier_storage_permitted_only",
  "supabase_auth_session_storage_permitted_bounded",
  "auth_storage_requires_operator_decision",
  "auth_storage_requires_external_security_review"
];

const forbiddenEnvFiles = [
  ".env",
  ".env.local",
  ".env.production"
];

const forbiddenRuntimeValuePatterns = [
  { label: "Supabase project URL", pattern: /https:\/\/[A-Za-z0-9-]+\.supabase\.co/i },
  { label: "Supabase key-like value", pattern: /\bsb_(?:publishable|anon|secret|service)_[A-Za-z0-9_-]{8,}/i },
  { label: "JWT-like token", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { label: "OAuth token-like value", pattern: /\bgh[opsu]_[A-Za-z0-9_]{20,}/i }
];

const forbiddenRuntimeStoragePatterns = [
  { label: "manual localStorage manipulation", pattern: /localStorage\.(?:setItem|getItem|removeItem)/ },
  { label: "manual sessionStorage manipulation", pattern: /sessionStorage\.(?:setItem|getItem|removeItem)/ },
  { label: "cookie persistence", pattern: /document\.cookie/ },
  { label: "manual setSession shortcut", pattern: /\.auth\.setSession\(/ },
  { label: "implicit fragment token handling", pattern: /location\.hash|provider_token|access_token|refresh_token/ },
  { label: "sensitive auth logging", pattern: /console\.(?:log|debug|info|warn|error)\([^)]*(?:code|token|session|user|verifier)/is }
];

const hardFalseFlags = [
  "live_oauth_verification_performed",
  "runtime_auth_storage_change_implemented",
  "supabase_client_initialization_behavior_changed",
  "callback_session_recognition_verified",
  "protected_shell_admission_verified",
  "authenticated_surfaces_born"
];

const selectedDecisionFlags = [
  "not_application_data_persistence",
  "manual_storage_manipulation_permitted",
  "manual_token_handling_permitted",
  "service_role_or_secret_exposure_permitted",
  "runtime_public_config_value_commit_permitted"
];

function fail(message) {
  throw new Error(message);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

function assertIncludesAll(actual, expected, label) {
  for (const value of expected) {
    if (!actual.includes(value)) fail(`${label}: missing ${value}`);
  }
}

async function assertMissing(paths, label) {
  for (const filePath of paths) {
    if (await exists(filePath)) fail(`${label}: ${filePath} must not exist`);
  }
}

function assertNoForbiddenValues(filePath, text) {
  for (const { label, pattern } of forbiddenRuntimeValuePatterns) {
    if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
  }
}

function assertNoForbiddenRuntimeStorage(filePath, text) {
  for (const { label, pattern } of forbiddenRuntimeStoragePatterns) {
    if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
  }
}

function assertCurrentRuntimeStillUnchanged(clientText) {
  if (!clientText.includes('flowType: "pkce"')) fail(`${clientPath} must keep PKCE flow`);
  if (!clientText.includes("persistSession: false")) {
    fail(`${clientPath} must not enable persistSession in the decision pass`);
  }
  if (!clientText.includes("autoRefreshToken: false")) {
    fail(`${clientPath} must keep autoRefreshToken disabled in the decision pass`);
  }
  if (!clientText.includes("detectSessionInUrl: false")) {
    fail(`${clientPath} must keep detectSessionInUrl disabled in the decision pass`);
  }
  if (clientText.includes("storage:")) {
    fail(`${clientPath} must not add a storage adapter in the decision pass`);
  }
}

function assertAuthFlowContracts(loginText, preconditionText, callbackText, protectedShellText) {
  if (!/clientResult\.client\.auth\.signInWithOAuth\(\{/.test(loginText)) {
    fail(`${loginPath} must retain signInWithOAuth initiation`);
  }
  if (!/clientResult\.client\.auth\.exchangeCodeForSession\(code\)/.test(preconditionText)) {
    fail(`${preconditionPath} must retain exchangeCodeForSession(code)`);
  }
  if (!/clientResult\.client\.auth\.getSession\(\)/.test(preconditionText)) {
    fail(`${preconditionPath} must retain getSession guard classification`);
  }
  if (!callbackText.includes("session_present === true")) {
    fail(`${callbackScriptPath} must reveal shell entry only after session recognition`);
  }
  if (!protectedShellText.includes("guard_denied === false")) {
    fail(`${protectedShellPath} must admit only when the guard permits`);
  }
  if (!protectedShellText.includes("session_present === true")) {
    fail(`${protectedShellPath} must require session_present`);
  }
}

function assertDecisionRecord(record) {
  if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
  if (record.generated_for_sub_pass !== "§1.2 Supabase Auth Storage Boundary Decision 0.1") {
    fail("generated_for_sub_pass mismatch");
  }
  if (record.baseline_commit !== expectedBaseline) fail("baseline_commit mismatch");
  if (record.object_status !== "supabase_auth_storage_boundary_decision") {
    fail("object_status mismatch");
  }
  if (record.decision_pass_performed !== true) fail("decision_pass_performed must be true");
  if (!allowedDecisionClassifications.includes(record.decision_classification)) {
    fail("decision_classification is not an allowed classification");
  }
  if (record.decision_classification !== "supabase_auth_session_storage_permitted_bounded") {
    fail("this pass must classify bounded Supabase auth session storage");
  }

  for (const flag of hardFalseFlags) {
    if (record[flag] !== false) fail(`${recordPath}.${flag} must be false`);
  }

  const sourceContext = record.source_context_confirmed || {};
  for (const flag of [
    "local_checkout_clean_before_pass",
    "baseline_synchronized"
  ]) {
    if (sourceContext[flag] !== true) fail(`source_context_confirmed.${flag} must be true`);
  }
  for (const key of ["local_head", "origin_main", "expected_baseline"]) {
    if (sourceContext[key] !== expectedBaseline) fail(`source_context_confirmed.${key} mismatch`);
  }

  const runtimeBoundary = sourceContext.current_runtime_client_boundary || {};
  if (runtimeBoundary.flow_type !== "pkce") fail("current runtime flow_type must be pkce");
  if (runtimeBoundary.persist_session !== false) fail("current runtime persist_session must remain false");
  if (runtimeBoundary.auto_refresh_token !== false) {
    fail("current runtime auto_refresh_token must remain false");
  }
  if (runtimeBoundary.detect_session_in_url !== false) {
    fail("current runtime detect_session_in_url must remain false");
  }
  if (runtimeBoundary.custom_storage_adapter !== false) {
    fail("current runtime custom_storage_adapter must remain false");
  }

  assertIncludesAll(
    record.evidence_basis?.supabase_docs?.map((entry) => entry.url) || [],
    [
      "https://supabase.com/docs/guides/auth/sessions/pkce-flow",
      "https://supabase.com/docs/reference/javascript/auth-api",
      "https://supabase.com/docs/reference/javascript/auth-getsession"
    ],
    "evidence_basis.supabase_docs"
  );
  if (record.evidence_basis?.prior_diagnostics_record !== diagnosticsPath) {
    fail("prior diagnostics path mismatch");
  }

  const allowedBoundary = record.allowed_auth_storage_boundary || {};
  assertIncludesAll(
    allowedBoundary.purpose || [],
    [
      "PKCE code verifier continuity across provider redirect",
      "Supabase auth session recognition after exchangeCodeForSession(code)",
      "protected-shell session guard evaluation through Supabase auth APIs"
    ],
    "allowed_auth_storage_boundary.purpose"
  );
  if (allowedBoundary.scope !== "Supabase auth state only") fail("allowed scope mismatch");
  if (allowedBoundary.storage_owner !== "Supabase client/auth library") {
    fail("storage owner mismatch");
  }
  if (allowedBoundary.not_application_data_persistence !== true) {
    fail("allowed boundary must distinguish auth storage from application data persistence");
  }
  for (const flag of selectedDecisionFlags.slice(1)) {
    if (allowedBoundary[flag] !== false) {
      fail(`allowed_auth_storage_boundary.${flag} must be false`);
    }
  }

  const future = record.selected_future_runtime_candidate || {};
  if (future.persistSession !== true) fail("future candidate must permit persistSession true");
  if (future.autoRefreshToken !== false) {
    fail("future candidate must keep autoRefreshToken false");
  }
  if (future.detectSessionInUrl !== false) {
    fail("future candidate must keep detectSessionInUrl false");
  }
  if (future.storage !== "default_supabase_browser_storage") {
    fail("future candidate storage must be default Supabase browser storage");
  }
  if (future.custom_storage_adapter !== false) {
    fail("future candidate must not authorize a custom storage adapter");
  }

  assertIncludesAll(
    record.still_not_allowed || [],
    [
      "application data persistence",
      "database persistence",
      "customer data persistence",
      "tenant workspace persistence",
      "audit-ledger persistence",
      "backend state",
      "billing state",
      "manual localStorage manipulation",
      "manual sessionStorage manipulation",
      "Authenticated Surfaces birth claim"
    ],
    "still_not_allowed"
  );
  assertIncludesAll(
    record.not_claimable_after_this_pass || [],
    [
      "persistSession runtime behavior changed",
      "callback session recognition live verified",
      "protected shell admission live verified",
      "Authenticated Surfaces born",
      "application data persistence exists"
    ],
    "not_claimable_after_this_pass"
  );

  const next = record.next_threshold || {};
  if (
    next.name !==
    "§1.2 Supabase Auth Storage Implementation 0.1 — Bounded PKCE/Auth Session Continuity"
  ) {
    fail("next_threshold.name mismatch");
  }
  assertIncludesAll(
    next.must_not_implement || [],
    [
      "backend/server",
      "database schema",
      "application data persistence",
      "tenant isolation",
      "customer workspace",
      "billing",
      "Authenticated Surfaces birth claim"
    ],
    "next_threshold.must_not_implement"
  );
}

if (!(await exists(recordPath))) fail(`${recordPath} is missing`);
if (!(await exists(diagnosticsPath))) fail(`${diagnosticsPath} is missing`);

const record = await readJson(recordPath);
const clientText = await readText(clientPath);
const loginText = await readText(loginPath);
const preconditionText = await readText(preconditionPath);
const callbackText = await readText(callbackScriptPath);
const protectedShellText = await readText(protectedShellPath);

assertDecisionRecord(record);
assertCurrentRuntimeStillUnchanged(clientText);
assertAuthFlowContracts(loginText, preconditionText, callbackText, protectedShellText);

for (const filePath of [
  recordPath,
  clientPath,
  loginPath,
  preconditionPath,
  callbackScriptPath,
  protectedShellPath
]) {
  const text = await readText(filePath);
  assertNoForbiddenValues(filePath, text);
  if (filePath !== recordPath) assertNoForbiddenRuntimeStorage(filePath, text);
}

await assertMissing(forbiddenEnvFiles, "env file");

console.log("direct ui membrane Supabase auth storage boundary decision ok (bounded auth storage only)");
