import { claimKey, eventKey } from "./validation.js";

function initialProjection(claimId) {
  return {
    claim_id: claimId,
    status: "unknown",
    emitted: null,
    verified: [],
    disputes: [],
    retraction: null,
    events: []
  };
}

export function projectClaim(claimId, events) {
  const projection = initialProjection(claimId);
  const claimEvents = events
    .filter((event) => claimKey(event) === claimId)
    .sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time));

  for (const event of claimEvents) {
    projection.events.push(eventKey(event));

    if (event.event_type === "claim.emitted") {
      projection.status = "emitted";
      projection.emitted = event;
    }
    if (event.event_type === "claim.verified") {
      projection.status = event.verification?.claim_status ?? "verified";
      projection.verified.push(event);
    }
    if (event.event_type === "claim.disputed") {
      projection.status = "disputed";
      projection.disputes.push(event);
    }
    if (event.event_type === "claim.retracted") {
      projection.status = "retracted";
      projection.retraction = event;
    }
  }

  return projection;
}

export function projectClaims(events) {
  const claimIds = [...new Set(events.map((event) => claimKey(event)).filter(Boolean))].sort();
  return claimIds.map((claimId) => projectClaim(claimId, events));
}
