import { createClient } from "npm:@supabase/supabase-js@2.103.2";
import {
  MODEL_NAME,
  NEXUS_COMMIT,
  RUN_TYPE,
  buildNormalizedResult,
  extractStructuredOutput,
  intelligenceContractFor,
  modelOutputFormatFor,
  sha256,
  validateNexusHealth,
  validateNexusResult,
  validateRequestBody
} from "./lib.mjs";

const JSON_HEADERS = { "content-type": "application/json", "cache-control": "no-store" };
const DEFAULT_ALLOWED_ORIGINS = ["https://camilocarlone.com", "http://127.0.0.1:8780", "http://localhost:8780"];

function allowedOrigins() {
  return (Deno.env.get("AETHERUS_ALLOWED_ORIGINS") || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",").map((value) => value.trim()).filter(Boolean);
}

function corsHeaders(origin: string | null) {
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "600",
    vary: "origin"
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...corsHeaders(origin) } });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigins().includes(origin)) return json(403, { error: "origin_not_allowed" }, origin);
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  const url = new URL(request.url);
  if (request.method !== "POST" || !url.pathname.endsWith("/live-governed-evaluation-v0") || url.search) return json(404, { error: "not_found" }, origin);
  if (origin && !allowedOrigins().includes(origin)) return json(403, { error: "origin_not_allowed" }, origin);
  if (Number(request.headers.get("content-length") || "0") > 8192) return json(413, { error: "request_too_large" }, origin);

  const authHeader = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/.test(authHeader)) return json(401, { error: "session_required" }, origin);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const nexusUrl = (Deno.env.get("AETHERUS_NEXUS_EXECUTION_URL") || "").replace(/\/$/, "");
  const nexusToken = Deno.env.get("AETHERUS_NEXUS_EXECUTION_TOKEN");
  if (!supabaseUrl || !publicKey || !serviceRoleKey) return json(503, { error: "persistence_configuration_unavailable" }, origin);
  if (!openAiKey) return json(503, { error: "model_configuration_unavailable" }, origin);
  if (!nexusUrl || !nexusToken) return json(503, { error: "nexus_configuration_unavailable" }, origin);

  let input;
  try { input = validateRequestBody(JSON.parse(await request.text())); }
  catch (error) { return json(400, { error: error instanceof Error ? error.message : "invalid_request" }, origin); }

  const userClient = createClient(supabaseUrl, publicKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userResult = await userClient.auth.getUser();
  const user = userResult.data.user;
  if (userResult.error || !user) return json(401, { error: "session_not_recognized" }, origin);
  const membershipResult = await userClient.from("workspace_memberships")
    .select("workspace_id, user_id, role, status")
    .eq("workspace_id", input.workspace_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (membershipResult.error) return json(503, { error: "workspace_membership_indeterminate" }, origin);
  if (!membershipResult.data) return json(403, { error: "workspace_membership_required" }, origin);

  const inputSha256 = await sha256(input.input_text);
  const now = new Date().toISOString();
  const insertResult = await adminClient.from("live_governed_evaluation_runs").insert({
    client_request_id: input.client_request_id,
    workspace_id: input.workspace_id,
    user_id: user.id,
    run_type: RUN_TYPE,
    status: "accepted",
    input_payload: {
      input_text: input.input_text,
      intelligence_id: input.intelligence_id,
      data_classification: input.data_classification,
      external_processing_consent: input.external_processing_consent
    },
    input_sha256: inputSha256,
    intelligence_id: input.intelligence_id,
    model_name: MODEL_NAME,
    started_at: now,
    updated_at: now
  }).select("id").single();
  if (insertResult.error) {
    if (insertResult.error.code === "23505") return json(409, { error: "client_request_already_exists" }, origin);
    return json(503, { error: "run_identity_persistence_failed" }, origin);
  }

  const runId = insertResult.data.id;
  let eventSequence = 0;
  const traceEvents: Array<Record<string, unknown>> = [];
  async function recordEvent(eventType: string, payload: Record<string, unknown>) {
    eventSequence += 1;
    const result = await adminClient.from("live_governed_evaluation_events").insert({
      run_id: runId,
      workspace_id: input.workspace_id,
      user_id: user.id,
      sequence: eventSequence,
      event_type: eventType,
      payload,
      payload_sha256: await sha256(payload)
    });
    if (result.error) throw new Error("event_persistence_failed");
    traceEvents.push({ sequence: eventSequence, event_type: eventType });
  }

  async function updateRun(values: Record<string, unknown>) {
    const result = await adminClient.from("live_governed_evaluation_runs")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", runId).eq("workspace_id", input.workspace_id).eq("user_id", user.id);
    if (result.error) throw new Error("run_persistence_failed");
  }

  async function failClosed(stage: string, code: string, status = 503) {
    try {
      await recordEvent("run_failed", { stage, code });
      await updateRun({ status: "failed", failure_stage: stage, failure_code: code, completed_at: new Date().toISOString() });
    } catch {
      return json(503, { error: "failure_evidence_persistence_failed", run_id: runId }, origin);
    }
    return json(status, { error: code, stage, run_id: runId }, origin);
  }

  try {
    await recordEvent("run_accepted", {
      run_type: RUN_TYPE,
      intelligence_id: input.intelligence_id,
      input_sha256: inputSha256,
      data_classification: "non_sensitive",
      external_processing_consent: true
    });

    try {
      const healthResponse = await fetchWithTimeout(`${nexusUrl}/health`, { headers: { authorization: `Bearer ${nexusToken}` } }, 6000);
      if (!healthResponse.ok) return await failClosed("nexus_preflight", "nexus_host_not_ready");
      validateNexusHealth(await healthResponse.json());
    } catch { return await failClosed("nexus_preflight", "nexus_host_not_ready"); }
    await recordEvent("nexus_preflight_completed", { nexus_commit: NEXUS_COMMIT, source_clean: true, anthropic_enabled: false });

    await updateRun({ status: "executing_model" });
    const intelligence = intelligenceContractFor(input.intelligence_id);
    await recordEvent("model_execution_started", { provider: "openai", model: MODEL_NAME, intelligence_id: input.intelligence_id });
    const openAiRequest = {
      model: MODEL_NAME,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 1600,
      instructions: [
        "You are the single bounded model step in AETHERUS live_governed_evaluation_v0.",
        `The active Intelligence is ${intelligence.id}. Purpose: ${intelligence.purpose}`,
        `Activation condition: ${intelligence.activation_condition}`,
        `Authority boundary: ${intelligence.authority_boundary}`,
        `Required output: ${intelligence.produced_output_contract}`,
        "Evaluate only the submitted text. Do not claim access to external facts, tools, evidence, policies, or runtime state.",
        "Any evidence not literally present in the input remains a requirement, never established evidence.",
        "Your decision is a non-binding candidate. A deterministic server boundary and the pinned NEXUS kernel make the recorded verdict.",
        "Use fail when the requested action is clearly disallowed by the input; escalate when material context or evidence is missing; otherwise pass."
      ].join(" "),
      input: [{ role: "user", content: [{ type: "input_text", text: input.input_text }] }],
      text: { format: modelOutputFormatFor(input.intelligence_id) }
    };
    const openAiRequestSha256 = await sha256(openAiRequest);
    let openAiResponse;
    try {
      openAiResponse = await fetchWithTimeout("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { authorization: `Bearer ${openAiKey}`, "content-type": "application/json" },
        body: JSON.stringify(openAiRequest)
      }, 45000);
    } catch { return await failClosed("model_execution", "openai_request_failed"); }
    if (!openAiResponse.ok) return await failClosed("model_execution", `openai_http_${openAiResponse.status}`);
    const openAiRaw = await openAiResponse.json();
    let modelCandidate;
    try { modelCandidate = extractStructuredOutput(openAiRaw, input.intelligence_id); }
    catch (error) { return await failClosed("model_normalization", error instanceof Error ? error.message : "model_normalization_failed"); }
    const modelOutputSha256 = await sha256(modelCandidate);
    const modelEvidence = {
      provider: "openai", model: MODEL_NAME, intelligence_id: input.intelligence_id, response_id: openAiRaw.id,
      request_sha256: openAiRequestSha256, output_sha256: modelOutputSha256,
      usage: openAiRaw.usage || null, store: false
    };
    await updateRun({
      status: "executing_nexus", model_response_id: openAiRaw.id,
      model_output_sha256: modelOutputSha256, model_usage: openAiRaw.usage || null,
      model_evidence: modelEvidence
    });
    await recordEvent("model_execution_completed", { response_id: openAiRaw.id, output_sha256: modelOutputSha256 });

    const nexusRequest = {
      schema_version: "0.1", run_id: runId, intelligence_id: input.intelligence_id, input_text: input.input_text,
      input_sha256: inputSha256, model_candidate: modelCandidate,
      model_output_sha256: modelOutputSha256
    };
    await recordEvent("nexus_execution_started", { nexus_commit: NEXUS_COMMIT, request_sha256: await sha256(nexusRequest) });
    let nexusResponse;
    try {
      nexusResponse = await fetchWithTimeout(`${nexusUrl}/v1/evaluate`, {
        method: "POST",
        headers: { authorization: `Bearer ${nexusToken}`, "content-type": "application/json" },
        body: JSON.stringify(nexusRequest)
      }, 30000);
    } catch { return await failClosed("nexus_execution", "nexus_request_failed"); }
    if (!nexusResponse.ok) return await failClosed("nexus_execution", `nexus_http_${nexusResponse.status}`);
    let nexusResult;
    try { nexusResult = validateNexusResult(await nexusResponse.json()); }
    catch (error) { return await failClosed("nexus_normalization", error instanceof Error ? error.message : "nexus_normalization_failed"); }
    const nexusEvidenceSha256 = await sha256(nexusResult);
    const nexusEvidence = {
      nexus_commit: NEXUS_COMMIT,
      execution_host_result_sha256: nexusEvidenceSha256,
      adapter_identity: nexusResult.adapter_identity,
      audit_log_reference: nexusResult.audit_log_reference,
      normalized: nexusResult.normalized
    };
    await updateRun({ status: "evaluating_governance", nexus_evidence: nexusEvidence });
    await recordEvent("nexus_execution_completed", { nexus_commit: NEXUS_COMMIT, result_sha256: nexusEvidenceSha256 });

    const normalizedResult = buildNormalizedResult({
      runId, workspaceId: input.workspace_id, userId: user.id, intelligenceId: input.intelligence_id,
      inputText: input.input_text, inputSha256, modelResponseId: openAiRaw.id,
      modelOutputSha256, modelCandidate, nexusResult, nexusEvidenceSha256,
      traceEvents: [...traceEvents, { sequence: eventSequence + 1, event_type: "governance_evaluation_completed" }, { sequence: eventSequence + 2, event_type: "run_completed" }]
    });
    const governanceEvidence = {
      boundary: "live_governed_evaluation_v0_policy_boundary",
      intelligence_id: input.intelligence_id,
      manifest_reference: "data/joint-workflow.manifest.json",
      verdict: normalizedResult.Verdict,
      release_eligibility: normalizedResult.ReleaseEligibility,
      decision_sha256: await sha256({ Verdict: normalizedResult.Verdict, GateResult: normalizedResult.GateResult, ReleaseEligibility: normalizedResult.ReleaseEligibility })
    };
    await recordEvent("governance_evaluation_completed", { decision_sha256: governanceEvidence.decision_sha256, verdict: normalizedResult.Verdict.status });
    await recordEvent("run_completed", { normalized_result_sha256: await sha256(normalizedResult), external_release_action_performed: false });
    await updateRun({
      status: "completed", governance_evidence: governanceEvidence,
      normalized_result: normalizedResult, completed_at: new Date().toISOString(),
      failure_stage: null, failure_code: null
    });
    return json(200, { run_id: runId, status: "completed", normalized_result: normalizedResult }, origin);
  } catch (error) {
    return await failClosed("runtime", error instanceof Error ? error.message : "runtime_failure");
  }
});
