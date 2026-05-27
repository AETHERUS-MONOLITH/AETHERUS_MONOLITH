import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);

const boundaryPath = "data/direct-ui-membrane-supabase-project-boundary.v0.json";
const matrixPath = "data/direct-ui-membrane-backend-auth-stack-decision-matrix.v0.json";
const readinessPath = "data/direct-ui-membrane-auth-implementation-readiness-gate.v0.json";
const authBackendPath = "data/direct-ui-membrane-auth-backend-boundary.v0.json";
const docsJsonPath = "data/docs.json";

const falseFlags = [
  "implementation_performed",
  "supabase_project_created",
  "supabase_dependency_installed",
  "auth_implemented",
  "login_ui_implemented",
  "signup_ui_implemented",
  "backend_implemented",
  "database_schema_implemented",
  "persistence_implemented",
  "rls_implemented",
  "tenant_isolation_implemented",
  "billing_implemented",
  "customer_workspace_implemented"
];

const requiredFutureEnvVariables = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET"
];

const requiredServerSecrets = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET"
];

const packageOrEnvFiles = [
  ".env",
  ".env.local",
  ".env.production",
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
  "js/preview-workspace.js",
  "js/app.js",
  "js/docs.js",
  "js/pipeline.js"
];

const supabaseForbiddenInActiveFiles = [
  /SUPABASE/i,
  /supabase/,
  /service_role/,
  /jwt_secret/,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /SUPABASE_JWT_SECRET/
];

const secretLeakPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /SUPABASE_JWT_SECRET/,
  /service_role/,
  /jwt_secret/
];

