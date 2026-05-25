import fs from "node:fs";

const recordPath = "data/direct-ui-membrane-static-shell.v0.json";
const qaReportPath = "data/direct-ui-membrane-static-shell-qa.v0.json";
const docsJsonPath = "data/docs.json";
const publicShellFiles = ["membrane.html", "index.html", "css/style.css"];
const runtimeBoundaryFiles = [...publicShellFiles, recordPath, qaReportPath];

const requiredSurfaces = [
  "Access Boundary Membrane",
  "Workspace Control Surface",
  "Evidence / Artifact Review Surface",
  "Release Review Chamber",
  "Escalation Review Surface"
];

const requiredForbiddenCapabilities = [
  "auth",
  "backend",
  "database",
  "persistence",
  "billing",
  "tenant_infrastructure",
  "palisade",
  "weave",
  "public_nexus_runtime",
  "model_api_calls",
  "operational_dashboard"
];

const requiredBoundaryPhrases = [
  "Direct UI Membrane",
  "Static Preview",
  "Conceptual interface scaffold",
  "No authentication",
  "No backend",
  "No persistence",
  "No live AI execution",
  "No public NEXUS runtime",
  "No operational release authority",
  "No compliance certification",
  "No customer data"
];

const forbiddenOperationalLabels = [
  "Login",
  "Sign in",
  "Signup",
  "Register",
  "Create account",
  "Start",
  "Launch",
  "Run",
  "Deploy",
  "Execute",
  "Approve",
  "Approve Release",
  "Release Now",
  "Escalate Now",
  "Production Ready",
  "Compliance Certified",
  "Customer Dashboard",
  "Live Monitoring",
  "Connect",
  "Sync",
  "Create Tenant",
  "Open Dashboard"
];

