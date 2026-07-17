import postgres from "npm:postgres@3.4.7";
import { PHASE5_FIXED, sha256Text, verifyPhase5GithubOidc } from "../_shared/github-pages-phase5-auth.ts";
import { observeArtifact, validateEnvelope } from "./lib.ts";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  if (request.method !== "POST" || !url.pathname.endsWith("/github-pages-conduit-invocation-v0") || url.search || request.headers.has("origin")) return json(404, { error: "not_found" });
  if (Number(request.headers.get("content-length") || "0") > 16384) return json(413, { error: "request_too_large" });
  const match = (request.headers.get("authorization") || "").match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  if (!match) return json(401, { error: "invalid_bearer_token" });
  let envelope: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    envelope = validateEnvelope(JSON.parse(await request.text()));
    claims = await verifyPhase5GithubOidc(match[1], PHASE5_FIXED.conduitAudience, envelope as { workflow_run_id: unknown; workflow_sha: unknown });
  } catch (error) { return json(401, { error: error instanceof Error ? error.message : "untrusted_request" }); }

  const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!databaseUrl) return json(503, { error: "conduit_persistence_unavailable" });
  const tokenDigest = await sha256Text(match[1]);
  const sql = postgres(databaseUrl, { max: 1, prepare: false, idle_timeout: 2, connect_timeout: 5 });
  let prepared: Record<string, unknown>;
  try {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe("set local role service_role");
      return tx.unsafe("select * from private.prepare_github_pages_conduit_invocation_v0($1::jsonb,$2::text)", [JSON.stringify(envelope), tokenDigest]);
    });
    if (!Array.isArray(rows) || rows.length !== 1) return json(503, { error: "conduit_prepare_indeterminate" });
    prepared = rows[0];
  } catch { return json(503, { error: "conduit_prepare_unavailable" }); }

  if (prepared.state !== "dispatching") {
    await sql.end({ timeout: 2 });
    return json(409, prepared);
  }

  const manifest = prepared.action_manifest as Record<string, unknown>;
  const artifactVerification = await observeArtifact(manifest);
  const observedBinding = {
    claims,
    manifest,
    artifact_verification: artifactVerification,
    phase5: {
      palisade_decision_id: prepared.palisade_decision_id,
      palisade_decision_sha256: prepared.palisade_decision_sha256,
      conduit_invocation_id: prepared.conduit_invocation_id,
      conduit_invocation_sha256: prepared.conduit_invocation_sha256,
      governed_invocation_sha256: prepared.governed_invocation_sha256
    }
  };

  let receipt: Record<string, unknown>;
  try {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe("set local role service_role");
      return tx.unsafe(
        "select * from private.consume_github_pages_publication_authorization_v0($1::uuid,$2::jsonb,$3::text)",
        [envelope.request_id, JSON.stringify(observedBinding), tokenDigest]
      );
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("consumption_result_indeterminate");
    receipt = rows[0];
  } catch {
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe("set local role service_role");
        await tx.unsafe("select private.fail_github_pages_conduit_invocation_v0($1::uuid,$2::text)", [prepared.conduit_invocation_id, "consumption_endpoint_unavailable"]);
      });
    } catch { /* fail closed even when discrepancy persistence is unavailable */ }
    await sql.end({ timeout: 2 });
    return json(503, { error: "phase4_consumption_indeterminate", deployment_permit: false });
  }

  if (receipt.status !== "consumed" || receipt.deployment_permit !== true) {
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe("set local role service_role");
        await tx.unsafe("select private.fail_github_pages_conduit_invocation_v0($1::uuid,$2::text)", [prepared.conduit_invocation_id, receipt.terminal_failure_code || "phase4_consumption_failed"]);
      });
    } catch { /* fail closed */ }
    await sql.end({ timeout: 2 });
    return json(409, { ...receipt, deployment_permit: false });
  }

  try {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe("set local role service_role");
      return tx.unsafe("select * from private.complete_github_pages_conduit_invocation_v0($1::uuid,$2::jsonb)", [prepared.conduit_invocation_id, JSON.stringify(receipt)]);
    });
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].deployment_permit !== true) throw new Error("result_validation_failed");
    return json(200, rows[0]);
  } catch {
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe("set local role service_role");
        await tx.unsafe("select private.fail_github_pages_conduit_invocation_v0($1::uuid,$2::text)", [prepared.conduit_invocation_id, "result_validation_failed"]);
      });
    } catch { /* Phase 4 remains consumed and no permit is returned */ }
    return json(503, { error: "post_consumption_result_validation_failed", deployment_permit: false });
  } finally { await sql.end({ timeout: 2 }); }
});
