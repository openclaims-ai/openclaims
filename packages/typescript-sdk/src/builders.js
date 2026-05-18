import { DEFAULT_SCHEMA_URL, SPEC_VERSION, digestValue, normalizeClaimText, withEventDigest } from "./canonicalize.js";
import { claimId, eventId } from "./ids.js";

export function agent({ id, type = "service", name, uri, facets } = {}) {
  return prune({ agent_id: id, agent_type: type, name, uri, facets });
}

export function digest(value) {
  return digestValue(value);
}

export function selector(type, fields) {
  return { type, ...fields };
}

export function createClaim({
  text,
  claim_type = "factual",
  subject,
  context,
  asserted_at,
  valid_at,
  derived_from_claims = [],
  relations = [],
  facets
}) {
  const normalizedText = normalizeClaimText(text);
  return prune({
    claim_id: claimId(normalizedText, context ?? {}),
    text: normalizedText,
    claim_type,
    subject,
    context,
    asserted_at,
    valid_at,
    derived_from_claims,
    relations,
    facets
  });
}

export function createBaseEvent({ event_type, event_time, producer, claim, claim_ref, extra = {} }) {
  const draft = prune({
    event_type,
    event_time: event_time ?? new Date().toISOString(),
    spec_version: SPEC_VERSION,
    schema_url: DEFAULT_SCHEMA_URL,
    producer,
    claim,
    claim_ref,
    ...extra
  });
  draft.event_id = eventId(draft);
  return withEventDigest(draft);
}

export function createClaimEmittedEvent({
  claim,
  producer,
  sources = [],
  evidence = [],
  tool_runs = [],
  inferences = [],
  agents = [],
  auditable_trace,
  event_time
}) {
  return createBaseEvent({
    event_type: "claim.emitted",
    event_time,
    producer,
    claim,
    extra: { sources, evidence, tool_runs, inferences, agents, auditable_trace }
  });
}

export function createVerificationEvent({ claim_ref, producer, verification, event_time, evidence = [], agents = [] }) {
  return createBaseEvent({
    event_type: "claim.verified",
    event_time,
    producer,
    claim_ref,
    extra: { verification, evidence, agents }
  });
}

export function createDisputeEvent({
  claim_ref,
  producer,
  verification,
  contradicting_evidence = [],
  dispute_rationale,
  event_time
}) {
  return createBaseEvent({
    event_type: "claim.disputed",
    event_time,
    producer,
    claim_ref,
    extra: { verification, contradicting_evidence, dispute_rationale }
  });
}

export function createRetractionEvent({
  claim_ref,
  producer,
  retracted_at,
  retraction_reason,
  original_event_ref,
  event_time
}) {
  return createBaseEvent({
    event_type: "claim.retracted",
    event_time,
    producer,
    claim_ref,
    extra: { retracted_at, retraction_reason, original_event_ref }
  });
}

export function wrapCloudEvent(event) {
  return {
    specversion: "1.0",
    id: event.event_id,
    source: event.producer?.uri ?? event.producer?.agent_id ?? "urn:openclaims:unknown-producer",
    type: event.event_type,
    time: event.event_time,
    datacontenttype: "application/json",
    data: event
  };
}

export function embeddedResponse(payload, events) {
  return { payload, openclaims: { spec_version: SPEC_VERSION, events } };
}

function prune(value) {
  if (Array.isArray(value)) return value.map(prune);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, prune(item)])
  );
}
