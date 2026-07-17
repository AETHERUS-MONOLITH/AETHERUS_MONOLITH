import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  GITHUB_PAGES_POLICY,
  evaluateGithubPagesOutwardPublicationV0,
  githubPagesPalisadeInputFields
} from "../palisade/runtime/v0/palisade-github-pages-policy-engine.v0.mjs";
import {
  githubPagesConduitEnvelopeFields,
  validateGithubPagesConduitEnvelopeV0
} from "../conduit/runtime/v0/index.mjs";

const readJson = async (path) => JSON.parse(await fs.readFile(path, "utf8"));
const count = (text, pattern) => [...text.matchAll(pattern)].length;

function validPolicyInput(overrides = {}) {
  return {
    schema_version: "0.5", policy_surface: GITHUB_PAGES_POLICY.policy_surface, claim_id: GITHUB_PAGES_POLICY.claim_id,
    requested_action: GITHUB_PAGES_POLICY.requested_action, policy_rule_id: GITHUB_PAGES_POLICY.policy_rule_id,
    action_identifier: GITHUB_PAGES_POLICY.action_identifier, workspace_id: GITHUB_PAGES_POLICY.workspace_id,
    repository: GITHUB_PAGES_POLICY.repository, repository_id: GITHUB_PAGES_POLICY.repository_id,
    repository_ref: GITHUB_PAGES_POLICY.repository_ref, workflow_path: GITHUB_PAGES_POLICY.workflow_path,
    workflow_sha: "a".repeat(40), workflow_run_id: "900001", run_attempt: 1,
    request_id: "123e4567-e89b-12d3-a456-426614174000", authorization_record_id: "123e4567-e89b-12d3-a456-426614174000",
    execution_identity_sha256: "1".repeat(64), action_manifest_sha256: "2".repeat(64), artifact_id: "800001",
    artifact_name: GITHUB_PAGES_POLICY.artifact_name, artifact_run_id: "900001", artifact_run_attempt: 1,
    built_artifact_sha256: "3".repeat(64), canonical_public_target: GITHUB_PAGES_POLICY.canonical_public_target,
    environment: GITHUB_PAGES_POLICY.environment, permitted_effect: GITHUB_PAGES_POLICY.permitted_effect,
    deploy_executor_sha: GITHUB_PAGES_POLICY.deploy_executor_sha, phase4_status: "authorized",
    phase4_status_receipt_sha256: "4".repeat(64), authorization_currently_usable: true,
    authorization_expired: false, artifact_expired: false, operator_assignment_count: 1,
    operator_cardinality_exactly_one: true, approved_operator_still_valid: true, request_identity_match: true,
    execution_identity_match: true, manifest_digest_match: true, artifact_binding_match: true,
    runtime_binding_match: true, dependency_binding_match: true, target_effect_executor_match: true,
    replay_state: "unused", consumption_state: "not_consumed", ...overrides
  };
}

function validEnvelope(overrides = {}) {
  return {
    schema_version:"0.5",request_id:"123e4567-e89b-12d3-a456-426614174000",trace_id:"123e4567-e89b-12d3-a456-426614174000",
    correlation_id:"123e4567-e89b-12d3-a456-426614174000",action_identifier:GITHUB_PAGES_POLICY.action_identifier,
    policy_surface:GITHUB_PAGES_POLICY.policy_surface,claim_id:GITHUB_PAGES_POLICY.claim_id,requested_action:GITHUB_PAGES_POLICY.requested_action,
    workspace_id:GITHUB_PAGES_POLICY.workspace_id,repository:GITHUB_PAGES_POLICY.repository,repository_id:GITHUB_PAGES_POLICY.repository_id,
    repository_ref:GITHUB_PAGES_POLICY.repository_ref,workflow_path:GITHUB_PAGES_POLICY.workflow_path,workflow_sha:"a".repeat(40),
    workflow_run_id:"900001",run_attempt:1,authorization_record_id:"123e4567-e89b-12d3-a456-426614174000",
    execution_identity_sha256:"1".repeat(64),action_manifest_sha256:"2".repeat(64),artifact_id:"800001",
    artifact_name:GITHUB_PAGES_POLICY.artifact_name,artifact_run_id:"900001",artifact_run_attempt:1,built_artifact_sha256:"3".repeat(64),
    canonical_public_target:GITHUB_PAGES_POLICY.canonical_public_target,environment:GITHUB_PAGES_POLICY.environment,
    permitted_effect:GITHUB_PAGES_POLICY.permitted_effect,deploy_executor_sha:GITHUB_PAGES_POLICY.deploy_executor_sha,
    phase4_status_receipt_sha256:"4".repeat(64),palisade_decision_id:"223e4567-e89b-12d3-a456-426614174000",
    palisade_decision_sha256:"5".repeat(64),...overrides
  };
}

