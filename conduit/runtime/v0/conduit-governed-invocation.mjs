import {
  evaluatePalisadeCurrentStateDecision,
  isPalisadeBoundaryFailure,
  isPalisadePolicyDecision
} from "../../../palisade/runtime/v0/palisade-decision-boundary.mjs";
import {
  canonicalClaimId,
  canonicalRequestedAction,
  canonicalSurface,
  resolveCanonicalPalisadeRuntime
} from "../../../palisade/runtime/v0/palisade-current-state-evidence.mjs";
import {
  acquireConduitCurrentStateEvidence,
  ConduitCurrentStateEvidenceError
} from "./conduit-current-state-evidence.mjs";
import {
  governedRuntimePathActionIdentifier,
  governedRuntimePathClaimId,
  performRuntimeGovernancePathAssessment,
  runtimeGovernancePathAssessmentAdapterId,
  runtimeGovernancePathAssessmentAdapterPath,
  runtimeGovernancePathAssessmentResultType,
  validateRuntimeGovernancePathAssessmentResult
} from "./actions/runtime-governance-path-assessment.mjs";

export const conduitGovernedInvocationPath = "conduit/runtime/v0/conduit-governed-invocation.mjs";
export const canonicalConduitEntryPoint = "conduit/runtime/v0/index.mjs#invokeGovernedConduitAction";
export const palisadeDecisionBoundaryImportPath = "palisade/runtime/v0/palisade-decision-boundary.mjs";

export const governedConduitResultClasses = new Set([
  "permitted",
  "policy_blocked",
  "palisade_boundary_failed",
  "downstream_failed"
]);

const canonicalEnvelopeFields = new Set([
  "request_id",
  "trace_id",
  "correlation_id",
  "contract_version",
  "policy_version",
  "surface",
  "claim_id",
  "requested_action"
]);

const prohibitedFieldNames = new Set([
  "evidence_state",
  "current_evidence",
  "required_evidence",
  "missing_evidence",
  "denied_claims",
  "production_workspace_threshold_state",
  "runtime_governance_path_state",
  "component_state",
  "component_states",
  "component_order",
  "verified_components",
  "current_repository_state_basis",
  "repository_state_basis",
  "evidence_source",
  "evidence_sources",
  "evidence_provider",
  "evidence_registry",
  "source_path",
  "source_paths",
  "repoRoot",
  "repo_root",
  "operator_authorization_state",
  "operator_authorization",
  "operator_approval",
  "authorization_witness",
  "approval_record",
  "authorization_override",
  "authorization_provider",
  "allowed",
  "decision",
  "policy_decision",
  "precomputed_decision",
  "precomputed_action_result",
  "policy_evaluator",
  "custom_evaluator",
  "palisade_evaluator",
  "policy_bypass",
  "skip_policy",
  "skip_validation",
  "fail_open",
  "allow_on_failure",
  "action_adapter",
  "adapter",
  "adapter_path",
  "action_override",
  "skip_action",
  "test_fixture",
  "fixture_path",
  "complete_evidence_fixture"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function failureFromError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || String(error)
  };
}

function findProhibitedNestedFields(value, prefix = "request") {
  if (!isObject(value) && !Array.isArray(value)) return [];
  const entries = Array.isArray(value) ? value.entries() : Object.entries(value);
  const found = [];
  for (const [key, nested] of entries) {
    const fieldName = String(key);
    const path = Array.isArray(value) ? `${prefix}[${fieldName}]` : `${prefix}.${fieldName}`;
    if (prohibitedFieldNames.has(fieldName)) found.push(path);
    if (isObject(nested) || Array.isArray(nested)) found.push(...findProhibitedNestedFields(nested, path));
  }
  return found;
}

