import fs from "node:fs/promises";

const recordPath = "data/direct-ui-membrane-pages-runtime-config-deployment.v0.json";
const workflowPath = ".github/workflows/pages-runtime-config.yml";
const runtimeConfigArtifactPath = "js/aetherus-runtime-config.js";
const runtimeConfigSourcePath = runtimeConfigArtifactPath;
const envExamplePath = ".env.example";

const authPages = [
  {
    page: "auth-login.html",
    runtimeScript: runtimeConfigArtifactPath,
    authModule: "js/supabase-login-surface.js"
  },
  {
    page: "auth-callback.html",
    runtimeScript: runtimeConfigArtifactPath,
    authModule: "js/supabase-auth-callback.js"
  },
  {
    page: "protected-shell.html",
    runtimeScript: runtimeConfigArtifactPath,
    authModule: "js/supabase-protected-shell.js"
  }
];

const requiredVars = [
  "vars.AETHERUS_SUPABASE_URL",
  "vars.AETHERUS_SUPABASE_PUBLISHABLE_KEY"
];

const forbiddenEnvFiles = [
  ".env",
  ".env.local",
  ".env.production"
];

const forbiddenValuePatterns = [
  { label: "Supabase project URL", pattern: /https:\/\/[A-Za-z0-9-]+\.supabase\.co/i },
  { label: "Supabase key-like value", pattern: /\bsb_(?:publishable|anon|secret|service)_[A-Za-z0-9_-]{8,}/i },
  { label: "JWT-like token", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { label: "OAuth token-like value", pattern: /\bgh[opsu]_[A-Za-z0-9_]{20,}/ },
  { label: "OAuth client secret label", pattern: /GITHUB_OAUTH_CLIENT_SECRET|OAUTH_CLIENT_SECRET/ }
];

const falseRecordFlags = [
  "github_pages_source_actions_setting_verified"
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

async function assertMissing(paths, label) {
  for (const filePath of paths) {
    if (await exists(filePath)) fail(`${label}: ${filePath} must not exist`);
  }
}

function assertWorkflowStaticStructure(workflowText) {
  for (const snippet of [
    "on:",
    "workflow_dispatch:",
    "contents: read",
    "actions: read",
    "pages: write",
    "id-token: write",
    "environment:",
    "name: github-pages",
    "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683",
    "actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b",
    "git archive --format=tar \"$GITHUB_SHA\" | tar -x -C _site",
    "actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa",
    "actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e"
  ]) {
    if (!workflowText.includes(snippet)) fail(`${workflowPath} missing ${snippet}`);
  }

  for (const variable of requiredVars) {
    if (!workflowText.includes(variable)) fail(`${workflowPath} missing ${variable}`);
  }

  if (!workflowText.includes('"_site/js/aetherus-runtime-config.js"')) {
    fail(`${workflowPath} must generate runtime config only in _site`);
  }
  if (!workflowText.includes("globalThis.AETHERUS_SUPABASE_PUBLIC_CONFIG")) {
    fail(`${workflowPath} must assign the expected runtime public config global`);
  }
  if (!workflowText.includes("SUPABASE_URL") || !workflowText.includes("SUPABASE_PUBLISHABLE_KEY")) {
    fail(`${workflowPath} must emit accepted public config field names`);
  }
  if (!workflowText.includes("throw new Error")) {
    fail(`${workflowPath} must fail closed when required variables are absent`);
  }
  if (!workflowText.includes("Missing required GitHub Actions repository variable:")) {
    fail(`${workflowPath} must report missing variable names without values`);
  }
  if (workflowText.includes("SUPABASE_ANON_KEY")) {
    fail(`${workflowPath} must not generate fallback anon key config in this pass`);
  }
}

function scriptIndex(html, scriptPath) {
  return html.indexOf(`src="${scriptPath}"`);
}

async function assertAuthPageScriptOrder() {
  for (const { page, runtimeScript, authModule } of authPages) {
    const html = await readText(page);
    const runtimeIndex = scriptIndex(html, runtimeScript);
    const moduleIndex = scriptIndex(html, authModule);
    if (runtimeIndex === -1) fail(`${page} must load ${runtimeScript}`);
    if (moduleIndex === -1) fail(`${page} must load ${authModule}`);
    if (runtimeIndex > moduleIndex) {
      fail(`${page} must load ${runtimeScript} before ${authModule}`);
    }
  }
}

async function assertEnvExampleEmpty() {
  const text = await readText(envExamplePath);
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  for (const line of lines) {
    if (!line.includes("=")) fail(".env.example lines must be assignments");
    const [name, ...rest] = line.split("=");
    const value = rest.join("=");
    if (!name.startsWith("SUPABASE_")) fail(`.env.example contains disallowed name ${name}`);
    if (value !== "") fail(`.env.example ${name} must remain empty-valued`);
  }
}

async function assertNoCommittedValues() {
  const filesToCheck = [
    workflowPath,
    recordPath,
    "auth-login.html",
    "auth-callback.html",
    "protected-shell.html"
  ];

  for (const filePath of filesToCheck) {
    const text = (await readText(filePath)).replaceAll(
      "https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-operator-resolution-v0",
      "FIXED_GOVERNANCE_EDGE_FUNCTION"
    );
    for (const { label, pattern } of forbiddenValuePatterns) {
      if (pattern.test(text)) fail(`${filePath} contains forbidden ${label}`);
    }
  }
}

if (!(await exists(recordPath))) fail(`${recordPath} is missing`);
if (!(await exists(workflowPath))) fail(`${workflowPath} is missing`);
if (await exists(runtimeConfigSourcePath)) {
  fail(`${runtimeConfigSourcePath} must not be committed as repository source`);
}

const record = await readJson(recordPath);
const workflowText = await readText(workflowPath);

if (record.schema_version !== "0.1") fail("schema_version must be 0.1");
if (
  record.generated_for_sub_pass !==
  "§1.2 Supabase Deployment Mechanism 0.1 — GitHub Pages Actions Runtime Config Artifact"
) {
  fail("generated_for_sub_pass mismatch");
}
if (record.baseline_commit !== "770b7a407a63e104e8006fea16d6ba873e9fdbfc") {
  fail("baseline_commit mismatch");
}
if (record.object_status !== "pages_runtime_config_deployment_mechanism") {
  fail("object_status mismatch");
}
for (const flag of falseRecordFlags) {
  if (record[flag] !== false) fail(`${recordPath}.${flag} must be false`);
}
for (const flag of [
  "implementation_performed",
  "workflow_added",
  "github_pages_actions_deployment_mechanism_added",
  "github_pages_source_actions_setting_required",
  "runtime_config_generated_only_in_deployment_artifact",
  "github_actions_repository_variables_assumed_present",
  "auth_pages_updated"
]) {
  if (record[flag] !== true) fail(`${recordPath}.${flag} must be true`);
}
if (record.workflow_path !== workflowPath) fail("workflow_path mismatch");
if (record.runtime_config_artifact_path !== runtimeConfigArtifactPath) {
  fail("runtime_config_artifact_path mismatch");
}
if (record.runtime_config_source_file_committed !== false) {
  fail("runtime_config_source_file_committed must be false");
}
if (record.runtime_public_config_global !== "AETHERUS_SUPABASE_PUBLIC_CONFIG") {
  fail("runtime_public_config_global mismatch");
}
assertIncludesAll(
  record.required_github_actions_repository_variables || [],
  ["AETHERUS_SUPABASE_URL", "AETHERUS_SUPABASE_PUBLISHABLE_KEY"],
  "required_github_actions_repository_variables"
);
assertIncludesAll(
  record.accepted_public_config_names || [],
  ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"],
  "accepted_public_config_names"
);
if (record.fallback_public_config_name !== "SUPABASE_ANON_KEY") {
  fail("fallback_public_config_name must remain SUPABASE_ANON_KEY");
}

const workflowBehavior = record.workflow_behavior || {};
for (const flag of [
  "allows_workflow_dispatch",
  "uses_least_pages_permissions",
  "uses_github_pages_environment",
  "checks_out_repository_source",
  "stages_static_site_from_git_archive",
  "generates_runtime_config_from_vars",
  "fails_closed_when_required_variables_absent",
  "does_not_print_runtime_config_values",
  "uploads_pages_artifact",
  "deploys_pages_artifact"
]) {
  if (workflowBehavior[flag] !== true) fail(`workflow_behavior.${flag} must be true`);
}
if (workflowBehavior.runs_on_push_to_main !== false) {
  fail("workflow_behavior.runs_on_push_to_main must be false");
}

const valueBoundary = record.secret_and_value_boundary || {};
for (const flag of [
  "actual_supabase_values_committed",
  "fake_or_placeholder_key_values_committed",
  "runtime_public_config_values_committed",
  "env_files_created",
  "oauth_client_secret_committed",
  "oauth_token_committed",
  "session_token_committed"
]) {
  if (valueBoundary[flag] !== false) fail(`secret_and_value_boundary.${flag} must be false`);
}
if (valueBoundary.env_example_values_remain_empty !== true) {
  fail("env_example_values_remain_empty must be true");
}

const absence = record.runtime_absence_behavior || {};
if (absence.absent_config_behavior_preserved !== true) {
  fail("absent_config_behavior_preserved must be true");
}

const verification = record.verification_scope || {};
for (const flag of [
  "live_auth_verification_performed",
  "provider_login_verified",
  "callback_session_recognition_verified",
  "protected_shell_admission_verified",
  "authenticated_surfaces_born"
]) {
  if (verification[flag] !== false) fail(`verification_scope.${flag} must be false`);
}

for (const entry of record.runtime_config_load_order || []) {
  if (entry.runtime_config_before_auth_module !== true) {
    fail(`${entry.page} runtime config order must be true`);
  }
}

assertWorkflowStaticStructure(workflowText);
await assertAuthPageScriptOrder();
await assertMissing(forbiddenEnvFiles, "env file");
await assertEnvExampleEmpty();
await assertNoCommittedValues();

console.log("direct ui membrane Pages runtime config deployment mechanism ok");
