import fs from "node:fs/promises";
import { FIXED, validateArtifactApiResponse } from "./lib/github-pages-governable.mjs";

const token = process.env.GITHUB_TOKEN;
const runId = process.env.GITHUB_RUN_ID;
const artifactId = process.env.UPLOADED_ARTIFACT_ID;
const evidenceDirectory = process.env.EVIDENCE_DIRECTORY || `${process.env.RUNNER_TEMP}/github-pages-governable-evidence`;
if (!token || !runId || !artifactId) throw new Error("artifact verification environment incomplete");

const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers, redirect: "error" });
  if (!response.ok) throw new Error(`GitHub artifact API failed with ${response.status}`);
  return response.json();
}

const artifactsResponse = await github(`/repos/${FIXED.repository}/actions/runs/${runId}/artifacts?name=${encodeURIComponent(FIXED.artifactName)}&per_page=100`);
const run = await github(`/repos/${FIXED.repository}/actions/runs/${runId}`);
const artifact = validateArtifactApiResponse({ artifacts: artifactsResponse.artifacts, run, artifactId, runId });
const built = JSON.parse(await fs.readFile(`${evidenceDirectory}/built-artifact-evidence.json`, "utf8"));
const manifest = JSON.parse(await fs.readFile(`${evidenceDirectory}/action-manifest.json`, "utf8"));
const permitInput = {
  artifact_id: String(artifact.id),
  artifact_name: FIXED.artifactName,
  workflow_run_id: String(runId),
  run_attempt: 1,
  upload_action_repository: "actions/upload-pages-artifact",
  upload_action_commit_sha: "56afc609e74202658d3ffba0e8f6dda462b719fa",
  built_artifact_sha256: built.built_artifact_sha256,
  action_manifest_sha256: manifest.action_manifest_sha256
};
await fs.writeFile(`${evidenceDirectory}/uploaded-artifact-evidence.json`, `${JSON.stringify(permitInput, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`artifact_id=${artifact.id}\n`);
