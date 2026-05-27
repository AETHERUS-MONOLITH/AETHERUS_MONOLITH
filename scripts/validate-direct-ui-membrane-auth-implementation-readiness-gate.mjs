import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);

const readinessPath = "data/direct-ui-membrane-auth-implementation-readiness-gate.v0.json";
const authBackendPath = "data/direct-ui-membrane-auth-backend-boundary.v0.json";
const routeBoundaryPath = "data/direct-ui-membrane-auth-route-boundary.v0.json";
const previewWorkspacePath = "data/direct-ui-membrane-preview-workspace.v0.json";
const docsJsonPath = "data/docs.json";
const readmePath = "README.md";

const expectedCurrentRoutes = {
  public_entry: "index.html",
  direct_ui_membrane_static_preview: "membrane.html",
  unauthenticated_preview_workspace: "workspace.html",
  reserved_auth_boundary: "auth-boundary.html"
};

const falseCapabilityFlags = [
  "auth_implemented",
  "login_ui_implemented",
  "signup_ui_implemented",
  "backend_implemented",
  "database_implemented",
  "persistence_implemented",
  "tenant_isolation_implemented",
  "billing_implemented",
  "customer_workspace_implemented"
];

const requiredNoPersistData = [
  "user credentials",
  "email addresses",
  "tenant identifiers",
  "customer workspace content",
  "review actions",
  "release decisions",
  "escalation notes"
];

const activeSiteFiles = [
  "index.html",
  "membrane.html",
  "workspace.html",
  "auth-boundary.html",
  "js/preview-workspace.js"
];

