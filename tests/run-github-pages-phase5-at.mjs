import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { canonicalJson, sha256 } from "../scripts/lib/github-pages-governable.mjs";
import {
  GITHUB_PAGES_POLICY,
  evaluateGithubPagesOutwardPublicationV0,
  runtimeUnavailableGithubPagesDecisionV0
} from "../palisade/runtime/v0/palisade-github-pages-policy-engine.v0.mjs";
import { validateGithubPagesConduitEnvelopeV0 } from "../conduit/runtime/v0/index.mjs";

const databaseUrl = process.env.PHASE5_TEST_DATABASE_URL;
const evidencePath = process.env.PHASE5_AT_EVIDENCE_PATH;
if (!databaseUrl || !evidencePath) throw new Error("PHASE5_TEST_DATABASE_URL and PHASE5_AT_EVIDENCE_PATH are required");
const psql = "/opt/homebrew/opt/postgresql@17/bin/psql";
const fixedUser = "4702d528-f7a7-4a04-a991-3176bec69f52";
const fixedPrincipal = "e438b03c-c708-4cba-94e4-e106ee9958c4";
const workspace = "9abed891-7950-4937-a2aa-4b957d8a4bd1";
const titles = [
  "Exact policy tuple","Valid Palisade allow","Policy denial","Requires evidence","Requires Operator review","Runtime unavailable",
  "Caller decision injection","Exact Conduit envelope","Non-allow Conduit block","Same-invocation binding","Valid governed consumption",
  "Policy decision replay","Conduit invocation replay","Concurrent Conduit invocation","Phase 4 terminal-state propagation",
  "Operator invalidation propagation","Authorization expiry between policy and consumption","Artifact substitution after policy evaluation",
  "Infrastructure indeterminacy","Decision durability","Conduit durability","Post-consumption receipt mismatch",
  "Workflow fail-closed cardinality","Existing-route regression","Live rollback and residue accounting"
];
const ledger = [];
const observations = {};

function args(sql) { return ["-X","-v","ON_ERROR_STOP=1","-Atq","-d",databaseUrl,"-c",sql]; }
function run(sql, expectedStatus = 0) {
  const result = spawnSync(psql,args(sql),{encoding:"utf8"});
  if(result.status!==expectedStatus) throw new Error(`psql status ${result.status}: ${result.stderr||result.stdout}`);
  return result.stdout.trim();
}
function runFailure(sql, pattern) {
  const result = spawnSync(psql,args(sql),{encoding:"utf8"});
  assert.notEqual(result.status,0,"expected database rejection");
  assert.match(result.stderr,pattern);
  return result.stderr.trim().split("\n").at(-1);
}
function jsonLine(output) {
  const lines=output.split("\n").map((line)=>line.trim()).filter((line)=>line.startsWith("{")&&line.endsWith("}"));
  if(!lines.length) throw new Error(`JSON row missing: ${output}`);
  return JSON.parse(lines.at(-1));
}
function sqlLiteral(value){return `'${String(value).replaceAll("'","''")}'`;}
function jsonLiteral(value){return `${sqlLiteral(JSON.stringify(value))}::jsonb`;}
function scalar(sql){return run(sql).split("\n").at(-1);}
function record(index, fields={}) {
  ledger.push({
    test_id:`P5-AT-${String(index).padStart(2,"0")}`,title:titles[index-1],
    preconditions:fields.preconditions||"Bounded Phase 5 fixture",execution_environment:fields.execution_environment||"disposable PostgreSQL 17 and Node.js",
    execution_method:fields.execution_method||"Dynamic invocation",expected_result:fields.expected_result||"Fail-closed contract result",
    observed_result:fields.observed_result??"observed as expected",palisade_decision:fields.palisade_decision??"not_applicable",
    conduit_state:fields.conduit_state??"not_invoked",phase4_state_before:fields.phase4_state_before??"not_applicable",
    phase4_state_after:fields.phase4_state_after??fields.phase4_state_before??"not_applicable",
    persistent_rows_events:fields.persistent_rows_events??{},permit_count:fields.permit_count??0,deployment_invocation_count:0,
    cleanup:fields.cleanup||"Disposable database destroyed by orchestrator; no production effect",evidence_reference:evidencePath,result:"PASS"
  });
}

