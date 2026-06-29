import fs from "node:fs";
import path from "node:path";

const backlogPath = "data/product-negative-space-backlog.v0.json";
const publicCopyFiles = [
  "README.md",
  "index.html",
  "membrane.html",
  "data/docs.json",
  "data/interface-fixtures.v0.json",
  "data/interface-fixture.example.v0.json",
  "js/trace-viewer.js"
];

const publicIdentityFiles = [
  "README.md",
  "index.html",
  "membrane.html",
  "data/docs.json"
];

const customerFacingSurfaceFiles = [
  "index.html",
  "membrane.html",
  "workspace.html",
  "auth-boundary.html",
  "auth-login.html",
  "auth-callback.html",
  "protected-shell.html",
  "js/preview-workspace.js"
];

const failures = [];

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\n/).length;
}

function normalizePhrase(value) {
  return String(value || "")
    .trim()
    .replace(/\.$/, "")
    .replace(/\s+would be required for operational evidence$/i, "")
    .replace(/\s+would be required if model output is involved$/i, "")
    .replace(/\s+required for operational evidence$/i, "")
    .replace(/\s+/g, " ");
}

function walk(value, visitor, pathParts = []) {
  visitor(value, pathParts);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, [...pathParts, String(index)]));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => walk(item, visitor, [...pathParts, key]));
  }
}

function nearbyText(text, index, radius = 180) {
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + radius));
}

function assertNoPattern(file, text, pattern, message) {
  const match = pattern.exec(text);
  if (match) fail(file, `${message} at line ${lineNumber(text, match.index)}`);
}

if (!fs.existsSync(backlogPath)) {
  fail(backlogPath, "negative-space backlog is required");
}

const backlog = fs.existsSync(backlogPath) ? readJson(backlogPath) : null;
const mappings = Array.isArray(backlog?.mappings) ? backlog.mappings : [];
const mappingByPhrase = new Map();

for (const [index, mapping] of mappings.entries()) {
  const label = `${backlogPath} mappings[${index}]`;
  for (const field of [
    "source_phrase",
    "current_surface_context",
    "boundary_type",
    "construction_targets",
    "current_claim_status",
    "operational_use_threshold",
    "public_copy_rule"
  ]) {
    if (!(field in mapping)) fail(backlogPath, `${label} missing ${field}`);
  }
  if (!Array.isArray(mapping.construction_targets) || mapping.construction_targets.length === 0) {
    fail(backlogPath, `${label} construction_targets must be a non-empty array`);
  }
  if (mapping.current_claim_status && !/not_present|absent|required_if/.test(mapping.current_claim_status)) {
    fail(backlogPath, `${label} current_claim_status must preserve current-state absence truth`);
  }
  mappingByPhrase.set(normalizePhrase(mapping.source_phrase).toLowerCase(), mapping);
}

const requiredBacklogPhrases = [
  "Real input/output artifact",
  "Real input hash",
  "Persistent trace storage",
  "Append-only ledger semantics",
  "Hash-chain verification",
  "Backend validation",
  "Authenticated actor identity",
  "Reproducible execution logs",
  "Test result artifact",
  "Security review",
  "Storage/audit retention model",
  "No live AI execution",
  "No persistent audit ledger"
];

for (const phrase of requiredBacklogPhrases) {
  if (!mappingByPhrase.has(normalizePhrase(phrase).toLowerCase())) {
    fail(backlogPath, `missing required construction mapping for "${phrase}"`);
  }
}

for (const file of publicCopyFiles) {
  if (!fs.existsSync(file)) {
    fail(file, "public copy file is missing");
    continue;
  }
  const text = readText(file);
  assertNoPattern(file, text, /conceptual research interface/i, "global non-product identity language is banned");
  assertNoPattern(file, text, /not a deployed system/i, "global absence-defined product identity is banned");
  assertNoPattern(file, text, /\bminimal implementation\b/i, "\"minimal implementation\" is banned in public/product identity copy");
  assertNoPattern(file, text, /Object status:\s*Static concept surface/i, "static concept object-status label is banned");
  assertNoPattern(file, text, /\bstatic concept surface\b/i, "static concept surface language is banned");
  assertNoPattern(file, text, /\bconcept surface(s)?\b/i, "concept surface language is banned in visible product labels");
  assertNoPattern(file, text, /\bfuture workspace\b/i, "future workspace language is banned where it makes the workspace unreal");
  assertNoPattern(file, text, /\bnot for operational use\b/i, "global not-for-operational-use labels are banned");
}

for (const file of publicIdentityFiles) {
  const text = readText(file);
  assertNoPattern(file, text, /\bprototype-facing\b/i, "prototype-facing must not define the product surface");
  assertNoPattern(file, text, /\bresearch\/prototype-facing\b/i, "research/prototype-facing must not define the product surface");
  assertNoPattern(file, text, /\bstatic prototype\b/i, "static prototype must not define the product surface");
}

