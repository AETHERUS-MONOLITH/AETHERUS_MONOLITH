import { readJsonFile } from "./source-loader.mjs";

function typeMatches(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => {
    if (type === "array") return Array.isArray(value);
    if (type === "null") return value === null;
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    if (type === "object") return value && typeof value === "object" && !Array.isArray(value);
    return typeof value === type;
  });
}

function validateNode(value, schema, label, errors) {
  if (!schema || Object.keys(schema).length === 0) return;
  if ("const" in schema && value !== schema.const) errors.push(`${label}: expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${label}: invalid value ${JSON.stringify(value)}`);
  if (schema.type && !typeMatches(value, schema.type)) {
    errors.push(`${label}: expected type ${JSON.stringify(schema.type)}`);
    return;
  }
  if (schema.pattern && typeof value === "string" && !new RegExp(schema.pattern).test(value)) {
    errors.push(`${label}: does not match ${schema.pattern}`);
  }
  if (schema.required && value && typeof value === "object") {
    for (const key of schema.required) {
      if (!(key in value)) errors.push(`${label}: missing required ${key}`);
    }
  }
  if (schema.properties && value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, childSchema] of Object.entries(schema.properties)) {
      if (key in value) validateNode(value[key], childSchema, `${label}.${key}`, errors);
    }
  }
  if (schema.items && Array.isArray(value)) {
    value.forEach((item, index) => validateNode(item, schema.items, `${label}[${index}]`, errors));
  }
}

export function validateWithSchema(value, schema, label) {
  const errors = [];
  validateNode(value, schema, label, errors);
  return errors;
}

export function assertSchema(value, schema, label) {
  const errors = validateWithSchema(value, schema, label);
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

export async function loadSchemas() {
  return {
    entities: await readJsonFile("geo/schema/entities.schema.json"),
    claims: await readJsonFile("geo/schema/claims.schema.json"),
    registry: await readJsonFile("geo/schema/endpoint-registry.schema.json"),
    normalizedEvidence: await readJsonFile("geo/schema/normalized-evidence.schema.json"),
    finding: await readJsonFile("geo/schema/finding.schema.json"),
    baselineReport: await readJsonFile("geo/schema/baseline-report.schema.json")
  };
}

export function validateEveryFinding(findings, findingSchema) {
  const errors = [];
  for (const finding of findings) {
    errors.push(...validateWithSchema(finding, findingSchema, `finding.${finding.id || "unknown"}`));
    if (!finding.evidence || Object.keys(finding.evidence).length === 0) {
      errors.push(`${finding.id}: evidence metadata is required`);
    }
    if (!finding.reproducibility?.analysis_version) {
      errors.push(`${finding.id}: reproducibility metadata is required`);
    }
    if (!finding.validator_version) errors.push(`${finding.id}: validator_version is required`);
  }
  return errors;
}
