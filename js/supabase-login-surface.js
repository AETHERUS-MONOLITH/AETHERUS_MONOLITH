import {
  SUPABASE_LOGIN_PROVIDER,
  initiateSupabaseProviderLogin
} from "./supabase-login-initiation.js";

const stateLabels = Object.freeze({
  absent_config: "Config unavailable",
  unsupported_provider: "Provider unavailable",
  provider_login_initiation_unavailable: "Provider initiation unavailable",
  provider_login_initiation_attempted: "Redirect initiated",
  provider_login_initiation_failed: "Redirect failed"
});

const statusNode = document.querySelector("[data-login-status]");
const actionButton = document.querySelector("[data-login-provider]");

function renderLoginState(state) {
  if (!statusNode) return;
  statusNode.textContent = stateLabels[state.state] || "Provider initiation unavailable";
  statusNode.dataset.state = state.state;
}

async function handleProviderAction() {
  if (!actionButton) return;
  actionButton.disabled = true;
  renderLoginState({ state: "provider_login_initiation_unavailable" });

  const result = await initiateSupabaseProviderLogin({
    provider: SUPABASE_LOGIN_PROVIDER
  });

  renderLoginState(result);
  if (result.state !== "provider_login_initiation_attempted") {
    actionButton.disabled = false;
  }
}

if (actionButton) {
  actionButton.addEventListener("click", handleProviderAction);
}