for (const file of customerFacingSurfaceFiles) {
  const text = readText(file);
  for (const [pattern, message] of [
    [/Direct UI Membrane/i, "Direct UI Membrane is internal construction language for customer-facing surfaces"],
    [/\bPAR\b/i, "PAR is an internal protocol/task label"],
    [/Zone 3/i, "Zone labels are internal construction labels"],
    [/Birth Framing/i, "Birth Framing is an internal construction label"],
    [/Palisade Birth/i, "Palisade Birth is an internal construction label"],
    [/§2 Palisade Birth Pass/i, "internal pass labels must not be customer-facing"],
    [/Static Membrane/i, "Static Membrane is internal scaffolding language"],
    [/Access Boundary Membrane/i, "Access Boundary Membrane is an internal surface label"],
    [/Authenticated shell boundary/i, "Authenticated shell boundary is internal scaffolding language"],
    [/Protected Shell Boundary/i, "Protected Shell Boundary is internal scaffolding language"],
    [/Auth Boundary/i, "Auth Boundary is an internal surface label"],
    [/Reserved Boundary/i, "Reserved Boundary is an internal surface label"],
    [/Implementation Boundary/i, "Implementation Boundary is an internal surface label"],
    [/Route Placeholder/i, "Route Placeholder is an internal route label"],
    [/Future Authenticated Shell/i, "Future Authenticated Shell is internal scaffolding language"],
    [/Staged Interface Surface/i, "Staged Interface Surface is internal scaffolding language"],
    [/Staged product-surface/i, "staged product-surface is internal scaffolding language"],
    [/Release Review Chamber/i, "Release Review Chamber is an internal surface label"],
    [/Unauthenticated preview workspace/i, "Unauthenticated preview workspace exposes construction state as product identity"]
  ]) {
    assertNoPattern(file, text, pattern, message);
  }
}

for (const file of publicCopyFiles) {
  const text = readText(file);
  let match;
  const noLivePattern = /No live AI execution/gi;
  while ((match = noLivePattern.exec(text))) {
    const context = nearbyText(text, match.index).toLowerCase();
    if (!/(runtime|execution|browser-side evaluation|model execution|status-strip|boundary|pending operational attachments)/.test(context)) {
      fail(file, `"No live AI execution" must be local runtime-execution boundary copy at line ${lineNumber(text, match.index)}`);
    }
  }

  const noLedgerPattern = /No persistent audit ledger/gi;
  while ((match = noLedgerPattern.exec(text))) {
    if (!mappingByPhrase.has("no persistent audit ledger")) {
      fail(file, `"No persistent audit ledger" appears without a construction-path mapping`);
    }
  }

  const productionLedgerPattern = /not a production audit ledger/gi;
  while ((match = productionLedgerPattern.exec(text))) {
    const context = nearbyText(text, match.index).toLowerCase();
    if (!/(construction|requirement|persistent audit ledger|hash-chain|append-only|retention|boundary)/.test(context)) {
      fail(file, `"Not a production audit ledger" must be paired with audit-ledger construction requirements at line ${lineNumber(text, match.index)}`);
    }
  }
}

const traceViewerText = readText("js/trace-viewer.js");
if (!/Static browser-side evaluation/.test(traceViewerText)) {
  fail("js/trace-viewer.js", "static browser-side evaluation boundary must remain available");
}
if (!/Prototype Trace/.test(traceViewerText)) {
  fail("js/trace-viewer.js", "prototype trace may remain as a technical trace label");
}
if (/AETHERUS[^.\n]{0,80}prototype/i.test(traceViewerText)) {
  fail("js/trace-viewer.js", "prototype must not define the whole product");
}

const indexText = readText("index.html");
const docsText = readText("data/docs.json");
const readmeText = readText("README.md");
const futureThresholdText = `${indexText}\n${docsText}\n${readmeText}`;
if (!/Operational use is a legitimate future threshold event/i.test(futureThresholdText)) {
  fail("public copy", "must acknowledge operational use as a legitimate future threshold event");
}
if (!/does not claim that threshold has been reached|must not be used as the basis for operational|does not claim that operational use already exists/i.test(futureThresholdText)) {
  fail("public copy", "must forbid language implying operational use already exists");
}

for (const [file, json] of [
  ["data/interface-fixtures.v0.json", readJson("data/interface-fixtures.v0.json")],
  ["data/interface-fixture.example.v0.json", readJson("data/interface-fixture.example.v0.json")]
]) {
  walk(json, (value, pathParts) => {
    const key = pathParts[pathParts.length - 1];
    if (key !== "label" || typeof value !== "string") return;
    const isEvidenceRequirement = /required for operational evidence|if model output is involved/i.test(value)
      || pathParts.includes("evidence_requirements");
    if (!isEvidenceRequirement) return;
    const normalized = normalizePhrase(value).toLowerCase();
    if (!mappingByPhrase.has(normalized)) {
      fail(file, `evidence requirement "${value}" lacks a construction-path mapping in ${backlogPath}`);
    }
  });
}

for (const file of publicCopyFiles) {
  const text = readText(file);
  for (const pattern of [
    /\bis operationally deployed\b/i,
    /\boperational use exists\b/i,
    /\bcustomer workspace exists\b/i,
    /\bproduction audit ledger exists\b/i,
    /\blive AI execution exists\b/i
  ]) {
    assertNoPattern(file, text, pattern, "public copy implies operational use or implemented operational capability");
  }
}

if (backlog && !/Operational use is a legitimate future threshold event/i.test(backlog.operational_use_threshold_rule || "")) {
  fail(backlogPath, "operational_use_threshold_rule must define operational use as a legitimate future threshold event");
}
if (backlog && !/must not imply operational use already exists/i.test(backlog.current_claim_rule || "")) {
  fail(backlogPath, "current_claim_rule must forbid current operational-use claims");
}

if (failures.length) {
  console.error("Product language boundary validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("product language boundary ok");
console.log(`Mapped negative-space construction targets: ${mappings.length}`);
console.log(`Public files checked: ${publicCopyFiles.map((file) => path.basename(file)).join(", ")}`);
