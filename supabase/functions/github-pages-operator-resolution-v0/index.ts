import postgres from "npm:postgres@3.4.7";
import { verifyGitHubOidc } from "./lib.ts";

const allowedResponseKeys = [
  "operator_principal_id",
  "workspace_id",
  "principal_type",
  "authority_class",
  "authority_version",
  "status",
  "resolution_status",
  "resolved_at"
].sort();

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

Deno.serve(async (request: Request) => {
  try {
    const url = new URL(request.url);
    if (request.method !== "POST" || !url.pathname.endsWith("/github-pages-operator-resolution-v0") || url.search) {
      return json(404, { error: "not_found" });
    }
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 4096) return json(413, { error: "request_too_large" });
    const authorization = request.headers.get("authorization") || "";
    const match = authorization.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
    if (!match) return json(401, { error: "invalid_bearer_token" });
    const body = JSON.parse(await request.text());
    await verifyGitHubOidc(match[1], body);

    const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!databaseUrl) throw new Error("server database credential unavailable");
    const sql = postgres(databaseUrl, { max: 1, prepare: false, idle_timeout: 2, connect_timeout: 5 });
    let rows: Record<string, unknown>[];
    try {
      rows = await sql.begin(async (transaction) => {
        await transaction.unsafe("set local role service_role");
        return transaction.unsafe("select * from private.resolve_github_pages_operator_evidence_v0()");
      });
    } finally {
      await sql.end({ timeout: 2 });
    }
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("database bridge result cardinality mismatch");
    const evidence = rows[0];
    if (JSON.stringify(Object.keys(evidence).sort()) !== JSON.stringify(allowedResponseKeys)) {
      throw new Error("database bridge response fields mismatch");
    }
    return json(200, evidence);
  } catch {
    return json(401, { error: "operator_resolution_denied" });
  }
});
