"""Builder helpers for OpenClaims v0.1 events."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping

from .canonical import digest_value, normalize_claim_text, with_event_digest
from .ids import claim_id, event_id
from .models import OPENCLAIMS_VERSION, model_dump, validate_event

DEFAULT_SCHEMA_URL = "https://openclaims.org/schemas/openclaims/0.1/ClaimEvent.schema.json"


def timestamp(moment: datetime | None = None) -> str:
    moment = moment or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def create_claim(*, text: str, claim_type: str = "factual", asserted_at: str, context: Any | None = None, **extra: Any) -> dict[str, Any]:
    normalized = normalize_claim_text(text)
    return {
        "claim_id": claim_id(normalized, context or {}),
        "text": normalized,
        "claim_type": claim_type,
        "asserted_at": asserted_at,
        **({"context": context} if context is not None else {}),
        **extra,
    }


def create_base_event(*, event_type: str, producer: Mapping[str, Any], claim: Mapping[str, Any] | None = None, claim_ref: str | None = None, event_time: str | None = None, **extra: Any) -> dict[str, Any]:
    draft = {
        "event_type": event_type,
        "event_time": event_time or timestamp(),
        "spec_version": OPENCLAIMS_VERSION,
        "schema_url": DEFAULT_SCHEMA_URL,
        "producer": dict(producer),
        **({"claim": dict(claim)} if claim is not None else {}),
        **({"claim_ref": claim_ref} if claim_ref is not None else {}),
        **{key: value for key, value in extra.items() if value is not None},
    }
    draft["event_id"] = event_id(draft)
    event = with_event_digest(draft)
    return model_dump(validate_event(event))


def create_claim_emitted_event(**kwargs: Any) -> dict[str, Any]:
    return create_base_event(event_type="claim.emitted", **kwargs)


def create_verification_event(**kwargs: Any) -> dict[str, Any]:
    return create_base_event(event_type="claim.verified", **kwargs)


def create_dispute_event(**kwargs: Any) -> dict[str, Any]:
    return create_base_event(event_type="claim.disputed", **kwargs)


def create_retraction_event(**kwargs: Any) -> dict[str, Any]:
    return create_base_event(event_type="claim.retracted", **kwargs)
