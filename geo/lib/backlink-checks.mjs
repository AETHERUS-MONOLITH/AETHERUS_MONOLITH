function makeFinding(id, observation, status, severity, message, evidence, validatorVersion) {
  return {
    id,
    category: "backlink",
    endpoint_key: observation.endpoint_key,
    entity_keys: observation.entities,
    status,
    severity,
    message,
    evidence,
    reproducibility: { analysis_version: "geo.backlink.v1", deterministic: true },
    validator_version: validatorVersion
  };
}

export function backlinkFindings(evidence, registry, validatorVersion) {
  const seedUrls = registry.endpoints.map((endpoint) => endpoint.requested_url);
  const findings = [];
  for (const observation of evidence.observations) {
    if (!observation.checks.includes("backlinks")) continue;
    const discovered = observation.discovered_seed_links || [];
    const absent = seedUrls.filter((url) => url !== observation.requested_url && !discovered.includes(url));
    findings.push(
      makeFinding(
        `geo-backlink-${observation.endpoint_key}`,
        observation,
        absent.length > 0 ? "finding" : "pass",
        absent.length > 0 ? "warning" : "info",
        absent.length > 0
          ? "Authorized seed backlinks are not universally discoverable from this seed response; this is not an identity invalidation."
          : "Authorized seed backlinks were discoverable from this seed response.",
        { discovered_seed_links: discovered, absent_seed_links: absent },
        validatorVersion
      )
    );
  }
  return findings;
}
