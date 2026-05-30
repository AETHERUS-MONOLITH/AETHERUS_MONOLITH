import { initializeSupabaseBrowserClient } from "./supabase-client.js";

const SUPABASE_LOGIN_PROVIDER = "github";
const SUPABASE_LOGIN_PROVIDERS = Object.freeze([SUPABASE_LOGIN_PROVIDER]);
const DEFAULT_LOGIN_REDIRECT_PATH = "auth-callback.html";

const providerLoginInitiationBoundary = Object.freeze({
  object_status: "provider_login_initiation_surface",
  conditional_supabase_client_initialization_required: true,
  auth_callback_precondition_required: true,
  provider_login_initiation_implemented: true,
  provider_login_surface_implemented: true,
  selected_provider: SUPABASE_LOGIN_PROVIDER,
  credential_flow_handling_started: true,
  credential_capture_implemented: false,
  password_login_implemented: false,
  signup_ui_implemented: false,
  sign_up_implemented: false,
  email_password_form_implemented: false,
  protected_route_implemented: false,
  protected_shell_entry_implemented: false,
  authenticated_surfaces_born: false,
  authenticated_workspace_implemented: false,
  database_access_implemented: false,
  persistence_implemented: false
});

function createProviderLoginState(state, fields = {}) {
  return Object.freeze({
    object_status: "provider_login_initiation_surface",
    state,
    provider_login_initiation_implemented: true,
    provider_login_surface_implemented: true,
    credential_capture_implemented: false,
    password_login_implemented: false,
    signup_ui_implemented: false,
    sign_up_implemented: false,
    email_password_form_implemented: false,
    protected_shell_entry_implemented: false,
    authenticated_surfaces_born: false,
    boundary: providerLoginInitiationBoundary,
    ...fields
  });
}

function isAllowedProvider(provider) {
  return SUPABASE_LOGIN_PROVIDERS.includes(provider);
}

function resolveRedirectTo(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof globalThis === "undefined" || !globalThis.location) return DEFAULT_LOGIN_REDIRECT_PATH;
  return new URL(DEFAULT_LOGIN_REDIRECT_PATH, globalThis.location.href).toString();
}

function hasInitializedClient(result) {
  return Boolean(result && result.client_initialized === true && result.client);
}

async function initiateSupabaseProviderLogin(options = {}) {
  const provider = options.provider || SUPABASE_LOGIN_PROVIDER;
  if (!isAllowedProvider(provider)) {
    return createProviderLoginState("unsupported_provider", {
      selected_provider: provider,
      allowed_providers: SUPABASE_LOGIN_PROVIDERS
    });
  }

  const clientResult = await initializeSupabaseBrowserClient({
    publicConfig: options.publicConfig,
    moduleUrl: options.moduleUrl,
    loadModule: options.loadModule
  });

  if (!hasInitializedClient(clientResult)) {
    return createProviderLoginState("absent_config", {
      selected_provider: provider,
      missing_public_config: clientResult.missing_public_config || []
    });
  }

  try {
    const loginResult = await clientResult.client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: resolveRedirectTo(options.redirectTo)
      }
    });

    if (loginResult.error) {
      return createProviderLoginState("provider_login_initiation_failed", {
        selected_provider: provider,
        error_name: loginResult.error.name || "provider_login_initiation_error"
      });
    }

    return createProviderLoginState("provider_login_initiation_attempted", {
      selected_provider: provider,
      redirect_to: loginResult.data?.url || ""
    });
  } catch (error) {
    return createProviderLoginState("provider_login_initiation_unavailable", {
      selected_provider: provider,
      error_name: error?.name || "provider_login_initiation_error"
    });
  }
}

export {
  DEFAULT_LOGIN_REDIRECT_PATH,
  SUPABASE_LOGIN_PROVIDER,
  SUPABASE_LOGIN_PROVIDERS,
  initiateSupabaseProviderLogin,
  isAllowedProvider,
  providerLoginInitiationBoundary,
  resolveRedirectTo
};
