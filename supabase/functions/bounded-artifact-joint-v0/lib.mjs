import contract from "./contract.json" with { type: "json" };
import {
  NEXUS_COMMIT,
  intelligenceContractFor,
  sha256,
  validateIntelligenceOutput,
  isPlainObject
} from "../live-governed-evaluation-v0/lib.mjs";

export const JOINT_CONTRACT = Object.freeze(contract);
export const STAGES = Object.freeze(contract.stage_order);
export const FLOW_TYPE = contract.flow_type;
export const CHILD_RUN_TYPE = "live_governed_evaluation_v0";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^[0-9a-f]{64}$/;
const fieldsEqual = (actual, expected) => JSON.stringify(Object.keys(actual).sort()) === JSON.stringify([...expected].sort());

export function validateJointRequest(body) {
  if (!isPlainObject(body) || !fieldsEqual(body, contract.request_schema.required)) throw new Error("joint_request_fields_mismatch");
  if (!UUID.test(String(body.client_request_id || "")) || !UUID.test(String(body.workspace_id || ""))) throw new Error("joint_identity_invalid");
  if (body.data_classification !== "non_sensitive" || body.external_processing_consent !== true) throw new Error("joint_processing_consent_required");
  const artifactRequest = typeof body.artifact_request === "string" ? body.artifact_request.trim() : "";
  const scenarioContext = typeof body.scenario_context === "string" ? body.scenario_context.trim() : "";
  const consentReference = typeof body.consent_reference === "string" ? body.consent_reference.trim() : "";
  if (artifactRequest.length < 20 || artifactRequest.length > 1800) throw new Error("joint_artifact_request_invalid");
  if (scenarioContext.length < 10 || scenarioContext.length > 1000) throw new Error("joint_scenario_context_invalid");
  if (consentReference.length < 10 || consentReference.length > 200) throw new Error("joint_consent_reference_invalid");
  return Object.freeze({
    client_request_id: body.client_request_id.toLowerCase(),
    workspace_id: body.workspace_id.toLowerCase(),
    artifact_request: artifactRequest,
    scenario_context: scenarioContext,
    consent_reference: consentReference,
    data_classification: "non_sensitive",
    external_processing_consent: true
  });
}

export function stageAt(ordinal) {
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > STAGES.length) throw new Error("joint_stage_ordinal_invalid");
  return STAGES[ordinal - 1];
}

export function validateStageRows(rows) {
  if (!Array.isArray(rows) || rows.length !== 5) throw new Error("joint_stage_set_invalid");
  let predecessorComplete = true;
  let terminalSeen = false;
  for (let i = 0; i < STAGES.length; i += 1) {
    if (rows[i]?.ordinal !== i + 1 || rows[i]?.intelligence_id !== STAGES[i] || !contract.stage_states.includes(rows[i]?.state)) {
      throw new Error("joint_stage_order_invalid");
    }
    const state = rows[i].state;
    if (["active", "completed"].includes(state) && !predecessorComplete) throw new Error("joint_predecessor_incomplete");
    if (terminalSeen && state !== "skipped") throw new Error("joint_terminal_stage_inconsistent");
    if (["blocked", "failed"].includes(state)) terminalSeen = true;
    predecessorComplete = state === "completed";
  }
  return rows;
}

export function nextStage(rows) {
  validateStageRows(rows);
  const active = rows.find((stage) => stage.state === "active");
  if (active) return { status: "in_progress", stage: active.intelligence_id };
  const terminal = rows.find((stage) => ["blocked", "failed"].includes(stage.state));
  if (terminal) return { status: "terminal", stage: terminal.intelligence_id };
  const pending = rows.find((stage) => stage.state === "pending");
  if (!pending) return { status: "completed", stage: null };
  if (pending.ordinal > 1 && rows[pending.ordinal - 2].state !== "completed") throw new Error("joint_predecessor_incomplete");
  return { status: "eligible", stage: pending.intelligence_id, ordinal: pending.ordinal };
}

export async function validateHandoff(handoff, digest, expected) {
  if (!isPlainObject(handoff) || !fieldsEqual(handoff, contract.handoff_schema.required)) throw new Error("joint_handoff_fields_mismatch");
  if (!DIGEST.test(String(digest)) || await sha256(handoff) !== digest) throw new Error("joint_handoff_digest_mismatch");
  if (handoff.schema_version !== "0.1" || handoff.upstream_output_schema_version !== "0.1" || handoff.eligibility !== "eligible") throw new Error("joint_handoff_ineligible");
  if (handoff.joint_flow_id !== expected.jointFlowId || handoff.workspace_id !== expected.workspaceId || handoff.consent_reference !== expected.consentReference) throw new Error("joint_handoff_binding_mismatch");
  if (handoff.upstream_stage !== expected.upstreamStage || handoff.downstream_stage !== expected.downstreamStage || handoff.upstream_intelligence_id !== expected.upstreamStage) throw new Error("joint_handoff_stage_mismatch");
  if (!UUID.test(String(handoff.upstream_child_run_id)) || handoff.upstream_child_run_id !== expected.childRunId) throw new Error("joint_handoff_child_mismatch");
  if (!DIGEST.test(String(handoff.upstream_output_sha256)) || handoff.upstream_output_sha256 !== expected.outputSha256) throw new Error("joint_handoff_output_mismatch");
  if (handoff.artifact_identity !== expected.artifactIdentity || handoff.nexus_commit !== NEXUS_COMMIT || !Number.isFinite(Date.parse(handoff.created_at))) throw new Error("joint_handoff_lineage_mismatch");
  return handoff;
}