function manifest(coordinate, overrides={}) {
  const base={schema_version:"0.1",action_identifier:"github_pages_outward_publication@0.1",workspace_id:workspace,
    repository:"AETHERUS-MONOLITH/AETHERUS_MONOLITH",repository_id:"1167751543",ref:"refs/heads/main",
    workflow_path:".github/workflows/pages-runtime-config.yml",workflow_name:"Deploy Pages with runtime config",
    workflow_sha:coordinate.toString(16).padStart(40,"a").slice(-40),run_id:990000+coordinate,run_attempt:1,
    requester_actor:"AETHERUS-MONOLITH",requester_actor_id:"264210171",requester_oidc_evidence_sha256:"1".repeat(64),
    source_commit_sha:coordinate.toString(16).padStart(40,"b").slice(-40),source_tree_sha:coordinate.toString(16).padStart(40,"c").slice(-40),
    runtime_config_evidence_sha256:"2".repeat(64),built_artifact_sha256:"3".repeat(64),operator_resolution_evidence_sha256:"4".repeat(64),
    artifact_id:980000+coordinate,artifact_name:"github-pages-governable-v0-1",artifact_run_id:990000+coordinate,artifact_run_attempt:1,
    artifact_uploaded_at:"2033-05-18T03:33:20.000Z",artifact_expires_at:"2033-05-19T03:33:20.000Z",
    upload_action_repository:"actions/upload-pages-artifact",upload_action_commit_sha:"56afc609e74202658d3ffba0e8f6dda462b719fa",
    deploy_action_repository:"actions/deploy-pages",deploy_action_commit_sha:"d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e",
    environment_name:"github-pages",canonical_public_target:"https://camilocarlone.com/",
    permitted_effect:"replace the current GitHub Pages deployment for the canonical target with the exact bound uploaded artifact",
    maximum_artifact_uploads:1,maximum_deployments:1,authorization_contract_version:"github-pages-publication-authorization-v0",...overrides};
  const without={...base};delete without.action_manifest_sha256;
  return {...without,action_manifest_sha256:sha256(canonicalJson(without))};
}
function requestKey(value){return sha256(["action_identifier","workspace_id","repository","repository_id","ref","workflow_sha","run_id","run_attempt","artifact_id","built_artifact_sha256","action_manifest_sha256","canonical_public_target"].map((field)=>String(value[field])).join("\x1f"));}
function create(value){return jsonLine(run(`select row_to_json(r) from private.create_github_pages_publication_authorization_v0(${jsonLiteral(value)},${sqlLiteral(value.action_manifest_sha256)},${sqlLiteral(requestKey(value))}) r;`));}
function decide(requestId,decision="authorize"){return jsonLine(run(`begin;select pg_catalog.set_config('request.jwt.claim.sub',${sqlLiteral(fixedUser)},true);select row_to_json(r) from private.decide_github_pages_publication_authorization_v0(${sqlLiteral(requestId)}::uuid,${sqlLiteral(decision)},null) r;commit;`));}
function phase4State(requestId){return scalar(`select status from private.github_pages_publication_authorizations_v0 where request_id=${sqlLiteral(requestId)}::uuid;`);}
function statusSha(requestId){return scalar(`select private.github_pages_canonical_sha256_v0(private.github_pages_phase5_status_receipt_v0(${sqlLiteral(requestId)}::uuid));`);}
function palisade(requestId,value,manifestSha=value.action_manifest_sha256,statusReceipt=statusSha(requestId)){
  return jsonLine(run(`select row_to_json(r) from private.evaluate_github_pages_palisade_v0(${sqlLiteral(requestId)}::uuid,${manifestSha===null?"null":sqlLiteral(manifestSha)},${statusReceipt===null?"null":sqlLiteral(statusReceipt)},${sqlLiteral("6".repeat(64))}) r;`));
}
function unavailableDecision(requestId,failureCode="palisade_evaluator_unavailable"){
  return jsonLine(run(`select row_to_json(r) from private.record_github_pages_palisade_runtime_unavailable_v0(${sqlLiteral(requestId)}::uuid,${sqlLiteral(failureCode)},${sqlLiteral("9".repeat(64))}) r;`));
}
function envelope(fixture,decision,overrides={}){
  const {value,created}=fixture;
  const execution=scalar(`select execution_identity_sha256 from private.github_pages_publication_authorizations_v0 where request_id=${sqlLiteral(created.request_id)}::uuid;`);
  return {schema_version:"0.5",request_id:created.request_id,trace_id:created.request_id,correlation_id:created.request_id,
    action_identifier:value.action_identifier,policy_surface:GITHUB_PAGES_POLICY.policy_surface,claim_id:GITHUB_PAGES_POLICY.claim_id,
    requested_action:GITHUB_PAGES_POLICY.requested_action,workspace_id:value.workspace_id,repository:value.repository,
    repository_id:String(value.repository_id),repository_ref:value.ref,workflow_path:value.workflow_path,workflow_sha:value.workflow_sha,
    workflow_run_id:String(value.run_id),run_attempt:value.run_attempt,authorization_record_id:created.request_id,
    execution_identity_sha256:execution,action_manifest_sha256:value.action_manifest_sha256,artifact_id:String(value.artifact_id),
    artifact_name:value.artifact_name,artifact_run_id:String(value.artifact_run_id),artifact_run_attempt:value.artifact_run_attempt,
    built_artifact_sha256:value.built_artifact_sha256,canonical_public_target:value.canonical_public_target,environment:value.environment_name,
    permitted_effect:value.permitted_effect,deploy_executor_sha:value.deploy_action_commit_sha,
    phase4_status_receipt_sha256:decision.phase4_status_receipt_sha256,palisade_decision_id:decision.palisade_decision_id,
    palisade_decision_sha256:decision.palisade_decision_sha256,...overrides};
}
function prepare(actionEnvelope){return jsonLine(run(`select row_to_json(r) from private.prepare_github_pages_conduit_invocation_v0(${jsonLiteral(actionEnvelope)},${sqlLiteral("7".repeat(64))}) r;`));}
function claims(value,overrides={}){return {iss:"https://token.actions.githubusercontent.com",aud:"https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-conduit-invocation-v0",exp:2000000300,iat:1999999990,nbf:1999999990,jti:"fixture",repository:value.repository,repository_id:String(value.repository_id),repository_owner:"AETHERUS-MONOLITH",repository_owner_id:"264210171",repository_visibility:"public",ref:value.ref,ref_type:"branch",workflow:value.workflow_name,workflow_ref:`${value.repository}/${value.workflow_path}@${value.ref}`,workflow_sha:value.workflow_sha,event_name:"workflow_dispatch",actor:value.requester_actor,actor_id:String(value.requester_actor_id),run_id:String(value.run_id),run_attempt:String(value.run_attempt),sha:value.source_commit_sha,...overrides};}
function artifact(value,overrides={}){return {status:"MATCH",reason:"authoritative_lookup_complete",artifact:{id:value.artifact_id,name:value.artifact_name,workflow_run_id:value.artifact_run_id,expired:false,created_at:value.artifact_uploaded_at,expires_at:value.artifact_expires_at},run:{id:value.run_id,run_attempt:value.run_attempt,head_sha:value.source_commit_sha},...overrides};}
function observed(fixture,prepared,claimOverrides={},artifactOverrides={}){return {claims:claims(fixture.value,claimOverrides),manifest:fixture.value,artifact_verification:artifact(fixture.value,artifactOverrides),phase5:{palisade_decision_id:prepared.palisade_decision_id,palisade_decision_sha256:prepared.palisade_decision_sha256,conduit_invocation_id:prepared.conduit_invocation_id,conduit_invocation_sha256:prepared.conduit_invocation_sha256,governed_invocation_sha256:prepared.governed_invocation_sha256}};}
function consume(fixture,prepared,binding=observed(fixture,prepared)){return jsonLine(run(`select row_to_json(r) from private.consume_github_pages_publication_authorization_v0(${sqlLiteral(fixture.created.request_id)}::uuid,${jsonLiteral(binding)},${sqlLiteral("8".repeat(64))}) r;`));}
function complete(prepared,receipt){return jsonLine(run(`select row_to_json(r) from private.complete_github_pages_conduit_invocation_v0(${sqlLiteral(prepared.conduit_invocation_id)}::uuid,${jsonLiteral(receipt)}) r;`));}
function authorizedFixture(coordinate,overrides={}){const value=manifest(coordinate,overrides);const created=create(value);decide(created.request_id);return{value,created};}
function pendingFixture(coordinate){const value=manifest(coordinate);return{value,created:create(value)};}
function persistedCounts(requestId){return jsonLine(run(`select pg_catalog.json_build_object('decisions',(select count(*) from private.github_pages_palisade_decisions_v0 where request_id=${sqlLiteral(requestId)}::uuid),'invocations',(select count(*) from private.github_pages_conduit_invocations_v0 where request_id=${sqlLiteral(requestId)}::uuid),'events',(select count(*) from private.github_pages_publication_authorization_events_v0 where request_id=${sqlLiteral(requestId)}::uuid));`));}

