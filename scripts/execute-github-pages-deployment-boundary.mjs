import fs from "node:fs/promises";
import { digestObject, FIXED } from "./lib/github-pages-governable.mjs";

const directory = process.env.EVIDENCE_DIRECTORY || `${process.env.RUNNER_TEMP}/github-pages-governable-evidence`;
const [manifestText, consumptionText] = await Promise.all([
  fs.readFile(`${directory}/final-action-manifest.json`, "utf8"),
  fs.readFile(`${directory}/authorization-consumption-receipt.json`, "utf8")
]);
const manifest = JSON.parse(manifestText);
const consumption = JSON.parse(consumptionText);
if (consumption.status !== "consumed") throw new Error("authorization is not consumed");
if (consumption.action_manifest_sha256 !== manifest.action_manifest_sha256) throw new Error("consumed manifest binding mismatch");
if (String(consumption.artifact_id) !== String(manifest.artifact_id)) throw new Error("consumed artifact binding mismatch");
if (manifest.artifact_name !== FIXED.artifactName || manifest.canonical_public_target !== FIXED.target) throw new Error("deployment target binding mismatch");
if (manifest.maximum_artifact_uploads !== 1 || manifest.maximum_deployments !== 1) throw new Error("effect cardinality mismatch");
const permit = {
  classification: "action_specific_authorization_consumed",
  action_identifier: FIXED.actionIdentifier,
  request_id: consumption.request_id,
  action_manifest_sha256: manifest.action_manifest_sha256,
  consumption_receipt_sha256: consumption.consumption_receipt_sha256,
  artifact_id: manifest.artifact_id,
  artifact_name: manifest.artifact_name,
  target: manifest.canonical_public_target,
  maximum_deployments: 1
};
await fs.writeFile(`${directory}/deployment-permit.json`, `${JSON.stringify({ ...permit, deployment_permit_sha256: digestObject(permit) }, null, 2)}\n`, { mode: 0o600 });
process.stdout.write("action_specific_authorization_consumed\n");
