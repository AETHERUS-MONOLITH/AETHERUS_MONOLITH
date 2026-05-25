import fs from "node:fs";

const queuePath = "data/documentation-operator-review-queue.v1.json";
const routingPlanPath = "data/documentation-surface-routing-plan.v1.json";
const renameRegisterPath = "data/documentation-rename-risk-register.v1.json";

const allowedCategories = new Set([
  "public_value_ambiguous",
  "claim_boundary_sensitive",
  "architecture_identity_sensitive",
  "implementation_status_ambiguous",
  "positioning_sensitive",
  "possible_archive_candidate",
  "possible_consolidation_candidate",
  "possible_public_navigation_candidate"
]);

const allowedDecisions = new Set([
  "keep_public",
  "remove_from_public_navigation",
  "consolidate",
  "archive",
  "rename",
  "handoff_only",
  "defer"
]);

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

const queue = readJson(queuePath);
const routingPlan = readJson(routingPlanPath);
const renameRegister = readJson(renameRegisterPath);

if (queue.schema_version !== "1.0") fail("schema_version must be 1.0");
if (queue.generated_for_sub_pass !== "Documentation Architecture Correction 0.4") {
  fail("generated_for_sub_pass mismatch");
}
if (queue.baseline_commit !== "770f71891832be09a07888b19167db3a9108fd2d") {
  fail("baseline_commit mismatch");
}
if (queue.classification_only !== true) fail("classification_only must be true");
if (queue.no_repository_action_authorized !== true) {
  fail("no_repository_action_authorized must be true");
}
sameSet(queue.review_categories, [...allowedCategories], "review_categories");
sameSet(queue.operator_decision_values, [...allowedDecisions], "operator_decision_values");

if (!Array.isArray(queue.items)) fail("items must be an array");
const itemPaths = queue.items.map((item) => item.path);
sameSet(queue.blocked_until_operator_decision, itemPaths, "blocked_until_operator_decision");
sameSet(
  queue.documents_not_to_touch_without_operator_decision,
  itemPaths,
  "documents_not_to_touch_without_operator_decision"
);

const routingOperatorPaths = routingPlan.operator_review_queue.map((item) => item.path);
for (const requiredPath of routingOperatorPaths) {
  if (!itemPaths.includes(requiredPath)) {
    fail(`missing routing operator-review item: ${requiredPath}`);
  }
}

const highRenameReviewPaths = renameRegister.items
  .filter((item) => item.severity === "high" && item.operator_review_required)
  .filter((item) => item.path.startsWith("docs/") || item.path.startsWith("data/docs.json#"))
  .map((item) => item.path);
for (const requiredPath of highRenameReviewPaths) {
  if (!itemPaths.includes(requiredPath)) {
    fail(`missing high rename-risk operator-review item: ${requiredPath}`);
  }
}

for (const item of queue.items) {
  if (!item.path) fail("queue item path is required");
  if (!item.current_public_discoverability) {
    fail(`${item.path}: current_public_discoverability is required`);
  }
  if (!Array.isArray(item.review_category) || item.review_category.length === 0) {
    fail(`${item.path}: review_category must be a non-empty array`);
  }
  for (const category of item.review_category) {
    if (!allowedCategories.has(category)) fail(`${item.path}: invalid category ${category}`);
  }
  if (!allowedDecisions.has(item.default_recommendation)) {
    fail(`${item.path}: invalid default_recommendation`);
  }
  for (const decision of item.allowed_operator_decisions) {
    if (!allowedDecisions.has(decision)) fail(`${item.path}: invalid decision ${decision}`);
  }
  if (item.blocked_without_operator_decision !== true) {
    fail(`${item.path}: blocked_without_operator_decision must be true`);
  }
  if (item.destructive_action_allowed_now !== false) {
    fail(`${item.path}: destructive_action_allowed_now must be false`);
  }
}

const forbiddenTextPattern = new RegExp(
  String.raw`/Documents/` + "Codex|Relationship to " + String.raw`next|Next sub-pass`
);
if (forbiddenTextPattern.test(fs.readFileSync(queuePath, "utf8"))) {
  fail("operator review queue introduced forbidden local path or next-section text");
}

console.log(`documentation operator review queue ok (${queue.items.length} items)`);
