import fs from "node:fs/promises";
import { FIXED } from "./lib/github-pages-governable.mjs";

const directory = process.env.EVIDENCE_DIRECTORY || `${process.env.RUNNER_TEMP}/github-pages-governable-evidence`;
const tokenPath = process.env.AUTHORIZATION_CONSUMPTION_OIDC_TOKEN_PATH;
if (!tokenPath) throw new Error("AUTHORIZATION_CONSUMPTION_OIDC_TOKEN_PATH is required");
if (process.env.GITHUB_RUN_ATTEMPT !== "1") throw new Error("consumption requires run_attempt 1");
const githubApiToken = process.env.GITHUB_TOKEN;
if (!githubApiToken) throw new Error("GITHUB_TOKEN is required for server-side artifact verification");

const [token, manifestText, requestText, decisionText] = await Promise.all([
  fs.readFile(tokenPath, "utf8"),
  fs.readFile(`${directory}/final-action-manifest.json`, "utf8"),
  fs.readFile(`${directory}/authorization-request-receipt.json`, "utf8"),
  fs.readFile(`${directory}/authorization-decision-receipt.json`, "utf8")
]);
const manifest = JSON.parse(manifestText);
const request = JSON.parse(requestText);
const decision = JSON.parse(decisionText);
if (decision.status !== "authorized" || request.request_id !== decision.request_id) throw new Error("authorization decision binding invalid");

const response = await fetch(FIXED.authorizationConsumptionAudience, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ operation: "consume", request_id: request.request_id, manifest, github_api_token: githubApiToken }),
  redirect: "error"
});
const text = await response.text();
let receipt;
try { receipt = JSON.parse(text); } catch { throw new Error(`consumption endpoint returned non-JSON status ${response.status}`); }
if (!response.ok) throw new Error(`authorization consumption failed with ${response.status}: ${receipt.terminal_failure_code || receipt.error || "request rejected"}`);
for (const [field, expected] of [
  ["status", "consumed"],
  ["request_id", request.request_id],
  ["action_manifest_sha256", manifest.action_manifest_sha256],
  ["artifact_id", manifest.artifact_id],
  ["run_id", manifest.run_id],
  ["run_attempt", 1]
]) if (String(receipt[field]) !== String(expected)) throw new Error(`consumption receipt ${field} mismatch`);
await fs.writeFile(`${directory}/authorization-consumption-receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
process.stdout.write("authorization_status=consumed\n");