function makeAuditEventCandidate({
  request,
  context,
  resultClass,
  policyDecision = null,
  boundaryFailure = null,
  downstream = null
}) {
  return {
    event_type: "palisade_governed_conduit_invocation_candidate",
    durable_persistence: false,
    request_id: request?.request_id || null,
    trace_id: request?.trace_id || null,
    correlation_id: request?.correlation_id || null,
    workspace_context: null,
    tenant_context: null,
    contract_version: request?.contract_version || null,
    policy_version: request?.policy_version || null,
    claim_id: request?.claim_id || null,
    requested_action: request?.requested_action || null,
    action_identifier: request?.requested_action || null,
    adapter_identifier: downstream?.adapter_identifier || null,
    action_attempt_status: downstream?.attempted === true ? "attempted" : "not_attempted",
    action_completion_status: downstream?.status || "not_attempted",
    action_failure_classification: downstream?.failure_classification || null,
    bounded_result_type: downstream?.result?.result_type || null,
    bounded_result_summary: downstream?.result
      ? {
          result_type: downstream.result.result_type || null,
          action_identifier: downstream.result.action_identifier || null,
          sufficiency_status: downstream.result.sufficiency_status || null,
          unsatisfied_component_count: downstream.result.unsatisfied_components?.length ?? null
        }
      : null,
    result_class: resultClass,
    policy_decision: policyDecision ? clone(policyDecision) : null,
    boundary_failure: boundaryFailure ? clone(boundaryFailure) : null,
    downstream: downstream ? clone(downstream) : null,
    persistence_status: "not_persisted",
    context_boundary: isObject(context) && Object.keys(context).length === 0 ? "empty_context_only" : "rejected_or_absent"
  };
}

function baseResult({ request, context, palisadeRequest, resultClass, policyEvaluationAttempted, downstream }) {
  return {
    result_class: resultClass,
    success: resultClass === "permitted",
    request_id: request?.request_id || null,
    trace_id: request?.trace_id || null,
    correlation_id: request?.correlation_id || null,
    workspace_context: null,
    tenant_context: null,
    contract_version: request?.contract_version || null,
    policy_version: request?.policy_version || null,
    claim_id: palisadeRequest?.claim_id || request?.claim_id || null,
    requested_action: palisadeRequest?.requested_action || request?.requested_action || null,
    surface: palisadeRequest?.surface || request?.surface || null,
    palisade_boundary_path: palisadeDecisionBoundaryImportPath,
    policy_evaluation: {
      attempted: policyEvaluationAttempted,
      evaluator: "evaluatePalisadeCurrentStateDecision",
      evaluator_injectable: false
    },
    downstream,
    audit_event_candidate: null
  };
}

function makeClosedResult({
  request,
  context,
  palisadeRequest = null,
  resultClass,
  failureClassification,
  failureStage,
  failureProvenance,
  reasons,
  details = [],
  policyEvaluationAttempted = false,
  policyDecision = null,
  boundaryFailure = null
}) {
  const downstream = {
    attempted: false,
    invocation_count: 0,
    status: "not_attempted",
    failure_classification: null,
    failure_provenance: null
  };
  const result = {
    ...baseResult({ request, context, palisadeRequest, resultClass, policyEvaluationAttempted, downstream }),
    allowed: false,
    policy_decision: policyDecision ? clone(policyDecision) : null,
    palisade_boundary_failure:
      resultClass === "palisade_boundary_failed"
        ? boundaryFailure
          ? clone(boundaryFailure)
          : {
              boundary_failure: true,
              allowed: false,
              failure_classification: failureClassification,
              stage: failureStage,
              provenance: failureProvenance,
              reasons,
              details,
              request_identity: request?.request_id || null,
              trace_identity: request?.trace_id || null,
              correlation_identity: request?.correlation_id || null
            }
        : null,
    reasons,
    required_evidence: policyDecision?.required_evidence || [],
    missing_evidence: policyDecision?.missing_evidence || [],
    operator_review_required: policyDecision?.operator_review_required || false,
    runtime_enforcement_status: policyDecision?.runtime_enforcement_status || null,
    current_state_basis: policyDecision?.current_state_basis || palisadeRequest?.current_repository_state_basis || [],
    next_evidence_threshold: policyDecision?.next_evidence_threshold || null
  };
  result.audit_event_candidate = makeAuditEventCandidate({
    request,
    context,
    resultClass,
    policyDecision,
    boundaryFailure: result.palisade_boundary_failure,
    downstream
  });
  return result;
}

