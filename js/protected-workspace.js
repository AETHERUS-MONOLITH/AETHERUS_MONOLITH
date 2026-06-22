const localReleaseCandidate = Object.freeze({
  id: "local-release-candidate-0-1",
  label: "Local release candidate",
  scope: "Protected shell review fixture",
  evidencePacket: {
    status: "Incomplete operational evidence",
    present: [
      "Static candidate summary",
      "Browser-side review state",
      "Boundary status"
    ],
    missing: [
      "Operational evidence packet missing",
      "No backend persistence",
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
  activity: []
};

const nodes = {
  stageButton: document.querySelector('[data-action="stage-local-candidate"]'),
  reviewButton: document.querySelector('[data-action="run-local-review"]'),
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
  activityList: document.querySelector("[data-activity-list]")
};

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

function renderReviewState() {
  if (nodes.workspaceState) {
    nodes.workspaceState.textContent = reviewState.candidateStaged
      ? "Local candidate staged in browser memory."
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
      : "No backend persistence.";
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
      ? "Trace / Activity populated from local in-memory activity."
      : "No persistent activity has been recorded.";
  }
  if (nodes.reviewButton) {
    nodes.reviewButton.disabled = !reviewState.candidateStaged;
  }
  renderActivity();
}

function stageLocalCandidate() {
  reviewState.candidateStaged = true;
  reviewState.reviewRun = false;
  reviewState.activity = [
    "Local candidate staged.",
    "Evidence Packet populated from local candidate state."
  ];
  renderReviewState();
}

function runLocalReview() {
  if (!reviewState.candidateStaged) return;
  reviewState.reviewRun = true;
  reviewState.activity = [
    ...reviewState.activity,
    "Run local review triggered.",
    "Review blocked: incomplete operational evidence.",
    "Release authority unavailable; no external release action performed."
  ];
  renderReviewState();
}

nodes.stageButton?.addEventListener("click", stageLocalCandidate);
nodes.reviewButton?.addEventListener("click", runLocalReview);
renderReviewState();
