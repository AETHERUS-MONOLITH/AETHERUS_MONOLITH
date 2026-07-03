import { controlledProjectPatterns } from "./identity-checks.mjs";

function finding(id, observation, status, severity, message, evidence, validatorVersion) {
  return {
    id,
    category: "jsonld",
    endpoint_key: observation.endpoint_key,
    entity_keys: observation.entities,
    status,
    severity,
    message,
    evidence,
    reproducibility: { analysis_version: "geo.jsonld.v1", deterministic: true },
    validator_version: validatorVersion
  };
}

export function jsonldFindings(evidence, sourceTruth, validatorVersion) {
  const findings = [];
  for (const observation of evidence.observations) {
    if (!observation.checks.includes("jsonld")) continue;
    if ((observation.jsonld || []).length === 0) {
      findings.push(
        finding(
          `geo-jsonld-${observation.endpoint_key}-structured-data-absent`,
          observation,
          "finding",
          "warning",
          "structured_data_absent: no JSON-LD block was observed; this is separate from fetch availability.",
          { jsonld_blocks: 0 },
          validatorVersion
        )
      );
      continue;
    }
    for (const [index, block] of observation.jsonld.entries()) {
      if (block.parse_status !== "parsed") {
        findings.push(
          finding(
            `geo-jsonld-${observation.endpoint_key}-${index}-parse-error`,
            observation,
            "finding",
            "error",
            "JSON-LD syntax could not be parsed as JSON.",
            { error: block.error },
            validatorVersion
          )
        );
      }
      for (const sameAs of block.same_as || []) {
        if (observation.entities.includes("entity:camilo_carlone") && controlledProjectPatterns.some((pattern) => pattern.test(sameAs))) {
          findings.push(
            finding(
              `geo-jsonld-${observation.endpoint_key}-${index}-cross-entity-same-as`,
              observation,
              "finding",
              "warning",
              "Observed JSON-LD sameAs crosses the Camilo/AETHERUS project-surface boundary.",
              { same_as: sameAs },
              validatorVersion
            )
          );
        }
      }
      if (observation.endpoint_key === "taa_publication_page" && block.types?.includes("ScholarlyArticle")) {
        const sourceType = sourceTruth.entities.entities.find((entity) => entity.id === "entity:the_apologetic_authority")?.source_type;
        if (sourceType === "Report") {
          findings.push(
            finding(
              "geo-jsonld-taa-source-type-contradiction",
              observation,
              "finding",
              "warning",
              "Contradiction: observed JSON-LD type ScholarlyArticle differs from source-truth type Report.",
              { source_truth_type: "Report", observed_types: block.types },
              validatorVersion
            )
          );
        }
      }
    }
  }
  return findings;
}
