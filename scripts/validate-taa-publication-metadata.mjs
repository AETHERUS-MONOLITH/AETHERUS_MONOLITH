#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const metadataPath = "data/taa-publication-metadata.v1.json";
const versionDoi = "10.5281/zenodo.20788207";
const versionDoiUrl = "https://doi.org/10.5281/zenodo.20788207";
const allVersionsDoi = "10.5281/zenodo.20788206";
const allVersionsDoiUrl = "https://doi.org/10.5281/zenodo.20788206";

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertIncludes(values, expected, label) {
  assert(Array.isArray(values), `${label}: expected an array`);
  if (!values.includes(expected)) fail(`${label}: missing ${JSON.stringify(expected)}`);
}

function walkStrings(value, strings = []) {
  if (typeof value === "string") strings.push(value);
  else if (Array.isArray(value)) value.forEach((item) => walkStrings(item, strings));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => walkStrings(item, strings));
  return strings;
}

async function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const text = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(text);
}

await fs.access(path.join(repoRoot, metadataPath));
const metadata = await readJson(metadataPath);
const publication = metadata.publication;

assert(publication && typeof publication === "object", "publication: missing object");

assertEqual(
  publication.canonical_title,
  "The Apologetic Authority: A Structural Critique of Anthropic’s Constitution for Claude",
  "canonical title"
);
assertEqual(publication.canonical_url, "https://camilocarlone.com/the-apologetic-authority/", "canonical URL");
assert(publication.canonical_url.endsWith("/"), "canonical URL: must be trailing-slash stable");
assertEqual(publication.author?.name, "Camilo Carlone", "author");
assert(publication.status.includes("v1.0.1"), "status: must include v1.0.1");
assert(publication.status.includes("Final Manuscript"), "status: must include Final Manuscript");

const date = publication.date;
assert(date && typeof date === "object", "date: missing object");
if (date.verification === "verified") {
  assert(typeof date.value === "string" && date.value.length > 0, "date: verified date must include a value");
  assert(typeof date.source === "string" && date.source.includes("Canonical route"), "date: verified date must include repository source");
} else {
  assertEqual(date.verification, "unresolved", "date verification");
  assert(typeof date.reason === "string" && date.reason.length > 0, "date: unresolved date must include a reason");
}

assert(typeof publication.abstract === "string" && publication.abstract.trim().length > 0, "abstract: missing");
assert(typeof publication.short_description === "string" && publication.short_description.trim().length > 0, "short description: missing");

const requiredKeywords = [
  "Anthropic Constitution",
  "Claude",
  "Constitutional AI",
  "AI governance",
  "model behavior risk",
  "auditability",
  "observability",
  "governance architecture",
  "AI safety",
  "structural critique"
];

for (const keyword of requiredKeywords) {
  assertIncludes(publication.keywords, keyword, "keywords");
}

const citationText = publication.citation?.text ?? "";
assert(citationText.length > 0, "citation block: missing text");
assert(citationText.includes("Carlone, C. (2026)."), "citation block: missing author/date");
assert(citationText.includes("(v1.0.1). Zenodo."), "citation block: missing version/Zenodo state");
assert(citationText.includes(versionDoiUrl), "citation block: missing version DOI URL");
assertEqual(publication.citation?.doi_included, true, "citation DOI flag");
assertEqual(publication.citation?.version_doi, versionDoi, "citation version DOI");
assertEqual(publication.citation?.version_doi_url, versionDoiUrl, "citation version DOI URL");
assertEqual(publication.citation?.all_versions_doi, allVersionsDoi, "citation all-versions DOI");
assertEqual(publication.citation?.all_versions_doi_url, allVersionsDoiUrl, "citation all-versions DOI URL");

assertEqual(publication.doi?.status, "minted", "DOI status");
assertEqual(publication.doi?.claimable, true, "DOI claimable");
assertEqual(publication.doi?.display, `DOI: ${versionDoi}`, "DOI display");
assertEqual(publication.doi?.version, versionDoi, "version DOI");
assertEqual(publication.doi?.version_url, versionDoiUrl, "version DOI URL");
assertEqual(publication.doi?.all_versions, allVersionsDoi, "all-versions DOI");
assertEqual(publication.doi?.all_versions_url, allVersionsDoiUrl, "all-versions DOI URL");

