import { initializeSupabaseBrowserClient } from "./supabase-client.js";

const WORKSPACE_RECORD_TYPE = "release_review_workspace_state";
const WORKSPACE_RECORD_KEY = "protected-shell-release-review-v0";
const LIVE_RUN_TYPE = "live_governed_evaluation_v0";
const LIVE_FUNCTION_NAME = "live-governed-evaluation-v0";
const INTELLIGENCE_LABELS = Object.freeze({
  communicator: "Communicator · independently invokable intent normalization",
  mediator: "Mediator · independently invokable constraint generation",
  drafter: "Drafter · independently invokable bounded artifact creation",
  refiner: "Refiner · independently invokable verification and patchlist",
  origin: "Origin · independently invokable pass-qualified lineage recording"
});

const persistenceStatusCopy = Object.freeze({
  unsaved: "unsaved",
  saving: "saving",
  saved: "saved",
  loading: "loading",
  load_failed: "load failed",
  session_required: "session required",
  backend_unavailable: "backend unavailable",
  persistence_unavailable: "persistence unavailable",
  no_saved_workspace_state: "no saved workspace state"
});

const localReleaseCandidate = Object.freeze({
  id: "local-release-candidate-0-1",
  label: "Deterministic fixture",
  scope: "Browser-side review fixture — no model or NEXUS execution",
  evidencePacket: {
    status: "Fixture evidence only",
    present: [
      "Static candidate summary",
      "Browser-side review state",
      "Bounded authenticated workspace save/load state"
    ],
    missing: [
      "Live model execution evidence",
      "Pinned NEXUS execution evidence",
      "Production audit ledger"
    ]
  },
  releaseReview: {
    result: "Fixture review blocked",
    state: "Deterministic fixture staged",
    decision: "Release authority unavailable",
    reason: "Fixture path has no live execution evidence"
  }
});

const reviewState = {
  mode: "none",
  candidateStaged: false,
  reviewRun: false,
  running: false,
  inputText: "",
  intelligenceId: "mediator",
  liveRunId: "",
  liveResult: null,
  liveFailure: null,
  activity: [],
  persistenceStatus: "unsaved",
  persistenceDetail: "no saved workspace state has been loaded in this browser session.",
  savedAt: "",
  loadedAt: ""
};

const nodes = {
  liveForm: document.querySelector("[data-live-evaluation-form]"),
  liveInput: document.querySelector("[data-live-evaluation-input]"),
  liveIntelligence: document.querySelector("[data-live-evaluation-intelligence]"),
  liveIntelligenceBoundary: document.querySelector("[data-live-intelligence-boundary]"),
  liveConsent: document.querySelector("[data-live-evaluation-consent]"),
  liveInputStatus: document.querySelector("[data-live-input-status]"),
  stageLiveButton: document.querySelector('[data-action="stage-live-evaluation"]'),
  stageFixtureButton: document.querySelector('[data-action="stage-local-candidate"]'),
  liveReviewButton: document.querySelector('[data-action="run-live-evaluation"]'),
  fixtureReviewButton: document.querySelector('[data-action="run-local-review"]'),
  saveButton: document.querySelector('[data-action="save-workspace-state"]'),
  loadButton: document.querySelector('[data-action="load-saved-workspace-state"]'),
  workspaceState: document.querySelector("[data-review-workspace-state]"),
  objectEvidenceState: document.querySelector("[data-object-evidence-state]"),
  candidateSummary: document.querySelector("[data-review-candidate-summary]"),
  evidenceStatus: document.querySelector("[data-evidence-status]"),
  evidenceCandidate: document.querySelector("[data-evidence-candidate]"),
  evidenceCompleteness: document.querySelector("[data-evidence-completeness]"),
  evidenceMissing: document.querySelector("[data-evidence-missing]"),
  decisionHeading: document.querySelector("[data-decision-heading]"),
  reviewResult: document.querySelector("[data-review-result]"),
  reviewState: document.querySelector("[data-review-state]"),
  reviewDecision: document.querySelector("[data-review-decision]"),
  reviewReason: document.querySelector("[data-review-reason]"),
  activityStatus: document.querySelector("[data-activity-status]"),
  activityList: document.querySelector("[data-activity-list]"),
  persistenceStatus: document.querySelector("[data-persistence-status]"),
  persistenceDetail: document.querySelector("[data-persistence-detail]"),
  protectedBoundary: document.querySelector("[data-protected-shell-boundary]")
};

