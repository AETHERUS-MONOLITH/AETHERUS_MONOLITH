import fs from "node:fs";
import path from "node:path";

const inventoryPath = "data/documentation-surface-inventory.v1.json";
const docsJsonPath = "data/docs.json";

const allowed = {
  audience: [
    "public_reader",
    "future_implementer",
    "operator_memory",
    "recipient_reasoning",
    "codex_execution",
    "machine_validator",
    "historical_evidence"
  ],
  artifact_type: [
    "public_explanation",
    "canonical_architecture_spec",
    "implementation_prerequisite",
    "machine_validation_artifact",
    "historical_sub_pass_record",
    "handoff_only_content",
    "process_residue",
    "public_navigation_metadata"
  ],
  public_surface_status: [
    "keep_public",
    "keep_public_but_rename_later",
    "consolidate_later",
    "archive_later",
    "remove_from_public_navigation_later",
    "handoff_only_later",
    "needs_operator_review"
  ],
  risk_flags: [
    "internal_process_language",
    "codex_residue",
    "next_pass_language",
    "repeated_boundary_boilerplate",
    "misleading_operational_label",
    "overexposed_planning",
    "public_discoverability_excess",
    "old_path_reference",
    "claim_boundary_risk"
  ]
};

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sortedTopLevelFiles(directory, extension) {
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(extension))
    .map((name) => path.posix.join(directory, name))
    .sort();
}

const inventory = readJson(inventoryPath);

if (inventory.schema_version !== "1.0") fail("schema_version must be 1.0");
if (!Array.isArray(inventory.artifacts)) fail("artifacts must be an array");
if (!inventory.document_admission_gate) fail("document_admission_gate is required");
if (!inventory.classification_dimensions) fail("classification_dimensions is required");

for (const [key, values] of Object.entries(allowed)) {
  const actual = inventory.classification_dimensions[key];
  if (!Array.isArray(actual)) fail(`classification_dimensions.${key} must be an array`);
  for (const value of values) {
    if (!actual.includes(value)) fail(`classification_dimensions.${key} missing ${value}`);
  }
}

const requiredArtifacts = [
  "README.md",
  docsJsonPath,
  inventoryPath,
  "scripts/validate-documentation-surface-inventory.mjs",
  ...sortedTopLevelFiles("docs", ".md"),
  ...sortedTopLevelFiles("data", ".json")
].sort();

const seen = new Set();
for (const artifact of inventory.artifacts) {
  if (!artifact || typeof artifact !== "object") fail("artifact entries must be objects");
  if (!artifact.path) fail("artifact.path is required");
  if (seen.has(artifact.path)) fail(`duplicate artifact: ${artifact.path}`);
  seen.add(artifact.path);

  if (!allowed.audience.includes(artifact.audience)) fail(`${artifact.path}: invalid audience`);
  if (!allowed.artifact_type.includes(artifact.artifact_type)) {
    fail(`${artifact.path}: invalid artifact_type`);
  }
  if (!allowed.public_surface_status.includes(artifact.public_surface_status)) {
    fail(`${artifact.path}: invalid public_surface_status`);
  }
  if (!Array.isArray(artifact.risk_flags)) fail(`${artifact.path}: risk_flags must be an array`);
  for (const flag of artifact.risk_flags) {
    if (!allowed.risk_flags.includes(flag)) fail(`${artifact.path}: invalid risk flag ${flag}`);
  }
  if (!Array.isArray(artifact.evidence_snippets)) {
    fail(`${artifact.path}: evidence_snippets must be an array`);
  }
  if (artifact.destructive_change_required_now !== false) {
    fail(`${artifact.path}: destructive_change_required_now must be false`);
  }
}

for (const artifactPath of requiredArtifacts) {
  if (!seen.has(artifactPath)) fail(`missing inventory artifact: ${artifactPath}`);
}

const summaryCounts = {};
for (const artifact of inventory.artifacts) {
  summaryCounts[artifact.public_surface_status] =
    (summaryCounts[artifact.public_surface_status] || 0) + 1;
}

const actualSummary = inventory.summary_counts || {};
for (const [status, count] of Object.entries(summaryCounts)) {
  if (actualSummary[status] !== count) {
    fail(`summary_counts.${status} expected ${count}, found ${actualSummary[status]}`);
  }
}

const docsJsonText = fs.readFileSync(docsJsonPath, "utf8");
if (docsJsonText.includes(inventoryPath)) {
  fail("inventory must not be promoted through data/docs.json");
}

const blocked = inventory.blocked_follow_on_work_until_operator_or_correction || [];
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

console.log(`documentation surface inventory ok (${inventory.artifacts.length} artifacts)`);
