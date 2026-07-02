import fs from "node:fs";
import path from "node:path";

import {
  allowedPalisadeDecisions,
  allowedRuntimeStatuses,
  evaluatePolicyDecision,
  palisadeDecisionSchemaPath,
  palisadeInputSchemaPath,
  palisadeManifestPath,
  palisadePolicyPath
} from "./palisade-policy-engine.mjs";

export const palisadeDecisionBoundaryPath = "palisade/runtime/v0/palisade-decision-boundary.mjs";
export const interfaceContractPath = "data/interface-contract.v1.json";
export const conduitVersioningPolicyPath = "data/conduit-versioning-policy.v1.json";

const expectedInterfaceContractVersion = "1.0.0";
const expectedConduitVersioningPolicyVersion = "1.0.0";
const expectedPalisadePolicyBundleVersion = "0.1.0";

const componentStateFields = ["state", "verified", "evidence"];
const bypassInputFields = new Set([
  "allowed",
  "decision",
  "runtime_enforcement_status",
  "runtime_status_override",
  "policy_bypass",
  "skip_validation"
]);

function repositoryPath(repoRoot, relativePath) {
  return path.resolve(repoRoot, relativePath);
}

function readJsonArtifact(repoRoot, relativePath, stage, classification) {
  const absolutePath = repositoryPath(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return {
      ok: false,
      failure: boundaryFailure({
        stage,
        failure_classification: classification,
        provenance: relativePath,
        reasons: [`Required Palisade runtime artifact is missing: ${relativePath}`]
      })
    };
  }
  try {
    return {
      ok: true,
      value: JSON.parse(fs.readFileSync(absolutePath, "utf8"))
    };
  } catch (error) {
    return {
      ok: false,
      failure: boundaryFailure({
        stage,
        failure_classification: "malformed_policy_artifact",
        provenance: relativePath,
        reasons: [`Unable to parse JSON artifact ${relativePath}: ${error.message}`]
      })
    };
  }
}

