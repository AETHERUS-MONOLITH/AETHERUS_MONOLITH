import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);

const contractPath = "data/direct-ui-membrane-auth-route-callback-contract.v0.json";
const protectedRouteGuardContractPath =
  "data/direct-ui-membrane-protected-route-guard-contract.v0.json";
const supabaseClientBoundaryValidator =
  "scripts/validate-direct-ui-membrane-supabase-client-initialization-boundary.mjs";
const supabaseClientScaffoldValidator =
  "scripts/validate-direct-ui-membrane-supabase-client-scaffold.mjs";
const envExamplePath = ".env.example";

const falseFlags = [
  "implementation_performed",
  "supabase_project_created",
  "supabase_dependency_installed",
  "supabase_client_initialized",
  "auth_implemented",
  "login_ui_implemented",
  "signup_ui_implemented",
  "auth_callback_implemented",
  "protected_routes_implemented",
  "backend_implemented",
  "database_schema_implemented",
  "persistence_implemented",
  "rls_implemented",
  "tenant_isolation_implemented",
  "customer_workspace_implemented"
];

const requiredCurrentRoutes = [
  "index.html",
  "membrane.html",
  "workspace.html",
  "auth-boundary.html"
];

const requiredFutureAuthRoutes = [
  "/auth/callback",
  "/app"
];

const forbiddenRouteFiles = [
  "auth-callback.html",
  "callback.html",
  "protected-route.html",
  "app.html",
  "auth/callback.html",
  "auth/callback/index.html",
  "app/index.html",
  "app/workspace.html",
  "app/workspace/index.html",
  "app/settings.html",
  "app/settings/index.html"
];

const forbiddenSupabaseClientFiles = [
  "js/supabase-client.js"
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

const expectedEnvExampleNames = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET"
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

const supabaseEnvOrSecretTerms = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "service_role",
  "jwt_secret"
];

