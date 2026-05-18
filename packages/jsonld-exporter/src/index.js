export const OPENCLAIMS_CONTEXT = {
  "@version": 1.1,
  oc: "https://openclaims.org/ns#",
  prov: "http://www.w3.org/ns/prov#",
  schema: "https://schema.org/",
  Claim: "schema:Claim",
  Evidence: "oc:Evidence",
  Source: "oc:Source",
  ToolRun: "oc:ToolRun",
  Verification: "oc:Verification",
  Agent: "prov:Agent",
  wasGeneratedBy: "prov:wasGeneratedBy",
  used: "prov:used",
  wasAssociatedWith: "prov:wasAssociatedWith",
  supports: "oc:supports",
  contradicts: "oc:contradicts"
};

export function eventToJsonLd(event) {
  const graph = [];
  const producerId = id("agent", event.producer?.agent_id);
  if (event.producer) {
    graph.push({
      "@id": producerId,
      "@type": ["prov:Agent", "oc:Agent"],
      "oc:agentType": event.producer.agent_type,
      "schema:name": event.producer.name
    });
  }

  if (event.claim) graph.push(claimNode(event.claim, event));
  for (const source of event.sources ?? []) graph.push(sourceNode(source));
  for (const evidence of event.evidence ?? []) graph.push(evidenceNode(evidence));
  for (const evidence of event.contradicting_evidence ?? []) graph.push(evidenceNode(evidence));
  for (const toolRun of event.tool_runs ?? []) graph.push(toolRunNode(toolRun, producerId));
  if (event.verification) graph.push(verificationNode(event.verification, event.claim_ref, producerId));

  graph.push({
    "@id": id("event", event.event_id),
    "@type": "oc:ClaimEvent",
    "oc:eventType": event.event_type,
    "prov:generatedAtTime": event.event_time,
    "oc:specVersion": event.spec_version,
    "oc:digest": event.digest
  });

  return {
    "@context": OPENCLAIMS_CONTEXT,
    "@id": id("event", event.event_id),
    "@graph": graph.filter(Boolean)
  };
}

function claimNode(claim, event) {
  return {
    "@id": id("claim", claim.claim_id),
    "@type": ["prov:Entity", "schema:Claim", "oc:Claim"],
    "schema:text": claim.text,
    "oc:claimType": claim.claim_type,
    "oc:assertedAt": claim.asserted_at,
    "oc:validAt": claim.valid_at,
    "prov:wasAttributedTo": id("agent", event.producer?.agent_id),
    "oc:derivedFromClaims": (claim.derived_from_claims ?? []).map((claimRef) => id("claim", claimRef))
  };
}

function sourceNode(source) {
  return {
    "@id": id("source", source.source_id),
    "@type": ["prov:Entity", "oc:Source"],
    "oc:uri": source.uri,
    "oc:version": source.version,
    "oc:observedAt": source.observed_at,
    "oc:digest": source.digest
  };
}

function evidenceNode(evidence) {
  const relation = evidence.support_type === "contradicts" ? "oc:contradicts" : "oc:supports";
  return {
    "@id": id("evidence", evidence.evidence_id),
    "@type": ["prov:Entity", "oc:Evidence"],
    "prov:wasDerivedFrom": id("source", evidence.source_ref),
    "oc:selector": evidence.selector,
    "oc:supportType": evidence.support_type,
    [relation]: evidence.claim_ref ? id("claim", evidence.claim_ref) : undefined,
    "oc:contentDigest": evidence.content_digest
  };
}

function toolRunNode(toolRun, producerId) {
  return {
    "@id": id("toolRun", toolRun.tool_run_id),
    "@type": ["prov:Activity", "oc:ToolRun"],
    "oc:toolType": toolRun.tool_type,
    "oc:tool": toolRun.tool,
    "oc:traceRef": toolRun.trace_ref,
    "prov:wasAssociatedWith": producerId
  };
}

function verificationNode(verification, claimRef, producerId) {
  return {
    "@id": id("verification", verification.verification_id),
    "@type": ["prov:Activity", "oc:Verification"],
    "oc:verificationResult": verification.verification_result,
    "oc:verificationMethod": verification.verification_method,
    "oc:claimStatus": verification.claim_status,
    "oc:verifiedAt": verification.verified_at,
    "prov:used": claimRef ? id("claim", claimRef) : undefined,
    "prov:wasAssociatedWith": producerId
  };
}

function id(kind, value) {
  return `urn:openclaims:${kind}:${value ?? "unknown"}`;
}
