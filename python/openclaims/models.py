"""Pydantic-backed OpenClaims v0.1 models with a minimal fallback."""

from __future__ import annotations

from typing import Any, Literal, Mapping, Optional, Union

OPENCLAIMS_VERSION = "0.1.0"


class OpenClaimsValidationError(ValueError):
    """Raised when an OpenClaims payload is invalid."""


try:
    from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

    class OpenClaimsModel(BaseModel):
        model_config = ConfigDict(extra="forbid")

    class Digest(OpenClaimsModel):
        algorithm: Literal["sha256"]
        encoding: Literal["base64url"]
        value: str

    class Agent(OpenClaimsModel):
        agent_id: str
        agent_type: Literal["human", "organization", "service", "model", "pipeline"]
        name: Optional[str] = None
        uri: Optional[str] = None
        facets: Optional[dict[str, Any]] = None

    class ClaimRelation(OpenClaimsModel):
        relation_type: Literal["derived_from", "summarizes", "refines", "contradicts"]
        claim_ref: str
        confidence: Optional[float] = None

    class Claim(OpenClaimsModel):
        claim_id: str
        text: str
        claim_type: Literal["factual", "calculation", "inference", "recommendation", "prediction"]
        asserted_at: str
        subject: Optional[Any] = None
        context: Optional[Any] = None
        valid_at: Optional[str] = None
        derived_from_claims: list[str] = Field(default_factory=list)
        relations: list[ClaimRelation] = Field(default_factory=list)
        facets: Optional[dict[str, Any]] = None

    class Selector(OpenClaimsModel):
        type: Literal["text_span", "page_span", "json_pointer", "table_cell", "uri_fragment", "byte_range"]
        start: Optional[int] = None
        end: Optional[int] = None
        page: Optional[int] = None
        path: Optional[str] = None
        row: Optional[int] = None
        column: Optional[Union[int, str]] = None
        fragment: Optional[str] = None

    class Evidence(OpenClaimsModel):
        evidence_id: str
        source_ref: str
        selector: Selector
        support_type: Literal["supports_directly", "supports_partially", "computed_from", "contradicts", "context_only", "provenance_only"]
        claim_ref: Optional[str] = None
        content_digest: Optional[Digest] = None
        observed_at: Optional[str] = None
        facets: Optional[dict[str, Any]] = None

    class Source(OpenClaimsModel):
        source_id: str
        uri: Optional[str] = None
        version: Optional[str] = None
        observed_at: Optional[str] = None
        retrieved_at: Optional[str] = None
        digest: Optional[Digest] = None
        license: Optional[str] = None
        facets: Optional[dict[str, Any]] = None

    class Tool(OpenClaimsModel):
        name: str
        version: Optional[str] = None
        container_digest: Optional[Digest] = None
        provider: Optional[str] = None
        model: Optional[str] = None
        model_version: Optional[str] = None
        prompt_template_id: Optional[str] = None

    class ToolRun(OpenClaimsModel):
        tool_run_id: str
        tool_type: str
        tool: Tool
        parameters_summary: Optional[Any] = None
        parameters_digest: Optional[Digest] = None
        trace_ref: Optional[str] = None
        facets: Optional[dict[str, Any]] = None

    class Verification(OpenClaimsModel):
        verification_id: str
        verification_result: Literal["supported", "contradicted", "inconclusive"]
        verification_method: Literal["human_review", "model_check", "source_attestation", "consensus", "formal_proof"]
        claim_status: Literal["active", "disputed", "retracted"]
        validator: Agent
        verified_at: str
        confidence: Optional[float] = None
        facets: Optional[dict[str, Any]] = None

    class ClaimEvent(OpenClaimsModel):
        event_id: str
        event_type: Literal["claim.emitted", "claim.verified", "claim.disputed", "claim.retracted"]
        event_time: str
        spec_version: Literal["0.1.0"]
        schema_url: str
        producer: Agent
        digest: Digest
        claim: Optional[Claim] = None
        claim_ref: Optional[str] = None
        sources: list[Source] = Field(default_factory=list)
        evidence: list[Evidence] = Field(default_factory=list)
        contradicting_evidence: list[Evidence] = Field(default_factory=list)
        tool_runs: list[ToolRun] = Field(default_factory=list)
        inferences: list[dict[str, Any]] = Field(default_factory=list)
        verification: Optional[Verification] = None
        dispute_rationale: Optional[str] = None
        retracted_at: Optional[str] = None
        retraction_reason: Optional[str] = None
        original_event_ref: Optional[str] = None
        auditable_trace: Optional[dict[str, Any]] = None

        @model_validator(mode="after")
        def check_event_semantics(self) -> "ClaimEvent":
            if self.claim is None and self.claim_ref is None:
                raise ValueError("event requires claim or claim_ref")
            if self.event_type == "claim.emitted" and self.claim is None:
                raise ValueError("claim.emitted requires claim")
            if self.event_type == "claim.verified" and (self.claim_ref is None or self.verification is None):
                raise ValueError("claim.verified requires claim_ref and verification")
            if self.event_type == "claim.disputed" and not self.dispute_rationale and not self.contradicting_evidence:
                raise ValueError("claim.disputed requires dispute_rationale or contradicting_evidence")
            if self.event_type == "claim.retracted" and (self.claim_ref is None or self.retracted_at is None):
                raise ValueError("claim.retracted requires claim_ref and retracted_at")
            return self

    def validate_event(event: Mapping[str, Any], *, verify_digest: bool = True) -> ClaimEvent:
        try:
            parsed = ClaimEvent.model_validate(event)
        except ValidationError as exc:
            raise OpenClaimsValidationError(str(exc)) from exc
        if verify_digest:
            from .canonical import verify_event_digest

            if not verify_event_digest(parsed):
                raise OpenClaimsValidationError("/digest: event digest mismatch")
        return parsed

    def model_validate(model_type: Any, value: Any) -> Any:
        if model_type is ClaimEvent:
            return validate_event(value)
        return model_type.model_validate(value)

    def model_dump(value: Any) -> dict[str, Any]:
        if hasattr(value, "model_dump"):
            return value.model_dump(exclude_none=True)
        return dict(value)

