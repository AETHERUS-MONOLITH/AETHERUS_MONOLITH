import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";

const runFile = promisify(execFile);

const gatePath = "data/direct-ui-membrane-env-secret-hygiene-gate.v0.json";
const supabaseBoundaryPath = "data/direct-ui-membrane-supabase-project-boundary.v0.json";
const supabaseClientBoundaryPath = "data/direct-ui-membrane-supabase-client-initialization-boundary.v0.json";
const supabaseClientScaffoldValidator =
  "scripts/validate-direct-ui-membrane-supabase-client-scaffold.mjs";
const docsJsonPath = "data/docs.json";
const envExamplePath = ".env.example";

const requiredEnvNames = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET"
];

const publicEnvNames = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY"
];

const serverSecretEnvNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET"
];

const falseFlags = [
  "implementation_performed",
  "supabase_project_created",
  "supabase_dependency_installed",
  "supabase_client_initialized",
  "auth_implemented",
  "backend_implemented",
  "database_schema_implemented",
  "persistence_implemented",
  "rls_implemented",
  "tenant_isolation_implemented",
  "env_files_created",
  "secrets_committed"
];

const forbiddenEnvFiles = [
  ".env",
  ".env.local",
  ".env.production"
];

const forbiddenPackageFiles = [
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml"
];

const activeHtmlJsFiles = [
  "index.html",
  "membrane.html",
  "workspace.html",
  "auth-boundary.html",
  "js/app.js",
  "js/docs.js",
  "js/pipeline.js",
  "js/preview-workspace.js"
];

const optionalActiveJsFiles = [
  "js/governance-engine.js",
  "js/trace-viewer.js"
];

const secretTerms = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "service_role",
  "jwt_secret"
];

