import { initializeSupabaseBrowserClient } from "./supabase-client.js";

const FUNCTION = "bounded-artifact-joint-v0";
const STAGES = ["communicator", "mediator", "drafter", "refiner", "origin"];
const root = document.querySelector("[data-joint-mode]");
const form = root?.querySelector("[data-joint-form]");
const requestField = root?.querySelector("[data-joint-request]");
const contextField = root?.querySelector("[data-joint-context]");
const consentField = root?.querySelector("[data-joint-consent]");
const startButton = root?.querySelector("[data-joint-start]");
const continueButton = root?.querySelector("[data-joint-continue]");
const statusNode = root?.querySelector("[data-joint-status]");
const identityNode = root?.querySelector("[data-joint-identity]");
const stagesNode = root?.querySelector("[data-joint-stages]");
const artifactNode = root?.querySelector("[data-joint-artifact]");
const evidenceNode = root?.querySelector("[data-joint-evidence]");

let clientPromise;
let flowId = "";
let busy = false;
let currentFlow = null;
let currentStages = [];
let errorMessage = "";

function status(message) {
  if (statusNode) statusNode.textContent = message;
}

async function authenticated() {
  clientPromise ||= initializeSupabaseBrowserClient();
  const configured = await clientPromise;
  if (!configured?.client_initialized || !configured.client) throw new Error("Supabase browser runtime unavailable.");
  const client = configured.client;
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.user?.id) throw new Error("Sign in before using the bounded Joint.");
  return { client, session: data.session };
}

async function workspace(client, session, create) {
  const slug = `aetherus-review-workspace-${session.user.id}`;
  if (!create) {
    const found = await client.from("workspaces").select("id").eq("slug", slug).maybeSingle();
    if (found.error) throw new Error("Workspace lookup unavailable.");
    return found.data;
  }
  const now = new Date().toISOString();
  const found = await client.from("workspaces").upsert({
    slug, name: "AETHERUS Review Workspace", owner_user_id: session.user.id, updated_at: now
  }, { onConflict: "slug" }).select("id").single();
  if (found.error) throw new Error("Workspace identity unavailable.");
  const member = await client.from("workspace_memberships").upsert({
    workspace_id: found.data.id, user_id: session.user.id, role: "owner", status: "active",
    invited_by_user_id: session.user.id, updated_at: now
  }, { onConflict: "workspace_id,user_id" }).select("workspace_id").single();
  if (member.error) throw new Error("Active workspace membership unavailable.");
  return found.data;
}

async function invoke(client, body) {
  const response = await client.functions.invoke(FUNCTION, { body });
  if (response.error) {
    let code = "Joint endpoint unavailable.";
    try { code = (await response.error.context?.clone().json())?.error || code; } catch { /* retain bounded error */ }
    throw new Error(code);
  }
  if (!response.data?.joint_flow_id) throw new Error("Joint response has no persisted identity.");
  return response.data;
}

function item(label, value) {
  const row = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = label;
  const detail = document.createElement("p");
  detail.textContent = value;
  row.append(heading, detail);
  return row;
}

async function loadFlow(client, workspaceId, id = "") {
  let query = client.from("bounded_artifact_joint_runs").select("id,status,current_stage,terminal_result,failure_code,created_at")
    .eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(1);
  if (id) query = query.eq("id", id);
  const result = await query.maybeSingle();
  if (result.error) throw new Error("Joint state could not be loaded.");
  if (!id && (busy || flowId)) return;
  currentFlow = result.data;
  flowId = currentFlow?.id || "";
  if (!currentFlow) { render(); return; }
  const stageResult = await client.from("bounded_artifact_joint_stages")
    .select("ordinal,intelligence_id,state,child_run_id,output_sha256,artifact_identity,failure_code")
    .eq("joint_flow_id", flowId).order("ordinal");
  if (stageResult.error || stageResult.data?.length !== 5) throw new Error("Joint stage set could not be verified.");
  currentStages = stageResult.data;
  const childIds = currentStages.map((stage) => stage.child_run_id).filter(Boolean);
  let children = [];
  if (childIds.length) {
    const runs = await client.from("live_governed_evaluation_runs")
      .select("id,intelligence_id,status,model_response_id,normalized_result")
      .eq("workspace_id", workspaceId).in("id", childIds);
    if (runs.error || runs.data?.length !== childIds.length) throw new Error("Joint child evidence could not be verified.");
    children = runs.data;
  }
  render(children);
}