assertEqual(publication.archive?.status, "deposited", "archive status");
assertEqual(publication.archive?.platform, "Zenodo", "archive platform");
assertEqual(publication.archive?.resource_type, "Report", "archive resource type");
assertEqual(publication.archive?.publication_date, "2026-06-21", "archive publication date");
assertEqual(publication.archive?.operator_execution_date, "2026-06-22", "archive operator execution date");

assertEqual(publication.pdf?.status, "repository_integrated", "PDF status");
assertEqual(
  publication.pdf?.public_url,
  "https://camilocarlone.com/the-apologetic-authority/the-apologetic-authority-v1.0.1.pdf",
  "PDF public URL"
);
assertEqual(publication.pdf?.claimable, true, "PDF claimable");
assertEqual(publication.pdf?.page_count, 44, "PDF page count");
assertEqual(publication.pdf?.format, "A4", "PDF format");
assertEqual(
  publication.pdf?.source_artifact,
  "the-apologetic-authority/the-apologetic-authority-v1.0.1.pdf",
  "PDF source artifact"
);

const sourceStatus = publication.repository_source_status;
assertEqual(sourceStatus?.canonical_route_live, true, "canonical route live");
assertEqual(sourceStatus?.canonical_surface_complete, true, "canonical surface complete");
assertEqual(sourceStatus?.metadata_package_created, true, "metadata package created");
assertEqual(sourceStatus?.pdf_artifact_integrated, true, "PDF artifact integrated");
assertEqual(sourceStatus?.doi_minted, true, "DOI minted");
assertEqual(sourceStatus?.archive_release_completed, true, "archive release completed");
assertEqual(sourceStatus?.search_submission_completed, false, "search submission completed");
assertEqual(sourceStatus?.distribution_completed, false, "distribution completed");

const license = publication.license;
assert(license && typeof license === "object", "license: missing object");
assert(
  license.manuscript_license_statement === "All rights reserved." || license.manuscript_license_statement === "unresolved",
  "license: must be grounded or explicitly unresolved"
);
assertEqual(license.archive_license_decision, "All rights reserved", "archive license decision");

const requiredBoundaryItems = [
  "no journal publication or peer review claimed",
  "no institutional validation or Anthropic assessment claimed",
  "no arXiv claim unless submitted",
  "no institutional affiliation invented",
  "no NEXUS release gate",
  "no product deployment claim"
];

for (const item of requiredBoundaryItems) {
  assertIncludes(publication.does_not_claim, item, "boundary block");
}

const requiredReuseTargets = [
  "canonical page update",
  "Zenodo deposit",
  "PDF front matter",
  "Search Console / Bing",
  "LinkedIn article",
  "LessWrong post",
  "email outreach",
  "arXiv endorsement request"
];

for (const target of requiredReuseTargets) {
  assertIncludes(publication.reuse_targets, target, "reuse targets");
}

const allMetadataText = walkStrings(metadata).join("\n");
const forbiddenMetadataClaims = [
  /published in/i,
  /journal publication[^.\n]*(accepted|completed|published)/i,
  /peer[- ]review(ed)?[^.\n]*(accepted|completed|published|validated)/i,
  /institutional validation[^.\n]*(completed|validated|endorsed)/i,
  /Anthropic assessment[^.\n]*(completed|validated|endorsed)/i,
  /Search Console submitted/i,
  /Bing submitted/i,
  /LinkedIn published/i,
  /LessWrong published/i,
  /NEXUS release gate[^.\n]*(required|true)/i,
  /Supabase/i,
  /createClient\(/,
  /postgres:\/\//,
  /postgresql:\/\//,
  /service_role/,
  /JWT_SECRET/,
  /model API/i,
  /runtime execution/i
];

for (const pattern of forbiddenMetadataClaims) {
  assert(!pattern.test(allMetadataText), `forbidden publication claim: ${pattern}`);
}

console.log("TAA publication metadata validation passed.");
