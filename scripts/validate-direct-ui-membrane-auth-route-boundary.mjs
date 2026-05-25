import { execFileSync } from "node:child_process";
import fs from "node:fs";

const pagePath = "auth-boundary.html";
const routeRecordPath = "data/direct-ui-membrane-auth-route-boundary.v0.json";
const authBackendPath = "data/direct-ui-membrane-auth-backend-boundary.v0.json";
const previewRecordPath = "data/direct-ui-membrane-preview-workspace.v0.json";
const docsJsonPath = "data/docs.json";
const readmePath = "README.md";

const requiredStatusPhrases = [
  "Authenticated shell boundary",
  "Reserved route — not active authentication",
  "No login implementation",
  "No signup implementation",
  "No backend",
  "No database",
  "No persistence",
  "No tenant isolation",
  "No customer workspace",
  "No public NEXUS runtime"
];

const allowedStaticLabels = [
  "Reserved Boundary",
  "Auth Boundary",
  "Future Authenticated Shell",
  "Route Placeholder",
  "Implementation Boundary",
  "Not Active",
  "Requires Separate Authorization",
  "Return to Preview Workspace",
  "View Preview Workspace"
];

const forbiddenActiveLabels = [
  "Login",
  "Sign in",
  "Signup",
  "Register",
  "Create account",
  "Email",
  "Password",
  "Submit",
  "Save",
  "Create Tenant",
  "Open Dashboard",
  "Customer Dashboard",
  "Launch",
  "Run",
  "Execute",
  "Deploy",
  "Approve",
  "Release Now",
  "Escalate Now",
  "Production Ready",
  "Compliance Certified",
  "Live Monitoring",
  "Connect",
  "Sync"
];

const negatedBoundaryPhrases = [
  "No login implementation",
  "No signup implementation",
  "not active authentication",
  "not active",
  "not yet born",
  "not implemented",
  "reserved"
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

function normalizedHtmlText(text) {
  return text.replace(/&mdash;/g, "—").replace(/\s+/g, " ");
}

function assertFalseBooleans(record, keys, label) {
  for (const key of keys) {
    if (record[key] !== false) fail(`${label}.${key} must be false`);
  }
}

function textNear(text, matchIndex) {
  return text.slice(Math.max(0, matchIndex - 90), Math.min(text.length, matchIndex + 140));
}

if (!fs.existsSync(pagePath)) fail(`${pagePath} is missing`);
if (!fs.existsSync(routeRecordPath)) fail(`${routeRecordPath} is missing`);

const pageText = readText(pagePath);
const normalizedPage = normalizedHtmlText(pageText);
const routeRecord = readJson(routeRecordPath);
const authBackend = readJson(authBackendPath);
const previewRecord = readJson(previewRecordPath);
const docsJsonText = readText(docsJsonPath);
const readmeText = readText(readmePath);

if (routeRecord.schema_version !== "0.1") fail("auth route record schema_version must be 0.1");
if (
  routeRecord.generated_for_sub_pass !==
  "§1.2 Authenticated Shell Architecture 0.1 — Route/Auth Boundary Skeleton"
) {
  fail("auth route record generated_for_sub_pass mismatch");
}
if (routeRecord.baseline_commit !== "1891b2a818a0b9bc438886758104e913c311cfb7") {
  fail("auth route record baseline_commit mismatch");
}
if (routeRecord.object_status !== "auth_route_boundary_skeleton") {
  fail("auth route record object_status mismatch");
}
assertFalseBooleans(
  routeRecord,
  [
    "authenticated_shell_born",
    "auth_implemented",
    "backend_implemented",
    "database_implemented",
    "persistence_implemented",
    "tenant_isolation_implemented",
    "billing_implemented",
    "customer_workspace_implemented"
  ],
  "auth route record"
);

const routeBoundary = routeRecord.route_boundary || {};
for (const [key, expected] of Object.entries({
  public_entry: "index.html",
  direct_ui_membrane_static_preview: "membrane.html",
  unauthenticated_preview_workspace: "workspace.html",
  reserved_authenticated_boundary: "auth-boundary.html"
})) {
  if (routeBoundary[key] !== expected) fail(`route_boundary.${key} must be ${expected}`);
}

assertIncludesAll(normalizedPage, requiredStatusPhrases, "auth-boundary.html status language");
assertIncludesAll(
  normalizedPage,
  [
    "Reserved Boundary",
    "Auth Boundary",
    "Future Authenticated Shell",
    "Route Placeholder",
    "Implementation Boundary",
    "Not Active",
    "Requires Separate Authorization",
    "Return to Preview Workspace"
  ],
  "auth-boundary.html static labels"
);

if (/<form\b/i.test(pageText)) fail("auth-boundary.html must not contain forms");
if (/<(?:input|textarea|select)\b/i.test(pageText)) {
  fail("auth-boundary.html must not contain input, textarea, or select controls");
}
if (/<button\b/i.test(pageText)) fail("auth-boundary.html must not contain button controls");

for (const label of forbiddenActiveLabels) {
  const pattern = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  for (const match of normalizedPage.matchAll(pattern)) {
    const context = textNear(normalizedPage, match.index || 0);
    if (!negatedBoundaryPhrases.some((phrase) => context.toLowerCase().includes(phrase.toLowerCase()))) {
      fail(`auth-boundary.html contains active-looking label without negation: ${label}`);
    }
  }
}

for (const pattern of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bdocument\.cookie\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\/api\//
]) {
  if (pattern.test(pageText)) fail(`auth-boundary.html: forbidden runtime or persistence string ${pattern}`);
}

