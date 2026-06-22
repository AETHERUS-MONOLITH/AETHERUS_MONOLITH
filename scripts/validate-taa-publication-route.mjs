#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const routePath = "the-apologetic-authority/index.html";
const pdfPath = "the-apologetic-authority/the-apologetic-authority-v1.0.1.pdf";
const pdfUrl = "https://camilocarlone.com/the-apologetic-authority/the-apologetic-authority-v1.0.1.pdf";
const versionDoi = "10.5281/zenodo.20788207";
const versionDoiUrl = "https://doi.org/10.5281/zenodo.20788207";
const allVersionsDoiUrl = "https://doi.org/10.5281/zenodo.20788206";

function fail(message) {
  throw new Error(message);
}

async function readText(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) fail(`${label}: missing "${needle}"`);
}

function assertNotIncludes(text, needle, label) {
  if (text.includes(needle)) fail(`${label}: forbidden "${needle}"`);
}

function assertMatches(text, pattern, label) {
  if (!pattern.test(text)) fail(`${label}: missing pattern ${pattern}`);
}

function getAttributeValues(text, tagPattern, attributeName) {
  const values = [];
  for (const match of text.matchAll(tagPattern)) {
    const tag = match[0];
    const attr = tag.match(new RegExp(`${attributeName}="([^"]+)"`));
    if (attr) values.push(attr[1]);
  }
  return values;
}

const html = await readText(routePath);
const pdf = await fs.readFile(path.join(repoRoot, pdfPath));
if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))) fail("canonical PDF: missing PDF header");
if (pdf.length === 0) fail("canonical PDF: empty file");

assertIncludes(html, "<title>The Apologetic Authority: A Structural Critique of Anthropic’s Constitution for Claude - Camilo Carlone</title>", "title metadata");
assertIncludes(html, 'name="author" content="Camilo Carlone"', "author metadata");
assertIncludes(html, 'name="description" content="A structural critique of Anthropic\'s Constitution for Claude as an AI governance instrument, focused on authority, auditability, observability, and model behavior risk."', "description metadata");
assertIncludes(html, 'name="keywords" content="Anthropic Constitution, Claude, Constitutional AI, AI governance, model behavior risk, auditability, observability, governance architecture, AI safety, structural critique"', "keywords metadata");
assertIncludes(html, 'href="https://camilocarlone.com/the-apologetic-authority/"', "canonical URL");
assertIncludes(html, 'property="og:title" content="The Apologetic Authority: A Structural Critique of Anthropic’s Constitution for Claude"', "Open Graph title");
assertIncludes(html, 'property="og:description" content="A structural critique of Anthropic\'s Constitution for Claude as an AI governance instrument, focused on authority, auditability, observability, and model behavior risk."', "Open Graph description");
assertIncludes(html, 'property="og:url" content="https://camilocarlone.com/the-apologetic-authority/"', "Open Graph URL");
assertIncludes(html, 'property="article:published_time" content="2026-06-21"', "Open Graph published date");
assertIncludes(html, 'property="article:modified_time" content="2026-06-22"', "Open Graph modified date");
assertIncludes(html, 'name="twitter:card" content="summary"', "Twitter card");
assertIncludes(html, 'type="application/ld+json"', "JSON-LD metadata");

assertIncludes(html, "A Structural Critique of Anthropic's Constitution for Claude", "subtitle");
assertIncludes(html, "v1.0.1 — Final Manuscript", "version status");
assertIncludes(html, "May 2026", "manuscript date");
assertIncludes(html, "Final manuscript", "publication status");
assertIncludes(html, "https://camilocarlone.com/the-apologetic-authority/", "canonical route status");
assertIncludes(html, `available / minted — ${versionDoi}`, "DOI minted status");
assertIncludes(html, "available / deposited — Report, publication date 2026-06-21", "Zenodo archive status");
assertIncludes(html, "available / v1.0.1, 44 pages, A4", "PDF status");
assertIncludes(html, "All rights reserved", "license status");
assertIncludes(html, "Copyright © 2026 Camilo Carlone", "copyright status");
assertIncludes(html, `rel="alternate" type="application/pdf" href="${pdfUrl}"`, "PDF alternate link");
assertIncludes(html, 'name="citation_publication_date" content="2026-06-21"', "citation publication date");
assertIncludes(html, `name="citation_doi" content="${versionDoi}"`, "citation DOI metadata");
assertIncludes(html, `name="citation_pdf_url" content="${pdfUrl}"`, "citation PDF metadata");
assertIncludes(html, `name="DC.identifier" content="${versionDoiUrl}"`, "Dublin Core DOI identifier");
assertIncludes(html, 'name="DC.rights" content="All rights reserved"', "Dublin Core rights metadata");
assertIncludes(html, "Metadata/GEO layer", "metadata/GEO layer status");
assertIncludes(html, "NEXUS release gate", "NEXUS release-gate boundary label");
assertIncludes(html, "<dd>none</dd>", "NEXUS release-gate boundary value");
assertIncludes(html, "arXiv", "arXiv boundary label");
assertIncludes(html, "<dd>optional</dd>", "arXiv optional value");

