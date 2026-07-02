import {
  evaluatePalisadeDecision,
  isPalisadeBoundaryFailure,
  isPalisadePolicyDecision
} from "../../../palisade/runtime/v0/palisade-decision-boundary.mjs";

export const conduitGovernedInvocationPath = "conduit/runtime/v0/conduit-governed-invocation.mjs";
export const canonicalConduitEntryPoint = "conduit/runtime/v0/index.mjs#invokeGovernedConduitAction";
export const palisadeDecisionBoundaryImportPath = "palisade/runtime/v0/palisade-decision-boundary.mjs";

export const governedConduitResultClasses = new Set([
  "permitted",
  "policy_blocked",
  "palisade_boundary_failed",
  "downstream_failed"
]);

const expectedContractVersion = "1.0.0";
const expectedPolicyVersion = "0.1.0";

const requiredEnvelopeFields = [
  "request_id",
  "trace_id",
  "correlation_id",
  "contract_version",
  "policy_version"
];

const requiredPalisadeRequestFields = [
  "surface",
  "claim_id",
  "requested_action",
  "evidence_state",
  "production_workspace_threshold_state",
  "runtime_governance_path_state",
  "operator_authorization_state",
  "current_repository_state_basis"
];

const prohibitedFields = new Set([
  "allowed",
  "decision",
  "policy_decision",
  "precomputed_decision",
  "evaluator",
  "policy_evaluator",
  "palisade_evaluator",
  "custom_evaluator",
  "policy_bypass",
  "skip_policy",
  "skip_validation",
  "fail_open",
  "allow_on_failure",
  "runtime_enforcement_status",
  "runtime_status_override",
  "custom_policy_source",
  "policy_source",
  "repoRoot",
  "repo_root"
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

function directFieldsWithProhibitedValues(value, prefix = "request") {
  if (!isObject(value)) return [];
  return Object.keys(value)
    .filter((field) => prohibitedFields.has(field))
    .map((field) => `${prefix}.${field}`);
}

function makeAuditEventCandidate({ request, context, resultClass, policyDecision = null, boundaryFailure = null, downstream = null }) {
  return {
    event_type: "palisade_governed_conduit_invocation_candidate",
    durable_persistence: false,
    request_id: request?.request_id || null,
    trace_id: request?.trace_id || null,
    correlation_id: request?.correlation_id || null,
    workspace_context: clone(context?.workspace_context || null),
    tenant_context: clone(context?.tenant_context || null),
    contract_version: request?.contract_version || null,
    policy_version: request?.policy_version || null,
    claim_id: request?.claim_id || null,
    requested_action: request?.requested_action || null,
    result_class: resultClass,
    policy_decision: policyDecision ? clone(policyDecision) : null,
    boundary_failure: boundaryFailure ? clone(boundaryFailure) : null,
    downstream: downstream ? clone(downstream) : null,
    persistence_status: "not_persisted"
  };
}

function baseResult({ request, context, palisadeRequest, resultClass, policyEvaluationAttempted, downstream }) {
  return {
    result_class: resultClass,
    success: resultClass === "permitted",
    request_id: request?.request_id || null,
    trace_id: request?.trace_id || null,
    correlation_id: request?.correlation_id || null,
    workspace_context: clone(context?.workspace_context || null),
    tenant_context: clone(context?.tenant_context || null),
    contract_version: request?.contract_version || null,
    policy_version: request?.policy_version || null,
    claim_id: palisadeRequest?.claim_id || request?.claim_id || null,
    requested_action: palisadeRequest?.requested_action || request?.requested_action || null,
    surface: palisadeRequest?.surface || request?.surface || null,
    palisade_boundary_path: palisadeDecisionBoundaryImportPath,
    policy_evaluation: {
      attempted: policyEvaluationAttempted,
      evaluator: "evaluatePalisadeDecision",
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

function validateEnvelope(request, context) {
  const errors = [];
  if (!isObject(request)) {
    return ["request must be an object"];
  }
  if (!isObject(context)) {
    errors.push("context must be an object");
  }
  for (const field of requiredEnvelopeFields) {
    if (typeof request[field] !== "string" || request[field].trim() === "") {
      errors.push(`request missing envelope field ${field}`);
    }
  }
  for (const field of requiredPalisadeRequestFields) {
    if (!(field in request)) {
      errors.push(`request missing Palisade field ${field}`);
    }
  }
  if (request.contract_version !== expectedContractVersion) {
    errors.push(`unsupported contract version ${request.contract_version || "missing"}`);
  }
  if (request.policy_version !== expectedPolicyVersion) {
    errors.push(`unsupported policy version ${request.policy_version || "missing"}`);
  }
  const prohibited = [
    ...directFieldsWithProhibitedValues(request, "request"),
    ...directFieldsWithProhibitedValues(context, "context")
  ];
  if (prohibited.length > 0) {
    errors.push(`prohibited caller-controlled bypass field(s): ${prohibited.join(", ")}`);
  }
  if (!Array.isArray(request.current_repository_state_basis) || request.current_repository_state_basis.length === 0) {
    errors.push("request current_repository_state_basis must be a non-empty array");
  }
  return errors;
}

function constructPalisadeRequest(request) {
  const palisadeRequest = {};
  for (const field of requiredPalisadeRequestFields) {
    palisadeRequest[field] = clone(request[field]);
  }
  return palisadeRequest;
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

function validateDownstreamResult(value) {
  if (!isObject(value)) return ["downstream returned a non-object result"];
  const status = value.downstream_status || value.status;
  if (!["completed", "ok", "success"].includes(status) && value.ok !== true) {
    return ["downstream result did not report completed, ok, success, or ok:true"];
  }
  return [];
}

export async function boundedLocalConduitContinuation(invocation) {
  return {
    downstream_status: "completed",
    adapter_classification: "bounded_local_adapter",
    action_performed: "bounded local continuation acknowledgement only",
    request_id: invocation.request.request_id,
    trace_id: invocation.request.trace_id,
    correlation_id: invocation.request.correlation_id
  };
}

export async function invokeGovernedConduitAction(
  request,
  context = {},
  downstreamAdapter = boundedLocalConduitContinuation
) {
  const envelopeErrors = validateEnvelope(request, context);
  if (envelopeErrors.length > 0) {
    return makeClosedResult({
      request: isObject(request) ? request : {},
      context: isObject(context) ? context : {},
      resultClass: "palisade_boundary_failed",
      failureClassification: "malformed_conduit_request",
      failureStage: "conduit_envelope_validation",
      failureProvenance: conduitGovernedInvocationPath,
      reasons: envelopeErrors
    });
  }

  let palisadeRequest;
  try {
    palisadeRequest = constructPalisadeRequest(request);
  } catch (error) {
    return makeClosedResult({
      request,
      context,
      resultClass: "palisade_boundary_failed",
      failureClassification: "malformed_palisade_request_construction",
      failureStage: "palisade_request_construction",
      failureProvenance: conduitGovernedInvocationPath,
      reasons: [error.message]
    });
  }

  const palisadeResult = evaluatePalisadeDecision(palisadeRequest);

  if (isPalisadeBoundaryFailure(palisadeResult)) {
    return makeClosedResult({
      request,
      context,
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

  if (!isPalisadePolicyDecision(palisadeResult)) {
    return makeClosedResult({
      request,
      context,
      palisadeRequest,
      resultClass: "palisade_boundary_failed",
      failureClassification: "malformed_palisade_decision",
      failureStage: "palisade_decision_classification",
      failureProvenance: palisadeDecisionBoundaryImportPath,
      reasons: ["Palisade returned neither a policy decision nor a structured boundary failure"],
      policyEvaluationAttempted: true
    });
  }

  const blockReasons = policyDecisionBlockReasons(palisadeResult);
  if (blockReasons.length > 0) {
    return makeClosedResult({
      request,
      context,
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

  if (typeof downstreamAdapter !== "function") {
    return makeClosedResult({
      request,
      context,
      palisadeRequest,
      resultClass: "downstream_failed",
      failureClassification: "missing_downstream_adapter",
      failureStage: "downstream_validation",
      failureProvenance: conduitGovernedInvocationPath,
      reasons: ["downstream continuation must be a function"],
      policyEvaluationAttempted: true,
      policyDecision: palisadeResult
    });
  }

  let downstreamInvocationCount = 0;
  let downstreamResult;
  try {
    downstreamInvocationCount += 1;
    downstreamResult = await downstreamAdapter({
      request: clone(request),
      context: clone(context),
      palisade_request: clone(palisadeRequest),
      policy_decision: clone(palisadeResult),
      audit_event_candidate: makeAuditEventCandidate({
        request,
        context,
        resultClass: "permitted",
        policyDecision: palisadeResult,
        downstream: { attempted: true, invocation_count: downstreamInvocationCount, status: "attempting" }
      })
    });
  } catch (error) {
    const downstream = {
      attempted: true,
      invocation_count: downstreamInvocationCount,
      status: "failed",
      failure_classification: "downstream_exception",
      failure_provenance: "downstream_continuation",
      error: failureFromError(error)
    };
    const result = {
      ...baseResult({ request, context, palisadeRequest, resultClass: "downstream_failed", policyEvaluationAttempted: true, downstream }),
      allowed: false,
      policy_decision: clone(palisadeResult),
      palisade_boundary_failure: null,
      reasons: ["downstream continuation failed after a valid allowing Palisade decision"],
      required_evidence: palisadeResult.required_evidence,
      missing_evidence: palisadeResult.missing_evidence,
      operator_review_required: palisadeResult.operator_review_required,
      runtime_enforcement_status: palisadeResult.runtime_enforcement_status,
      current_state_basis: palisadeResult.current_state_basis,
      next_evidence_threshold: palisadeResult.next_evidence_threshold
    };
    result.audit_event_candidate = makeAuditEventCandidate({
      request,
      context,
      resultClass: "downstream_failed",
      policyDecision: palisadeResult,
      downstream
    });
    return result;
  }

  const downstreamErrors = validateDownstreamResult(downstreamResult);
  if (downstreamErrors.length > 0) {
    const downstream = {
      attempted: true,
      invocation_count: downstreamInvocationCount,
      status: "failed",
      failure_classification: "malformed_downstream_result",
      failure_provenance: "downstream_continuation",
      reasons: downstreamErrors,
      result: clone(downstreamResult)
    };
    const result = {
      ...baseResult({ request, context, palisadeRequest, resultClass: "downstream_failed", policyEvaluationAttempted: true, downstream }),
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
      context,
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
    failure_classification: null,
    failure_provenance: null,
    result: clone(downstreamResult)
  };
  const result = {
    ...baseResult({ request, context, palisadeRequest, resultClass: "permitted", policyEvaluationAttempted: true, downstream }),
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
    context,
    resultClass: "permitted",
    policyDecision: palisadeResult,
    downstream
  });
  return result;
}
