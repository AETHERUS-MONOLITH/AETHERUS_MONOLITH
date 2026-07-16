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

const postInventoryCorrectionArtifacts = new Set([
  "data/documentation-surface-routing-plan.v1.json",
  "scripts/validate-documentation-surface-routing-plan.mjs",
  "data/documentation-public-navigation-pruning.v1.json",
  "scripts/validate-documentation-public-navigation-pruning.mjs",
  "data/documentation-operator-review-queue.v1.json",
  "scripts/validate-documentation-operator-review-queue.mjs",
  "data/documentation-rename-risk-register.v1.json",
  "scripts/validate-documentation-rename-risk-register.mjs",
  "data/documentation-public-registry-label-decision.v1.json",
  "scripts/validate-documentation-public-registry-label-decision.mjs",
  "data/direct-ui-membrane-static-shell.v0.json",
  "scripts/validate-direct-ui-membrane-static-shell.mjs",
  "data/direct-ui-membrane-static-shell-qa.v0.json",
  "data/direct-ui-membrane-static-shell-content.v0.json",
  "data/direct-ui-membrane-preview-workspace.v0.json",
  "data/direct-ui-membrane-auth-backend-boundary.v0.json",
  "scripts/validate-direct-ui-membrane-preview-workspace.mjs",
  "data/direct-ui-membrane-auth-route-boundary.v0.json",
  "scripts/validate-direct-ui-membrane-auth-route-boundary.mjs",
  "data/direct-ui-membrane-auth-implementation-readiness-gate.v0.json",
  "scripts/validate-direct-ui-membrane-auth-implementation-readiness-gate.mjs",
  "data/direct-ui-membrane-backend-auth-stack-decision-matrix.v0.json",
  "scripts/validate-direct-ui-membrane-backend-auth-stack-decision-matrix.mjs",
  "data/direct-ui-membrane-supabase-project-boundary.v0.json",
  "scripts/validate-direct-ui-membrane-supabase-project-boundary.mjs",
  "data/direct-ui-membrane-env-secret-hygiene-gate.v0.json",
  "scripts/validate-direct-ui-membrane-env-secret-hygiene-gate.mjs",
  "data/direct-ui-membrane-supabase-client-initialization-boundary.v0.json",
  "scripts/validate-direct-ui-membrane-supabase-client-initialization-boundary.mjs",
  "data/direct-ui-membrane-auth-route-callback-contract.v0.json",
  "scripts/validate-direct-ui-membrane-auth-route-callback-contract.mjs",
  "data/direct-ui-membrane-protected-route-guard-contract.v0.json",
  "scripts/validate-direct-ui-membrane-protected-route-guard-contract.mjs",
  "data/direct-ui-membrane-login-surface-contract.v0.json",
  "scripts/validate-direct-ui-membrane-login-surface-contract.mjs",
  "data/direct-ui-membrane-supabase-client-scaffold.v0.json",
  "scripts/validate-direct-ui-membrane-supabase-client-scaffold.mjs",
  "data/direct-ui-membrane-supabase-dependency-config-decision.v0.json",
  "scripts/validate-direct-ui-membrane-supabase-dependency-config-decision.mjs",
  "data/direct-ui-membrane-conditional-supabase-client-initialization.v0.json",
  "scripts/validate-direct-ui-membrane-conditional-supabase-client-initialization.mjs",
  "data/direct-ui-membrane-auth-callback-session-guard-precondition.v0.json",
  "scripts/validate-direct-ui-membrane-auth-callback-session-guard-precondition.mjs",
  "data/direct-ui-membrane-provider-login-initiation.v0.json",
  "scripts/validate-direct-ui-membrane-provider-login-initiation.mjs",
  "data/direct-ui-membrane-protected-shell-birth-gate.v0.json",
  "scripts/validate-direct-ui-membrane-protected-shell-birth-gate.mjs",
  "data/direct-ui-membrane-live-provider-loop-verification.v0.json",
  "scripts/validate-direct-ui-membrane-live-provider-loop-verification.mjs",
  "data/direct-ui-membrane-pages-runtime-config-deployment.v0.json",
  "data/direct-ui-membrane-oauth-flow-alignment.v0.json",
  "data/direct-ui-membrane-callback-exchange-diagnostics.v0.json",
  "scripts/validate-direct-ui-membrane-callback-exchange-diagnostics.mjs",
  "data/direct-ui-membrane-auth-storage-boundary-decision.v0.json",
  "scripts/validate-direct-ui-membrane-auth-storage-boundary-decision.mjs",
  "data/direct-ui-membrane-auth-storage-implementation.v0.json",
  "scripts/validate-direct-ui-membrane-auth-storage-implementation.mjs",
  "data/product-negative-space-backlog.v0.json",
  "scripts/validate-product-language-boundary.mjs",
  "data/operational-evidence-packet-contract.v0.json",
  "scripts/validate-operational-evidence-packet-contract.mjs",
  "data/readme-artifact-classification-sobriety.v0.json",
  "scripts/validate-readme-artifact-classification-sobriety.mjs",
  "data/direct-ui-membrane-protected-workspace-frame.v0.json",
  "scripts/validate-direct-ui-membrane-protected-workspace-frame.mjs",
  "data/direct-ui-membrane-protected-workspace-interaction.v0.json",
  "scripts/validate-direct-ui-membrane-protected-workspace-interaction.mjs",
  "data/direct-ui-membrane-protected-workspace-persistence.v0.json",
  "scripts/validate-direct-ui-membrane-protected-workspace-persistence.mjs",
  "data/public-surface-execution-audit.v0.json",
  "scripts/validate-public-surface-execution-audit.mjs",
  "data/github-pages-governable-deployment-action.v0.json",
  "data/github-pages-governable-deployment-boundary.v0.json",
  "data/github-pages-supabase-execution-package.v0.json",
  "data/github-pages-supabase-execution-receipt.v0.json"
]);

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
]
  .filter((artifactPath) => !postInventoryCorrectionArtifacts.has(artifactPath))
  .sort();

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