const activeSurfacePatterns = [
  { label: "form", pattern: /<form\b/i },
  { label: "credential input", pattern: /<input\b[^>]*(?:type|name|id|placeholder)=["'][^"']*(?:email|password|credential)["']/i },
  { label: "password input", pattern: /<input\b[^>]*type=["']password["']/i },
  { label: "email input", pattern: /<input\b[^>]*type=["']email["']/i }
];

const activeAuthLabels = [
  "Login",
  "Sign in",
  "Signup",
  "Register",
  "Create account",
  "Password",
  "Email",
  "Submit",
  "Save"
];

const negatedBoundaryPhrases = [
  "No login implementation",
  "No signup implementation",
  "not active authentication",
  "not active",
  "not implemented",
  "reserved",
  "future",
  "requires separate authorization"
];

const newApiCallPatterns = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\/api\//
];

const existingValidators = [
  "scripts/validate-direct-ui-membrane-env-secret-hygiene-gate.mjs",
  "scripts/validate-direct-ui-membrane-supabase-project-boundary.mjs",
  "scripts/validate-direct-ui-membrane-backend-auth-stack-decision-matrix.mjs",
  "scripts/validate-direct-ui-membrane-auth-implementation-readiness-gate.mjs",
  "scripts/validate-direct-ui-membrane-auth-route-boundary.mjs",
  "scripts/validate-direct-ui-membrane-preview-workspace.mjs",
  "scripts/validate-direct-ui-membrane-static-shell.mjs",
  "scripts/validate-documentation-public-registry-label-decision.mjs",
  "scripts/validate-documentation-operator-review-queue.mjs",
  "scripts/validate-documentation-rename-risk-register.mjs",
  "scripts/validate-documentation-public-navigation-pruning.mjs",
  "scripts/validate-documentation-surface-routing-plan.mjs",
  "scripts/validate-documentation-surface-inventory.mjs",
  "scripts/validate-track3-contracts.mjs"
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

function normalizedHtmlText(text) {
  return text.replace(/&mdash;/g, "—").replace(/\s+/g, " ");
}

function textNear(text, matchIndex) {
  return text.slice(Math.max(0, matchIndex - 110), Math.min(text.length, matchIndex + 160));
}

function assertNoActiveAuthLabel(filePath, text) {
  const normalized = normalizedHtmlText(text);
  for (const label of activeAuthLabels) {
    const pattern = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    for (const match of normalized.matchAll(pattern)) {
      const context = textNear(normalized, match.index || 0);
      if (!negatedBoundaryPhrases.some((phrase) => context.toLowerCase().includes(phrase.toLowerCase()))) {
        fail(`${filePath} contains active-looking auth/control label without boundary context: ${label}`);
      }
    }
  }
}

async function assertEnvExampleEmptyOnly() {
  if (!(await exists(envExamplePath))) return;

  const text = await readText(envExamplePath);
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const seen = new Set();

  for (const line of lines) {
    if (!line.includes("=")) fail(".env.example lines must be assignments");
    const [name, ...rest] = line.split("=");
    const value = rest.join("=");
    if (!expectedEnvExampleNames.includes(name)) fail(`.env.example contains disallowed variable ${name}`);
    if (seen.has(name)) fail(`.env.example duplicates ${name}`);
    seen.add(name);
    if (value !== "") fail(`.env.example ${name} must have an empty value`);
  }

  assertIncludesAll([...seen], expectedEnvExampleNames, ".env.example");
}

async function assertActiveFilesHaveNoAuthImplementationSurface() {
  for (const filePath of activeHtmlJsFiles.concat(optionalActiveJsFiles)) {
    if (!(await exists(filePath))) continue;
    const text = await readText(filePath);

    for (const term of supabaseEnvOrSecretTerms) {
      if (text.includes(term)) fail(`${filePath} must not contain ${term}`);
    }
    for (const pattern of supabaseImportOrInitPatterns) {
      if (pattern.test(text)) fail(`${filePath} must not import or initialize Supabase`);
    }
    for (const { label, pattern } of activeSurfacePatterns) {
      if (pattern.test(text)) fail(`${filePath} must not contain ${label}`);
    }
    if (filePath.endsWith(".html")) assertNoActiveAuthLabel(filePath, text);
  }
}

async function assertNoNewActiveApiCallsOrAuthSurface() {
  const diffTargets = activeHtmlJsFiles.concat(optionalActiveJsFiles);
  let stdout = "";
  try {
    const result = await runFile("git", ["diff", "--", ...diffTargets]);
    stdout = result.stdout || "";
  } catch (error) {
    stdout = error.stdout || "";
  }

  if (!stdout.trim()) return;

  const forbiddenDiffPatterns = supabaseImportOrInitPatterns
    .concat(activeSurfacePatterns.map((item) => item.pattern))
    .concat(newApiCallPatterns);

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    for (const term of supabaseEnvOrSecretTerms) {
      if (line.includes(term)) fail(`active HTML/JS diff introduces ${term}`);
    }
    for (const pattern of forbiddenDiffPatterns) {
      if (pattern.test(line)) {
        fail(`active HTML/JS diff introduces forbidden callback/auth/API surface: ${line.trim()}`);
      }
    }
  }
}

async function runValidator(filePath) {
  await runFile("node", [filePath], {
    stdio: "inherit"
  });
}

async function assertSupabaseClientFileIsScaffoldOnly() {
  if (!(await exists("js/supabase-client.js"))) return;
  await runValidator(supabaseClientScaffoldValidator);
}

if (!(await exists(contractPath))) fail(`${contractPath} is missing`);

const contract = await readJson(contractPath);

if (contract.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  contract.generated_for_sub_pass !==
  "§1.2 Backend/Auth Boundary 0.5 — Auth Route Contract / Callback Boundary"
) {
  fail("generated_for_sub_pass mismatch");
}
if (contract.baseline_commit !== "3ef8cae41b037d8cec7a53102fe20cff4f0350eb") {
  fail("baseline_commit mismatch");
}
if (contract.object_status !== "auth_route_callback_contract") {
  fail("object_status must be auth_route_callback_contract");
}
if (contract.selected_stack_boundary !== "supabase_full_boundary") {
  fail("selected_stack_boundary must be supabase_full_boundary");
}

assertFalseBooleans(contract, falseFlags, "auth route callback contract");

const currentRoutes = (contract.current_routes || []).map((entry) => entry.route);
assertIncludesAll(currentRoutes, requiredCurrentRoutes, "current_routes");

const futureAuthRoutes = (contract.future_auth_routes || []).map((entry) => entry.route);
assertIncludesAll(futureAuthRoutes, requiredFutureAuthRoutes, "future_auth_routes");

for (const entry of contract.future_auth_routes || []) {
  if (entry.implemented_now !== false) {
    fail(`future_auth_routes ${entry.route} must have implemented_now false`);
  }
}

assertIncludesAll(
  contract.route_classification?.future_callback_routes || [],
  ["/auth/callback"],
  "route_classification.future_callback_routes"
);
assertIncludesAll(
  contract.route_classification?.future_protected_routes || [],
  ["/app", "/app/workspace", "/app/settings"],
  "route_classification.future_protected_routes"
);

const protectedRouteGuardContract = contract.protected_route_guard_contract || {};
if (protectedRouteGuardContract.path !== protectedRouteGuardContractPath) {
  fail(`protected_route_guard_contract.path must be ${protectedRouteGuardContractPath}`);
}
for (const key of [
  "implementation_performed",
  "protected_routes_implemented",
  "protected_route_guard_implemented",
  "auth_callback_implemented"
]) {
  if (protectedRouteGuardContract[key] !== false) {
    fail(`protected_route_guard_contract.${key} must be false`);
  }
}

await assertMissing(forbiddenRouteFiles, "forbidden callback/protected route file");
await assertSupabaseClientFileIsScaffoldOnly();
await assertMissing(forbiddenPackageFiles, "forbidden package/dependency file");
await assertMissing(forbiddenEnvFiles, "forbidden env file");
await assertEnvExampleEmptyOnly();
await assertActiveFilesHaveNoAuthImplementationSurface();
await assertNoNewActiveApiCallsOrAuthSurface();

await runValidator(supabaseClientBoundaryValidator);
for (const validator of existingValidators) {
  await runValidator(validator);
}

console.log("direct ui membrane auth route callback contract ok (callback/protected routes not implemented)");
