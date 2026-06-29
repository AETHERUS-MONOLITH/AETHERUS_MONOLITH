import fs from "node:fs";

const reportPath = "data/public-surface-execution-audit.v0.json";

const requiredTopLevel = [
  "audit_id",
  "baseline_commit",
  "inspected_surfaces",
  "findings",
  "production_workspace_threshold_assessment",
  "runtime_governance_path_assessment",
  "palisade_policy_candidate_boundaries",
  "next_pass_recommendation"
];

const requiredFindingFields = [
  "id",
  "severity",
  "category",
  "file",
  "selector_or_string",
  "current_text",
  "problem",
  "required_change",
  "implementation_or_copy",
  "next_pass_relevance"
];

const allowedSeverities = new Set(["blocker", "high", "medium", "low"]);
const allowedCategories = new Set([
  "public_language_current_state",
  "internal_label_exposure",
  "permanent_limitation_language",
  "README_handoff_conflict",
  "staged_surface_disciplined",
  "staged_surface_evasive",
  "threshold_underdefinition",
  "policy_candidate_boundary",
  "implementation_required"
]);
const allowedStates = new Set(["exists", "partial", "stubbed", "absent", "unverified"]);

const thresholdKeys = [
  "real_authenticated_shell",
  "live_workspace_data_model",
  "server_side_authorization",
  "tenant_scoped_persistence",
  "membership_account_separation",
  "operational_workspace_surfaces",
  "durable_evidence_audit_trail",
  "runtime_governance_path"
];

const runtimeKeys = [
  "Facade",
  "Conduit",
  "Palisade_policy_decision",
  "Vault_NEXUS_evaluation",
  "evidence_audit_record",
  "release_state_decision",
  "surfaced_result"
];

function fail(message) {
  throw new Error(message);
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label} must be a non-empty string`);
  }
}

function assertAssessmentEntry(value, label) {
  assertObject(value, label);
  if (!allowedStates.has(value.state)) {
    fail(`${label}.state must be one of ${Array.from(allowedStates).join(", ")}`);
  }
  assertNonEmptyString(value.evidence, `${label}.evidence`);
}

function assertNoRejectedTerms(rawText) {
  if (/\blater\b/i.test(rawText)) {
    fail(`${reportPath}: rejected term "later" appears in the audit report`);
  }
  if (/(palisade.{0,120}\bminimal\b|\bminimal\b.{0,120}palisade)/i.test(rawText)) {
    fail(`${reportPath}: rejected Palisade construction framing uses "minimal"`);
  }
}

if (!fs.existsSync(reportPath)) {
  fail(`${reportPath} is missing`);
}

const rawText = fs.readFileSync(reportPath, "utf8");
assertNoRejectedTerms(rawText);

const report = JSON.parse(rawText);
assertObject(report, reportPath);

for (const key of requiredTopLevel) {
  if (!(key in report)) fail(`${reportPath}: missing required section ${key}`);
}

assertNonEmptyString(report.audit_id, "audit_id");
assertNonEmptyString(report.baseline_commit, "baseline_commit");

if (!Array.isArray(report.inspected_surfaces) || report.inspected_surfaces.length === 0) {
  fail("inspected_surfaces must be a non-empty array");
}

for (const [index, surface] of report.inspected_surfaces.entries()) {
  assertObject(surface, `inspected_surfaces[${index}]`);
  assertNonEmptyString(surface.surface, `inspected_surfaces[${index}].surface`);
  assertNonEmptyString(surface.file_or_url, `inspected_surfaces[${index}].file_or_url`);
  assertNonEmptyString(surface.surface_type, `inspected_surfaces[${index}].surface_type`);
  assertNonEmptyString(surface.inspection_result, `inspected_surfaces[${index}].inspection_result`);
}

if (!Array.isArray(report.findings) || report.findings.length === 0) {
  fail("findings must be a non-empty array");
}

const findingIds = new Set();
for (const [index, finding] of report.findings.entries()) {
  assertObject(finding, `findings[${index}]`);
  for (const field of requiredFindingFields) {
    if (!(field in finding)) fail(`findings[${index}] missing ${field}`);
    assertNonEmptyString(finding[field], `findings[${index}].${field}`);
  }
  if (findingIds.has(finding.id)) fail(`duplicate finding id ${finding.id}`);
  findingIds.add(finding.id);
  if (!allowedSeverities.has(finding.severity)) {
    fail(`${finding.id}: invalid severity ${finding.severity}`);
  }
  if (!allowedCategories.has(finding.category)) {
    fail(`${finding.id}: invalid category ${finding.category}`);
  }
  if (!["implementation", "copy"].includes(finding.implementation_or_copy)) {
    fail(`${finding.id}: implementation_or_copy must be implementation or copy`);
  }
  const hasExactFile = /^https?:\/\//.test(finding.file) || /:\d+$/.test(finding.file);
  if (!hasExactFile) {
    fail(`${finding.id}: file must include an exact line reference or deployed URL`);
  }
}

assertObject(report.production_workspace_threshold_assessment, "production_workspace_threshold_assessment");
for (const key of thresholdKeys) {
  if (!(key in report.production_workspace_threshold_assessment)) {
    fail(`production_workspace_threshold_assessment missing ${key}`);
  }
  assertAssessmentEntry(report.production_workspace_threshold_assessment[key], `production_workspace_threshold_assessment.${key}`);
}

assertObject(report.runtime_governance_path_assessment, "runtime_governance_path_assessment");
for (const key of runtimeKeys) {
  if (!(key in report.runtime_governance_path_assessment)) {
    fail(`runtime_governance_path_assessment missing ${key}`);
  }
  assertAssessmentEntry(report.runtime_governance_path_assessment[key], `runtime_governance_path_assessment.${key}`);
}

if (!Array.isArray(report.palisade_policy_candidate_boundaries) || report.palisade_policy_candidate_boundaries.length === 0) {
  fail("palisade_policy_candidate_boundaries must be a non-empty array");
}

for (const [index, boundary] of report.palisade_policy_candidate_boundaries.entries()) {
  assertObject(boundary, `palisade_policy_candidate_boundaries[${index}]`);
  for (const field of ["id", "boundary", "current_home", "current_location_type", "candidate_policy_decision"]) {
    assertNonEmptyString(boundary[field], `palisade_policy_candidate_boundaries[${index}].${field}`);
  }
}

assertObject(report.next_pass_recommendation, "next_pass_recommendation");
if (typeof report.next_pass_recommendation.proceed_to_palisade_policy_artifact !== "boolean") {
  fail("next_pass_recommendation.proceed_to_palisade_policy_artifact must be boolean");
}
assertNonEmptyString(
  report.next_pass_recommendation.first_required_fix_before_palisade,
  "next_pass_recommendation.first_required_fix_before_palisade"
);
assertNonEmptyString(report.next_pass_recommendation.rationale, "next_pass_recommendation.rationale");

console.log(`${reportPath} passes public-surface execution audit validation`);
