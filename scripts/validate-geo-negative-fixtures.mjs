#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildBaselineReport } from "../geo/lib/baseline-report.mjs";
import { canonicalJson, loadEndpointRegistry, loadSourceTruth } from "../geo/lib/source-loader.mjs";

const fixturePaths = {
  endpointFailure: "geo/fixtures/normalized-evidence/endpoint-failure.json",
  missingBacklink: "geo/fixtures/normalized-evidence/missing-backlink.json",
  missingJsonld: "geo/fixtures/normalized-evidence/missing-jsonld.json",
  advisoryChunk: "geo/fixtures/normalized-evidence/advisory-chunk.json",
  contradiction: "geo/fixtures/normalized-evidence/contradiction.json",
  replay: "geo/fixtures/normalized-evidence/replay.json"
};

const productionFunctions = [
  "loadSourceTruth",
  "loadEndpointRegistry",
  "buildBaselineReport",
  "analyzeEvidence",
  "identityFindings",
  "endpointAvailabilityFindings",
  "backlinkFindings",
  "metadataFindings",
  "jsonldFindings",
  "reproducibilityFindings",
  "chunkReadabilityFindings"
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function baseEvidence(observation) {
  return {
    schema_version: "geo.normalized_evidence.v1",
    validator_version: "geo-0.1.0",
    extraction_version: "geo.extraction.v1",
    policy: {
      excerpt_size_limit_chars: 420,
      response_size_limit_bytes: 750000,
      timeout_ms: 10000,
      redirect_limit: 5,
      raw_material_retained: false
    },
    observations: [
      {
        endpoint_key: "fixture_endpoint",
        requested_url: "https://example.com/",
        final_url: "https://example.com/",
        redirect_chain: [],
        observed_at: "2026-07-03T00:00:00.000Z",
        status: 200,
        content_type: "text/html",
        byte_count: 120,
        raw_sha256: "fixture-raw",
        normalized_sha256: "fixture-normalized",
        validator_version: "geo-0.1.0",
        extraction_version: "geo.extraction.v1",
        entities: ["entity:aetherus"],
        endpoint_role: "fixture",
        expected_content_class: "html",
        checks: ["availability", "backlinks", "metadata", "jsonld", "reproducibility", "chunk_readability"],
        failure: null,
        canonical_urls: [],
        publication_metadata: { title: "Fixture" },
        discovered_seed_links: [],
        jsonld: [],
        text_metrics: {
          text_char_count: 120,
          word_count: 24,
          heading_count: 1,
          link_count: 1,
          longest_token_chars: 12,
          excerpt: "Fixture content with enough words for the default readability pass path."
        },
        evidence_excerpt: "Fixture content",
        ...observation
      }
    ]
  };
}

function allFindings(report) {
  return Object.values(report.findings).flat();
}

function findingIds(findings) {
  return findings.map((finding) => finding.id).sort();
}

function deterministicProjection(report) {
  return {
    overall_classification: report.overall_classification,
    structural_findings_hash: report.structural_findings_hash,
    findings: Object.fromEntries(
      Object.entries(report.findings).map(([category, findings]) => [
        category,
        findings.map((finding) => ({
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
        }))
      ])
    )
  };
}

function buildFixtureReport(sourceTruth, registry, evidence) {
  return buildBaselineReport({ sourceTruth, registry, evidence, mode: "fixture" });
}

function summarizeCase(caseId, path, report, findings, assertions) {
  const summary = {
    case: caseId,
    fixture_path: path,
    production_functions_invoked: productionFunctions,
    finding_ids: findingIds(findings),
    categories: [...new Set(findings.map((finding) => finding.category))].sort(),
    report_classification: report.overall_classification,
    assertion_result: "pass",
    assertions
  };
  console.log(JSON.stringify(summary));
}

const sourceTruth = await loadSourceTruth();
const registry = await loadEndpointRegistry();

const endpointFailure = await readJson(fixturePaths.endpointFailure);
const missingBacklink = await readJson(fixturePaths.missingBacklink);
const missingJsonld = await readJson(fixturePaths.missingJsonld);
const advisoryChunk = await readJson(fixturePaths.advisoryChunk);
const contradiction = await readJson(fixturePaths.contradiction);
const replayFixture = await readJson(fixturePaths.replay);

{
  const evidence = baseEvidence({
    ...endpointFailure.observation,
    requested_url: "https://example.com/failure",
    final_url: null,
    redirect_chain: [],
    content_type: null,
    byte_count: 0,
    raw_sha256: null,
    normalized_sha256: null,
    expected_content_class: "html"
  });
  const report = buildFixtureReport(sourceTruth, registry, evidence);
  const findings = allFindings(report);
  const endpointFinding = findings.find((finding) => finding.category === "endpoint_availability" && finding.status === "finding");
  assert(endpointFinding, "endpoint_failure_separated_from_identity: missing endpoint availability finding");
  assert(endpointFinding.reproducibility?.deterministic === true, "endpoint failure finding must be reproducible");
  assert(!findings.some((finding) => finding.category === "identity" && /contradiction/i.test(finding.message)), "endpoint failure must not emit identity contradiction");
  assert(report.overall_classification === "completed_with_endpoint_failures", "endpoint failure report classification must be completed_with_endpoint_failures");
  summarizeCase("endpoint_failure_separated_from_identity", fixturePaths.endpointFailure, report, findings, [
    "endpoint availability finding emitted",
    "identity contradiction absent",
    "report completed with endpoint failure classification"
  ]);
}

{
  const evidence = baseEvidence({
    endpoint_key: "fixture_missing_backlink",
    entities: ["entity:aetherus"],
    discovered_seed_links: missingBacklink.discovered_seed_links,
    checks: ["backlinks", "reproducibility"]
  });
  const report = buildFixtureReport(sourceTruth, registry, evidence);
  const findings = allFindings(report);
  const backlinkFinding = findings.find((finding) => finding.category === "backlink" && finding.status === "finding");
  assert(backlinkFinding, "missing_backlink_separated_from_identity: missing backlink finding");
  assert(!findings.some((finding) => finding.category === "identity" && /invalid|contradiction/i.test(finding.message)), "missing backlink must not invalidate identity");
  summarizeCase("missing_backlink_separated_from_identity", fixturePaths.missingBacklink, report, findings, [
    "backlink finding emitted",
    "finding remains backlink category",
    "identity invalidation absent"
  ]);
}

{
  const evidence = baseEvidence({
    endpoint_key: "fixture_missing_jsonld",
    entities: ["entity:aetherus"],
    jsonld: missingJsonld.jsonld,
    checks: ["jsonld", "reproducibility"]
  });
  const report = buildFixtureReport(sourceTruth, registry, evidence);
  const findings = allFindings(report);
  const jsonldFinding = findings.find((finding) => finding.category === "jsonld" && /structured_data_absent/.test(finding.message));
  assert(jsonldFinding, "missing_jsonld_classified_without_retrieval_claim: missing structured_data_absent finding");
  assert(!/(retrieval|indexing|ranking|citation|training|model-uptake) failure/i.test(jsonldFinding.message), "missing JSON-LD message contains forbidden failure language");
  summarizeCase("missing_jsonld_classified_without_retrieval_claim", fixturePaths.missingJsonld, report, findings, [
    "structured_data_absent finding emitted",
    "finding remains JSON-LD category",
    "forbidden outcome language absent"
  ]);
}

{
  const evidence = baseEvidence({
    endpoint_key: "fixture_advisory_chunk",
    entities: ["entity:aetherus"],
    text_metrics: advisoryChunk.text_metrics,
    checks: ["chunk_readability", "reproducibility"]
  });
  const report = buildFixtureReport(sourceTruth, registry, evidence);
  const findings = allFindings(report);
  const chunkFinding = findings.find((finding) => finding.category === "chunk_readability" && finding.status === "advisory");
  assert(chunkFinding, "advisory_chunk_is_emitted_and_non_blocking: missing advisory chunk finding");
  assert(chunkFinding.reproducibility?.advisory_only === true, "chunk finding must be advisory_only");
  assert(report.overall_classification === "completed_with_findings", "advisory chunk report must complete with findings-bearing classification");
  summarizeCase("advisory_chunk_is_emitted_and_non_blocking", fixturePaths.advisoryChunk, report, findings, [
    "advisory chunk finding emitted",
    "advisory_only metadata true",
    "report remains completed_with_findings"
  ]);
}

{
  const sourceBefore = canonicalJson(sourceTruth.entities);
  const evidence = baseEvidence({
    endpoint_key: "taa_publication_page",
    requested_url: "https://camilocarlone.com/the-apologetic-authority/",
    final_url: "https://camilocarlone.com/the-apologetic-authority/",
    entities: ["entity:the_apologetic_authority", "entity:camilo_carlone"],
    canonical_urls: ["https://camilocarlone.com/the-apologetic-authority/"],
    jsonld: [
      {
        parse_status: "parsed",
        top_level: "object",
        types: [contradiction.observed_public_type],
        ids: [],
        names: ["The Apologetic Authority"],
        same_as: [],
        url_values: []
      }
    ],
    checks: ["metadata", "jsonld", "reproducibility"]
  });
  const report = buildFixtureReport(sourceTruth, registry, evidence);
  const findings = allFindings(report);
  const contradictionFindings = findings.filter((finding) => /Contradiction:/.test(finding.message));
  assert(sourceTruth.entities.entities.find((entity) => entity.id === "entity:the_apologetic_authority")?.source_type === contradiction.source_truth_type, "source truth must remain Report");
  assert(contradictionFindings.length > 0, "source_public_type_contradiction_preserved: missing contradiction finding");
  assert(canonicalJson(sourceTruth.entities) === sourceBefore, "source truth was mutated during contradiction analysis");
  summarizeCase("source_public_type_contradiction_preserved", fixturePaths.contradiction, report, findings, [
    "source truth remains Report",
    "observed public type remains ScholarlyArticle",
    "contradiction finding emitted",
    "source truth object unchanged"
  ]);
}

{
  const reportOne = buildFixtureReport(sourceTruth, registry, replayFixture);
  const reportTwo = buildFixtureReport(sourceTruth, registry, replayFixture);
  const projectionOne = canonicalJson(deterministicProjection(reportOne));
  const projectionTwo = canonicalJson(deterministicProjection(reportTwo));
  const byteHashOne = sha256(projectionOne);
  const byteHashTwo = sha256(projectionTwo);
  assert(reportOne.structural_findings_hash === reportTwo.structural_findings_hash, "fixture replay structural hash mismatch");
  assert(byteHashOne === byteHashTwo, "fixture replay canonical byte hash mismatch");
  assert(projectionOne === projectionTwo, "fixture replay canonical bytes differ");
  console.log(
    JSON.stringify({
      case: "fixture_replay_is_deterministic",
      fixture_path: fixturePaths.replay,
      production_functions_invoked: productionFunctions,
      finding_ids: findingIds(allFindings(reportOne)),
      categories: [...new Set(allFindings(reportOne).map((finding) => finding.category))].sort(),
      report_classification: reportOne.overall_classification,
      structural_hash_one: reportOne.structural_findings_hash,
      structural_hash_two: reportTwo.structural_findings_hash,
      independent_sha256_one: byteHashOne,
      independent_sha256_two: byteHashTwo,
      byte_count_one: Buffer.byteLength(projectionOne),
      byte_count_two: Buffer.byteLength(projectionTwo),
      outputs_byte_identical: projectionOne === projectionTwo,
      assertion_result: "pass",
      assertions: [
        "same fixture input used twice",
        "production structural hashes match",
        "canonical serialized finding bytes match"
      ]
    })
  );
}
