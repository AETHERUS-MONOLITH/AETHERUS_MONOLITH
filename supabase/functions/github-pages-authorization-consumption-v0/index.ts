import postgres from "npm:postgres@3.4.7";
import { sha256, validateManifest, verifyArtifact, verifyGitHubOidc } from "./lib.ts";

function json(status:number,body:Record<string,unknown>){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});}
Deno.serve(async(request:Request)=>{
  try{
    const url=new URL(request.url); if(request.method!=="POST"||!url.pathname.endsWith("/github-pages-authorization-consumption-v0")||url.search||request.headers.has("origin")) return json(404,{error:"not_found"});
    if(Number(request.headers.get("content-length")||"0")>32768) return json(413,{error:"request_too_large"});
    const match=(request.headers.get("authorization")||"").match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/); if(!match)return json(401,{error:"invalid_bearer_token"});
    const body=JSON.parse(await request.text()); if(JSON.stringify(Object.keys(body).sort())!==JSON.stringify(["github_api_token","manifest","operation","request_id"])||body.operation!=="consume")throw new Error("fields mismatch");
    const validated=await validateManifest(body.manifest); await verifyGitHubOidc(match[1],{run_id:validated.manifest.run_id,workflow_sha:validated.manifest.workflow_sha,source_commit_sha:validated.manifest.source_commit_sha}); await verifyArtifact(validated.manifest,body.github_api_token);
    const databaseUrl=Deno.env.get("SUPABASE_DB_URL"); if(!databaseUrl)throw new Error("server database credential unavailable");
    const sql=postgres(databaseUrl,{max:1,prepare:false,idle_timeout:2,connect_timeout:5}); let rows:Record<string,unknown>[];
    try{rows=await sql.begin(async tx=>{await tx.unsafe("set local role service_role");return tx.unsafe("select * from private.consume_github_pages_publication_authorization_v0($1::uuid,$2::jsonb,$3::text,$4::text,$5::text)",[body.request_id,JSON.stringify(validated.manifest),validated.manifest.action_manifest_sha256,validated.requestKeySha256,await sha256(match[1])]);});}finally{await sql.end({timeout:2});}
    if(!Array.isArray(rows)||rows.length!==1)throw new Error("database result cardinality mismatch"); const row=rows[0];
    if(row.status!=="consumed"||row.terminal_failure_code!==null)return json(409,{error:"authorization_not_consumable",status:row.status,terminal_failure_code:row.terminal_failure_code});
    return json(200,row);
  }catch{return json(401,{error:"authorization_consumption_denied"});}
});