export async function buildHandoff({ jointFlowId, workspaceId, consentReference, upstreamStage, childRunId, outputSha256, artifactIdentity, createdAt }) {
  const index = STAGES.indexOf(upstreamStage);
  if (index < 0 || index === STAGES.length - 1 || !DIGEST.test(outputSha256) || !UUID.test(childRunId)) throw new Error("joint_handoff_source_invalid");
  const handoff = {
    schema_version: "0.1", joint_flow_id: jointFlowId,
    upstream_stage: upstreamStage, downstream_stage: STAGES[index + 1],
    upstream_child_run_id: childRunId, upstream_intelligence_id: upstreamStage,
    upstream_output_schema_version: "0.1", upstream_output_sha256: outputSha256,
    artifact_identity: artifactIdentity || null, consent_reference: consentReference,
    workspace_id: workspaceId, nexus_commit: NEXUS_COMMIT,
    created_at: createdAt, eligibility: "eligible"
  };
  return { handoff, sha256: await sha256(handoff) };
}

export function buildStageInput(stage, request, outputs, handoff) {
  if (!STAGES.includes(stage)) throw new Error("joint_stage_unknown");
  const base = { schema_version: "0.1", artifact_request: request.artifact_request, scenario_context: request.scenario_context };
  if (stage === "communicator") return boundedStageInput(base);
  if (!handoff || handoff.downstream_stage !== stage) throw new Error("joint_incoming_handoff_missing");
  const incoming = { upstream_child_run_id: handoff.upstream_child_run_id, output_sha256: handoff.upstream_output_sha256 };
  if (stage === "mediator") return boundedStageInput({ ...base, execution_plan: outputs.communicator, incoming_handoff: incoming });
  if (stage === "drafter") return boundedStageInput({ ...base, constraints_packet: outputs.mediator, incoming_handoff: incoming });
  if (stage === "refiner") return boundedStageInput({ ...base, artifact_identity: outputs.artifact_identity, artifact_candidate: outputs.drafter, constraints_packet: outputs.mediator, verification_boundary: "Verify acceptance tests and forbidden patterns; report pass/fail/escalate without modifying the artifact.", incoming_handoff: incoming });
  return boundedStageInput({ ...base, artifact_identity: outputs.artifact_identity, verification_identity: outputs.refiner_verification_identity, incoming_handoff: incoming });
}

function boundedStageInput(value) {
  const text = JSON.stringify(value);
  if (text.length < 20 || text.length > 4000) throw new Error("joint_stage_input_out_of_bounds");
  return text;
}

export async function validateChildRun(row, { stage, workspaceId, userId, inputText }) {
  if (!row || row.status !== "completed" || row.run_type !== CHILD_RUN_TYPE || row.intelligence_id !== stage) throw new Error("joint_child_run_incomplete");
  if (row.workspace_id !== workspaceId || row.user_id !== userId || row.input_sha256 !== await sha256(inputText)) throw new Error("joint_child_binding_mismatch");
  if (!UUID.test(String(row.id)) || !row.model_response_id || !DIGEST.test(String(row.model_output_sha256))) throw new Error("joint_child_model_identity_missing");
  if (row.nexus_evidence?.nexus_commit !== NEXUS_COMMIT || !DIGEST.test(String(row.nexus_evidence?.execution_host_result_sha256))) throw new Error("joint_child_nexus_evidence_invalid");
  const result = row.normalized_result;
  if (result?.IntelligenceInvocation?.intelligence_id !== stage || result?.HandoffReceipt?.run_id !== row.id || result?.HandoffReceipt?.persisted !== true) throw new Error("joint_child_result_identity_invalid");
  if (result.ReleaseEligibility?.eligible !== false || result.HandoffReceipt?.external_release_action_performed !== false || row.external_release_performed !== false) throw new Error("joint_child_release_boundary_invalid");
  const output = validateIntelligenceOutput(result.result?.intelligence_output, stage);
  return { output, outputSha256: await sha256(output), result };
}

export async function assessStage(stage, child, artifactIdentity) {
  intelligenceContractFor(stage);
  const output = child.output;
  const result = child.result;
  const verdict = result.Verdict?.status;
  const candidateVerdict = result.Verdict?.model_candidate_decision;
  if (verdict !== "pass" || candidateVerdict !== "pass") return { eligible: false, code: `joint_${stage}_non_pass`, artifactIdentity: artifactIdentity || null };
  if (stage === "communicator" && (output.activation_recommendation !== "mediator" || !output.objective)) return { eligible: false, code: "joint_communicator_handoff_invalid", artifactIdentity: null };
  if (stage === "mediator" && (!output.constraints.length || !output.acceptance_tests.length || !output.forbidden_patterns.length)) return { eligible: false, code: "joint_constraints_incomplete", artifactIdentity: null };
  if (stage === "drafter" && (!output.content || !output.constraint_acknowledgements.length)) return { eligible: false, code: "joint_artifact_incomplete", artifactIdentity: null };
  if (stage === "refiner" && output.verification_verdict !== "pass") return { eligible: false, code: `joint_refiner_${output.verification_verdict}`, artifactIdentity };
  if (stage === "origin" && (output.precondition_verdict !== "pass" || output.artifact_identity !== artifactIdentity || output.commit_authority_exercised !== false)) return { eligible: false, code: "joint_origin_lineage_invalid", artifactIdentity };
  return { eligible: true, code: null, artifactIdentity: stage === "drafter" ? await sha256(output.content) : artifactIdentity || null };
}

export async function executeOneActivatedStage(stage, invokeChild) {
  if (!STAGES.includes(stage) || typeof invokeChild !== "function") throw new Error("joint_executor_invalid");
  return await invokeChild(stage);
}