except Exception:
    EVENT_TYPES = {"claim.emitted", "claim.verified", "claim.disputed", "claim.retracted"}
    CLAIM_TYPES = {"factual", "calculation", "inference", "recommendation", "prediction"}
    SUPPORT_TYPES = {"supports_directly", "supports_partially", "computed_from", "contradicts", "context_only", "provenance_only"}
    SELECTOR_TYPES = {"text_span", "page_span", "json_pointer", "table_cell", "uri_fragment", "byte_range"}

    ClaimEvent = dict
    Agent = dict
    Claim = dict
    Digest = dict
    Evidence = dict
    Source = dict
    Verification = dict

    def validate_event(event: Mapping[str, Any], *, verify_digest: bool = True) -> dict[str, Any]:
        errors: list[str] = []
        for key in ["event_id", "event_type", "event_time", "spec_version", "schema_url", "producer", "digest"]:
            if not event.get(key):
                errors.append(f"/{key}: required")
        if event.get("event_type") not in EVENT_TYPES:
            errors.append("/event_type: unknown event type")
        if not event.get("claim") and not event.get("claim_ref"):
            errors.append("/: event requires claim or claim_ref")
        if event.get("claim") and event["claim"].get("claim_type") not in CLAIM_TYPES:
            errors.append("/claim/claim_type: unknown claim type")
        for index, evidence in enumerate(event.get("evidence", []) + event.get("contradicting_evidence", [])):
            if evidence.get("support_type") not in SUPPORT_TYPES:
                errors.append(f"/evidence/{index}/support_type: unknown support type")
            if evidence.get("selector", {}).get("type") not in SELECTOR_TYPES:
                errors.append(f"/evidence/{index}/selector/type: unknown selector type")
        if event.get("event_type") == "claim.emitted" and not event.get("claim"):
            errors.append("/claim: claim.emitted requires claim")
        if event.get("event_type") == "claim.verified" and (not event.get("claim_ref") or not event.get("verification")):
            errors.append("/: claim.verified requires claim_ref and verification")
        if event.get("event_type") == "claim.disputed" and not event.get("dispute_rationale") and not event.get("contradicting_evidence"):
            errors.append("/: claim.disputed requires dispute_rationale or contradicting_evidence")
        if event.get("event_type") == "claim.retracted" and (not event.get("claim_ref") or not event.get("retracted_at")):
            errors.append("/: claim.retracted requires claim_ref and retracted_at")
        if verify_digest:
            from .canonical import verify_event_digest

            if event.get("digest") and not verify_event_digest(event):
                errors.append("/digest: event digest mismatch")
        if errors:
            raise OpenClaimsValidationError("; ".join(errors))
        return dict(event)

    def model_validate(model_type: Any, value: Any) -> dict[str, Any]:
        if model_type is ClaimEvent:
            return validate_event(value)
        raise TypeError("Only ClaimEvent validation is supported")

    def model_dump(value: Any) -> dict[str, Any]:
        return dict(value)
