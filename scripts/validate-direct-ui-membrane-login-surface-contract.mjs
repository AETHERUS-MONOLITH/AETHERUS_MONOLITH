import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";

const runFile = promisify(execFile);

const contractPath = "data/direct-ui-membrane-login-surface-contract.v0.json";
const protectedShellBirthGatePath =
  "data/direct-ui-membrane-protected-shell-birth-gate.v0.json";
const protectedRouteGuardValidator =
  "scripts/validate-direct-ui-membrane-protected-route-guard-contract.mjs";
const supabaseClientScaffoldValidator =
  "scripts/validate-direct-ui-membrane-supabase-client-scaffold.mjs";
const envExamplePath = ".env.example";

const falseFlags = [
  "implementation_performed",
  "supabase_project_created",
  "supabase_dependency_installed",
  "supabase_client_initialized",
  "auth_implemented",
  "login_surface_implemented",
  "login_ui_implemented",
  "signup_ui_implemented",
  "credential_capture_implemented",
  "auth_callback_implemented",
  "protected_routes_implemented",
  "protected_route_guard_implemented",
  "backend_implemented",
  "database_schema_implemented",
  "persistence_implemented",
  "rls_implemented",
  "tenant_isolation_implemented",
  "customer_workspace_implemented"
];

const requiredCredentialFields = ["email", "password"];
const requiredOptionalFlows = ["signup", "password_reset", "mfa"];

const requiredPreconditions = [
  "Supabase client initialization separately authorized",
  "login surface implementation separately authorized",
  "auth callback route implementation separately authorized",
  "protected route guard implementation separately authorized",
  "credential capture validator updated to permit email/password only in the login surface",
  "no signup/account creation unless separately authorized"
];

const forbiddenRouteFiles = [
  "login.html",
  "signin.html",
  "signup.html",
  "app.html",
  "protected-route.html",
  "auth-callback.html",
  "callback.html",
  "auth/callback.html",
  "auth/callback/index.html",
  "app/index.html",
  "app/workspace.html",
  "app/workspace/index.html",
  "app/settings.html",
  "app/settings/index.html"
];

const forbiddenRouteGuardFiles = [
  "js/route-guard.js",
  "js/protected-route-guard.js",
  "js/auth-guard.js",
  "js/session-guard.js",
  "auth/guard.js",
  "app/guard.js",
  "app/route-guard.js",
  "app/protected-route-guard.js"
];

const forbiddenLoginJsFiles = [
  "login.js",
  "signin.js",
  "signup.js",
  "js/login.js",
  "js/signin.js",
  "js/signup.js",
  "js/auth-login.js",
  "js/login-surface.js",
  "auth/login.js",
  "auth/signin.js",
  "auth/signup.js"
];

const forbiddenSupabaseClientFiles = ["js/supabase-client.js"];
const forbiddenPackageFiles = ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"];
const forbiddenEnvFiles = [".env", ".env.local", ".env.production"];

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

const optionalActiveJsFiles = ["js/governance-engine.js", "js/trace-viewer.js"];

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
  "Signin",
  "Signup",
  "Register",
  "Create account",
  "Password",
  "Email",
  "Submit",
  "Save"
];

