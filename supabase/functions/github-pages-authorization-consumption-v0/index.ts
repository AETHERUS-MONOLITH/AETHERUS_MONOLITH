import postgres from "npm:postgres@3.4.7";
import { buildObservedBinding, observeArtifact, sha256, validateConsumptionBody, verifyTrustEnvelope } from "./lib.ts";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  if (request.method !== "POST" || !url.pathname.endsWith("/github-pages-authorization-consumption-v0") || url.search || request.headers.has("origin")) {
    return json(404, { error: "not_found" });
  }
  if (Number(request.headers.get("content-length") || "0") > 32768) return json(413, { error: "request_too_large" });

  const match = (request.headers.get("authorization") || "").match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  if (!match) return json(401, { error: "invalid_bearer_token" });

  let body;
  try {
    body = validateConsumptionBody(JSON.parse(await request.text()));
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : "invalid_body" });
  }

  let claims: Record<string, unknown>;
  try {
    claims = await verifyTrustEnvelope(match[1]);
  } catch (error) {
    return json(401, { error: error instanceof Error ? error.message : "untrusted_caller" });
  }

  const artifactVerification = await observeArtifact(body.manifest, body.github_api_token);
  const observedBinding = buildObservedBinding(claims, body.manifest, artifactVerification);
  const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!databaseUrl) return json(503, { error: "database_unavailable" });

  const sql = postgres(databaseUrl, { max: 1, prepare: false, idle_timeout: 2, connect_timeout: 5 });
  let rows: Record<string, unknown>[];
  try {
    rows = await sql.begin(async (tx) => {
      await tx.unsafe("set local role service_role");
      return tx.unsafe(
        "select * from private.consume_github_pages_publication_authorization_v0($1::uuid,$2::jsonb,$3::text)",
        [body.request_id, JSON.stringify(observedBinding), await sha256(match[1])]
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "database_failure";
    if (message.includes("unknown_request_id")) return json(404, { error: "unknown_request_id" });
    return json(503, { error: "database_transition_indeterminate" });
  } finally {
    await sql.end({ timeout: 2 });
  }

  if (!Array.isArray(rows) || rows.length !== 1) return json(503, { error: "database_result_indeterminate" });
  const receipt = rows[0];
  if (receipt.status === "consumed" && receipt.deployment_permit === true && typeof receipt.consumption_receipt_sha256 === "string") {
    return json(200, receipt);
  }
  if (receipt.terminal_failure_code === "artifact_verification_indeterminate" && receipt.status === "authorized") {
    return json(503, receipt);
  }
  return json(409, receipt);
});
