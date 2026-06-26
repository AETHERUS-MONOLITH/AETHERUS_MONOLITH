import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";

const runFile = promisify(execFile);

const boundaryPath = "data/direct-ui-membrane-supabase-client-initialization-boundary.v0.json";
const envGatePath = "data/direct-ui-membrane-env-secret-hygiene-gate.v0.json";
const supabaseBoundaryPath = "data/direct-ui-membrane-supabase-project-boundary.v0.json";
const docsJsonPath = "data/docs.json";
const envExamplePath = ".env.example";
const futureClientFile = "js/supabase-client.js";
const supabaseClientScaffoldValidator =
  "scripts/validate-direct-ui-membrane-supabase-client-scaffold.mjs";

const publicBrowserEnv = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY"
];

const forbiddenBrowserEnv = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET"
];

const allSupabaseEnvNames = publicBrowserEnv.concat(forbiddenBrowserEnv);

const falseFlags = [
  "implementation_performed",
  "supabase_project_created",
  "supabase_dependency_installed",
  "supabase_client_initialized",
  "supabase_client_file_created",
  "auth_implemented",
  "login_ui_implemented",
  "signup_ui_implemented",
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

const supabaseImportOrInitPatterns = [
  /@supabase\/supabase-js/,
  /from\s+["'][^"']*supabase[^"']*["']/,
  /import\s*\([^)]*["'][^"']*supabase[^"']*["'][^)]*\)/,
  /\bcreateClient\s*\(/,
  /\bsupabase\.createClient\b/,
  /\bnew\s+Supabase\b/i
];

const staticForbiddenPatterns = [
  { label: "form", pattern: /<form\b/i },
  { label: "credential input", pattern: /<input\b[^>]*(?:type|name|id|placeholder)=["'][^"']*(?:email|password|credential)["']/i }
];

const activeAuthLabels = [
  "Login",
  "Sign in",
  "Signup",
  "Register",
  "Create account",
  "Password",
  "Email"
];

const negatedBoundaryPhrases = [
  "No login implementation",
  "No signup implementation",
  "not active authentication",
  "not active",
  "not implemented",
  "reserved",
  "future",
  "provider-backed access path",
  "authenticated-surface entry",
  "provider initiation only",
  "not a production SaaS interface or customer workspace",
  "not a production SaaS interface"
];

const newApiCallPatterns = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\/api\//
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

function assertSameSet(actual, expected, label) {
  const actualSet = new Set(actual || []);
  const expectedSet = new Set(expected);
  if (actualSet.size !== expectedSet.size) {
    fail(`${label}: expected ${expected.length} entries, found ${actualSet.size}`);
  }
  for (const value of expectedSet) {
    if (!actualSet.has(value)) fail(`${label}: missing ${value}`);
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

async function assertEnvExampleEmpty() {
  if (!(await exists(envExamplePath))) return;

  const text = await readText(envExamplePath);
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const seen = new Set();
  for (const line of lines) {
    if (!line.includes("=")) fail(".env.example lines must be assignments");
    const [name, ...rest] = line.split("=");
    const value = rest.join("=");
    if (!allSupabaseEnvNames.includes(name)) fail(`.env.example contains disallowed variable ${name}`);
    if (seen.has(name)) fail(`.env.example duplicates ${name}`);
    seen.add(name);
    if (value !== "") fail(`.env.example ${name} must have an empty value`);
  }
  assertIncludesAll([...seen], allSupabaseEnvNames, ".env.example");
}

function normalizedHtmlText(text) {
  return text
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

function textNear(text, matchIndex) {
  return text.slice(Math.max(0, matchIndex - 100), Math.min(text.length, matchIndex + 150));
}

function assertNoActiveAuthLabel(filePath, text) {
  const normalized = normalizedHtmlText(text);
  for (const label of activeAuthLabels) {
    const pattern = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    for (const match of normalized.matchAll(pattern)) {
      const context = textNear(normalized, match.index || 0);
      if (!negatedBoundaryPhrases.some((phrase) => context.toLowerCase().includes(phrase.toLowerCase()))) {
        fail(`${filePath} contains active-looking auth label without boundary context: ${label}`);
      }
    }
  }
}

async function assertActiveFilesHaveNoSupabaseBoundaryLeak(boundary) {
  assertIncludesAll(
    boundary.active_files_not_allowed_to_initialize_supabase_yet || [],
    activeHtmlJsFiles,
    "active_files_not_allowed_to_initialize_supabase_yet"
  );

  for (const filePath of activeHtmlJsFiles) {
    if (!(await exists(filePath))) fail(`${filePath} is missing`);
    const text = await readText(filePath);

    for (const name of allSupabaseEnvNames) {
      if (text.includes(name)) fail(`${filePath} must not contain ${name}`);
    }
    for (const term of ["service_role", "jwt_secret"]) {
      if (text.includes(term)) fail(`${filePath} must not contain ${term}`);
    }
    for (const pattern of supabaseImportOrInitPatterns) {
      if (pattern.test(text)) fail(`${filePath} must not import or initialize Supabase`);
    }
    for (const { label, pattern } of staticForbiddenPatterns) {
      if (pattern.test(text)) fail(`${filePath} must not contain ${label}`);
    }
    if (filePath.endsWith(".html")) {
      assertNoActiveAuthLabel(filePath, text);
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
    for (const name of allSupabaseEnvNames) {
      if (line.includes(name)) fail(`active HTML/JS diff introduces ${name}`);
    }
    const patterns = supabaseImportOrInitPatterns
      .concat(staticForbiddenPatterns.map((item) => item.pattern))
      .concat(newApiCallPatterns);
    for (const pattern of patterns) {
      if (pattern.test(line)) fail(`active HTML/JS diff introduces forbidden client/runtime surface: ${line.trim()}`);
    }
  }
}

function assertBoundaryReferences(record, label) {
  const reference = record.supabase_client_initialization_boundary || {};
  if (reference.path !== boundaryPath) fail(`${label} must reference ${boundaryPath}`);
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
    if (reference[key] !== false) fail(`${label}.supabase_client_initialization_boundary.${key} must be false`);
  }
}

if (!(await exists(boundaryPath))) fail(`${boundaryPath} is missing`);

const boundary = await readJson(boundaryPath);
const envGate = await readJson(envGatePath);
const supabaseBoundary = await readJson(supabaseBoundaryPath);
const docsJsonText = await readText(docsJsonPath);

if (boundary.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  boundary.generated_for_sub_pass !==
  "§1.2 Backend/Auth Boundary 0.4 — Supabase Client Initialization Boundary"
) {
  fail("generated_for_sub_pass mismatch");
}
if (boundary.baseline_commit !== "c69c7f08067d351399238119351d0db2d7172cc4") {
  fail("baseline_commit mismatch");
}
if (boundary.object_status !== "supabase_client_initialization_boundary") {
  fail("object_status must be supabase_client_initialization_boundary");
}
if (boundary.selected_stack_boundary !== "supabase_full_boundary") {
  fail("selected_stack_boundary must be supabase_full_boundary");
}

assertFalseBooleans(boundary, falseFlags, "supabase client initialization boundary");
if (boundary.environment_source?.env_example_exists !== true) {
  fail("environment_source.env_example_exists must be true");
}
if (boundary.environment_source?.env_values_required_now !== false) {
  fail("environment_source.env_values_required_now must be false");
}
assertSameSet(
  boundary.environment_source?.allowed_future_browser_env,
  publicBrowserEnv,
  "environment_source.allowed_future_browser_env"
);
assertIncludesAll(
  boundary.environment_source?.forbidden_browser_env || [],
  forbiddenBrowserEnv,
  "environment_source.forbidden_browser_env"
);
assertIncludesAll(
  boundary.future_allowed_client_initialization_files || [],
  [futureClientFile],
  "future_allowed_client_initialization_files"
);
assertIncludesAll(
  boundary.future_client_initialization_requirements || [],
  [
    "Supabase project exists outside repository",
    "public client config is supplied through approved environment strategy",
    "service-role and JWT secrets remain server-only",
    "client initialization uses only public config",
    "auth route contract exists before login UI uses the client",
    "RLS dependency remains documented before persistence",
    "validator permits initialization only in authorized client file"
  ],
  "future_client_initialization_requirements"
);
assertIncludesAll(
  boundary.blocked_until_separately_authorized || [],
  [
    "package dependency installation",
    "Supabase client file creation",
    "Supabase client initialization",
    "real login UI",
    "auth callback route",
    "database schema",
    "persistence",
    "tenant isolation"
  ],
  "blocked_until_separately_authorized"
);

const nextCommit = boundary.smallest_truthful_next_commit || {};
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

if (envGate.smallest_truthful_next_commit?.name !== nextCommit.name) {
  fail("env hygiene gate must now point to the 0.5 next commit");
}
assertBoundaryReferences(envGate, "env hygiene gate");
assertBoundaryReferences(supabaseBoundary, "Supabase project boundary");

if (await exists(futureClientFile)) {
  await runFile("node", [supabaseClientScaffoldValidator], {
    stdio: "inherit"
  });
}
await assertMissing(forbiddenPackageFiles, "forbidden package files");
await assertMissing(forbiddenEnvFiles, "forbidden env files");
await assertEnvExampleEmpty();
await assertActiveFilesHaveNoSupabaseBoundaryLeak(boundary);
await assertNoNewForbiddenActiveDiff();

if (docsJsonText.includes("direct-ui-membrane-supabase-client-initialization-boundary")) {
  fail("Supabase client initialization boundary must not be promoted through data/docs.json");
}
if (docsJsonText.includes("validate-direct-ui-membrane-supabase-client-initialization-boundary")) {
  fail("Supabase client initialization validator must not be promoted through data/docs.json");
}

for (const validator of [
  "scripts/validate-direct-ui-membrane-env-secret-hygiene-gate.mjs",
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

console.log("direct ui membrane supabase client initialization boundary ok (no client implementation)");