const protectedOrLoginBehaviorPatterns = [
  /\brequireAuth\b/,
  /\bprotectedRoute\b/,
  /\bprotected route guard\b/i,
  /\bsession verification\b/i,
  /\bredirectToLogin\b/,
  /\bgetSession\s*\(/,
  /\bonAuthStateChange\b/,
  /\bauth\.getSession\b/,
  /\bsignInWithPassword\b/,
  /\bsignUp\s*\(/,
  /\bresetPasswordForEmail\b/,
  /\bcredential capture\b/i
];

const negatedBoundaryPhrases = [
  "No login implementation",
  "No signup implementation",
  "not active authentication",
  "not active",
  "not implemented",
  "reserved",
  "future",
  "requires separate authorization",
  "provider-backed access path",
  "authenticated-surface entry",
  "provider initiation only",
  "not a production SaaS interface or customer workspace",
  "not a production SaaS interface"
];

const newApiCallPatterns = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\/api\//];

const existingValidators = [
  protectedRouteGuardValidator,
  "scripts/validate-direct-ui-membrane-auth-route-callback-contract.mjs",
  "scripts/validate-direct-ui-membrane-supabase-client-initialization-boundary.mjs",
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

async function protectedShellBirthGateOwnsRouteFiles() {
  if (!(await exists(protectedShellBirthGatePath))) return false;
  const birthGate = await readJson(protectedShellBirthGatePath);
  return (
    birthGate.auth_callback_route_implemented === true &&
    birthGate.protected_route_implemented === true &&
    birthGate.protected_shell_entry_implemented === true &&
    birthGate.authenticated_surfaces_birth_gate_implemented === true
  );
}

async function assertForbiddenRoutesMissingOrOwnedByBirthGate() {
  const laterBirthGateOwnsRoutes = await protectedShellBirthGateOwnsRouteFiles();
  const allowedLaterRouteFiles = new Set(["auth-callback.html", "protected-shell.html"]);
  const paths = laterBirthGateOwnsRoutes
    ? forbiddenRouteFiles.filter((filePath) => !allowedLaterRouteFiles.has(filePath))
    : forbiddenRouteFiles;
  await assertMissing(paths, "forbidden login/app/callback/protected route file");
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
  return text.slice(Math.max(0, matchIndex - 120), Math.min(text.length, matchIndex + 170));
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

async function assertActiveFilesHaveNoLoginSurface() {
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
    for (const pattern of protectedOrLoginBehaviorPatterns) {
      if (pattern.test(text)) fail(`${filePath} must not contain login/protected-route behavior`);
    }
    if (filePath.endsWith(".html")) assertNoActiveAuthLabel(filePath, text);
  }
}

async function assertNoNewActiveApiCallsOrLoginSurface() {
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
    .concat(protectedOrLoginBehaviorPatterns)
    .concat(newApiCallPatterns);

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    for (const term of supabaseEnvOrSecretTerms) {
      if (line.includes(term)) fail(`active HTML/JS diff introduces ${term}`);
    }
    for (const pattern of forbiddenDiffPatterns) {
      if (pattern.test(line)) {
        fail(`active HTML/JS diff introduces forbidden login/auth/API surface: ${line.trim()}`);
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
  "§1.2 Backend/Auth Boundary 0.7 — Login Surface Contract / Credential Capture Boundary"
) {
  fail("generated_for_sub_pass mismatch");
}
if (contract.baseline_commit !== "4ab9a5d185bc4c00097db97f9b14ca4771c151db") {
  fail("baseline_commit mismatch");
}
if (contract.object_status !== "login_surface_contract") fail("object_status must be login_surface_contract");
if (contract.selected_stack_boundary !== "supabase_full_boundary") {
  fail("selected_stack_boundary must be supabase_full_boundary");
}

assertFalseBooleans(contract, falseFlags, "login surface contract");

const loginSurface = contract.future_login_surface || {};
if (loginSurface.future_route !== "/login") fail("future_login_surface.future_route must be /login");
if (loginSurface.future_file_or_handler !== "not_created") {
  fail("future_login_surface.future_file_or_handler must be not_created");
}
if (loginSurface.implemented_now !== false) fail("future_login_surface.implemented_now must be false");

const credentialFields = new Map(
  (contract.future_permitted_credential_fields || []).map((field) => [field.field, field])
);
assertIncludesAll([...credentialFields.keys()], requiredCredentialFields, "future_permitted_credential_fields");
for (const fieldName of requiredCredentialFields) {
  const field = credentialFields.get(fieldName);
  if (field.future_allowed !== true) fail(`${fieldName}.future_allowed must be true`);
  if (field.allowed_now !== false) fail(`${fieldName}.allowed_now must be false`);
}

const optionalFlows = new Map((contract.future_optional_auth_flows || []).map((flow) => [flow.flow, flow]));
assertIncludesAll([...optionalFlows.keys()], requiredOptionalFlows, "future_optional_auth_flows");
for (const flowName of requiredOptionalFlows) {
  const flow = optionalFlows.get(flowName);
  if (flow.future_allowed !== true) fail(`${flowName}.future_allowed must be true`);
  if (flow.allowed_now !== false) fail(`${flowName}.allowed_now must be false`);
  if (flow.requires_separate_authorization !== true) {
    fail(`${flowName}.requires_separate_authorization must be true`);
  }
}

assertIncludesAll(
  contract.preconditions_before_login_surface_creation || [],
  requiredPreconditions,
  "preconditions_before_login_surface_creation"
);

await assertForbiddenRoutesMissingOrOwnedByBirthGate();
await assertMissing(forbiddenRouteGuardFiles, "forbidden route guard JS file");
await assertMissing(forbiddenLoginJsFiles, "forbidden login JS file");
await assertSupabaseClientFileIsScaffoldOnly();
await assertMissing(forbiddenPackageFiles, "forbidden package/dependency file");
await assertMissing(forbiddenEnvFiles, "forbidden env file");
await assertEnvExampleEmptyOnly();
await assertActiveFilesHaveNoLoginSurface();
await assertNoNewActiveApiCallsOrLoginSurface();

for (const validator of existingValidators) {
  await runValidator(validator);
}

console.log("direct ui membrane login surface contract ok (login/credential capture not implemented)");