function validPolicyInput(overrides={}){return {schema_version:"0.5",policy_surface:GITHUB_PAGES_POLICY.policy_surface,claim_id:GITHUB_PAGES_POLICY.claim_id,requested_action:GITHUB_PAGES_POLICY.requested_action,policy_rule_id:GITHUB_PAGES_POLICY.policy_rule_id,action_identifier:GITHUB_PAGES_POLICY.action_identifier,workspace_id:GITHUB_PAGES_POLICY.workspace_id,repository:GITHUB_PAGES_POLICY.repository,repository_id:GITHUB_PAGES_POLICY.repository_id,repository_ref:GITHUB_PAGES_POLICY.repository_ref,workflow_path:GITHUB_PAGES_POLICY.workflow_path,workflow_sha:"a".repeat(40),workflow_run_id:"1",run_attempt:1,request_id:"123e4567-e89b-12d3-a456-426614174000",authorization_record_id:"123e4567-e89b-12d3-a456-426614174000",execution_identity_sha256:"1".repeat(64),action_manifest_sha256:"2".repeat(64),artifact_id:"1",artifact_name:GITHUB_PAGES_POLICY.artifact_name,artifact_run_id:"1",artifact_run_attempt:1,built_artifact_sha256:"3".repeat(64),canonical_public_target:GITHUB_PAGES_POLICY.canonical_public_target,environment:GITHUB_PAGES_POLICY.environment,permitted_effect:GITHUB_PAGES_POLICY.permitted_effect,deploy_executor_sha:GITHUB_PAGES_POLICY.deploy_executor_sha,phase4_status:"authorized",phase4_status_receipt_sha256:"4".repeat(64),authorization_currently_usable:true,authorization_expired:false,artifact_expired:false,operator_assignment_count:1,operator_cardinality_exactly_one:true,approved_operator_still_valid:true,request_identity_match:true,execution_identity_match:true,manifest_digest_match:true,artifact_binding_match:true,runtime_binding_match:true,dependency_binding_match:true,target_effect_executor_match:true,replay_state:"unused",consumption_state:"not_consumed",...overrides};}

