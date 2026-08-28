import postgres from "npm:postgres@3.4.7";
import {
  FIXED,
  buildRejectionDiagnostic,
  createDatabaseParameters,
  sha256,
  type AuthorizationRequestDiagnostic,
  type DiagnosticContext,
  type RejectionStage,
  validateManifest,
  verifyArtifact,
  verifyGitHubOidc,
  verifyRequesterEvidence
} from "./lib.ts";

function json(status:number, body:Record<string,unknown>) {
  return new Response(JSON.stringify(body), { status, headers:{ "content-type":"application/json", "cache-control":"no-store" } });
}

function functionVersion():string {
  const deploymentId = Deno.env.get("DENO_DEPLOYMENT_ID") || "unknown";
  return deploymentId === "unknown" ? "unknown" : deploymentId.split("_").at(-1) || "unknown";
}

async function persistDiagnostic(diagnostic:AuthorizationRequestDiagnostic):Promise<"persisted"|"unavailable"> {
  const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!databaseUrl) return "unavailable";
  let sql:ReturnType<typeof postgres>|undefined;
  try {
    sql = postgres(databaseUrl,{max:1,prepare:false,idle_timeout:2,connect_timeout:5});
    await sql.begin(async tx => {
      await tx.unsafe("set local role service_role");
      await tx.unsafe(`insert into private.github_pages_authorization_request_diagnostics_v0(
        diagnostic_id,occurred_at,function_name,function_version,request_operation,repository_id,workflow_sha,run_id,run_attempt,
        manifest_sha256,artifact_id,token_sha256,rejection_stage,bounded_reason_code,exception_class,http_response_class
      ) values ($1::uuid,$2::timestamptz,$3::text,$4::text,$5::text,$6::text,$7::text,$8::text,$9::text,$10::text,$11::text,$12::text,$13::text,$14::text,$15::text,$16::text)`, [
        diagnostic.diagnostic_id,diagnostic.timestamp,diagnostic.function_name,diagnostic.function_version,diagnostic.request_operation,
        diagnostic.repository_id,diagnostic.workflow_sha,diagnostic.run_id,diagnostic.run_attempt,diagnostic.manifest_sha256,diagnostic.artifact_id,
        diagnostic.token_sha256,diagnostic.rejection_stage,diagnostic.bounded_reason_code,diagnostic.exception_class,diagnostic.http_response_class
      ]);
    });
    return "persisted";
  } catch (error) {
    const name = error instanceof Error && /^[A-Za-z0-9_.-]{1,128}$/.test(error.name) ? error.name : "Error";
    console.error(JSON.stringify({diagnostic_id:diagnostic.diagnostic_id,event:"diagnostic_persistence_unavailable",exception_class:name}));
    return "unavailable";
  } finally {
    if (sql) try { await sql.end({timeout:2}); } catch { /* bounded best-effort close */ }
  }
}

async function reject(diagnosticId:string, stage:RejectionStage, status:number, error?:unknown, context:DiagnosticContext={}):Promise<Response> {
  const diagnostic = buildRejectionDiagnostic(diagnosticId,functionVersion(),stage,status,error,context);
  const durablePersistence = await persistDiagnostic(diagnostic);
  console.error(JSON.stringify({...diagnostic,durable_persistence:durablePersistence}));
  return json(status,{error:"authorization_request_denied",diagnostic_id:diagnosticId});
}

Deno.serve(async (request:Request) => {
  const diagnosticId = crypto.randomUUID();
  let stage:RejectionStage = "route";
  const context:DiagnosticContext = {repository_id:FIXED.repositoryId};
  try {
    const url = new URL(request.url);
    if (request.method !== "POST" || !url.pathname.endsWith("/github-pages-authorization-request-v0") || url.search || request.headers.has("origin")) {
      return await reject(diagnosticId,"route",404,undefined,context);
    }
    stage = "request_size";
    if (Number(request.headers.get("content-length") || "0") > 32768) {
      return await reject(diagnosticId,stage,413,undefined,context);
    }
    stage = "bearer_syntax";
    const match = (request.headers.get("authorization") || "").match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
    if (!match) {
      return await reject(diagnosticId,stage,401,undefined,context);
    }
    context.token_sha256 = await sha256(match[1]);
    stage = "body_parse";
    const body = JSON.parse(await request.text());
    stage = "body_shape";
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("body invalid");
    context.operation = body.operation;
    let query:string;
    let params:unknown[];
    if (body.operation === "create") {
      if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(["github_api_token","manifest","operation"])) throw new Error("create fields mismatch");
      stage = "manifest_validation";
      const validated = await validateManifest(body.manifest);
      context.repository_id = validated.manifest.repository_id;
      context.workflow_sha = validated.manifest.workflow_sha;
      context.run_id = validated.manifest.run_id;
      context.run_attempt = validated.manifest.run_attempt;
      context.manifest_sha256 = validated.manifest.action_manifest_sha256;
      context.artifact_id = validated.manifest.artifact_id;
      context.token_sha256 = validated.manifest.requester_oidc_evidence_sha256;
      stage = "oidc_validation";
      await verifyGitHubOidc(match[1],FIXED.requestAudience,{run_id:validated.manifest.run_id,workflow_sha:validated.manifest.workflow_sha,source_commit_sha:validated.manifest.source_commit_sha});
      stage = "requester_evidence";
      await verifyRequesterEvidence(match[1],validated.manifest.requester_oidc_evidence_sha256);
      stage = "artifact_verification";
      await verifyArtifact(validated.manifest,body.github_api_token);
      query = "select * from private.create_github_pages_publication_authorization_v0($1::jsonb,$2::text,$3::text)";
      params = createDatabaseParameters(validated);
    } else if (body.operation === "status") {
      if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(["action_manifest_sha256","operation","request_id","run_id","source_commit_sha","workflow_sha"])) throw new Error("status fields mismatch");
      context.workflow_sha = body.workflow_sha;
      context.run_id = body.run_id;
      context.run_attempt = 1;
      context.manifest_sha256 = body.action_manifest_sha256;
      stage = "oidc_validation";
      await verifyGitHubOidc(match[1],FIXED.requestAudience,{run_id:body.run_id,workflow_sha:body.workflow_sha,source_commit_sha:body.source_commit_sha});
      query = "select * from private.resolve_github_pages_publication_authorization_phase5_v0($1::uuid,$2::text)";
      params = [body.request_id,body.action_manifest_sha256];
    } else throw new Error("operation invalid");
    stage = "database_credential";
    const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!databaseUrl) throw new Error("server database credential unavailable");
    stage = "database_connection";
    const sql = postgres(databaseUrl,{max:1,prepare:false,idle_timeout:2,connect_timeout:5});
    let rows:Record<string,unknown>[];
    try {
      stage = "database_request";
      rows = await sql.begin(async tx => { await tx.unsafe("set local role service_role"); return tx.unsafe(query,params); });
    }
    finally { await sql.end({timeout:2}); }
    stage = "database_cardinality";
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("database result cardinality mismatch");
    return json(200,rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("conflicting_binding_for_execution_identity")) {
      return await reject(diagnosticId,stage,409,error,context);
    }
    return await reject(diagnosticId,stage,401,error,context);
  }
});
