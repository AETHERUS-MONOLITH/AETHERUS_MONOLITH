import postgres from "npm:postgres@3.4.7";
import { FIXED, sha256, validateManifest, verifyArtifact, verifyGitHubOidc } from "./lib.ts";

function json(status:number, body:Record<string,unknown>) {
  return new Response(JSON.stringify(body), { status, headers:{ "content-type":"application/json", "cache-control":"no-store" } });
}

Deno.serve(async (request:Request) => {
  try {
    const url = new URL(request.url);
    if (request.method !== "POST" || !url.pathname.endsWith("/github-pages-authorization-request-v0") || url.search || request.headers.has("origin")) return json(404,{error:"not_found"});
    if (Number(request.headers.get("content-length") || "0") > 32768) return json(413,{error:"request_too_large"});
    const match = (request.headers.get("authorization") || "").match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
    if (!match) return json(401,{error:"invalid_bearer_token"});
    const body = JSON.parse(await request.text());
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("body invalid");
    let query:string;
    let params:unknown[];
    if (body.operation === "create") {
      if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(["github_api_token","manifest","operation"])) throw new Error("create fields mismatch");
      const validated = await validateManifest(body.manifest);
      await verifyGitHubOidc(match[1],FIXED.requestAudience,{run_id:validated.manifest.run_id,workflow_sha:validated.manifest.workflow_sha,source_commit_sha:validated.manifest.source_commit_sha});
      if (await sha256(match[1]) !== validated.manifest.requester_oidc_evidence_sha256) throw new Error("requester OIDC evidence mismatch");
      await verifyArtifact(validated.manifest,body.github_api_token);
      query = "select * from private.create_github_pages_publication_authorization_v0($1::jsonb,$2::text,$3::text)";
      params = [JSON.stringify(validated.manifest),validated.manifest.action_manifest_sha256,validated.requestKeySha256];
    } else if (body.operation === "status") {
      if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(["action_manifest_sha256","operation","request_id","run_id","source_commit_sha","workflow_sha"])) throw new Error("status fields mismatch");
      await verifyGitHubOidc(match[1],FIXED.requestAudience,{run_id:body.run_id,workflow_sha:body.workflow_sha,source_commit_sha:body.source_commit_sha});
      query = "select * from private.resolve_github_pages_publication_authorization_v0($1::uuid,$2::text)";
      params = [body.request_id,body.action_manifest_sha256];
    } else throw new Error("operation invalid");
    const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!databaseUrl) throw new Error("server database credential unavailable");
    const sql = postgres(databaseUrl,{max:1,prepare:false,idle_timeout:2,connect_timeout:5});
    let rows:Record<string,unknown>[];
    try { rows = await sql.begin(async tx => { await tx.unsafe("set local role service_role"); return tx.unsafe(query,params); }); }
    finally { await sql.end({timeout:2}); }
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("database result cardinality mismatch");
    return json(200,rows[0]);
  } catch { return json(401,{error:"authorization_request_denied"}); }
});
