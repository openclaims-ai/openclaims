# OpenClaims Python SDK

Dependency-light Python SDK for OpenClaims v0.1.

The package provides:

- canonical JSON helpers;
- SHA-256 base64url digest helpers;
- deterministic IDs for claims, sources, evidence, and events;
- basic event validation;
- builders for `claim.emitted`, `claim.verified`, `claim.disputed`, and `claim.retracted`.

```python
from openclaims import create_claim, create_claim_emitted_event

producer = {"agent_id": "urn:service:example", "agent_type": "service"}
claim = create_claim(
    text="The policy requires manager approval.",
    asserted_at="2026-05-17T00:00:00Z",
)
event = create_claim_emitted_event(producer=producer, claim=claim)
```
