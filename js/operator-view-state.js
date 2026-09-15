const boundary = document.querySelector("[data-protected-shell-boundary]");

if (boundary) {
  const views = Array.from(boundary.querySelectorAll("[data-operator-view]"));
  const stageButton = boundary.querySelector('[data-action="stage-local-candidate"]');
  const inspectButton = boundary.querySelector('[data-operator-action="inspect-evidence"]');
  const reviewButton = boundary.querySelector('[data-action="run-local-review"]');
  const announcer = boundary.querySelector("[data-operator-announcer]");
  let currentView = "work";
  let returnScrollY = 0;

  function announce(message) {
    if (!announcer) return;
    announcer.textContent = "";
    requestAnimationFrame(() => { announcer.textContent = message; });
  }

  function syncWorkActions() {
    const staged = boundary.dataset.candidateStaged === "true";
    if (stageButton) stageButton.hidden = staged;
    if (inspectButton) inspectButton.hidden = !staged;
  }

  function showView(name, options = {}) {
    const nextView = views.find((view) => view.dataset.operatorView === name);
    if (!nextView) return;

    if (currentView === "work" && name !== "work") returnScrollY = window.scrollY;
    for (const view of views) view.hidden = view !== nextView;
    currentView = name;

    if (name === "work") {
      window.scrollTo({ top: returnScrollY, behavior: "auto" });
      if (options.restoreFocus !== false) inspectButton?.focus({ preventScroll: true });
      announce("Returned to Current Work.");
      return;
    }

    nextView.scrollIntoView({ block: "start", behavior: "auto" });
    nextView.querySelector("[data-operator-action='back-to-work']")?.focus({ preventScroll: true });
    announce(name === "evidence" ? "Evidence focus opened." : "Decision and result opened.");
  }

  inspectButton?.addEventListener("click", () => showView("evidence"));
  boundary.querySelectorAll('[data-operator-action="back-to-work"]').forEach((button) => {
    button.addEventListener("click", () => showView("work"));
  });
  reviewButton?.addEventListener("click", () => {
    if (!reviewButton.disabled) requestAnimationFrame(() => showView("decision"));
  });

  boundary.addEventListener("aetherus:review-state", syncWorkActions);
  boundary.addEventListener("aetherus:review-complete", () => showView("decision"));
  boundary.addEventListener("toggle", (event) => {
    const opened = event.target;
    if (!(opened instanceof HTMLDetailsElement) || !opened.open || !opened.classList.contains("operator-context")) return;
    opened.closest("[data-operator-view]")?.querySelectorAll("details.operator-context[open]").forEach((detail) => {
      if (detail !== opened) detail.open = false;
    });
  }, true);

  syncWorkActions();
}
