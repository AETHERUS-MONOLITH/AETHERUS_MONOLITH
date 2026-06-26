import fs from "node:fs";

const workspacePath = "workspace.html";
const workspaceScriptPath = "js/preview-workspace.js";
const workspaceRecordPath = "data/direct-ui-membrane-preview-workspace.v0.json";
const authBoundaryPath = "data/direct-ui-membrane-auth-backend-boundary.v0.json";
const docsJsonPath = "data/docs.json";

const requiredSurfaces = [
  "Access Boundary Membrane",
  "Workspace Control Surface",
  "Evidence / Artifact Review Surface",
  "Release Review Chamber",
  "Escalation Review Surface"
];

const requiredStatusPhrases = [
  "Unauthenticated preview workspace",
  "Interactive preview only",
  "Static evaluation mode",
  "Prototype evidence surface",
  "Operational evidence pending",
  "Not a production SaaS interface",
  "Not an operational release system"
];

const allowedControlLabels = [
  "Enter Preview Workspace",
  "Inspect Surface",
  "View Boundary",
  "Open Preview Panel",
  "Reset Preview",
  "Return to Static Membrane",
  "Preview Access Boundary",
  "Preview Workspace Control",
  "Preview Evidence Review",
  "Preview Release Review",
  "Preview Escalation Review"
];

const requiredControlLabels = [
  "Enter Preview Workspace",
  "Reset Preview",
  "Return to Static Membrane",
  "Preview Access Boundary",
  "Preview Workspace Control",
  "Preview Evidence Review",
  "Preview Release Review",
  "Preview Escalation Review"
];

