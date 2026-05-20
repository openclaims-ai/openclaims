#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  agent,
  createClaim,
  createClaimEmittedEvent,
  createDisputeEvent,
  createVerificationEvent,
  digest,
  embeddedResponse,
  evidenceId,
  selector,
  sourceId,
  toolRunId,
  validateEvent,
  verifyEventDigest,
  wrapCloudEvent
} from "../../packages/typescript-sdk/src/index.js";
import { eventToJsonLd } from "../../packages/jsonld-exporter/src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const corpusPath = join(here, "corpus", "travel-policy.md");
const outputDir = join(here, "output");
const siteAssetPath = join(repoRoot, "site", "assets", "verified-analysis-demo.json");
const checkMode = process.argv.includes("--check");

const QUESTION = "Does the travel policy require approval for overnight trips?";
const ANSWER =
  "Yes. Overnight business trips require manager approval before booking. " +
  "The supporting policy language is on page 7. " +
  "A prior statement that director approval is not required is disputed by revised-policy evidence for international overnight travel.";

const EVENT_TIMES = {
  emitted: "2026-05-19T15:02:14Z",
  verified: "2026-05-19T15:02:16Z",
  disputed: "2026-05-19T15:04:38Z"
};

const producer = agent({
  id: "urn:openclaims:demo:verified-analysis-agent",
  type: "pipeline",
  name: "OpenClaims Verified Analysis Demo",
  uri: "https://openclaims.org/examples/verified-analysis"
});

const validator = agent({
  id: "urn:openclaims:demo:policy-source-checker",
  type: "service",
  name: "Policy Source Checker",
  uri: "https://openclaims.org/examples/verified-analysis/source-checker"
});

const corpus = readFileSync(corpusPath, "utf8");
const passages = [
  passage({
    id: "manager-approval",
    version: "2026.3",
    quote: "Overnight business travel must be approved by the employee's manager before airfare, lodging, or rail is booked."
  }),
  passage({
    id: "page-seven-location",
    version: "2026.3",
    quote: "The approval rule for overnight business travel appears in Section 4.2, page 7 of the travel policy."
  }),
  passage({
    id: "director-approval",
    version: "2026.4",
    quote: "International overnight travel requires both manager approval and director approval before booking."
  })
];

const sources = {
  "2026.3": sourceForVersion("2026.3", passages[0].sectionText),
  "2026.4": sourceForVersion("2026.4", passages[2].sectionText)
};

const toolRun = createToolRun();
const claims = createClaims();
const events = createEvents();
const jsonld = {
  "@context": "https://openclaims.org/schemas/openclaims/0.1/context.jsonld",
  "@graph": events.flatMap((event) => eventToJsonLd(event)["@graph"])
};
const cloudEvents = events.map(wrapCloudEvent);

for (const event of events) {
  const result = validateEvent(event);
  if (!result.valid) {
    throw new Error(`${event.event_id} did not validate:\n${result.errors.map((item) => `${item.path}: ${item.message}`).join("\n")}`);
  }
  if (!verifyEventDigest(event)) {
    throw new Error(`${event.event_id} digest did not verify`);
  }
}

const response = embeddedResponse({ question: QUESTION, answer: ANSWER }, events);
const browserFixture = createBrowserFixture();
const outputs = new Map([
  [join(outputDir, "event-history.json"), { question: QUESTION, answer: ANSWER, events }],
  [join(outputDir, "embedded-response.json"), response],
  [join(outputDir, "jsonld.json"), jsonld],
  [join(outputDir, "cloudevents.json"), cloudEvents],
  [siteAssetPath, browserFixture]
]);

if (checkMode) {
  checkOutputs(outputs);
} else {
  mkdirSync(outputDir, { recursive: true });
  for (const [path, value] of outputs) writeJson(path, value);
}

console.log(`verified-analysis demo: ${checkMode ? "checked" : "wrote"} ${events.length} events`);
console.log(`verified-analysis demo: ${join(outputDir, "event-history.json")}`);
console.log(`verified-analysis demo: ${siteAssetPath}`);