let supabaseClientResultPromise;

function appendActivity(message) {
  reviewState.activity = [...reviewState.activity, message].slice(-40);
}

function normalizedLiveResult() {
  return reviewState.liveResult && typeof reviewState.liveResult === "object"
    ? reviewState.liveResult
    : null;
}

function evidenceRequirementLabels(result) {
  if (!Array.isArray(result?.EvidenceRequirement)) return [];
  return result.EvidenceRequirement
    .filter((requirement) => requirement?.evidence_present !== true && typeof requirement?.label === "string")
    .map((requirement) => requirement.label);
}

function renderActivity() {
  if (!nodes.activityList) return;
  nodes.activityList.replaceChildren();
  const items = reviewState.activity.length
    ? reviewState.activity
    : ["Run activity will appear here after an input is staged."];
  for (const item of items) {
    const node = document.createElement("li");
    node.textContent = item;
    nodes.activityList.append(node);
  }
}

function inputIsStageable() {
  const length = nodes.liveInput?.value.trim().length || 0;
  return length >= 20 && length <= 4000 && nodes.liveConsent?.checked === true;
}

function syncInputControl() {
  const locked = reviewState.mode === "live" && reviewState.candidateStaged;
  if (nodes.liveInput) nodes.liveInput.disabled = locked || reviewState.running;
  if (nodes.liveIntelligence) {
    if (nodes.liveIntelligence.value !== reviewState.intelligenceId) nodes.liveIntelligence.value = reviewState.intelligenceId;
    nodes.liveIntelligence.disabled = locked || reviewState.running;
  }
  if (nodes.liveIntelligenceBoundary) {
    nodes.liveIntelligenceBoundary.textContent = INTELLIGENCE_LABELS[reviewState.intelligenceId] || INTELLIGENCE_LABELS.mediator;
  }
  if (nodes.liveConsent) nodes.liveConsent.disabled = locked || reviewState.running;
  if (nodes.stageLiveButton) {
    nodes.stageLiveButton.disabled = !inputIsStageable() || reviewState.running;
    nodes.stageLiveButton.hidden = locked;
  }
  if (!nodes.liveInputStatus) return;
  const length = nodes.liveInput?.value.trim().length || 0;
  if (locked) {
    nodes.liveInputStatus.textContent = "Input staged. Open Evidence to execute the governed run.";
  } else if (!length) {
    nodes.liveInputStatus.textContent = "No input staged.";
  } else if (length < 20) {
    nodes.liveInputStatus.textContent = `${20 - length} more characters required.`;
  } else if (nodes.liveConsent?.checked !== true) {
    nodes.liveInputStatus.textContent = "Confirm non-sensitive OpenAI processing before staging.";
  } else {
    nodes.liveInputStatus.textContent = "Ready to stage. The input is not sent until Run governed evaluation is activated.";
  }
}

function setPersistenceStatus(status, detail, options = {}) {
  reviewState.persistenceStatus = status;
  reviewState.persistenceDetail = detail;
  if (options.trace) appendActivity(options.trace);
  renderReviewState();
}

