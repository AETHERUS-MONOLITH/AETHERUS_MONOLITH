const SUPABASE_PUBLIC_CONFIG_NAMES = Object.freeze([
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY"
]);

const SUPABASE_PUBLIC_KEY_NAMES = Object.freeze([
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY"
]);

const SUPABASE_PUBLIC_CONFIG_GLOBAL = "AETHERUS_SUPABASE_PUBLIC_CONFIG";
const SUPABASE_BROWSER_ESM_VERSION = "2.103.2";
const SUPABASE_BROWSER_ESM_MODULE_URL =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.103.2/+esm";

const supabaseClientBoundaryScaffold = Object.freeze({
  object_status: "supabase_client_boundary_scaffold",
  client_initialized: false,
  dependency_installed: false,
  ready_for_dependency_authorization: true,
  allowed_public_config_names: SUPABASE_PUBLIC_CONFIG_NAMES,
  runtime_public_config_global: SUPABASE_PUBLIC_CONFIG_GLOBAL,
  conditional_browser_client_initialization_available: true
});

const supabaseClientInitializationBoundary = Object.freeze({
  object_status: "conditional_supabase_browser_client_initialization",
  dependency_installed: false,
  package_installation_performed: false,
  browser_esm_dependency_represented: true,
  version_pinned_esm_import_or_loader_represented: true,
  module_url: SUPABASE_BROWSER_ESM_MODULE_URL,
  version_pin: SUPABASE_BROWSER_ESM_VERSION,
  runtime_public_config_global: SUPABASE_PUBLIC_CONFIG_GLOBAL,
  runtime_public_config_values_committed: false,
  accepted_public_config_names: SUPABASE_PUBLIC_CONFIG_NAMES,
  preferred_public_key_name: "SUPABASE_PUBLISHABLE_KEY",
  fallback_public_key_name: "SUPABASE_ANON_KEY",
  auth_implemented: false,
  login_ui_implemented: false,
  signup_ui_implemented: false,
  credential_capture_implemented: false,
  auth_callback_implemented: false,
  session_detection_implemented: false,
  protected_routes_implemented: false,
  backend_implemented: false,
  database_access_implemented: false,
  persistence_implemented: false
});

function readPublicConfigValue(source, name) {
  if (!source || typeof source !== "object") return "";
  if (!Object.prototype.hasOwnProperty.call(source, name)) return "";
  const value = source[name];
  return typeof value === "string" ? value.trim() : "";
}

function readSupabaseRuntimePublicConfig(source) {
  if (source && typeof source === "object") return source;
  if (
    typeof globalThis !== "undefined" &&
    globalThis[SUPABASE_PUBLIC_CONFIG_GLOBAL] &&
    typeof globalThis[SUPABASE_PUBLIC_CONFIG_GLOBAL] === "object"
  ) {
    return globalThis[SUPABASE_PUBLIC_CONFIG_GLOBAL];
  }
  return {};
}

function resolveSupabasePublicConfig(source) {
  const publicConfigSource = readSupabaseRuntimePublicConfig(source);
  const resolvedUrl = readPublicConfigValue(publicConfigSource, "SUPABASE_URL");
  const publicKeyName = SUPABASE_PUBLIC_KEY_NAMES.find((name) =>
    readPublicConfigValue(publicConfigSource, name)
  );
  const publicKey = publicKeyName ? readPublicConfigValue(publicConfigSource, publicKeyName) : "";
  const missing = [];

  if (!resolvedUrl) missing.push("SUPABASE_URL");
  if (!publicKey) missing.push("SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY");

  return Object.freeze({
    object_status: "supabase_public_config_boundary",
    client_initialized: false,
    dependency_installed: false,
    ready_for_dependency_authorization: missing.length === 0,
    ready_for_conditional_initialization: missing.length === 0,
    state: missing.length === 0 ? "ready_for_conditional_initialization" : "absent_config",
    missing_public_config: Object.freeze(missing),
    config: Object.freeze({
      url: resolvedUrl,
      public_key_name: publicKeyName || "",
      public_key: publicKey
    })
  });
}

function assertSupabasePublicConfigPresent(source) {
  const boundary = resolveSupabasePublicConfig(source);
  if (boundary.missing_public_config.length > 0) {
    throw new Error("Supabase public config is absent; live client initialization is not authorized.");
  }
  return boundary;
}

function assertVersionPinnedSupabaseModuleUrl(moduleUrl) {
  if (moduleUrl !== SUPABASE_BROWSER_ESM_MODULE_URL) {
    throw new Error("Supabase browser ESM module URL must match the approved exact version-pinned URL.");
  }
  return moduleUrl;
}

function createAbsentSupabaseClientBoundary(publicConfigBoundary) {
  return Object.freeze({
    object_status: "conditional_supabase_browser_client_initialization",
    state: "absent_config",
    initialization_state: "not_initialized",
    client_initialized: false,
    dependency_loaded: false,
    dependency_installed: false,
    package_installation_performed: false,
    module_url: SUPABASE_BROWSER_ESM_MODULE_URL,
    version_pin: SUPABASE_BROWSER_ESM_VERSION,
    runtime_public_config_global: SUPABASE_PUBLIC_CONFIG_GLOBAL,
    missing_public_config: publicConfigBoundary.missing_public_config,
    client: null,
    boundary: supabaseClientInitializationBoundary
  });
}

async function initializeSupabaseBrowserClient(options = {}) {
  const publicConfigBoundary = resolveSupabasePublicConfig(options.publicConfig);
  const moduleUrl = assertVersionPinnedSupabaseModuleUrl(
    options.moduleUrl || SUPABASE_BROWSER_ESM_MODULE_URL
  );

  if (publicConfigBoundary.missing_public_config.length > 0) {
    return createAbsentSupabaseClientBoundary(publicConfigBoundary);
  }

  const loadModule = options.loadModule || ((url) => import(url));
  const supabaseModule = await loadModule(moduleUrl);
  if (typeof supabaseModule.createClient !== "function") {
    throw new Error("Supabase browser ESM module did not expose createClient.");
  }

  const client = supabaseModule.createClient(
    publicConfigBoundary.config.url,
    publicConfigBoundary.config.public_key,
    {
      auth: {
        flowType: "pkce",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  );

  return Object.freeze({
    object_status: "conditional_supabase_browser_client_initialization",
    state: "initialized",
    initialization_state: "initialized",
    client_initialized: true,
    dependency_loaded: true,
    dependency_installed: false,
    package_installation_performed: false,
    module_url: moduleUrl,
    version_pin: SUPABASE_BROWSER_ESM_VERSION,
    runtime_public_config_global: SUPABASE_PUBLIC_CONFIG_GLOBAL,
    public_key_name: publicConfigBoundary.config.public_key_name,
    client,
    boundary: supabaseClientInitializationBoundary
  });
}

export {
  SUPABASE_BROWSER_ESM_MODULE_URL,
  SUPABASE_BROWSER_ESM_VERSION,
  SUPABASE_PUBLIC_CONFIG_GLOBAL,
  SUPABASE_PUBLIC_CONFIG_NAMES,
  assertSupabasePublicConfigPresent,
  assertVersionPinnedSupabaseModuleUrl,
  initializeSupabaseBrowserClient,
  readSupabaseRuntimePublicConfig,
  resolveSupabasePublicConfig,
  supabaseClientBoundaryScaffold,
  supabaseClientInitializationBoundary
};
