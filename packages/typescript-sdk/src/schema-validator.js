import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const schemaRoot = join(repoRoot, "schemas", "openclaims", "0.1");

let compiled;

export function validateAgainstSchema(event) {
  const validate = compiled ?? compile();
  const valid = validate(event);
  if (valid) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: (validate.errors ?? []).map((item) => ({
      path: item.instancePath || item.schemaPath,
      message: item.message ?? "schema validation failed"
    }))
  };
}

function compile() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    allowUnionTypes: true
  });
  addFormats(ajv);

  for (const name of [
    "Core.schema.json",
    "BaseEvent.schema.json",
    "ClaimEmittedEvent.schema.json",
    "ClaimVerifiedEvent.schema.json",
    "ClaimDisputedEvent.schema.json",
    "ClaimRetractedEvent.schema.json",
    "ClaimEvent.schema.json"
  ]) {
    const schema = JSON.parse(readFileSync(join(schemaRoot, name), "utf8"));
    ajv.addSchema(schema);
  }

  compiled = ajv.getSchema("https://openclaims.org/schemas/openclaims/0.1/ClaimEvent.schema.json");
  if (!compiled) {
    throw new Error("OpenClaims ClaimEvent schema did not compile");
  }
  return compiled;
}
