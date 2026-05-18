import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  agent,
  createClaim,
  createClaimEmittedEvent,
  createDisputeEvent,
  createRetractionEvent,
  createVerificationEvent,
  evidenceId,
  selector,
  sourceId,
  validateEvent,
  verifyEventDigest,
  wrapCloudEvent
} from "../packages/typescript-sdk/src/index.js";
import { eventToJsonLd } from "../packages/jsonld-exporter/src/index.js";

const producer = agent({ id: "urn:service:test", name: "test", type: "service" });
const claim = createClaim({
  text: "The travel policy requires manager approval for overnight trips.",
  asserted_at: "2026-05-17T19:30:00Z"
});
const srcId = sourceId("https://example.org/policy.pdf", "sha256:abc");
const evId = evidenceId(srcId, selector("page_span", { page: 7, start: 1220, end: 1310 }), "sha256:def");
const emitted = createClaimEmittedEvent({
  producer,
  claim,
  event_time: "2026-05-17T19:30:01Z",
  sources: [{ source_id: srcId, uri: "https://example.org/policy.pdf", observed_at: "2026-05-17T19:29:41Z" }],
  evidence: [{
    evidence_id: evId,
    source_ref: srcId,
    claim_ref: claim.claim_id,
    selector: selector("page_span", { page: 7, start: 1220, end: 1310 }),
    support_type: "supports_directly"
  }]
});

assert.equal(validateEvent(emitted).valid, true);
assert.equal(verifyEventDigest(emitted), true);
assert.equal(wrapCloudEvent(emitted).data.event_id, emitted.event_id);
assert.equal(eventToJsonLd(emitted)["@graph"].some((node) => node["@type"]?.includes?.("oc:Claim")), true);

const verified = createVerificationEvent({
  claim_ref: claim.claim_id,
  producer,
  event_time: "2026-05-17T19:31:00Z",
  verification: {
    verification_id: "ver_test",
    verification_result: "supported",
    verification_method: "human_review",
    claim_status: "active",
    validator: producer,
    verified_at: "2026-05-17T19:31:00Z"
  }
});
assert.equal(validateEvent(verified).valid, true);

const disputed = createDisputeEvent({
  claim_ref: claim.claim_id,
  producer,
  event_time: "2026-05-18T00:00:00Z",
  dispute_rationale: "A later policy revision conflicts with this claim.",
  verification: {
    verification_id: "ver_dispute",
    verification_result: "contradicted",
    verification_method: "source_attestation",
    claim_status: "disputed",
    validator: producer,
    verified_at: "2026-05-18T00:00:00Z"
  }
});
assert.equal(validateEvent(disputed).valid, true);

const retracted = createRetractionEvent({
  claim_ref: claim.claim_id,
  producer,
  event_time: "2026-05-19T00:00:00Z",
  retracted_at: "2026-05-19T00:00:00Z",
  retraction_reason: "Policy changed."
});
assert.equal(validateEvent(retracted).valid, true);

const dir = mkdtempSync(join(tmpdir(), "openclaims-"));
writeFileSync(join(dir, "claim-emitted.json"), JSON.stringify(emitted, null, 2));

console.log("tests: passed");
