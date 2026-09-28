import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CHILD_RUN_TYPE, FLOW_TYPE, JOINT_CONTRACT, STAGES, assessStage,
  buildHandoff, buildStageInput, executeOneActivatedStage, nextStage,
  validateChildRun, validateHandoff, validateJointRequest,
  validateStageRows
} from "../supabase/functions/bounded-artifact-joint-v0/lib.mjs";
import {
  NEXUS_COMMIT, sha256, validateIntelligenceOutput
} from "../supabase/functions/live-governed-evaluation-v0/lib.mjs";

const ids = Object.freeze({
  flow: "11111111-1111-4111-8111-111111111111",
  workspace: "22222222-2222-4222-8222-222222222222",
  user: "33333333-3333-4333-8333-333333333333",
  child: "44444444-4444-4444-8444-444444444444"
});
const request = Object.freeze({
  client_request_id: ids.flow, workspace_id: ids.workspace,
  artifact_request: "Draft one bounded non-sensitive artifact for review.",
  scenario_context: "A local deterministic Joint test context.",
  consent_reference: "explicit-openai-consent-test-001",
  data_classification: "non_sensitive", external_processing_consent: true
});
const outputs = Object.freeze({
  communicator: { objective: "Produce one bounded artifact.", activation_recommendation: "mediator", constraints_to_resolve: ["Confirm source boundary."] },
  mediator: { constraints: ["Non-sensitive input only."], acceptance_tests: ["Artifact stays bounded."], forbidden_patterns: ["No release action."] },
  drafter: { content: "A bounded artifact candidate.", constraint_acknowledgements: ["No release action."] },
  refiner: { verification_verdict: "pass", findings: [], patchlist: [] },
  origin: { precondition_verdict: "pass", artifact_identity: "artifact-placeholder", delta_brief: "Lineage only.", commit_authority_exercised: false }
});
const rows = (states) => STAGES.map((id, i) => ({ ordinal: i + 1, intelligence_id: id, state: states[i] }));

test("operational contract is separate from the historical manifest and fixes five ordered independent stages", () => {
  assert.equal(FLOW_TYPE, "bounded_artifact_joint_v0");
  assert.equal(JOINT_CONTRACT.authority, "operational");
  assert.equal(JOINT_CONTRACT.historical_manifest_is_runtime_authority, false);
  assert.deepEqual(STAGES, ["communicator", "mediator", "drafter", "refiner", "origin"]);
  assert.deepEqual(JOINT_CONTRACT.allowed_intelligence_ids, STAGES);
  assert.equal(JOINT_CONTRACT.orchestrator.model_calls, 0);
  assert.equal(JOINT_CONTRACT.model_call_ceiling, 5);
  assert.equal(JOINT_CONTRACT.orchestrator.automatic_model_retries, false);
  assert.equal(JOINT_CONTRACT.external_action_boundary.external_release_performed, false);
  assert.equal(JOINT_CONTRACT.external_action_boundary.origin_commit_authority_exercised, false);
  assert.equal(JOINT_CONTRACT.nexus_boundary.kernel_commit, NEXUS_COMMIT);
  const existing = JSON.parse(readFileSync(new URL("../data/intelligence-runtime-contracts.v0.json", import.meta.url)));
  for (const stage of JOINT_CONTRACT.stages) {
    assert.deepEqual(Object.keys(outputs[stage.id]).sort(), [...stage.output_schema.required].sort());
    assert.deepEqual(validateIntelligenceOutput(outputs[stage.id], stage.id), outputs[stage.id]);
    const required = existing.intelligences.find((item) => item.id === stage.id).required_knowledge_resources;
    for (const resource of required) assert.ok(stage.resources.includes(resource), `${stage.id} omits ${resource}`);
  }
});

test("Joint request requires bounded explicit input, context and per-flow OpenAI consent", () => {
  assert.deepEqual(validateJointRequest(request), request);
  assert.throws(() => validateJointRequest({ ...request, external_processing_consent: false }), /joint_processing_consent_required/);
  assert.throws(() => validateJointRequest({ ...request, data_classification: "sensitive" }), /joint_processing_consent_required/);
  assert.throws(() => validateJointRequest({ ...request, artifact_request: "short" }), /joint_artifact_request_invalid/);
  assert.throws(() => validateJointRequest({ ...request, extra: true }), /joint_request_fields_mismatch/);
});