function createClaims() {
  const managerClaim = createClaim({
    text: "Overnight business trips require manager approval before booking.",
    claim_type: "factual",
    asserted_at: EVENT_TIMES.emitted,
    context: { question: QUESTION, answer_id: "verified-analysis-demo-answer" }
  });
  const pageClaim = createClaim({
    text: "The supporting evidence comes from page 7 of the travel policy.",
    claim_type: "factual",
    asserted_at: EVENT_TIMES.emitted,
    context: { question: QUESTION, answer_id: "verified-analysis-demo-answer" }
  });
  const directorClaim = createClaim({
    text: "Director approval is not required for overnight trips.",
    claim_type: "factual",
    asserted_at: EVENT_TIMES.emitted,
    context: { question: QUESTION, answer_id: "verified-analysis-demo-answer" }
  });
  return [
    createClaimRecord({
      key: "manager_approval",
      label: "Supported",
      status: "supported",
      claim: managerClaim,
      passage: passages[0],
      source: sources["2026.3"],
      support_type: "supports_directly",
      verification_result: "supported",
      verification_method: "source_attestation",
      claim_status: "active",
      confidence: 0.96
    }),
    createClaimRecord({
      key: "page_7_evidence",
      label: "Supported",
      status: "supported",
      claim: pageClaim,
      passage: passages[1],
      source: sources["2026.3"],
      support_type: "supports_directly",
      verification_result: "supported",
      verification_method: "model_check",
      claim_status: "active",
      confidence: 0.99
    }),
    createClaimRecord({
      key: "director_not_required",
      label: "Disputed",
      status: "disputed",
      claim: directorClaim,
      passage: passages[2],
      source: sources["2026.4"],
      support_type: "contradicts",
      verification_result: "contradicted",
      verification_method: "human_review",
      claim_status: "disputed",
      confidence: 0.91,
      dispute_rationale: "The revised 2026.4 policy adds director approval for international overnight travel."
    })
  ];
}

function createClaimRecord({
  key,
  label,
  status,
  claim,
  passage,
  source,
  support_type,
  verification_result,
  verification_method,
  claim_status,
  confidence,
  dispute_rationale
}) {
  const evidence = {
    evidence_id: evidenceId(source.source_id, passage.selector, digest(passage.quote).value),
    source_ref: source.source_id,
    claim_ref: claim.claim_id,
    selector: passage.selector,
    support_type,
    content_digest: digest(passage.quote),
    observed_at: source.observed_at,
    facets: {
      quote: {
        _producer: "https://openclaims.org/examples/verified-analysis",
        _schemaURL: "https://openclaims.org/schemas/openclaims/0.1/facets/QuoteFacet.schema.json",
        text: passage.quote
      }
    }
  };
  const verification = {
    verification_id: `ver_${key}`,
    verification_result,
    verification_method,
    claim_status,
    validator,
    verified_at: status === "disputed" ? EVENT_TIMES.disputed : EVENT_TIMES.verified,
    confidence
  };
  return { key, label, status, claim, source, evidence, verification, dispute_rationale };
}

function createEvents() {
  const output = [];
  const hashChain = [];
  for (const item of claims) {
    const emitted = createClaimEmittedEvent({
      claim: item.claim,
      producer,
      event_time: EVENT_TIMES.emitted,
      sources: [item.source],
      evidence: [item.evidence],
      tool_runs: [toolRun],
      auditable_trace: { event_ids: [], hash_chain: [...hashChain] }
    });
    output.push(emitted);
    hashChain.push(emitted.digest);

    const lifecycleEvent =
      item.status === "disputed"
        ? createDisputeEvent({
            claim_ref: item.claim.claim_id,
            producer,
            verification: item.verification,
            contradicting_evidence: [item.evidence],
            dispute_rationale: item.dispute_rationale,
            event_time: EVENT_TIMES.disputed,
            auditable_trace: {
              event_ids: output.map((event) => event.event_id),
              hash_chain: [...hashChain]
            }
          })
        : createVerificationEvent({
            claim_ref: item.claim.claim_id,
            producer,
            verification: item.verification,
            event_time: EVENT_TIMES.verified,
            evidence: [item.evidence],
            auditable_trace: {
              event_ids: output.map((event) => event.event_id),
              hash_chain: [...hashChain]
            }
          });
    output.push(lifecycleEvent);
    hashChain.push(output.at(-1).digest);
  }
  return output;
}

