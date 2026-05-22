import fs from "node:fs";

const routingPlanPath = "data/documentation-surface-routing-plan.v1.json";
const inventoryPath = "data/documentation-surface-inventory.v1.json";
const docsJsonPath = "data/docs.json";
const pruningReportPath = "data/documentation-public-navigation-pruning.v1.json";

const allowedRoutingActions = new Set([
  "keep_public",
  "remove_from_public_navigation_later",
  "consolidate_later",
  "archive_later",
  "handoff_only_later",
  "keep_public_but_rename_later",
  "needs_operator_review"
]);

const allowedSourceStatuses = new Set([
  ...allowedRoutingActions,
  "not_in_source_inventory"
]);

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] || 0) + 1;
  return counts;
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

const plan = readJson(routingPlanPath);
const inventory = readJson(inventoryPath);
const docsJson = readJson(docsJsonPath);

if (plan.schema_version !== "1.0") fail("schema_version must be 1.0");
if (plan.generated_for_sub_pass !== "Documentation Architecture Correction 0.2") {
  fail("generated_for_sub_pass mismatch");
}
if (plan.baseline_commit !== "2f27a815010866a6894551baeec35b97c2577bf2") {
  fail("baseline_commit mismatch");
}
if (plan.source_inventory !== inventoryPath) fail("source_inventory mismatch");
if (!plan.routing_principle?.routing_only) fail("routing_only must be true");
if (!plan.routing_principle?.no_destructive_action_in_this_pass) {
  fail("no_destructive_action_in_this_pass must be true");
}

sameSet(plan.routing_actions || [], [...allowedRoutingActions], "routing_actions");

if (!Array.isArray(plan.artifacts)) fail("artifacts must be an array");
const inventoryPaths = inventory.artifacts.map((artifact) => artifact.path);
const requiredPaths = [
  ...inventoryPaths,
  routingPlanPath,
  "scripts/validate-documentation-surface-routing-plan.mjs"
];
sameSet(plan.artifacts.map((artifact) => artifact.path), requiredPaths, "artifacts");

for (const artifact of plan.artifacts) {
  if (!allowedSourceStatuses.has(artifact.source_inventory_status)) {
    fail(`${artifact.path}: invalid source_inventory_status`);
  }
  if (!allowedRoutingActions.has(artifact.routing_action)) {
    fail(`${artifact.path}: invalid routing_action`);
  }
  if (!artifact.current_public_discoverability) {
    fail(`${artifact.path}: missing current_public_discoverability`);
  }
  if (!Array.isArray(artifact.later_execution_requirements)) {
    fail(`${artifact.path}: later_execution_requirements must be an array`);
  }
  if (artifact.destructive_change_allowed_now !== false) {
    fail(`${artifact.path}: destructive_change_allowed_now must be false`);
  }
}

const summaryCounts = countBy(plan.artifacts, "routing_action");
for (const [action, count] of Object.entries(summaryCounts)) {
  if (plan.summary_counts?.[action] !== count) {
    fail(`summary_counts.${action} expected ${count}, found ${plan.summary_counts?.[action]}`);
  }
}

const docsJsonText = fs.readFileSync(docsJsonPath, "utf8");
if (docsJsonText.includes(routingPlanPath)) {
  fail("routing plan must not be promoted through data/docs.json");
}

const nav = plan.public_navigation_plan;
if (!nav?.data_docs_json_current_entries_reviewed) {
  fail("data_docs_json_current_entries_reviewed must be true");
}
const docsEntries = docsJson.documents.map((doc) => ({
  id: doc.id,
  reference_path: referencedDocPath(doc)
}));
const currentDocIds = docsEntries.map((entry) => entry.id);
const keepIds = nav.recommended_keep_in_public_navigation.map((entry) => entry.id);
const removeIds = nav.recommended_remove_from_public_navigation_later.map((entry) => entry.id);
const pruningReportExists = fs.existsSync(pruningReportPath);
const prunedIds = pruningReportExists
  ? readJson(pruningReportPath).removed_from_public_navigation.map((entry) => entry.id)
  : [];
const reviewedDocIds = pruningReportExists ? [...currentDocIds, ...prunedIds] : currentDocIds;
sameSet([...keepIds, ...removeIds], reviewedDocIds, "public navigation split");

if (pruningReportExists) {
  sameSet(currentDocIds, keepIds, "post-pruning public navigation");
  for (const removeId of removeIds) {
    if (currentDocIds.includes(removeId)) {
      fail(`removed navigation id still present after pruning: ${removeId}`);
    }
  }
}

if (keepIds.length !== 13) fail(`expected 13 keep-navigation entries, found ${keepIds.length}`);
if (removeIds.length !== 15) fail(`expected 15 remove-navigation entries, found ${removeIds.length}`);
if (nav.recommended_consolidate_before_navigation.length !== 12) {
  fail("expected 12 consolidate-before-navigation entries");
}
if (nav.recommended_operator_review_before_navigation_change.length !== 3) {
  fail("expected 3 operator-review navigation entries");
}

const requiredRollups = new Map([
  ["Conduit Evidence Rollup", "Track 3"],
  ["Direct UI Membrane Concept Set", "Facade Reflection"],
  ["Backend/Auth/Persistence Architecture Boundary", "Option E"]
]);
for (const [rollupName, series] of requiredRollups) {
  const rollup = plan.canonical_rollup_candidates.find(
    (candidate) => candidate.proposed_rollup === rollupName
  );
  if (!rollup) fail(`missing rollup candidate: ${rollupName}`);
  const expectedSources = inventory.artifacts
    .filter((artifact) => artifact.surface === "docs" && artifact.series === series)
    .map((artifact) => artifact.path);
  sameSet(rollup.source_paths, expectedSources, `${rollupName} source_paths`);
}

const handoffExpected = inventory.artifacts
  .filter((artifact) => artifact.public_surface_status === "handoff_only_later")
  .map((artifact) => artifact.path);
sameSet(
  plan.handoff_only_candidates.map((candidate) => candidate.path),
  handoffExpected,
  "handoff_only_candidates"
);

const operatorExpected = inventory.artifacts
  .filter((artifact) => artifact.public_surface_status === "needs_operator_review")
  .map((artifact) => artifact.path);
sameSet(
  plan.operator_review_queue.map((candidate) => candidate.path),
  operatorExpected,
  "operator_review_queue"
);

if (!Array.isArray(plan.rename_or_replace_review_candidates)) {
  fail("rename_or_replace_review_candidates must be an array");
}
if (!Array.isArray(plan.canonical_public_architecture_artifacts)) {
  fail("canonical_public_architecture_artifacts must be an array");
}
if (!Array.isArray(plan.public_navigation_removal_priority)) {
  fail("public_navigation_removal_priority must be an array");
}

const blocked = plan.blocked_follow_on_work_until_routing_plan_is_accepted || [];
for (const required of [
  "Option E 0.11",
  "additional Option E planning docs",
  "static gallery implementation",
  "Track 3.32",
  "\u00a71.2 implementation",
  "public runtime wiring"
]) {
  if (!blocked.includes(required)) fail(`blocked follow-on work missing ${required}`);
}

console.log(`documentation surface routing plan ok (${plan.artifacts.length} artifacts)`);
