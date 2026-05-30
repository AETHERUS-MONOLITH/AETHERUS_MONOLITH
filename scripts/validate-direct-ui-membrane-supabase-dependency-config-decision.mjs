import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";

const runFile = promisify(execFile);

const decisionPath = "data/direct-ui-membrane-supabase-dependency-config-decision.v0.json";
const scaffoldPath = "data/direct-ui-membrane-supabase-client-scaffold.v0.json";
const initializationBoundaryPath =
  "data/direct-ui-membrane-supabase-client-initialization-boundary.v0.json";
const conditionalInitializationPath =
  "data/direct-ui-membrane-conditional-supabase-client-initialization.v0.json";
const envGatePath = "data/direct-ui-membrane-env-secret-hygiene-gate.v0.json";
const projectBoundaryPath = "data/direct-ui-membrane-supabase-project-boundary.v0.json";
const docsJsonPath = "data/docs.json";
const clientPath = "js/supabase-client.js";
const runtimeConfigPath = "js/supabase-public-config.runtime.js";
const exactConditionalModuleUrl =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.103.2/+esm";

const publicConfigNames = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY"
];

const serverSecretNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET"
];

const forbiddenClientStringPatterns = [
  "service_role",
  "jwt_secret"
];

const falseFlags = [
  "implementation_performed",
  "supabase_dependency_installed",
  "supabase_client_initialized",
  "supabase_import_added",
  "create_client_call_added",
  "auth_implemented",
  "login_ui_implemented",
  "signup_ui_implemented",
  "credential_capture_implemented",
  "auth_callback_implemented",
  "protected_routes_implemented",
  "backend_implemented",
  "database_schema_implemented",
  "persistence_implemented",
  "rls_implemented",
  "tenant_isolation_implemented",
  "customer_workspace_implemented",
  "billing_implemented",
  "palisade_implemented",
  "weave_runtime_implemented",
  "public_nexus_runtime_implemented"
];

const forbiddenPackageFiles = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock"
];

const forbiddenEnvFiles = [
  ".env",
  ".env.local",
  ".env.production"
];

const activeClientFiles = [
  "index.html",
  "membrane.html",
  "workspace.html",
  "auth-boundary.html",
  "js/app.js",
  "js/docs.js",
  "js/pipeline.js",
  "js/preview-workspace.js",
  "js/governance-engine.js",
  "js/trace-viewer.js"
];

