import fs from "node:fs/promises";

const clientPath = "js/supabase-client.js";
const scaffoldPath = "data/direct-ui-membrane-supabase-client-scaffold.v0.json";
const conditionalInitializationPath =
  "data/direct-ui-membrane-conditional-supabase-client-initialization.v0.json";
const envExamplePath = ".env.example";
const exactConditionalModuleUrl =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.103.2/+esm";

const expectedPublicConfigNames = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY"
];

const forbiddenClientConfigNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "service_role",
  "jwt_secret"
];

const falseFlags = [
  "values_committed",
  "secrets_committed",
  "supabase_dependency_installed",
  "supabase_client_initialized_live",
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
  "customer_workspace_implemented"
];

const forbiddenPackageFiles = [
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml"
];

const forbiddenEnvFiles = [
  ".env",
  ".env.local",
  ".env.production"
];

const forbiddenRouteFiles = [
  "auth-callback.html",
  "callback.html",
  "app.html",
  "login.html",
  "signin.html",
  "signup.html",
  "protected-route.html",
  "auth/callback.html",
  "auth/callback/index.html",
  "app/index.html",
  "app/workspace.html",
  "app/workspace/index.html",
  "app/settings.html",
  "app/settings/index.html"
];

const activeHtmlFiles = [
  "index.html",
  "membrane.html",
  "workspace.html",
  "auth-boundary.html"
];

const forbiddenClientPatterns = [
  { label: "real Supabase URL", pattern: /https:\/\/[A-Za-z0-9-]+\.supabase\.co/i },
  { label: "Supabase key-like value", pattern: /\bsb_(?:publishable|anon|secret|service)_[A-Za-z0-9_-]{8,}/i },
  { label: "JWT-like value", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { label: "auth call", pattern: /\bsignIn\b/ },
  { label: "auth call", pattern: /\bsignUp\b/ },
  { label: "auth call", pattern: /\bsignOut\b/ },
  { label: "auth call", pattern: /\bgetSession\b/ },
  { label: "database call", pattern: /\.from\s*\(/ },
  { label: "database call", pattern: /\.select\s*\(/ },
  { label: "database call", pattern: /\.insert\s*\(/ },
  { label: "database call", pattern: /\.update\s*\(/ },
  { label: "database call", pattern: /\.delete\s*\(/ },
  { label: "persistence", pattern: /\blocalStorage\b/ },
  { label: "persistence", pattern: /\bsessionStorage\b/ },
  { label: "persistence", pattern: /\bdocument\.cookie\b/ },
  { label: "API call", pattern: /\bfetch\s*\(/ },
  { label: "API call", pattern: /\bXMLHttpRequest\b/ },
  { label: "API route", pattern: /\/api\// }
];

const activeCredentialPatterns = [
  { label: "form", pattern: /<form\b/i },
  { label: "email input", pattern: /<input\b[^>]*type=["']email["']/i },
  { label: "password input", pattern: /<input\b[^>]*type=["']password["']/i },
  { label: "credential input", pattern: /<input\b[^>]*(?:name|id|placeholder)=["'][^"']*(?:email|password|credential)["']/i }
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

function assertFalseFlags(record) {
  for (const flag of falseFlags) {
    if (record[flag] !== false) fail(`${flag} must be false`);
  }
}

async function assertMissing(paths, label) {
  for (const filePath of paths) {
    if (await exists(filePath)) fail(`${label}: ${filePath} must not exist`);
  }
}

async function assertEnvExampleValuesEmpty() {
  if (!(await exists(envExamplePath))) return;

  const text = await readText(envExamplePath);
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const seen = new Set();

  for (const line of lines) {
    if (!line.includes("=")) fail(".env.example lines must be assignments");
    const [name, ...rest] = line.split("=");
    const value = rest.join("=");
    if (seen.has(name)) fail(`.env.example duplicates ${name}`);
    seen.add(name);
    if (value !== "") fail(`.env.example ${name} must have an empty value`);
  }
}

async function assertActiveHtmlHasNoCredentialInputs() {
  for (const filePath of activeHtmlFiles) {
    if (!(await exists(filePath))) continue;
    const text = await readText(filePath);
    for (const { label, pattern } of activeCredentialPatterns) {
      if (pattern.test(text)) fail(`${filePath} must not contain ${label}`);
    }
  }
}

async function assertConditionalInitializationIfPresent(clientText) {
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
    fail("conditional initialization must not commit runtime public config values");
  }
  if (conditional.browser_esm_module_url !== exactConditionalModuleUrl) {
    fail("conditional initialization must use the exact version-pinned ESM URL");
  }
  if (!clientText.includes(exactConditionalModuleUrl)) {
    fail(`${clientPath} must use the exact conditional initialization ESM URL`);
  }
  if (/@supabase\/supabase-js@latest/.test(clientText)) fail(`${clientPath} must not use @latest`);
  if (/@supabase\/supabase-js@2(?:[/"'`?]|$)/.test(clientText)) {
    fail(`${clientPath} must not use a major-only @2 specifier`);
  }
  if (/\bsupabase\.createClient\b/.test(clientText)) {
    fail(`${clientPath} must not use a global supabase.createClient surface`);
  }
}

if (!(await exists(clientPath))) fail(`${clientPath} is missing`);
if (!(await exists(scaffoldPath))) fail(`${scaffoldPath} is missing`);

const scaffold = await readJson(scaffoldPath);
const clientText = await readText(clientPath);

if (scaffold.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  scaffold.generated_for_sub_pass !==
  "§1.2 Supabase Implementation 0.1 — Client Initialization Scaffold"
) {
  fail("generated_for_sub_pass mismatch");
}
if (scaffold.baseline_commit !== "b2f509222f6ac1a3761be39fd057526416d50f07") {
  fail("baseline_commit mismatch");
}
if (scaffold.object_status !== "supabase_client_boundary_scaffold") {
  fail("object_status must be supabase_client_boundary_scaffold");
}
if (scaffold.external_supabase_project_exists !== true) {
  fail("external_supabase_project_exists must be true");
}
if (scaffold.supabase_client_file_created !== true) {
  fail("supabase_client_file_created must be true");
}

assertFalseFlags(scaffold);
assertIncludesAll(
  scaffold.allowed_public_config_names || [],
  expectedPublicConfigNames,
  "allowed_public_config_names"
);
assertIncludesAll(
  scaffold.forbidden_client_config_names || [],
  forbiddenClientConfigNames,
  "forbidden_client_config_names"
);

for (const name of expectedPublicConfigNames) {
  if (!clientText.includes(name)) fail(`${clientPath} must declare ${name}`);
}
for (const name of forbiddenClientConfigNames) {
  if (clientText.includes(name)) fail(`${clientPath} must not contain ${name}`);
}
for (const { label, pattern } of forbiddenClientPatterns) {
  if (pattern.test(clientText)) fail(`${clientPath} contains forbidden ${label}`);
}
await assertConditionalInitializationIfPresent(clientText);

await assertMissing(forbiddenPackageFiles, "package/dependency file");
await assertMissing(forbiddenEnvFiles, "env file");
await assertMissing(forbiddenRouteFiles, "auth/app/protected route file");
await assertEnvExampleValuesEmpty();
await assertActiveHtmlHasNoCredentialInputs();

console.log("direct ui membrane supabase client scaffold ok (0.3 conditional boundary permitted)");
