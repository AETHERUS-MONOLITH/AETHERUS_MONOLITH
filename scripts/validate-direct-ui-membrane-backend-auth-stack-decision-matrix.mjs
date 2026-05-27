import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);

const matrixPath = "data/direct-ui-membrane-backend-auth-stack-decision-matrix.v0.json";
const readinessPath = "data/direct-ui-membrane-auth-implementation-readiness-gate.v0.json";
const authBackendPath = "data/direct-ui-membrane-auth-backend-boundary.v0.json";
const docsJsonPath = "data/docs.json";

const expectedCandidates = [
  "supabase_full_boundary",
  "clerk_plus_separate_backend",
  "custom_backend_auth",
  "static_fake_auth",
  "backend_first_no_provider_selected"
];

const falseCapabilityFlags = [
  "implementation_performed",
  "auth_implemented",
  "backend_implemented",
  "database_implemented",
  "persistence_implemented",
  "tenant_isolation_implemented",
  "billing_implemented",
  "customer_workspace_implemented"
];

const requiredLoginPreconditions = [
  "project environment strategy defined",
  "no secrets in static client",
  "auth provider project and config boundary created",
  "server-side session verification strategy defined",
  "protected route behavior defined"
];

const requiredPersistencePreconditions = [
  "database schema boundary selected",
  "RLS tenant scoping model defined",
  "migration strategy defined",
  "audit log contract defined"
];

const requiredTenantPreconditions = [
  "tenant_id model defined",
  "RLS policies implemented and tested",
  "server-side tenant context enforcement implemented",
  "cross-tenant access tests defined"
];