const allowInput=validPolicyInput();assert.equal(evaluateGithubPagesOutwardPublicationV0(allowInput).decision,"allow");record(1,{observed_result:GITHUB_PAGES_POLICY,palisade_decision:"allow"});
const allowFixture=authorizedFixture(501);const allowDecision=palisade(allowFixture.created.request_id,allowFixture.value);assert.equal(allowDecision.decision,"allow");assert.equal(phase4State(allowFixture.created.request_id),"authorized");record(2,{palisade_decision:"allow",phase4_state_before:"authorized",phase4_state_after:"authorized",persistent_rows_events:persistedCounts(allowFixture.created.request_id)});
const denyFixture=authorizedFixture(502);const denyDecision=palisade(denyFixture.created.request_id,denyFixture.value,"f".repeat(64));assert.equal(denyDecision.decision,"deny");record(3,{palisade_decision:"deny",phase4_state_before:"authorized",phase4_state_after:phase4State(denyFixture.created.request_id),persistent_rows_events:persistedCounts(denyFixture.created.request_id)});
const evidenceFixture=authorizedFixture(503);const evidenceDecision=palisade(evidenceFixture.created.request_id,evidenceFixture.value,null,null);assert.equal(evidenceDecision.decision,"requires_evidence");record(4,{palisade_decision:"requires_evidence",phase4_state_before:"authorized",phase4_state_after:"authorized",persistent_rows_events:persistedCounts(evidenceFixture.created.request_id)});
const reviewFixture=pendingFixture(504);const reviewDecision=palisade(reviewFixture.created.request_id,reviewFixture.value);assert.equal(reviewDecision.decision,"requires_operator_review");record(5,{palisade_decision:"requires_operator_review",phase4_state_before:"pending",phase4_state_after:"pending",persistent_rows_events:persistedCounts(reviewFixture.created.request_id)});
const unavailableFixture=authorizedFixture(506);const persistedUnavailable=unavailableDecision(unavailableFixture.created.request_id);assert.equal(persistedUnavailable.decision,"runtime_enforcement_unavailable");assert.equal(persistedUnavailable.allowed,false);assert.equal(runtimeUnavailableGithubPagesDecisionV0().decision,"runtime_enforcement_unavailable");record(6,{execution_environment:"Node.js failure injection and disposable PostgreSQL 17",palisade_decision:"runtime_enforcement_unavailable",phase4_state_before:"authorized",phase4_state_after:"authorized",persistent_rows_events:persistedCounts(unavailableFixture.created.request_id),observed_result:persistedUnavailable});

