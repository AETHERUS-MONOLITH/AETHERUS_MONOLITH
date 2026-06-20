#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const routePath = "the-apologetic-authority/index.html";

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

assertIncludes(html, "<title>The Apologetic Authority - Camilo Carlone</title>", "title metadata");
assertIncludes(html, 'name="author" content="Camilo Carlone"', "author metadata");
assertIncludes(html, 'href="https://camilocarlone.com/the-apologetic-authority"', "canonical URL");
assertIncludes(html, 'property="og:title" content="The Apologetic Authority"', "Open Graph title");
assertIncludes(html, 'property="og:url" content="https://camilocarlone.com/the-apologetic-authority"', "Open Graph URL");

assertIncludes(html, "A Structural Critique of Anthropic's Constitution for Claude", "subtitle");
assertIncludes(html, "v1.0.1 Final Manuscript", "version status");
assertIncludes(html, "May 2026", "manuscript date");
assertIncludes(html, "Final manuscript", "publication status");
assertIncludes(html, "yes, after this page exists", "canonical route status");
assertIncludes(html, "placeholder / not yet minted", "DOI placeholder");
assertIncludes(html, "placeholder / not yet attached", "PDF placeholder");
assertIncludes(html, "pending verification of this route", "public release boundary");
assertIncludes(html, "NEXUS release gate", "NEXUS release-gate boundary label");
assertIncludes(html, "<dd>none</dd>", "NEXUS release-gate boundary value");
assertIncludes(html, "arXiv", "arXiv boundary label");
assertIncludes(html, "<dd>optional</dd>", "arXiv optional value");

assertIncludes(
  html,
  "Carlone, Camilo. <cite>The Apologetic Authority: A Structural Critique of Anthropic's Constitution for Claude</cite>. AETHERUS, v1.0.1, June 2026. Canonical publication route:",
  "citation boundary"
);
assertIncludes(html, "DOI pending.", "citation DOI boundary");

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
assertNotIncludes(html, "doi.org", "DOI must not be falsely minted");
assertNotIncludes(html, "DOI: minted", "DOI must not be falsely minted");
assertNotIncludes(html, "doi:10.", "DOI must not be falsely minted");
assertNotIncludes(html, "DOI 10.", "DOI must not be falsely minted");
assertNotIncludes(html, "the-apologetic-authority.pdf", "TAA PDF URL must not be invented");
assertNotIncludes(html, "zenodo.org", "external archive fact must not be invented");
assertNotIncludes(html, "ssrn.com", "external archive fact must not be invented");
assertNotIncludes(html, "osf.io", "external archive fact must not be invented");
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
