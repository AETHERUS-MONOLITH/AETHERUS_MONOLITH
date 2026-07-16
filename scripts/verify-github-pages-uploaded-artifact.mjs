import fs from "node:fs/promises";
import { digestObject, FIXED, validateArtifactApiResponse } from "./lib/github-pages-governable.mjs";

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
for (const field of ["created_at", "expires_at"]) if (typeof artifact[field] !== "string" || !Number.isFinite(Date.parse(artifact[field]))) throw new Error(`artifact ${field} missing`);
if (Date.parse(artifact.expires_at) <= Date.now()) throw new Error("artifact expiry is not future");
const evidence = {
  schema_version: FIXED.schemaVersion,
  artifact_id: String(artifact.id),
  artifact_name: FIXED.artifactName,
  artifact_run_id: String(runId),
  artifact_run_attempt: 1,
  artifact_uploaded_at: artifact.created_at,
  artifact_expires_at: artifact.expires_at,
  artifact_expired: false,
  artifact_size_in_bytes: artifact.size_in_bytes,
  upload_action_repository: "actions/upload-pages-artifact",
  upload_action_commit_sha: "56afc609e74202658d3ffba0e8f6dda462b719fa",
  built_artifact_sha256: built.built_artifact_sha256,
  github_artifact_api_evidence_sha256: digestObject({ artifact, run_id: run.id, run_attempt: run.run_attempt })
};
await fs.writeFile(`${evidenceDirectory}/uploaded-artifact-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`artifact_id=${artifact.id}\n`);
