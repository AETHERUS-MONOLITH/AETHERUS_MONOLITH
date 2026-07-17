export type ArtifactObservation = {
  status: "MATCH" | "MISMATCH" | "EXPIRED" | "NOT_FOUND" | "INDETERMINATE";
  reason: string;
  artifact: null | Record<string, unknown>;
  run: null | Record<string, unknown>;
};

export const envelopeFields = [
  "schema_version", "request_id", "trace_id", "correlation_id", "action_identifier", "policy_surface", "claim_id", "requested_action",
  "workspace_id", "repository", "repository_id", "repository_ref", "workflow_path", "workflow_sha", "workflow_run_id", "run_attempt",
  "authorization_record_id", "execution_identity_sha256", "action_manifest_sha256", "artifact_id", "artifact_name", "artifact_run_id",
  "artifact_run_attempt", "built_artifact_sha256", "canonical_public_target", "environment", "permitted_effect", "deploy_executor_sha",
  "phase4_status_receipt_sha256", "palisade_decision_id", "palisade_decision_sha256"
].sort();

export function validateEnvelope(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid_envelope");
  const body = input as Record<string, unknown>;
  if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(envelopeFields)) throw new Error("envelope_fields_mismatch");
  const fixed: Record<string, unknown> = {
    schema_version: "0.5", action_identifier: "github_pages_outward_publication@0.1",
    policy_surface: "github_pages_outward_publication_boundary", claim_id: "github_pages_outward_publication_authority",
    requested_action: "github_pages_outward_publication@0.1", workspace_id: "9abed891-7950-4937-a2aa-4b957d8a4bd1",
    repository: "AETHERUS-MONOLITH/AETHERUS_MONOLITH", repository_id: "1167751543", repository_ref: "refs/heads/main",
    workflow_path: ".github/workflows/pages-runtime-config.yml", run_attempt: 1, artifact_name: "github-pages-governable-v0-1",
    artifact_run_attempt: 1, canonical_public_target: "https://camilocarlone.com/", environment: "github-pages",
    permitted_effect: "replace the current GitHub Pages deployment for the canonical target with the exact bound uploaded artifact",
    deploy_executor_sha: "d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e"
  };
  for (const [field, value] of Object.entries(fixed)) if (body[field] !== value) throw new Error(`${field}_mismatch`);
  return body;
}

function observation(status: ArtifactObservation["status"], reason: string, artifact: Record<string, unknown> | null = null, run: Record<string, unknown> | null = null): ArtifactObservation {
  return { status, reason, artifact, run };
}

export async function observeArtifact(manifest: Record<string, unknown>, fetchImpl: typeof fetch = fetch, nowMs = Date.now()): Promise<ArtifactObservation> {
  const headers = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "aetherus-phase5-conduit-v0" };
  try {
    const artifactResponse = await fetchImpl(`https://api.github.com/repos/AETHERUS-MONOLITH/AETHERUS_MONOLITH/actions/artifacts/${manifest.artifact_id}`, { headers, redirect: "error" });
    if (artifactResponse.status === 404) return observation("NOT_FOUND", "artifact_not_found");
    if (artifactResponse.status === 410) return observation("EXPIRED", "artifact_expired");
    if (!artifactResponse.ok) return observation("INDETERMINATE", `artifact_api_${artifactResponse.status}`);
    const artifact = await artifactResponse.json() as Record<string, unknown>;
    const runResponse = await fetchImpl(`https://api.github.com/repos/AETHERUS-MONOLITH/AETHERUS_MONOLITH/actions/runs/${manifest.run_id}`, { headers, redirect: "error" });
    if (runResponse.status === 404) return observation("NOT_FOUND", "run_not_found");
    if (!runResponse.ok) return observation("INDETERMINATE", `run_api_${runResponse.status}`);
    const run = await runResponse.json() as Record<string, unknown>;
    const workflowRun = artifact.workflow_run && typeof artifact.workflow_run === "object" ? artifact.workflow_run as Record<string, unknown> : {};
    const safeArtifact = { id: artifact.id, name: artifact.name, workflow_run_id: workflowRun.id, expired: artifact.expired, created_at: artifact.created_at, expires_at: artifact.expires_at };
    const safeRun = { id: run.id, run_attempt: run.run_attempt, head_sha: run.head_sha };
    const expiresAt = typeof artifact.expires_at === "string" ? Date.parse(artifact.expires_at) : Number.NaN;
    if (artifact.expired === true || (Number.isFinite(expiresAt) && expiresAt <= nowMs)) return observation("EXPIRED", "artifact_expired", safeArtifact, safeRun);
    return observation("MATCH", "authoritative_lookup_complete", safeArtifact, safeRun);
  } catch { return observation("INDETERMINATE", "artifact_api_transport_failure"); }
}