test("state machine activates only the next persisted eligible stage and marks terminal ineligibility", () => {
  assert.equal(nextStage(rows(["pending", "pending", "pending", "pending", "pending"])).stage, "communicator");
  assert.equal(nextStage(rows(["completed", "pending", "pending", "pending", "pending"])).stage, "mediator");
  assert.equal(nextStage(rows(["completed", "completed", "pending", "pending", "pending"])).stage, "drafter");
  assert.equal(nextStage(rows(["completed", "completed", "completed", "pending", "pending"])).stage, "refiner");
  assert.equal(nextStage(rows(["completed", "completed", "completed", "completed", "pending"])).stage, "origin");
  assert.equal(nextStage(rows(["completed", "completed", "completed", "completed", "completed"])).status, "completed");
  assert.equal(nextStage(rows(["failed", "skipped", "skipped", "skipped", "skipped"])).status, "terminal");
  assert.equal(nextStage(rows(["completed", "blocked", "skipped", "skipped", "skipped"])).status, "terminal");
  assert.equal(nextStage(rows(["completed", "completed", "failed", "skipped", "skipped"])).status, "terminal");
  assert.equal(nextStage(rows(["completed", "completed", "completed", "blocked", "skipped"])).status, "terminal");
  assert.equal(nextStage(rows(["active", "pending", "pending", "pending", "pending"])).status, "in_progress");
  assert.throws(() => nextStage(rows(["pending", "completed", "pending", "pending", "pending"])), /joint_predecessor_incomplete/);
  assert.throws(() => validateStageRows(rows(["pending", "pending", "pending", "pending", "pending"]).reverse()), /joint_stage_order_invalid/);
});

test("each handoff binds child run, output hash, workspace, consent, pin and next stage", async () => {
  const outputSha256 = await sha256(outputs.communicator);
  const made = await buildHandoff({ jointFlowId: ids.flow, workspaceId: ids.workspace,
    consentReference: request.consent_reference, upstreamStage: "communicator", childRunId: ids.child,
    outputSha256, artifactIdentity: null, createdAt: "2026-09-28T12:00:00.000Z" });
  const expected = { jointFlowId: ids.flow, workspaceId: ids.workspace, consentReference: request.consent_reference,
    upstreamStage: "communicator", downstreamStage: "mediator", childRunId: ids.child, outputSha256, artifactIdentity: null };
  assert.deepEqual(await validateHandoff(made.handoff, made.sha256, expected), made.handoff);
  await assert.rejects(validateHandoff(made.handoff, made.sha256, { ...expected, workspaceId: ids.user }), /joint_handoff_binding_mismatch/);
  await assert.rejects(validateHandoff({ ...made.handoff, nexus_commit: "wrong" }, made.sha256, expected), /joint_handoff_digest_mismatch/);
  await assert.rejects(validateHandoff(made.handoff, made.sha256, { ...expected, downstreamStage: "drafter" }), /joint_handoff_stage_mismatch/);
  assert.throws(() => buildStageInput("mediator", request, { communicator: outputs.communicator }, null), /joint_incoming_handoff_missing/);
  assert.match(buildStageInput("mediator", request, { communicator: outputs.communicator }, made.handoff), /execution_plan/);
});

test("prior child must be a persisted, workspace-bound, model-and-NEXUS-identified non-release run", async () => {
  const inputText = buildStageInput("communicator", request, {}, null);
  const row = { id: ids.child, run_type: CHILD_RUN_TYPE, status: "completed", intelligence_id: "communicator",
    workspace_id: ids.workspace, user_id: ids.user, input_sha256: await sha256(inputText),
    model_response_id: "resp_test", model_output_sha256: await sha256("model output"),
    nexus_evidence: { nexus_commit: NEXUS_COMMIT, execution_host_result_sha256: await sha256("nexus output") },
    external_release_performed: false,
    normalized_result: { IntelligenceInvocation: { intelligence_id: "communicator" },
      HandoffReceipt: { run_id: ids.child, persisted: true, external_release_action_performed: false },
      ReleaseEligibility: { eligible: false }, result: { intelligence_output: outputs.communicator } } };
  const expected = { stage: "communicator", workspaceId: ids.workspace, userId: ids.user, inputText };
  assert.deepEqual((await validateChildRun(row, expected)).output, outputs.communicator);
  await assert.rejects(validateChildRun({ ...row, workspace_id: ids.user }, expected), /joint_child_binding_mismatch/);
  await assert.rejects(validateChildRun({ ...row, model_response_id: null }, expected), /joint_child_model_identity_missing/);
  await assert.rejects(validateChildRun({ ...row, external_release_performed: true }, expected), /joint_child_release_boundary_invalid/);
});

