function finding(id, observation, status, severity, message, evidence, validatorVersion) {
  return {
    id,
    category: "metadata",
    endpoint_key: observation.endpoint_key,
    entity_keys: observation.entities,
    status,
    severity,
    message,
    evidence,
    reproducibility: { analysis_version: "geo.metadata.v1", deterministic: true },
    validator_version: validatorVersion
  };
}

export function metadataFindings(evidence, sourceTruth, validatorVersion) {
  const findings = [];
  const taa = sourceTruth.entities.entities.find((entity) => entity.id === "entity:the_apologetic_authority");
  for (const observation of evidence.observations) {
    if (!observation.checks.includes("metadata")) continue;
    const canonical = observation.canonical_urls || [];
    if (observation.endpoint_key === "taa_publication_page") {
      const typeValues = observation.jsonld.flatMap((block) => block.types || []);
      if (typeValues.includes("ScholarlyArticle") && taa.source_type === "Report") {
        findings.push(
          finding(
            "geo-metadata-taa-source-public-type-contradiction",
            observation,
            "finding",
            "warning",
            "Contradiction: observed public JSON-LD type ScholarlyArticle differs from GEO source-truth type Report; GEO 0.1 reports rather than repairs it.",
            { source_truth_type: "Report", observed_public_type: "ScholarlyArticle" },
            validatorVersion
          )
        );
      }
      if (!canonical.includes(taa.canonical_url)) {
        findings.push(
          finding(
            "geo-metadata-taa-canonical-missing",
            observation,
            "finding",
            "warning",
            "TAA canonical URL was not observed in canonical metadata.",
            { expected: taa.canonical_url, observed: canonical },
            validatorVersion
          )
        );
      }
    }
    if (canonical.length === 0) {
      findings.push(
        finding(
          `geo-metadata-${observation.endpoint_key}-canonical-absent`,
          observation,
          "finding",
          "warning",
          "Canonical URL metadata is absent or not extractable from this endpoint.",
          { canonical_urls: [] },
          validatorVersion
        )
      );
    }
    if (!observation.publication_metadata?.title) {
      findings.push(
        finding(
          `geo-metadata-${observation.endpoint_key}-title-absent`,
          observation,
          "finding",
          "warning",
          "HTML title metadata is absent or not extractable from this endpoint.",
          { title: observation.publication_metadata?.title || null },
          validatorVersion
        )
      );
    }
  }
  return findings.length > 0
    ? findings
    : [
        {
          id: "geo-metadata-pass",
          category: "metadata",
          endpoint_key: null,
          entity_keys: [],
          status: "pass",
          severity: "info",
          message: "Canonical and publication metadata checks completed without structural findings.",
          evidence: { checked_endpoints: evidence.observations.length },
          reproducibility: { analysis_version: "geo.metadata.v1", deterministic: true },
          validator_version: validatorVersion
        }
      ];
}