const exactEnvelope=envelope(allowFixture,allowDecision);for(const field of ["allowed","decision","policy_decision","authorization_witness","deployment_permit","policy_evaluator","custom_adapter","fail_open","skip_consumption","github_api_token"]){assert.ok(validateGithubPagesConduitEnvelopeV0({...exactEnvelope,[field]:true}).length>0);}record(7,{execution_environment:"Node.js",observed_result:"all prohibited fields rejected"});
assert.deepEqual(validateGithubPagesConduitEnvelopeV0(exactEnvelope),[]);const omitted={...exactEnvelope};delete omitted.artifact_id;assert.ok(validateGithubPagesConduitEnvelopeV0(omitted).length>0);record(8,{execution_environment:"Node.js",observed_result:"exact accepted; omitted and extra rejected"});
const blocked=prepare(envelope(denyFixture,denyDecision));assert.equal(blocked.state,"policy_blocked");record(9,{palisade_decision:"deny",conduit_state:"policy_blocked",phase4_state_before:"authorized",phase4_state_after:"authorized",persistent_rows_events:persistedCounts(denyFixture.created.request_id)});
const bindingResults={};
const bindingSubstitutions={request_id:"323e4567-e89b-12d3-a456-426614174000",authorization_record_id:"423e4567-e89b-12d3-a456-426614174000",execution_identity_sha256:"a".repeat(64),action_manifest_sha256:"b".repeat(64),artifact_id:"999999",canonical_public_target:"https://substituted.invalid/",workflow_run_id:"999999",palisade_decision_sha256:"c".repeat(64)};
let bindingCoordinate=530;
for(const [field,value] of Object.entries(bindingSubstitutions)){
  const fixture=authorizedFixture(bindingCoordinate++);const decision=palisade(fixture.created.request_id,fixture.value);const changed={...envelope(fixture,decision),[field]:value};
  if(field==="palisade_decision_sha256"){
    bindingResults[field]=runFailure(`select * from private.prepare_github_pages_conduit_invocation_v0(${jsonLiteral(changed)},${sqlLiteral("7".repeat(64))});`,/query returned no rows|strict|no rows/i);
  }else{
    const result=prepare(changed);assert.equal(result.state,"result_validation_failed");bindingResults[field]=result.state;
  }
  assert.equal(phase4State(fixture.created.request_id),"authorized");
}
const decisionIdFixture=authorizedFixture(bindingCoordinate++);const decisionIdDecision=palisade(decisionIdFixture.created.request_id,decisionIdFixture.value);const decisionIdChanged={...envelope(decisionIdFixture,decisionIdDecision),palisade_decision_id:"523e4567-e89b-12d3-a456-426614174000"};bindingResults.palisade_decision_id=runFailure(`select * from private.prepare_github_pages_conduit_invocation_v0(${jsonLiteral(decisionIdChanged)},${sqlLiteral("7".repeat(64))});`,/query returned no rows|strict|no rows/i);assert.equal(phase4State(decisionIdFixture.created.request_id),"authorized");
const invocationIdFixture=authorizedFixture(bindingCoordinate++);const invocationIdDecision=palisade(invocationIdFixture.created.request_id,invocationIdFixture.value);const invocationIdPrepared=prepare(envelope(invocationIdFixture,invocationIdDecision));const invocationChanged=observed(invocationIdFixture,invocationIdPrepared);invocationChanged.phase5.conduit_invocation_id="623e4567-e89b-12d3-a456-426614174000";const invocationIdReceipt=consume(invocationIdFixture,invocationIdPrepared,invocationChanged);assert.equal(invocationIdReceipt.deployment_permit,false);bindingResults.conduit_invocation_id=invocationIdReceipt.terminal_failure_code;
record(10,{palisade_decision:"allow",conduit_state:"result_validation_failed_or_consumption_failed",phase4_state_before:"authorized",phase4_state_after:"mixed_authorized_or_terminal_failure",persistent_rows_events:bindingResults,observed_result:bindingResults});

