const SUPABASE_PUBLIC_CONFIG_NAMES = Object.freeze([
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY"
]);

const SUPABASE_PUBLIC_KEY_NAMES = Object.freeze([
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY"
]);

const supabaseClientBoundaryScaffold = Object.freeze({
  object_status: "supabase_client_boundary_scaffold",
  client_initialized: false,
  dependency_installed: false,
  ready_for_dependency_authorization: true,
  allowed_public_config_names: SUPABASE_PUBLIC_CONFIG_NAMES
});

function readPublicConfigValue(source, name) {
  if (!source || typeof source !== "object") return "";
  if (!Object.prototype.hasOwnProperty.call(source, name)) return "";
  const value = source[name];
  return typeof value === "string" ? value.trim() : "";
}

function resolveSupabasePublicConfig(source = {}) {
  const url = readPublicConfigValue(source, "SUPABASE_URL");
  const publicKeyName = SUPABASE_PUBLIC_KEY_NAMES.find((name) => readPublicConfigValue(source, name));
  const publicKey = publicKeyName ? readPublicConfigValue(source, publicKeyName) : "";
  const missing = [];

  if (!url) missing.push("SUPABASE_URL");
  if (!publicKey) missing.push("SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY");

  return Object.freeze({
    object_status: "supabase_public_config_boundary",
    client_initialized: false,
    dependency_installed: false,
    ready_for_dependency_authorization: missing.length === 0,
    state: missing.length === 0 ? "ready_for_dependency_authorization" : "absent_config",
    missing_public_config: Object.freeze(missing),
    config: Object.freeze({
      url,
      public_key_name: publicKeyName || "",
      public_key: publicKey
    })
  });
}

function assertSupabasePublicConfigPresent(source = {}) {
  const boundary = resolveSupabasePublicConfig(source);
  if (boundary.missing_public_config.length > 0) {
    throw new Error("Supabase public config is absent; live client initialization is not authorized.");
  }
  return boundary;
}

export {
  SUPABASE_PUBLIC_CONFIG_NAMES,
  assertSupabasePublicConfigPresent,
  resolveSupabasePublicConfig,
  supabaseClientBoundaryScaffold
};
