#!/usr/bin/env node
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const metadataPath = "data/taa-publication-metadata.v1.json";
const routePath = "the-apologetic-authority/index.html";
const sitemapPath = "sitemap.xml";
const robotsPath = "robots.txt";
const pdfPath = "the-apologetic-authority/the-apologetic-authority-v1.0.2.pdf";
const pdfUrl = "https://camilocarlone.com/the-apologetic-authority/the-apologetic-authority-v1.0.2.pdf";
const pdfSha256 = "0f9aa06ecc8168c6ae1ab43ad0b859f2cd54531c855a54133d52527e9b6475d4";
const versionDoi = "10.5281/zenodo.23019747";
const versionDoiUrl = "https://doi.org/10.5281/zenodo.23019747";
const allVersionsDoiUrl = "https://doi.org/10.5281/zenodo.20788206";
const claimsPath = "geo/source/claims.yaml";
const entitiesPath = "geo/source/entities.yaml";
const endpointsPath = "geo/config/endpoints.yaml";
const conceptDoi = "10.5281/zenodo.20788206";

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) fail(`${label}: missing ${JSON.stringify(needle)}`);
}

function assertNotMatches(text, pattern, label) {
  if (pattern.test(text)) fail(`${label}: forbidden pattern ${pattern}`);
}

