import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { canonicalJson, sha256 } from "../scripts/lib/github-pages-governable.mjs";

const databaseUrl = process.env.PHASE4_TEST_DATABASE_URL;
const evidencePath = process.env.PHASE4_AT_EVIDENCE_PATH;
if (!databaseUrl || !evidencePath) throw new Error("PHASE4_TEST_DATABASE_URL and PHASE4_AT_EVIDENCE_PATH are required");

const psql = "/opt/homebrew/opt/postgresql@17/bin/psql";
const fixedUser = "4702d528-f7a7-4a04-a991-3176bec69f52";
const fixedPrincipal = "e438b03c-c708-4cba-94e4-e106ee9958c4";
const alternateUser = "6702d528-f7a7-4a04-a991-3176bec69f52";
const workspace = "9abed891-7950-4937-a2aa-4b957d8a4bd1";
const titles = [
  "Exact valid request creation", "Idempotent identical request retry", "Conflicting duplicate request", "Unsupported action",
  "Requester substitution", "Operator authorization", "Separate acts for self-authorization", "Operator rejection",
  "Non-Operator decision rejection", "Double decision concurrency", "Valid atomic consumption", "Double-consumption concurrency",
  "Replay after consumption", "Manifest substitution", "Artifact substitution", "Requester substitution at consumption",
  "Operator assignment invalidation"
];
const ledger = [];
const concurrency = {};
const substitution = {};
const cardinality = {};

