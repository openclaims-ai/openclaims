import json
from pathlib import Path

import pytest

from openclaims import ClaimEvent, model_validate, verify_event_digest


FIXTURE_ROOT = Path(__file__).resolve().parents[2] / "fixtures"


def _fixture_files(kind):
    root = FIXTURE_ROOT / kind
    if not root.exists():
        return []
    return sorted(root.glob("*.json"))


@pytest.mark.parametrize("path", _fixture_files("valid"))
def test_valid_shared_fixtures_validate(path):
    payload = json.loads(path.read_text())
    event = model_validate(ClaimEvent, payload)
    assert verify_event_digest(event)


@pytest.mark.parametrize("path", _fixture_files("invalid"))
def test_invalid_shared_fixtures_do_not_validate(path):
    payload = json.loads(path.read_text())
    with pytest.raises(Exception):
        model_validate(ClaimEvent, payload)