function renderLiveState() {
  const result = normalizedLiveResult();
  const verdict = result?.Verdict?.status;
  const requirements = evidenceRequirementLabels(result);
  if (nodes.workspaceState) {
    nodes.workspaceState.textContent = reviewState.running
      ? "Live run executing through the governed server boundary."
      : reviewState.reviewRun
        ? `Live run ${reviewState.liveRunId || "record"} completed and persisted.`
        : "Bounded live input staged for execution.";
  }
  if (nodes.objectEvidenceState) {
    nodes.objectEvidenceState.textContent = reviewState.liveFailure
      ? "Execution stopped and failure recorded"
      : result
        ? "Model, NEXUS and governance evidence persisted"
        : "Execution evidence pending";
  }
  if (nodes.candidateSummary) {
    nodes.candidateSummary.textContent = reviewState.running
      ? "Executing one model call and pinned NEXUS evaluation."
      : result
        ? `Persisted run · ${String(verdict || "completed").toUpperCase()}`
        : "Non-sensitive input staged · live run pending";
  }
  if (nodes.evidenceStatus) {
    nodes.evidenceStatus.textContent = reviewState.liveFailure
      ? `Run failed closed at ${reviewState.liveFailure.stage || "runtime"}.`
      : result
        ? "Execution evidence is bound to the persisted run identity."
        : "Input identity is staged; model and NEXUS evidence are pending.";
  }
  if (nodes.evidenceCandidate) {
    nodes.evidenceCandidate.textContent = reviewState.liveRunId || "Run identity will be created at execution.";
  }
  if (nodes.evidenceCompleteness) {
    nodes.evidenceCompleteness.textContent = reviewState.liveFailure
      ? "Failure evidence persisted; no governed result issued."
      : result
        ? "OpenAI response, pinned NEXUS output and governance decision recorded."
        : "Awaiting server-side execution.";
  }
  if (nodes.evidenceMissing) {
    nodes.evidenceMissing.textContent = requirements.length
      ? requirements.join("; ")
      : result
        ? "No additional model-identified evidence requirements."
        : "Complete model, NEXUS and governance execution evidence required.";
  }
  if (nodes.decisionHeading) nodes.decisionHeading.textContent = reviewState.liveFailure ? "Evaluation stopped" : result ? "Governed result" : "Evaluation pending";
  if (nodes.reviewResult) {
    nodes.reviewResult.textContent = reviewState.liveFailure
      ? "Fail closed"
      : result
        ? result.result?.summary || "Governed evaluation completed."
        : reviewState.running
          ? "Execution in progress."
          : "Live evaluation has not run.";
  }
  if (nodes.reviewState) {
    nodes.reviewState.textContent = reviewState.liveFailure
      ? `Failed at ${reviewState.liveFailure.stage || "runtime"}`
      : reviewState.running
        ? "Executing"
        : result
          ? "Completed and persisted"
          : "Ready to execute";
  }
  if (nodes.reviewDecision) {
    nodes.reviewDecision.textContent = reviewState.liveFailure
      ? "No verdict issued"
      : verdict
        ? verdict.charAt(0).toUpperCase() + verdict.slice(1)
        : "Not evaluated";
  }
  if (nodes.reviewReason) {
    nodes.reviewReason.textContent = reviewState.liveFailure
      ? `${reviewState.liveFailure.error || "Runtime boundary unavailable"}; no result or external action was issued.`
      : result
        ? result.Verdict?.rationale || "Governance evidence recorded."
        : "One model response and pinned NEXUS execution are required.";
  }
}

function renderFixtureState() {
  if (nodes.workspaceState) nodes.workspaceState.textContent = "Deterministic fixture staged in browser workspace state.";
  if (nodes.objectEvidenceState) nodes.objectEvidenceState.textContent = "Fixture evidence only · no live execution";
  if (nodes.candidateSummary) nodes.candidateSummary.textContent = `${localReleaseCandidate.label}: ${localReleaseCandidate.scope}.`;
  if (nodes.evidenceStatus) nodes.evidenceStatus.textContent = "Evidence Packet populated from local candidate state.";
  if (nodes.evidenceCandidate) nodes.evidenceCandidate.textContent = localReleaseCandidate.id;
  if (nodes.evidenceCompleteness) nodes.evidenceCompleteness.textContent = localReleaseCandidate.evidencePacket.status;
  if (nodes.evidenceMissing) nodes.evidenceMissing.textContent = localReleaseCandidate.evidencePacket.missing.join("; ");
  if (nodes.decisionHeading) nodes.decisionHeading.textContent = "Fixture review blocked";
  if (nodes.reviewResult) nodes.reviewResult.textContent = reviewState.reviewRun ? localReleaseCandidate.releaseReview.result : "Fixture staged.";
  if (nodes.reviewState) nodes.reviewState.textContent = localReleaseCandidate.releaseReview.state;
  if (nodes.reviewDecision) nodes.reviewDecision.textContent = localReleaseCandidate.releaseReview.decision;
  if (nodes.reviewReason) {
    nodes.reviewReason.textContent = reviewState.reviewRun
      ? `${localReleaseCandidate.releaseReview.reason}; no external release action performed.`
      : localReleaseCandidate.releaseReview.reason;
  }
}