const allowedStaticLabels = [
  "Preview Surface",
  "Inspect Concept",
  "Review Boundary",
  "View Static Model",
  "Concept Only"
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

const record = readJson(recordPath);
const qaReport = fs.existsSync(qaReportPath) ? readJson(qaReportPath) : null;
const docsJson = readJson(docsJsonPath);

if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
if (record.generated_for_sub_pass !== "§1.2 Pre-Birth Static Membrane Shell 0.1") {
  fail("generated_for_sub_pass mismatch");
}
if (record.baseline_commit !== "3ba6c5c110e10b468923ce853c645bc4e0636675") {
  fail("baseline_commit mismatch");
}
if (record.object_status !== "static_pre_birth_preview_shell") fail("object_status mismatch");
if (record.latest_qa_sub_pass !== "§1.2 Pre-Birth Static Membrane Shell 0.2") {
  fail("latest_qa_sub_pass must record the 0.2 hardening pass");
}
if (record.qa_hardening_status !== "boundary_hardened_static_shell") {
  fail("qa_hardening_status mismatch");
}
if (record.birth_condition_not_met !== true) fail("birth_condition_not_met must be true");
assertIncludesAll(record.surfaces_represented || [], requiredSurfaces, "surfaces_represented");
assertIncludesAll(
  record.forbidden_capabilities_absent || [],
  requiredForbiddenCapabilities,
  "forbidden_capabilities_absent"
);

if (!record.public_copy_boundary || record.public_copy_boundary.static_preview !== true) {
  fail("public_copy_boundary.static_preview must be true");
}
for (const key of [
  "conceptual_interface_scaffold",
  "no_authentication",
  "no_backend",
  "no_persistence",
  "no_live_ai_execution",
  "no_public_nexus_runtime",
  "no_operational_release_authority",
  "no_compliance_certification",
  "no_customer_data"
]) {
  if (record.public_copy_boundary[key] !== true) {
    fail(`public_copy_boundary.${key} must be true`);
  }
}

for (const filePath of publicShellFiles) {
  if (!fs.existsSync(filePath)) fail(`${filePath} is missing`);
}
if (!fs.existsSync(qaReportPath)) fail(`${qaReportPath} is missing`);

const membraneText = readText("membrane.html");
const normalizedMembraneText = membraneText.replace(/&mdash;/g, "-");
assertIncludesAll(normalizedMembraneText, requiredBoundaryPhrases, "membrane.html boundary copy");
assertIncludesAll(normalizedMembraneText, requiredSurfaces, "membrane.html surfaces");

if ((normalizedMembraneText.match(/<h1\b/gi) || []).length !== 1) {
  fail("membrane.html must have exactly one h1");
}
for (const label of allowedStaticLabels) {
  if (normalizedMembraneText.includes(label)) continue;
}
if (/<form\b/i.test(membraneText)) fail("membrane.html must not contain forms");
if (/<(?:input|textarea|select)\b/i.test(membraneText)) {
  fail("membrane.html must not contain input, textarea, or select controls");
}
if (/<input\b[^>]*type=["']?(?:password|email)["']?/i.test(membraneText)) {
  fail("membrane.html must not contain password or email inputs");
}
const buttonMatches = membraneText.match(/<button\b[^>]*>/gi) || [];
for (const match of buttonMatches) {
  if (!/\bdisabled\b/i.test(match) || !/\bconcept\b/i.test(match)) {
    fail("membrane.html must not contain active buttons");
  }
}

const indexText = readText("index.html");
if (!indexText.includes('href="membrane.html"')) {
  fail("index.html must link to membrane.html");
}
const boundedNavigationLabels = [
  "Static Membrane Preview",
  "Direct UI Membrane — Static Preview",
  "Direct UI Membrane &mdash; Static Preview",
  "Conceptual Membrane Surface"
];
if (!boundedNavigationLabels.some((label) => indexText.includes(label))) {
  fail("index.html navigation must use a bounded preview label");
}

for (const filePath of ["membrane.html"]) {
  const text = readText(filePath);
  for (const label of forbiddenOperationalLabels) {
    const pattern = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(text)) fail(`${filePath}: forbidden operational label "${label}"`);
  }
}

for (const filePath of runtimeBoundaryFiles) {
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

if (qaReport) {
  if (qaReport.schema_version !== "0.1") fail("QA report schema_version must be 0.1");
  if (qaReport.generated_for_sub_pass !== "§1.2 Pre-Birth Static Membrane Shell 0.2") {
    fail("QA report generated_for_sub_pass mismatch");
  }
  if (qaReport.baseline_commit !== "799ada826b47b44e615ad0b772ceedb4a3d0bd22") {
    fail("QA report baseline_commit mismatch");
  }
  if (qaReport.birth_condition_not_met !== true) fail("QA report birth_condition_not_met must be true");
  assertIncludesAll(qaReport.surfaces_verified || [], requiredSurfaces, "QA report surfaces_verified");
  assertIncludesAll(
    qaReport.forbidden_capabilities_absent || [],
    [
      "auth",
      "login",
      "signup",
      "forms",
      "backend",
      "database",
      "persistence",
      "billing",
      "tenant_infrastructure",
      "palisade",
      "weave",
      "public_nexus_runtime",
      "model_api_calls",
      "operational_dashboard",
      "runtime_monitoring"
    ],
    "QA report forbidden_capabilities_absent"
  );
  if (!qaReport.visual_verification || qaReport.visual_verification.membrane_html_renders !== true) {
    fail("QA report must record membrane_html_renders true");
  }
  for (const [key, value] of Object.entries(qaReport.visual_verification)) {
    if (["console_errors", "horizontal_overflow", "forms_buttons_or_runtime_hooks"].includes(key)) {
      if (value !== false) fail(`QA report visual_verification.${key} must be false`);
    } else if (value !== true) {
      fail(`QA report visual_verification.${key} must be true`);
    }
  }
}

const docsJsonText = JSON.stringify(docsJson);
for (const forbiddenRegistryRef of [
  "direct-ui-membrane-static-shell",
  "direct-ui-membrane-static-shell-qa",
  "validate-direct-ui-membrane-static-shell"
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
    fail(`${forbiddenPackageFile} must not be introduced for the static shell`);
  }
}

console.log("direct ui membrane static shell ok (5 surfaces, birth condition not met)");