function render(children = []) {
  if (!root) return;
  identityNode.hidden = !flowId;
  identityNode.textContent = flowId ? `Joint flow · ${flowId}` : "";
  continueButton.hidden = !currentFlow || !["pending", "active"].includes(currentFlow.status);
  const active = currentStages.some((stage) => stage.state === "active");
  continueButton.disabled = busy || active || !currentFlow || !["pending", "active"].includes(currentFlow.status);
  startButton.disabled = busy;
  stagesNode.replaceChildren();
  for (const stageId of STAGES) {
    const stage = currentStages.find((entry) => entry.intelligence_id === stageId);
    const li = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = stageId[0].toUpperCase() + stageId.slice(1);
    const state = document.createElement("span");
    state.textContent = stage?.state || "not loaded";
    state.dataset.state = stage?.state || "unknown";
    li.append(name, state);
    stagesNode.append(li);
  }
  artifactNode.replaceChildren();
  evidenceNode.replaceChildren();
  const byStage = Object.fromEntries(children.map((child) => [child.intelligence_id, child]));
  const draft = byStage.drafter?.normalized_result?.result?.intelligence_output;
  const verification = byStage.refiner?.normalized_result?.result?.intelligence_output;
  const origin = byStage.origin?.normalized_result?.result?.intelligence_output;
  artifactNode.append(item("Artifact candidate", draft?.content || "No artifact candidate has been persisted."));
  if (verification) artifactNode.append(item("Verification", `${verification.verification_verdict} · ${verification.findings?.join(" ") || "No findings recorded."}`));
  if (origin) artifactNode.append(item("Lineage brief", origin.delta_brief));
  if (currentFlow?.terminal_result) artifactNode.append(item("Joint result", `${currentFlow.status} · artifact ${currentFlow.terminal_result.artifact_identity || "not established"} · no external release`));
  for (const stage of currentStages) {
    if (stage.child_run_id) {
      const child = byStage[stage.intelligence_id];
      evidenceNode.append(item(`${stage.intelligence_id} · ${stage.state}`,
        `Child run ${stage.child_run_id} · output ${stage.output_sha256 || "unavailable"} · model response ${child?.model_response_id || "unavailable"}`));
    }
  }
  if (!evidenceNode.children.length) evidenceNode.append(item("Evidence", "No stage evidence has been persisted."));
  status(errorMessage || (currentFlow ? `Joint ${currentFlow.status}${currentFlow.current_stage ? ` · ${currentFlow.current_stage}` : ""}${currentFlow.failure_code ? ` · ${currentFlow.failure_code}` : ""}.` : "No Joint flow loaded."));
}

async function advance(client, workspaceId) {
  for (let count = 0; count < STAGES.length; count += 1) {
    const response = await invoke(client, { action: "advance", joint_flow_id: flowId });
    await loadFlow(client, workspaceId, flowId);
    if (["completed", "blocked", "failed"].includes(response.status)) break;
    if (!response.next_stage) throw new Error("Next stage eligibility was not established.");
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !form.reportValidity()) return;
  busy = true;
  errorMessage = "";
  render();
  try {
    const { client, session } = await authenticated();
    const scope = await workspace(client, session, true);
    const response = await invoke(client, { action: "create", request: {
      client_request_id: crypto.randomUUID(), workspace_id: scope.id,
      artifact_request: requestField.value.trim(), scenario_context: contextField.value.trim(),
      consent_reference: `joint-consent:${crypto.randomUUID()}`,
      data_classification: "non_sensitive", external_processing_consent: consentField.checked === true
    } });
    flowId = response.joint_flow_id;
    consentField.checked = false;
    await loadFlow(client, scope.id, flowId);
    await advance(client, scope.id);
  } catch (error) { errorMessage = `Joint stopped: ${error.message}`; }
  finally { busy = false; render(); }
});

continueButton?.addEventListener("click", async () => {
  if (busy || !flowId || continueButton.disabled) return;
  busy = true;
  errorMessage = "";
  render();
  try {
    const { client, session } = await authenticated();
    const scope = await workspace(client, session, false);
    if (!scope) throw new Error("Workspace not found.");
    await advance(client, scope.id);
  } catch (error) { errorMessage = `Joint stopped: ${error.message}`; }
  finally { busy = false; render(); }
});

async function restore() {
  const { client, session } = await authenticated();
  if (busy || flowId) return;
  const scope = await workspace(client, session, false);
  if (scope) await loadFlow(client, scope.id);
}

restore().catch(() => { /* shell owns admission; reload never invokes a model */ });
