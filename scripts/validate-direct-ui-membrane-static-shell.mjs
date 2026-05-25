import fs from "node:fs";

const recordPath = "data/direct-ui-membrane-static-shell.v0.json";
const publicShellFiles = ["membrane.html", "index.html", "css/style.css"];

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
  "Deploy",
  "Execute",
  "Approve Release",
  "Production Ready",
  "Compliance Certified",
  "Customer Dashboard",
  "Live Monitoring"
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

if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
if (record.generated_for_sub_pass !== "§1.2 Pre-Birth Static Membrane Shell 0.1") {
  fail("generated_for_sub_pass mismatch");
}
if (record.baseline_commit !== "3ba6c5c110e10b468923ce853c645bc4e0636675") {
  fail("baseline_commit mismatch");
}
if (record.object_status !== "static_pre_birth_preview_shell") fail("object_status mismatch");
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

const membraneText = readText("membrane.html");
const normalizedMembraneText = membraneText.replace(/&mdash;/g, "-");
assertIncludesAll(normalizedMembraneText, requiredBoundaryPhrases, "membrane.html boundary copy");
assertIncludesAll(normalizedMembraneText, requiredSurfaces, "membrane.html surfaces");

const indexText = readText("index.html");
if (!indexText.includes('href="membrane.html"')) {
  fail("index.html must link to membrane.html");
}
if (!indexText.includes("Static Membrane Preview")) {
  fail("index.html navigation must use a bounded preview label");
}

for (const filePath of publicShellFiles) {
  const text = readText(filePath);
  for (const label of forbiddenOperationalLabels) {
    const pattern = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(text)) fail(`${filePath}: forbidden operational label "${label}"`);
  }
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