export async function validatePhase5Repository() {
  const [policy,inputSchema,decisionSchema,integration,acceptance,conduitBinding,runtimeManifest] = await Promise.all([
    readJson("palisade/policy-bundle.v0/policies/github-pages-outward-publication-policy.v0.json"),
    readJson("palisade/policy-bundle.v0/schema/github-pages-outward-publication-input.schema.json"),
    readJson("palisade/policy-bundle.v0/schema/github-pages-outward-publication-decision.schema.json"),
    readJson("contracts/github-pages-palisade-conduit-runtime-integration-v0.json"),
    readJson("contracts/github-pages-palisade-conduit-runtime-acceptance-tests-v0.json"),
    readJson("conduit/runtime/v0/conduit-github-pages-binding-manifest.v0.json"),
    readJson("palisade/runtime/v0/palisade-runtime-manifest.v0.json")
  ]);
  assert.deepEqual(policy.tuple, integration.policy_tuple);
  assert.equal(policy.scope.supported_consequential_actions, 1);
  assert.equal(policy.scope.action_registry, false);
  assert.equal(inputSchema.additionalProperties, false);
  assert.deepEqual(inputSchema.required.slice().sort(), githubPagesPalisadeInputFields);
  assert.equal(decisionSchema.additionalProperties, false);
  assert.equal(conduitBinding.fixed_route_count, 1);
  assert.equal(conduitBinding.action_registry_created, false);
  assert.equal(conduitBinding.authorization_owner, "Phase 4 action-specific authorization boundary");
  assert.equal(runtimeManifest.github_pages_action_specific_enforcement.supported_consequential_actions, 1);
  assert.equal(acceptance.test_count, 25);
  assert.deepEqual(acceptance.tests.map((entry) => entry.test_id), Array.from({ length: 25 }, (_, i) => `P5-AT-${String(i + 1).padStart(2, "0")}`));

  assert.equal(evaluateGithubPagesOutwardPublicationV0(validPolicyInput()).decision, "allow");
  assert.equal(evaluateGithubPagesOutwardPublicationV0(validPolicyInput({ phase4_status: "pending", authorization_currently_usable: false })).decision, "requires_operator_review");
  assert.equal(evaluateGithubPagesOutwardPublicationV0(validPolicyInput({ target_effect_executor_match: false })).decision, "deny");
  const incomplete = validPolicyInput(); delete incomplete.phase4_status_receipt_sha256;
  assert.equal(evaluateGithubPagesOutwardPublicationV0(incomplete).decision, "requires_evidence");
  assert.deepEqual(validateGithubPagesConduitEnvelopeV0(validEnvelope()), []);
  assert.ok(validateGithubPagesConduitEnvelopeV0({ ...validEnvelope(), allowed: true }).length > 0);
  assert.deepEqual(Object.keys(validEnvelope()).sort(), githubPagesConduitEnvelopeFields);

  const [workflow,verification,migration,index,requestEdge,palisadeEdge,conduitEdge] = await Promise.all([
    fs.readFile(".github/workflows/pages-runtime-config.yml", "utf8"),
    fs.readFile(".github/workflows/github-pages-boundary-verification.yml", "utf8"),
    fs.readFile("supabase/migrations/20260717140755_github_pages_palisade_conduit_runtime_integration_v0.sql", "utf8"),
    fs.readFile("conduit/runtime/v0/index.mjs", "utf8"),
    fs.readFile("supabase/functions/github-pages-authorization-request-v0/index.ts", "utf8"),
    fs.readFile("supabase/functions/github-pages-palisade-evaluation-v0/index.ts", "utf8"),
    fs.readFile("supabase/functions/github-pages-conduit-invocation-v0/index.ts", "utf8")
  ]);
  assert.equal(count(workflow,/actions\/upload-pages-artifact@/g),1);
  assert.equal(count(workflow,/actions\/deploy-pages@/g),1);
  assert.equal(count(workflow,/node scripts\/evaluate-github-pages-palisade\.mjs/g),1);
  assert.equal(count(workflow,/node scripts\/invoke-github-pages-conduit\.mjs/g),1);
  assert.equal(count(workflow,/consume-github-pages-publication-authorization\.mjs/g),0);
  const order=["Upload exact Pages artifact","Verify current-run artifact identity","Construct and validate final action manifest",
    "Create action-specific authorization request","Await fixed Operator decision","Evaluate and persist exact Palisade decision",
    "Invoke fixed Conduit route and require deployment permit","Deploy the bound Pages artifact"].map((label)=>workflow.indexOf(label));
  assert.ok(order.every((value,index)=>value>=0&&(index===0||value>order[index-1])));
  assert.equal((workflow.slice(order[6],order[7]).match(/^\s*- name:/gm)||[]).length,1);
  assert.equal(count(verification,/actions\/upload-pages-artifact@/g),0);
  assert.equal(count(verification,/actions\/deploy-pages@/g),0);
  assert.equal(count(verification,/authorization-(request|decision|consumption)-v0/g),0);
  for(const required of ["private.github_pages_palisade_decisions_v0","private.github_pages_conduit_invocations_v0",
    "force row level security","Palisade decisions are append-only","prepare_github_pages_conduit_invocation_v0",
    "complete_github_pages_conduit_invocation_v0","record_github_pages_palisade_runtime_unavailable_v0",
    "phase5_consumption_bound"]) assert.match(migration,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"));
  assert.match(index,/invokeGithubPagesOutwardPublicationV0/);
  assert.match(requestEdge,/resolve_github_pages_publication_authorization_phase5_v0/);
  for(const edge of [palisadeEdge,conduitEdge]) { assert.match(edge,/request\.headers\.has\("origin"\)/); assert.doesNotMatch(edge,/access-control-allow-origin/i); }
  assert.doesNotMatch(palisadeEdge+conduitEdge,/service_role_key|SUPABASE_SERVICE_ROLE_KEY/);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await validatePhase5Repository();
  process.stdout.write("Phase 5 Pages Palisade-Conduit runtime validation passed.\n");
}
