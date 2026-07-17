import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { digestObject, FIXED } from "../scripts/lib/github-pages-governable.mjs";

const migrationPath = "supabase/migrations/20260716_0002_github_pages_publication_authorization_v0.sql";
const migration = await fs.readFile(migrationPath, "utf8");
const normalized = migration.replace(/\s+/g, " ").toLowerCase();
const runtimeFix = (await fs.readFile("supabase/migrations/20260716_0003_github_pages_publication_authorization_v0_runtime_fix.sql", "utf8")).replace(/\s+/g, " ").toLowerCase();
const conflictFix = (await fs.readFile("supabase/migrations/20260716_0004_github_pages_publication_authorization_v0_conflict_fix.sql", "utf8")).replace(/\s+/g, " ").toLowerCase();
const fkIndexes = (await fs.readFile("supabase/migrations/20260716_0005_github_pages_publication_authorization_v0_fk_indexes.sql", "utf8")).replace(/\s+/g, " ").toLowerCase();
const effectConstraint = (await fs.readFile("supabase/migrations/20260716_0006_github_pages_publication_authorization_v0_effect_constraint.sql", "utf8")).replace(/\s+/g, " ").toLowerCase();
const consumptionOperatorCheck = (await fs.readFile("supabase/migrations/20260716_0007_github_pages_publication_authorization_v0_consumption_operator_check.sql", "utf8")).replace(/\s+/g, " ").toLowerCase();
const corrective = (await fs.readFile("supabase/migrations/20260717122122_github_pages_publication_authorization_v0_corrective_closure.sql", "utf8")).replace(/\s+/g, " ").toLowerCase();
const workflow = await fs.readFile(".github/workflows/pages-runtime-config.yml", "utf8");
const authorization = JSON.parse(await fs.readFile("contracts/github-pages-publication-authorization-v0.json", "utf8"));
const manifest = JSON.parse(await fs.readFile("contracts/github-pages-publication-final-manifest-v0.json", "utf8"));

test("authorization contract fixes the sole action and Operator", () => {
  assert.equal(authorization.action_identifier, FIXED.actionIdentifier);
  assert.equal(authorization.operator_principal_id, FIXED.operatorPrincipalId);
  assert.equal(authorization.operator_user_id, FIXED.operatorUserId);
  assert.equal(authorization.authorization_ttl_seconds, 300);
});

test("state vocabulary and transitions are closed", () => {
  assert.deepEqual(authorization.states, ["pending","authorized","rejected","consumed","consumption_failed","expired"]);
  assert.deepEqual(authorization.terminal_states, ["rejected","consumed","consumption_failed","expired"]);
  assert.equal(authorization.transitions.length, 6);
});

test("final manifest contract is exact and digest-only for sensitive evidence", () => {
  assert.equal(manifest.required_fields.length, new Set(manifest.required_fields).size);
  for (const field of ["requester_oidc_evidence_sha256","runtime_config_evidence_sha256","built_artifact_sha256","operator_resolution_evidence_sha256","artifact_expires_at"]) assert.ok(manifest.required_fields.includes(field));
  assert.ok(manifest.forbidden_raw_values.includes("GitHub OIDC tokens"));
});

