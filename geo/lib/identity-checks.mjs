export const controlledProjectPatterns = [
  /^https:\/\/github\.com\/AETHERUS-MONOLITH\b/i,
  /^https:\/\/aetherus-monolith\.pages\.dev\b/i,
  /^https:\/\/camilocarlone\.com\/?$/i
];

export function sourceTruthErrors(sourceTruth) {
  const errors = [];
  const entities = sourceTruth.entities.entities;
  const claims = sourceTruth.claims.claims;
  const ids = new Set();
  for (const entity of entities) {
    if (ids.has(entity.id)) errors.push(`duplicate entity id: ${entity.id}`);
    ids.add(entity.id);
  }
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  for (const required of ["entity:camilo_carlone", "entity:aetherus", "entity:the_apologetic_authority"]) {
    if (!byId.has(required)) errors.push(`missing required entity: ${required}`);
  }
  if (byId.get("entity:camilo_carlone")?.source_type !== "Person") errors.push("Camilo must be source_type Person");
  if (byId.get("entity:aetherus")?.source_type !== "Project") errors.push("AETHERUS must be source_type Project");
  if (byId.get("entity:the_apologetic_authority")?.source_type !== "Report") errors.push("TAA must be source_type Report");
  if (byId.get("entity:aetherus") === byId.get("entity:camilo_carlone")) {
    errors.push("Camilo and AETHERUS cannot share an entity record");
  }
  const camilo = byId.get("entity:camilo_carlone");
  for (const url of camilo?.same_as || []) {
    if (controlledProjectPatterns.some((pattern) => pattern.test(url))) {
      errors.push(`Camilo same_as cannot include AETHERUS-controlled surface: ${url}`);
    }
  }
  for (const entity of entities) {
    const identifiers = entity.identifiers || {};
    if (identifiers.orcid && !identifiers.orcid_confirmed) errors.push(`${entity.id}: ORCID requires confirmed provenance`);
    if (identifiers.wikidata && !identifiers.wikidata_confirmed) errors.push(`${entity.id}: Wikidata requires confirmed provenance`);
    if (identifiers.doi && entity.id !== "entity:the_apologetic_authority") errors.push(`${entity.id}: DOI is not permitted here`);
    if (identifiers.organization_id) errors.push(`${entity.id}: invented organization identifiers are not permitted`);
  }
  const entityIds = new Set(entities.map((entity) => entity.id));
  for (const claim of claims) {
    if (!entityIds.has(claim.subject)) errors.push(`${claim.key}: subject is not a known entity`);
    if (claim.object_entity && !entityIds.has(claim.object_entity)) errors.push(`${claim.key}: object_entity is not a known entity`);
    if (claim.status === "confirmed" && (!claim.source_references || claim.source_references.length === 0)) {
      errors.push(`${claim.key}: confirmed claim requires source references`);
    }
  }
  return errors;
}

export function identityFindings(sourceTruth, validatorVersion) {
  const errors = sourceTruthErrors(sourceTruth);
  if (errors.length === 0) {
    return [
      finding("geo-identity-source-truth-pass", "pass", "info", null, [
        "entity:camilo_carlone",
        "entity:aetherus",
        "entity:the_apologetic_authority"
      ], "Source-truth identity invariants are valid.", { checked_invariants: 8 }, validatorVersion)
    ];
  }
  return errors.map((message, index) =>
    finding(`geo-identity-source-truth-${String(index + 1).padStart(2, "0")}`, "finding", "error", null, [], message, {}, validatorVersion)
  );
}

function finding(id, status, severity, endpointKey, entityKeys, message, evidence, validatorVersion) {
  return {
    id,
    category: "identity",
    endpoint_key: endpointKey,
    entity_keys: entityKeys,
    status,
    severity,
    message,
    evidence,
    reproducibility: { analysis_version: "geo.identity.v1", deterministic: true },
    validator_version: validatorVersion
  };
}