function renderEmptyState() {
  if (nodes.workspaceState) nodes.workspaceState.textContent = "No live evaluation is queued.";
  if (nodes.objectEvidenceState) nodes.objectEvidenceState.textContent = "Execution evidence pending";
  if (nodes.candidateSummary) nodes.candidateSummary.textContent = "Waiting for a bounded input.";
  if (nodes.evidenceStatus) nodes.evidenceStatus.textContent = "No execution evidence is loaded.";
  if (nodes.evidenceCandidate) nodes.evidenceCandidate.textContent = "None staged.";
  if (nodes.evidenceCompleteness) nodes.evidenceCompleteness.textContent = "Model and NEXUS execution pending.";
  if (nodes.evidenceMissing) nodes.evidenceMissing.textContent = "Complete execution evidence is required.";
  if (nodes.decisionHeading) nodes.decisionHeading.textContent = "Evaluation pending";
  if (nodes.reviewResult) nodes.reviewResult.textContent = "No evaluation is queued.";
  if (nodes.reviewState) nodes.reviewState.textContent = "Waiting for bounded input.";
  if (nodes.reviewDecision) nodes.reviewDecision.textContent = "Not evaluated.";
  if (nodes.reviewReason) nodes.reviewReason.textContent = "No governed result is available.";
}

function renderReviewState() {
  if (reviewState.mode === "live" && reviewState.candidateStaged) renderLiveState();
  else if (reviewState.mode === "fixture" && reviewState.candidateStaged) renderFixtureState();
  else renderEmptyState();

  if (nodes.activityStatus) {
    nodes.activityStatus.textContent = reviewState.activity.length
      ? "Trace / Activity reflects the current workspace session."
      : "No run activity has been recorded.";
  }
  if (nodes.persistenceStatus) nodes.persistenceStatus.textContent = persistenceStatusCopy[reviewState.persistenceStatus] || "unsaved";
  if (nodes.persistenceDetail) nodes.persistenceDetail.textContent = reviewState.persistenceDetail;
  if (nodes.liveReviewButton) {
    nodes.liveReviewButton.hidden = reviewState.mode !== "live";
    nodes.liveReviewButton.disabled = reviewState.mode !== "live" || !reviewState.candidateStaged || reviewState.running || reviewState.reviewRun;
    nodes.liveReviewButton.textContent = reviewState.running ? "Evaluation running…" : "Run governed evaluation";
  }
  if (nodes.fixtureReviewButton) {
    nodes.fixtureReviewButton.hidden = reviewState.mode !== "fixture";
    nodes.fixtureReviewButton.disabled = reviewState.mode !== "fixture" || !reviewState.candidateStaged || reviewState.reviewRun;
  }
  if (nodes.saveButton) nodes.saveButton.disabled = !reviewState.candidateStaged || reviewState.persistenceStatus === "saving" || reviewState.running;
  if (nodes.loadButton) nodes.loadButton.disabled = reviewState.persistenceStatus === "loading" || reviewState.running;
  if (nodes.stageFixtureButton) nodes.stageFixtureButton.disabled = reviewState.running;

  syncInputControl();
  if (nodes.protectedBoundary) {
    nodes.protectedBoundary.dataset.candidateStaged = String(reviewState.candidateStaged);
    nodes.protectedBoundary.dataset.reviewRun = String(reviewState.reviewRun);
    nodes.protectedBoundary.dataset.persistenceStatus = reviewState.persistenceStatus;
    nodes.protectedBoundary.dataset.runMode = reviewState.mode;
    nodes.protectedBoundary.dispatchEvent(new CustomEvent("aetherus:review-state", {
      bubbles: true,
      detail: {
        candidateStaged: reviewState.candidateStaged,
        reviewRun: reviewState.reviewRun,
        persistenceStatus: reviewState.persistenceStatus,
        runMode: reviewState.mode
      }
    }));
  }
  renderActivity();
}