function boundaryFailure({
  stage,
  failure_classification,
  provenance,
  reasons,
  request,
  details = []
}) {
  return {
    boundary_failure: true,
    allowed: false,
    failure_classification,
    stage,
    provenance,
    reasons,
    details,
    request_identity: request?.request_id || null,
    trace_identity: request?.trace_id || request?.trace_identity || null,
    correlation_identity: request?.correlation_id || request?.correlation_identity || null
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function schemaPointer(root, ref) {
  if (!ref.startsWith("#/")) return undefined;
  return ref
    .slice(2)
    .split("/")
    .reduce((current, segment) => current?.[segment.replaceAll("~1", "/").replaceAll("~0", "~")], root);
}

function validateJsonSchema(schema, value, label, rootSchema = schema) {
  const errors = [];

  function visit(currentSchema, currentValue, currentLabel) {
    const resolved = currentSchema?.$ref ? schemaPointer(rootSchema, currentSchema.$ref) : currentSchema;
    if (!resolved) {
      errors.push(`${currentLabel}: unresolved schema reference ${currentSchema?.$ref}`);
      return;
    }

    if (resolved.enum && !resolved.enum.includes(currentValue)) {
      errors.push(`${currentLabel}: unsupported value ${JSON.stringify(currentValue)}`);
    }

    if (resolved.type === "object") {
      if (!isObject(currentValue)) {
        errors.push(`${currentLabel}: expected object`);
        return;
      }
      for (const field of resolved.required || []) {
        if (!(field in currentValue)) errors.push(`${currentLabel}: missing required field ${field}`);
      }
      if (resolved.additionalProperties === false) {
        const allowed = new Set(Object.keys(resolved.properties || {}));
        for (const field of Object.keys(currentValue)) {
          if (!allowed.has(field)) errors.push(`${currentLabel}: prohibited field ${field}`);
        }
      }
      for (const [field, fieldSchema] of Object.entries(resolved.properties || {})) {
        if (field in currentValue) visit(fieldSchema, currentValue[field], `${currentLabel}.${field}`);
      }
    }

    if (resolved.type === "array") {
      if (!Array.isArray(currentValue)) {
        errors.push(`${currentLabel}: expected array`);
        return;
      }
      if (Number.isInteger(resolved.minItems) && currentValue.length < resolved.minItems) {
        errors.push(`${currentLabel}: expected at least ${resolved.minItems} item(s)`);
      }
      if (resolved.items) {
        currentValue.forEach((item, index) => visit(resolved.items, item, `${currentLabel}[${index}]`));
      }
    }

    if (resolved.type === "string") {
      if (typeof currentValue !== "string") {
        errors.push(`${currentLabel}: expected string`);
      } else if (Number.isInteger(resolved.minLength) && currentValue.length < resolved.minLength) {
        errors.push(`${currentLabel}: expected non-empty string`);
      }
    }

    if (resolved.type === "boolean" && typeof currentValue !== "boolean") {
      errors.push(`${currentLabel}: expected boolean`);
    }
  }

  visit(schema, value, label);
  return errors;
}

function validateVersionCompatibility({ manifest, policy, interfaceContract, conduitPolicy }) {
  const errors = [];
  const interfaceVersion = interfaceContract.metadata?.version;
  const conduitVersion = conduitPolicy.metadata?.version;
  const conduitBoundary = conduitPolicy.palisade_contract_readiness_boundary || {};
  const interfaceBoundary = interfaceContract.palisade_contract_readiness_boundary || {};

  if (interfaceVersion !== expectedInterfaceContractVersion) {
    errors.push(`unsupported interface contract version ${interfaceVersion || "missing"}`);
  }
  if (conduitVersion !== expectedConduitVersioningPolicyVersion) {
    errors.push(`unsupported Conduit versioning policy version ${conduitVersion || "missing"}`);
  }
  if (manifest.version !== expectedPalisadePolicyBundleVersion) {
    errors.push(`unsupported Palisade manifest version ${manifest.version || "missing"}`);
  }
  if (policy.version !== manifest.version) {
    errors.push(`policy artifact version ${policy.version || "missing"} does not match manifest ${manifest.version}`);
  }
  if (interfaceBoundary.version_compatibility?.policy_bundle_version_supported !== manifest.version) {
    errors.push("interface contract does not support the loaded Palisade policy bundle version");
  }
  if (conduitBoundary.version_compatibility?.palisade_policy_bundle_version !== manifest.version) {
    errors.push("Conduit versioning policy does not support the loaded Palisade policy bundle version");
  }
  if (conduitBoundary.version_compatibility?.unsupported_version_behavior !== "fail_closed") {
    errors.push("Conduit versioning policy does not preserve fail-closed unsupported-version behavior");
  }
  return errors;
}

function validatePolicyArtifact(policy) {
  const errors = [];
  if (!isObject(policy)) errors.push("policy artifact must be an object");
  if (policy.owner !== "Palisade") errors.push("policy owner must be Palisade");
  if (!Array.isArray(policy.rules) || policy.rules.length === 0) errors.push("policy rules must be a non-empty array");
  if (!Array.isArray(policy.decision_outputs)) errors.push("policy decision_outputs must be an array");
  for (const decision of policy.decision_outputs || []) {
    if (!allowedPalisadeDecisions.has(decision)) errors.push(`policy declares unsupported decision output ${decision}`);
  }
  if (!Array.isArray(policy.production_workspace_threshold?.required_components)) {
    errors.push("policy missing production workspace threshold components");
  }
  if (!Array.isArray(policy.runtime_governance_path?.ordered_components)) {
    errors.push("policy missing runtime governance path components");
  }
  return errors;
}

function validateInterfaceContract(request, interfaceContract) {
  const boundary = interfaceContract.palisade_contract_readiness_boundary || {};
  const errors = [];
  for (const field of boundary.request_fields || []) {
    if (!(field in request)) errors.push(`request missing interface contract field ${field}`);
  }
  for (const field of Object.keys(request)) {
    if (bypassInputFields.has(field)) errors.push(`request attempts prohibited caller-controlled field ${field}`);
  }
  if ((request.current_repository_state_basis || []).some((source) => source.includes(".track3-runs"))) {
    errors.push("current_repository_state_basis must not use ignored .track3-runs state as runtime evidence");
  }
  return errors;
}

function validateEvidenceConsistency(request) {
  const errors = [];
  for (const [stateName, state] of [
    ["production_workspace_threshold_state", request.production_workspace_threshold_state],
    ["runtime_governance_path_state", request.runtime_governance_path_state]
  ]) {
    for (const [component, entry] of Object.entries(state || {})) {
      for (const field of componentStateFields) {
        if (!(field in entry)) errors.push(`${stateName}.${component} missing ${field}`);
      }
      if (entry.state === "exists" && entry.verified !== true) {
        errors.push(`${stateName}.${component} is state exists but not verified`);
      }
      if (entry.state !== "exists" && entry.verified === true) {
        errors.push(`${stateName}.${component} is verified without state exists`);
      }
    }
  }
  return errors;
}

function validatePolicyRequestCompatibility(request, policy) {
  const rule = (policy.rules || []).find((entry) => entry.claim_id === request.claim_id);
  if (!rule) return [`no policy rule exists for claim ${request.claim_id}`];
  if (!rule.requested_actions?.includes(request.requested_action)) {
    return [`requested_action ${request.requested_action} is not supported for claim ${request.claim_id}`];
  }
  return [];
}

function validateDecisionContract(request, decision, interfaceContract, policy) {
  const errors = [];
  const decisionFields = interfaceContract.palisade_contract_readiness_boundary?.decision_fields || [];
  for (const field of decisionFields) {
    if (!(field in decision)) errors.push(`decision missing interface contract field ${field}`);
  }
  if (decision.claim_id !== request.claim_id) errors.push("decision claim_id does not match request");
  if (decision.surface !== request.surface) errors.push("decision surface does not match request");
  if (decision.requested_action !== request.requested_action) errors.push("decision requested_action does not match request");
  if (decision.allowed !== (decision.decision === "allow")) errors.push("decision allowed flag conflicts with decision state");
  if (!allowedPalisadeDecisions.has(decision.decision)) errors.push(`decision has unsupported state ${decision.decision}`);
  if (!allowedRuntimeStatuses.has(decision.runtime_enforcement_status)) {
    errors.push(`decision has unsupported runtime_enforcement_status ${decision.runtime_enforcement_status}`);
  }
  if (
    request.claim_id !== "operator_review_escalation" &&
    decision.runtime_enforcement_status !== (policy.runtime_enforcement?.current_status || "unavailable")
  ) {
    errors.push("decision runtime_enforcement_status does not reflect synchronized current policy state");
  }
  if (decision.decision === "requires_operator_review" && decision.allowed === true) {
    errors.push("requires_operator_review must not allow execution");
  }
  if (decision.decision === "requires_evidence" && decision.allowed === true) {
    errors.push("requires_evidence must not allow execution");
  }
  if (decision.decision === "runtime_enforcement_unavailable" && decision.allowed === true) {
    errors.push("runtime_enforcement_unavailable must not allow execution");
  }
  return errors;
}

function loadRuntimeArtifacts(repoRoot) {
  const artifacts = {};
  for (const [name, relativePath, stage, classification] of [
    ["manifest", palisadeManifestPath, "policy_loading", "missing_policy_artifact"],
    ["inputSchema", palisadeInputSchemaPath, "schema_loading", "missing_schema_artifact"],
    ["decisionSchema", palisadeDecisionSchemaPath, "schema_loading", "missing_schema_artifact"],
    ["interfaceContract", interfaceContractPath, "contract_loading", "missing_contract_artifact"],
    ["conduitPolicy", conduitVersioningPolicyPath, "contract_loading", "missing_contract_artifact"],
    ["policy", palisadePolicyPath, "policy_loading", "missing_policy_artifact"]
  ]) {
    const loaded = readJsonArtifact(repoRoot, relativePath, stage, classification);
    if (!loaded.ok) return loaded;
    artifacts[name] = loaded.value;
  }
  return { ok: true, value: artifacts };
}

export function evaluatePalisadeDecision(request, options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const loaded = loadRuntimeArtifacts(repoRoot);
  if (!loaded.ok) return loaded.failure;

  const { manifest, inputSchema, decisionSchema, interfaceContract, conduitPolicy, policy } = loaded.value;

  const versionErrors = validateVersionCompatibility({ manifest, policy, interfaceContract, conduitPolicy });
  if (versionErrors.length > 0) {
    return boundaryFailure({
      stage: "version_compatibility",
      failure_classification: "unsupported_contract_or_policy_version",
      provenance: "palisade_runtime_version_compatibility",
      reasons: versionErrors,
      request
    });
  }

  const policyErrors = validatePolicyArtifact(policy);
  if (policyErrors.length > 0) {
    return boundaryFailure({
      stage: "policy_loading",
      failure_classification: "malformed_policy_artifact",
      provenance: palisadePolicyPath,
      reasons: policyErrors,
      request
    });
  }

  const inputSchemaErrors = validateJsonSchema(inputSchema, request, "request");
  if (inputSchemaErrors.length > 0) {
    return boundaryFailure({
      stage: "request_validation",
      failure_classification: "schema_validation_failure",
      provenance: palisadeInputSchemaPath,
      reasons: inputSchemaErrors,
      request
    });
  }

  const requestContractErrors = [
    ...validateInterfaceContract(request, interfaceContract),
    ...validateEvidenceConsistency(request),
    ...validatePolicyRequestCompatibility(request, policy)
  ];
  if (requestContractErrors.length > 0) {
    return boundaryFailure({
      stage: "request_contract_validation",
      failure_classification: "contract_validation_failure",
      provenance: interfaceContractPath,
      reasons: requestContractErrors,
      request
    });
  }

  let decision;
  try {
    decision = evaluatePolicyDecision(policy, request);
  } catch (error) {
    return boundaryFailure({
      stage: "policy_evaluation",
      failure_classification: "internal_evaluation_failure",
      provenance: palisadePolicyPath,
      reasons: [error.message],
      request
    });
  }

  const decisionSchemaErrors = validateJsonSchema(decisionSchema, decision, "decision");
  const decisionContractErrors = validateDecisionContract(request, decision, interfaceContract, policy);
  const outputErrors = [...decisionSchemaErrors, ...decisionContractErrors];
  if (outputErrors.length > 0) {
    return boundaryFailure({
      stage: "decision_validation",
      failure_classification: "malformed_decision_output",
      provenance: palisadeDecisionSchemaPath,
      reasons: outputErrors,
      request
    });
  }

  return decision;
}

export function isPalisadeBoundaryFailure(result) {
  return result?.boundary_failure === true && result.allowed === false;
}

export function isPalisadePolicyDecision(result) {
  return Boolean(result) && result.boundary_failure !== true && allowedPalisadeDecisions.has(result.decision);
}