function validateCanonicalEnvelope(request, context) {
  const errors = [];
  if (!isObject(request)) return ["request must be an object"];
  const nestedProhibited = [
    ...findProhibitedNestedFields(request, "request"),
    ...findProhibitedNestedFields(context, "context")
  ];
  if (nestedProhibited.length > 0) {
    errors.push(`prohibited caller-controlled field(s): ${nestedProhibited.join(", ")}`);
  }
  for (const field of Object.keys(request)) {
    if (!canonicalEnvelopeFields.has(field)) errors.push(`unknown canonical request field ${field}`);
  }
  for (const field of canonicalEnvelopeFields) {
    if (typeof request[field] !== "string" || request[field].trim() === "") {
      errors.push(`request missing canonical envelope field ${field}`);
    }
  }
  if (request.surface !== canonicalSurface) errors.push(`unsupported governed surface ${request.surface || "missing"}`);
  if (request.claim_id !== canonicalClaimId) errors.push(`unsupported governed claim ${request.claim_id || "missing"}`);
  if (request.requested_action !== canonicalRequestedAction) {
    errors.push(`unsupported governed action ${request.requested_action || "missing"}`);
  }
  if (request.claim_id !== governedRuntimePathClaimId) errors.push("claim does not match governed runtime path claim");
  if (request.requested_action !== governedRuntimePathActionIdentifier) {
    errors.push("requested action does not match governed runtime path action");
  }
  if (context === undefined || context === null) return errors;
  if (!isObject(context)) {
    errors.push("context must be omitted or an empty object");
  } else if (Object.keys(context).length > 0) {
    errors.push("canonical context must be empty");
  }
  return errors;
}

function policyDecisionBlockReasons(decision) {
  const reasons = [];
  if (decision.decision !== "allow") reasons.push(`Palisade decision is ${decision.decision}`);
  if (decision.allowed !== true) reasons.push("Palisade allowed flag is not true");
  if (Array.isArray(decision.missing_evidence) && decision.missing_evidence.length > 0) {
    reasons.push("Palisade decision reports missing evidence");
  }
  if (decision.operator_review_required === true) {
    reasons.push("Palisade decision requires unresolved Operator review");
  }
  if (decision.decision === "runtime_enforcement_unavailable") {
    reasons.push("Palisade runtime enforcement is unavailable for the requested runtime claim");
  }
  if (!Array.isArray(decision.current_state_basis) || decision.current_state_basis.length === 0) {
    reasons.push("Palisade decision has no traceable current-state basis");
  }
  return reasons;
}

function validateSameInvocationBinding({ request, context, palisadeRequest, policyDecision, evidenceSnapshot }) {
  const errors = [];
  if (policyDecision.claim_id !== palisadeRequest.claim_id) errors.push("decision claim_id does not match Palisade request");
  if (policyDecision.requested_action !== palisadeRequest.requested_action) {
    errors.push("decision requested_action does not match Palisade request");
  }
  if (policyDecision.surface !== palisadeRequest.surface) errors.push("decision surface does not match Palisade request");
  if (palisadeRequest.claim_id !== canonicalClaimId) errors.push("Palisade request claim_id does not match canonical claim");
  if (palisadeRequest.requested_action !== canonicalRequestedAction) {
    errors.push("Palisade request requested_action does not match canonical action");
  }
  if (!isObject(context) || Object.keys(context).length !== 0) errors.push("context snapshot is not empty");
  if (JSON.stringify(palisadeRequest.current_repository_state_basis) !== JSON.stringify(policyDecision.current_state_basis)) {
    errors.push("current-state basis does not match the allowing decision");
  }
  if (policyDecision.evidence_snapshot_hash !== evidenceSnapshot.snapshot_hash) {
    errors.push("evidence snapshot hash does not match decision");
  }
  if (!policyDecision.evidence_contract_sha256 || !policyDecision.acquisition_plan_hash) {
    errors.push("decision is missing evidence-contract binding");
  }
  return errors;
}

function validateDownstreamResult(value, invocation) {
  return validateRuntimeGovernancePathAssessmentResult(value, invocation);
}

