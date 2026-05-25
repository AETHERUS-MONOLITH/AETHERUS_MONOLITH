(function() {
  const surfaces = [
    {
      id: "access-boundary",
      index: "01",
      title: "Access Boundary Membrane",
      controlLabel: "Preview Access Boundary",
      status: "selected in preview",
      purpose: "Defines where human intent enters the future Direct UI Membrane.",
      reviewer:
        "Shows the intended boundary between public entry, authenticated access, and controlled workspace entry.",
      state: "Access Boundary Membrane is selected in preview; boundary context is visible.",
      boundary: "No account, session, credential, or tenant access exists."
    },
    {
      id: "workspace-control",
      index: "02",
      title: "Workspace Control Surface",
      controlLabel: "Preview Workspace Control",
      status: "selected in preview",
      purpose: "Frames the future workspace as a controlled review environment rather than a live dashboard.",
      reviewer:
        "Shows how work areas could be separated by review task, evidence state, and governance context.",
      state: "Workspace Control Surface is selected in preview; no workspace record is stored.",
      boundary: "No customer workspace, persistence, RBAC, tenant state, or operational dashboard exists."
    },
    {
      id: "evidence-review",
      index: "03",
      title: "Evidence / Artifact Review Surface",
      controlLabel: "Preview Evidence Review",
      status: "boundary visible",
      purpose: "Represents how evidence, artifacts, and claim boundaries may be inspected before release judgment.",
      reviewer: "Makes support, missing proof, and boundary status visible as review objects.",
      state: "Evidence / Artifact Review Surface is selected in preview; proof context is illustrative only.",
      boundary: "No live evidence database, immutable ledger, customer data, or runtime audit trail exists."
    },
    {
      id: "release-review",
      index: "04",
      title: "Release Review Chamber",
      controlLabel: "Preview Release Review",
      status: "boundary visible",
      purpose: "Represents the conceptual area where freeze, repair, or escalation state would be reviewed.",
      reviewer:
        "Shows the reviewer-facing structure for evaluating release eligibility without granting release authority.",
      state: "Release Review Chamber is selected in preview; no release authority is granted.",
      boundary: "No approval power, deployment authority, production release, or compliance certification exists."
    },
    {
      id: "escalation-review",
      index: "05",
      title: "Escalation Review Surface",
      controlLabel: "Preview Escalation Review",
      status: "no runtime action",
      purpose: "Represents how unresolved boundary conflicts may be surfaced for human review.",
      reviewer: "Shows how escalation context, missing evidence, and review notes could be organized.",
      state: "Escalation Review Surface is selected in preview; review notes are not stored.",
      boundary: "No incident queue, enforcement action, runtime observation, or runtime escalation exists."
    }
  ];

  let selectedSurfaceId = surfaces[0].id;
  let lastPreviewAction = "Initial preview state";

  function getSelectedSurface() {
    return surfaces.find((surface) => surface.id === selectedSurfaceId) || surfaces[0];
  }

  function renderSelector() {
    const selector = document.querySelector("[data-workspace-selector]");
    if (!selector) return;

    selector.innerHTML = surfaces
      .map((surface) => {
        const selected = surface.id === selectedSurfaceId;
        return `
          <button
            class="workspace-surface-control"
            type="button"
            data-surface-id="${surface.id}"
            aria-pressed="${selected ? "true" : "false"}"
          >
            <span>${surface.index}</span>
            <span>
              <strong>${surface.controlLabel}</strong>
              <small>${surface.title}</small>
            </span>
          </button>
        `;
      })
      .join("");
  }

  function renderPreview() {
    const surface = getSelectedSurface();
    const title = document.querySelector("[data-preview-title]");
    const status = document.querySelector("[data-preview-status]");
    const purpose = document.querySelector("[data-preview-purpose]");
    const state = document.querySelector("[data-preview-state]");
    const reviewer = document.querySelector("[data-preview-reviewer]");
    const boundary = document.querySelector("[data-preview-boundary]");

    if (title) title.textContent = surface.title;
    if (status) status.textContent = surface.status;
    if (purpose) purpose.textContent = surface.purpose;
    if (state) state.textContent = `${surface.state} ${lastPreviewAction}.`;
    if (reviewer) reviewer.textContent = surface.reviewer;
    if (boundary) boundary.textContent = surface.boundary;
  }

  function selectSurface(surfaceId) {
    selectedSurfaceId = surfaceId;
    const surface = getSelectedSurface();
    lastPreviewAction = `Last preview action: ${surface.controlLabel}`;
    renderSelector();
    renderPreview();
  }

  function resetPreview() {
    selectedSurfaceId = surfaces[0].id;
    lastPreviewAction = "Preview state reset in memory only";
    renderSelector();
    renderPreview();
  }

  function init() {
    renderSelector();
    renderPreview();

    document.addEventListener("click", (event) => {
      const surfaceControl = event.target.closest("[data-surface-id]");
      if (surfaceControl) {
        selectSurface(surfaceControl.getAttribute("data-surface-id"));
        return;
      }

      if (event.target.closest("[data-preview-reset]")) {
        resetPreview();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