const supabaseClientPatterns = [
  /@supabase\/supabase-js/,
  /\bcreateClient\s*\(/,
  /\bsupabase\.createClient\b/,
  /from\s+["'][^"']*supabase[^"']*["']/,
  /import\s*\([^)]*["'][^"']*supabase[^"']*["'][^)]*\)/
];

const activeSurfacePatterns = [
  { label: "form", pattern: /<form\b/i },
  { label: "credential input", pattern: /<input\b[^>]*(?:type|name|id|placeholder)=["'][^"']*(?:email|password|credential)["']/i },
  { label: "auth UI copy", pattern: /\b(?:Login|Sign in|Signup|Register|Create account|Password|Email)\b/ }
];

const newApiCallPatterns = [
  { label: "fetch", pattern: /\bfetch\s*\(/ },
  { label: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
  { label: "api route", pattern: /\/api\// }
];

const fakeOrRealSecretPatterns = [
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /sb_(?:service|secret|anon)_[A-Za-z0-9_-]+/i,
  /service[_-]?role[_-]?[A-Za-z0-9_-]{8,}/i,
  /https:\/\/[A-Za-z0-9-]+\.supabase\.co/i,
  /placeholder/i,
  /changeme/i,
  /example/i,
  /fake/i,
  /dummy/i
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

function assertAllowedEnvironmentVariables(gate) {
  const variables = gate.allowed_future_environment_variables;
  if (!Array.isArray(variables)) fail("allowed_future_environment_variables must be an array");

  const byName = new Map(variables.map((variable) => [variable.name, variable]));
  assertIncludesAll([...byName.keys()], requiredEnvNames, "allowed_future_environment_variables");

  for (const name of requiredEnvNames) {
    const variable = byName.get(name);
    if (variable.value_allowed_now !== false) fail(`${name}.value_allowed_now must be false`);
    if (variable.allowed_in_env_example !== true) fail(`${name}.allowed_in_env_example must be true`);
  }

  for (const name of publicEnvNames) {
    const variable = byName.get(name);
    if (!variable.classification.startsWith("public_client_config")) {
      fail(`${name} must be classified as public client config`);
    }
    if (variable.allowed_in_browser_later !== true) {
      fail(`${name}.allowed_in_browser_later must be true`);
    }
  }

  for (const name of serverSecretEnvNames) {
    const variable = byName.get(name);
    if (variable.classification !== "server_secret") {
      fail(`${name} must be classified as server_secret`);
    }
    if (variable.allowed_in_browser_later !== false) {
      fail(`${name}.allowed_in_browser_later must be false`);
    }
  }
}

async function assertEnvExample(gate) {
  if (gate.env_example_created !== true) {
    if (await exists(envExamplePath)) fail(".env.example exists but gate.env_example_created is not true");
    return;
  }

  if (gate.env_example_policy?.allowed !== true) fail("env_example_policy.allowed must be true");
  if (gate.env_example_policy?.values_must_be_empty !== true) {
    fail("env_example_policy.values_must_be_empty must be true");
  }
  if (gate.env_example_policy?.placeholder_values_forbidden !== true) {
    fail("env_example_policy.placeholder_values_forbidden must be true");
  }
  if (gate.env_example_policy?.fake_keys_forbidden !== true) {
    fail("env_example_policy.fake_keys_forbidden must be true");
  }
  if (!(await exists(envExamplePath))) fail(".env.example must exist when env_example_created is true");

  const text = await readText(envExamplePath);
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const seen = new Set();

  for (const line of lines) {
    if (!line.includes("=")) fail(".env.example lines must be assignments");
    const [name, ...rest] = line.split("=");
    const value = rest.join("=");
    if (!requiredEnvNames.includes(name)) fail(`.env.example contains disallowed variable ${name}`);
    if (seen.has(name)) fail(`.env.example duplicates ${name}`);
    seen.add(name);
    if (value !== "") fail(`.env.example ${name} must have an empty value`);
  }

  assertIncludesAll([...seen], requiredEnvNames, ".env.example");
  for (const pattern of fakeOrRealSecretPatterns) {
    if (pattern.test(text)) fail(`.env.example contains forbidden placeholder/secret pattern ${pattern}`);
  }
}

async function assertActiveFilesClean(gate) {
  assertIncludesAll(
    gate.files_forbidden_to_contain_supabase_env_names_now || [],
    activeHtmlJsFiles,
    "files_forbidden_to_contain_supabase_env_names_now"
  );

  for (const filePath of activeHtmlJsFiles) {
    if (!(await exists(filePath))) fail(`${filePath} is missing`);
    const text = await readText(filePath);
    for (const name of requiredEnvNames) {
      if (text.includes(name)) fail(`${filePath} must not contain ${name}`);
    }
    for (const term of secretTerms) {
      if (text.includes(term)) fail(`${filePath} must not contain ${term}`);
    }
    for (const pattern of supabaseClientPatterns) {
      if (pattern.test(text)) fail(`${filePath} must not contain Supabase client initialization`);
    }
    for (const { label, pattern } of activeSurfacePatterns) {
      if (pattern.test(text)) fail(`${filePath} must not contain ${label}`);
    }
  }
}

async function assertNoNewForbiddenActiveDiff() {
  let stdout = "";
  try {
    const result = await runFile("git", ["diff", "--", ...activeHtmlJsFiles, ...optionalActiveJsFiles]);
    stdout = result.stdout || "";
  } catch (error) {
    stdout = error.stdout || "";
  }

  if (!stdout.trim()) return;

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    for (const name of requiredEnvNames) {
      if (line.includes(name)) fail(`active HTML/JS diff introduces ${name}`);
    }
    const diffOnlyPatterns = activeSurfacePatterns
      .concat(newApiCallPatterns)
      .map((item) => item.pattern);
    for (const pattern of [...supabaseClientPatterns, ...diffOnlyPatterns]) {
      if (pattern.test(line)) fail(`active HTML/JS diff introduces forbidden runtime surface: ${line.trim()}`);
    }
  }
}

if (!(await exists(gatePath))) fail(`${gatePath} is missing`);

const gate = await readJson(gatePath);
const supabaseBoundary = await readJson(supabaseBoundaryPath);
const docsJsonText = await readText(docsJsonPath);

if (gate.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  gate.generated_for_sub_pass !==
  "§1.2 Backend/Auth Boundary 0.3 — Environment Variable Contract / Secret Hygiene Gate"
) {
  fail("generated_for_sub_pass mismatch");
}
if (gate.baseline_commit !== "878281b10944951a9a348e777723bef7d06e6e7f") {
  fail("baseline_commit mismatch");
}
if (gate.object_status !== "env_secret_hygiene_gate") fail("object_status mismatch");
if (gate.selected_stack_boundary !== "supabase_full_boundary") {
  fail("selected_stack_boundary must be supabase_full_boundary");
}

assertFalseBooleans(gate, falseFlags, "env secret hygiene gate");
assertAllowedEnvironmentVariables(gate);
assertIncludesAll(
  gate.files_allowed_to_mention_env_names_now || [],
  [gatePath, supabaseBoundaryPath, "scripts/validate-direct-ui-membrane-env-secret-hygiene-gate.mjs", "scripts/validate-direct-ui-membrane-supabase-project-boundary.mjs", envExamplePath],
  "files_allowed_to_mention_env_names_now"
);
assertIncludesAll(
  gate.forbidden_committed_patterns || [],
  [
    "real_supabase_project_url",
    "supabase_service_role_value",
    "jwt_secret_value",
    "non_empty_env_assignment",
    "fake_key_that_looks_real",
    "hardcoded_supabase_client_initialization"
  ],
  "forbidden_committed_patterns"
);
assertIncludesAll(
  gate.preconditions_before_supabase_client_initialization || [],
  [
    "Supabase project exists outside repository",
    "environment variables configured outside repository",
    "client config strategy selected",
    "anon key usage boundary validated",
    "service-role key prohibited from browser/static files"
  ],
  "preconditions_before_supabase_client_initialization"
);
assertIncludesAll(
  gate.preconditions_before_real_auth || [],
  [
    "Supabase client initialization separately authorized",
    "auth callback/redirect contract exists",
    "login UI separately authorized",
    "credential capture validator updated",
    "no persistence until database/RLS boundary exists"
  ],
  "preconditions_before_real_auth"
);

const nextCommit = gate.smallest_truthful_next_commit || {};
if (
  nextCommit.name !==
  "§1.2 Backend/Auth Boundary 0.5 — Auth Route Contract / Callback Boundary"
) {
  fail("smallest_truthful_next_commit.name mismatch");
}
assertIncludesAll(
  nextCommit.must_not_implement || [],
  [
    "real login",
    "credential capture",
    "Supabase dependency install",
    "database schema",
    "persistence",
    "tenant isolation",
    "customer workspace"
  ],
  "smallest_truthful_next_commit.must_not_implement"
);

const clientBoundaryReference = gate.supabase_client_initialization_boundary || {};
if (clientBoundaryReference.path !== supabaseClientBoundaryPath) {
  fail("env hygiene gate must reference Supabase client initialization boundary");
}
for (const key of [
  "implementation_performed",
  "supabase_project_created",
  "supabase_dependency_installed",
  "supabase_client_initialized",
  "supabase_client_file_created",
  "auth_implemented",
  "backend_implemented",
  "database_schema_implemented",
  "persistence_implemented",
  "rls_implemented",
  "tenant_isolation_implemented"
]) {
  if (clientBoundaryReference[key] !== false) {
    fail(`supabase_client_initialization_boundary.${key} must be false`);
  }
}

if (supabaseBoundary.env_secret_hygiene_gate?.path !== gatePath) {
  fail("Supabase project boundary must reference env secret hygiene gate");
}
if (supabaseBoundary.env_secret_hygiene_gate?.env_example_created !== gate.env_example_created) {
  fail("Supabase boundary env example state must match hygiene gate");
}
if (supabaseBoundary.environment_boundary?.env_example_created !== gate.env_example_created) {
  fail("Supabase environment boundary env_example_created must match hygiene gate");
}
if (supabaseBoundary.environment_boundary?.secrets_committed !== false) {
  fail("Supabase boundary must keep secrets_committed false");
}

await assertMissing(forbiddenEnvFiles, "forbidden env files");
await assertMissing(forbiddenPackageFiles, "forbidden package files");
await assertEnvExample(gate);
if (await exists("js/supabase-client.js")) {
  await runFile("node", [supabaseClientScaffoldValidator], {
    stdio: "inherit"
  });
}
await assertActiveFilesClean(gate);
await assertNoNewForbiddenActiveDiff();

if (docsJsonText.includes("direct-ui-membrane-env-secret-hygiene-gate")) {
  fail("env secret hygiene gate must not be promoted through data/docs.json");
}
if (docsJsonText.includes("validate-direct-ui-membrane-env-secret-hygiene-gate")) {
  fail("env secret hygiene validator must not be promoted through data/docs.json");
}

for (const validator of [
  "scripts/validate-direct-ui-membrane-supabase-project-boundary.mjs",
  "scripts/validate-direct-ui-membrane-backend-auth-stack-decision-matrix.mjs",
  "scripts/validate-direct-ui-membrane-auth-implementation-readiness-gate.mjs",
  "scripts/validate-direct-ui-membrane-auth-route-boundary.mjs",
  "scripts/validate-direct-ui-membrane-preview-workspace.mjs",
  "scripts/validate-direct-ui-membrane-static-shell.mjs",
  "scripts/validate-documentation-surface-inventory.mjs",
  "scripts/validate-track3-contracts.mjs"
]) {
  await runFile("node", [validator], {
    stdio: "inherit"
  });
}

console.log("direct ui membrane env secret hygiene gate ok (names only, no secrets)");