const forbiddenOperationalLabels = [
  "Login",
  "Sign in",
  "Signup",
  "Create account",
  "Create Tenant",
  "Launch",
  "Run",
  "Execute",
  "Deploy",
  "Approve",
  "Approve Release",
  "Release Now",
  "Escalate Now",
  "Connect",
  "Sync",
  "Save",
  "Submit",
  "Open Dashboard",
  "Customer Dashboard",
  "Production Ready",
  "Compliance Certified"
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

function assertIncludesAll(actual, expected, label) {
  for (const value of expected) {
    if (!actual.includes(value)) fail(`${label}: missing ${value}`);
  }
}

for (const requiredFile of [workspacePath, workspaceScriptPath, workspaceRecordPath, authBoundaryPath]) {
  if (!fs.existsSync(requiredFile)) fail(`${requiredFile} is missing`);
}

const workspaceText = readText(workspacePath);
const workspaceScriptText = readText(workspaceScriptPath);
const workspaceRecord = readJson(workspaceRecordPath);
const authBoundary = readJson(authBoundaryPath);
const docsJsonText = readText(docsJsonPath);

if (workspaceRecord.schema_version !== "0.1") fail("workspace record schema_version must be 0.1");
if (
  workspaceRecord.generated_for_sub_pass !==
  "§1.2 Birth — Unauthenticated Interactive Preview Workspace 0.1"
) {
  fail("workspace record generated_for_sub_pass mismatch");
}
if (workspaceRecord.baseline_commit !== "a218be2c3e597809593040facc71dcf18fe6873f") {
  fail("workspace record baseline_commit mismatch");
}
if (workspaceRecord.object_status !== "unauthenticated_interactive_preview_workspace") {
  fail("workspace record object_status mismatch");
}
if (workspaceRecord.birth_condition_met !== true) fail("birth_condition_met must be true");
if (workspaceRecord.birth_condition_met_by !== "unauthenticated_interactive_surface") {
  fail("birth_condition_met_by mismatch");
}
for (const key of [
  "authenticated_shell_born",
  "backend_born",
  "persistence_born",
  "tenant_system_born"
]) {
  if (workspaceRecord[key] !== false) fail(`${key} must be false`);
}
assertIncludesAll(workspaceRecord.surfaces_represented || [], requiredSurfaces, "surfaces_represented");
assertIncludesAll(
  workspaceRecord.allowed_interactions || [],
  [
    "surface_selection",
    "preview_panel_switching",
    "boundary_inspection",
    "transient_in_memory_preview_state",
    "preview_reset"
  ],
  "allowed_interactions"
);
assertIncludesAll(
  workspaceRecord.forbidden_capabilities_absent || [],
  [
    "auth",
    "login",
    "signup",
    "account_creation",
    "forms",
    "backend",
    "database",
    "persistence",
    "local_storage",
    "session_storage",
    "cookies",
    "billing",
    "tenant_infrastructure",
    "palisade",
    "weave",
    "public_nexus_runtime",
    "model_api_calls",
    "operational_dashboard",
    "runtime_monitoring",
    "customer_data"
  ],
  "forbidden_capabilities_absent"
);

assertIncludesAll(workspaceText + workspaceScriptText, requiredSurfaces, "workspace surfaces");
assertIncludesAll(workspaceText, requiredStatusPhrases, "workspace page status language");
assertIncludesAll(
  workspaceText + workspaceScriptText + readText("membrane.html"),
  requiredControlLabels,
  "bounded control labels"
);
if (!workspaceText.includes('href="membrane.html"')) fail("workspace must link back to membrane.html");
if (!readText("membrane.html").includes('href="workspace.html"')) {
  fail("membrane.html must link to workspace.html");
}

for (const label of forbiddenOperationalLabels) {
  const pattern = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (pattern.test(workspaceText) || pattern.test(workspaceScriptText)) {
    fail(`forbidden operational label found: ${label}`);
  }
}

if (/<form\b/i.test(workspaceText)) fail("workspace.html must not contain forms");
if (/<(?:input|textarea|select)\b/i.test(workspaceText)) {
  fail("workspace.html must not contain input, textarea, or select controls");
}
if (/<input\b[^>]*type=["']?(?:password|email)["']?/i.test(workspaceText)) {
  fail("workspace.html must not contain password or email inputs");
}

for (const filePath of [
  workspacePath,
  workspaceScriptPath,
  "membrane.html",
  "data/direct-ui-membrane-static-shell.v0.json"
]) {
  const text = readText(filePath);
  for (const pattern of [
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bdocument\.cookie\b/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\/api\//
  ]) {
    if (pattern.test(text)) fail(`${filePath}: forbidden runtime or persistence string ${pattern}`);
  }
}

if (!/\blet selectedSurfaceId\b/.test(workspaceScriptText)) {
  fail("workspace script must keep selected preview state in memory");
}
if (!/\blet lastPreviewAction\b/.test(workspaceScriptText)) {
  fail("workspace script must keep last preview action in memory");
}

if (authBoundary.schema_version !== "0.1") fail("auth boundary schema_version must be 0.1");
if (
  authBoundary.generated_for_sub_pass !==
  "§1.2 Birth — Parallel Auth/Backend Boundary 0.1"
) {
  fail("auth boundary generated_for_sub_pass mismatch");
}
if (authBoundary.baseline_commit !== "a218be2c3e597809593040facc71dcf18fe6873f") {
  fail("auth boundary baseline_commit mismatch");
}
for (const [key, value] of Object.entries(authBoundary.implementation_status || {})) {
  if (value !== "not_implemented") fail(`auth boundary implementation_status.${key} must be not_implemented`);
}
for (const key of ["auth", "backend", "database", "persistence", "tenant_isolation", "billing"]) {
  if (authBoundary.implementation_status?.[key] !== "not_implemented") {
    fail(`auth boundary missing implementation_status.${key}`);
  }
}
if (authBoundary.must_not_rebuild_preview_later !== true) {
  fail("auth boundary must_not_rebuild_preview_later must be true");
}

for (const forbiddenRegistryRef of [
  "direct-ui-membrane-preview-workspace",
  "direct-ui-membrane-auth-backend-boundary",
  "validate-direct-ui-membrane-preview-workspace"
]) {
  if (docsJsonText.includes(forbiddenRegistryRef)) {
    fail(`${forbiddenRegistryRef} must not be promoted through data/docs.json`);
  }
}

for (const forbiddenPackageFile of [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock"
]) {
  if (fs.existsSync(forbiddenPackageFile)) {
    fail(`${forbiddenPackageFile} must not be introduced for the preview workspace`);
  }
}

console.log("direct ui membrane preview workspace ok (birth condition met by unauthenticated interaction)");
