import fs from "node:fs";

const pruningReportPath = "data/documentation-public-navigation-pruning.v1.json";
const routingPlanPath = "data/documentation-surface-routing-plan.v1.json";
const inventoryPath = "data/documentation-surface-inventory.v1.json";
const docsJsonPath = "data/docs.json";

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sameSet(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  if (actualSet.size !== expectedSet.size) fail(`${label}: size mismatch`);
  for (const value of expectedSet) {
    if (!actualSet.has(value)) fail(`${label}: missing ${value}`);
  }
}

function referencedDocPath(doc) {
  const match = String(doc.body || "").match(/`(docs\/[A-Z0-9_]+\.md)`/);
  if (match) return match[1];
  if (doc.id === "README") return "README.md";
  return null;
}

const report = readJson(pruningReportPath);
const routingPlan = readJson(routingPlanPath);
const inventory = readJson(inventoryPath);
const docsJson = readJson(docsJsonPath);

if (report.schema_version !== "1.0") fail("schema_version must be 1.0");
if (report.generated_for_sub_pass !== "Documentation Architecture Correction 0.3") {
  fail("generated_for_sub_pass mismatch");
}
if (report.baseline_commit !== "98e0de2f7f5395ee0d00f416ccf76dee046e470d") {
  fail("baseline_commit mismatch");
}
if (report.source_routing_plan !== routingPlanPath) fail("source_routing_plan mismatch");
if (report.target_registry !== docsJsonPath) fail("target_registry mismatch");
if (report.no_destructive_action !== true) fail("no_destructive_action must be true");
if (report.docs_json_changed !== true) fail("docs_json_changed must be true");

if (!Array.isArray(report.removed_from_public_navigation)) {
  fail("removed_from_public_navigation must be an array");
}
if (!Array.isArray(report.left_in_public_navigation)) {
  fail("left_in_public_navigation must be an array");
}

const plannedRemoveEntries =
  routingPlan.public_navigation_plan.recommended_remove_from_public_navigation_later;
const plannedRemoveIds = plannedRemoveEntries.map((entry) => entry.id);
const plannedRemovePaths = plannedRemoveEntries.map((entry) => entry.reference_path).filter(Boolean);
const removedIds = report.removed_from_public_navigation.map((entry) => entry.id);
const removedPaths = report.removed_from_public_navigation.map((entry) => entry.path).filter(Boolean);
sameSet(removedIds, plannedRemoveIds, "removed navigation ids");
sameSet(removedPaths, plannedRemovePaths, "removed navigation paths");

const docsRefs = docsJson.documents.map((doc) => referencedDocPath(doc)).filter(Boolean);
const docsIds = docsJson.documents.map((doc) => doc.id);
for (const entry of report.removed_from_public_navigation) {
  if (entry.routing_action !== "remove_from_public_navigation_later") {
    fail(`${entry.path}: routing_action must be remove_from_public_navigation_later`);
  }
  if (!plannedRemoveIds.includes(entry.id) && !plannedRemovePaths.includes(entry.path)) {
    fail(`${entry.path}: not in routing-plan public navigation removal list`);
  }
  if (docsIds.includes(entry.id) || docsRefs.includes(entry.path)) {
    fail(`${entry.path}: still listed in data/docs.json`);
  }
  if (entry.path?.startsWith("docs/") && !fs.existsSync(entry.path)) {
    fail(`${entry.path}: underlying docs file was not preserved`);
  }
  if (entry.underlying_file_preserved !== true) {
    fail(`${entry.path}: underlying_file_preserved must be true`);
  }
}

const operatorReviewPaths = new Set(
  routingPlan.operator_review_queue.map((entry) => entry.path)
);
for (const entry of report.removed_from_public_navigation) {
  if (operatorReviewPaths.has(entry.path) && !plannedRemovePaths.includes(entry.path)) {
    fail(`${entry.path}: operator-review path removed without routing-plan removal listing`);
  }
}

for (const forbiddenPath of [inventoryPath, routingPlanPath, pruningReportPath]) {
  if (docsRefs.includes(forbiddenPath) || fs.readFileSync(docsJsonPath, "utf8").includes(forbiddenPath)) {
    fail(`${forbiddenPath} must not be promoted through data/docs.json`);
  }
}

if (report.docs_json_entry_count_before !== 28) fail("expected docs_json_entry_count_before 28");
if (report.docs_json_entry_count_after !== docsJson.documents.length) {
  fail("docs_json_entry_count_after does not match data/docs.json");
}
if (docsJson.documents.length !== 13) fail("expected 13 public navigation entries after pruning");
if (report.removed_from_public_navigation.length !== 15) {
  fail("expected 15 removed public navigation entries");
}

for (const forbidden of [
  "document deletion",
  "document rename",
  "archive move",
  "content consolidation",
  "operator-review decisions",
  "gallery implementation",
  "Option E 0.11",
  "Track 3.32",
  "\u00a71.2 implementation"
]) {
  if (!report.not_executed_in_this_pass.includes(forbidden)) {
    fail(`not_executed_in_this_pass missing ${forbidden}`);
  }
}

console.log(
  `documentation public navigation pruning ok (${report.removed_from_public_navigation.length} removed)`
);
