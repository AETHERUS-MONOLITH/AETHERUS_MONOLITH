import crypto from "node:crypto";

export const validatorVersion = "geo-0.1.0";
export const extractionVersion = "geo.extraction.v1";
export const fetchPolicy = {
  user_agent: "AETHERUS-GEO-0.1-Structural-Baseline/1.0 (+https://github.com/AETHERUS-MONOLITH/AETHERUS_MONOLITH)",
  timeout_ms: 10000,
  redirect_limit: 5,
  response_size_limit_bytes: 750000,
  excerpt_size_limit_chars: 420,
  raw_run_path: ".geo-runs/geo-0.1/",
  raw_material_retained: false,
  request_retries: 0
};

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function fetchEndpoint(endpoint, observedAt = new Date().toISOString()) {
  const redirectChain = [];
  let url = endpoint.requested_url;
  let response = null;
  let body = Buffer.alloc(0);
  let failure = null;

  try {
    for (let redirectCount = 0; redirectCount <= fetchPolicy.redirect_limit; redirectCount += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), fetchPolicy.timeout_ms);
      try {
        response = await fetch(url, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "user-agent": fetchPolicy.user_agent,
            "accept": "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.5"
          }
        });
      } finally {
        clearTimeout(timer);
      }

      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        if (!endpoint.redirects_permitted) {
          failure = "redirect_not_permitted";
          break;
        }
        if (redirectCount === fetchPolicy.redirect_limit) {
          failure = "redirect_limit_exceeded";
          break;
        }
        const nextUrl = new URL(response.headers.get("location"), url).href;
        redirectChain.push({ from: url, to: nextUrl, status: response.status });
        url = nextUrl;
        continue;
      }
      body = Buffer.from(await response.arrayBuffer());
      if (body.length > fetchPolicy.response_size_limit_bytes) failure = "response_size_limit_exceeded";
      break;
    }
  } catch (error) {
    failure = error.name === "AbortError" ? "timeout" : "transport_failure";
  }

  const text = body.toString("utf8");
  return {
    endpoint_key: endpoint.key,
    requested_url: endpoint.requested_url,
    final_url: response ? url : null,
    redirect_chain: redirectChain,
    observed_at: observedAt,
    status: response?.status ?? null,
    content_type: response?.headers.get("content-type") ?? null,
    byte_count: body.length,
    raw_sha256: body.length > 0 ? sha256(body) : null,
    body_text: text,
    failure,
    validator_version: validatorVersion,
    extraction_version: extractionVersion
  };
}

export async function fetchRegistry(registry) {
  const observations = [];
  for (const endpoint of registry.endpoints) {
    observations.push(await fetchEndpoint(endpoint));
  }
  return observations;
}
