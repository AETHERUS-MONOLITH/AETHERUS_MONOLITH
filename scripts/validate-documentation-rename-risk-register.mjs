import fs from "node:fs";

const registerPath = "data/documentation-rename-risk-register.v1.json";
const routingPlanPath = "data/documentation-surface-routing-plan.v1.json";
const docsJsonPath = "data/docs.json";

const allowedRiskDimensions = new Set([
  "implementation_implication",
  "runtime_implication",
  "operational_maturity_implication",
  "public_claim_boundary_risk",
  "internal_process_exposure",
  "over-specific_subpass_label",
  "future_work_presented_as_artifact",
  "evidence_wall_effect",
  "operator_or_codex_process_exposure"
]);

const allowedSeverity = new Set(["low", "medium", "high"]);

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function referencedDocPath(doc) {
  const match = String(doc.body || "").match(/`(docs\/[A-Z0-9_]+\.md)`/);
  if (match) return match[1];
  if (doc.id === "README") return "README.md";
  return `data/docs.json#${doc.id}`;
}

function sameSet(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  if (actualSet.size !== expectedSet.size) fail(`${label}: size mismatch`);
  for (const value of expectedSet) {
    if (!actualSet.has(value)) fail(`${label}: missing ${value}`);
  }
}

const register = readJson(registerPath);
const routingPlan = readJson(routingPlanPath);
const docsJson = readJson(docsJsonPath);

if (register.schema_version !== "1.0") fail("schema_version must be 1.0");
if (register.generated_for_sub_pass !== "Documentation Architecture Correction 0.4") {
  fail("generated_for_sub_pass mismatch");
}
if (register.baseline_commit !== "770f71891832be09a07888b19167db3a9108fd2d") {
  fail("baseline_commit mismatch");
}
if (register.classification_only !== true) fail("classification_only must be true");
if (register.no_rename_authorized !== true) fail("no_rename_authorized must be true");
sameSet(register.risk_dimensions, [...allowedRiskDimensions], "risk_dimensions");
sameSet(register.severity_values, [...allowedSeverity], "severity_values");

if (!Array.isArray(register.items)) fail("items must be an array");
const itemPaths = register.items.map((item) => item.path);
if (new Set(itemPaths).size !== itemPaths.length) fail("duplicate rename-risk paths");

for (const item of register.items) {
  if (!item.path) fail("item path is required");
  if (!item.current_title_or_label) fail(`${item.path}: current_title_or_label is required`);
  if (!item.current_filename) fail(`${item.path}: current_filename is required`);
  if (!Array.isArray(item.risk_dimensions) || item.risk_dimensions.length === 0) {
    fail(`${item.path}: risk_dimensions must be non-empty`);
  }
  for (const dimension of item.risk_dimensions) {
    if (!allowedRiskDimensions.has(dimension)) {
      fail(`${item.path}: invalid risk dimension ${dimension}`);
    }
  }
  if (!allowedSeverity.has(item.severity)) fail(`${item.path}: invalid severity`);
  if (item.rename_authorized_now !== false) {
    fail(`${item.path}: rename_authorized_now must be false`);
  }
}

const severityCounts = {};
const dimensionCounts = {};
for (const item of register.items) {
  severityCounts[item.severity] = (severityCounts[item.severity] || 0) + 1;
  for (const dimension of item.risk_dimensions) {
    dimensionCounts[dimension] = (dimensionCounts[dimension] || 0) + 1;
  }
}
for (const [severity, count] of Object.entries(severityCounts)) {
  if (register.summary_counts.by_severity[severity] !== count) {
    fail(`summary_counts.by_severity.${severity} mismatch`);
  }
}
for (const [dimension, count] of Object.entries(dimensionCounts)) {
  if (register.summary_counts.by_risk_dimension[dimension] !== count) {
    fail(`summary_counts.by_risk_dimension.${dimension} mismatch`);
  }
}
if (register.summary_counts.total !== register.items.length) {
  fail("summary_counts.total mismatch");
}

for (const candidate of routingPlan.rename_or_replace_review_candidates) {
  if (!itemPaths.includes(candidate.path)) {
    fail(`missing routing rename-risk candidate: ${candidate.path}`);
  }
}

const currentDocsPaths = docsJson.documents.map(referencedDocPath);
for (const path of register.risky_titles_still_public_facing_through_data_docs_json) {
  if (!currentDocsPaths.includes(path)) fail(`${path}: not currently in data/docs.json`);
}
for (const item of register.items) {
  if (item.currently_public_facing_through_data_docs_json && !currentDocsPaths.includes(item.path)) {
    fail(`${item.path}: public-facing flag does not match data/docs.json`);
  }
}

const forbiddenTextPattern = new RegExp(
  String.raw`/Documents/` + "Codex|Relationship to " + String.raw`next|Next sub-pass`
);
if (forbiddenTextPattern.test(fs.readFileSync(registerPath, "utf8"))) {
  fail("rename risk register introduced forbidden local path or next-section text");
}

console.log(`documentation rename risk register ok (${register.items.length} items)`);
