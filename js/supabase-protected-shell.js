import { classifySupabaseSessionGuardPrecondition } from "./supabase-auth-precondition.js";

const stateLabels = Object.freeze({
  absent_config: "Runtime public config unavailable",
  session_absent: "Session absent",
  guard_permitted_without_shell_entry: "Session recognized"
});

const headingNode = document.querySelector("[data-shell-heading]");
const statusNode = document.querySelector("[data-shell-status]");
const sessionChip = document.querySelector("[data-shell-session-chip]");
const boundaryNode = document.querySelector("[data-protected-shell-boundary]");
const denialLink = document.querySelector("[data-shell-denial-link]");

function renderShellState(result) {
  const admitted = result.guard_denied === false && result.session_present === true;
  if (headingNode) {
    headingNode.textContent = admitted ? "Session recognized" : "Access denied";
  }
  if (statusNode) {
    statusNode.textContent = admitted
      ? "Session recognized"
      : stateLabels[result.state] || "Guard unavailable";
    statusNode.dataset.state = result.state;
  }
  if (sessionChip) {
    sessionChip.textContent = admitted ? "Session recognized" : "Session not recognized";
  }
  if (boundaryNode) {
    boundaryNode.hidden = !admitted;
  }
  if (denialLink) {
    denialLink.hidden = admitted;
  }
}

async function classifyProtectedShell() {
  const result = await classifySupabaseSessionGuardPrecondition();
  renderShellState(result);
}

classifyProtectedShell().catch(() => {
  renderShellState({ state: "guard_unavailable", guard_denied: true, session_present: false });
});
