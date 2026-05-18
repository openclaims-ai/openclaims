from openclaims import canonical_json, digest_value


def test_canonical_json_sorts_keys():
    assert canonical_json({"b": 1, "a": 2}) == '{"a":2,"b":1}'


def test_digest_shape():
    digest = digest_value({"a": 1})
    assert digest["algorithm"] == "sha256"
    assert digest["encoding"] == "base64url"
    assert digest["value"]
