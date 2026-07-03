import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  deterministicHash,
  evidenceRecordFacts
} from "../../../palisade/runtime/v0/palisade-current-state-evidence.mjs";

export const conduitCurrentStateEvidenceModulePath = "conduit/runtime/v0/conduit-current-state-evidence.mjs";
export const conduitEvidenceAcquisitionVersion = "0.1.0";

export class ConduitCurrentStateEvidenceError extends Error {
  constructor(failure_classification, stage, reasons, details = []) {
    super(reasons.join("; "));
    this.name = "ConduitCurrentStateEvidenceError";
    this.failure_classification = failure_classification;
    this.stage = stage;
    this.reasons = reasons;
    this.details = details;
  }
}

function conduitRepositoryRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeRepositoryPath(repoRoot, repositoryPath) {
  const errors = [];
  if (typeof repositoryPath !== "string" || repositoryPath.trim() === "") {
    errors.push("repository path must be a non-empty string");
  }
  if (path.isAbsolute(repositoryPath)) errors.push("absolute repository paths are prohibited");
  if (repositoryPath.includes("..")) errors.push("repository path traversal is prohibited");
  if (repositoryPath.startsWith(".track3-runs/") || repositoryPath.includes("/.track3-runs/")) {
    errors.push("ignored run directories cannot be acquired as evidence");
  }
  if (/^[a-z]+:\/\//i.test(repositoryPath)) errors.push("network URLs cannot be acquired as evidence");
  if (repositoryPath.startsWith("geo/")) errors.push("GEO paths are not Palisade runtime evidence sources");
  if (errors.length > 0) {
    throw new ConduitCurrentStateEvidenceError("unauthorized_evidence_path", "repository_path_resolution", errors, [
      { repository_path: repositoryPath }
    ]);
  }

  const absolutePath = path.resolve(repoRoot, repositoryPath);
  const relative = path.relative(repoRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ConduitCurrentStateEvidenceError("repository_escape", "repository_path_resolution", [
      `Resolved path escapes repository root: ${repositoryPath}`
    ]);
  }
  return absolutePath;
}

function parseJson(bytes, source) {
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    return {
      parse_status: "parsed",
      parsed_facts: evidenceRecordFacts(parsed),
      declared_version: evidenceRecordFacts(parsed).version,
      declared_status: evidenceRecordFacts(parsed).status,
      error_classification: null
    };
  } catch (error) {
    return {
      parse_status: "malformed",
      parsed_facts: {},
      declared_version: null,
      declared_status: null,
      error_classification: `malformed_json:${source.source_id}:${error.message}`
    };
  }
}

function acquireRecord(repoRoot, source) {
  const absolutePath = safeRepositoryPath(repoRoot, source.repository_path);
  const base = {
    source_id: source.source_id,
    repository_path: source.repository_path,
    owning_layer: source.owning_layer,
    artifact_class: source.artifact_class,
    authority_classification: source.authority_classification,
    evidence_meaning: source.evidence_meaning,
    update_mechanism: source.update_mechanism,
    required_acquisition: source.required_acquisition,
    parser_expectation: source.parser_expectation,
    acquisition_version: conduitEvidenceAcquisitionVersion,
    provenance: source.provenance
  };

  if (!fs.existsSync(absolutePath)) {
    return {
      ...base,
      existence_status: "missing",
      read_status: "not_read",
      parse_status: "not_attempted",
      declared_version: null,
      declared_status: null,
      byte_count: 0,
      sha256: null,
      parsed_facts: {},
      error_classification: `missing_source:${source.source_id}`
    };
  }

  let realRoot;
  let realPath;
  try {
    realRoot = fs.realpathSync(repoRoot);
    realPath = fs.realpathSync(absolutePath);
  } catch (error) {
    return {
      ...base,
      existence_status: "exists",
      read_status: "not_read",
      parse_status: "not_attempted",
      declared_version: null,
      declared_status: null,
      byte_count: 0,
      sha256: null,
      parsed_facts: {},
      error_classification: `realpath_failure:${source.source_id}:${error.message}`
    };
  }
  const relativeReal = path.relative(realRoot, realPath);
  if (relativeReal.startsWith("..") || path.isAbsolute(relativeReal)) {
    throw new ConduitCurrentStateEvidenceError("repository_escape", "repository_path_resolution", [
      `Resolved realpath escapes repository root: ${source.repository_path}`
    ]);
  }

  let bytes;
  try {
    bytes = fs.readFileSync(absolutePath);
  } catch (error) {
    return {
      ...base,
      existence_status: "exists",
      read_status: "read_failed",
      parse_status: "not_attempted",
      declared_version: null,
      declared_status: null,
      byte_count: 0,
      sha256: null,
      parsed_facts: {},
      error_classification: `read_failed:${source.source_id}:${error.message}`
    };
  }

  const common = {
    ...base,
    existence_status: "exists",
    read_status: "read",
    byte_count: bytes.length,
    sha256: sha256Buffer(bytes)
  };

  if (source.parser_expectation === "json") {
    return {
      ...common,
      ...parseJson(bytes, source)
    };
  }
  return {
    ...common,
    parse_status: "not_applicable",
    declared_version: null,
    declared_status: null,
    parsed_facts: {},
    error_classification: null
  };
}