const activeAuthFiles = [
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

function assertFalseBooleans(record, keys, label) {
  for (const key of keys) {
    if (record[key] !== false) fail(`${label}.${key} must be false`);
  }
}

function htmlHasForm(text) {
  return /<form\b/i.test(text);
}

function htmlHasCredentialInput(text) {
  return /<input\b[^>]*(type|name|id|placeholder)=["'][^"']*(email|password|credential)["']/i.test(text);
}

function htmlHasActiveAuthControl(text) {
  const activeControlPattern =
    /<(?:button|a)\b[^>]*>\s*(?:login|sign in|signup|register|create account|submit|save)\s*</i;
  return activeControlPattern.test(text);
}

if (!(await exists(matrixPath))) fail(`${matrixPath} is missing`);

const matrix = await readJson(matrixPath);
const readiness = await readJson(readinessPath);
const authBackend = await readJson(authBackendPath);
const docsJsonText = await readText(docsJsonPath);

if (matrix.schema_version !== "0.1") fail("stack decision matrix schema_version must be 0.1");
if (
  matrix.generated_for_sub_pass !==
  "§1.2 Backend/Auth Boundary 0.1 — Stack Decision Matrix"
) {
  fail("stack decision matrix generated_for_sub_pass mismatch");
}
if (matrix.baseline_commit !== "00cbfde1a2c69d99b0741aba70819f1cfe71db87") {
  fail("stack decision matrix baseline_commit mismatch");
}
if (matrix.object_status !== "backend_auth_stack_decision_matrix") {
  fail("stack decision matrix object_status mismatch");
}
if (!["selected", "deferred"].includes(matrix.decision_status)) {
  fail("decision_status must be selected or deferred");
}
assertFalseBooleans(matrix, falseCapabilityFlags, "stack decision matrix");

if (matrix.evaluation_context?.readiness_gate_verdict !== "backend_first_required_before_auth_ui") {
  fail("matrix must preserve the readiness gate verdict");
}
if (
  matrix.evaluation_context?.secondary_candidate_from_readiness_gate !==
  "supabase_candidate_selected_for_next_evaluation"
) {
  fail("matrix must preserve the readiness secondary candidate");
}

const candidates = matrix.candidates || [];
if (!Array.isArray(candidates)) fail("candidates must be an array");
const candidatesById = new Map(candidates.map((candidate) => [candidate.candidate_id, candidate]));
assertIncludesAll([...candidatesById.keys()], expectedCandidates, "candidates");

const selectedCandidates = candidates.filter((candidate) => candidate.decision === "selected");
if (matrix.decision_status === "selected") {
  if (selectedCandidates.length !== 1) fail("selected decision_status requires exactly one selected candidate");
  if (selectedCandidates[0].candidate_id !== matrix.selected_stack_boundary) {
    fail("selected_stack_boundary must match the selected candidate");
  }
} else if (selectedCandidates.length > 0) {
  fail("deferred decision_status must not select a candidate");
}

if (candidatesById.get("static_fake_auth")?.decision !== "rejected") {
  fail("static_fake_auth must be rejected");
}
if (!["rejected", "deferred"].includes(candidatesById.get("custom_backend_auth")?.decision)) {
  fail("custom_backend_auth must be rejected or deferred");
}

if (matrix.selected_stack_boundary === "supabase_full_boundary") {
  const selected = candidatesById.get("supabase_full_boundary");
  for (const key of [
    "supports_real_auth_direction",
    "supports_server_side_authorization_direction",
    "supports_database_rls_direction",
    "supports_persistence_direction",
    "supports_tenant_isolation_direction",
    "supports_audit_log_direction"
  ]) {
    if (selected[key] !== true) fail(`selected supabase boundary must set ${key} true`);
  }
}

assertIncludesAll(
  matrix.preconditions_before_real_login_ui || [],
  requiredLoginPreconditions,
  "preconditions_before_real_login_ui"
);
assertIncludesAll(
  matrix.preconditions_before_persistence || [],
  requiredPersistencePreconditions,
  "preconditions_before_persistence"
);
assertIncludesAll(
  matrix.preconditions_before_tenant_claims || [],
  requiredTenantPreconditions,
  "preconditions_before_tenant_claims"
);

const nextCommit = matrix.smallest_truthful_next_commit || {};
if (!nextCommit.name || !nextCommit.purpose) {
  fail("smallest_truthful_next_commit must include name and purpose");
}
assertIncludesAll(
  nextCommit.must_not_implement || [],
  ["real login", "credential capture", "database persistence", "tenant isolation", "customer workspace"],
  "smallest_truthful_next_commit.must_not_implement"
);

for (const filePath of packageOrSecretFiles) {
  if (await exists(filePath)) fail(`${filePath} must not be introduced for this pass`);
}

for (const filePath of activeAuthFiles) {
  if (!(await exists(filePath))) fail(`${filePath} is missing`);
  const text = await readText(filePath);
  if (htmlHasForm(text)) fail(`${filePath} must not contain forms`);
  if (htmlHasCredentialInput(text)) fail(`${filePath} must not contain credential inputs`);
  if (htmlHasActiveAuthControl(text)) fail(`${filePath} must not contain active auth controls`);
  for (const { label, pattern } of forbiddenIntegrationPatterns) {
    if (pattern.test(text)) fail(`${filePath} must not contain ${label}`);
  }
}

if (docsJsonText.includes("direct-ui-membrane-backend-auth-stack-decision-matrix")) {
  fail("stack decision matrix must not be promoted through data/docs.json");
}
if (docsJsonText.includes("validate-direct-ui-membrane-backend-auth-stack-decision-matrix")) {
  fail("stack decision validator must not be promoted through data/docs.json");
}

if (readiness.stack_decision_matrix?.path !== matrixPath) {
  fail("readiness gate must reference the stack decision matrix path");
}
if (readiness.stack_decision_matrix?.selected_stack_boundary !== matrix.selected_stack_boundary) {
  fail("readiness gate selected stack boundary mismatch");
}
for (const key of [
  "implementation_performed",
  "auth_implemented",
  "backend_implemented",
  "database_implemented",
  "persistence_implemented",
  "tenant_isolation_implemented"
]) {
  if (readiness.stack_decision_matrix?.[key] !== false) {
    fail(`readiness stack_decision_matrix.${key} must be false`);
  }
}

const matrixAwareness = authBackend.stack_decision_matrix || {};
if (matrixAwareness.path !== matrixPath) fail("auth backend boundary must reference matrix path");
if (matrixAwareness.selected_stack_boundary !== matrix.selected_stack_boundary) {
  fail("auth backend boundary selected stack mismatch");
}
for (const key of [
  "implementation_performed",
  "auth_remains_not_implemented",
  "backend_remains_not_implemented",
  "database_remains_not_implemented",
  "persistence_remains_not_implemented",
  "tenant_isolation_remains_not_implemented"
]) {
  const expected = key === "implementation_performed" ? false : true;
  if (matrixAwareness[key] !== expected) fail(`auth backend stack_decision_matrix.${key} mismatch`);
}
for (const [key, value] of Object.entries(authBackend.implementation_status || {})) {
  if (value !== "not_implemented") fail(`auth backend implementation_status.${key} must remain not_implemented`);
}

await runFile("node", ["scripts/validate-direct-ui-membrane-auth-implementation-readiness-gate.mjs"], {
  stdio: "inherit"
});
await runFile("node", ["scripts/validate-direct-ui-membrane-auth-route-boundary.mjs"], {
  stdio: "inherit"
});
await runFile("node", ["scripts/validate-direct-ui-membrane-preview-workspace.mjs"], {
  stdio: "inherit"
});

console.log("direct ui membrane backend/auth stack decision matrix ok (stack selected, no implementation)");
