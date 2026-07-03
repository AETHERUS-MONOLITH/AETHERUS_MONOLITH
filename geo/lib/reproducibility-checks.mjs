import { evidenceHash } from "./evidence-normalization.mjs";

export function reproducibilityFindings(evidence, validatorVersion) {
  const findings = [];
  for (const observation of evidence.observations) {
    const ok = Boolean(observation.raw_sha256 || observation.failure) && Boolean(observation.normalized_sha256 || observation.failure);
    findings.push({
      id: `geo-reproducibility-${observation.endpoint_key}`,
      category: "reproducibility",
      endpoint_key: observation.endpoint_key,
      entity_keys: observation.entities,
      status: ok ? "pass" : "finding",
      severity: ok ? "info" : "error",
      message: ok
        ? "Raw and normalized evidence hashes or structured failure state are present."
        : "Evidence hash metadata is incomplete.",
      evidence: {
        raw_sha256: observation.raw_sha256,
        normalized_sha256: observation.normalized_sha256,
        failure: observation.failure
      },
      reproducibility: {
        analysis_version: "geo.reproducibility.v1",
        deterministic: true,
        evidence_hash: evidenceHash(evidence)
      },
      validator_version: validatorVersion
    });
  }
  return findings;
}
