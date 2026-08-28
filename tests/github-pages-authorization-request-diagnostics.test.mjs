import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  REJECTION_REASON_CODES,
  buildRejectionDiagnostic
} from "../supabase/functions/github-pages-authorization-request-v0/lib.ts";

const indexPath = "supabase/functions/github-pages-authorization-request-v0/index.ts";
const migrationPath = "supabase/migrations/20260828170013_github_pages_authorization_request_diagnostics_v0.sql";
const requesterPath = "scripts/request-github-pages-publication-authorization.mjs";

test("bounded diagnostic serialization retains only approved correlation fields", () => {
  const diagnostic = buildRejectionDiagnostic(
    "123e4567-e89b-42d3-a456-426614174000",
    "6",
    "oidc_validation",
    401,
    new TypeError("invalid signature: raw internal detail must not serialize"),
    {
      operation: "create",
      repository_id: "1167751543",
      workflow_sha: "a".repeat(40),
      run_id: 29926668646,
      run_attempt: 1,
      manifest_sha256: "b".repeat(64),
      artifact_id: 880001,
      token_sha256: "c".repeat(64)
    }
  );
  assert.equal(diagnostic.diagnostic_id,"123e4567-e89b-42d3-a456-426614174000");
  assert.equal(diagnostic.function_version,"6");
  assert.equal(diagnostic.bounded_reason_code,"oidc_signature_failed");
  assert.equal(diagnostic.exception_class,"TypeError");
  assert.equal(diagnostic.http_response_class,"4xx");
  assert.ok(Number.isFinite(Date.parse(diagnostic.timestamp)));
  assert.equal(JSON.stringify(diagnostic).includes("raw internal detail"),false);
});

test("untrusted correlation values are discarded rather than retained", () => {
  const diagnostic = buildRejectionDiagnostic(
    "123e4567-e89b-42d3-a456-426614174001",
    "deployment-secret",
    "body_shape",
    401,
    new Error("body invalid"),
    {
      operation: "injected-operation",
      repository_id: "credential-bearing-value",
      workflow_sha: "not-a-sha",
      run_id: "1;select secret",
      token_sha256: "raw-token"
    }
  );
  assert.equal(diagnostic.function_version,"unknown");
  assert.equal(diagnostic.request_operation,"unknown");
  assert.equal(diagnostic.repository_id,null);
  assert.equal(diagnostic.workflow_sha,null);
  assert.equal(diagnostic.run_id,null);
  assert.equal(diagnostic.token_sha256,null);
});

test("Edge rejection path creates one early identity, persists bounded columns, and returns only generic failure plus identity", async () => {
  const source = await fs.readFile(indexPath,"utf8");
  assert.match(source,/const diagnosticId = crypto\.randomUUID\(\);/);
  assert.equal((source.match(/crypto\.randomUUID\(\)/g) || []).length,1);
  assert.match(source,/insert into private\.github_pages_authorization_request_diagnostics_v0/);
  assert.match(source,/durable_persistence:durablePersistence/);
  assert.match(source,/error:"authorization_request_denied",diagnostic_id:diagnosticId/);
  assert.doesNotMatch(source,/error:(?:stage|diagnostic\.bounded_reason_code|diagnostic\.exception_class)/);
});

test("private diagnostic schema is append-only and not readable or writable by public roles", async () => {
  const migration = await fs.readFile(migrationPath,"utf8");
  assert.match(migration,/create table private\.github_pages_authorization_request_diagnostics_v0/);
  assert.match(migration,/primary key/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/force row level security/);
  assert.match(migration,/revoke all on table [^;]+ from public, anon, authenticated, service_role/);
  assert.match(migration,/grant insert on table [^;]+ to service_role/);
  assert.match(migration,/before update or delete/);
  assert.doesNotMatch(migration,/\b(raw_token|raw_jwt|raw_credential|secret_payload|diagnostic_payload)\b|payload\s+jsonb/i);
  for (const reason of REJECTION_REASON_CODES) assert.ok(migration.includes(`'${reason}'`),reason);
});

test("GitHub requester writes bounded failure evidence and preserves a supplied diagnostic identity", async () => {
  const source = await fs.readFile(requesterPath,"utf8");
  assert.match(source,/authorization-request-failure\.json/);
  assert.match(source,/classification: "authorization_request_failure_evidence"/);
  assert.match(source,/authorization_request_diagnostic_id=/);
  assert.match(source,/error: "authorization_request_denied"/);
  assert.doesNotMatch(source,/JSON\.stringify\(payload/);
});