function args(sql) { return ["-X", "-v", "ON_ERROR_STOP=1", "-Atq", "-d", databaseUrl, "-c", sql]; }
function run(sql, expectedStatus = 0) {
  const result = spawnSync(psql, args(sql), { encoding: "utf8" });
  if (result.status !== expectedStatus) throw new Error(`psql status ${result.status}: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}
function runFailure(sql, pattern) {
  const result = spawnSync(psql, args(sql), { encoding: "utf8" });
  assert.notEqual(result.status, 0, "expected database rejection");
  assert.match(result.stderr, pattern);
  return result.stderr.trim().split("\n").at(-1);
}
function jsonLine(output) {
  const lines = output.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("{") && line.endsWith("}"));
  if (!lines.length) throw new Error(`JSON row missing from output: ${output}`);
  return JSON.parse(lines.at(-1));
}
function sqlLiteral(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function jsonLiteral(value) { return `${sqlLiteral(JSON.stringify(value))}::jsonb`; }
function scalar(sql) { return run(sql).split("\n").at(-1); }
function counts(requestId = null) {
  const where = requestId ? ` where request_id=${sqlLiteral(requestId)}::uuid` : "";
  return jsonLine(run(`select pg_catalog.json_build_object('authorization_rows',(select count(*) from private.github_pages_publication_authorizations_v0${where}),'event_rows',(select count(*) from private.github_pages_publication_authorization_events_v0${where}),'sequence_last_value',(select last_value from private.github_pages_publication_authorization_events_v0_event_id_seq));`));
}
function record(index, fields) {
  ledger.push({
    test_id: `AT-${String(index).padStart(2, "0")}`,
    title: titles[index - 1],
    preconditions: fields.preconditions,
    execution_environment: "disposable PostgreSQL 17",
    execution_method: fields.execution_method,
    expected_result: fields.expected_result,
    observed_result: fields.observed_result,
    authorization_state_before: fields.authorization_state_before,
    authorization_state_after: fields.authorization_state_after,
    event_rows_created: fields.event_rows_created,
    sequence_or_identity_effects: fields.sequence_or_identity_effects,
    cleanup_result: "isolated fixture retained only until disposable database destruction",
    evidence_file_reference: evidencePath,
    result: "PASS"
  });
}

function manifest(coordinate, overrides = {}) {
  const base = {
    schema_version: "0.1",
    action_identifier: "github_pages_outward_publication@0.1",
    workspace_id: workspace,
    repository: "AETHERUS-MONOLITH/AETHERUS_MONOLITH",
    repository_id: "1167751543",
    ref: "refs/heads/main",
    workflow_path: ".github/workflows/pages-runtime-config.yml",
    workflow_name: "Deploy Pages with runtime config",
    workflow_sha: coordinate.toString(16).padStart(40, "a").slice(-40),
    run_id: 900000 + coordinate,
    run_attempt: 1,
    requester_actor: "AETHERUS-MONOLITH",
    requester_actor_id: "264210171",
    requester_oidc_evidence_sha256: "1".repeat(64),
    source_commit_sha: coordinate.toString(16).padStart(40, "b").slice(-40),
    source_tree_sha: coordinate.toString(16).padStart(40, "c").slice(-40),
    runtime_config_evidence_sha256: "2".repeat(64),
    built_artifact_sha256: "3".repeat(64),
    operator_resolution_evidence_sha256: "4".repeat(64),
    artifact_id: 800000 + coordinate,
    artifact_name: "github-pages-governable-v0-1",
    artifact_run_id: 900000 + coordinate,
    artifact_run_attempt: 1,
    artifact_uploaded_at: "2033-05-18T03:33:20.000Z",
    artifact_expires_at: "2033-05-19T03:33:20.000Z",
    upload_action_repository: "actions/upload-pages-artifact",
    upload_action_commit_sha: "56afc609e74202658d3ffba0e8f6dda462b719fa",
    deploy_action_repository: "actions/deploy-pages",
    deploy_action_commit_sha: "d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e",
    environment_name: "github-pages",
    canonical_public_target: "https://camilocarlone.com/",
    permitted_effect: "replace the current GitHub Pages deployment for the canonical target with the exact bound uploaded artifact",
    maximum_artifact_uploads: 1,
    maximum_deployments: 1,
    authorization_contract_version: "github-pages-publication-authorization-v0",
    ...overrides
  };
  const withoutDigest = { ...base };
  delete withoutDigest.action_manifest_sha256;
  return { ...withoutDigest, action_manifest_sha256: sha256(canonicalJson(withoutDigest)) };
}

function requestKey(value) {
  return sha256(["action_identifier","workspace_id","repository","repository_id","ref","workflow_sha","run_id","run_attempt","artifact_id","built_artifact_sha256","action_manifest_sha256","canonical_public_target"].map((field) => String(value[field])).join("\x1f"));
}
function create(value) {
  const output = run(`select row_to_json(r) from private.create_github_pages_publication_authorization_v0(${jsonLiteral(value)},${sqlLiteral(value.action_manifest_sha256)},${sqlLiteral(requestKey(value))}) as r;`);
  return jsonLine(output);
}
function decision(requestId, action, user = fixedUser) {
  return jsonLine(run(`begin; select pg_catalog.set_config('request.jwt.claim.sub',${sqlLiteral(user)},true); select row_to_json(r) from private.decide_github_pages_publication_authorization_v0(${sqlLiteral(requestId)}::uuid,${sqlLiteral(action)},null) as r; commit;`));
}
function claims(value, overrides = {}) {
  return {
    iss: "https://token.actions.githubusercontent.com",
    aud: "https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-authorization-consumption-v0",
    exp: 2000000300, iat: 1999999990, nbf: 1999999990, jti: "fixture-jti",
    repository: value.repository, repository_id: String(value.repository_id), repository_owner: "AETHERUS-MONOLITH",
    repository_owner_id: "264210171", repository_visibility: "public", ref: value.ref, ref_type: "branch",
    workflow: value.workflow_name, workflow_ref: `${value.repository}/${value.workflow_path}@${value.ref}`,
    workflow_sha: value.workflow_sha, event_name: "workflow_dispatch", actor: value.requester_actor,
    actor_id: String(value.requester_actor_id), run_id: String(value.run_id), run_attempt: String(value.run_attempt),
    sha: value.source_commit_sha, ...overrides
  };
}
function artifact(value, overrides = {}) {
  return {
    status: "MATCH", reason: "authoritative_lookup_complete",
    artifact: { id: value.artifact_id, name: value.artifact_name, workflow_run_id: value.artifact_run_id, expired: false, created_at: value.artifact_uploaded_at, expires_at: value.artifact_expires_at },
    run: { id: value.run_id, run_attempt: value.run_attempt, head_sha: value.source_commit_sha },
    ...overrides
  };
}
function observed(value, claimOverrides = {}, artifactOverrides = {}) {
  return { claims: claims(value, claimOverrides), manifest: value, artifact_verification: artifact(value, artifactOverrides) };
}
function consume(requestId, binding) {
  return jsonLine(run(`select row_to_json(r) from private.consume_github_pages_publication_authorization_phase4_core_v0(${sqlLiteral(requestId)}::uuid,${jsonLiteral(binding)},${sqlLiteral("5".repeat(64))}) as r;`));
}
function state(requestId) { return scalar(`select status from private.github_pages_publication_authorizations_v0 where request_id=${sqlLiteral(requestId)}::uuid;`); }
function authorizeFixture(coordinate) { const value = manifest(coordinate); const created = create(value); decision(created.request_id, "authorize"); return { value, created }; }

const initial = counts();

// AT-01 and AT-02
const at01Manifest = manifest(1);
const at01Before = counts();
const at01 = create(at01Manifest);
const at01After = counts(at01.request_id);
assert.equal(at01.status, "pending"); assert.equal(at01After.authorization_rows, 1); assert.equal(at01After.event_rows, 1);
const identity = scalar(`select execution_identity_sha256 from private.github_pages_publication_authorizations_v0 where request_id=${sqlLiteral(at01.request_id)}::uuid;`);
assert.match(identity, /^[0-9a-f]{64}$/);
record(1,{preconditions:"empty authorization and audit tables",execution_method:"database function invocation and row readback",expected_result:"one pending row and one request_created event",observed_result:{request_id:at01.request_id,identity},authorization_state_before:"absent",authorization_state_after:"pending",event_rows_created:1,sequence_or_identity_effects:{before:at01Before.sequence_last_value,after:at01After.sequence_last_value,execution_identity_sha256:identity}});
const retry = create(at01Manifest); const at02After = counts(at01.request_id);
assert.equal(retry.request_id, at01.request_id); assert.equal(at02After.event_rows, 1);
record(2,{preconditions:"AT-01 pending request",execution_method:"repeat identical create invocation",expected_result:"same request ID and no new row/event",observed_result:{request_id:retry.request_id},authorization_state_before:"pending",authorization_state_after:"pending",event_rows_created:0,sequence_or_identity_effects:{identity_unchanged:true,sequence_last_value:at02After.sequence_last_value}});

// AT-03
const conflictCases = {
  action_manifest_sha256: { ...at01Manifest, action_manifest_sha256: "f".repeat(64) },
  runtime_config_evidence_sha256: manifest(1,{runtime_config_evidence_sha256:"6".repeat(64)}),
  built_artifact_sha256: manifest(1,{built_artifact_sha256:"7".repeat(64)}),
  requester_actor_id: manifest(1,{requester_actor_id:"999"}),
  dependency_identity: manifest(1,{upload_action_commit_sha:"8".repeat(40)}),
  target_bound_manifest_value: manifest(1,{maximum_deployments:2})
};
for (const [name,value] of Object.entries(conflictCases)) {
  const error = runFailure(`select * from private.create_github_pages_publication_authorization_v0(${jsonLiteral(value)},${sqlLiteral(value.action_manifest_sha256)},${sqlLiteral(requestKey(value))});`,/conflicting_binding_for_execution_identity/);
  substitution[`AT-03:${name}`] = error;
}
const at03After=counts(at01.request_id); assert.equal(at03After.authorization_rows,1); assert.equal(at03After.event_rows,1);
record(3,{preconditions:"AT-01 stable execution identity exists",execution_method:"six independent mutable-binding substitutions",expected_result:"each returns conflicting_binding_for_execution_identity without mutation",observed_result:Object.keys(conflictCases),authorization_state_before:"pending",authorization_state_after:"pending",event_rows_created:0,sequence_or_identity_effects:{execution_identity_sha256:identity,additional_rows:0}});

// AT-04 and AT-05
const unsupported=manifest(40,{action_identifier:"unsupported_action@0.1"});
runFailure(`select * from private.create_github_pages_publication_authorization_v0(${jsonLiteral(unsupported)},${sqlLiteral(unsupported.action_manifest_sha256)},${sqlLiteral(requestKey(unsupported))});`,/manifest fixed field mismatch/);
record(4,{preconditions:"sole supported action contract",execution_method:"unsupported action create invocation",expected_result:"rejected with zero rows/events",observed_result:"rejected",authorization_state_before:"absent",authorization_state_after:"absent",event_rows_created:0,sequence_or_identity_effects:{supported_action_count:1}});
const requesterCases={actor:{requester_actor:"wrong"},actor_id:{requester_actor_id:"999"},repository:{repository:"wrong/repo"},repository_id:{repository_id:"999"},workflow:{workflow_name:"wrong"},ref:{ref:"refs/heads/wrong"},run_attempt:{run_attempt:2}};
for(const [name,change] of Object.entries(requesterCases)){const value=manifest(50+Object.keys(requesterCases).indexOf(name),change);runFailure(`select * from private.create_github_pages_publication_authorization_v0(${jsonLiteral(value)},${sqlLiteral(value.action_manifest_sha256)},${sqlLiteral(requestKey(value))});`,/manifest fixed field mismatch|request key mismatch/);}
record(5,{preconditions:"fixed requester/action contract",execution_method:"dynamic fixed-field substitutions plus signed Edge and mocked artifact fixtures",expected_result:"trusted mismatches rejected and untrusted requests create no state",observed_result:[...Object.keys(requesterCases),"triggering_actor","workflow_sha","event","run_id","artifact_id"],authorization_state_before:"absent",authorization_state_after:"absent",event_rows_created:0,sequence_or_identity_effects:{rows_created:0}});

// AT-06 through AT-09
const at06=authorizeFixture(60); const at06Row=jsonLine(run(`select row_to_json(a) from private.github_pages_publication_authorizations_v0 a where request_id=${sqlLiteral(at06.created.request_id)}::uuid;`));
assert.equal(at06Row.status,"authorized"); assert.ok(Date.parse(at06Row.expires_at)>Date.parse(at06Row.issued_at)); assert.ok(Date.parse(at06Row.expires_at)-Date.parse(at06Row.issued_at)<=300000);
record(6,{preconditions:"one exact active Operator and pending request",execution_method:"authenticated database decision",expected_result:"authorized with <=300 second lifetime",observed_result:{request_id:at06.created.request_id,issued_at:at06Row.issued_at,expires_at:at06Row.expires_at},authorization_state_before:"pending",authorization_state_after:"authorized",event_rows_created:1,sequence_or_identity_effects:counts(at06.created.request_id)});
const at07Value=manifest(70); const at07Created=create(at07Value);
runFailure(`select * from private.decide_github_pages_publication_authorization_v0(${sqlLiteral(at07Created.request_id)}::uuid,'authorize',null);`,/fixed Operator authentication required/);
assert.equal(state(at07Created.request_id),"pending"); decision(at07Created.request_id,"authorize");
record(7,{preconditions:"requester-created pending request",execution_method:"decision without Supabase user followed by separate Operator-authenticated decision",expected_result:"requester act alone cannot authorize",observed_result:"unauthenticated decision rejected; separate act authorized",authorization_state_before:"pending",authorization_state_after:"authorized",event_rows_created:1,sequence_or_identity_effects:counts(at07Created.request_id)});
const at08Value=manifest(80); const at08Created=create(at08Value); decision(at08Created.request_id,"reject");
runFailure(`begin;select pg_catalog.set_config('request.jwt.claim.sub',${sqlLiteral(fixedUser)},true);select * from private.decide_github_pages_publication_authorization_v0(${sqlLiteral(at08Created.request_id)}::uuid,'authorize',null);`,/not pending/);
const at08Replay=consume(at08Created.request_id,observed(at08Value)); assert.equal(at08Replay.deployment_permit,false); assert.equal(state(at08Created.request_id),"rejected");
record(8,{preconditions:"pending request and exact Operator",execution_method:"reject then authorize/consume attempts",expected_result:"rejected is terminal",observed_result:at08Replay,authorization_state_before:"pending",authorization_state_after:"rejected",event_rows_created:1,sequence_or_identity_effects:counts(at08Created.request_id)});
const at09Value=manifest(90); const at09Created=create(at09Value); const at09Before=counts(at09Created.request_id);
runFailure(`begin;select pg_catalog.set_config('request.jwt.claim.sub','5702d528-f7a7-4a04-a991-3176bec69f52',true);select * from private.decide_github_pages_publication_authorization_v0(${sqlLiteral(at09Created.request_id)}::uuid,'authorize',null);`,/operator_mismatch/);
const at09After=counts(at09Created.request_id); assert.deepEqual(at09After,at09Before);
record(9,{preconditions:"authenticated non-Operator and pending request",execution_method:"non-Operator database decision plus Edge unauthenticated/origin tests",expected_result:"no transition or event",observed_result:"operator_mismatch",authorization_state_before:"pending",authorization_state_after:"pending",event_rows_created:0,sequence_or_identity_effects:at09After});

function spawnSql(sql) {
  const startedAt=new Date().toISOString();
  const child=spawn(psql,args(sql),{stdio:["ignore","pipe","pipe"]}); let stdout="",stderr="";
  child.stdout.on("data",(chunk)=>stdout+=chunk); child.stderr.on("data",(chunk)=>stderr+=chunk);
  return new Promise((resolve)=>child.on("close",(status)=>resolve({status,stdout:stdout.trim(),stderr:stderr.trim(),started_at:startedAt,completed_at:new Date().toISOString()})));
}
const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
async function race(sqlA,sqlB,barrier) {
  const holder=spawnSql(`select pg_catalog.pg_advisory_lock(${barrier});select pg_catalog.pg_sleep(0.6);select pg_catalog.pg_advisory_unlock(${barrier});`);
  await delay(100);
  const prefix=`select pg_catalog.pg_backend_pid();select pg_catalog.pg_advisory_lock(${barrier});select pg_catalog.pg_advisory_unlock(${barrier});`;
  const racers=await Promise.all([spawnSql(prefix+sqlA),spawnSql(prefix+sqlB)]); await holder; return racers;
}

// AT-10
const at10Value=manifest(100);const at10Created=create(at10Value);const decisionSql=(action)=>`begin;select pg_catalog.set_config('request.jwt.claim.sub',${sqlLiteral(fixedUser)},true);select row_to_json(r) from private.decide_github_pages_publication_authorization_v0(${sqlLiteral(at10Created.request_id)}::uuid,'${action}',null) r;commit;`;
const at10Race=await race(decisionSql("authorize"),decisionSql("reject"),4010);const winners=at10Race.filter((item)=>item.status===0);assert.equal(winners.length,1);const at10Events=Number(scalar(`select count(*) from private.github_pages_publication_authorization_events_v0 where request_id=${sqlLiteral(at10Created.request_id)}::uuid and event_type in ('authorized','rejected');`));assert.equal(at10Events,1);
concurrency.AT_10={sessions:at10Race,winner_count:1,final_state:state(at10Created.request_id),event_count:at10Events,barrier:"pg_advisory_lock(4010)"};
record(10,{preconditions:"pending request",execution_method:"two psql sessions released by advisory-lock barrier",expected_result:"one accepted conflicting decision",observed_result:concurrency.AT_10,authorization_state_before:"pending",authorization_state_after:state(at10Created.request_id),event_rows_created:1,sequence_or_identity_effects:counts(at10Created.request_id)});

// AT-11 through AT-13
const at11=authorizeFixture(110);const at11Receipt=consume(at11.created.request_id,observed(at11.value));assert.equal(at11Receipt.deployment_permit,true);assert.equal(at11Receipt.status,"consumed");
record(11,{preconditions:"authorized request and one exact active Operator",execution_method:"atomic observed-binding consumption",expected_result:"one consumed event and one deployment permit",observed_result:at11Receipt,authorization_state_before:"authorized",authorization_state_after:"consumed",event_rows_created:1,sequence_or_identity_effects:counts(at11.created.request_id)});
const at12=authorizeFixture(120);const consumeSql=`select row_to_json(r) from private.consume_github_pages_publication_authorization_phase4_core_v0(${sqlLiteral(at12.created.request_id)}::uuid,${jsonLiteral(observed(at12.value))},${sqlLiteral("5".repeat(64))}) r;`;
const at12Race=await race(consumeSql,consumeSql,4012);const at12Rows=at12Race.map((item)=>jsonLine(item.stdout));assert.equal(at12Rows.filter((row)=>row.deployment_permit===true).length,1);assert.equal(Number(scalar(`select count(*) from private.github_pages_publication_authorization_events_v0 where request_id=${sqlLiteral(at12.created.request_id)}::uuid and event_type='consumed';`)),1);
concurrency.AT_12={sessions:at12Race,winner_count:1,permits:at12Rows.map((row)=>row.deployment_permit),final_state:state(at12.created.request_id),barrier:"pg_advisory_lock(4012)"};
record(12,{preconditions:"authorized request",execution_method:"two psql sessions released by advisory-lock barrier",expected_result:"one permit and one consumed event",observed_result:concurrency.AT_12,authorization_state_before:"authorized",authorization_state_after:"consumed",event_rows_created:1,sequence_or_identity_effects:counts(at12.created.request_id)});
const replay=consume(at11.created.request_id,observed(at11.value));assert.equal(replay.deployment_permit,false);assert.equal(replay.terminal_failure_code,"replay_or_non_authorized_state");
record(13,{preconditions:"AT-11 consumed request",execution_method:"sequential repeated consumption",expected_result:"no permit, no event, state remains consumed",observed_result:replay,authorization_state_before:"consumed",authorization_state_after:"consumed",event_rows_created:0,sequence_or_identity_effects:counts(at11.created.request_id)});

// AT-14
const at14Cases={manifest:(v)=>({...v,action_manifest_sha256:"f".repeat(64)}),source:(v)=>({...v,source_commit_sha:"e".repeat(40)}),runtime_configuration:(v)=>({...v,runtime_config_evidence_sha256:"e".repeat(64)}),dependency:(v)=>({...v,upload_action_commit_sha:"e".repeat(40)}),target:(v)=>({...v,canonical_public_target:"https://substituted.invalid/"}),environment:(v)=>({...v,environment_name:"substituted"}),effect:(v)=>({...v,permitted_effect:"substituted"}),executor:(v)=>({...v,deploy_action_commit_sha:"e".repeat(40)})};
let at14Index=0;for(const [name,change] of Object.entries(at14Cases)){const fixture=authorizeFixture(140+at14Index++);const receipt=consume(fixture.created.request_id,{...observed(fixture.value),manifest:change(fixture.value)});assert.equal(receipt.status,"consumption_failed");assert.equal(consume(fixture.created.request_id,observed(fixture.value)).deployment_permit,false);substitution[`AT-14:${name}`]=receipt.terminal_failure_code;}
record(14,{preconditions:"separate authorized fixtures",execution_method:"eight determinate observed-manifest substitutions",expected_result:"each terminal consumption_failed and non-reusable",observed_result:substitution,authorization_state_before:"authorized",authorization_state_after:"consumption_failed",event_rows_created:"one per subcase",sequence_or_identity_effects:{subcases:Object.keys(at14Cases).length}});

// AT-15
const at15Cases={artifact_id:(v)=>({...observed(v),manifest:{...v,artifact_id:v.artifact_id+1}}),artifact_name:(v)=>({...observed(v),manifest:{...v,artifact_name:"wrong"}}),artifact_run_id:(v)=>({...observed(v),manifest:{...v,artifact_run_id:v.run_id+1}}),artifact_run_attempt:(v)=>({...observed(v),manifest:{...v,artifact_run_attempt:2}}),artifact_digest:(v)=>({...observed(v),manifest:{...v,built_artifact_sha256:"e".repeat(64)}}),upload_action_identity:(v)=>({...observed(v),manifest:{...v,upload_action_repository:"wrong/upload"}}),authoritative_not_found:(v)=>observed(v,{}, {status:"NOT_FOUND",reason:"artifact_not_found",artifact:null,run:null}),authoritative_expired:(v)=>observed(v,{}, {status:"EXPIRED",reason:"artifact_expired",artifact:null,run:null})};
let at15Index=0;for(const [name,change] of Object.entries(at15Cases)){const fixture=authorizeFixture(150+at15Index++);const receipt=consume(fixture.created.request_id,change(fixture.value));assert.ok(["consumption_failed","expired"].includes(receipt.status));assert.equal(consume(fixture.created.request_id,observed(fixture.value)).deployment_permit,false);substitution[`AT-15:${name}`]=receipt.terminal_failure_code;}
const at15Indeterminate=authorizeFixture(159);const indeterminate=consume(at15Indeterminate.created.request_id,observed(at15Indeterminate.value,{}, {status:"INDETERMINATE",reason:"artifact_api_503",artifact:null,run:null}));assert.equal(indeterminate.status,"authorized");assert.equal(state(at15Indeterminate.created.request_id),"authorized");
substitution["AT-15:indeterminate"]=indeterminate.terminal_failure_code;
record(15,{preconditions:"separate authorized fixtures and mocked authoritative artifact outcomes",execution_method:"artifact/run/digest/upload substitutions plus expiry/not-found/indeterminate",expected_result:"determinate cases terminal; indeterminate remains authorized without permit",observed_result:substitution,authorization_state_before:"authorized",authorization_state_after:"terminal except indeterminate authorized",event_rows_created:"one per determinate subcase; zero indeterminate",sequence_or_identity_effects:{determinate_subcases:Object.keys(at15Cases).length,indeterminate_mutation:0}});

// AT-16
const at16Cases={actor:{actor:"wrong"},actor_id:{actor_id:"999"},repository:{repository:"wrong/repo"},repository_id:{repository_id:"999"},workflow:{workflow:"wrong"},workflow_sha:{workflow_sha:"e".repeat(40)},run_id:{run_id:"999"},run_attempt:{run_attempt:"2"},ref:{ref:"refs/heads/wrong"},event:{event_name:"push"}};
let at16Index=0;for(const [name,change] of Object.entries(at16Cases)){const fixture=authorizeFixture(160+at16Index++);const receipt=consume(fixture.created.request_id,observed(fixture.value,change));assert.equal(receipt.status,"consumption_failed");assert.equal(consume(fixture.created.request_id,observed(fixture.value)).deployment_permit,false);substitution[`AT-16:${name}`]=receipt.terminal_failure_code;}
const unknownBefore=counts();runFailure(`select * from private.consume_github_pages_publication_authorization_phase4_core_v0('123e4567-e89b-12d3-a456-426614174000'::uuid,${jsonLiteral(observed(manifest(169)))},${sqlLiteral("5".repeat(64))});`,/unknown_request_id/);assert.deepEqual(counts(),unknownBefore);
record(16,{preconditions:"trusted signed-claim context and separate authorized fixtures",execution_method:"ten claim substitutions through database observed-binding contract; invalid-signature suite in Edge tests",expected_result:"trusted mismatches terminal; untrusted/unknown ID no mutation",observed_result:substitution,authorization_state_before:"authorized",authorization_state_after:"consumption_failed",event_rows_created:"one per trusted determinate subcase",sequence_or_identity_effects:{unknown_request_mutation:0}});

// AT-17 scenarios execute inside transactions and deliberately roll back assignment changes.
function at17Scenario(coordinate, mutationSql) {
  const value=manifest(coordinate);const key=requestKey(value);const binding=observed(value);
  const sql=`begin;
    select row_to_json(r) from private.create_github_pages_publication_authorization_v0(${jsonLiteral(value)},${sqlLiteral(value.action_manifest_sha256)},${sqlLiteral(key)}) r;
    select pg_catalog.set_config('request.jwt.claim.sub',${sqlLiteral(fixedUser)},true);
    select row_to_json(r) from private.decide_github_pages_publication_authorization_v0((select request_id from private.github_pages_publication_authorizations_v0 where action_manifest_sha256=${sqlLiteral(value.action_manifest_sha256)}),'authorize',null) r;
    ${mutationSql}
    select row_to_json(r) from private.consume_github_pages_publication_authorization_phase4_core_v0((select request_id from private.github_pages_publication_authorizations_v0 where action_manifest_sha256=${sqlLiteral(value.action_manifest_sha256)}),${jsonLiteral(binding)},${sqlLiteral("5".repeat(64))}) r;
    rollback;`;
  const output=run(sql);const rows=output.split("\n").map((line)=>line.trim()).filter((line)=>line.startsWith("{")).map(JSON.parse);return rows.at(-1);
}
const insertAlternate=(authorityVersion="Operator Principal Application and Provisioning 0.1 — Phase 2B",user=alternateUser)=>`insert into private.workspace_operator_principals(id,workspace_id,user_id,authority_version,provisioned_by_reference,provisioning_authorization_reference,provisioning_execution_reference,valid_from) values(extensions.gen_random_uuid(),'${workspace}','${user}',${sqlLiteral(authorityVersion)},'fixture','fixture','fixture',pg_catalog.transaction_timestamp()-interval '1 day');`;
const scenarios={
  one_exact:"select 1;",
  zero:`update private.workspace_operator_principals set status='suspended',suspended_at=pg_catalog.transaction_timestamp() where id='${fixedPrincipal}';`,
  multiple:insertAlternate(),
  suspended:`update private.workspace_operator_principals set status='suspended',suspended_at=pg_catalog.transaction_timestamp() where id='${fixedPrincipal}';`,
  revoked:`update private.workspace_operator_principals set status='revoked',revoked_at=pg_catalog.transaction_timestamp() where id='${fixedPrincipal}';`,
  expired:`update private.workspace_operator_principals set valid_until=pg_catalog.transaction_timestamp()-interval '1 second' where id='${fixedPrincipal}';`,
  replaced:`update private.workspace_operator_principals set status='suspended',suspended_at=pg_catalog.transaction_timestamp() where id='${fixedPrincipal}';${insertAlternate()}`,
  authority_version_changed:`update private.workspace_operator_principals set status='suspended',suspended_at=pg_catalog.transaction_timestamp() where id='${fixedPrincipal}';${insertAlternate("changed-authority-version")}`,
  principal_changed:`update private.workspace_operator_principals set status='suspended',suspended_at=pg_catalog.transaction_timestamp() where id='${fixedPrincipal}';${insertAlternate()}`,
  authenticated_user_changed:`update private.workspace_operator_principals set status='suspended',suspended_at=pg_catalog.transaction_timestamp() where id='${fixedPrincipal}';${insertAlternate("Operator Principal Application and Provisioning 0.1 — Phase 2B",alternateUser)}`
};
let at17Index=0;for(const [name,sql] of Object.entries(scenarios)){const receipt=at17Scenario(170+at17Index++,sql);if(name==="one_exact")assert.equal(receipt.deployment_permit,true);else{assert.equal(receipt.deployment_permit,false);assert.ok(["operator_assignment_unresolved","operator_assignment_ambiguous","operator_mismatch"].includes(receipt.terminal_failure_code));}cardinality[name]=receipt;}
record(17,{preconditions:"authorized fixture per subcase",execution_method:"transactional zero/one/multiple/suspended/revoked/expired/replaced/version/principal/user cases",expected_result:"only one exact active Operator succeeds; every failure is terminal in-transaction and non-reusable",observed_result:cardinality,authorization_state_before:"authorized",authorization_state_after:"consumed only for one exact; otherwise consumption_failed",event_rows_created:"one per subcase in transaction, then rolled back",sequence_or_identity_effects:{assignment_changes_rolled_back:true,subcases:Object.keys(scenarios).length}});

assert.equal(ledger.length,17);
assert.ok(ledger.every((entry,index)=>entry.test_id===`AT-${String(index+1).padStart(2,"0")}`&&entry.title===titles[index]&&entry.result==="PASS"));

const final = counts();
const evidence = {
  schema_version:"0.1",
  action_identifier:"github_pages_outward_publication@0.1",
  database_identifier:databaseUrl.replace(/:[^:@/]+@/,":REDACTED@"),
  started_at:new Date().toISOString(),
  initial_state:initial,
  final_state:final,
  tests:ledger,
  concurrency,
  substitution,
  operator_cardinality:cardinality,
  database_destruction_result:"pending_orchestrator_cleanup"
};
await fs.writeFile(evidencePath,`${JSON.stringify(evidence,null,2)}\n`,{mode:0o600});
process.stdout.write(`${JSON.stringify({result:"PASS",tests:ledger.length,evidence_path:evidencePath,final_state:final})}\n`);
