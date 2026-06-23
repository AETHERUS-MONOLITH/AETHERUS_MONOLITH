import { initializeSupabaseBrowserClient } from "./supabase-client.js";

const WORKSPACE_RECORD_TYPE = "release_review_workspace_state";
const WORKSPACE_RECORD_KEY = "protected-shell-release-review-v0";

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
  label: "Local release candidate",
  scope: "Protected shell review fixture",
  evidencePacket: {
    status: "Incomplete operational evidence",
    present: [
      "Static candidate summary",
      "Browser-side review state",
      "Bounded authenticated workspace save/load state",
      "Boundary status"
    ],
    missing: [
      "Operational evidence packet missing",
      "No production audit ledger",
      "No tenant/customer context"
    ]
  },
  releaseReview: {
    result: "Review blocked",
    state: "Local candidate staged",
    decision: "Release authority unavailable",
    reason: "Incomplete operational evidence"
  }
});

const reviewState = {
  candidateStaged: false,
  reviewRun: false,
  activity: [],
  persistenceStatus: "unsaved",
  persistenceDetail: "no saved workspace state has been loaded in this browser session.",
  savedAt: "",
  loadedAt: ""
};

const nodes = {
  stageButton: document.querySelector('[data-action="stage-local-candidate"]'),
  reviewButton: document.querySelector('[data-action="run-local-review"]'),
  saveButton: document.querySelector('[data-action="save-workspace-state"]'),
  loadButton: document.querySelector('[data-action="load-saved-workspace-state"]'),
  workspaceState: document.querySelector("[data-review-workspace-state]"),
  candidateSummary: document.querySelector("[data-review-candidate-summary]"),
  evidenceStatus: document.querySelector("[data-evidence-status]"),
  evidenceCandidate: document.querySelector("[data-evidence-candidate]"),
  evidenceCompleteness: document.querySelector("[data-evidence-completeness]"),
  evidenceMissing: document.querySelector("[data-evidence-missing]"),
  reviewResult: document.querySelector("[data-review-result]"),
  reviewState: document.querySelector("[data-review-state]"),
  reviewDecision: document.querySelector("[data-review-decision]"),
  reviewReason: document.querySelector("[data-review-reason]"),
  activityStatus: document.querySelector("[data-activity-status]"),
  activityList: document.querySelector("[data-activity-list]"),
  persistenceStatus: document.querySelector("[data-persistence-status]"),
  persistenceDetail: document.querySelector("[data-persistence-detail]")
};

let supabaseClientResultPromise;

function appendActivity(message) {
  reviewState.activity = [...reviewState.activity, message];
}

function renderActivity() {
  if (!nodes.activityList) return;
  nodes.activityList.replaceChildren();
  const items = reviewState.activity.length
    ? reviewState.activity
    : ["Local in-memory activity will appear here after staging."];
  for (const item of items) {
    const node = document.createElement("li");
    node.textContent = item;
    nodes.activityList.append(node);
  }
}

function setPersistenceStatus(status, detail, options = {}) {
  reviewState.persistenceStatus = status;
  reviewState.persistenceDetail = detail;
  if (options.trace) appendActivity(options.trace);
  renderReviewState();
}