function stageLiveEvaluation() {
  const inputText = nodes.liveInput?.value.trim() || "";
  if (!inputIsStageable()) {
    syncInputControl();
    return;
  }
  reviewState.mode = "live";
  reviewState.candidateStaged = true;
  reviewState.reviewRun = false;
  reviewState.running = false;
  reviewState.inputText = inputText;
  reviewState.intelligenceId = INTELLIGENCE_LABELS[nodes.liveIntelligence?.value] ? nodes.liveIntelligence.value : "mediator";
  reviewState.liveRunId = "";
  reviewState.liveResult = null;
  reviewState.liveFailure = null;
  reviewState.persistenceStatus = "unsaved";
  reviewState.persistenceDetail = "input staged locally; the live run will persist its own identity and evidence.";
  reviewState.activity = [
    "Non-sensitive input staged.",
    "Per-run OpenAI processing authorization recorded locally.",
    `${INTELLIGENCE_LABELS[reviewState.intelligenceId]} selected.`,
    "Live execution has not started."
  ];
  renderReviewState();
}

function stageLocalCandidate() {
  reviewState.mode = "fixture";
  reviewState.candidateStaged = true;
  reviewState.reviewRun = false;
  reviewState.running = false;
  reviewState.inputText = "";
  reviewState.liveRunId = "";
  reviewState.liveResult = null;
  reviewState.liveFailure = null;
  reviewState.persistenceStatus = "unsaved";
  reviewState.persistenceDetail = "deterministic fixture state is unsaved; this path does not invoke a model or NEXUS.";
  reviewState.activity = [
    "Deterministic fixture staged.",
    "Evidence Packet populated from local candidate state.",
    "No model or NEXUS execution occurred."
  ];
  renderReviewState();
}

function runLocalReview() {
  if (reviewState.mode !== "fixture" || !reviewState.candidateStaged) return;
  reviewState.reviewRun = true;
  reviewState.persistenceStatus = "unsaved";
  reviewState.persistenceDetail = "fixture review state is unsaved; no live execution evidence exists.";
  appendActivity("Run local review triggered.");
  appendActivity("Review blocked: incomplete operational evidence.");
  appendActivity("Release authority unavailable; no external release action performed.");
  renderReviewState();
  nodes.protectedBoundary?.dispatchEvent(new CustomEvent("aetherus:review-complete", {
    bubbles: true,
    detail: { result: localReleaseCandidate.releaseReview.result, mode: "fixture" }
  }));
}

async function getSupabaseClientResult() {
  if (!supabaseClientResultPromise) supabaseClientResultPromise = initializeSupabaseBrowserClient();
  return supabaseClientResultPromise;
}

async function getAuthenticatedClient() {
  const clientResult = await getSupabaseClientResult();
  if (!clientResult?.client_initialized || !clientResult.client) {
    return { ok: false, status: "backend_unavailable", detail: "backend unavailable: Supabase public runtime config or browser client is unavailable." };
  }
  const sessionResult = await clientResult.client.auth.getSession();
  if (sessionResult.error || !sessionResult.data?.session?.user?.id) {
    return { ok: false, status: "session_required", detail: "session required: sign in before using the live workspace." };
  }
  return { ok: true, client: clientResult.client, session: sessionResult.data.session };
}

function workspaceSlugForSession(session) {
  return `aetherus-review-workspace-${session.user.id}`;
}

async function ensureWorkspace(client, session) {
  const now = new Date().toISOString();
  const workspaceResult = await client.from("workspaces").upsert({
    slug: workspaceSlugForSession(session),
    name: "AETHERUS Review Workspace",
    owner_user_id: session.user.id,
    updated_at: now
  }, { onConflict: "slug" }).select("id, slug, name, owner_user_id").single();
  if (workspaceResult.error) throw workspaceResult.error;

  const membershipResult = await client.from("workspace_memberships").upsert({
    workspace_id: workspaceResult.data.id,
    user_id: session.user.id,
    role: "owner",
    status: "active",
    invited_by_user_id: session.user.id,
    updated_at: now
  }, { onConflict: "workspace_id,user_id" }).select("workspace_id, user_id, role, status").single();
  if (membershipResult.error) throw membershipResult.error;
  return workspaceResult.data;
}

async function findWorkspace(client, session) {
  const result = await client.from("workspaces").select("id, slug, name, owner_user_id")
    .eq("slug", workspaceSlugForSession(session)).maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

async function edgeFunctionError(error) {
  let detail = error?.message || "live evaluation endpoint unavailable";
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      if (typeof payload?.error === "string") detail = payload.error;
      return { error: detail, stage: payload?.stage || "endpoint", run_id: payload?.run_id || "" };
    } catch {
      return { error: detail, stage: "endpoint", run_id: "" };
    }
  }
  return { error: detail, stage: "endpoint", run_id: "" };
}