const runtimeForbiddenPatterns = [
  { label: "Supabase package import", pattern: /@supabase\/supabase-js/ },
  { label: "Supabase import", pattern: /from\s+["'][^"']*supabase[^"']*["']/ },
  { label: "Supabase dynamic import", pattern: /import\s*\([^)]*["'][^"']*supabase[^"']*["'][^)]*\)/ },
  { label: "live client initialization", pattern: /\bcreateClient\s*\(/ },
  { label: "live client initialization", pattern: /\bsupabase\.createClient\b/ },
  { label: "auth call", pattern: /\bsupabase\.auth\b/ },
  { label: "database call", pattern: /\bsupabase\.from\b/ },
  { label: "sign-in flow", pattern: /\bsignIn\b/ },
  { label: "sign-up flow", pattern: /\bsignUp\b/ },
  { label: "local persistence", pattern: /\blocalStorage\b/ },
  { label: "session persistence", pattern: /\bsessionStorage\b/ },
  { label: "cookie persistence", pattern: /\bdocument\.cookie\b/ }
];

const committedValuePatterns = [
  { label: "real Supabase URL", pattern: /https:\/\/[A-Za-z0-9-]+\.supabase\.co/i },
  { label: "Supabase key-like value", pattern: /\bsb_(?:publishable|anon|secret|service)_[A-Za-z0-9_-]{8,}/i },
  { label: "JWT-like value", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { label: "non-empty Supabase env assignment", pattern: /^SUPABASE_[A-Z_]+=.+$/m }
];

function fail(message) {
  throw new Error(message);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

function assertIncludesAll(actual, expected, label) {
  for (const value of expected) {
    if (!actual.includes(value)) fail(`${label}: missing ${value}`);
  }
}

function assertFalseBooleans(record, keys, label) {
  for (const key of keys) {
    if (record[key] !== false) fail(`${label}.${key} must be false`);
  }
}

async function assertMissing(paths, label) {
  for (const filePath of paths) {
    if (await exists(filePath)) fail(`${label}: ${filePath} must not exist`);
  }
}

async function assertNoRuntimeImplementation() {
  for (const filePath of activeClientFiles) {
    if (!(await exists(filePath))) continue;
    const text = await readText(filePath);

    for (const { label, pattern } of runtimeForbiddenPatterns) {
      if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
    }

    if (filePath !== clientPath) {
      for (const name of [...publicConfigNames, ...serverSecretNames]) {
        if (text.includes(name)) fail(`${filePath} must not contain ${name}`);
      }
      for (const term of forbiddenClientStringPatterns) {
        if (text.includes(term)) fail(`${filePath} must not contain ${term}`);
      }
    }

    if (filePath === clientPath) {
      for (const name of serverSecretNames) {
        if (text.includes(name)) fail(`${clientPath} must not contain ${name}`);
      }
      for (const term of forbiddenClientStringPatterns) {
        if (text.includes(term)) fail(`${clientPath} must not contain ${term}`);
      }
    }
  }
}

async function assertOnlyAuthorizedConditionalClientImplementation() {
  if (!(await exists(clientPath))) return;
  const clientText = await readText(clientPath);
  const hasConditionalDependency =
    /@supabase\/supabase-js/.test(clientText) || /\bcreateClient\s*\(/.test(clientText);
  if (!hasConditionalDependency) return;

  if (!(await exists(conditionalInitializationPath))) {
    fail(`${clientPath} contains conditional initialization without ${conditionalInitializationPath}`);
  }
  const conditional = await readJson(conditionalInitializationPath);
  if (conditional.object_status !== "conditional_supabase_browser_client_initialization") {
    fail("conditional initialization record object_status mismatch");
  }
  if (conditional.implementation_performed !== true) {
    fail("conditional initialization record must mark implementation_performed true");
  }
  if (conditional.supabase_dependency_installed !== false) {
    fail("conditional initialization must not install a Supabase dependency");
  }
  if (conditional.package_installation_performed !== false) {
    fail("conditional initialization must not perform package installation");
  }
  if (conditional.runtime_public_config_values_committed !== false) {
    fail("conditional initialization must not commit runtime config values");
  }
  if (conditional.browser_esm_module_url !== exactConditionalModuleUrl) {
    fail("conditional initialization must use the exact version-pinned ESM URL");
  }
  if (!clientText.includes(exactConditionalModuleUrl)) {
    fail(`${clientPath} must include the exact version-pinned ESM URL`);
  }
  if (/@supabase\/supabase-js@latest/.test(clientText)) fail(`${clientPath} must not use @latest`);
  if (/@supabase\/supabase-js@2(?:[/"'`?]|$)/.test(clientText)) {
    fail(`${clientPath} must not use a major-only @2 specifier`);
  }
  if (/(?:https:\/\/cdn\.jsdelivr\.net\/npm\/)?@supabase\/supabase-js(?:[/"'`?]|\+esm|$)/.test(clientText)) {
    fail(`${clientPath} must not use an unversioned Supabase module specifier`);
  }
  for (const { label, pattern } of runtimeForbiddenPatterns.slice(5)) {
    if (pattern.test(clientText)) fail(`${clientPath} contains forbidden ${label}`);
  }
  for (const name of serverSecretNames) {
    if (clientText.includes(name)) fail(`${clientPath} must not contain ${name}`);
  }
  for (const term of forbiddenClientStringPatterns) {
    if (clientText.includes(term)) fail(`${clientPath} must not contain ${term}`);
  }
  if (/\bsupabase\.auth\b/.test(clientText)) fail(`${clientPath} must not call Supabase auth`);
  if (/\bsupabase\.from\b/.test(clientText)) fail(`${clientPath} must not call Supabase database APIs`);
}

async function assertNoCommittedValues() {
  const files = [
    decisionPath,
    scaffoldPath,
    initializationBoundaryPath,
    envGatePath,
    projectBoundaryPath,
    clientPath,
    ".env.example"
  ];

  for (const filePath of files) {
    const text = await readText(filePath);
    for (const { label, pattern } of committedValuePatterns) {
      if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
    }
  }
}

function assertReference(reference, expectedPath, expectedStatus, label) {
  if (reference?.path !== expectedPath) fail(`${label}.path must be ${expectedPath}`);
  if (reference?.object_status !== expectedStatus) fail(`${label}.object_status mismatch`);
}

async function assertNoForbiddenDiff() {
  let stdout = "";
  try {
    const result = await runFile("git", ["diff", "--", ...activeClientFiles]);
    stdout = result.stdout || "";
  } catch (error) {
    stdout = error.stdout || "";
  }

  if (!stdout.trim()) return;

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    for (const { label, pattern } of runtimeForbiddenPatterns.concat(committedValuePatterns)) {
      if (pattern.test(line)) fail(`active/client diff introduces forbidden ${label}: ${line.trim()}`);
    }
  }
}

if (!(await exists(decisionPath))) fail(`${decisionPath} is missing`);

const decision = await readJson(decisionPath);
const scaffold = await readJson(scaffoldPath);
const initializationBoundary = await readJson(initializationBoundaryPath);
const envGate = await readJson(envGatePath);
const projectBoundary = await readJson(projectBoundaryPath);
const docsJsonText = await readText(docsJsonPath);

if (decision.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  decision.generated_for_sub_pass !==
  "§1.2 Supabase Implementation 0.2 — Dependency and Public Config Injection Decision"
) {
  fail("generated_for_sub_pass mismatch");
}
if (decision.baseline_commit !== "9999e5178e6ab7558fce63571863d05221b51170") {
  fail("baseline_commit mismatch");
}
if (decision.object_status !== "supabase_dependency_public_config_decision") {
  fail("object_status mismatch");
}

assertFalseBooleans(decision, falseFlags, "decision");

const dependency = decision.selected_dependency_strategy || {};
if (dependency.name !== "deferred_version_pinned_browser_esm_import") {
  fail("selected dependency strategy mismatch");
}
if (dependency.selected !== true) fail("dependency strategy must be selected");
if (dependency.dependency_installation_authorized_now !== false) {
  fail("dependency installation must not be authorized now");
}
if (dependency.dependency_installation_deferred !== true) {
  fail("dependency installation must remain deferred");
}
if (dependency.package_installation_selected !== false) {
  fail("package installation must not be selected");
}
if (dependency.cdn_or_esm_import_selected_for_future !== true) {
  fail("future ESM/CDN import strategy must be selected");
}
if (dependency.static_compatible !== true || dependency.no_build_step_preserved !== true) {
  fail("dependency strategy must preserve static no-build architecture");
}
assertIncludesAll(
  dependency.package_strategy_boundary || [],
  [
    "A package-based Supabase dependency remains a future architecture change only.",
    "Adding package.json, a lockfile, or npm installation requires separate Operator authorization.",
    "Package installation is not authorized by this decision pass."
  ],
  "package_strategy_boundary"
);

const config = decision.selected_public_config_injection_strategy || {};
if (config.name !== "deferred_generated_runtime_public_config_object") {
  fail("selected public config strategy mismatch");
}
if (config.selected !== true) fail("public config strategy must be selected");
for (const key of [
  "public_values_committed_now",
  "real_values_committed_now",
  "fake_values_committed_now",
  "placeholder_values_committed_now",
  "non_empty_env_assignment_committed_now",
  "future_runtime_config_file_created_now"
]) {
  if (config[key] !== false) fail(`public config strategy ${key} must be false`);
}
if (config.future_browser_global_name !== "AETHERUS_SUPABASE_PUBLIC_CONFIG") {
  fail("future browser config global mismatch");
}
if (config.future_runtime_config_file !== runtimeConfigPath) {
  fail("future runtime config file mismatch");
}
if (config.supabase_url_delivery?.name !== "SUPABASE_URL") {
  fail("SUPABASE_URL delivery missing");
}
if (config.supabase_url_delivery?.committed_value_allowed !== false) {
  fail("SUPABASE_URL committed value must remain forbidden");
}
if (config.supabase_publishable_key_delivery?.name !== "SUPABASE_PUBLISHABLE_KEY") {
  fail("SUPABASE_PUBLISHABLE_KEY delivery missing");
}
if (config.supabase_publishable_key_delivery?.preferred_future_public_key !== true) {
  fail("SUPABASE_PUBLISHABLE_KEY must be preferred");
}
if (config.supabase_anon_key_legacy_fallback?.name !== "SUPABASE_ANON_KEY") {
  fail("SUPABASE_ANON_KEY fallback missing");
}
if (config.supabase_anon_key_legacy_fallback?.fallback_only !== true) {
  fail("SUPABASE_ANON_KEY must be fallback only");
}
assertIncludesAll(
  config.absent_config_behavior_before_live_initialization || [],
  [
    "js/supabase-client.js may continue to resolve absent_config without network calls.",
    "Absent public config must keep live client initialization unauthorized.",
    "No UI may collect credentials as a substitute for missing public config."
  ],
  "absent_config_behavior_before_live_initialization"
);

const secretBoundary = decision.secret_boundary || {};
if (secretBoundary.values_committed !== false || secretBoundary.secrets_committed !== false) {
  fail("secret boundary must keep values and secrets uncommitted");
}
assertIncludesAll(secretBoundary.server_secret_names || [], serverSecretNames, "server_secret_names");
assertIncludesAll(
  secretBoundary.forbidden_client_string_patterns || [],
  forbiddenClientStringPatterns,
  "forbidden_client_string_patterns"
);
assertIncludesAll(
  secretBoundary.forbidden_committed_value_classes || [],
  [
    "real Supabase URL",
    "real publishable key",
    "real anon key",
    "fake key",
    "placeholder key value",
    "service-role key",
    "JWT secret",
    "non-empty env assignment"
  ],
  "forbidden_committed_value_classes"
);

assertReference(
  decision.referenced_boundaries?.client_scaffold,
  scaffoldPath,
  "supabase_client_boundary_scaffold",
  "client_scaffold"
);
assertReference(
  decision.referenced_boundaries?.client_initialization_boundary,
  initializationBoundaryPath,
  "supabase_client_initialization_boundary",
  "client_initialization_boundary"
);
assertReference(
  decision.referenced_boundaries?.env_secret_hygiene_gate,
  envGatePath,
  "env_secret_hygiene_gate",
  "env_secret_hygiene_gate"
);
assertReference(
  decision.referenced_boundaries?.supabase_project_boundary,
  projectBoundaryPath,
  "supabase_project_boundary_contract",
  "supabase_project_boundary"
);

if (scaffold.supabase_dependency_installed !== false) fail("scaffold dependency flag must remain false");
if (scaffold.supabase_client_initialized_live !== false) fail("scaffold live init flag must remain false");
if (initializationBoundary.supabase_dependency_installed !== false) {
  fail("initialization boundary dependency flag must remain false");
}
if (initializationBoundary.supabase_client_initialized !== false) {
  fail("initialization boundary live init flag must remain false");
}
if (envGate.secrets_committed !== false || envGate.env_files_created !== false) {
  fail("env gate must keep secrets and env files absent");
}
if (projectBoundary.supabase_dependency_installed !== false) {
  fail("project boundary dependency flag must remain false");
}

const nextThreshold = decision.next_threshold || {};
if (nextThreshold.name !== "§1.2 Supabase Implementation 0.3 — Live Client Initialization") {
  fail("next threshold mismatch");
}
assertIncludesAll(
  nextThreshold.may_initialize_live_client_only_after || [],
  [
    "version-pinned browser ESM dependency loading is explicitly represented in the authorized client file",
    "runtime public config injection is represented safely without committed real, fake, or placeholder values",
    "SUPABASE_URL is available from the approved public config source",
    "SUPABASE_PUBLISHABLE_KEY is available from the approved public config source, or SUPABASE_ANON_KEY is available as a legacy-compatible fallback",
    "server-secret names and forbidden string patterns remain absent from browser/client implementation files except bounded forbidden-term validators or records",
    "package installation remains unperformed unless separately authorized by the Operator"
  ],
  "may_initialize_live_client_only_after"
);
assertIncludesAll(
  nextThreshold.still_must_not_implement_without_separate_authorization || [],
  [
    "login UI",
    "signup UI",
    "credential capture",
    "auth callback route",
    "protected route",
    "backend/server",
    "database schema",
    "persistence",
    "RLS implementation",
    "tenant isolation",
    "customer workspace",
    "billing",
    "Palisade",
    "Weave runtime",
    "public NEXUS runtime"
  ],
  "still_must_not_implement_without_separate_authorization"
);

assertIncludesAll(
  decision.claimable_after_this_pass || [],
  [
    "Supabase dependency and public config injection decision exists",
    "future dependency loading strategy is selected for the static no-build architecture",
    "future browser-safe public config injection strategy is selected without committed values",
    "dependency installation remains deferred",
    "live Supabase client initialization remains deferred"
  ],
  "claimable_after_this_pass"
);
assertIncludesAll(
  decision.not_claimable_after_this_pass || [],
  [
    "Supabase dependency is installed",
    "Supabase import exists",
    "live Supabase client is initialized",
    "real Supabase config exists in committed files",
    "login exists",
    "signup exists",
    "credential capture exists",
    "auth callback exists",
    "protected route exists",
    "backend exists",
    "database exists",
    "persistence exists",
    "RLS exists",
    "tenant isolation exists",
    "customer workspace exists",
    "billing exists",
    "production SaaS exists"
  ],
  "not_claimable_after_this_pass"
);

const nextCommit = decision.smallest_truthful_next_commit || {};
if (nextCommit.name !== nextThreshold.name) fail("smallest truthful next commit mismatch");
assertIncludesAll(
  nextCommit.must_not_implement || [],
  nextThreshold.still_must_not_implement_without_separate_authorization || [],
  "smallest_truthful_next_commit.must_not_implement"
);

await assertMissing(forbiddenPackageFiles, "package/dependency file");
await assertMissing(forbiddenEnvFiles, "env file");
if (await exists(runtimeConfigPath)) fail(`${runtimeConfigPath} must not exist in this pass`);
await assertNoRuntimeImplementation();
await assertOnlyAuthorizedConditionalClientImplementation();
await assertNoCommittedValues();
await assertNoForbiddenDiff();

if (docsJsonText.includes("direct-ui-membrane-supabase-dependency-config-decision")) {
  fail("Supabase dependency config decision must not be promoted through data/docs.json");
}
if (docsJsonText.includes("validate-direct-ui-membrane-supabase-dependency-config-decision")) {
  fail("Supabase dependency config validator must not be promoted through data/docs.json");
}

for (const validator of [
  "scripts/validate-direct-ui-membrane-supabase-client-scaffold.mjs",
  "scripts/validate-direct-ui-membrane-supabase-client-initialization-boundary.mjs",
  "scripts/validate-direct-ui-membrane-env-secret-hygiene-gate.mjs",
  "scripts/validate-direct-ui-membrane-supabase-project-boundary.mjs",
  "scripts/validate-documentation-surface-inventory.mjs",
  "scripts/validate-track3-contracts.mjs"
]) {
  await runFile("node", [validator], {
    stdio: "inherit"
  });
}

console.log("direct ui membrane supabase dependency config decision ok (0.3 conditional boundary permitted)");
