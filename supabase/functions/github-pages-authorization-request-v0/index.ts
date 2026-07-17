import postgres from "npm:postgres@3.4.7";
import {
  FIXED,
  classifyRejection,
  createDatabaseParameters,
  type RejectionStage,
  validateManifest,
  verifyArtifact,
  verifyGitHubOidc,
  verifyRequesterEvidence
} from "./lib.ts";

function json(status:number, body:Record<string,unknown>) {
  return new Response(JSON.stringify(body), { status, headers:{ "content-type":"application/json", "cache-control":"no-store" } });
}

type DiagnosticContext = {
  operation?: unknown;
  repository_id?: unknown;
  workflow_sha?: unknown;
  run_id?: unknown;
  run_attempt?: unknown;
  manifest_sha256?: unknown;
  artifact_id?: unknown;
  token_sha256?: unknown;
};

function emitDiagnostic(stage:RejectionStage, status:number, error?:unknown, context:DiagnosticContext={}) {
  const deploymentId = Deno.env.get("DENO_DEPLOYMENT_ID") || "unknown";
  const functionVersion = deploymentId === "unknown" ? "unknown" : deploymentId.split("_").at(-1) || "unknown";
  console.error(JSON.stringify({
    diagnostic_id:crypto.randomUUID(),
    timestamp:new Date().toISOString(),
    function_name:"github-pages-authorization-request-v0",
    function_version:functionVersion,
    request_operation:typeof context.operation === "string" ? context.operation : "unknown",
    repository_id:typeof context.repository_id === "string" ? context.repository_id : null,
    workflow_sha:typeof context.workflow_sha === "string" ? context.workflow_sha : null,
    run_id:typeof context.run_id === "string" || typeof context.run_id === "number" ? String(context.run_id) : null,
    run_attempt:typeof context.run_attempt === "string" || typeof context.run_attempt === "number" ? String(context.run_attempt) : null,
    manifest_sha256:typeof context.manifest_sha256 === "string" ? context.manifest_sha256 : null,
    artifact_id:typeof context.artifact_id === "string" || typeof context.artifact_id === "number" ? String(context.artifact_id) : null,
    token_sha256:typeof context.token_sha256 === "string" ? context.token_sha256 : null,
    rejection_stage:stage,
    bounded_reason_code:classifyRejection(stage,error),
    exception_class:error instanceof Error ? error.name : "none",
    http_response_class:`${Math.floor(status/100)}xx`
  }));
}

Deno.serve(async (request:Request) => {
  let stage:RejectionStage = "route";
  const context:DiagnosticContext = {};
  try {
    const url = new URL(request.url);
    if (request.method !== "POST" || !url.pathname.endsWith("/github-pages-authorization-request-v0") || url.search || request.headers.has("origin")) {
      emitDiagnostic("route",404);
      return json(404,{error:"not_found"});
    }
    stage = "request_size";
    if (Number(request.headers.get("content-length") || "0") > 32768) {
      emitDiagnostic(stage,413);
      return json(413,{error:"request_too_large"});
    }
    stage = "bearer_syntax";
    const match = (request.headers.get("authorization") || "").match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
    if (!match) {
      emitDiagnostic(stage,401);
      return json(401,{error:"invalid_bearer_token"});
    }
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
      emitDiagnostic(stage,409,error,context);
      return json(409,{error:"conflicting_binding_for_execution_identity"});
    }
    emitDiagnostic(stage,401,error,context);
    return json(401,{error:"authorization_request_denied"});
  }
});