function createToolRun() {
  const tool = {
    name: "deterministic-policy-retriever",
    version: "0.1.0",
    provider: "openclaims",
    model: "none",
    model_version: "offline",
    prompt_template_id: "verified-analysis-demo-v1"
  };
  const parameters_summary = {
    question_digest: digest(QUESTION),
    corpus_digest: digest(corpus),
    top_k: 3,
    network: "disabled"
  };
  return {
    tool_run_id: toolRunId({ tool, parameters_summary }),
    tool_type: "retriever",
    tool,
    parameters_summary,
    parameters_digest: digest(parameters_summary),
    trace_ref: "verified-analysis-demo/offline-run-001"
  };
}

function sourceForVersion(version, sectionText) {
  const source_id = sourceId("file://examples/verified-analysis/corpus/travel-policy.md", version);
  return {
    source_id,
    uri: "file://examples/verified-analysis/corpus/travel-policy.md",
    version,
    observed_at: version === "2026.4" ? EVENT_TIMES.disputed : EVENT_TIMES.verified,
    retrieved_at: version === "2026.4" ? EVENT_TIMES.disputed : EVENT_TIMES.verified,
    digest: digest(sectionText),
    facets: {
      document: {
        _producer: "https://openclaims.org/examples/verified-analysis",
        _schemaURL: "https://openclaims.org/schemas/openclaims/0.1/facets/DocumentFacet.schema.json",
        title: "Acme Travel and Expense Policy"
      }
    }
  };
}

function passage({ id, version, quote }) {
  const versionMarker = `Version: ${version}`;
  const versionStart = corpus.indexOf(versionMarker);
  if (versionStart === -1) throw new Error(`Version marker not found: ${version}`);
  const nextVersion = corpus.indexOf("Document ID:", versionStart + versionMarker.length);
  const sectionEnd = nextVersion === -1 ? corpus.length : nextVersion;
  const sectionText = corpus.slice(versionStart, sectionEnd);
  const localStart = sectionText.indexOf(quote);
  if (localStart === -1) throw new Error(`Quote not found for ${id}`);
  return {
    id,
    version,
    quote,
    sectionText,
    selector: selector("page_span", {
      page: 7,
      start: localStart,
      end: localStart + quote.length
    })
  };
}

function createBrowserFixture() {
  const byClaim = new Map();
  for (const item of claims) {
    byClaim.set(item.claim.claim_id, {
      id: item.claim.claim_id,
      label: item.label,
      status: item.status,
      claimText: item.claim.text,
      source: item.source,
      evidence: item.evidence,
      verification: item.verification,
      toolRun,
      disputeRationale: item.dispute_rationale,
      events: []
    });
  }
  for (const event of events) {
    const claimId = event.claim?.claim_id ?? event.claim_ref;
    byClaim.get(claimId)?.events.push(event);
  }
  return {
    question: QUESTION,
    answer: ANSWER,
    claims: [...byClaim.values()],
    jsonld
  };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function checkOutputs(outputs) {
  const mismatches = [];
  for (const [path, value] of outputs) {
    const expected = `${JSON.stringify(value, null, 2)}\n`;
    if (!existsSync(path)) {
      mismatches.push(`${path}: missing`);
      continue;
    }
    const actual = readFileSync(path, "utf8");
    if (actual !== expected) mismatches.push(`${path}: out of date`);
  }
  if (mismatches.length > 0) {
    throw new Error(`Verified Analysis demo outputs are stale. Run pnpm demo:verified-analysis.\n${mismatches.join("\n")}`);
  }
}
