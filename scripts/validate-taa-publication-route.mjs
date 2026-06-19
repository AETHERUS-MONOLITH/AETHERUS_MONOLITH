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

const html = await readText(routePath);

assertIncludes(html, "<title>The Apologetic Authority - Camilo Carlone</title>", "title metadata");
assertIncludes(html, 'name="author" content="Camilo Carlone"', "author metadata");
assertIncludes(html, 'href="https://camilocarlone.com/the-apologetic-authority"', "canonical URL");
assertIncludes(html, 'property="og:title" content="The Apologetic Authority"', "Open Graph title");
assertIncludes(html, 'property="og:url" content="https://camilocarlone.com/the-apologetic-authority"', "Open Graph URL");

assertIncludes(html, "Final Manuscript / Release-Grade Publication Surface", "status line");
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
  "Carlone, Camilo. <cite>The Apologetic Authority</cite>. Final manuscript. Canonical publication route:",
  "citation boundary"
);
assertIncludes(html, "DOI pending.", "citation DOI boundary");

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
assertNotIncludes(html, "doi.org", "DOI must not be falsely minted");
assertNotIncludes(html, "DOI: minted", "DOI must not be falsely minted");
assertNotIncludes(html, "doi:10.", "DOI must not be falsely minted");
assertNotIncludes(html, "DOI 10.", "DOI must not be falsely minted");
assertNotIncludes(html, "the-apologetic-authority.pdf", "TAA PDF URL must not be invented");
assertNotIncludes(html, "zenodo.org", "external archive fact must not be invented");
assertNotIncludes(html, "ssrn.com", "external archive fact must not be invented");
assertNotIncludes(html, "osf.io", "external archive fact must not be invented");
assertNotIncludes(html, "/AETHERUS" + "_MONOLITH/", "old GitHub Pages base path");
assertNotIncludes(html, "AETHERUS" + "_MONOLITH/", "old GitHub Pages base path");

console.log("TAA publication route validation passed.");