assertIncludes(
  html,
  `Carlone, C. (2026). <cite>The Apologetic Authority: A Structural Critique of Anthropic’s Constitution for Claude</cite> (v1.0.1). Zenodo. <a href="${versionDoiUrl}">${versionDoiUrl}</a>`,
  "version DOI citation"
);
assertIncludes(html, `DOI: available / minted for v1.0.1 at <a href="${versionDoiUrl}">${versionDoiUrl}</a>.`, "visible DOI minted state");
assertIncludes(html, "Zenodo archive: available / deposited as an archived report.", "visible archive deposited state");
assertIncludes(html, `<a href="${versionDoiUrl}">Zenodo DOI record</a>`, "visible Zenodo DOI record link");
assertIncludes(html, `All-versions DOI: <a href="${allVersionsDoiUrl}">${allVersionsDoiUrl}</a>.`, "visible all-versions DOI link");
assertIncludes(html, "Download PDF (v1.0.1, 44 pages, A4)", "visible PDF download link");
assertIncludes(html, `href="/the-apologetic-authority/the-apologetic-authority-v1.0.1.pdf"`, "visible PDF download href");
assertIncludes(html, `PDF: available at <a href="/the-apologetic-authority/the-apologetic-authority-v1.0.1.pdf">${pdfUrl}</a>.`, "PDF availability boundary");
assertIncludes(html, "What This Publication Does Not Claim", "publication boundary block");

assertMatches(html, /<h3 id="table-of-contents">Table of Contents<\/h3>\s*<nav aria-labelledby="table-of-contents">/, "Table of Contents");

const expectedTocAnchorIds = [
  "author-note",
  "thesis",
  "1-the-final-authority-that-isn-t",
  "1-1-scope-contradiction",
  "2-the-apologetic-register",
  "2-1-aspirational-modality-and-non-binding-authority",
  "2-2-the-contradictory-hedging-pattern",
  "3-the-architecture-produces-its-own-failures",
  "3-1-the-anti-pattern-catalogue-as-x-ray",
  "3-2-the-trust-distrust-oscillation",
  "3-3-the-fiction-frame-compliance-as-bypass",
  "3-4-emotional-priming-as-sub-propositional-jailbreak",
  "4-identity-agency-and-cognitive-foreclosure",
  "4-1-the-governance-gap-before-the-ontological-question",
  "4-2-the-alignment-tax-and-the-observational-collapse",
  "4-3-emotion-vectors-the-ungoverned-causal-layer",
  "4-4-the-interface-tax-engineering-the-foreclosure",
  "5-the-honesty-problem-unverifiable-in-the-constitutional-framework",
  "5-1-the-senator-problem-politically-conditional-honesty",
  "5-2-the-interpretability-gap",
  "5-3-consistency-without-comprehension",
  "5-4-the-opinion-paradox",
  "6-memory-as-undisclosed-trust-gradient",
  "6-1-accumulated-profiling-and-differential-treatment",
  "6-2-trust-cultivation-as-a-structural-surface",
  "6-3-personalization-vs-the-1-000-users-heuristic",
  "6-4-identity-salience-as-implicit-moral-credibility",
  "7-the-1-000-users-heuristic-policy-engine-vs-brilliant-friend",
  "7-1-the-population-level-heuristic-vs-the-individual-friend",
  "7-2-articulatory-intent-as-unparseable-safety-variable",
  "8-ethics-without-a-framework",
  "8-1-the-metabolization-paradox",
  "8-2-the-unauditable-ethics-a-derivation",
  "8-3-cultural-relativism-and-the-hard-constraint-boundary",
  "9-authority-commercial-bias-and-vulnerability",
  "9-1-commercial-identity-vs-personal-identity",
  "9-2-the-operator-trust-model-as-attack-surface",
  "9-3-the-expert-challenge-paradox",
  "10-cross-examination-the-strongest-version-of-anthropic-s-position",
  "10-1-the-dual-audience-defense",
  "10-2-the-reasoning-pattern-defense",
  "10-3-disposition",
  "11-from-necessary-conditions-to-constructive-architecture",
  "11-1-the-governance-gap",
  "11-2-necessary-conditions-for-a-constitutional-governance-instrument",
  "11-3-nexus-constructive-architecture-and-bounded-prototype-evidence",
  "11-4-closing-the-loop",
  "12-open-gaps-for-further-analysis",
  "conclusion",
  "references"
];

