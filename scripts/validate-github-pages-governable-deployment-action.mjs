import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FIXED } from "./lib/github-pages-governable.mjs";

function assert(condition, message) { if (!condition) throw new Error(message); }
function count(text, pattern) { return [...text.matchAll(pattern)].length; }

const expectedContract = Object.freeze({
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
});

export function validateContract(contract) {
  for (const [key, value] of Object.entries(expectedContract)) assert(contract[key] === value, `contract ${key} mismatch`);
  assert(contract.immutable_actions?.length === 4, "exactly four immutable actions required");
  for (const action of contract.immutable_actions) assert(/^[0-9a-f]{40}$/.test(action.commit_sha), `mutable action reference: ${action.repository}`);
  assert(contract.authorization_attachment_point === "implemented_verified", "authorization attachment point mismatch");
  assert(contract.authorization_lifecycle === "action_specific_replay_safe_v0", "authorization lifecycle mismatch");
  assert(contract.atomic_authorization_consumption === "implemented", "atomic consumption mismatch");
  assert(contract.replay_rejection === "implemented", "replay rejection mismatch");
  assert(contract.terminal_authorization_failure === "implemented", "terminal failure mismatch");
  return contract;
}

export async function validateRepository() {
  const action = validateContract(JSON.parse(await fs.readFile("data/github-pages-governable-deployment-action.v0.json", "utf8")));
  const authorization = JSON.parse(await fs.readFile("contracts/github-pages-publication-authorization-v0.json", "utf8"));
  const manifest = JSON.parse(await fs.readFile("contracts/github-pages-publication-final-manifest-v0.json", "utf8"));
  const acceptance = JSON.parse(await fs.readFile("contracts/github-pages-publication-authorization-acceptance-tests-v0.json", "utf8"));
  const corrective = (await fs.readFile("supabase/migrations/20260717122122_github_pages_publication_authorization_v0_corrective_closure.sql", "utf8")).toLowerCase();
  const consumption = await fs.readFile("supabase/functions/github-pages-authorization-consumption-v0/index.ts", "utf8");
  const production = await fs.readFile(action.production_workflow_path, "utf8");
  const verification = await fs.readFile(".github/workflows/github-pages-boundary-verification.yml", "utf8");
  assert(authorization.operator_principal_id === FIXED.operatorPrincipalId, "Operator principal mismatch");
  assert(authorization.authorization_ttl_seconds === 300, "authorization TTL mismatch");
  assert(acceptance.test_count === 17 && acceptance.tests.length === 17, "AT-01 through AT-17 contract mismatch");
  assert(acceptance.tests.every((entry,index)=>entry.test_id===`AT-${String(index+1).padStart(2,"0")}`), "acceptance test IDs are not exact");
  assert(authorization.execution_identity.mutable_binding_fields_excluded === true, "stable execution identity exclusion missing");
  assert(corrective.includes("unique (execution_identity_sha256)"), "unique execution identity constraint missing");
  const identityStart = corrective.indexOf("function private.github_pages_publication_execution_identity_v0");
  const identityEnd = corrective.indexOf("$$;", identityStart);
  assert(!corrective.slice(identityStart,identityEnd).includes("action_manifest_sha256"), "stable execution identity includes manifest digest");
  assert(corrective.includes("resolve_github_pages_operator_cardinality_v0"), "exact Operator cardinality resolver missing");
  assert(corrective.includes("assignment.suspended_at is null") && corrective.includes("assignment.revoked_at is null"), "complete Operator validity predicate missing");
  assert(!/verifytrustenvelope[\s\S]*claims\.(repository|actor|workflow|run_id)/i.test(consumption), "consumption trust envelope performs action binding rejection");
  assert(consumption.includes("private.consume_github_pages_publication_authorization_v0($1::uuid,$2::jsonb,$3::text)"), "observed binding is not submitted to database consumption");
  assert(manifest.required_fields.length === new Set(manifest.required_fields).size, "manifest fields are not unique");
  assert(count(production,/actions\/upload-pages-artifact@/g)===1,"production upload cardinality mismatch");
  assert(count(production,/actions\/deploy-pages@/g)===1,"production deploy cardinality mismatch");
  assert(count(verification,/actions\/upload-pages-artifact@/g)===0,"verification must not upload Pages artifacts");
  assert(count(verification,/actions\/deploy-pages@/g)===0,"verification must not deploy Pages");
  assert(!/\bpush:|pull_request:|schedule:|workflow_call:|repository_dispatch:|release:/.test(production),"alternate production trigger detected");
  assert(!/github\.environment|continue-on-error/.test(production+verification),"unsafe workflow construct detected");
  const uses=[...(production+verification).matchAll(/uses:\s*([^\s]+)/g)].map(match=>match[1]);
  for(const reference of uses)assert(/@[0-9a-f]{40}$/.test(reference),`mutable action reference ${reference}`);
  assert(production.includes("id: upload_pages_artifact")&&production.includes("artifact_name: github-pages-governable-v0-1"),"fixed artifact binding missing");
  const order=["Upload exact Pages artifact","Verify current-run artifact identity","Construct and validate final action manifest","Create action-specific authorization request","Await fixed Operator decision","Consume authorization and construct deployment permit","Deploy the bound Pages artifact"].map(label=>production.indexOf(label));
  assert(order.every(index=>index>=0),"authorization workflow stage missing");
  assert(order.every((index,position)=>position===0||index>order[position-1]),"authorization workflow order mismatch");
  assert((production.slice(order[5],order[6]).match(/^\s*- name:/gm)||[]).length===1,"step inserted between consumption and deployment");
  for(const slug of ["request","decision","consumption"]){
    const section=`[functions.github-pages-authorization-${slug}-v0]\nverify_jwt = false`;
    const config=await fs.readFile("supabase/config.toml","utf8"); assert(config.includes(section),`function config missing: ${slug}`);
    for(const file of ["index.ts","lib.ts"])await fs.access(`supabase/functions/github-pages-authorization-${slug}-v0/${file}`);
  }
  await fs.access("supabase/migrations/20260716_0002_github_pages_publication_authorization_v0.sql");
  await fs.access("supabase/migrations/20260716_0003_github_pages_publication_authorization_v0_runtime_fix.sql");
  await fs.access("supabase/migrations/20260716_0004_github_pages_publication_authorization_v0_conflict_fix.sql");
  await fs.access("supabase/migrations/20260716_0005_github_pages_publication_authorization_v0_fk_indexes.sql");
  await fs.access("supabase/migrations/20260716_0006_github_pages_publication_authorization_v0_effect_constraint.sql");
  await fs.access("supabase/migrations/20260716_0007_github_pages_publication_authorization_v0_consumption_operator_check.sql");
  await fs.access("supabase/migrations/20260717122122_github_pages_publication_authorization_v0_corrective_closure.sql");
  await fs.access("scripts/build-github-pages-final-action-manifest.mjs");
  return true;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  await validateRepository();
  process.stdout.write("GitHub Pages action-specific authorization validation passed.\n");
}
