import { writeFileSync, mkdirSync } from "node:fs";
import {
  agent,
  createClaim,
  createClaimEmittedEvent,
  createDisputeEvent,
  createRetractionEvent,
  createVerificationEvent,
  digest,
  evidenceId,
  selector,
  sourceId,
  wrapCloudEvent
} from "../packages/typescript-sdk/src/index.js";
import { eventToJsonLd } from "../packages/jsonld-exporter/src/index.js";

mkdirSync("fixtures/valid", { recursive: true });
mkdirSync("fixtures/invalid", { recursive: true });
mkdirSync("fixtures/jsonld", { recursive: true });
mkdirSync("fixtures/cloudevents", { recursive: true });
mkdirSync("fixtures/signed", { recursive: true });
mkdirSync("conformance/cases", { recursive: true });

const producer = agent({ id: "urn:service:assistant-api", type: "service", name: "Assistant API" });
const validator = agent({ id: "urn:service:claim-verifier", type: "service", name: "Claim Verifier" });
const claim = createClaim({
  text: "The internal travel policy requires manager approval for overnight trips.",
  claim_type: "factual",
  asserted_at: "2026-05-17T19:30:00Z",
  context: { tenant: "example-org", output_id: "answer-001" }
});
const sourceRef = sourceId("https://example.org/policies/travel.pdf", "sha256:8a4d");
const pageSelector = selector("page_span", { page: 7, start: 1220, end: 1310 });
const evidenceRef = evidenceId(sourceRef, pageSelector, "sha256:91ee");
const emitted = createClaimEmittedEvent({
  claim,
  producer,
  event_time: "2026-05-17T19:30:01Z",
  sources: [{
    source_id: sourceRef,
    uri: "https://example.org/policies/travel.pdf",
    version: "sha256:8a4d",
    observed_at: "2026-05-17T19:29:41Z",
    digest: digest("policy-v3")
  }],
  evidence: [{
    evidence_id: evidenceRef,
    source_ref: sourceRef,
    claim_ref: claim.claim_id,
    selector: pageSelector,
    support_type: "supports_directly",
    content_digest: digest("manager approval for overnight trips")
  }],
  tool_runs: [{
    tool_run_id: "run_pdf_retriever_784",
    tool_type: "retriever",
    tool: {
      name: "policy-index-search",
      version: "0.1.0",
      provider: "example",
      model: "text-embedding-3-large",
      model_version: "2026-01"
    },
    parameters_summary: { k: 5, query_digest: digest("overnight approval") },
    parameters_digest: digest({ k: 5, query: "overnight approval" }),
    trace_ref: "4bf92f3577b34da6a3ce929d0e0e4736/00f067aa0ba902b7"
  }]
});

const verified = createVerificationEvent({
  claim_ref: claim.claim_id,
  producer: validator,
  event_time: "2026-05-17T19:31:08Z",
  verification: {
    verification_id: "ver_01",
    verification_result: "supported",
    verification_method: "model_check",
    claim_status: "active",
    validator,
    verified_at: "2026-05-17T19:31:08Z",
    confidence: 0.96
  }
});

const disputed = createDisputeEvent({
  claim_ref: claim.claim_id,
  producer: validator,
  event_time: "2026-05-18T12:00:00Z",
  dispute_rationale: "A newer policy revision states director approval is required.",
  contradicting_evidence: [{
    evidence_id: "ev_contradiction_01",
    source_ref: sourceRef,
    claim_ref: claim.claim_id,
    selector: selector("page_span", { page: 8, start: 200, end: 260 }),
    support_type: "contradicts",
    content_digest: digest("director approval")
  }],
  verification: {
    verification_id: "ver_02",
    verification_result: "contradicted",
    verification_method: "source_attestation",
    claim_status: "disputed",
    validator,
    verified_at: "2026-05-18T12:00:00Z"
  }
});

const retracted = createRetractionEvent({
  claim_ref: claim.claim_id,
  producer,
  event_time: "2026-05-19T09:00:00Z",
  retracted_at: "2026-05-19T09:00:00Z",
  retraction_reason: "The cited policy was superseded.",
  original_event_ref: emitted.event_id
});

write("fixtures/valid/claim-emitted.json", emitted);
write("fixtures/valid/claim-verified.json", verified);
write("fixtures/valid/claim-disputed.json", disputed);
write("fixtures/valid/claim-retracted.json", retracted);
write("fixtures/cloudevents/claim-emitted.json", wrapCloudEvent(emitted));
write("fixtures/jsonld/claim-emitted.jsonld", eventToJsonLd(emitted));
write("conformance/cases/valid-emitted-verified-disputed-retracted.json", {
  name: "valid emitted verified disputed retracted replay",
  events: [emitted, verified, disputed, retracted],
  expect: { accepted: 4, claim_status: "retracted" }
});
write("conformance/cases/invalid-verified-before-emitted.json", {
  name: "invalid verified before emitted replay",
  events: [verified],
  expect: { error_type: "ConflictError" }
});
const duplicate = structuredClone(verified);
write("conformance/cases/invalid-duplicate-event-id.json", {
  name: "invalid duplicate event id replay",
  events: [emitted, verified, duplicate],
  expect: { error_type: "ConflictError" }
});
write("conformance/cases/invalid-add-after-retracted.json", {
  name: "invalid add after retracted replay",
  events: [emitted, retracted, verified],
  expect: { error_type: "ConflictError" }
});

const missingClaim = structuredClone(emitted);
delete missingClaim.claim;
delete missingClaim.claim_ref;
write("fixtures/invalid/claim-emitted-missing-claim.json", missingClaim);

const badSupport = structuredClone(emitted);
badSupport.evidence[0].support_type = "proves_absolutely";
write("fixtures/invalid/claim-emitted-bad-support-type.json", badSupport);

const badDispute = structuredClone(disputed);
delete badDispute.contradicting_evidence;
delete badDispute.dispute_rationale;
write("fixtures/invalid/claim-disputed-without-reason.json", badDispute);

const badRetraction = structuredClone(retracted);
delete badRetraction.retracted_at;
write("fixtures/invalid/claim-retracted-without-retracted-at.json", badRetraction);

const badDigest = structuredClone(verified);
badDigest.digest.value = "not-the-real-digest";
write("fixtures/invalid/claim-verified-bad-digest.json", badDigest);

function write(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
