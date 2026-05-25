import fs from "node:fs";

const decisionPath = "data/documentation-public-registry-label-decision.v1.json";
const docsJsonPath = "data/docs.json";
const renameRiskRegisterPath = "data/documentation-rename-risk-register.v1.json";
const operatorReviewQueuePath = "data/documentation-operator-review-queue.v1.json";

const expectedLabels = new Map([
  [
    "ARTIFACT_CATALOG",
    {
      oldLabel: "AUDIT ARTIFACT CATALOG",
      newLabel: "EVIDENCE INDEX",
      riskDimensions: ["operational_maturity_implication"]
    }
  ],
  [
    "AUTHORITY_MODEL",
    {
      oldLabel: "AUTHORITY CONTROL MODEL",
      newLabel: "AUTHORITY BOUNDARY MODEL",
      riskDimensions: ["implementation_implication", "operational_maturity_implication"]
    }
  ],
  [
    "GATE_SPECIFICATIONS",
    {
      oldLabel: "GOVERNANCE GATE SPECIFICATIONS",
      newLabel: "GOVERNANCE CHECKPOINT SPECIFICATIONS",
      riskDimensions: ["operational_maturity_implication"]
    }
  ],
  [
    "ORCHESTRATION_MANUAL",
    {
      oldLabel: "HUMAN CONTROL SURFACE",
      newLabel: "HUMAN REVIEW BOUNDARY",
      riskDimensions: ["operational_maturity_implication"]
    }
  ],
  [
    "PIPELINE_OVERVIEW",
    {
      oldLabel: "GOVERNED PROTOTYPE FLOW",
      newLabel: "SCENARIO GOVERNANCE FLOW",
      riskDimensions: ["runtime_implication", "evidence_wall_effect"]
    }
  ],
  [
    "VERSION_LIFECYCLE",
    {
      oldLabel: "VERSION AND RELEASE LIFECYCLE",
      newLabel: "VERSIONING BOUNDARY NOTES",
      riskDimensions: ["operational_maturity_implication"]
    }
  ]
]);

const forbiddenLabelPattern =
  /\b(implementation|runtime|readiness|execution|adapter|pipeline|preflight|backend|persistence|auth|billing|stripe|database|gallery decision|visual spec|direct ui membrane|option e|track 3)\b/i;

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

const decision = readJson(decisionPath);
const docsJson = readJson(docsJsonPath);
const renameRiskRegister = readJson(renameRiskRegisterPath);
const operatorReviewQueue = readJson(operatorReviewQueuePath);

if (decision.schema_version !== "1.0") fail("schema_version must be 1.0");
if (decision.generated_for_sub_pass !== "Documentation Architecture Correction 0.5") {
  fail("generated_for_sub_pass mismatch");
}
if (decision.baseline_commit !== "3e9402f8a6246363ce06ed6002517224a3c0027b") {
  fail("baseline_commit mismatch");
}
if (decision.target_registry !== docsJsonPath) fail("target_registry mismatch");
if (decision.scope !== "public registry labels only") fail("scope mismatch");
if (decision.no_file_rename_authorized !== true) fail("no_file_rename_authorized must be true");
if (decision.no_document_rewrite_authorized !== true) {
  fail("no_document_rewrite_authorized must be true");
}
if (decision.no_public_navigation_addition_authorized !== true) {
  fail("no_public_navigation_addition_authorized must be true");
}
if (decision.no_public_navigation_removal_authorized !== true) {
  fail("no_public_navigation_removal_authorized must be true");
}
if (!Array.isArray(decision.items)) fail("items must be an array");
if (decision.items.length !== 6) fail("exactly six risky labels must be reviewed");

const docsById = new Map(docsJson.documents.map((doc) => [doc.id, doc]));
const itemIds = decision.items.map((item) => item.registry_id);
sameSet(itemIds, [...expectedLabels.keys()], "reviewed registry ids");
if (docsJson.documents.length !== 13) fail("data/docs.json entry count changed unexpectedly");

