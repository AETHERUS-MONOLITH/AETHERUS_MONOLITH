export function chunkReadabilityFindings(evidence, validatorVersion) {
  const findings = [];
  for (const observation of evidence.observations) {
    if (!observation.checks.includes("chunk_readability")) continue;
    const metrics = observation.text_metrics || {};
    const reasons = [];
    if ((metrics.word_count || 0) < 20) reasons.push("extremely short or empty extracted content");
    if ((metrics.longest_token_chars || 0) > 220) reasons.push("extremely long unbroken text block");
    if ((metrics.heading_count || 0) === 0 && (metrics.word_count || 0) > 120) reasons.push("absence of usable heading hierarchy");
    if ((metrics.link_count || 0) > Math.max(40, (metrics.word_count || 0) / 4)) reasons.push("navigation or boilerplate dominates extracted content");
    findings.push({
      id: `geo-chunk-${observation.endpoint_key}`,
      category: "chunk_readability",
      endpoint_key: observation.endpoint_key,
      entity_keys: observation.entities,
      status: reasons.length > 0 ? "advisory" : "pass",
      severity: reasons.length > 0 ? "advisory" : "info",
      message:
        reasons.length > 0
          ? `Advisory chunk readability signals: ${reasons.join("; ")}. These do not fail the GEO 0.1 report.`
          : "Advisory chunk readability heuristics did not flag this endpoint.",
      evidence: { metrics, reasons },
      reproducibility: { analysis_version: "geo.chunk_readability.v1", deterministic: true, advisory_only: true },
      validator_version: validatorVersion
    });
  }
  return findings;
}
