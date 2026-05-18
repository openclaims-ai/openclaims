import { createHash } from "node:crypto";

export const SPEC_VERSION = "0.1.0";
export const DEFAULT_SCHEMA_URL =
  "https://openclaims.org/schemas/openclaims/0.1/ClaimEvent.schema.json";

export function canonicalize(value) {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Cannot canonicalize non-finite number");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(",")}}`;
  }
  throw new TypeError(`Cannot canonicalize ${typeof value}`);
}

export function sha256Base64Url(input) {
  return createHash("sha256").update(input).digest("base64url");
}

export function digestValue(value) {
  return {
    algorithm: "sha256",
    encoding: "base64url",
    value: sha256Base64Url(canonicalize(value))
  };
}

export function eventDigest(event) {
  const clone = structuredClone(event);
  delete clone.digest;
  return digestValue(clone);
}

export function withEventDigest(event) {
  const clone = structuredClone(event);
  clone.digest = eventDigest(clone);
  return clone;
}

export function verifyEventDigest(event) {
  if (!event || !event.digest) return false;
  const expected = eventDigest(event);
  return (
    event.digest.algorithm === expected.algorithm &&
    event.digest.encoding === expected.encoding &&
    event.digest.value === expected.value
  );
}

export function normalizeClaimText(text) {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function canonicalUri(uri) {
  try {
    const parsed = new URL(uri);
    parsed.hash = parsed.hash || "";
    return parsed.toString();
  } catch {
    return uri.normalize("NFC").trim();
  }
}