const forbiddenIntegrationPatterns = [
  { label: "fetch", pattern: /\bfetch\s*\(/ },
  { label: "XML" + "HttpRequest", pattern: new RegExp("\\bXML" + "HttpRequest\\b") },
  { label: "api route", pattern: /\/api\// },
  { label: "local" + "Storage", pattern: new RegExp("\\blocal" + "Storage\\b") },
  { label: "session" + "Storage", pattern: new RegExp("\\bsession" + "Storage\\b") },
  { label: "document" + ".cookie", pattern: new RegExp("\\bdocument\\.cookie\\b") }
];

const packageOrSecretFiles = [
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".env"
];

function fail(message) {
  throw new Error(message);
}

async function fileExists(filePath) {
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

function assertFalseBooleans(record, keys, label) {
  for (const key of keys) {
    if (record[key] !== false) fail(`${label}.${key} must be false`);
  }
}

function htmlHasCredentialInput(text) {
  return /<input\b[^>]*(type|name|id|placeholder)=["'][^"']*(email|password|credential)["']/i.test(text);
}

function htmlHasForm(text) {
  return /<form\b/i.test(text);
}

function htmlHasActiveAuthControl(text) {
  const activeControlPattern =
    /<(?:button|a)\b[^>]*>\s*(?:login|sign in|signup|register|create account|submit|save)\s*</i;
  return activeControlPattern.test(text);
}

if (!(await fileExists(readinessPath))) fail(`${readinessPath} is missing`);

const readiness = await readJson(readinessPath);
const authBackend = await readJson(authBackendPath);
const routeBoundary = await readJson(routeBoundaryPath);
const previewWorkspace = await readJson(previewWorkspacePath);
const docsJsonText = await readText(docsJsonPath);
const readmeText = await readText(readmePath);

if (readiness.schema_version !== "0.1") fail("readiness gate schema_version must be 0.1");
if (
  readiness.generated_for_sub_pass !==
  "§1.2 Authenticated Shell Architecture 0.2 — Auth Implementation Readiness Gate"
) {
  fail("readiness gate generated_for_sub_pass mismatch");
}
if (readiness.baseline_commit !== "60cd7044000d82ed33a1dda9ae6131a9db4847e4") {
  fail("readiness gate baseline_commit mismatch");
}
if (readiness.object_status !== "auth_implementation_readiness_gate") {
  fail("readiness gate object_status mismatch");
}
if (readiness.readiness_verdict !== "backend_first_required_before_auth_ui") {
  fail("readiness gate readiness_verdict must be backend_first_required_before_auth_ui");
}
assertFalseBooleans(readiness, falseCapabilityFlags, "readiness gate");

for (const [key, expected] of Object.entries(expectedCurrentRoutes)) {
  if (readiness.current_routes?.[key] !== expected) {
    fail(`current_routes.${key} must be ${expected}`);
  }
}

const futureRoutes = readiness.future_authenticated_routes || {};
assertIncludesAll(
  Object.values(futureRoutes),
  ["/app", "/app/workspace", "/app/settings", "/app/billing", "/app/admin"],
  "future authenticated routes"
);
for (const route of Object.values(futureRoutes)) {
  if (!route.startsWith("/app")) fail(`future route must remain under /app: ${route}`);
  const fileCandidate = `${route.replace(/^\//, "")}.html`;
  const indexCandidate = path.join(route.replace(/^\//, ""), "index.html");
  if ((await fileExists(fileCandidate)) || (await fileExists(indexCandidate))) {
    fail(`future route appears to have an active static file: ${route}`);
  }
}

if (readiness.selected_or_recommended_path?.primary !== "backend_first_required_before_auth_ui") {
  fail("selected_or_recommended_path.primary mismatch");
}
if (
  readiness.selected_or_recommended_path?.secondary_candidate !==
  "supabase_candidate_selected_for_next_evaluation"
) {
  fail("secondary auth candidate should remain Supabase evaluation only");
}
assertIncludesAll(
  readiness.selected_or_recommended_path?.rejected_for_now || [],
  [
    "static_fake_login",
    "custom_auth_without_security_review",
    "client_only_auth",
    "credential_capture_without_backend"
  ],
  "rejected auth paths"
);

assertIncludesAll(
  readiness.minimum_backend_boundary_before_real_login || [],
  [
    "server-side auth session verification",
    "server-side authorization boundary",
    "environment variable strategy",
    "no secrets in static client",
    "protected route enforcement",
    "audit event contract for auth events"
  ],
  "minimum backend boundary"
);
assertIncludesAll(
  readiness.minimum_database_boundary_before_persistence || [],
  [
    "Postgres or equivalent managed database decision",
    "RLS discipline before tenant data",
    "tenant_id scoping model",
    "migration strategy"
  ],
  "minimum database boundary"
);
assertIncludesAll(
  readiness.data_that_must_not_persist_yet || [],
  requiredNoPersistData,
  "data_that_must_not_persist_yet"
);
assertIncludesAll(
  readiness.validator_guardrails_required || [],
  [
    "no login or signup form before backend boundary exists",
    "no credential fields before auth provider and backend are selected",
    "no local_storage or session_storage persistence",
    "no API calls without backend contract"
  ],
  "validator_guardrails_required"
);

const nextCommit = readiness.smallest_truthful_next_commit || {};
if (!nextCommit.name || !nextCommit.purpose) {
  fail("smallest_truthful_next_commit must include name and purpose");
}
assertIncludesAll(
  nextCommit.must_not_implement || [],
  ["real login", "credential capture", "database persistence", "tenant isolation"],
  "smallest_truthful_next_commit.must_not_implement"
);

for (const filePath of activeSiteFiles) {
  if (!(await fileExists(filePath))) fail(`${filePath} is missing`);
  const text = await readText(filePath);
  if (htmlHasForm(text)) fail(`${filePath} must not contain forms`);
  if (htmlHasCredentialInput(text)) fail(`${filePath} must not contain credential inputs`);
  if (htmlHasActiveAuthControl(text)) fail(`${filePath} must not contain active auth controls`);
  for (const { label, pattern } of forbiddenIntegrationPatterns) {
    if (pattern.test(text)) fail(`${filePath} must not contain ${label}`);
  }
}

for (const filePath of packageOrSecretFiles) {
  if (await fileExists(filePath)) fail(`${filePath} must not be introduced for this pass`);
}

if (docsJsonText.includes("direct-ui-membrane-auth-implementation-readiness-gate")) {
  fail("auth readiness gate must not be promoted through data/docs.json");
}
if (docsJsonText.includes("validate-direct-ui-membrane-auth-implementation-readiness-gate")) {
  fail("auth readiness validator must not be promoted through data/docs.json");
}
if (readmeText.includes("auth implementation readiness gate exists")) {
  fail("README must not be updated to promote the auth readiness gate");
}

for (const [key, value] of Object.entries(authBackend.implementation_status || {})) {
  if (value !== "not_implemented") fail(`auth backend implementation_status.${key} must remain not_implemented`);
}
const readinessAwareness = authBackend.auth_implementation_readiness_gate || {};
if (readinessAwareness.path !== readinessPath) {
  fail("auth backend boundary must reference readiness gate path");
}
if (readinessAwareness.readiness_verdict !== readiness.readiness_verdict) {
  fail("auth backend boundary readiness verdict mismatch");
}
for (const key of [
  "auth_remains_not_implemented",
  "backend_remains_not_implemented",
  "database_remains_not_implemented",
  "persistence_remains_not_implemented",
  "tenant_isolation_remains_not_implemented",
  "next_stack_decision_required_before_login_ui"
]) {
  if (readinessAwareness[key] !== true) fail(`auth backend readiness awareness.${key} must be true`);
}

if (routeBoundary.auth_implemented !== false || routeBoundary.authenticated_shell_born !== false) {
  fail("auth route boundary must remain reserved and unauthenticated");
}
if (previewWorkspace.birth_condition_met_by !== "unauthenticated_interactive_surface") {
  fail("preview workspace must remain unauthenticated interactive surface only");
}
if (!previewWorkspace.allowed_interactions?.includes("transient_in_memory_preview_state")) {
  fail("preview workspace must remain in-memory only");
}

await runFile("node", ["scripts/validate-direct-ui-membrane-auth-route-boundary.mjs"], {
  stdio: "inherit"
});
await runFile("node", ["scripts/validate-direct-ui-membrane-preview-workspace.mjs"], {
  stdio: "inherit"
});

console.log("direct ui membrane auth implementation readiness gate ok (auth not implemented)");
