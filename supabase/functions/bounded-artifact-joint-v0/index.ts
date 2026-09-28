import { createClient } from "npm:@supabase/supabase-js@2.103.2";
import {
  FLOW_TYPE, STAGES, assessStage, buildHandoff, buildStageInput,
  executeOneActivatedStage, nextStage, validateChildRun, validateHandoff,
  validateJointRequest
} from "./lib.mjs";
import { NEXUS_COMMIT, sha256 } from "../live-governed-evaluation-v0/lib.mjs";

const JSON_HEADERS = { "content-type": "application/json", "cache-control": "no-store" };
const DEFAULT_ALLOWED_ORIGINS = ["https://camilocarlone.com", "http://127.0.0.1:8780", "http://localhost:8780"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedOrigins = () => (Deno.env.get("AETHERUS_ALLOWED_ORIGINS") || DEFAULT_ALLOWED_ORIGINS.join(",")).split(",").map((s) => s.trim()).filter(Boolean);
function cors(origin: string | null) {
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS", vary: "origin" };
}
function reply(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...cors(origin) } });
}
const message = (error: unknown) => error instanceof Error ? error.message : "joint_runtime_failure";

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigins().includes(origin)) return reply(403, { error: "origin_not_allowed" }, origin);
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  const url = new URL(request.url);
  if (request.method !== "POST" || !url.pathname.endsWith("/bounded-artifact-joint-v0") || url.search) return reply(404, { error: "not_found" }, origin);
  if (origin && !allowedOrigins().includes(origin)) return reply(403, { error: "origin_not_allowed" }, origin);
  if (Number(request.headers.get("content-length") || "0") > 8192) return reply(413, { error: "request_too_large" }, origin);
  const bearer = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/.test(bearer)) return reply(401, { error: "session_required" }, origin);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publicKey || !serviceKey) return reply(503, { error: "persistence_configuration_unavailable" }, origin);
  let body: Record<string, unknown>;
  try { body = JSON.parse(await request.text()); }
  catch { return reply(400, { error: "invalid_json" }, origin); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, { error: "invalid_request" }, origin);
  const userClient = createClient(supabaseUrl, publicKey, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const identity = await userClient.auth.getUser();
  const user = identity.data.user;
  if (identity.error || !user) return reply(401, { error: "session_not_recognized" }, origin);

  async function membership(workspaceId: string) {
    const result = await userClient.from("workspace_memberships").select("workspace_id,user_id,status")
      .eq("workspace_id", workspaceId).eq("user_id", user!.id).eq("status", "active").maybeSingle();
    if (result.error) throw new Error("workspace_membership_indeterminate");
    return Boolean(result.data);
  }
  async function db(result: { error?: { message?: string } | null }, code: string) {
    if (result.error) throw new Error(code);
    return result;
  }
  async function event(flow: any, type: string, payload: Record<string, unknown>) {
    const latest = await admin.from("bounded_artifact_joint_events").select("sequence")
      .eq("joint_flow_id", flow.id).order("sequence", { ascending: false }).limit(1);
    await db(latest, "joint_event_sequence_unavailable");
    const sequence = (latest.data?.[0]?.sequence || 0) + 1;
    await db(await admin.from("bounded_artifact_joint_events").insert({
      joint_flow_id: flow.id, workspace_id: flow.workspace_id, user_id: flow.user_id,
      sequence, event_type: type, payload, payload_sha256: await sha256(payload)
    }), "joint_event_persistence_failed");
  }
  async function updateFlow(flow: any, values: Record<string, unknown>) {
    await db(await admin.from("bounded_artifact_joint_runs").update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", flow.id).eq("workspace_id", flow.workspace_id).eq("user_id", flow.user_id)
      .select("id").single(), "joint_flow_persistence_failed");
  }
  async function updateStage(flow: any, stage: any, values: Record<string, unknown>) {
    await db(await admin.from("bounded_artifact_joint_stages").update(values).eq("id", stage.id)
      .eq("joint_flow_id", flow.id).eq("workspace_id", flow.workspace_id).eq("user_id", flow.user_id)
      .select("id").single(), "joint_stage_persistence_failed");
  }
  async function stopFlow(flow: any, stage: any, code: string, kind: "blocked" | "failed", childRunId: string | null = null, outputSha256: string | null = null) {
    const ended = new Date().toISOString();
    const current = await admin.from("bounded_artifact_joint_stages").select("state,child_run_id,output_sha256")
      .eq("id", stage.id).eq("joint_flow_id", flow.id).single();
    await db(current, "joint_stop_stage_read_failed");
    if (current.data.state !== "completed") {
      await updateStage(flow, stage, {
        state: kind, child_run_id: current.data.child_run_id || childRunId,
        output_schema_version: current.data.output_sha256 || outputSha256 ? "0.1" : null,
        output_sha256: current.data.output_sha256 || outputSha256,
        failure_code: code, completed_at: ended
      });
    }
    await db(await admin.from("bounded_artifact_joint_stages").update({ state: "skipped", failure_code: `upstream_${kind}`, completed_at: ended })
      .eq("joint_flow_id", flow.id).gt("ordinal", stage.ordinal).eq("state", "pending"), "joint_skip_persistence_failed");
    await updateFlow(flow, { status: kind, current_stage: stage.intelligence_id, failure_code: code, terminal_result: { stage: stage.intelligence_id, state: kind, code, child_run_id: current.data.child_run_id || childRunId, external_release_performed: false }, completed_at: ended });
    await event(flow, "stage_stopped", { stage: stage.intelligence_id, state: kind, code, child_run_id: current.data.child_run_id || childRunId });
    return reply(200, { joint_flow_id: flow.id, status: kind, stage: stage.intelligence_id, code, child_run_id: childRunId }, origin);
  }

  if (body.action === "create") {
    if (Object.keys(body).sort().join(",") !== "action,request") return reply(400, { error: "joint_create_fields_mismatch" }, origin);
    let input;
    try { input = validateJointRequest(body.request); }
    catch (error) { return reply(400, { error: message(error) }, origin); }
    try {
      if (!await membership(input.workspace_id)) return reply(403, { error: "workspace_membership_required" }, origin);
      const inserted = await admin.from("bounded_artifact_joint_runs").insert({
        client_request_id: input.client_request_id, workspace_id: input.workspace_id, user_id: user.id,
        flow_type: FLOW_TYPE, status: "pending", current_stage: "communicator",
        request_payload: input, request_sha256: await sha256(input), consent_reference: input.consent_reference
      }).select("*").single();
      if (inserted.error?.code === "23505") return reply(409, { error: "joint_client_request_already_exists" }, origin);
      await db(inserted, "joint_identity_persistence_failed");
      const flow = inserted.data;
      try {
        await db(await admin.from("bounded_artifact_joint_stages").insert(STAGES.map((id, index) => ({
          joint_flow_id: flow.id, workspace_id: flow.workspace_id, user_id: user.id,
          ordinal: index + 1, intelligence_id: id, state: "pending"
        }))), "joint_stage_set_persistence_failed");
        await event(flow, "joint_created", { flow_type: FLOW_TYPE, request_sha256: flow.request_sha256, consent_reference: input.consent_reference, stage_order: STAGES });
      } catch (error) {
        await db(await admin.from("bounded_artifact_joint_stages").update({
          state: "skipped", failure_code: "joint_initialization_failed", completed_at: new Date().toISOString()
        }).eq("joint_flow_id", flow.id).eq("state", "pending"), "joint_initialization_skip_failed");
        await updateFlow(flow, { status: "failed", failure_code: message(error), completed_at: new Date().toISOString() });
        return reply(503, { error: message(error), joint_flow_id: flow.id }, origin);
      }
      return reply(201, { joint_flow_id: flow.id, status: "pending", next_stage: "communicator" }, origin);
    } catch (error) { return reply(503, { error: message(error) }, origin); }
  }

  if (body.action !== "advance" || Object.keys(body).sort().join(",") !== "action,joint_flow_id" || !UUID.test(String(body.joint_flow_id))) {
    return reply(400, { error: "joint_advance_request_invalid" }, origin);
  }
  const visible = await userClient.from("bounded_artifact_joint_runs").select("*").eq("id", body.joint_flow_id).maybeSingle();
  if (visible.error) return reply(503, { error: "joint_read_indeterminate" }, origin);
  const flow = visible.data;
  if (!flow || flow.user_id !== user.id || !await membership(flow.workspace_id)) return reply(403, { error: "joint_workspace_binding_required" }, origin);
  if (["completed", "blocked", "failed"].includes(flow.status)) return reply(200, { joint_flow_id: flow.id, status: flow.status, terminal_result: flow.terminal_result }, origin);
  const stageResult = await admin.from("bounded_artifact_joint_stages").select("*").eq("joint_flow_id", flow.id).order("ordinal");
  if (stageResult.error) return reply(503, { error: "joint_stage_read_failed" }, origin);
  let decision;
  try { decision = nextStage(stageResult.data); }
  catch (error) { return reply(503, { error: message(error), joint_flow_id: flow.id }, origin); }
  if (decision.status === "in_progress") return reply(409, { error: "joint_stage_already_active", joint_flow_id: flow.id, stage: decision.stage }, origin);
  if (decision.status !== "eligible") return reply(409, { error: "joint_terminal_state_inconsistent", joint_flow_id: flow.id }, origin);
  const stages = stageResult.data;
  const stage = stages[decision.ordinal - 1];
  let inputText = "";
  let incoming: any = null;
  let artifactIdentity: string | null = null;
  try {
    const outputs: Record<string, any> = {};
    if (stage.ordinal === 1) {
      const created = await admin.from("bounded_artifact_joint_events").select("payload,payload_sha256")
        .eq("joint_flow_id", flow.id).eq("event_type", "joint_created").limit(1).maybeSingle();
      await db(created, "joint_creation_evidence_read_failed");
      if (!created.data || created.data.payload_sha256 !== await sha256(created.data.payload)
        || created.data.payload.request_sha256 !== flow.request_sha256) throw new Error("joint_creation_evidence_invalid");
    }
    for (const prior of stages.slice(0, stage.ordinal - 1)) {
      if (prior.state !== "completed" || !prior.child_run_id) throw new Error("joint_prior_stage_incomplete");
      const record = await admin.from("live_governed_evaluation_runs").select("*").eq("id", prior.child_run_id).single();
      await db(record, "joint_prior_child_missing");
      const verified = await validateChildRun(record.data, { stage: prior.intelligence_id, workspaceId: flow.workspace_id, userId: flow.user_id, inputText: record.data.input_payload?.input_text });
      if (verified.outputSha256 !== prior.output_sha256) throw new Error("joint_prior_output_digest_mismatch");
      outputs[prior.intelligence_id] = verified.output;
      if (prior.intelligence_id === "drafter") {
        if (prior.artifact_identity !== await sha256(verified.output.content)) throw new Error("joint_artifact_identity_mismatch");
        artifactIdentity = prior.artifact_identity;
      }
      if (["refiner", "origin"].includes(prior.intelligence_id) && prior.artifact_identity !== artifactIdentity) throw new Error("joint_artifact_lineage_mismatch");
      if (prior.intelligence_id === "refiner") outputs.refiner_verification_identity = prior.output_sha256;
    }
    outputs.artifact_identity = artifactIdentity;
    if (stage.ordinal > 1) {
      const previous = stages[stage.ordinal - 2];
      const handoffs = await admin.from("bounded_artifact_joint_events").select("payload,payload_sha256")
        .eq("joint_flow_id", flow.id).eq("event_type", "handoff_created").order("sequence", { ascending: false }).limit(1);
      await db(handoffs, "joint_handoff_read_failed");
      const found = handoffs.data?.[0];
      incoming = await validateHandoff(found?.payload, found?.payload_sha256, {
        jointFlowId: flow.id, workspaceId: flow.workspace_id, consentReference: flow.consent_reference,
        upstreamStage: previous.intelligence_id, downstreamStage: stage.intelligence_id,
        childRunId: previous.child_run_id, outputSha256: previous.output_sha256,
        artifactIdentity: previous.artifact_identity || null
      });
    }
    inputText = buildStageInput(stage.intelligence_id, flow.request_payload, outputs, incoming);
  } catch (error) {
    try { return await stopFlow(flow, stage, message(error), "blocked"); }
    catch { return reply(503, { error: "joint_failure_evidence_persistence_failed", joint_flow_id: flow.id }, origin); }
  }

  const childClientRequestId = crypto.randomUUID();
  const claimed = await admin.from("bounded_artifact_joint_stages").update({
    state: "active", started_at: new Date().toISOString(), input_sha256: await sha256(inputText),
    incoming_handoff_sha256: incoming ? await sha256(incoming) : null,
    child_client_request_id: childClientRequestId
  }).eq("id", stage.id).eq("state", "pending").select("id").maybeSingle();
  if (claimed.error) return reply(503, { error: "joint_stage_claim_failed", joint_flow_id: flow.id }, origin);
  if (!claimed.data) return reply(409, { error: "joint_stage_already_claimed", joint_flow_id: flow.id }, origin);
  try {
    await updateFlow(flow, { status: "active", current_stage: stage.intelligence_id });
    await event(flow, "stage_activated", { stage: stage.intelligence_id, ordinal: stage.ordinal, input_sha256: await sha256(inputText), incoming_handoff_sha256: incoming ? await sha256(incoming) : null });
  } catch (error) {
    try { return await stopFlow(flow, stage, message(error), "failed"); }
    catch { return reply(503, { error: "joint_failure_evidence_persistence_failed", joint_flow_id: flow.id }, origin); }
  }

  let childRunId: string | null = null;
  try {
    const response = await executeOneActivatedStage(stage.intelligence_id, async () => fetch(`${supabaseUrl}/functions/v1/live-governed-evaluation-v0`, {
      method: "POST",
      headers: { authorization: bearer, apikey: publicKey, "content-type": "application/json" },
      body: JSON.stringify({
        client_request_id: childClientRequestId, workspace_id: flow.workspace_id,
        intelligence_id: stage.intelligence_id, input_text: inputText,
        data_classification: "non_sensitive", external_processing_consent: true
      })
    }));
    const body = await response.json();
    childRunId = UUID.test(String(body?.run_id)) ? body.run_id : null;
    if (!response.ok || body?.status !== "completed" || !childRunId) throw new Error(body?.error || "joint_child_execution_failed");
    const record = await admin.from("live_governed_evaluation_runs").select("*").eq("id", childRunId).single();
    await db(record, "joint_child_persistence_missing");
    const verified = await validateChildRun(record.data, { stage: stage.intelligence_id, workspaceId: flow.workspace_id, userId: flow.user_id, inputText });
    const assessment = await assessStage(stage.intelligence_id, verified, artifactIdentity);
    if (!assessment.eligible) return await stopFlow(flow, stage, assessment.code, "blocked", childRunId, verified.outputSha256);
    const ended = new Date().toISOString();
    await updateStage(flow, stage, {
      state: "completed", child_run_id: childRunId, output_schema_version: "0.1",
      output_sha256: verified.outputSha256, artifact_identity: assessment.artifactIdentity, completed_at: ended
    });
    await event(flow, "stage_completed", {
      stage: stage.intelligence_id, child_run_id: childRunId,
      model_response_id: record.data.model_response_id,
      output_schema_version: "0.1", output_sha256: verified.outputSha256,
      artifact_identity: assessment.artifactIdentity,
      nexus_commit: NEXUS_COMMIT,
      nexus_result_sha256: record.data.nexus_evidence.execution_host_result_sha256
    });
    if (stage.ordinal === 5) {
      const terminal = {
        status: "completed", artifact_identity: assessment.artifactIdentity,
        origin_child_run_id: childRunId, origin_output_sha256: verified.outputSha256,
        commit_authority_exercised: false, external_release_performed: false
      };
      await event(flow, "joint_completed", terminal);
      await updateFlow(flow, { status: "completed", current_stage: "origin", terminal_result: terminal, completed_at: ended });
      return reply(200, { joint_flow_id: flow.id, status: "completed", stage: "origin", terminal_result: terminal }, origin);
    }
    const handoff = await buildHandoff({
      jointFlowId: flow.id, workspaceId: flow.workspace_id, consentReference: flow.consent_reference,
      upstreamStage: stage.intelligence_id, childRunId,
      outputSha256: verified.outputSha256, artifactIdentity: assessment.artifactIdentity, createdAt: ended
    });
    await event(flow, "handoff_created", handoff.handoff);
    await updateFlow(flow, { current_stage: STAGES[stage.ordinal] });
    return reply(200, { joint_flow_id: flow.id, status: "active", completed_stage: stage.intelligence_id, next_stage: STAGES[stage.ordinal], child_run_id: childRunId }, origin);
  } catch (error) {
    if (!childRunId) {
      const recovered = await admin.from("live_governed_evaluation_runs").select("id")
        .eq("workspace_id", flow.workspace_id).eq("user_id", flow.user_id)
        .eq("client_request_id", childClientRequestId).maybeSingle();
      if (!recovered.error && recovered.data?.id) childRunId = recovered.data.id;
    }
    try { return await stopFlow(flow, stage, message(error), "failed", childRunId); }
    catch { return reply(503, { error: "joint_failure_evidence_persistence_failed", joint_flow_id: flow.id, child_run_id: childRunId }, origin); }
  }
});
