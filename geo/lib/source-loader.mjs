import fs from "node:fs/promises";
import path from "node:path";

export const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

export async function readJsonFile(relativePath) {
  return JSON.parse(await fs.readFile(path.join(repoRoot, relativePath), "utf8"));
}

export async function loadYamlSubset(relativePath) {
  const text = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    throw new Error(`${relativePath}: GEO 0.1 uses a documented JSON-compatible YAML subset`);
  }
  return JSON.parse(text);
}

export async function loadSourceTruth() {
  return {
    entities: await loadYamlSubset("geo/source/entities.yaml"),
    claims: await loadYamlSubset("geo/source/claims.yaml")
  };
}

export async function loadEndpointRegistry() {
  return loadYamlSubset("geo/config/endpoints.yaml");
}

export function entityMap(sourceTruth) {
  return new Map(sourceTruth.entities.entities.map((entity) => [entity.id, entity]));
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