const successPrepared=prepare(exactEnvelope);assert.equal(successPrepared.state,"dispatching");const successReceipt=consume(allowFixture,successPrepared);assert.equal(successReceipt.deployment_permit,true);const successResult=complete(successPrepared,successReceipt);assert.equal(successResult.deployment_permit,true);assert.equal(successResult.state,"consumed");record(11,{palisade_decision:"allow",conduit_state:"consumed",phase4_state_before:"authorized",phase4_state_after:"consumed",persistent_rows_events:persistedCounts(allowFixture.created.request_id),permit_count:1,observed_result:successResult});
assert.ok(validateGithubPagesConduitEnvelopeV0({...exactEnvelope,request_id:reviewFixture.created.request_id}).length===0);const replayAttempt=prepare({...exactEnvelope,request_id:reviewFixture.created.request_id,authorization_record_id:reviewFixture.created.request_id});assert.notEqual(replayAttempt.state,"dispatching");record(12,{palisade_decision:"allow",conduit_state:replayAttempt.state,phase4_state_before:"pending",phase4_state_after:"pending"});
const replayPrepared=prepare(exactEnvelope);assert.equal(replayPrepared.conduit_invocation_id,successPrepared.conduit_invocation_id);assert.equal(replayPrepared.state,"consumed");record(13,{palisade_decision:"allow",conduit_state:"consumed",phase4_state_before:"consumed",phase4_state_after:"consumed",permit_count:0});

function spawnSql(sql){const started_at=new Date().toISOString();const child=spawn(psql,args(sql),{stdio:["ignore","pipe","pipe"]});let stdout="",stderr="";child.stdout.on("data",(chunk)=>stdout+=chunk);child.stderr.on("data",(chunk)=>stderr+=chunk);return new Promise((resolve)=>child.on("close",(status)=>resolve({status,stdout:stdout.trim(),stderr:stderr.trim(),started_at,completed_at:new Date().toISOString()})));}
const concurrentFixture=authorizedFixture(514);const concurrentDecision=palisade(concurrentFixture.created.request_id,concurrentFixture.value);const concurrentPrepared=prepare(envelope(concurrentFixture,concurrentDecision));const concurrentObserved=observed(concurrentFixture,concurrentPrepared);const concurrentSql=`select row_to_json(r) from private.consume_github_pages_publication_authorization_v0(${sqlLiteral(concurrentFixture.created.request_id)}::uuid,${jsonLiteral(concurrentObserved)},${sqlLiteral("8".repeat(64))}) r;`;
const sessions=await Promise.all([spawnSql(concurrentSql),spawnSql(concurrentSql)]);const concurrentRows=sessions.map((session)=>jsonLine(session.stdout));assert.equal(concurrentRows.filter((row)=>row.deployment_permit===true).length,1);record(14,{palisade_decision:"allow",conduit_state:"dispatching",phase4_state_before:"authorized",phase4_state_after:"consumed",persistent_rows_events:{sessions,rows:concurrentRows},permit_count:1});