const dependencyPatterns = [
  /@supabase\/supabase-js/,
  /from\s+["'][^"']*supabase[^"']*["']/,
  /import\s*\([^)]*["'][^"']*supabase[^"']*["'][^)]*\)/,
  /createClient\s*\(/
];

const credentialUiPatterns = [
  /<form\b/i,
  /<input\b[^>]*(?:type|name|id|placeholder)=["'][^"']*(?:email|password|credential)["']/i,
  /\b(?:Login|Sign in|Signup|Register|Create account|Password|Email)\b/,
  /<(?:button|a)\b[^>]*>\s*(?:submit|save|login|sign in|signup|register|create account)\s*</i
];

const newlyIntroducedForbiddenPatterns = [
  /<form\b/i,
  /<input\b[^>]*(?:email|password|credential)/i,
  /\b(?:Login|Sign in|Signup|Register|Create account|Password|Email)\b/,
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

function assertFalseBooleans(record, keys, label) {
  for (const key of keys) {
    if (record[key] !== false) fail(`${label}.${key} must be false`);
  }
}

async function assertMissingFiles(paths) {
  for (const filePath of paths) {
    if (await exists(filePath)) fail(`${filePath} must not exist for this pass`);
  }
}

async function assertActiveFilesHaveNoSupabaseReferences(boundary) {
  for (const filePath of activeHtmlJsFiles) {
    if (!(await exists(filePath))) fail(`${filePath} is missing`);
    const text = await readText(filePath);
    for (const pattern of supabaseForbiddenInActiveFiles) {
      if (pattern.test(text)) fail(`${filePath} must not reference Supabase yet`);
    }
    for (const pattern of secretLeakPatterns) {
      if (pattern.test(text)) fail(`${filePath} must not contain secret reference ${pattern}`);
    }
  }

  assertIncludesAll(
    boundary.files_not_allowed_to_reference_supabase_yet || [],
    activeHtmlJsFiles,
    "files_not_allowed_to_reference_supabase_yet"
  );
}

async function assertNoSupabaseDependencyIntroduced() {
  const filesToScan = [
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

  for (const filePath of filesToScan) {
    if (!(await exists(filePath))) continue;
    const text = await readText(filePath);
    for (const pattern of dependencyPatterns) {
      if (pattern.test(text)) fail(`${filePath} appears to introduce a Supabase dependency`);
    }
  }
}

async function assertNoCredentialUiInReservedAuthSurfaces() {
  for (const filePath of ["workspace.html", "auth-boundary.html", "js/preview-workspace.js"]) {
    const text = await readText(filePath);
    for (const pattern of credentialUiPatterns) {
      if (pattern.test(text)) fail(`${filePath} must not introduce credential capture or auth UI`);
    }
  }
}

async function assertNoForbiddenActiveDiff() {
  let stdout = "";
  try {
    const result = await runFile("git", ["diff", "--", ...activeHtmlJsFiles]);
    stdout = result.stdout || "";
  } catch (error) {
    stdout = error.stdout || "";
  }

  if (!stdout.trim()) return;

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    for (const pattern of newlyIntroducedForbiddenPatterns) {
      if (pattern.test(line)) {
        fail(`active HTML/JS diff introduces forbidden auth/backend surface: ${line.trim()}`);
      }
    }
  }
}

function assertFutureEnvironmentVariables(boundary) {
  const variables = boundary.environment_boundary?.future_environment_variables;
  if (!Array.isArray(variables)) fail("future_environment_variables must be an array");

  const byName = new Map(variables.map((item) => [item.name, item]));
  assertIncludesAll([...byName.keys()], requiredFutureEnvVariables, "future_environment_variables");

  for (const name of requiredFutureEnvVariables) {
    const variable = byName.get(name);
    if (variable.value_present_now !== false) {
      fail(`${name}.value_present_now must be false`);
    }
  }

  for (const name of requiredServerSecrets) {
    const variable = byName.get(name);
    if (variable.classification !== "server_secret") {
      fail(`${name} must be classified as server_secret`);
    }
    if (variable.allowed_in_static_client_later !== false) {
      fail(`${name} must be disallowed in static client later`);
    }
  }

  for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY"]) {
    const variable = byName.get(name);
    if (variable.allowed_in_static_client_later !== true) {
      fail(`${name} must be public-client eligible later`);
    }
  }
}

function assertRecordReferences(record, label) {
  const reference = record.supabase_project_boundary || {};
  if (reference.path !== boundaryPath) fail(`${label} must reference ${boundaryPath}`);
  if (reference.selected_stack_boundary !== "supabase_full_boundary") {
    fail(`${label} Supabase boundary selected stack mismatch`);
  }
  for (const key of [
    "implementation_performed",
    "supabase_project_created",
    "supabase_dependency_installed",
    "auth_implemented",
    "backend_implemented",
    "database_schema_implemented",
    "persistence_implemented",
    "rls_implemented",
    "tenant_isolation_implemented",
    "customer_workspace_implemented"
  ]) {
    if (reference[key] !== false) fail(`${label}.supabase_project_boundary.${key} must be false`);
  }
}

if (!(await exists(boundaryPath))) fail(`${boundaryPath} is missing`);

const boundary = await readJson(boundaryPath);
const matrix = await readJson(matrixPath);
const readiness = await readJson(readinessPath);
const authBackend = await readJson(authBackendPath);
const docsJsonText = await readText(docsJsonPath);

if (boundary.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  boundary.generated_for_sub_pass !==
  "§1.2 Backend/Auth Boundary 0.2 — Supabase Project Boundary Contract"
) {
  fail("generated_for_sub_pass mismatch");
}
if (boundary.baseline_commit !== "56f611342d4e8c96ecf3878ed9bd8f2f88fc6b48") {
  fail("baseline_commit mismatch");
}
if (boundary.object_status !== "supabase_project_boundary_contract") {
  fail("object_status must be supabase_project_boundary_contract");
}
if (boundary.selected_stack_boundary !== "supabase_full_boundary") {
  fail("selected_stack_boundary must be supabase_full_boundary");
}

assertFalseBooleans(boundary, falseFlags, "supabase project boundary");

if (boundary.environment_boundary?.env_file_created !== false) {
  fail("environment_boundary.env_file_created must be false");
}
if (boundary.environment_boundary?.env_example_created !== false) {
  fail("environment_boundary.env_example_created must be false");
}
if (boundary.environment_boundary?.secrets_committed !== false) {
  fail("environment_boundary.secrets_committed must be false");
}

assertFutureEnvironmentVariables(boundary);
assertIncludesAll(
  boundary.allowed_future_client_references || [],
  ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
  "allowed_future_client_references"
);
assertIncludesAll(
  boundary.forbidden_client_references || [],
  requiredServerSecrets.concat(["service_role", "jwt_secret"]),
  "forbidden_client_references"
);
assertIncludesAll(
  boundary.files_allowed_to_reference_supabase_now || [],
  [boundaryPath, "scripts/validate-direct-ui-membrane-supabase-project-boundary.mjs", matrixPath, readinessPath, authBackendPath],
  "files_allowed_to_reference_supabase_now"
);

assertIncludesAll(
  boundary.preconditions_before_supabase_client_config || [],
  [
    "environment naming contract exists",
    "public vs secret configuration classification exists",
    "validator blocks service-role and JWT secret leakage",
    "RLS dependency is documented before anon key use"
  ],
  "preconditions_before_supabase_client_config"
);
assertIncludesAll(
  boundary.preconditions_before_real_login_ui || [],
  [
    "Supabase project created outside repository",
    "environment variables configured outside repository",
    "client initialization boundary implemented without secrets",
    "auth callback/redirect behavior defined",
    "validator allows only public Supabase config in client",
    "login UI introduced only after backend/auth boundary is separately authorized"
  ],
  "preconditions_before_real_login_ui"
);
assertIncludesAll(
  boundary.preconditions_before_database_schema || [],
  [
    "tenant model contract exists",
    "user profile/workspace schema boundary exists",
    "RLS policy contract exists",
    "migration strategy exists",
    "audit event contract exists"
  ],
  "preconditions_before_database_schema"
);
assertIncludesAll(
  boundary.preconditions_before_persistence || [],
  [
    "auth session verification implemented",
    "database schema implemented",
    "RLS policies implemented and tested",
    "tenant context enforcement implemented",
    "audit logging boundary implemented"
  ],
  "preconditions_before_persistence"
);

const nextCommit = boundary.smallest_truthful_next_commit || {};
if (
  nextCommit.name !==
  "§1.2 Backend/Auth Boundary 0.3 — Environment Variable Contract / Secret Hygiene Gate"
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

if (matrix.selected_stack_boundary !== boundary.selected_stack_boundary) {
  fail("stack decision matrix selected_stack_boundary mismatch");
}
if (matrix.implementation_performed !== false) fail("stack decision must remain non-implementation");
if (readiness.auth_implemented !== false || readiness.login_ui_implemented !== false) {
  fail("readiness gate must keep auth/login unimplemented");
}
for (const [key, value] of Object.entries(authBackend.implementation_status || {})) {
  if (value !== "not_implemented") fail(`auth backend implementation_status.${key} must remain not_implemented`);
}

assertRecordReferences(matrix, "stack decision matrix");
assertRecordReferences(readiness, "auth readiness gate");
assertRecordReferences(authBackend, "auth backend boundary");

await assertMissingFiles(packageOrEnvFiles);
await assertActiveFilesHaveNoSupabaseReferences(boundary);
await assertNoSupabaseDependencyIntroduced();
await assertNoCredentialUiInReservedAuthSurfaces();
await assertNoForbiddenActiveDiff();

if (docsJsonText.includes("direct-ui-membrane-supabase-project-boundary")) {
  fail("Supabase project boundary must not be promoted through data/docs.json");
}
if (docsJsonText.includes("validate-direct-ui-membrane-supabase-project-boundary")) {
  fail("Supabase boundary validator must not be promoted through data/docs.json");
}

for (const validator of [
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

console.log("direct ui membrane supabase project boundary ok (contract only, no implementation)");