if (!readText("workspace.html").includes('href="auth-boundary.html"')) {
  fail("workspace.html must link to auth-boundary.html");
}

const awareness = authBackend.route_boundary_awareness || {};
if (awareness.unauthenticated_preview_workspace_exists !== true) {
  fail("auth backend boundary must acknowledge the preview workspace");
}
if (awareness.auth_route_boundary_skeleton_exists !== true) {
  fail("auth backend boundary must acknowledge the auth route boundary skeleton");
}
if (awareness.auth_backend_database_persistence_remain_not_implemented !== true) {
  fail("auth backend boundary must keep auth/backend/database/persistence unimplemented");
}
for (const [key, value] of Object.entries(authBackend.implementation_status || {})) {
  if (value !== "not_implemented") fail(`auth backend implementation_status.${key} must remain not_implemented`);
}

if (previewRecord.birth_condition_met_by !== "unauthenticated_interactive_surface") {
  fail("preview workspace must remain born only by unauthenticated interactive surface");
}
if (!previewRecord.allowed_interactions?.includes("transient_in_memory_preview_state")) {
  fail("preview workspace must keep transient in-memory preview state");
}
assertIncludesAll(
  previewRecord.forbidden_capabilities_absent || [],
  ["persistence", "local_storage", "session_storage", "cookies"],
  "preview workspace forbidden persistence capabilities"
);

for (const forbiddenRegistryRef of [
  "direct-ui-membrane-auth-route-boundary",
  "auth-boundary.html",
  "validate-direct-ui-membrane-auth-route-boundary"
]) {
  if (docsJsonText.includes(forbiddenRegistryRef)) {
    fail(`${forbiddenRegistryRef} must not be promoted through data/docs.json`);
  }
}

for (const forbiddenReadmeClaim of [
  "authenticated dashboard exists",
  "login exists",
  "signup exists",
  "customer workspace exists"
]) {
  if (readmeText.includes(forbiddenReadmeClaim)) {
    fail(`README contains claim escalation: ${forbiddenReadmeClaim}`);
  }
}

execFileSync("node", ["scripts/validate-direct-ui-membrane-preview-workspace.mjs"], {
  stdio: "inherit"
});

console.log("direct ui membrane auth route boundary ok (reserved route, auth not implemented)");
