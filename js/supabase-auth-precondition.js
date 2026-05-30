import { initializeSupabaseBrowserClient } from "./supabase-client.js";

const authCallbackSessionGuardPreconditionBoundary = Object.freeze({
  object_status: "auth_callback_session_guard_precondition",
  conditional_supabase_client_initialization_required: true,
  auth_callback_precondition_implemented: true,
  session_guard_precondition_implemented: true,
  credential_flow_handling_started: true,
  credential_capture_implemented: false,
  login_ui_implemented: false,
  signup_ui_implemented: false,
  provider_login_initiation_implemented: false,
  auth_callback_route_implemented: false,
  session_detection_implemented: true,
  protected_route_implemented: false,
  protected_shell_entry_implemented: false,
  authenticated_surfaces_born: false,
  database_access_implemented: false,
  persistence_implemented: false
});

function readCallbackCode(input) {
  if (!input) return "";
  if (input instanceof URL) return input.searchParams.get("code") || "";
  if (input instanceof URLSearchParams) return input.get("code") || "";
  if (typeof input === "string") {
    const params = input.startsWith("?")
      ? new URLSearchParams(input)
      : new URL(input, "https://callback.local").searchParams;
    return params.get("code") || "";
  }
  if (typeof input === "object" && typeof input.get === "function") {
    return input.get("code") || "";
  }
  return "";
}

function createPreconditionState(state, fields = {}) {
  return Object.freeze({
    object_status: "auth_callback_session_guard_precondition",
    state,
    protected_shell_entry_implemented: false,
    authenticated_surfaces_born: false,
    boundary: authCallbackSessionGuardPreconditionBoundary,
    ...fields
  });
}

function hasInitializedClient(result) {
  return Boolean(result && result.client_initialized === true && result.client);
}

async function handleSupabaseAuthCallbackPrecondition(options = {}) {
  const code = readCallbackCode(options.callbackInput);
  if (!code) {
    return createPreconditionState("no_callback_code", {
      callback_exchange_attempted: false,
      session_detection_implemented: true
    });
  }

  const clientResult = await initializeSupabaseBrowserClient({
    publicConfig: options.publicConfig,
    moduleUrl: options.moduleUrl,
    loadModule: options.loadModule
  });

  if (!hasInitializedClient(clientResult)) {
    return createPreconditionState("absent_config", {
      callback_exchange_attempted: false,
      client_state: clientResult.state,
      missing_public_config: clientResult.missing_public_config || []
    });
  }

  try {
    const exchangeResult = await clientResult.client.auth.exchangeCodeForSession(code);
    if (exchangeResult.error) {
      return createPreconditionState("callback_exchange_failed", {
        callback_exchange_attempted: true,
        error_name: exchangeResult.error.name || "callback_exchange_error"
      });
    }
    return createPreconditionState("callback_exchange_attempted", {
      callback_exchange_attempted: true,
      session_present: Boolean(exchangeResult.data?.session)
    });
  } catch (error) {
    return createPreconditionState("callback_exchange_failed", {
      callback_exchange_attempted: true,
      error_name: error?.name || "callback_exchange_error"
    });
  }
}

async function classifySupabaseSessionGuardPrecondition(options = {}) {
  const clientResult = options.client
    ? { client_initialized: true, client: options.client }
    : await initializeSupabaseBrowserClient({
        publicConfig: options.publicConfig,
        moduleUrl: options.moduleUrl,
        loadModule: options.loadModule
      });

  if (!hasInitializedClient(clientResult)) {
    return createPreconditionState("absent_config", {
      guard_denied: true,
      client_state: clientResult.state,
      missing_public_config: clientResult.missing_public_config || []
    });
  }

  const sessionResult = await clientResult.client.auth.getSession();
  if (sessionResult.error || !sessionResult.data?.session) {
    return createPreconditionState("session_absent", {
      guard_denied: true,
      session_present: false
    });
  }

  return createPreconditionState("guard_permitted_without_shell_entry", {
    guard_denied: false,
    session_present: true
  });
}

export {
  authCallbackSessionGuardPreconditionBoundary,
  classifySupabaseSessionGuardPrecondition,
  handleSupabaseAuthCallbackPrecondition,
  readCallbackCode
};
