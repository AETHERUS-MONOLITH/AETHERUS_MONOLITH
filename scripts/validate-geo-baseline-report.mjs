#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadEndpointRegistry, loadSourceTruth, readJsonFile } from "../geo/lib/source-loader.mjs";
import { buildBaselineReport } from "../geo/lib/baseline-report.mjs";
import { assertSchema, loadSchemas, validateEveryFinding } from "../geo/lib/schema-validation.mjs";

const schemas = await loadSchemas();
const sourceTruth = await loadSourceTruth();
const registry = await loadEndpointRegistry();
const evidence = await readJsonFile("geo/reports/baseline/geo-0.1-normalized-evidence.json");
const report = await readJsonFile("geo/reports/baseline/geo-0.1-baseline.json");

assertSchema(evidence, schemas.normalizedEvidence, "normalized evidence");
assertSchema(report, schemas.baselineReport, "baseline report");

const allFindings = Object.values(report.findings).flat();
const findingErrors = validateEveryFinding(allFindings, schemas.finding);
if (findingErrors.length > 0) throw new Error(findingErrors.join("\n"));

const replayOne = buildBaselineReport({ sourceTruth, registry, evidence, mode: "replay" });
const replayTwo = buildBaselineReport({ sourceTruth, registry, evidence, mode: "replay" });
if (replayOne.structural_findings_hash !== replayTwo.structural_findings_hash) {
  throw new Error("deterministic replay produced different structural findings hashes");
}
if (replayOne.structural_findings_hash !== report.structural_findings_hash) {
  throw new Error("committed report hash does not match replayed structural findings hash");
}

const messages = allFindings.map((finding) => finding.message).join("\n");
if (/retrieval failure/i.test(messages)) throw new Error("absent JSON-LD must not be called retrieval failure");
if (!/structured_data_absent/.test(messages)) throw new Error("missing JSON-LD fixture/live finding must use structured_data_absent language");
if (report.advisory_findings.some((finding) => finding.severity !== "advisory")) {
  throw new Error("advisory chunk findings must stay advisory");
}
if (!report.contradictions.some((finding) => /ScholarlyArticle.*Report|Report.*ScholarlyArticle/i.test(finding.message))) {
  throw new Error("TAA source/public type contradiction was not surfaced");
}
for (const finding of allFindings) {
  if (!finding.evidence || !finding.validator_version || !finding.reproducibility) {
    throw new Error(`${finding.id}: missing evidence or validator metadata`);
  }
}

const publicPaths = ["index.html", "the-apologetic-authority/index.html", "robots.txt", "sitemap.xml", "llms.txt"];
const existingPublicPaths = publicPaths.filter((file) => {
  try {
    readFileSync(file);
    return true;
  } catch {
    return false;
  }
});
try {
  execFileSync("git", ["diff", "--quiet", "HEAD", "--", ...existingPublicPaths]);
} catch {
  throw new Error("public paths changed relative to baseline");
}

console.log("GEO baseline report validation passed.");
console.log(`deterministic_replay_hash=${replayOne.structural_findings_hash}`);
