#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const metadataPath = "data/taa-publication-metadata.v1.json";
const routePath = "the-apologetic-authority/index.html";
const sitemapPath = "sitemap.xml";
const robotsPath = "robots.txt";
const pdfPath = "the-apologetic-authority/the-apologetic-authority-v1.0.1.pdf";
const pdfUrl = "https://camilocarlone.com/the-apologetic-authority/the-apologetic-authority-v1.0.1.pdf";

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
await fs.access(path.join(repoRoot, pdfPath));

const metadata = await readJson(metadataPath);
const publication = metadata.publication;
const html = await readText(routePath);
const sitemap = await readText(sitemapPath);
const robots = await readText(robotsPath);
const pdf = await fs.readFile(path.join(repoRoot, pdfPath));
assert(pdf.length > 0, "PDF artifact: must be non-empty");
assert(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")), "PDF artifact: must have PDF header");

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
assert(metaContent(html, "publication-status").includes("PDF available"), "publication status metadata: must include PDF availability");
assert(metaContent(html, "citation_pdf_url") === pdfUrl, "citation PDF URL: must match canonical PDF URL");
assert(metaContent(html, "keywords") === keywords.join(", "), "keywords metadata: must match metadata package");
assertIncludes(html, `<link rel="canonical" href="${url}">`, "canonical link");
assertIncludes(html, `<link rel="alternate" type="application/pdf" href="${pdfUrl}">`, "PDF alternate link");

assert(propertyContent(html, "og:title") === title, "Open Graph title: must match metadata package");
assert(propertyContent(html, "og:description") === description, "Open Graph description: must match metadata package");
assert(propertyContent(html, "og:url") === url, "Open Graph URL: must match metadata package");
assert(propertyContent(html, "og:type") === "article", "Open Graph type");
assert(propertyContent(html, "article:author") === author, "Open Graph article author");

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
assert(article.version === status, "JSON-LD version: must match metadata package");
assert(Array.isArray(article.keywords), "JSON-LD keywords: must be an array");
for (const keyword of keywords) {
  assert(article.keywords.includes(keyword), `JSON-LD keywords: missing ${keyword}`);
}
assert(article.isAccessibleForFree === true, "JSON-LD isAccessibleForFree: must be true");
assert(!("datePublished" in article), "JSON-LD: datePublished must not be used without publication date");
assert(article.dateCreated === "2026-06-18", "JSON-LD dateCreated: must use grounded manuscript date");
assert(article.dateModified === "2026-06-18", "JSON-LD dateModified: must use grounded manuscript date");

assertIncludes(html, abstract, "visible abstract");
assertIncludes(htmlToText(html), citation, "visible citation");
assertIncludes(html, "DOI: pending; no DOI has been minted for this route.", "visible DOI pending state");
assertIncludes(html, "Download PDF (v1.0.1, 44 pages, A4)", "visible PDF download link");
assertIncludes(html, `PDF: available at <a href="/the-apologetic-authority/the-apologetic-authority-v1.0.1.pdf">${pdfUrl}</a>.`, "visible PDF availability state");
for (const boundary of publication.does_not_claim) {
  const visibleBoundary = boundary.replace(/^no /i, "No ");
  assertIncludes(html, visibleBoundary, `visible boundary block: ${boundary}`);
}

assertIncludes(sitemap, `<loc>${url}</loc>`, "sitemap canonical route");
assertIncludes(sitemap, "<lastmod>2026-06-18</lastmod>", "sitemap grounded lastmod");
assertIncludes(robots, "User-agent: *", "robots user-agent");
assertIncludes(robots, "Allow: /", "robots allow all");
assertIncludes(robots, "Sitemap: https://camilocarlone.com/sitemap.xml", "robots sitemap reference");
assert(!/Disallow:\s*\/the-apologetic-authority\/?/i.test(robots), "robots: canonical route must not be blocked");

const scanned = [html, JSON.stringify(metadata), sitemap, robots].join("\n");
const forbiddenClaims = [
  /doi\.org/i,
  /DOI:\s*10\./,
  /the-apologetic-authority\.pdf/i,
  /zenodo\.org/i,
  /Zenodo deposit[^.\n]*(completed|created|published|released)/i,
  /arxiv submitted/i,
  /ssrn/i,
  /osf\.io/i,
  /journal publication[^.\n]*(accepted|completed|published)/i,
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

console.log("TAA GEO technical layer validation passed.");
