import fs from "node:fs/promises";
import { canonicalJson, digestObject, FIXED } from "./lib/github-pages-governable.mjs";
import { validateRepository } from "./validate-github-pages-governable-deployment-action.mjs";

await validateRepository();
const directory = process.env.EVIDENCE_DIRECTORY || `${process.env.RUNNER_TEMP}/github-pages-governable-evidence`;
const names = ["source-evidence", "runtime-config-evidence", "built-artifact-evidence", "operator-resolution-evidence", "action-manifest", "uploaded-artifact-evidence"];
const evidence = Object.fromEntries(await Promise.all(names.map(async (name) => [name, JSON.parse(await fs.readFile(`${directory}/${name}.json`, "utf8"))])));
const artifact = evidence["uploaded-artifact-evidence"];
const manifest = evidence["action-manifest"];
if (artifact.action_manifest_sha256 !== manifest.action_manifest_sha256) throw new Error("manifest binding mismatch");
if (artifact.built_artifact_sha256 !== evidence["built-artifact-evidence"].built_artifact_sha256) throw new Error("artifact digest binding mismatch");
if (artifact.artifact_name !== FIXED.artifactName) throw new Error("artifact name mismatch");
if (artifact.workflow_run_id !== String(process.env.GITHUB_RUN_ID) || artifact.run_attempt !== 1) throw new Error("run identity mismatch");

const permit = {
  classification: "action_boundary_preconditions_satisfied",
  action_identifier: FIXED.actionIdentifier,
  action_manifest_sha256: manifest.action_manifest_sha256,
  artifact_id: artifact.artifact_id,
  artifact_name: FIXED.artifactName,
  target: FIXED.target,
  permitted_effect: "replace the current GitHub Pages deployment for the canonical target with the exact bound uploaded artifact",
  maximum_deployments: 1,
  future_authorization_attachment_point: "defined_unverified",
  authorization_lifecycle: "not_implemented"
};
if (/authorized|approved|authorization_valid|authorization_consumed|replay_safe|terminal_authorization_failure/.test(canonicalJson(permit))) {
  throw new Error("structural permit contains prohibited authorization claim");
}
await fs.writeFile(`${directory}/structural-permit.json`, `${JSON.stringify({ ...permit, structural_permit_sha256: digestObject(permit) }, null, 2)}\n`, { mode: 0o600 });
process.stdout.write("action_boundary_preconditions_satisfied\n");
