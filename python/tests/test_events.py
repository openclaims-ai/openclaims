from openclaims import create_claim, create_claim_emitted_event, validate_event, verify_event_digest


def test_create_claim_emitted_event():
    producer = {"agent_id": "urn:service:test", "agent_type": "service", "name": "test"}
    claim = create_claim(
        text="The policy requires approval.",
        asserted_at="2026-05-17T00:00:00Z",
    )
    event = create_claim_emitted_event(
        producer=producer,
        claim=claim,
        event_time="2026-05-17T00:00:01Z",
        sources=[],
        evidence=[],
    )
    assert event["event_type"] == "claim.emitted"
    assert validate_event(event) == event
    assert verify_event_digest(event)
