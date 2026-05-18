"""Canonical JSON and digest helpers for OpenClaims v0.1."""

from __future__ import annotations

import base64
import hashlib
import json
import unicodedata
from dataclasses import asdict, is_dataclass
from typing import Any, Mapping


def normalize_json(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return normalize_json(value.model_dump(exclude_none=True))
    if is_dataclass(value):
        return normalize_json(asdict(value))
    if isinstance(value, Mapping):
        return {str(key): normalize_json(item) for key, item in value.items() if item is not None}
    if isinstance(value, (list, tuple)):
        return [normalize_json(item) for item in value]
    return value


def canonical_json(value: Any) -> str:
    return json.dumps(
        normalize_json(value),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def canonical_bytes(value: Any) -> bytes:
    return canonical_json(value).encode("utf-8")


def sha256_base64url(value: Any) -> str:
    digest = hashlib.sha256(canonical_bytes(value)).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def digest_value(value: Any) -> dict[str, str]:
    return {"algorithm": "sha256", "encoding": "base64url", "value": sha256_base64url(value)}


def event_digest(event: Mapping[str, Any]) -> dict[str, str]:
    payload = normalize_json(event)
    payload.pop("digest", None)
    return digest_value(payload)


def with_event_digest(event: Mapping[str, Any]) -> dict[str, Any]:
    payload = normalize_json(event)
    payload["digest"] = event_digest(payload)
    return payload


def verify_event_digest(event: Mapping[str, Any]) -> bool:
    payload = normalize_json(event)
    return payload.get("digest") == event_digest(payload)


def normalize_claim_text(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).split())
