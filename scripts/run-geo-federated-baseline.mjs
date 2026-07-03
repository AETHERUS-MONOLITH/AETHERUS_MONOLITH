#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fetchRegistry } from "../geo/lib/endpoint-fetch.mjs";
import { normalizedEvidence } from "../geo/lib/evidence-normalization.mjs";
import { buildBaselineReport, baselineMarkdown } from "../geo/lib/baseline-report.mjs";
import { loadEndpointRegistry, loadSourceTruth, readJsonFile, repoRoot } from "../geo/lib/source-loader.mjs";

const modeArg = process.argv.find((arg) => arg === "--live" || arg === "--replay");
const mode = modeArg === "--live" ? "live" : "replay";
const outDir = path.join(repoRoot, "geo/reports/baseline");
const evidencePath = path.join(outDir, "geo-0.1-normalized-evidence.json");
const reportPath = path.join(outDir, "geo-0.1-baseline.json");
const markdownPath = path.join(outDir, "geo-0.1-baseline.md");

const sourceTruth = await loadSourceTruth();
const registry = await loadEndpointRegistry();

let evidence;
if (mode === "live") {
  const observations = await fetchRegistry(registry);
  evidence = normalizedEvidence(registry, observations);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
} else {
  evidence = await readJsonFile("geo/reports/baseline/geo-0.1-normalized-evidence.json");
}

const report = buildBaselineReport({ sourceTruth, registry, evidence, mode });
if (mode === "live") {
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(markdownPath, baselineMarkdown(report, evidence));
}

console.log(`GEO federated baseline ${mode} complete.`);
console.log(`structural_findings_hash=${report.structural_findings_hash}`);