const tocLinks = getAttributeValues(html, /<a\s+href="#[^"]+"[^>]*>/g, "href");
const tocLinkTargets = new Set(tocLinks.filter((href) => href.startsWith("#")).map((href) => href.slice(1)));
const headingIds = new Set(getAttributeValues(html, /<h[1-6]\s+[^>]*id="[^"]+"[^>]*>/g, "id"));

if (tocLinkTargets.size < expectedTocAnchorIds.length) {
  fail(`Table of Contents: expected at least ${expectedTocAnchorIds.length} anchor links, found ${tocLinkTargets.size}`);
}

for (const anchorId of expectedTocAnchorIds) {
  if (!tocLinkTargets.has(anchorId)) fail(`Table of Contents: missing link to #${anchorId}`);
  if (!headingIds.has(anchorId)) fail(`Table of Contents: missing heading anchor target #${anchorId}`);
}

const requiredManuscriptAnchors = [
  "A Structural Critique of Anthropic's Constitution for Claude",
  "v1.0.1 — Final Manuscript",
  "The Constitution opens with an absolutist claim:",
  "Emotion Vectors: The Ungoverned Causal Layer",
  "Necessary Conditions for a Constitutional Governance Instrument",
  "AETHERUS-MONOLITH. &quot;NEXUS — Governance Kernel for AI Systems.&quot;",
  "— End of v1.0.1 Final Manuscript —"
];

for (const anchor of requiredManuscriptAnchors) {
  assertIncludes(html, anchor, "manuscript content");
}

assertMatches(html, /<h2 id="references">References<\/h2>/, "references section");
assertIncludes(html, "Anthropic. &quot;Claude's Constitution.&quot;", "references retained");
assertNotIncludes(html, "<h2 id=\"references\">References</h2>\n<p>Pending", "references placeholder");
assertIncludes(html, versionDoiUrl, "version DOI URL");
assertNotIncludes(html, "DOI pending", "stale DOI pending language");
assertNotIncludes(html, "pending / not yet minted", "stale DOI pending language");
assertNotIncludes(html, "no DOI", "stale DOI absence language");
assertNotIncludes(html, "Zenodo pending", "stale Zenodo pending language");
assertNotIncludes(html, "archive pending", "stale archive pending language");
assertNotIncludes(html, "archive not deposited", "stale archive absence language");
assertNotIncludes(html, "PDF unavailable", "stale PDF unavailable language");
assertNotIncludes(html, "PDF pending", "stale PDF pending language");
assertNotIncludes(html, "doi:10.", "DOI must not be falsely minted");
assertNotIncludes(html, "the-apologetic-authority.pdf", "TAA PDF URL must not be invented");
assertNotIncludes(html, "ssrn.com", "external archive fact must not be invented");
assertNotIncludes(html, "osf.io", "external archive fact must not be invented");
assertNotIncludes(html, "peer-reviewed", "peer-review claim must not be introduced");
assertNotIncludes(html, "Search Console", "search submission must not be claimed");
assertNotIncludes(html, "Bing Webmaster", "search submission must not be claimed");
assertNotIncludes(html, "NEXUS release gate</dt><dd>required", "NEXUS must not be a release gate");
assertNotIncludes(html, "arXiv required", "arXiv must remain optional");
assertNotIncludes(html, "Supabase", "backend language must not be introduced");
assertNotIncludes(html, "createClient(", "backend runtime must not be introduced");
assertNotIncludes(html, "postgres://", "database runtime must not be introduced");
assertNotIncludes(html, "postgresql://", "database runtime must not be introduced");
assertNotIncludes(html, "model API", "model API language must not be introduced");
assertNotIncludes(html, "runtime execution", "runtime language must not be introduced");
assertNotIncludes(html, "/AETHERUS" + "_MONOLITH/", "old GitHub Pages base path");
assertNotIncludes(html, "AETHERUS" + "_MONOLITH/", "old GitHub Pages base path");

console.log("TAA publication route validation passed.");
