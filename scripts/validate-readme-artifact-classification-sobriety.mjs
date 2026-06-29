import fs from "node:fs";

const readmePath = "README.md";
const configPath = "data/readme-artifact-classification-sobriety.v0.json";
const failures = [];

function fail(message) {
  failures.push(message);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\n/).length;
}

function assertIncludes(text, phrase, label) {
  if (!text.toLowerCase().includes(String(phrase).toLowerCase())) {
    fail(`${label} missing required phrase: ${phrase}`);
  }
}

function lineText(text, index) {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end);
}

function isNegatedBoundaryContext(text, index) {
  return /\b(does not imply|does not provide|does not complete|does not claim|not a current claim|not a completed|not current|not operational evidence|not operational use achieved|not public|not instantiated|not runnable|no )\b/i.test(
    lineText(text, index)
  );
}

if (!fs.existsSync(readmePath)) fail(`${readmePath} is missing`);
if (!fs.existsSync(configPath)) fail(`${configPath} is missing`);

const readmeText = fs.existsSync(readmePath) ? readText(readmePath) : "";
const config = fs.existsSync(configPath) ? JSON.parse(readText(configPath)) : {};

if (config.schema_version !== "1.0") fail(`${configPath}: schema_version must be 1.0`);
if (config.target !== readmePath) fail(`${configPath}: target must be ${readmePath}`);

const requiredArtifactClasses = Array.isArray(config.required_artifact_classes)
  ? config.required_artifact_classes
  : [];
const requiredBoundaryPhrases = Array.isArray(config.required_boundary_phrases)
  ? config.required_boundary_phrases
  : [];
const restrictedClaimPatterns = Array.isArray(config.restricted_claim_patterns)
  ? config.restricted_claim_patterns
  : [];

for (const artifactClass of requiredArtifactClasses) {
  assertIncludes(readmeText, artifactClass, readmePath);
}

for (const phrase of requiredBoundaryPhrases) {
  assertIncludes(readmeText, phrase, readmePath);
}

for (const item of restrictedClaimPatterns) {
  if (!item || typeof item !== "object") {
    fail(`${configPath}: restricted_claim_patterns entries must be objects`);
    continue;
  }
  if (!item.id || !item.pattern || !item.reason) {
    fail(`${configPath}: restricted claim pattern is missing id, pattern, or reason`);
    continue;
  }
  const pattern = new RegExp(item.pattern, "i");
  const match = pattern.exec(readmeText);
  if (match) {
    if (isNegatedBoundaryContext(readmeText, match.index)) continue;
    fail(`${item.id}: ${item.reason} at README line ${lineNumber(readmeText, match.index)}`);
  }
}

const requiredDistinctions = [
  "The public surface renders and links selected artifacts",
  "the repository records additional artifacts",
  "the system runs only the browser-side behavior and bounded protected-shell behavior"
];

for (const phrase of requiredDistinctions) {
  assertIncludes(readmeText, phrase, readmePath);
}

const boundary = config.non_implementation_boundary || {};
for (const field of [
  "runtime_behavior_changed",
  "backend_added",
  "database_connected",
  "supabase_migration_applied",
  "operational_use_claimed"
]) {
  if (boundary[field] !== false) {
    fail(`${configPath}: non_implementation_boundary.${field} must be false`);
  }
}

if (failures.length) {
  console.error("README artifact classification sobriety validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("README artifact classification sobriety ok");
console.log(`Artifact classes checked: ${requiredArtifactClasses.length}`);
console.log(`Boundary phrases checked: ${requiredBoundaryPhrases.length}`);
