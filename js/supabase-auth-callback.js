import { handleSupabaseAuthCallbackPrecondition } from "./supabase-auth-precondition.js";

const stateLabels = Object.freeze({
  absent_config: "Runtime public config unavailable",
  no_callback_code: "No callback code",
  callback_exchange_attempted: "Callback exchange classified",
  callback_exchange_failed: "Callback exchange failed"
});

const headingNode = document.querySelector("[data-callback-heading]");
const statusNode = document.querySelector("[data-callback-status]");
const entryLink = document.querySelector("[data-callback-entry]");

function renderCallbackState(result) {
  const sessionRecognized = result.session_present === true;
  if (headingNode) {
    headingNode.textContent = sessionRecognized ? "Session recognized" : "Session not admitted";
  }
  if (statusNode) {
    statusNode.textContent = stateLabels[result.state] || "Callback unavailable";
    statusNode.dataset.state = result.state;
  }
  if (entryLink) {
    entryLink.hidden = !sessionRecognized;
  }
}

async function classifyCallback() {
  const callbackInput =
    typeof globalThis !== "undefined" && globalThis.location
      ? new URL(globalThis.location.href)
      : "";
  const result = await handleSupabaseAuthCallbackPrecondition({ callbackInput });
  renderCallbackState(result);
}

classifyCallback().catch(() => {
  renderCallbackState({ state: "callback_exchange_failed", session_present: false });
});