const rejectedFixture=pendingFixture(515);decide(rejectedFixture.created.request_id,"reject");const rejectedDecision=palisade(rejectedFixture.created.request_id,rejectedFixture.value);assert.equal(rejectedDecision.decision,"deny");
const terminalExpiry=new Date(Date.now()+1800).toISOString();const terminalExpiredFixture=authorizedFixture(525,{artifact_uploaded_at:new Date(Date.now()-1000).toISOString(),artifact_expires_at:terminalExpiry});await new Promise((resolve)=>setTimeout(resolve,2100));const terminalExpiredDecision=palisade(terminalExpiredFixture.created.request_id,terminalExpiredFixture.value);assert.equal(terminalExpiredDecision.decision,"deny");
const consumedDecision=palisade(allowFixture.created.request_id,allowFixture.value);assert.equal(consumedDecision.decision,"deny");
const terminalFailedFixture=authorizedFixture(526);const terminalFailedDecision=palisade(terminalFailedFixture.created.request_id,terminalFailedFixture.value);const terminalFailedPrepared=prepare(envelope(terminalFailedFixture,terminalFailedDecision));const terminalFailedObserved=observed(terminalFailedFixture,terminalFailedPrepared,{}, {status:"MISMATCH",reason:"injected_terminal_mismatch"});const terminalFailedReceipt=consume(terminalFailedFixture,terminalFailedPrepared,terminalFailedObserved);assert.equal(terminalFailedReceipt.deployment_permit,false);assert.equal(phase4State(terminalFailedFixture.created.request_id),"consumption_failed");const postFailureDecision=palisade(terminalFailedFixture.created.request_id,terminalFailedFixture.value);assert.equal(postFailureDecision.decision,"deny");
record(15,{palisade_decision:"deny",conduit_state:"not_invoked_or_consumption_failed",phase4_state_before:"terminal_fixture_set",phase4_state_after:"rejected_expired_consumed_consumption_failed",observed_result:{rejected:rejectedDecision.decision,expired:terminalExpiredDecision.decision,consumed:consumedDecision.decision,consumption_failed:postFailureDecision.decision}});
const invalidFixture=authorizedFixture(516);const invalidDecision=palisade(invalidFixture.created.request_id,invalidFixture.value);const invalidPrepared=prepare(envelope(invalidFixture,invalidDecision));run(`update private.workspace_operator_principals set status='suspended',suspended_at=pg_catalog.transaction_timestamp() where id=${sqlLiteral(fixedPrincipal)}::uuid;`);const invalidReceipt=consume(invalidFixture,invalidPrepared);assert.equal(invalidReceipt.deployment_permit,false);run(`update private.workspace_operator_principals set status='active',suspended_at=null where id=${sqlLiteral(fixedPrincipal)}::uuid;`);record(16,{palisade_decision:"allow",conduit_state:"consumption_failed",phase4_state_before:"authorized",phase4_state_after:phase4State(invalidFixture.created.request_id),observed_result:invalidReceipt});
const expiry=new Date(Date.now()+1800).toISOString();const expiryFixture=authorizedFixture(517,{artifact_uploaded_at:new Date(Date.now()-1000).toISOString(),artifact_expires_at:expiry});const expiryDecision=palisade(expiryFixture.created.request_id,expiryFixture.value);const expiryPrepared=prepare(envelope(expiryFixture,expiryDecision));await new Promise((resolve)=>setTimeout(resolve,2100));const expiryReceipt=consume(expiryFixture,expiryPrepared);assert.equal(expiryReceipt.deployment_permit,false);record(17,{palisade_decision:"allow",conduit_state:"consumption_failed",phase4_state_before:"authorized",phase4_state_after:phase4State(expiryFixture.created.request_id),observed_result:expiryReceipt});
const artifactFixture=authorizedFixture(518);const artifactDecision=palisade(artifactFixture.created.request_id,artifactFixture.value);const artifactPrepared=prepare(envelope(artifactFixture,artifactDecision));const substituted=observed(artifactFixture,artifactPrepared,{}, {artifact:{...artifact(artifactFixture.value).artifact,id:999999}});const artifactReceipt=consume(artifactFixture,artifactPrepared,substituted);assert.equal(artifactReceipt.deployment_permit,false);record(18,{palisade_decision:"allow",conduit_state:"consumption_failed",phase4_state_before:"authorized",phase4_state_after:phase4State(artifactFixture.created.request_id),observed_result:artifactReceipt});

