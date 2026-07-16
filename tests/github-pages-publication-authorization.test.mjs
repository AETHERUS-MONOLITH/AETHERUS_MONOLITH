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
  for (const slug of ["request","consumption"]) {
    const lib = await fs.readFile(`supabase/functions/github-pages-authorization-${slug}-v0/lib.ts`, "utf8");
    assert.match(lib, /claims\.sha/);
    assert.match(lib, /run\.head_sha/);
  }
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
  const consume = workflow.indexOf("Consume authorization and construct deployment permit");
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
