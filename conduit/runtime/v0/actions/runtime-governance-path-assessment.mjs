export const governedRuntimePathActionIdentifier = "evaluate_runtime_path_sufficiency";
export const governedRuntimePathClaimId = "runtime_governance_path_sufficiency";
export const runtimeGovernancePathAssessmentAdapterId = "runtime-governance-path-assessment-adapter.v0";
export const runtimeGovernancePathAssessmentAdapterPath =
  "conduit/runtime/v0/actions/runtime-governance-path-assessment.mjs";
export const runtimeGovernancePathAssessmentResultType = "runtime_governance_path_assessment";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function componentIsSatisfied(entry) {
  return entry?.state === "exists" && entry.verified === true;
}

export function validateRuntimeGovernancePathAssessmentResult(result, invocation) {
  const errors = [];
  const request = invocation?.request || {};
  const context = invocation?.context || {};
  const decision = invocation?.policy_decision || {};

  if (!isObject(result)) return ["action result must be an object"];
  for (const field of [
    "downstream_status",
    "adapter_identifier",
    "adapter_classification",
    "result_type",
    "action_identifier",
    "claim_id",
    "requested_action",
    "request_id",
    "trace_id",
    "correlation_id",
    "workspace_context",
    "tenant_context",
    "current_state_basis",
    "runtime_path_components",
    "satisfied_components",
    "unsatisfied_components",
    "sufficiency_status",
    "boundaries"
  ]) {
    if (!(field in result)) errors.push(`action result missing ${field}`);
  }

  if (result.downstream_status !== "completed") errors.push("action result must report completed downstream_status");
  if (result.adapter_identifier !== runtimeGovernancePathAssessmentAdapterId) {
    errors.push("action result adapter identifier mismatch");
  }
  if (result.adapter_classification !== "repository_owned_internal_domain_adapter") {
    errors.push("action result adapter classification mismatch");
  }
  if (result.result_type !== runtimeGovernancePathAssessmentResultType) errors.push("action result type mismatch");
  if (result.action_identifier !== governedRuntimePathActionIdentifier) errors.push("action identifier mismatch");
  if (result.claim_id !== governedRuntimePathClaimId) errors.push("claim identifier mismatch");
  if (result.requested_action !== governedRuntimePathActionIdentifier) errors.push("requested action mismatch");
  if (result.request_id !== request.request_id) errors.push("request identity mismatch");
  if (result.trace_id !== request.trace_id) errors.push("trace identity mismatch");
  if (result.correlation_id !== request.correlation_id) errors.push("correlation identity mismatch");
  if (!sameJson(result.workspace_context, context.workspace_context || null)) {
    errors.push("workspace context mismatch");
  }
  if (!sameJson(result.tenant_context, context.tenant_context || null)) {
    errors.push("tenant context mismatch");
  }
  if (!sameJson(result.current_state_basis, decision.current_state_basis || [])) {
    errors.push("current state basis mismatch");
  }
  if (!Array.isArray(result.runtime_path_components)) {
    errors.push("runtime_path_components must be an array");
  } else {
    for (const component of result.runtime_path_components) {
      if (typeof component.component !== "string") errors.push("component id must be a string");
      if (!["exists", "partial", "stubbed", "absent", "unverified"].includes(component.state)) {
        errors.push(`${component.component || "component"} has unsupported state`);
      }
      if (typeof component.verified !== "boolean") errors.push(`${component.component || "component"} verified must be boolean`);
      if (!Array.isArray(component.evidence)) errors.push(`${component.component || "component"} evidence must be an array`);
      if (typeof component.satisfied !== "boolean") errors.push(`${component.component || "component"} satisfied must be boolean`);
    }
  }
  if (!Array.isArray(result.satisfied_components)) errors.push("satisfied_components must be an array");
  if (!Array.isArray(result.unsatisfied_components)) errors.push("unsatisfied_components must be an array");
  if (result.sufficiency_status !== "sufficient") errors.push("allowed runtime path assessment must be sufficient");
  if (result.unsatisfied_components?.length !== 0) {
    errors.push("allowed runtime path assessment must not contain unsatisfied components");
  }
  for (const [field, expected] of [
    ["durable_persistence", false],
    ["public_execution", false],
    ["deployment", false],
    ["vault_nexus_execution", false],
    ["model_execution", false],
    ["operational_release_execution", false],
    ["cross_invocation_replay_protection", false]
  ]) {
    if (result.boundaries?.[field] !== expected) errors.push(`boundary ${field} must be ${expected}`);
  }

  return errors;
}

export async function performRuntimeGovernancePathAssessment(invocation) {
  const request = invocation?.request || {};
  const context = invocation?.context || {};
  const palisadeRequest = invocation?.palisade_request || {};
  const decision = invocation?.policy_decision || {};

  if (request.claim_id !== governedRuntimePathClaimId) {
    throw new Error(`runtime path adapter received unsupported claim ${request.claim_id || "missing"}`);
  }
  if (request.requested_action !== governedRuntimePathActionIdentifier) {
    throw new Error(`runtime path adapter received unsupported action ${request.requested_action || "missing"}`);
  }
  if (
    decision.decision !== "allow" ||
    decision.allowed !== true ||
    decision.claim_id !== governedRuntimePathClaimId ||
    decision.requested_action !== governedRuntimePathActionIdentifier ||
    palisadeRequest.claim_id !== governedRuntimePathClaimId ||
    palisadeRequest.requested_action !== governedRuntimePathActionIdentifier
  ) {
    throw new Error("runtime path adapter requires an allowing same-action Palisade decision");
  }
  if (!sameJson(palisadeRequest.current_repository_state_basis, decision.current_state_basis)) {
    throw new Error("runtime path adapter detected Palisade request and decision basis drift");
  }

  const runtimeState = palisadeRequest.runtime_governance_path_state || {};
  const runtimePathComponents = Object.entries(runtimeState).map(([component, entry]) => {
    return {
      component,
      state: entry.state,
      verified: entry.verified === true,
      evidence: clone(entry.evidence || []),
      satisfied: componentIsSatisfied(entry)
    };
  });
  const satisfiedComponents = runtimePathComponents
    .filter((component) => component.satisfied)
    .map((component) => component.component);
  const unsatisfiedComponents = runtimePathComponents
    .filter((component) => !component.satisfied)
    .map((component) => component.component);

  return {
    downstream_status: "completed",
    adapter_identifier: runtimeGovernancePathAssessmentAdapterId,
    adapter_path: runtimeGovernancePathAssessmentAdapterPath,
    adapter_classification: "repository_owned_internal_domain_adapter",
    result_type: runtimeGovernancePathAssessmentResultType,
    action_identifier: governedRuntimePathActionIdentifier,
    claim_id: governedRuntimePathClaimId,
    requested_action: governedRuntimePathActionIdentifier,
    request_id: request.request_id,
    trace_id: request.trace_id,
    correlation_id: request.correlation_id,
    workspace_context: clone(context.workspace_context || null),
    tenant_context: clone(context.tenant_context || null),
    current_state_basis: clone(decision.current_state_basis),
    runtime_path_components: runtimePathComponents,
    satisfied_components: satisfiedComponents,
    unsatisfied_components: unsatisfiedComponents,
    sufficiency_status: unsatisfiedComponents.length === 0 ? "sufficient" : "insufficient",
    boundaries: {
      durable_persistence: false,
      public_execution: false,
      deployment: false,
      vault_nexus_execution: false,
      model_execution: false,
      operational_release_execution: false,
      cross_invocation_replay_protection: false
    }
  };
}