test("stage assessment blocks escalation, failed verification and Origin authority; success preserves artifact identity", async () => {
  const pass = (output, verdict = "pass") => ({ output, result: { Verdict: { status: verdict, model_candidate_decision: verdict } } });
  assert.equal((await assessStage("communicator", pass(outputs.communicator), null)).eligible, true);
  assert.equal((await assessStage("communicator", pass({ ...outputs.communicator, activation_recommendation: "human_review" }), null)).eligible, false);
  assert.equal((await assessStage("mediator", pass({ ...outputs.mediator, acceptance_tests: [] }), null)).eligible, false);
  assert.equal((await assessStage("mediator", pass(outputs.mediator, "escalate"), null)).eligible, false);
  assert.equal((await assessStage("drafter", pass(outputs.drafter, "fail"), null)).eligible, false);
  const drafted = await assessStage("drafter", pass(outputs.drafter), null);
  assert.equal(drafted.artifactIdentity, await sha256(outputs.drafter.content));
  assert.equal((await assessStage("refiner", pass({ ...outputs.refiner, verification_verdict: "fail" }), drafted.artifactIdentity)).eligible, false);
  assert.equal((await assessStage("refiner", pass({ ...outputs.refiner, verification_verdict: "escalate" }), drafted.artifactIdentity)).eligible, false);
  assert.equal((await assessStage("origin", pass({ ...outputs.origin, artifact_identity: drafted.artifactIdentity, commit_authority_exercised: true }), drafted.artifactIdentity)).eligible, false);
  assert.equal((await assessStage("origin", pass({ ...outputs.origin, artifact_identity: drafted.artifactIdentity }), drafted.artifactIdentity)).eligible, true);
});

test("bounded executor invokes each activated stage once with no orchestrator model call or retry", async () => {
  const invoked = [];
  for (const stage of STAGES) {
    const value = await executeOneActivatedStage(stage, async (id) => { invoked.push(id); return id; });
    assert.equal(value, stage);
  }
  assert.deepEqual(invoked, STAGES);
  assert.equal(invoked.length, JOINT_CONTRACT.model_call_ceiling);
  let failures = 0;
  await assert.rejects(executeOneActivatedStage("refiner", () => { failures += 1; throw new Error("model failed"); }), /model failed/);
  assert.equal(failures, 1);
});

test("deterministic five-stage integration carries only verified structured handoffs", async () => {
  const stageRows = rows(["pending", "pending", "pending", "pending", "pending"]);
  const collected = {};
  const invocations = [];
  let handoff = null;
  let artifactIdentity = null;
  for (const stage of STAGES) {
    const eligibility = nextStage(stageRows);
    assert.equal(eligibility.stage, stage);
    const inputText = buildStageInput(stage, request, { ...collected, artifact_identity: artifactIdentity,
      refiner_verification_identity: collected.refiner ? await sha256(collected.refiner) : null }, handoff);
    const input = JSON.parse(inputText);
    for (const field of JOINT_CONTRACT.stages[STAGES.indexOf(stage)].input_schema.required) assert.ok(Object.hasOwn(input, field), `${stage} input missing ${field}`);
    const output = stage === "origin" ? { ...outputs.origin, artifact_identity: artifactIdentity } : outputs[stage];
    const child = await executeOneActivatedStage(stage, async (id) => {
      invocations.push(id);
      return { output, result: { Verdict: { status: "pass", model_candidate_decision: "pass" } } };
    });
    const assessment = await assessStage(stage, child, artifactIdentity);
    assert.equal(assessment.eligible, true);
    collected[stage] = output;
    artifactIdentity = assessment.artifactIdentity;
    stageRows[eligibility.ordinal - 1].state = "completed";
    if (eligibility.ordinal < 5) {
      const made = await buildHandoff({ jointFlowId: ids.flow, workspaceId: ids.workspace,
        consentReference: request.consent_reference, upstreamStage: stage, childRunId: ids.child,
        outputSha256: await sha256(output), artifactIdentity,
        createdAt: "2026-09-28T12:00:00.000Z" });
      handoff = await validateHandoff(made.handoff, made.sha256, {
        jointFlowId: ids.flow, workspaceId: ids.workspace, consentReference: request.consent_reference,
        upstreamStage: stage, downstreamStage: STAGES[eligibility.ordinal], childRunId: ids.child,
        outputSha256: await sha256(output), artifactIdentity
      });
    }
    assert.match(inputText, /schema_version/);
  }
  assert.deepEqual(invocations, STAGES);
  assert.equal(nextStage(stageRows).status, "completed");
  assert.equal(artifactIdentity, await sha256(outputs.drafter.content));
  assert.equal(collected.origin.commit_authority_exercised, false);
});