async function runLiveEvaluation() {
  if (reviewState.mode !== "live" || !reviewState.candidateStaged || reviewState.running || reviewState.reviewRun) return;
  reviewState.running = true;
  reviewState.liveFailure = null;
  appendActivity("Authenticated live evaluation requested.");
  renderReviewState();

  try {
    const auth = await getAuthenticatedClient();
    if (!auth.ok) throw Object.assign(new Error(auth.detail), { aetherusStage: "authentication" });
    const workspace = await ensureWorkspace(auth.client, auth.session);
    appendActivity("Run identity binding requested for authenticated workspace.");
    renderReviewState();

    const invocation = await auth.client.functions.invoke(LIVE_FUNCTION_NAME, {
      body: {
        client_request_id: crypto.randomUUID(),
        workspace_id: workspace.id,
        intelligence_id: reviewState.intelligenceId,
        input_text: reviewState.inputText,
        data_classification: "non_sensitive",
        external_processing_consent: true
      }
    });

    if (invocation.error) {
      reviewState.liveFailure = await edgeFunctionError(invocation.error);
      reviewState.liveRunId = reviewState.liveFailure.run_id;
      reviewState.reviewRun = true;
      reviewState.persistenceStatus = reviewState.liveRunId ? "saved" : "backend_unavailable";
      reviewState.persistenceDetail = reviewState.liveRunId
        ? `failed run evidence persisted as ${reviewState.liveRunId}.`
        : "live endpoint did not establish a persisted run identity.";
      appendActivity(`Evaluation failed closed at ${reviewState.liveFailure.stage}: ${reviewState.liveFailure.error}.`);
    } else if (
      invocation.data?.status === "completed" &&
      invocation.data?.run_id &&
      invocation.data?.normalized_result?.HandoffReceipt?.persisted === true
    ) {
      reviewState.liveRunId = invocation.data.run_id;
      reviewState.liveResult = invocation.data.normalized_result;
      reviewState.reviewRun = true;
      reviewState.persistenceStatus = "saved";
      reviewState.persistenceDetail = `run, evidence and result persisted automatically as ${reviewState.liveRunId}.`;
      appendActivity("OpenAI model response received and identified.");
      appendActivity("Pinned NEXUS Alpha / Delta / Omega execution completed.");
      appendActivity("Governance result and execution evidence persisted.");
    } else {
      reviewState.liveFailure = { error: "indeterminate_runtime_response", stage: "response_validation", run_id: invocation.data?.run_id || "" };
      reviewState.liveRunId = reviewState.liveFailure.run_id;
      reviewState.reviewRun = true;
      reviewState.persistenceStatus = reviewState.liveRunId ? "saved" : "backend_unavailable";
      reviewState.persistenceDetail = "the endpoint response did not establish a valid completed result.";
      appendActivity("Evaluation failed closed: completed result contract was not established.");
    }
  } catch (error) {
    reviewState.liveFailure = {
      error: error?.message || "live evaluation unavailable",
      stage: error?.aetherusStage || "browser_boundary",
      run_id: ""
    };
    reviewState.reviewRun = true;
    reviewState.persistenceStatus = "backend_unavailable";
    reviewState.persistenceDetail = "the live endpoint could not be reached with an authenticated workspace binding.";
    appendActivity(`Evaluation failed closed: ${reviewState.liveFailure.error}.`);
  } finally {
    reviewState.running = false;
    renderReviewState();
    nodes.protectedBoundary?.dispatchEvent(new CustomEvent("aetherus:review-complete", {
      bubbles: true,
      detail: {
        result: reviewState.liveFailure ? "fail_closed" : reviewState.liveResult?.Verdict?.status,
        mode: "live",
        runId: reviewState.liveRunId
      }
    }));
  }
}