test("OIDC, GitHub run, and permitted effect bind the source action exactly", async () => {
  assert.match(effectConstraint, /permitted_effect = 'replace the current github pages deployment/);
  const requestLib = await fs.readFile("supabase/functions/github-pages-authorization-request-v0/lib.ts", "utf8");
  assert.match(requestLib, /claims\.sha/);
  assert.match(requestLib, /run\.head_sha/);
  assert.match(corrective, /v_claims->>'sha'/);
  assert.match(corrective, /v_run->>'head_sha'/);
});

test("canonical digest is order-independent for object keys", () => {
  assert.equal(digestObject({b:2,a:1}), digestObject({a:1,b:2}));
});

test("authorization and event tables are private, RLS-forced, and ungranted", () => {
  for (const table of ["github_pages_publication_authorizations_v0","github_pages_publication_authorization_events_v0"]) {
    assert.match(normalized, new RegExp(`create table private\\.${table}`));
    assert.match(normalized, new RegExp(`alter table private\\.${table} enable row level security`));
    assert.match(normalized, new RegExp(`alter table private\\.${table} force row level security`));
    assert.match(normalized, new RegExp(`revoke all privileges on table private\\.${table} from public, anon, authenticated, service_role`));
  }
});

test("all action-specific foreign keys have covering indexes", () => {
  assert.match(fkIndexes, /\(workspace_id\)/);
  assert.match(fkIndexes, /\(authorizer_user_id\)/);
  assert.match(normalized, /github_pages_publication_authorizations_v0_operator_idx/);
  assert.match(normalized, /github_pages_publication_authorization_events_v0_request_idx/);
});

test("security definer functions have empty search paths and bounded grants", () => {
  for (const name of ["create_github_pages_publication_authorization_v0","decide_github_pages_publication_authorization_v0","resolve_github_pages_publication_authorization_v0","consume_github_pages_publication_authorization_v0"]) {
    const start = normalized.indexOf(`function private.${name}`);
    assert.notEqual(start, -1);
    const body = normalized.slice(start, normalized.indexOf("$$;", start) + 3);
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.match(normalized, new RegExp(`grant execute on function private\\.${name}\\([^;]+ to service_role`));
  }
});

test("decision binds auth.uid and the fixed principal resolver", () => {
  assert.match(normalized, /auth\.uid\(\) is distinct from '4702d528-f7a7-4a04-a991-3176bec69f52'/);
  assert.match(normalized, /resolve_current_operator_principal_core\('9abed891-7950-4937-a2aa-4b957d8a4bd1'/);
  assert.match(normalized, /e438b03c-c708-4cba-94e4-e106ee9958c4/);
});

test("consumption re-resolves the fixed active Operator and fails terminally", () => {
  assert.match(consumptionOperatorCheck, /resolve_github_pages_operator_evidence_v0\(\)/);
  assert.match(consumptionOperatorCheck, /operator_assignment_invalid/);
  assert.match(consumptionOperatorCheck, /operator_assignment_unresolved/);
  assert.match(consumptionOperatorCheck, /else 'consumption_failed' end/);
});

test("authorization TTL uses database transaction time and artifact expiry", () => {
  assert.match(normalized, /v_now timestamptz := transaction_timestamp\(\)/);
  assert.match(normalized, /least\(v_now \+ interval '300 seconds', a\.artifact_expires_at\)/);
  assert.match(normalized, /expires_at <= issued_at \+ interval '300 seconds'/);
  assert.match(runtimeFix, /expires_at=least\(v_now \+ interval '300 seconds', a\.artifact_expires_at\)/);
  assert.doesNotMatch(runtimeFix, /pg_catalog\.least/);
});

test("request creation is collision-safe and replay tuple is unique", () => {
  assert.match(normalized, /pg_advisory_xact_lock/);
  assert.match(normalized, /on conflict \(request_key_sha256\) do nothing/);
  assert.match(normalized, /github_pages_publication_authorizations_v0_replay_tuple_uidx/);
  assert.match(conflictFix, /unique using index github_pages_publication_authorizations_v0_request_key_uidx/);
  assert.match(conflictFix, /on conflict on constraint github_pages_publication_authorizations_v0_request_key_unique do nothing/);
});

test("corrective request identity is database-derived, stable, and independently unique", () => {
  const identityStart = corrective.indexOf("function private.github_pages_publication_execution_identity_v0");
  const identityEnd = corrective.indexOf("$$;", identityStart);
  const identityBody = corrective.slice(identityStart, identityEnd);
  for (const field of ["action_identifier","workspace_id","repository","repository_id","repository_ref","workflow_path","workflow_sha","workflow_run_id","run_attempt","uploaded_artifact_id","uploaded_artifact_name","environment","canonical_public_target","deploy_executor_sha"]) {
    assert.match(identityBody, new RegExp(`'${field}'`));
  }
  for (const excluded of ["action_manifest_sha256","source_commit_sha","source_tree_sha","runtime_config_evidence_sha256","built_artifact_sha256","requester_actor_id","operator_resolution_evidence_sha256"]) {
    assert.doesNotMatch(identityBody, new RegExp(excluded));
  }
  assert.match(corrective, /unique \(execution_identity_sha256\)/);
  assert.match(corrective, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(v_execution_identity/);
  assert.match(corrective, /conflicting_binding_for_execution_identity/);
});

test("corrective Operator resolver counts every applicable assignment before deciding cardinality", () => {
  const start = corrective.indexOf("function private.resolve_github_pages_operator_cardinality_v0");
  const end = corrective.indexOf("$$;", start);
  const body = corrective.slice(start, end);
  assert.match(body, /count\(\*\)/);
  assert.match(body, /suspended_at is null/);
  assert.match(body, /revoked_at is null/);
  assert.doesNotMatch(body, /limit 1/);
  assert.match(corrective, /operator_assignment_ambiguous/);
});

test("corrective consumption owns trusted binding terminalization", async () => {
  const edge = await fs.readFile("supabase/functions/github-pages-authorization-consumption-v0/index.ts", "utf8");
  const lib = await fs.readFile("supabase/functions/github-pages-authorization-consumption-v0/lib.ts", "utf8");
  assert.match(edge, /buildObservedBinding/);
  assert.match(edge, /consume_github_pages_publication_authorization_v0\(\$1::uuid,\$2::jsonb,\$3::text\)/);
  assert.match(corrective, /artifact_verification_indeterminate/);
  for (const code of ["manifest_mismatch","artifact_mismatch","requester_mismatch","repository_mismatch","workspace_mismatch","workflow_mismatch","run_mismatch","run_attempt_mismatch","source_mismatch","runtime_config_mismatch","dependency_mismatch","target_mismatch","environment_mismatch","effect_mismatch","executor_mismatch","operator_assignment_unresolved","operator_assignment_ambiguous","operator_mismatch","authorization_not_yet_valid","authorization_expired","artifact_expired"]) {
    assert.match(corrective, new RegExp(`'${code}'`));
  }
  const trustStart = lib.indexOf("export async function verifyTrustEnvelope");
  const trustEnd = lib.indexOf("function normalizedArtifact", trustStart);
  const trustBody = lib.slice(trustStart, trustEnd);
  assert.doesNotMatch(trustBody, /claims\.(repository|actor|workflow|run_id|run_attempt|sha)/);
});

test("consumption locks, conditionally updates, and fails closed", () => {
  const start = normalized.indexOf("function private.consume_github_pages_publication_authorization_v0");
  const body = normalized.slice(start, normalized.indexOf("$$;", start));
  assert.match(body, /for update/);
  assert.match(body, /where a\.request_id=target_request_id and a\.status='authorized'/);
  assert.match(body, /consumption_failed/);
  assert.match(body, /replay_or_non_authorized_state/);
});

test("terminal rows and bound evidence are immutable", () => {
  assert.match(normalized, /terminal authorization state is immutable/);
  assert.match(normalized, /bound authorization evidence is immutable/);
  assert.match(normalized, /authorization deletion prohibited/);
});

test("events are append-only and function-owned", () => {
  assert.match(normalized, /authorization events are append-only and function-owned/);
  assert.match(normalized, /before insert or update or delete on private\.github_pages_publication_authorization_events_v0/);
});

test("production workflow upload and deploy cardinality remain one", () => {
  assert.equal((workflow.match(/actions\/upload-pages-artifact@/g) || []).length, 1);
  assert.equal((workflow.match(/actions\/deploy-pages@/g) || []).length, 1);
});

test("workflow constructs final manifest after artifact verification", () => {
  const upload = workflow.indexOf("Upload exact Pages artifact");
  const verified = workflow.indexOf("Verify current-run artifact identity");
  const finalManifest = workflow.indexOf("Construct and validate final action manifest");
  const request = workflow.indexOf("Create action-specific authorization request");
  assert.ok(upload < verified && verified < finalManifest && finalManifest < request);
});

test("consumption is immediately adjacent to the sole deployment", () => {
  const consume = workflow.indexOf("Invoke fixed Conduit route and require deployment permit");
  const deploy = workflow.indexOf("Deploy the bound Pages artifact");
  assert.ok(consume > 0 && deploy > consume);
  assert.equal((workflow.slice(consume, deploy).match(/^\s*- name:/gm) || []).length, 1);
});

test("three action-specific functions reject browser-origin routing", async () => {
  for (const slug of ["request","decision","consumption"]) {
    const source = await fs.readFile(`supabase/functions/github-pages-authorization-${slug}-v0/index.ts`, "utf8");
    assert.match(source, /request\.headers\.has\("origin"\)/);
    assert.doesNotMatch(source, /access-control-allow-origin/i);
  }
});