const renameRiskPaths = new Set(renameRiskRegister.items.map((item) => item.path));
const operatorReviewPaths = new Set(operatorReviewQueue.items.map((item) => item.path));

for (const item of decision.items) {
  const expected = expectedLabels.get(item.registry_id);
  const expectedPath = `data/docs.json#${item.registry_id}`;
  const doc = docsById.get(item.registry_id);

  if (!doc) fail(`${item.registry_id}: missing from data/docs.json`);
  if (item.path !== expectedPath) fail(`${item.registry_id}: path mismatch`);
  if (!renameRiskPaths.has(expectedPath)) fail(`${item.registry_id}: missing rename-risk source item`);
  if (!operatorReviewPaths.has(expectedPath)) fail(`${item.registry_id}: missing operator-review source item`);
  if (item.current_public_status !== "public_via_data_docs_json") {
    fail(`${item.registry_id}: current_public_status mismatch`);
  }
  if (item.decision !== "safe_label_patch_now") {
    fail(`${item.registry_id}: decision must be safe_label_patch_now`);
  }
  if (item.old_label !== expected.oldLabel) fail(`${item.registry_id}: old label mismatch`);
  if (item.new_label !== expected.newLabel) fail(`${item.registry_id}: new label mismatch`);
  sameSet(item.risk_dimensions, expected.riskDimensions, `${item.registry_id}: risk_dimensions`);
  if (item.patch_applied !== true) fail(`${item.registry_id}: patch_applied must be true`);
  if (item.operator_review_required !== false) {
    fail(`${item.registry_id}: operator_review_required must be false`);
  }
  if (item.underlying_file_renamed !== false) {
    fail(`${item.registry_id}: underlying_file_renamed must be false`);
  }
  if (item.underlying_document_rewritten !== false) {
    fail(`${item.registry_id}: underlying_document_rewritten must be false`);
  }
  if (doc.title === item.old_label) fail(`${item.registry_id}: old label still used as title`);
  if (doc.title !== item.new_label) fail(`${item.registry_id}: new label is not current title`);
  if ("href" in doc || "path" in doc) fail(`${item.registry_id}: path or href field was introduced`);
  if (forbiddenLabelPattern.test(item.new_label)) {
    fail(`${item.registry_id}: forbidden implementation term introduced in label`);
  }
}

const docsText = fs.readFileSync(docsJsonPath, "utf8");
for (const forbiddenRegistryRef of [
  "documentation-surface-inventory",
  "documentation-surface-routing-plan",
  "documentation-public-navigation-pruning",
  "documentation-operator-review-queue",
  "documentation-rename-risk-register",
  "documentation-public-registry-label-decision"
]) {
  if (docsText.includes(forbiddenRegistryRef)) {
    fail(`${forbiddenRegistryRef} must not be promoted through data/docs.json`);
  }
}

if (decision.summary.labels_reviewed !== 6) fail("summary.labels_reviewed mismatch");
if (decision.summary.labels_patched !== 6) fail("summary.labels_patched mismatch");
if (decision.summary.operator_decision_required !== 0) {
  fail("summary.operator_decision_required mismatch");
}
if (decision.summary.removed_from_navigation !== 0) fail("summary.removed_from_navigation mismatch");
if (decision.summary.files_renamed !== 0) fail("summary.files_renamed mismatch");
if (decision.summary.documents_rewritten !== 0) fail("summary.documents_rewritten mismatch");
if (decision.summary.paths_or_hrefs_changed !== false) fail("summary.paths_or_hrefs_changed mismatch");
if (!Array.isArray(decision.summary.risky_labels_still_public_after_patch)) {
  fail("summary.risky_labels_still_public_after_patch must be an array");
}
if (decision.summary.risky_labels_still_public_after_patch.length !== 0) {
  fail("risky labels still public after patch must be empty");
}

console.log("documentation public registry label decision ok (6 labels reviewed, 6 patched)");
