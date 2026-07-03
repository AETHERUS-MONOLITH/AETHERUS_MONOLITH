#!/usr/bin/env node
import { readdirSync } from "node:fs";
import path from "node:path";
import { loadEndpointRegistry, loadSourceTruth, loadYamlSubset } from "../geo/lib/source-loader.mjs";
import { assertSchema, loadSchemas } from "../geo/lib/schema-validation.mjs";
import { sourceTruthErrors } from "../geo/lib/identity-checks.mjs";

const schemas = await loadSchemas();
const sourceTruth = await loadSourceTruth();
const registry = await loadEndpointRegistry();

assertSchema(sourceTruth.entities, schemas.entities, "geo/source/entities.yaml");
assertSchema(sourceTruth.claims, schemas.claims, "geo/source/claims.yaml");
assertSchema(registry, schemas.registry, "geo/config/endpoints.yaml");

const errors = sourceTruthErrors(sourceTruth);
if (errors.length > 0) throw new Error(errors.join("\n"));

const seedUrls = registry.endpoints.map((endpoint) => endpoint.requested_url);
const expectedSeedUrls = [
  "https://camilocarlone.com/",
  "https://camilocarlone.com/the-apologetic-authority/",
  "https://aetherus-monolith.pages.dev/",
  "https://doi.org/10.5281/zenodo.20788207",
  "https://github.com/AETHERUS-MONOLITH",
  "https://www.lesswrong.com/users/camilocarlone"
];
if (JSON.stringify(seedUrls) !== JSON.stringify(expectedSeedUrls)) {
  throw new Error(`endpoint registry must contain exactly the authorized six seed URLs`);
}

const claims = sourceTruth.claims.claims;
for (const claim of claims) {
  if (claim.status === "confirmed" && (!claim.source_references || claim.source_references.length === 0)) {
    throw new Error(`${claim.key}: confirmed claim lacks source references`);
  }
}

const fixtureDir = "geo/fixtures/source";
const sourceFixtureNames = readdirSync(fixtureDir).filter((name) => name.endsWith(".yaml")).sort();
for (const name of sourceFixtureNames) {
  const fixtureEntities = await loadYamlSubset(path.posix.join(fixtureDir, name));
  const fixtureTruth = { entities: fixtureEntities, claims: sourceTruth.claims };
  const schemaErrors = [];
  try {
    assertSchema(fixtureEntities, schemas.entities, name);
  } catch (error) {
    schemaErrors.push(error.message);
  }
  const invariantErrors = sourceTruthErrors(fixtureTruth);
  if (schemaErrors.length === 0 && invariantErrors.length === 0) {
    throw new Error(`${name}: negative source fixture unexpectedly passed`);
  }
}

const expansion = await loadYamlSubset("geo/fixtures/endpoint-registry/registry-expansion.yaml");
assertSchema(expansion, schemas.registry, "registry expansion fixture");

console.log("GEO source truth validation passed.");