function createPersistencePayload() {
  return {
    schema_version: "2.0",
    record_type: WORKSPACE_RECORD_TYPE,
    record_key: WORKSPACE_RECORD_KEY,
    saved_at: new Date().toISOString(),
    release_candidate: reviewState.mode === "fixture" && reviewState.candidateStaged ? localReleaseCandidate : null,
    release_review_state: {
      mode: reviewState.mode,
      candidate_staged: reviewState.candidateStaged,
      review_run: reviewState.reviewRun,
      result: reviewState.mode === "live"
        ? reviewState.liveFailure ? "fail_closed" : reviewState.liveResult?.Verdict?.status || "not_run"
        : reviewState.reviewRun ? localReleaseCandidate.releaseReview.result : "not_run",
      decision: reviewState.mode === "live"
        ? reviewState.liveResult?.Verdict?.status || "no_verdict"
        : localReleaseCandidate.releaseReview.decision,
      reason: reviewState.mode === "live"
        ? reviewState.liveFailure?.error || reviewState.liveResult?.Verdict?.rationale || "live evaluation pending"
        : localReleaseCandidate.releaseReview.reason,
      external_release_action_performed: false
    },
    live_evaluation_reference: reviewState.mode === "live" ? {
      run_type: LIVE_RUN_TYPE,
      run_id: reviewState.liveRunId || null,
      intelligence_id: reviewState.intelligenceId,
      result_persisted: Boolean(reviewState.liveRunId),
      input_not_duplicated_in_workspace_snapshot: true
    } : null,
    evidence_packet_state: reviewState.mode === "fixture"
      ? localReleaseCandidate.evidencePacket
      : {
          status: reviewState.liveResult ? "Persisted live execution evidence" : "Live execution evidence pending",
          present: reviewState.liveResult ? ["OpenAI response identity", "Pinned NEXUS execution identity", "Governance decision identity"] : [],
          missing: evidenceRequirementLabels(reviewState.liveResult)
        },
    trace_activity_state: reviewState.activity.slice(-40),
    boundaries: {
      external_release_action_performed: false,
      production_audit_ledger: false,
      compliance_certification: false,
      generalized_orchestration: false
    }
  };
}

function restorePersistencePayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  const state = payload.release_review_state || {};
  reviewState.mode = state.mode === "live" ? "live" : state.mode === "fixture" || payload.release_candidate ? "fixture" : "none";
  reviewState.candidateStaged = state.candidate_staged === true;
  reviewState.reviewRun = state.review_run === true;
  reviewState.liveRunId = payload.live_evaluation_reference?.run_id || "";
  reviewState.intelligenceId = INTELLIGENCE_LABELS[payload.live_evaluation_reference?.intelligence_id]
    ? payload.live_evaluation_reference.intelligence_id
    : "mediator";
  reviewState.liveResult = null;
  reviewState.liveFailure = null;
  reviewState.activity = Array.isArray(payload.trace_activity_state)
    ? payload.trace_activity_state.filter((item) => typeof item === "string").slice(-40)
    : [];
  return true;
}

