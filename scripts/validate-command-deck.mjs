import fs from "node:fs";

const failures = [];
const read = path => fs.readFileSync(path, "utf8");
const include = (text, value, label) => { if (!text.includes(value)) failures.push(`${label}: missing "${value}"`); };
const exclude = (text, value, label) => { if (text.includes(value)) failures.push(`${label}: must not include "${value}"`); };

const index = read("index.html");
const script = read("js/trace-viewer.js");
const css = read("css/operator-surfaces.css");

for (const value of [
  "operator-disclosure--evidence",
  "Selected proof",
  "A decision is only as strong as its evidence.",
  "This public scenario is a deterministic browser-side evaluation",
  'aria-label="Public scenario evidence"',
  'id="pipeline-related-evidence"',
  'id="related-evidence-list"'
]) include(index, value, "public proof surface");

for (const value of [
  "DEFAULT_SCENARIO_ID = 'adapter_failure_escalate'",
  "AETHERUS evidence artifact",
  "Deterministic prototype trace",
  "Static browser-side evaluation",
  "Local fixture data",
  "Not live AI execution",
  "Not a production audit ledger",
  "Deterministic governance scenario",
  "Modeled result",
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
  "Operational readiness:",
  "window.AetherusPipeline.showRelatedByStage"
]) include(script, value, "Proof Object renderer contract");

for (const value of [
  "Live Governance Console",
  "Production Audit Dashboard",
  "Runtime Control Center",
  "Customer Workspace",
  "command-telemetry-grid",
  'role="tablist"'
]) exclude(script, value, "removed peer-dashboard language");

for (const value of [
  ".proof-object",
  ".proof-object__header",
  ".proof-object__body",
  ".proof-object__layers",
  ".proof-layer",
  ".proof-evidence-list",
  ".proof-raw-fields",
  "@media (max-width: 1199px)",
  "@media (max-width: 767px)",
  "@media (max-width: 360px)"
]) include(css, value, "Proof Object CSS contract");

if (!/details class=\"proof-layer\"/.test(script)) failures.push("Proof Object: native layered disclosures missing");
if (!/details class=\"proof-layer\" open/.test(script)) failures.push("Proof Object: default decision-basis layer missing");
if (!/select\?\.addEventListener\('change'/.test(script)) failures.push("Proof Object: scenario selector change binding missing");

if (failures.length) {
  console.error("Proof Object validation failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Proof Object validation passed.");
