"""Deterministic OpenClaims identifier helpers."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse, urlunparse

from .canonical import normalize_claim_text, sha256_base64url


def _id(prefix: str, value: Any) -> str:
    return f"{prefix}_{sha256_base64url(value)[:26]}"


def canonical_uri(uri: str) -> str:
    parsed = urlparse(uri.strip())
    if not parsed.scheme:
        return uri.strip()
    return urlunparse(parsed)


def claim_id(text: str, context: Any | None = None) -> str:
    return _id("clm", {"text": normalize_claim_text(text), "context": context or {}})


def source_id(uri: str, digest_or_version: str = "") -> str:
    return _id("src", {"uri": canonical_uri(uri), "digestOrVersion": digest_or_version})


def evidence_id(source_ref: str, selector: Any, content_digest: str = "") -> str:
    return _id("ev", {"sourceRef": source_ref, "selector": selector, "contentDigest": content_digest})


def event_id(event_like: Any) -> str:
    return _id("evt", event_like)
