import { verifyEventDigest } from "./canonicalize.js";
import { validateAgainstSchema } from "./schema-validator.js";

const EVENT_TYPES = new Set(["claim.emitted", "claim.verified", "claim.disputed", "claim.retracted"]);
const CLAIM_TYPES = new Set(["factual", "calculation", "inference", "recommendation", "prediction"]);
const SUPPORT_TYPES = new Set([
  "supports_directly",
  "supports_partially",
  "computed_from",
  "contradicts",
  "context_only",
  "provenance_only"
]);
const VERIFICATION_RESULTS = new Set(["supported", "contradicted", "inconclusive"]);
const VERIFICATION_METHODS = new Set(["human_review", "model_check", "source_attestation", "consensus", "formal_proof"]);
const CLAIM_STATUSES = new Set(["active", "disputed", "retracted"]);
const SELECTOR_TYPES = new Set(["text_span", "page_span", "json_pointer", "table_cell", "uri_fragment", "byte_range"]);

export function validateEvent(event, { verifyDigest = true } = {}) {
  const errors = [];
  const schemaResult = validateAgainstSchema(event);
  if (!schemaResult.valid) errors.push(...schemaResult.errors);
  required(event, "", ["event_id", "event_type", "event_time", "spec_version", "schema_url", "producer", "digest"], errors);
  if (event?.event_type && !EVENT_TYPES.has(event.event_type)) {
    errors.push(error("/event_type", "unknown event type"));
  }
  if (!event?.claim && !event?.claim_ref) {
    errors.push(error("", "event requires claim or claim_ref"));
  }
  if (event?.claim) validateClaim(event.claim, "/claim", errors);
  validateAgent(event?.producer, "/producer", errors);
  for (const [index, source] of (event?.sources ?? []).entries()) validateSource(source, `/sources/${index}`, errors);
  for (const [index, evidence] of (event?.evidence ?? []).entries()) validateEvidence(evidence, `/evidence/${index}`, errors);
  for (const [index, evidence] of (event?.contradicting_evidence ?? []).entries()) {
    validateEvidence(evidence, `/contradicting_evidence/${index}`, errors);
  }
  for (const [index, toolRun] of (event?.tool_runs ?? []).entries()) validateToolRun(toolRun, `/tool_runs/${index}`, errors);
  if (event?.verification) validateVerification(event.verification, "/verification", errors);
  validateEventSpecific(event, errors);
  if (verifyDigest && event?.digest && !verifyEventDigest(event)) {
    errors.push(error("/digest", "event digest mismatch"));
  }
  return { valid: errors.length === 0, errors };
}

export function assertValidEvent(event, options) {
  const result = validateEvent(event, options);
  if (!result.valid) {
    const detail = result.errors.map((item) => `${item.path}: ${item.message}`).join("\n");
    throw new Error(`Invalid OpenClaims event:\n${detail}`);
  }
  return event;
}

function validateEventSpecific(event, errors) {
  if (!event) return;
  if (event.event_type === "claim.emitted" && !event.claim) {
    errors.push(error("/claim", "claim.emitted requires claim"));
  }
  if (event.event_type === "claim.verified") {
    required(event, "", ["claim_ref", "verification"], errors);
  }
  if (event.event_type === "claim.disputed") {
    required(event, "", ["claim_ref"], errors);
    if (!event.dispute_rationale && (!event.contradicting_evidence || event.contradicting_evidence.length === 0)) {
      errors.push(error("", "claim.disputed requires dispute_rationale or contradicting_evidence"));
    }
  }
  if (event.event_type === "claim.retracted") {
    required(event, "", ["claim_ref", "retracted_at"], errors);
  }
}

function validateClaim(claim, path, errors) {
  required(claim, path, ["claim_id", "text", "claim_type", "asserted_at"], errors);
  if (claim?.claim_type && !CLAIM_TYPES.has(claim.claim_type)) errors.push(error(`${path}/claim_type`, "unknown claim type"));
}

function validateAgent(agent, path, errors) {
  required(agent, path, ["agent_id", "agent_type"], errors);
}

function validateSource(source, path, errors) {
  required(source, path, ["source_id"], errors);
}

function validateEvidence(evidence, path, errors) {
  required(evidence, path, ["evidence_id", "source_ref", "support_type", "selector"], errors);
  if (evidence?.support_type && !SUPPORT_TYPES.has(evidence.support_type)) {
    errors.push(error(`${path}/support_type`, "unknown support type"));
  }
  if (evidence?.selector) validateSelector(evidence.selector, `${path}/selector`, errors);
}

function validateSelector(selector, path, errors) {
  required(selector, path, ["type"], errors);
  if (selector?.type && !SELECTOR_TYPES.has(selector.type)) errors.push(error(`${path}/type`, "unknown selector type"));
}

function validateToolRun(toolRun, path, errors) {
  required(toolRun, path, ["tool_run_id", "tool_type", "tool"], errors);
}

function validateVerification(verification, path, errors) {
  required(verification, path, ["verification_result", "verification_method", "claim_status", "validator", "verified_at"], errors);
  if (verification?.verification_result && !VERIFICATION_RESULTS.has(verification.verification_result)) {
    errors.push(error(`${path}/verification_result`, "unknown verification result"));
  }
  if (verification?.verification_method && !VERIFICATION_METHODS.has(verification.verification_method)) {
    errors.push(error(`${path}/verification_method`, "unknown verification method"));
  }
  if (verification?.claim_status && !CLAIM_STATUSES.has(verification.claim_status)) {
    errors.push(error(`${path}/claim_status`, "unknown claim status"));
  }
}

function required(value, path, keys, errors) {
  if (!value || typeof value !== "object") {
    errors.push(error(path || "/", "expected object"));
    return;
  }
  for (const key of keys) {
    if (value[key] === undefined || value[key] === null || value[key] === "") {
      errors.push(error(`${path}/${key}`, "required"));
    }
  }
}

function error(path, message) {
  return { path, message };
}
