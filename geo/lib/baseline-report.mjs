import os from "node:os";
import { sha256, validatorVersion } from "./endpoint-fetch.mjs";
import { canonicalJson } from "./source-loader.mjs";
import { identityFindings } from "./identity-checks.mjs";
import { endpointAvailabilityFindings } from "./endpoint-availability-checks.mjs";
import { backlinkFindings } from "./backlink-checks.mjs";
import { metadataFindings } from "./metadata-checks.mjs";
import { jsonldFindings } from "./jsonld-checks.mjs";
import { reproducibilityFindings } from "./reproducibility-checks.mjs";
import { chunkReadabilityFindings } from "./chunk-readability-checks.mjs";

const categoryOrder = [
  "identity",
  "endpoint_availability",
  "backlink",
  "metadata",
  "jsonld",
  "reproducibility",
  "chunk_readability"
];

export function analyzeEvidence({ sourceTruth, registry, evidence }) {
  const findings = [
    ...identityFindings(sourceTruth, validatorVersion),
    ...endpointAvailabilityFindings(evidence, validatorVersion),
    ...backlinkFindings(evidence, registry, validatorVersion),
    ...metadataFindings(evidence, sourceTruth, validatorVersion),
    ...jsonldFindings(evidence, sourceTruth, validatorVersion),
    ...reproducibilityFindings(evidence, validatorVersion),
    ...chunkReadabilityFindings(evidence, validatorVersion)
  ].sort((a, b) => {
    const categoryDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    return categoryDiff || a.id.localeCompare(b.id);
  });
  const grouped = Object.fromEntries(categoryOrder.map((category) => [category, findings.filter((finding) => finding.category === category)]));
  const structuralFindings = findings.map((finding) => ({
    id: finding.id,
    category: finding.category,
    endpoint_key: finding.endpoint_key,
    entity_keys: finding.entity_keys,
    status: finding.status,
    severity: finding.severity,
    message: finding.message,
    evidence: finding.evidence,
    reproducibility: finding.reproducibility,
    validator_version: finding.validator_version
  }));
  return {
    findings,
    grouped,
    structural_findings_hash: sha256(canonicalJson(structuralFindings))
  };
}

export function buildBaselineReport({ sourceTruth, registry, evidence, mode }) {
  const analysis = analyzeEvidence({ sourceTruth, registry, evidence });
  const endpointFailures = analysis.findings.some((finding) => finding.category === "endpoint_availability" && finding.status === "finding");
  const nonAdvisoryFindings = analysis.findings.some((finding) => finding.status === "finding" && finding.category !== "endpoint_availability");
  const contradictions = analysis.findings.filter((finding) => /contradiction/i.test(finding.message));
  const advisoryFindings = analysis.findings.filter((finding) => finding.status === "advisory");
  return {
    schema_version: "geo.baseline_report.v1",
    run: {
      id: `geo-0.1-${mode}`,
      mode,
      generated_at: new Date().toISOString()
    },
    source_truth_version: sourceTruth.entities.source_truth_version,
    endpoint_registry_version: registry.registry_version,
    validator_version: validatorVersion,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      hostname_hash: sha256(os.hostname()).slice(0, 16)
    },
    request_count: evidence.observations.length,
    fetch_outcomes: evidence.observations.map((observation) => ({
      endpoint_key: observation.endpoint_key,
      requested_url: observation.requested_url,
      final_url: observation.final_url,
      redirect_chain: observation.redirect_chain,
      observed_at: observation.observed_at,
      status: observation.status,
      content_type: observation.content_type,
      byte_count: observation.byte_count,
      raw_sha256: observation.raw_sha256,
      normalized_sha256: observation.normalized_sha256,
      failure: observation.failure
    })),
    findings: analysis.grouped,
    unresolved_variables: [
      "entity:camilo_carlone public_jsonld_id",
      "entity:camilo_carlone ORCID",
      "entity:camilo_carlone Wikidata",
      "entity:aetherus public_jsonld_id",
      "entity:aetherus legal-company or institutional status",
      "entity:the_apologetic_authority public_jsonld_id"
    ],
    contradictions,
    advisory_findings: advisoryFindings,
    structural_findings_hash: analysis.structural_findings_hash,
    boundary_statements: [
      "No public surface was modified by GEO 0.1.",
      "No model API, paid service, authenticated request, cookie, browser profile, or crawler expansion is used.",
      "Endpoint availability, backlink discoverability, identity consistency, JSON-LD structure, reproducibility, and advisory chunk readability are separate finding categories.",
      "Absent JSON-LD is classified as structured_data_absent, not retrieval failure.",
      "Advisory chunk findings cannot independently fail the report."
    ],
    overall_classification: endpointFailures
      ? "completed_with_endpoint_failures"
      : nonAdvisoryFindings || advisoryFindings.length > 0
        ? "completed_with_findings"
        : "completed"
  };
}

export function baselineMarkdown(report, evidence) {
  const lines = [
    "# GEO 0.1 Baseline",
    "",
    `Overall classification: ${report.overall_classification}`,
    `Structural findings hash: ${report.structural_findings_hash}`,
    "",
    "## Validated Source Truth",
    "",
    "- Camilo Carlone is represented as a Person with unresolved public JSON-LD @id, ORCID, and Wikidata identifiers.",
    "- AETHERUS is represented as a Project, with no legal-company, employer, publisher, institution, or formal organization status inferred.",
    "- The Apologetic Authority is represented as a Report authored by Camilo Carlone, with confirmed canonical URL and version DOI.",
    "",
    "## Observed Endpoint Facts"
  ];
  for (const outcome of report.fetch_outcomes) {
    lines.push(
      "",
      `- ${outcome.endpoint_key}: ${outcome.status ?? "no_status"} ${outcome.content_type ?? "no_content_type"}`,
      `  - requested: ${outcome.requested_url}`,
      `  - final: ${outcome.final_url ?? "none"}`,
      `  - raw_sha256: ${outcome.raw_sha256 ?? "none"}`,
      `  - normalized_sha256: ${outcome.normalized_sha256 ?? "none"}`
    );
  }
  lines.push("", "## Findings By Category");
  for (const [category, findings] of Object.entries(report.findings)) {
    lines.push("", `### ${category}`);
    for (const finding of findings) {
      lines.push(`- ${finding.status}/${finding.severity}: ${finding.id} — ${finding.message}`);
    }
  }
  lines.push(
    "",
    "## Unresolved Facts",
    "",
    ...report.unresolved_variables.map((item) => `- ${item}`),
    "",
    "## Statements Not Established",
    "",
    "- No indexing, ranking, citation, retrieval, or model-uptake outcome is established.",
    "- No affiliation, credential, employer, publisher, institutional relationship, legal status, or research-impact claim is added.",
    "- Missing backlinks are not identity invalidation.",
    "- Advisory chunk heuristics are not retrieval or ranking evidence.",
    "",
    "## Evidence Policy",
    "",
    `- Committed normalized evidence observations: ${evidence.observations.length}`,
    `- Excerpt limit: ${evidence.policy.excerpt_size_limit_chars} characters`,
    `- Response-size limit: ${evidence.policy.response_size_limit_bytes} bytes`,
    `- Timeout: ${evidence.policy.timeout_ms} ms`,
    `- Redirect limit: ${evidence.policy.redirect_limit}`,
    `- Raw material retained: ${evidence.policy.raw_material_retained}`
  );
  return `${lines.join("\n")}\n`;
}
