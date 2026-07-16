import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { digestObject, FIXED, sha256 } from "./lib/github-pages-governable.mjs";

const expected = {
  schema_version: "0.1",
  action_type: "github_pages_outward_publication",
  action_version: "0.1",
  action_identifier: FIXED.actionIdentifier,
  workspace_id: FIXED.workspaceId,
  repository: FIXED.repository,
  repository_id: FIXED.repositoryId,
  repository_owner: FIXED.repositoryOwner,
  repository_owner_id: FIXED.repositoryOwnerId,
  repository_ref: FIXED.ref,
  production_workflow_path: FIXED.productionWorkflowPath,
  production_workflow_name: FIXED.productionWorkflow,
  pages_environment: FIXED.environment,
  canonical_public_target: FIXED.target,
  artifact_name: FIXED.artifactName,
  maximum_artifact_uploads: 1,
  maximum_deployments: 1
};

export function validateContract(contract) {
  for (const [key, value] of Object.entries(expected)) {
    if (contract[key] !== value) throw new Error(`contract ${key} mismatch`);
  }
  if (contract.immutable_actions?.length !== 4) throw new Error("exactly four immutable actions required");
  for (const action of contract.immutable_actions) {
    if (!/^[0-9a-f]{40}$/.test(action.commit_sha)) throw new Error(`mutable action reference: ${action.repository}`);
  }
  for (const field of [
    "authorization_lifecycle", "atomic_authorization_consumption", "replay_rejection", "terminal_authorization_failure"
  ]) if (contract[field] !== "not_implemented") throw new Error(`${field} must remain not_implemented`);
  if (contract.future_authorization_attachment_point !== "defined_unverified") throw new Error("future attachment point classification mismatch");
  return contract;
}

function count(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

export async function validateRepository() {
  const contract = validateContract(JSON.parse(await fs.readFile("data/github-pages-governable-deployment-action.v0.json", "utf8")));
  const production = await fs.readFile(contract.production_workflow_path, "utf8");
  const verification = await fs.readFile(".github/workflows/github-pages-boundary-verification.yml", "utf8");
  if (count(production, /actions\/upload-pages-artifact@/g) !== 1) throw new Error("production upload cardinality mismatch");
  if (count(production, /actions\/deploy-pages@/g) !== 1) throw new Error("production deploy cardinality mismatch");
  if (count(verification, /actions\/upload-pages-artifact@/g) !== 0) throw new Error("verification must not upload Pages artifacts");
  if (count(verification, /actions\/deploy-pages@/g) !== 0) throw new Error("verification must not deploy Pages");
  if (/\bpush:|pull_request:|schedule:|workflow_call:|repository_dispatch:|release:/.test(production)) throw new Error("alternate production trigger detected");
  if (/github\.environment|continue-on-error/.test(production + verification)) throw new Error("unsafe workflow construct detected");
  const uses = [...(production + verification).matchAll(/uses:\s*([^\s]+)/g)].map((match) => match[1]);
  for (const reference of uses) if (!/@[0-9a-f]{40}$/.test(reference)) throw new Error(`mutable action reference ${reference}`);
  if (!production.includes("id: upload_pages_artifact") || !production.includes("artifact_name: github-pages-governable-v0-1")) {
    throw new Error("fixed artifact binding missing");
  }
  if (production.includes("on:\n  push:")) throw new Error("production push trigger detected");

  const boundary = JSON.parse(await fs.readFile("data/github-pages-governable-deployment-boundary.v0.json", "utf8"));
  if (boundary.supabase.application_status === "applied_verified") {
    const executionPackage = JSON.parse(await fs.readFile("data/github-pages-supabase-execution-package.v0.json", "utf8"));
    const receipt = JSON.parse(await fs.readFile("data/github-pages-supabase-execution-receipt.v0.json", "utf8"));
    const migration = await fs.readFile(executionPackage.migration.path);
    if (sha256(migration) !== executionPackage.migration.sha256 || receipt.migration.source_sha256 !== executionPackage.migration.sha256) {
      throw new Error("migration receipt digest mismatch");
    }
    const sourceManifest = [];
    for (const [sourcePath, expectedHash] of [
      [executionPackage.edge_function.entrypoint, executionPackage.edge_function.entrypoint_sha256],
      [executionPackage.edge_function.support_source, executionPackage.edge_function.support_source_sha256]
    ]) {
      const actualHash = sha256(await fs.readFile(sourcePath));
      if (actualHash !== expectedHash) throw new Error(`Edge source digest mismatch: ${sourcePath}`);
      sourceManifest.push({ path: sourcePath, sha256: actualHash });
    }
    if (digestObject(sourceManifest) !== executionPackage.edge_function.source_manifest_sha256) throw new Error("Edge source manifest digest mismatch");
    if (receipt.edge_function.deployed_entrypoint_exact_match !== true || receipt.edge_function.deployed_support_source_exact_match !== true) {
      throw new Error("deployed Edge source equality receipt missing");
    }
    if (receipt.secret_values_in_receipt !== false) throw new Error("receipt secret-value boundary mismatch");
  }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await validateRepository();
  process.stdout.write("GitHub Pages governable deployment action validation passed.\n");
}
