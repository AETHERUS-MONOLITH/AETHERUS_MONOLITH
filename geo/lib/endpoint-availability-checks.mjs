export function endpointAvailabilityFindings(evidence, validatorVersion) {
  return evidence.observations.map((observation) => {
    const success = !observation.failure && observation.status >= 200 && observation.status < 400;
    const contentOk =
      !observation.content_type ||
      observation.expected_content_class === "unknown" ||
      (observation.expected_content_class === "html" && /html/i.test(observation.content_type)) ||
      (observation.expected_content_class === "json" && /json/i.test(observation.content_type)) ||
      (observation.expected_content_class === "text" && /text/i.test(observation.content_type));
    const ok = success && contentOk;
    return {
      id: `geo-endpoint-${observation.endpoint_key}`,
      category: "endpoint_availability",
      endpoint_key: observation.endpoint_key,
      entity_keys: observation.entities,
      status: ok ? "pass" : "finding",
      severity: ok ? "info" : "warning",
      message: ok
        ? "Endpoint responded within configured availability boundaries."
        : "Endpoint produced a structured availability finding; this is separate from identity validity.",
      evidence: {
        requested_url: observation.requested_url,
        final_url: observation.final_url,
        redirect_chain: observation.redirect_chain,
        status: observation.status,
        content_type: observation.content_type,
        byte_count: observation.byte_count,
        failure: observation.failure,
        expected_content_class: observation.expected_content_class
      },
      reproducibility: { analysis_version: "geo.endpoint_availability.v1", deterministic: true },
      validator_version: validatorVersion
    };
  });
}
