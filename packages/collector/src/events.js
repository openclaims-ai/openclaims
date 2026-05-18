export const OPENCLAIMS_VERSION = "0.1.0";

export const EVENT_TYPES = Object.freeze({
  EMITTED: "claim.emitted",
  VERIFIED: "claim.verified",
  DISPUTED: "claim.disputed",
  RETRACTED: "claim.retracted"
});

export const TERMINAL_TYPES = new Set([
  EVENT_TYPES.RETRACTED
]);

export function nowIso() {
  return new Date().toISOString();
}

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