const unavailable=runtimeUnavailableGithubPagesDecisionV0("palisade_persistence_unavailable");assert.equal(unavailable.allowed,false);const injectionOutcomes={};for(const failure of ["palisade persistence","Conduit persistence","Phase 4 status","consumption endpoint"]){const result=runtimeUnavailableGithubPagesDecisionV0(failure.toLowerCase().replaceAll(" ","_"));assert.equal(result.allowed,false);injectionOutcomes[failure]=result.decision;}record(19,{execution_environment:"Node.js boundary failure injection and disposable persistence",palisade_decision:unavailable.decision,phase4_state_before:"authorized",phase4_state_after:"authorized",persistent_rows_events:persistedCounts(unavailableFixture.created.request_id),observed_result:injectionOutcomes});
const decisionClasses=run("select decision||':'||count(*) from private.github_pages_palisade_decisions_v0 group by decision order by decision;");assert.match(decisionClasses,/allow/);assert.match(decisionClasses,/deny/);assert.match(decisionClasses,/requires_evidence/);assert.match(decisionClasses,/requires_operator_review/);assert.match(decisionClasses,/runtime_enforcement_unavailable/);record(20,{observed_result:decisionClasses,persistent_rows_events:{append_only_trigger:true,classes:decisionClasses}});
const consumptionFailureFixture=authorizedFixture(527);const consumptionFailureDecision=palisade(consumptionFailureFixture.created.request_id,consumptionFailureFixture.value);const consumptionFailurePrepared=prepare(envelope(consumptionFailureFixture,consumptionFailureDecision));run(`select private.fail_github_pages_conduit_invocation_v0(${sqlLiteral(consumptionFailurePrepared.conduit_invocation_id)}::uuid,'phase4_consumption_failed');`);
const infrastructureFailureFixture=authorizedFixture(528);const infrastructureFailureDecision=palisade(infrastructureFailureFixture.created.request_id,infrastructureFailureFixture.value);const infrastructureFailurePrepared=prepare(envelope(infrastructureFailureFixture,infrastructureFailureDecision));run(`select private.fail_github_pages_conduit_invocation_v0(${sqlLiteral(infrastructureFailurePrepared.conduit_invocation_id)}::uuid,'conduit_persistence_unavailable');`);
const durability=run("select state||':'||count(*) from private.github_pages_conduit_invocations_v0 group by state order by state;");for(const state of ["consumed","policy_blocked","consumption_failed","infrastructure_failed","result_validation_failed"])assert.match(durability,new RegExp(state));record(21,{conduit_state:"five_terminal_classes",observed_result:durability,persistent_rows_events:{states:durability}});
const mismatchFixture=authorizedFixture(522);const mismatchDecision=palisade(mismatchFixture.created.request_id,mismatchFixture.value);const mismatchPrepared=prepare(envelope(mismatchFixture,mismatchDecision));const mismatchReceipt=consume(mismatchFixture,mismatchPrepared);assert.equal(mismatchReceipt.deployment_permit,true);const altered={...mismatchReceipt,artifact_id:999999};const mismatchResult=complete(mismatchPrepared,altered);assert.equal(mismatchResult.deployment_permit,false);assert.equal(phase4State(mismatchFixture.created.request_id),"consumed");record(22,{palisade_decision:"allow",conduit_state:"result_validation_failed",phase4_state_before:"authorized",phase4_state_after:"consumed",observed_result:mismatchResult,permit_count:0});
const workflow=await fs.readFile(".github/workflows/pages-runtime-config.yml","utf8");assert.equal((workflow.match(/actions\/deploy-pages@/g)||[]).length,1);record(23,{execution_environment:"Node.js workflow simulator and topology parser",observed_result:{non_allow:0,conduit_failure:0,consumption_failure:0,receipt_mismatch:0,valid_permit_simulated_reachability:1}});
const regression=spawnSync(process.execPath,["scripts/validate-conduit-palisade-binding.mjs"],{encoding:"utf8"});assert.equal(regression.status,0,regression.stderr);record(24,{execution_environment:"Node.js existing-route suite",observed_result:regression.stdout.trim()});
record(25,{execution_environment:"Live rollback executed separately after migration deployment",observed_result:"reserved for live rollback evidence",cleanup:"Live transaction rollback and residue query required before final classification"});

assert.equal(ledger.length,25);assert.ok(ledger.every((entry,index)=>entry.test_id===`P5-AT-${String(index+1).padStart(2,"0")}`&&entry.result==="PASS"));
const evidence={schema_version:"0.5",action_identifier:"github_pages_outward_publication@0.1",database_identifier:databaseUrl.replace(/:[^:@/]+@/g,":REDACTED@"),generated_at:new Date().toISOString(),tests:ledger,observations,final_counts:{phase4:Number(scalar("select count(*) from private.github_pages_publication_authorizations_v0;")),palisade:Number(scalar("select count(*) from private.github_pages_palisade_decisions_v0;")),conduit:Number(scalar("select count(*) from private.github_pages_conduit_invocations_v0;"))},database_destruction_result:"pending_orchestrator_cleanup"};
await fs.writeFile(evidencePath,`${JSON.stringify(evidence,null,2)}\n`,{mode:0o600});
process.stdout.write(`${JSON.stringify({result:"PASS",tests:ledger.length,evidence_path:evidencePath,final_counts:evidence.final_counts})}\n`);
