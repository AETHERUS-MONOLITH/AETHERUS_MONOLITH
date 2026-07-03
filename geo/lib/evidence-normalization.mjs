import { fetchPolicy, sha256, validatorVersion, extractionVersion } from "./endpoint-fetch.mjs";
import { canonicalJson } from "./source-loader.mjs";

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, "\"")
    .replace(/&ldquo;/g, "\"");
}

function attr(tag, name) {
  return (
    tag.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1] ??
    tag.match(new RegExp(`${name}='([^']*)'`, "i"))?.[1] ??
    null
  );
}

function metaContent(html, selectorName, value) {
  const pattern = new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
  const tag = html.match(pattern)?.[0] ?? "";
  return decodeHtml(attr(tag, "content"));
}

function canonicalUrls(html) {
  return [...html.matchAll(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi)]
    .map((match) => attr(match[0], "href"))
    .filter(Boolean);
}

function links(html, seedUrls) {
  const found = new Set();
  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["']/gi)) {
    const href = decodeHtml(match[1]);
    for (const seed of seedUrls) {
      if (href === seed || href.replace(/\/$/, "") === seed.replace(/\/$/, "")) found.add(seed);
    }
  }
  return [...found].sort();
}

function jsonLdSummaries(html) {
  const summaries = [];
  for (const match of html.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      summaries.push({
        parse_status: "parsed",
        top_level: Array.isArray(parsed) ? "array" : "object",
        types: nodes.flatMap((node) => Array.isArray(node?.["@type"]) ? node["@type"] : node?.["@type"] ? [node["@type"]] : []),
        ids: nodes.flatMap((node) => node?.["@id"] ? [node["@id"]] : []),
        names: nodes.flatMap((node) => node?.name ? [node.name] : node?.headline ? [node.headline] : []),
        same_as: nodes.flatMap((node) => Array.isArray(node?.sameAs) ? node.sameAs : []),
        url_values: nodes.flatMap((node) => [node?.url, node?.mainEntityOfPage, node?.identifier].filter(Boolean))
      });
    } catch (error) {
      summaries.push({ parse_status: "parse_error", error: error.message });
    }
  }
  return summaries;
}

function textMetrics(html) {
  const text = decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const headings = [...html.matchAll(/<h[1-6]\b/gi)].length;
  const links = [...html.matchAll(/<a\s/gi)].length;
  const words = text ? text.split(/\s+/).length : 0;
  const longestToken = text.split(/\s+/).reduce((max, token) => Math.max(max, token.length), 0);
  return {
    text_char_count: text.length,
    word_count: words,
    heading_count: headings,
    link_count: links,
    longest_token_chars: longestToken,
    excerpt: text.slice(0, fetchPolicy.excerpt_size_limit_chars)
  };
}

function publicationMetadata(html) {
  const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  return {
    title,
    description: metaContent(html, "name", "description"),
    author: metaContent(html, "name", "author") || metaContent(html, "name", "citation_author"),
    citation_doi: metaContent(html, "name", "citation_doi"),
    citation_publication_date: metaContent(html, "name", "citation_publication_date"),
    publication_status: metaContent(html, "name", "publication-status"),
    og_type: metaContent(html, "property", "og:type")
  };
}

export function normalizeObservation(observation, endpoint, seedUrls) {
  const html = observation.body_text || "";
  const normalizedText = html.replace(/\s+/g, " ").trim();
  return {
    endpoint_key: observation.endpoint_key,
    requested_url: observation.requested_url,
    final_url: observation.final_url,
    redirect_chain: observation.redirect_chain,
    observed_at: observation.observed_at,
    status: observation.status,
    content_type: observation.content_type,
    byte_count: observation.byte_count,
    raw_sha256: observation.raw_sha256,
    normalized_sha256: normalizedText ? sha256(normalizedText) : null,
    validator_version: validatorVersion,
    extraction_version: extractionVersion,
    entities: endpoint.entities,
    endpoint_role: endpoint.role,
    expected_content_class: endpoint.expected_content_class,
    checks: endpoint.checks,
    failure: observation.failure,
    canonical_urls: canonicalUrls(html),
    publication_metadata: publicationMetadata(html),
    discovered_seed_links: links(html, seedUrls),
    jsonld: jsonLdSummaries(html),
    text_metrics: textMetrics(html),
    evidence_excerpt: normalizedText.slice(0, fetchPolicy.excerpt_size_limit_chars)
  };
}

export function normalizedEvidence(registry, observations) {
  const byKey = new Map(registry.endpoints.map((endpoint) => [endpoint.key, endpoint]));
  const seedUrls = registry.endpoints.map((endpoint) => endpoint.requested_url);
  return {
    schema_version: "geo.normalized_evidence.v1",
    validator_version: validatorVersion,
    extraction_version: extractionVersion,
    policy: fetchPolicy,
    observations: observations.map((observation) => normalizeObservation(observation, byKey.get(observation.endpoint_key), seedUrls))
  };
}

export function deterministicEvidence(value) {
  return {
    ...value,
    observations: value.observations.map(({ observed_at, ...observation }) => observation)
  };
}

export function evidenceHash(value) {
  return sha256(canonicalJson(deterministicEvidence(value)));
}