async function readText(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function metaContent(html, name) {
  const match = html.match(new RegExp(`<meta\\s+name="${escapeRegExp(name)}"\\s+content="([^"]*)"`, "i"));
  return match?.[1] ?? "";
}

function propertyContent(html, property) {
  const match = html.match(new RegExp(`<meta\\s+property="${escapeRegExp(property)}"\\s+content="([^"]*)"`, "i"));
  return match?.[1] ?? "";
}

function htmlToText(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getJsonLdBlocks(html) {
  return [...html.matchAll(/<script\s+type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map((match) =>
    JSON.parse(match[1])
  );
}

await fs.access(path.join(repoRoot, metadataPath));
await fs.access(path.join(repoRoot, routePath));
await fs.access(path.join(repoRoot, sitemapPath));
await fs.access(path.join(repoRoot, robotsPath));
await fs.access(path.join(repoRoot, claimsPath));
await fs.access(path.join(repoRoot, entitiesPath));
await fs.access(path.join(repoRoot, endpointsPath));

const metadata = await readJson(metadataPath);
const publication = metadata.publication;
const html = await readText(routePath);
const sitemap = await readText(sitemapPath);
const robots = await readText(robotsPath);
const claims = await readJson(claimsPath);
const entities = await readJson(entitiesPath);
const endpoints = await readJson(endpointsPath);
const pdf = await fs.readFile(path.join(repoRoot, pdfPath));
assert(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")), "PDF artifact: must have PDF header");
assert(pdf.length === 403811, "PDF artifact: wrong byte count");
assert(createHash("sha256").update(pdf).digest("hex") === pdfSha256, "PDF artifact: wrong SHA-256");

assert(publication && typeof publication === "object", "metadata package: missing publication object");

const title = publication.canonical_title;
const url = publication.canonical_url;
const author = publication.author.name;
const description = publication.short_description;
const abstract = publication.abstract;
const status = publication.status;
const citation = publication.citation.text;
const keywords = publication.keywords;

assertIncludes(html, `<title>${title} - ${author}</title>`, "HTML title");
assert(metaContent(html, "description") === description, "meta description: must match metadata package");
assert(metaContent(html, "author") === author, "author metadata: must match metadata package");
assert(metaContent(html, "publication-status").includes(status), "publication status metadata: must include metadata status");
assert(metaContent(html, "publication-status").includes(`version DOI ${versionDoi}`), "publication status metadata: must include version DOI");
assert(metaContent(html, "publication-status").includes("release date 2026-09-29"), "publication status metadata: must include release date");
assert(metaContent(html, "publication-status").includes("PDF repository integrated"), "publication status metadata: must include PDF integration state");
assert(metaContent(html, "citation_publication_date") === "2026-09-29", "citation publication date: must match v1.0.2 release date");
assert(metaContent(html, "citation_doi") === versionDoi, "citation DOI: must match version DOI");
assert(metaContent(html, "citation_pdf_url") === pdfUrl, "citation PDF URL: must match canonical PDF URL");
assert(metaContent(html, "DC.identifier") === versionDoiUrl, "Dublin Core identifier: must match version DOI URL");
assert(metaContent(html, "DC.rights") === "All rights reserved", "Dublin Core rights: must match license");
assert(metaContent(html, "keywords") === keywords.join(", "), "keywords metadata: must match metadata package");
assertIncludes(html, `<link rel="canonical" href="${url}">`, "canonical link");
assertIncludes(html, `<link rel="alternate" type="application/pdf" href="${pdfUrl}">`, "PDF alternate link");

assert(propertyContent(html, "og:title") === title, "Open Graph title: must match metadata package");
assert(propertyContent(html, "og:description") === description, "Open Graph description: must match metadata package");
assert(propertyContent(html, "og:url") === url, "Open Graph URL: must match metadata package");
assert(propertyContent(html, "og:type") === "article", "Open Graph type");
assert(propertyContent(html, "article:author") === author, "Open Graph article author");
assert(propertyContent(html, "article:published_time") === "2026-06-21", "Open Graph published time: must match Zenodo publication date");
assert(propertyContent(html, "article:modified_time") === "2026-09-29", "Open Graph modified time: must match v1.0.2 release date");

assert(metaContent(html, "twitter:card") === "summary", "Twitter card");
assert(metaContent(html, "twitter:title") === title, "Twitter title: must match metadata package");
assert(metaContent(html, "twitter:description") === description, "Twitter description: must match metadata package");

const jsonLdBlocks = getJsonLdBlocks(html);
assert(jsonLdBlocks.length > 0, "JSON-LD: missing application/ld+json block");
const article = jsonLdBlocks.find((block) => ["ScholarlyArticle", "Article", "CreativeWork"].includes(block["@type"]));
assert(article, "JSON-LD: missing ScholarlyArticle, Article, or CreativeWork");
assert(article["@type"] === "ScholarlyArticle", "JSON-LD: expected ScholarlyArticle for scholarly manuscript metadata");
assert(article.headline === title, "JSON-LD headline: must match metadata package");
assert(article.name === title, "JSON-LD name: must match metadata package");
assert(article.description === description, "JSON-LD description: must match metadata package");
assert(article.abstract === abstract, "JSON-LD abstract: must match metadata package");
assert(article.author?.["@type"] === "Person", "JSON-LD author: must be Person");
assert(article.author?.name === author, "JSON-LD author name: must match metadata package");
assert(article.url === url, "JSON-LD URL: must match metadata package");
assert(article.mainEntityOfPage === url, "JSON-LD mainEntityOfPage: must match metadata package");
assert(article.identifier === versionDoiUrl, "JSON-LD identifier: must match version DOI URL");
assert(Array.isArray(article.sameAs), "JSON-LD sameAs: must be an array");
assert(article.sameAs.includes(versionDoiUrl), "JSON-LD sameAs: must include version DOI URL");
assert(article.sameAs.includes(allVersionsDoiUrl), "JSON-LD sameAs: must include all-versions DOI URL");
assert(article.version === "1.0.2", "JSON-LD version: must be 1.0.2");
assert(article.genre === "Archived report", "JSON-LD genre: must describe archived report resource type");
assert(Array.isArray(article.keywords), "JSON-LD keywords: must be an array");
for (const keyword of keywords) {
  assert(article.keywords.includes(keyword), `JSON-LD keywords: missing ${keyword}`);
}
assert(article.isAccessibleForFree === true, "JSON-LD isAccessibleForFree: must be true");
assert(article.dateCreated === "2026-06-18", "JSON-LD dateCreated: must use grounded manuscript date");
assert(article.datePublished === "2026-06-21", "JSON-LD datePublished: must use Zenodo publication date");
assert(article.dateModified === "2026-09-29", "JSON-LD dateModified: must use v1.0.2 release date");

assertIncludes(html, abstract, "visible abstract");
assertIncludes(htmlToText(html), citation, "visible citation");
assertIncludes(html, `<dt>Version DOI</dt><dd><a href="${versionDoiUrl}">${versionDoi}</a></dd>`, "visible version DOI");
assertIncludes(html, "<dt>Release date</dt><dd>September 29, 2026</dd>", "visible release date");
assertIncludes(html, `<a href="${versionDoiUrl}">${versionDoiUrl}</a>`, "visible version DOI link");
assertIncludes(html, "Download PDF (v1.0.2, 48 pages, A4)", "visible PDF download link");
assertIncludes(html, `href="/the-apologetic-authority/the-apologetic-authority-v1.0.2.pdf"`, "visible current PDF href");
for (const boundary of publication.does_not_claim) {
  const visibleBoundary = boundary.replace(/^no /i, "No ");
  assertIncludes(html, visibleBoundary, `visible boundary block: ${boundary}`);
}

assertIncludes(sitemap, `<loc>${url}</loc>`, "sitemap canonical route");
assertIncludes(sitemap, "<lastmod>2026-09-29</lastmod>", "sitemap grounded lastmod");
assertIncludes(robots, "User-agent: *", "robots user-agent");
assertIncludes(robots, "Allow: /", "robots allow all");
assertIncludes(robots, "Sitemap: https://camilocarlone.com/sitemap.xml", "robots sitemap reference");
assert(!/Disallow:\s*\/the-apologetic-authority\/?/i.test(robots), "robots: canonical route must not be blocked");

const taaVersionClaim = claims.claims.find((claim) => claim.key === "claim:taa_version_doi");
assert(taaVersionClaim?.value === versionDoi, "GEO claims: taa_version_doi must match v1.0.2 DOI");
const taaEntity = entities.entities.find((entity) => entity.id === "entity:the_apologetic_authority");
assert(taaEntity?.identifiers?.doi === conceptDoi, "GEO entities: TAA Work-ID must use Concept DOI");
assert(taaEntity?.controlled_surfaces?.includes(allVersionsDoiUrl), "GEO entities: Concept DOI surface missing");
const taaEndpoint = endpoints.endpoints.find((endpoint) => endpoint.key === "taa_zenodo_doi");
assert(taaEndpoint?.requested_url === allVersionsDoiUrl, "GEO endpoints: Zenodo endpoint must use Concept DOI");

const scanned = [html, JSON.stringify(metadata), sitemap, robots].join("\n");
const forbiddenClaims = [
  /the-apologetic-authority\.pdf/i,
  /arxiv submitted/i,
  /ssrn/i,
  /osf\.io/i,
  /journal publication[^.\n]*(accepted|completed|published)/i,
  /peer[- ]review(ed)?[^.\n]*(accepted|completed|published|validated)/i,
  /institutional validation[^.\n]*(completed|validated|endorsed)/i,
  /Anthropic assessment[^.\n]*(completed|validated|endorsed)/i,
  /published in/i,
  /Search Console submitted/i,
  /Bing submitted/i,
  /LinkedIn published/i,
  /LessWrong published/i,
  /outreach executed/i,
  /NEXUS release gate:\s*yes/i,
  /Supabase/i,
  /createClient\(/,
  /postgres:\/\//,
  /postgresql:\/\//,
  /service_role/,
  /JWT_SECRET/,
  /model API/i,
  /runtime execution/i
];

for (const pattern of forbiddenClaims) {
  assertNotMatches(scanned, pattern, "boundary preservation");
}

const staleDoiArchiveClaims = [
  /DOI pending/i,
  /pending \/ not yet minted/i,
  /no DOI/i,
  /Zenodo pending/i,
  /archive pending/i,
  /archive not deposited/i,
  /PDF unavailable/i,
  /PDF pending/i
];

for (const pattern of staleDoiArchiveClaims) {
  assertNotMatches(html, pattern, "stale DOI/archive boundary");
}

console.log("TAA GEO technical layer validation passed.");
