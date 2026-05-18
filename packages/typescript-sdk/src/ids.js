import { canonicalize, canonicalUri, normalizeClaimText, sha256Base64Url } from "./canonicalize.js";

function id(prefix, value) {
  return `${prefix}_${sha256Base64Url(canonicalize(value)).slice(0, 26)}`;
}

export function claimId(text, context = {}) {
  return id("clm", { text: normalizeClaimText(text), context });
}

export function sourceId(uri, digestOrVersion = "") {
  return id("src", { uri: canonicalUri(uri), digestOrVersion });
}

export function evidenceId(sourceRef, selector, contentDigest = "") {
  return id("ev", { sourceRef, selector, contentDigest });
}

export function toolRunId(tool) {
  return id("run", tool);
}

export function eventId(eventLike) {
  return id("evt", eventLike);
}
