import fs from "node:fs/promises";
import { FIXED } from "./lib/github-pages-governable.mjs";

const directory = process.env.EVIDENCE_DIRECTORY || `${process.env.RUNNER_TEMP}/github-pages-governable-evidence`;
const endpoint = FIXED.authorizationRequestAudience;

async function readJson(name) {
  return JSON.parse(await fs.readFile(`${directory}/${name}`, "utf8"));
}

async function readInitialToken() {
  const path = process.env.AUTHORIZATION_REQUEST_OIDC_TOKEN_PATH;
  if (!path) throw new Error("AUTHORIZATION_REQUEST_OIDC_TOKEN_PATH is required");
  return fs.readFile(path, "utf8");
}

async function acquireFreshToken() {
  if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL || !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) return readInitialToken();
  const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  url.searchParams.set("audience", endpoint);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
    redirect: "error"
  });
  if (!response.ok) throw new Error(`OIDC acquisition failed: ${response.status}`);
  const payload = await response.json();
  if (typeof payload.value !== "string" || payload.value.length < 32) throw new Error("OIDC response missing token");
  return payload.value;
}

async function invoke(token, body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    redirect: "error"
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`authorization endpoint returned non-JSON status ${response.status}`); }
  if (!response.ok) throw new Error(`authorization endpoint failed with ${response.status}: ${payload.error || "request rejected"}`);
  return payload;
}

async function createRequest() {
  const manifest = await readJson("final-action-manifest.json");
  const githubApiToken = process.env.GITHUB_TOKEN;
  if (!githubApiToken) throw new Error("GITHUB_TOKEN is required for server-side artifact verification");
  const receipt = await invoke(await readInitialToken(), { operation: "create", manifest, github_api_token: githubApiToken });
  if (receipt.status !== "pending" || typeof receipt.request_id !== "string") throw new Error("request creation receipt invalid");
  if (receipt.action_manifest_sha256 !== manifest.action_manifest_sha256) throw new Error("request manifest binding mismatch");
  await fs.writeFile(`${directory}/authorization-request-receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`request_id=${receipt.request_id}\n`);
}

async function awaitDecision() {
  const request = await readJson("authorization-request-receipt.json");
  const manifest = await readJson("final-action-manifest.json");
  const deadline = Date.now() + FIXED.authorizationWaitSeconds * 1000;
  while (Date.now() < deadline) {
    const receipt = await invoke(await acquireFreshToken(), {
      operation: "status",
      request_id: request.request_id,
      action_manifest_sha256: manifest.action_manifest_sha256,
      run_id: manifest.run_id,
      workflow_sha: manifest.workflow_sha,
      source_commit_sha: manifest.source_commit_sha
    });
    if (receipt.status === "authorized") {
      await fs.writeFile(`${directory}/authorization-decision-receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
      process.stdout.write("authorization_status=authorized\n");
      return;
    }
    if (["rejected", "consumed", "consumption_failed", "expired"].includes(receipt.status)) {
      throw new Error(`authorization terminal without consumable approval: ${receipt.status}`);
    }
    if (receipt.status !== "pending") throw new Error("authorization status invalid");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("authorization decision wait exceeded 900 seconds");
}

const operation = process.argv[2];
if (operation === "create") await createRequest();
else if (operation === "await") await awaitDecision();
else throw new Error("expected create or await operation");

export { acquireFreshToken, awaitDecision, createRequest };
