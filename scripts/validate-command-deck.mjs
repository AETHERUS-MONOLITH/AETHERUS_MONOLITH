import fs from "node:fs";

const indexPath = "index.html";
const scriptPath = "js/trace-viewer.js";
const cssPath = "css/style.css";

const failures = [];

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function fail(message) {
  failures.push(message);
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) fail(`${label}: missing "${needle}"`);
}

function assertNotIncludes(text, needle, label) {
  if (text.includes(needle)) fail(`${label}: must not include "${needle}"`);
}

function assertPattern(text, pattern, label) {
  if (!pattern.test(text)) fail(`${label}: pattern not found (${pattern})`);
}

const index = readText(indexPath);
const script = readText(scriptPath);
const css = readText(cssPath);

assertIncludes(index, "command-deck-section", "homepage Command Deck wrapper");
assertIncludes(index, "GOVERNANCE PIPELINE // EVIDENCE", "Command Deck section label");
assertIncludes(index, "Every layer should reference supporting proof.", "Command Deck title");
assertIncludes(
  index,
  "Select a deterministic governance scenario to inspect its modeled verdict",
  "Command Deck explanation"
);
assertIncludes(index, 'aria-label="AETHERUS Command Deck"', "Command Deck region");
assertIncludes(index, 'id="pipeline-related-evidence"', "related evidence panel");
assertIncludes(index, 'id="related-evidence-list"', "related evidence list");
assertNotIncludes(index, "pipeline-control-map compact-controls", "dense stage control block");

for (const required of [
  "DEFAULT_SCENARIO_ID = 'adapter_failure_escalate'",
  "AETHERUS Command Deck",
  "AETHERUS &middot; MONOLITH",
  "Evidence Surface",
  "Context: Governance Pipeline",
  "Mode: Static Evaluation",
  "Read-only",
  "Deterministic prototype trace",
  "Static browser-side evaluation",
  "Local fixture data",
  "Not live AI execution",
  "Not a production audit ledger",
  "DETERMINISTIC GOVERNANCE SCENARIO",
  "Scenario Signal",
  "VERDICT CORE",
  "Release Gate Decision",
  "View Decision Path",
  "Evidence Readiness",
  "WHY BLOCKED",
  "REQUIRED EVIDENCE",
  "BOUNDARY",
  "RAW TRACE",
  "WHY THIS VERDICT?",
  "OPERATIONAL EVIDENCE NEEDED",
  "NON-OPERATIONAL BOUNDARIES",
  "RAW STATIC TRACE",
  "Basic ingress payloads",
  "Declared validation logs",
  "Model/API boundary documentation",
  "Persistent trace storage",
  "Adapter implementation",
  "Reproducible parser/normalization test result",
  "Authenticated actor identity",
  "Security review",
  "This surface is not a production SaaS dashboard or customer workspace.",
  "Operational readiness:"
]) {
  assertIncludes(script, required, "Command Deck renderer contract");
}

for (const forbidden of [
  "Live Governance Console",
  "Production Audit Dashboard",
  "Runtime Control Center",
  "Customer Workspace",
  "trace-readout",
  "Operational Evidence Required"
]) {
  assertNotIncludes(script, forbidden, "Command Deck forbidden copy/legacy readout");
}

assertPattern(script, /role="tablist"/, "Command Deck tablist role");
assertPattern(script, /role="tab"/, "Command Deck tab role");
assertPattern(script, /role="tabpanel"/, "Command Deck panel role");
assertPattern(script, /tab\.id === state\.activeTab \? '' : 'hidden'/, "inactive tab hidden state");
assertPattern(script, /state\.activeTab = 'why-blocked';\s+renderDeck\('selector'\)/, "scenario change tab reset");
assertPattern(script, /event\.key === 'ArrowRight'/, "tab keyboard next");
assertPattern(script, /event\.key === 'ArrowLeft'/, "tab keyboard previous");
assertPattern(script, /event\.key === 'Home'/, "tab keyboard home");
assertPattern(script, /event\.key === 'End'/, "tab keyboard end");
assertPattern(script, /window\.AetherusPipeline\.showRelatedByStage/, "related evidence handoff");

for (const requiredCss of [
  ".command-deck-section",
  ".trace-viewer.command-deck-mount",
  ".command-selector-shell",
  ".command-telemetry-grid",
  ".command-card-signal",
  ".command-card-verdict",
  ".command-card-readiness",
  ".command-tab-row",
  ".command-tab-panel[hidden]",
  ".command-deck-footer",
  "@media (max-width: 1199px)",
  "@media (max-width: 767px)",
  "@media (max-width: 480px)"
]) {
  assertIncludes(css, requiredCss, "Command Deck CSS contract");
}

assertPattern(css, /\.command-telemetry-grid\s*\{[^}]*grid-template-columns:\s*repeat\(12, minmax\(0, 1fr\)\)/s, "desktop 12-column grid");
assertPattern(css, /\.command-card-verdict\s*\{[^}]*grid-column:\s*span 6/s, "desktop verdict emphasis");
assertPattern(css, /\.command-card-signal,\s*\n\.command-card-readiness\s*\{[^}]*grid-column:\s*span 3/s, "desktop side card allocation");
assertPattern(css, /\.command-tab-row\s*\{[^}]*overflow-x:\s*auto/s, "mobile-safe tab scrolling");

if (failures.length) {
  console.error("Command Deck validation failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Command Deck validation passed.");