function validatePlan(acquisitionPlan) {
  const errors = [];
  if (!isObject(acquisitionPlan)) errors.push("acquisition plan must be an object");
  for (const field of [
    "contract_id",
    "contract_version",
    "contract_path",
    "contract_sha256",
    "acquisition_plan_hash",
    "source_plan_projection_hash",
    "source_plan"
  ]) {
    if (!(field in (acquisitionPlan || {}))) errors.push(`acquisition plan missing ${field}`);
  }
  if (!Array.isArray(acquisitionPlan?.source_plan) || acquisitionPlan.source_plan.length === 0) {
    errors.push("acquisition plan source_plan must be a non-empty array");
  }
  const ids = new Set();
  for (const [index, source] of (acquisitionPlan?.source_plan || []).entries()) {
    if (!isObject(source)) {
      errors.push(`source_plan[${index}] must be an object`);
      continue;
    }
    if (ids.has(source.source_id)) errors.push(`source_plan[${index}] duplicate source_id ${source.source_id}`);
    ids.add(source.source_id);
    try {
      safeRepositoryPath(conduitRepositoryRoot(), source.repository_path);
    } catch (error) {
      errors.push(...(error.reasons || [error.message]));
    }
  }
  if (errors.length > 0) {
    throw new ConduitCurrentStateEvidenceError("malformed_acquisition_plan", "acquisition_plan_validation", errors);
  }
}

export function acquireConduitCurrentStateEvidence(acquisitionPlan, options = {}) {
  validatePlan(acquisitionPlan);
  const repoRoot = options.repoRoot || conduitRepositoryRoot();
  const records = acquisitionPlan.source_plan.map((source) => acquireRecord(repoRoot, source));
  const snapshotBase = {
    snapshot_version: conduitEvidenceAcquisitionVersion,
    contract_id: acquisitionPlan.contract_id,
    contract_version: acquisitionPlan.contract_version,
    contract_path: acquisitionPlan.contract_path,
    contract_sha256: acquisitionPlan.contract_sha256,
    acquisition_plan_hash: acquisitionPlan.acquisition_plan_hash,
    source_plan_projection_hash: acquisitionPlan.source_plan_projection_hash,
    records
  };
  return {
    ...snapshotBase,
    snapshot_hash: deterministicHash({
      contract_id: snapshotBase.contract_id,
      contract_version: snapshotBase.contract_version,
      contract_path: snapshotBase.contract_path,
      contract_sha256: snapshotBase.contract_sha256,
      acquisition_plan_hash: snapshotBase.acquisition_plan_hash,
      source_plan_projection_hash: snapshotBase.source_plan_projection_hash,
      records
    })
  };
}
