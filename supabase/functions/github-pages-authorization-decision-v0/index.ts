import postgres from "npm:postgres@3.4.7";
import { authenticateFixedOperator, validateDecisionBody } from "./lib.ts";

function json(status:number,body:Record<string,unknown>){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});}
Deno.serve(async(request:Request)=>{
  try{
    const url=new URL(request.url); if(request.method!=="POST"||!url.pathname.endsWith("/github-pages-authorization-decision-v0")||url.search||request.headers.has("origin"))return json(404,{error:"not_found"});
    if(Number(request.headers.get("content-length")||"0")>4096)return json(413,{error:"request_too_large"});
    const operatorUserId=await authenticateFixedOperator(request.headers.get("authorization")||"");
    const body=validateDecisionBody(JSON.parse(await request.text()));
    const databaseUrl=Deno.env.get("SUPABASE_DB_URL"); if(!databaseUrl)throw new Error("server database credential unavailable");
    const sql=postgres(databaseUrl,{max:1,prepare:false,idle_timeout:2,connect_timeout:5}); let rows:Record<string,unknown>[];
    try{rows=await sql.begin(async tx=>{await tx.unsafe("set local role service_role");await tx.unsafe("select pg_catalog.set_config('request.jwt.claim.sub',$1,true)",[operatorUserId]);return tx.unsafe("select * from private.decide_github_pages_publication_authorization_v0($1::uuid,$2::text,$3::text)",[body.request_id,body.decision,body.reason]);});}finally{await sql.end({timeout:2});}
    if(!Array.isArray(rows)||rows.length!==1)throw new Error("database result cardinality mismatch"); return json(200,rows[0]);
  }catch{return json(401,{error:"authorization_decision_denied"});}
});
