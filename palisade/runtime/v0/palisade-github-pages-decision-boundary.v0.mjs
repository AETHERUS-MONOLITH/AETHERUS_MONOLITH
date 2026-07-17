import { GITHUB_PAGES_POLICY } from "./palisade-github-pages-policy-engine.v0.mjs";

export const githubPagesPalisadeEvaluationEndpoint =
  "https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-palisade-evaluation-v0";

const responseFields = [
  "schema_version", "palisade_decision_id", "policy_surface", "claim_id", "requested_action", "action_identifier",
  "policy_rule_id", "policy_rule_sha256", "request_id", "authorization_record_id", "execution_identity_sha256",
  "action_manifest_sha256", "policy_input_sha256", "phase4_status_receipt_sha256", "decision", "allowed",
  "reason_codes", "required_evidence", "missing_evidence", "evaluated_at", "palisade_decision_sha256"
].sort();

export function validatePersistedGithubPagesPalisadeDecisionV0(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Palisade decision must be an object");
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(responseFields)) throw new Error("Palisade decision fields mismatch");
  for (const [field, fixed] of Object.entries({
    schema_version: "0.5", policy_surface: GITHUB_PAGES_POLICY.policy_surface, claim_id: GITHUB_PAGES_POLICY.claim_id,
    requested_action: GITHUB_PAGES_POLICY.requested_action, action_identifier: GITHUB_PAGES_POLICY.action_identifier,
    policy_rule_id: GITHUB_PAGES_POLICY.policy_rule_id
  })) if (value[field] !== fixed) throw new Error(`Palisade decision ${field} mismatch`);
  for (const field of ["request_id", "action_manifest_sha256", "phase4_status_receipt_sha256"])
    if (String(value[field]) !== String(expected[field])) throw new Error(`Palisade decision ${field} binding mismatch`);
  if (value.allowed !== (value.decision === "allow")) throw new Error("Palisade allowed flag conflicts with decision");
  return value;
}

export async function invokeGithubPagesPalisadeEvaluationV0(body, oidcToken, fetchImpl = fetch) {
  if (typeof oidcToken !== "string" || oidcToken.length < 32) throw new Error("Palisade OIDC token unavailable");
  const response = await fetchImpl(githubPagesPalisadeEvaluationEndpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${oidcToken}`, "content-type": "application/json" },
    body: JSON.stringify(body), redirect: "error"
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`Palisade endpoint returned non-JSON status ${response.status}`); }
  if (!response.ok) throw new Error(`Palisade evaluation failed with ${response.status}: ${payload.error || "fail_closed"}`);
  return validatePersistedGithubPagesPalisadeDecisionV0(payload, body);
}