async function invokeGovernedConduitActionInternal(request, context = {}, options = {}) {
  const normalizedContext = context ?? {};
  const envelopeErrors = validateCanonicalEnvelope(request, normalizedContext);
  if (envelopeErrors.length > 0) {
    return makeClosedResult({
      request: isObject(request) ? request : {},
      context: isObject(normalizedContext) ? normalizedContext : {},
      resultClass: "palisade_boundary_failed",
      failureClassification: "malformed_conduit_request",
      failureStage: "conduit_envelope_validation",
      failureProvenance: conduitGovernedInvocationPath,
      reasons: envelopeErrors
    });
  }

  let acquisitionPlan;
  let evidenceSnapshot;
  try {
    acquisitionPlan = resolveCanonicalPalisadeRuntime({ envelope: request }).plan;
    evidenceSnapshot =
      options.testOnlyEvidenceSnapshot ||
      acquireConduitCurrentStateEvidence(acquisitionPlan);
  } catch (error) {
    return makeClosedResult({
      request,
      context: normalizedContext,
      resultClass: "palisade_boundary_failed",
      failureClassification:
        error instanceof ConduitCurrentStateEvidenceError
          ? error.failure_classification
          : error.failure_classification || "current_state_evidence_acquisition_failed",
      failureStage: error.stage || "current_state_evidence_acquisition",
      failureProvenance: error instanceof ConduitCurrentStateEvidenceError ? "conduit/runtime/v0/conduit-current-state-evidence.mjs" : conduitGovernedInvocationPath,
      reasons: error.reasons || [error.message],
      details: error.details || []
    });
  }

  const palisadeResult = evaluatePalisadeCurrentStateDecision({
    envelope: request,
    acquisitionPlan,
    evidenceSnapshot,
    authorizationWitness: options.authorizationWitness || null,
    testOnlyCompleteEvidence: options.testOnlyCompleteEvidence === true
  });
  const palisadeInternal = palisadeResult?.palisade_internal || null;
  const palisadeRequest = palisadeInternal?.policy_input || null;

  if (isPalisadeBoundaryFailure(palisadeResult)) {
    return makeClosedResult({
      request,
      context: normalizedContext,
      palisadeRequest,
      resultClass: "palisade_boundary_failed",
      failureClassification: palisadeResult.failure_classification,
      failureStage: palisadeResult.stage,
      failureProvenance: palisadeResult.provenance,
      reasons: palisadeResult.reasons || ["Palisade boundary failed closed"],
      policyEvaluationAttempted: true,
      boundaryFailure: palisadeResult
    });
  }

  if (!isPalisadePolicyDecision(palisadeResult) || !palisadeRequest) {
    return makeClosedResult({
      request,
      context: normalizedContext,
      palisadeRequest,
      resultClass: "palisade_boundary_failed",
      failureClassification: "malformed_palisade_decision",
      failureStage: "palisade_decision_classification",
      failureProvenance: palisadeDecisionBoundaryImportPath,
      reasons: ["Palisade returned neither a policy decision with internal state nor a structured boundary failure"],
      policyEvaluationAttempted: true
    });
  }

  const blockReasons = policyDecisionBlockReasons(palisadeResult);
  if (blockReasons.length > 0) {
    return makeClosedResult({
      request,
      context: normalizedContext,
      palisadeRequest,
      resultClass: "policy_blocked",
      failureClassification: "non_allowing_policy_decision",
      failureStage: "policy_decision_classification",
      failureProvenance: palisadeDecisionBoundaryImportPath,
      reasons: blockReasons,
      policyEvaluationAttempted: true,
      policyDecision: palisadeResult,
      boundaryFailure: null
    });
  }

  const bindingErrors = validateSameInvocationBinding({
    request,
    context: normalizedContext,
    palisadeRequest,
    policyDecision: palisadeResult,
    evidenceSnapshot
  });
  if (bindingErrors.length > 0) {
    return makeClosedResult({
      request,
      context: normalizedContext,
      palisadeRequest,
      resultClass: "downstream_failed",
      failureClassification: "same_invocation_binding_failed",
      failureStage: "same_invocation_request_decision_action_binding",
      failureProvenance: conduitGovernedInvocationPath,
      reasons: bindingErrors,
      policyEvaluationAttempted: true,
      policyDecision: palisadeResult
    });
  }

  const actionAdapter = options.actionAdapter || performRuntimeGovernancePathAssessment;
  if (typeof actionAdapter !== "function") {
    return makeClosedResult({
      request,
      context: normalizedContext,
      palisadeRequest,
      resultClass: "downstream_failed",
      failureClassification: "missing_action_adapter",
      failureStage: "action_adapter_validation",
      failureProvenance: runtimeGovernancePathAssessmentAdapterPath,
      reasons: ["selected action adapter must be a function"],
      policyEvaluationAttempted: true,
      policyDecision: palisadeResult
    });
  }

  let downstreamInvocationCount = 0;
  let downstreamResult;
  const invocationSnapshot = {
    request: clone(request),
    context: clone(normalizedContext),
    palisade_request: clone(palisadeRequest),
    policy_decision: clone(palisadeResult),
    evidence_snapshot: clone(evidenceSnapshot),
    acquisition_plan: clone(acquisitionPlan)
  };
  try {
    downstreamInvocationCount += 1;
    downstreamResult = await actionAdapter({
      ...invocationSnapshot,
      audit_event_candidate: makeAuditEventCandidate({
        request,
        context: normalizedContext,
        resultClass: "permitted",
        policyDecision: palisadeResult,
        downstream: {
          attempted: true,
          invocation_count: downstreamInvocationCount,
          status: "attempting",
          adapter_identifier: runtimeGovernancePathAssessmentAdapterId
        }
      })
    });
  } catch (error) {
    const downstream = {
      attempted: true,
      invocation_count: downstreamInvocationCount,
      status: "failed",
      adapter_identifier: runtimeGovernancePathAssessmentAdapterId,
      failure_classification: "action_adapter_exception",
      failure_provenance: runtimeGovernancePathAssessmentAdapterPath,
      error: failureFromError(error)
    };
    const result = {
      ...baseResult({ request, context: normalizedContext, palisadeRequest, resultClass: "downstream_failed", policyEvaluationAttempted: true, downstream }),
      allowed: false,
      policy_decision: clone(palisadeResult),
      palisade_boundary_failure: null,
      reasons: ["selected action adapter failed after a valid allowing Palisade decision"],
      required_evidence: palisadeResult.required_evidence,
      missing_evidence: palisadeResult.missing_evidence,
      operator_review_required: palisadeResult.operator_review_required,
      runtime_enforcement_status: palisadeResult.runtime_enforcement_status,
      current_state_basis: palisadeResult.current_state_basis,
      next_evidence_threshold: palisadeResult.next_evidence_threshold
    };
    result.audit_event_candidate = makeAuditEventCandidate({
      request,
      context: normalizedContext,
      resultClass: "downstream_failed",
      policyDecision: palisadeResult,
      downstream
    });
    return result;
  }

  const downstreamErrors = validateDownstreamResult(downstreamResult, invocationSnapshot);
  if (downstreamErrors.length > 0) {
    const downstream = {
      attempted: true,
      invocation_count: downstreamInvocationCount,
      status: "failed",
      adapter_identifier: runtimeGovernancePathAssessmentAdapterId,
      failure_classification: "malformed_action_result",
      failure_provenance: runtimeGovernancePathAssessmentAdapterPath,
      reasons: downstreamErrors,
      result: clone(downstreamResult)
    };
    const result = {
      ...baseResult({ request, context: normalizedContext, palisadeRequest, resultClass: "downstream_failed", policyEvaluationAttempted: true, downstream }),
      allowed: false,
      policy_decision: clone(palisadeResult),
      palisade_boundary_failure: null,
      reasons: downstreamErrors,
      required_evidence: palisadeResult.required_evidence,
      missing_evidence: palisadeResult.missing_evidence,
      operator_review_required: palisadeResult.operator_review_required,
      runtime_enforcement_status: palisadeResult.runtime_enforcement_status,
      current_state_basis: palisadeResult.current_state_basis,
      next_evidence_threshold: palisadeResult.next_evidence_threshold
    };
    result.audit_event_candidate = makeAuditEventCandidate({
      request,
      context: normalizedContext,
      resultClass: "downstream_failed",
      policyDecision: palisadeResult,
      downstream
    });
    return result;
  }

  const downstream = {
    attempted: true,
    invocation_count: downstreamInvocationCount,
    status: "completed",
    adapter_identifier: runtimeGovernancePathAssessmentAdapterId,
    failure_classification: null,
    failure_provenance: null,
    result: clone(downstreamResult)
  };
  const result = {
    ...baseResult({ request, context: normalizedContext, palisadeRequest, resultClass: "permitted", policyEvaluationAttempted: true, downstream }),
    allowed: true,
    policy_decision: clone(palisadeResult),
    palisade_boundary_failure: null,
    reasons: palisadeResult.reasons,
    required_evidence: palisadeResult.required_evidence,
    missing_evidence: palisadeResult.missing_evidence,
    operator_review_required: palisadeResult.operator_review_required,
    runtime_enforcement_status: palisadeResult.runtime_enforcement_status,
    current_state_basis: palisadeResult.current_state_basis,
    next_evidence_threshold: palisadeResult.next_evidence_threshold
  };
  result.audit_event_candidate = makeAuditEventCandidate({
    request,
    context: normalizedContext,
    resultClass: "permitted",
    policyDecision: palisadeResult,
    downstream
  });
  return result;
}

export async function invokeGovernedConduitAction(request, context = {}) {
  return invokeGovernedConduitActionInternal(request, context);
}

export async function invokeGovernedConduitActionForTestOnly(request, context = {}, options = {}) {
  return invokeGovernedConduitActionInternal(request, context, options);
}

export {
  governedRuntimePathActionIdentifier,
  governedRuntimePathClaimId,
  runtimeGovernancePathAssessmentAdapterId,
  runtimeGovernancePathAssessmentAdapterPath,
  runtimeGovernancePathAssessmentResultType
};