async function loadPersistedLiveRun(client, workspaceId) {
  if (!reviewState.liveRunId) return;
  const result = await client.from("live_governed_evaluation_runs")
    .select("id, status, normalized_result, failure_stage, failure_code, completed_at")
    .eq("id", reviewState.liveRunId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return;
  if (result.data.status === "completed" && result.data.normalized_result) {
    reviewState.liveResult = result.data.normalized_result;
    reviewState.reviewRun = true;
  } else if (result.data.status === "failed") {
    reviewState.liveFailure = {
      error: result.data.failure_code || "persisted_run_failed",
      stage: result.data.failure_stage || "runtime",
      run_id: result.data.id
    };
    reviewState.reviewRun = true;
  }
}

async function saveWorkspaceState() {
  if (!reviewState.candidateStaged) {
    setPersistenceStatus("unsaved", "unsaved: stage an input or fixture before saving workspace state.", { trace: "Save workspace state blocked: no staged object." });
    return;
  }
  setPersistenceStatus("saving", "saving interface state through the authenticated Supabase session.", { trace: "Save workspace state attempt started." });
  try {
    const auth = await getAuthenticatedClient();
    if (!auth.ok) {
      setPersistenceStatus(auth.status, auth.detail, { trace: `Save workspace state blocked: ${persistenceStatusCopy[auth.status]}.` });
      return;
    }
    const workspace = await ensureWorkspace(auth.client, auth.session);
    const now = new Date().toISOString();
    const result = await auth.client.from("workspace_state_records").upsert({
      workspace_id: workspace.id,
      record_type: WORKSPACE_RECORD_TYPE,
      record_key: WORKSPACE_RECORD_KEY,
      state_payload: createPersistencePayload(),
      created_by_user_id: auth.session.user.id,
      updated_by_user_id: auth.session.user.id,
      updated_at: now
    }, { onConflict: "workspace_id,record_type,record_key" }).select("id, updated_at").single();
    if (result.error) throw result.error;
    reviewState.savedAt = result.data.updated_at || now;
    setPersistenceStatus("saved", `workspace view state saved at ${reviewState.savedAt}; live run evidence remains in its dedicated record.`, { trace: "Save workspace state succeeded." });
  } catch (error) {
    setPersistenceStatus("backend_unavailable", "backend unavailable: workspace state could not be saved.", { trace: `Save workspace state failed: ${error?.message || "unknown error"}.` });
  }
}

async function loadSavedWorkspaceState(options = {}) {
  if (!options.silent) {
    setPersistenceStatus("loading", "loading saved workspace state from Supabase.", { trace: "Load saved workspace state attempt started." });
  } else {
    reviewState.persistenceStatus = "loading";
    reviewState.persistenceDetail = "loading saved workspace state from Supabase.";
    renderReviewState();
  }
  try {
    const auth = await getAuthenticatedClient();
    if (!auth.ok) {
      setPersistenceStatus(auth.status, auth.detail, { trace: `Load saved workspace state blocked: ${persistenceStatusCopy[auth.status]}.` });
      return;
    }
    const workspace = await findWorkspace(auth.client, auth.session);
    if (!workspace) {
      setPersistenceStatus("no_saved_workspace_state", "no saved workspace state exists for this authenticated workspace.", { trace: "Load saved workspace state returned no workspace record." });
      return;
    }
    const result = await auth.client.from("workspace_state_records").select("state_payload, updated_at")
      .eq("workspace_id", workspace.id).eq("record_type", WORKSPACE_RECORD_TYPE).eq("record_key", WORKSPACE_RECORD_KEY).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) {
      setPersistenceStatus("no_saved_workspace_state", "no saved workspace state exists for this authenticated workspace.", { trace: "Load saved workspace state returned no saved record." });
      return;
    }
    if (!restorePersistencePayload(result.data.state_payload)) {
      setPersistenceStatus("load_failed", "load failed: saved workspace payload was not recognized.", { trace: "Load saved workspace state failed: unrecognized payload." });
      return;
    }
    await loadPersistedLiveRun(auth.client, workspace.id);
    reviewState.loadedAt = result.data.updated_at || "";
    setPersistenceStatus("saved", `saved workspace state loaded from ${reviewState.loadedAt || "Supabase"}.`, { trace: "Load saved workspace state succeeded." });
  } catch (error) {
    setPersistenceStatus("load_failed", "load failed: saved workspace state could not be loaded.", { trace: `Load saved workspace state failed: ${error?.message || "unknown error"}.` });
  }
}

nodes.liveInput?.addEventListener("input", syncInputControl);
nodes.liveConsent?.addEventListener("change", syncInputControl);
nodes.liveForm?.addEventListener("submit", (event) => event.preventDefault());
nodes.stageLiveButton?.addEventListener("click", stageLiveEvaluation);
nodes.liveIntelligence?.addEventListener("change", () => {
  reviewState.intelligenceId = INTELLIGENCE_LABELS[nodes.liveIntelligence.value] ? nodes.liveIntelligence.value : "mediator";
  syncInputControl();
});
nodes.stageFixtureButton?.addEventListener("click", stageLocalCandidate);
nodes.liveReviewButton?.addEventListener("click", runLiveEvaluation);
nodes.fixtureReviewButton?.addEventListener("click", runLocalReview);
nodes.saveButton?.addEventListener("click", saveWorkspaceState);
nodes.loadButton?.addEventListener("click", () => loadSavedWorkspaceState());

renderReviewState();
loadSavedWorkspaceState({ silent: true }).catch(() => {
  setPersistenceStatus("persistence_unavailable", "persistence unavailable: auto-load could not complete.", { trace: "Load saved workspace state failed during automatic restore." });
});