function renderReviewState() {
  if (nodes.workspaceState) {
    nodes.workspaceState.textContent = reviewState.candidateStaged
      ? "Local candidate staged in workspace state."
      : "No active release candidate is queued.";
  }
  if (nodes.candidateSummary) {
    nodes.candidateSummary.textContent = reviewState.candidateStaged
      ? `${localReleaseCandidate.label}: ${localReleaseCandidate.scope}.`
      : "Sample release candidate available for local review.";
  }
  if (nodes.evidenceStatus) {
    nodes.evidenceStatus.textContent = reviewState.candidateStaged
      ? "Evidence Packet populated from local candidate state."
      : "No evidence packet is loaded yet.";
  }
  if (nodes.evidenceCandidate) {
    nodes.evidenceCandidate.textContent = reviewState.candidateStaged
      ? localReleaseCandidate.id
      : "None staged.";
  }
  if (nodes.evidenceCompleteness) {
    nodes.evidenceCompleteness.textContent = reviewState.candidateStaged
      ? localReleaseCandidate.evidencePacket.status
      : "Operational evidence packet missing.";
  }
  if (nodes.evidenceMissing) {
    nodes.evidenceMissing.textContent = reviewState.candidateStaged
      ? localReleaseCandidate.evidencePacket.missing.join("; ")
      : "Operational evidence packet missing.";
  }
  if (nodes.reviewResult) {
    nodes.reviewResult.textContent = reviewState.reviewRun
      ? localReleaseCandidate.releaseReview.result
      : reviewState.candidateStaged
        ? "Local candidate staged."
        : "No release candidate is queued.";
  }
  if (nodes.reviewState) {
    nodes.reviewState.textContent = reviewState.candidateStaged
      ? localReleaseCandidate.releaseReview.state
      : "Waiting for local candidate.";
  }
  if (nodes.reviewDecision) {
    nodes.reviewDecision.textContent = localReleaseCandidate.releaseReview.decision;
  }
  if (nodes.reviewReason) {
    nodes.reviewReason.textContent = reviewState.reviewRun
      ? `${localReleaseCandidate.releaseReview.reason}; no external release action performed.`
      : localReleaseCandidate.releaseReview.reason;
  }
  if (nodes.activityStatus) {
    nodes.activityStatus.textContent = reviewState.activity.length
      ? "Trace / Activity populated from local workspace activity."
      : "No persistent activity has been recorded.";
  }
  if (nodes.persistenceStatus) {
    nodes.persistenceStatus.textContent = persistenceStatusCopy[reviewState.persistenceStatus] || "unsaved";
  }
  if (nodes.persistenceDetail) {
    nodes.persistenceDetail.textContent = reviewState.persistenceDetail;
  }
  if (nodes.reviewButton) {
    nodes.reviewButton.disabled = !reviewState.candidateStaged;
  }
  if (nodes.saveButton) {
    nodes.saveButton.disabled = !reviewState.candidateStaged || reviewState.persistenceStatus === "saving";
  }
  if (nodes.loadButton) {
    nodes.loadButton.disabled = reviewState.persistenceStatus === "loading";
  }
  renderActivity();
}

function stageLocalCandidate() {
  reviewState.candidateStaged = true;
  reviewState.reviewRun = false;
  reviewState.persistenceStatus = "unsaved";
  reviewState.persistenceDetail = "unsaved workspace state; use Save workspace state to persist this release-review loop.";
  reviewState.activity = [
    "Local candidate staged.",
    "Evidence Packet populated from local candidate state."
  ];
  renderReviewState();
}

function runLocalReview() {
  if (!reviewState.candidateStaged) return;
  reviewState.reviewRun = true;
  reviewState.persistenceStatus = "unsaved";
  reviewState.persistenceDetail = "unsaved review state; save again to persist the latest blocked review result.";
  reviewState.activity = [
    ...reviewState.activity,
    "Run local review triggered.",
    "Review blocked: incomplete operational evidence.",
    "Release authority unavailable; no external release action performed."
  ];
  renderReviewState();
}

function createPersistencePayload() {
  return {
    schema_version: "1.0",
    record_type: WORKSPACE_RECORD_TYPE,
    record_key: WORKSPACE_RECORD_KEY,
    saved_at: new Date().toISOString(),
    release_candidate: reviewState.candidateStaged ? localReleaseCandidate : null,
    release_review_state: {
      candidate_staged: reviewState.candidateStaged,
      review_run: reviewState.reviewRun,
      result: reviewState.reviewRun ? localReleaseCandidate.releaseReview.result : "not_run",
      decision: localReleaseCandidate.releaseReview.decision,
      reason: localReleaseCandidate.releaseReview.reason,
      external_release_action_performed: false
    },
    evidence_packet_state: reviewState.candidateStaged
      ? localReleaseCandidate.evidencePacket
      : {
          status: "Operational evidence packet missing",
          present: [],
          missing: ["Operational evidence packet missing"]
        },
    trace_activity_state: reviewState.activity.slice(-40),
    boundaries: {
      customer_data: false,
      tenant_data: false,
      operational_evidence_claim: false,
      production_audit_ledger: false,
      release_authority_available: false
    }
  };
}

function restorePersistencePayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  const state = payload.release_review_state || {};
  reviewState.candidateStaged = state.candidate_staged === true;
  reviewState.reviewRun = state.review_run === true;
  reviewState.activity = Array.isArray(payload.trace_activity_state)
    ? payload.trace_activity_state.filter((item) => typeof item === "string").slice(-40)
    : [];
  return true;
}

async function getSupabaseClientResult() {
  if (!supabaseClientResultPromise) {
    supabaseClientResultPromise = initializeSupabaseBrowserClient();
  }
  return supabaseClientResultPromise;
}

async function getAuthenticatedClient() {
  const clientResult = await getSupabaseClientResult();
  if (!clientResult?.client_initialized || !clientResult.client) {
    return {
      ok: false,
      status: "backend_unavailable",
      detail: "backend unavailable: Supabase public runtime config or browser client is unavailable."
    };
  }

  const sessionResult = await clientResult.client.auth.getSession();
  if (sessionResult.error || !sessionResult.data?.session?.user?.id) {
    return {
      ok: false,
      status: "session_required",
      detail: "session required: sign in before saving or loading workspace state."
    };
  }

  return {
    ok: true,
    client: clientResult.client,
    session: sessionResult.data.session
  };
}

function workspaceSlugForSession(session) {
  return `aetherus-review-workspace-${session.user.id}`;
}

async function ensureWorkspace(client, session) {
  const now = new Date().toISOString();
  const workspace = {
    slug: workspaceSlugForSession(session),
    name: "AETHERUS Review Workspace",
    owner_user_id: session.user.id,
    updated_at: now
  };

  const workspaceResult = await client
    .from("workspaces")
    .upsert(workspace, { onConflict: "slug" })
    .select("id, slug, name, owner_user_id")
    .single();

  if (workspaceResult.error) throw workspaceResult.error;

  const membershipResult = await client
    .from("workspace_memberships")
    .upsert(
      {
        workspace_id: workspaceResult.data.id,
        user_id: session.user.id,
        role: "owner",
        status: "active",
        invited_by_user_id: session.user.id,
        updated_at: now
      },
      { onConflict: "workspace_id,user_id" }
    )
    .select("workspace_id, user_id, role, status")
    .single();

  if (membershipResult.error) throw membershipResult.error;
  return workspaceResult.data;
}

async function findWorkspace(client, session) {
  const workspaceResult = await client
    .from("workspaces")
    .select("id, slug, name, owner_user_id")
    .eq("slug", workspaceSlugForSession(session))
    .maybeSingle();

  if (workspaceResult.error) throw workspaceResult.error;
  return workspaceResult.data || null;
}

