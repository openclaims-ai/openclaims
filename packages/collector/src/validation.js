import { validateEvent, verifyEventDigest } from "../../typescript-sdk/src/index.js";

export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 422;
    this.details = details;
  }
}

export class ConflictError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ConflictError";
    this.statusCode = 409;
    this.details = details;
  }
}

export function claimKey(event) {
  return event.claim?.claim_id ?? event.claim_ref;
}

export function eventKey(event) {
  return event.event_id;
}

export function validateEventShape(event) {
  const result = validateEvent(event);
  if (!result.valid) {
    throw new ValidationError("event failed validation", result.errors.map((item) => `${item.path}: ${item.message}`));
  }
  if (!verifyEventDigest(event)) {
    throw new ValidationError("event digest mismatch", ["/digest: event digest mismatch"]);
  }
  return event;
}

export function validateEventAgainstHistory(event, history = []) {
  validateEventShape(event);
  const key = claimKey(event);
  const claimHistory = history.filter((item) => claimKey(item) === key);
  const errors = [];

  if (history.some((item) => eventKey(item) === eventKey(event))) {
    errors.push(`event ${eventKey(event)} has already been ingested`);
  }

  const hasEmitted = claimHistory.some((item) => item.event_type === "claim.emitted");
  const isRetracted = claimHistory.some((item) => item.event_type === "claim.retracted");

  if (event.event_type === "claim.emitted" && hasEmitted) {
    errors.push(`claim ${key} has already been emitted`);
  }
  if (event.event_type !== "claim.emitted" && !hasEmitted) {
    errors.push(`${event.event_type} requires a prior claim.emitted event for ${key}`);
  }
  if (isRetracted) {
    errors.push(`claim ${key} is terminal after claim.retracted`);
  }

  if (errors.length > 0) {
    throw new ConflictError("event conflicts with claim history", errors);
  }
  return event;
}

export function validateReplay(events, initialHistory = []) {
  const accepted = [];
  const working = [...initialHistory];
  for (const event of events) {
    validateEventAgainstHistory(event, working);
    working.push(event);
    accepted.push(event);
  }
  return accepted;
}
