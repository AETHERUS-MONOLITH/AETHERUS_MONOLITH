import postgres from "npm:postgres@3.4.7";
import { PHASE5_FIXED, sha256Text, verifyPhase5GithubOidc } from "../_shared/github-pages-phase5-auth.ts";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

const bodyFields = ["action_manifest_sha256", "phase4_status_receipt_sha256", "request_id", "schema_version", "source_commit_sha", "workflow_run_id", "workflow_sha"].sort();

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  if (request.method !== "POST" || !url.pathname.endsWith("/github-pages-palisade-evaluation-v0") || url.search || request.headers.has("origin")) return json(404, { error: "not_found" });
  if (Number(request.headers.get("content-length") || "0") > 8192) return json(413, { error: "request_too_large" });
  const match = (request.headers.get("authorization") || "").match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  if (!match) return json(401, { error: "invalid_bearer_token" });
  let body: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    body = JSON.parse(await request.text());
    if (!body || typeof body !== "object" || Array.isArray(body) || JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(bodyFields)) throw new Error("body_fields_mismatch");
    if (body.schema_version !== "0.5") throw new Error("schema_version_mismatch");
    claims = await verifyPhase5GithubOidc(match[1], PHASE5_FIXED.palisadeAudience, body as { workflow_run_id: unknown; workflow_sha: unknown });
    if (String(claims.sha) !== String(body.source_commit_sha)) throw new Error("source_commit_mismatch");
  } catch (error) { return json(401, { error: error instanceof Error ? error.message : "untrusted_request" }); }
  const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!databaseUrl) return json(503, { error: "palisade_persistence_unavailable" });
  const tokenDigest = await sha256Text(match[1]);
  const sql = postgres(databaseUrl, { max: 1, prepare: false, idle_timeout: 2, connect_timeout: 5 });
  try {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe("set local role service_role");
      return tx.unsafe(
        "select * from private.evaluate_github_pages_palisade_v0($1::uuid,$2::text,$3::text,$4::text)",
        [body.request_id, body.action_manifest_sha256, body.phase4_status_receipt_sha256, tokenDigest]
      );
    });
    if (!Array.isArray(rows) || rows.length !== 1) return json(503, { error: "palisade_result_indeterminate" });
    return json(200, rows[0]);
  } catch {
    try {
      const unavailable = await sql.begin(async (tx) => {
        await tx.unsafe("set local role service_role");
        return tx.unsafe(
          "select * from private.record_github_pages_palisade_runtime_unavailable_v0($1::uuid,$2::text,$3::text)",
          [body.request_id, "palisade_evaluator_unavailable", tokenDigest]
        );
      });
      return json(503, { error: "palisade_evaluation_unavailable", decision: unavailable[0] || null });
    } catch { return json(503, { error: "palisade_evaluation_and_evidence_persistence_unavailable" }); }
  }
  finally { await sql.end({ timeout: 2 }); }
});