async function saveWorkspaceState() {
  if (!reviewState.candidateStaged) {
    setPersistenceStatus("unsaved", "unsaved: stage candidate before saving workspace state.", {
      trace: "Save workspace state blocked: no staged candidate."
    });
    return;
  }

  setPersistenceStatus("saving", "saving to workspace through authenticated Supabase session.", {
    trace: "Save workspace state attempt started."
  });

  try {
    const auth = await getAuthenticatedClient();
    if (!auth.ok) {
      setPersistenceStatus(auth.status, auth.detail, {
        trace: `Save workspace state blocked: ${persistenceStatusCopy[auth.status]}.`
      });
      return;
    }

    const workspace = await ensureWorkspace(auth.client, auth.session);
    const payload = createPersistencePayload();
    const now = new Date().toISOString();

    const saveResult = await auth.client
      .from("workspace_state_records")
      .upsert(
        {
          workspace_id: workspace.id,
          record_type: WORKSPACE_RECORD_TYPE,
          record_key: WORKSPACE_RECORD_KEY,
          state_payload: payload,
          created_by_user_id: auth.session.user.id,
          updated_by_user_id: auth.session.user.id,
          updated_at: now
        },
        { onConflict: "workspace_id,record_type,record_key" }
      )
      .select("id, updated_at")
      .single();

    if (saveResult.error) throw saveResult.error;

    reviewState.savedAt = saveResult.data.updated_at || now;
    setPersistenceStatus("saved", `saved to workspace at ${reviewState.savedAt}.`, {
      trace: "Save workspace state succeeded."
    });
  } catch (error) {
    setPersistenceStatus("backend_unavailable", "backend unavailable: workspace state could not be saved.", {
      trace: `Save workspace state failed: ${error?.message || "unknown error"}.`
    });
  }
}

async function loadSavedWorkspaceState(options = {}) {
  if (!options.silent) {
    setPersistenceStatus("loading", "loading saved workspace state from Supabase.", {
      trace: "Load saved workspace state attempt started."
    });
  } else {
    reviewState.persistenceStatus = "loading";
    reviewState.persistenceDetail = "loading saved workspace state from Supabase.";
    renderReviewState();
  }

  try {
    const auth = await getAuthenticatedClient();
    if (!auth.ok) {
      setPersistenceStatus(auth.status, auth.detail, {
        trace: `Load saved workspace state blocked: ${persistenceStatusCopy[auth.status]}.`
      });
      return;
    }

    const workspace = await findWorkspace(auth.client, auth.session);
    if (!workspace) {
      setPersistenceStatus("no_saved_workspace_state", "no saved workspace state exists for this authenticated workspace.", {
        trace: "Load saved workspace state returned no workspace record."
      });
      return;
    }

    const loadResult = await auth.client
      .from("workspace_state_records")
      .select("state_payload, updated_at")
      .eq("workspace_id", workspace.id)
      .eq("record_type", WORKSPACE_RECORD_TYPE)
      .eq("record_key", WORKSPACE_RECORD_KEY)
      .maybeSingle();

    if (loadResult.error) throw loadResult.error;
    if (!loadResult.data) {
      setPersistenceStatus("no_saved_workspace_state", "no saved workspace state exists for this authenticated workspace.", {
        trace: "Load saved workspace state returned no saved record."
      });
      return;
    }

    if (!restorePersistencePayload(loadResult.data.state_payload)) {
      setPersistenceStatus("load_failed", "load failed: saved workspace payload was not recognized.", {
        trace: "Load saved workspace state failed: unrecognized payload."
      });
      return;
    }

    reviewState.loadedAt = loadResult.data.updated_at || "";
    setPersistenceStatus("saved", `saved workspace state loaded from ${reviewState.loadedAt || "Supabase"}.`, {
      trace: "Load saved workspace state succeeded."
    });
  } catch (error) {
    setPersistenceStatus("load_failed", "load failed: saved workspace state could not be loaded.", {
      trace: `Load saved workspace state failed: ${error?.message || "unknown error"}.`
    });
  }
}

nodes.stageButton?.addEventListener("click", stageLocalCandidate);
nodes.reviewButton?.addEventListener("click", runLocalReview);
nodes.saveButton?.addEventListener("click", saveWorkspaceState);
nodes.loadButton?.addEventListener("click", () => loadSavedWorkspaceState());
renderReviewState();
loadSavedWorkspaceState({ silent: true }).catch(() => {
  setPersistenceStatus("persistence_unavailable", "persistence unavailable: auto-load could not complete.", {
    trace: "Load saved workspace state failed during automatic restore."
  });
});
