import fs from "node:fs/promises";
import { invokeGithubPagesPalisadeEvaluationV0 } from "../palisade/runtime/v0/palisade-github-pages-decision-boundary.v0.mjs";

const directory = process.env.EVIDENCE_DIRECTORY || `${process.env.RUNNER_TEMP}/github-pages-governable-evidence`;
const tokenPath = process.env.PALISADE_EVALUATION_OIDC_TOKEN_PATH;
if (!tokenPath) throw new Error("PALISADE_EVALUATION_OIDC_TOKEN_PATH is required");

const [token, request, status, manifest] = await Promise.all([
  fs.readFile(tokenPath, "utf8"),
  fs.readFile(`${directory}/authorization-request-receipt.json`, "utf8").then(JSON.parse),
  fs.readFile(`${directory}/authorization-decision-receipt.json`, "utf8").then(JSON.parse),
  fs.readFile(`${directory}/final-action-manifest.json`, "utf8").then(JSON.parse)
]);
if (status.status !== "authorized") throw new Error("Palisade evaluation requires current Phase 4 authorized status");
if (typeof status.phase4_status_receipt_sha256 !== "string") throw new Error("Phase 4 status receipt digest missing");

const body = {
  schema_version: "0.5",
  request_id: request.request_id,
  action_manifest_sha256: manifest.action_manifest_sha256,
  phase4_status_receipt_sha256: status.phase4_status_receipt_sha256,
  workflow_run_id: String(manifest.run_id),
  workflow_sha: manifest.workflow_sha,
  source_commit_sha: manifest.source_commit_sha
};
const decision = await invokeGithubPagesPalisadeEvaluationV0(body, token);
await fs.writeFile(`${directory}/palisade-decision-receipt.json`, `${JSON.stringify(decision, null, 2)}\n`, { mode: 0o600 });
if (decision.decision !== "allow" || decision.allowed !== true) throw new Error(`Palisade blocked publication: ${decision.decision}`);
process.stdout.write(`palisade_decision_id=${decision.palisade_decision_id}\n`);
