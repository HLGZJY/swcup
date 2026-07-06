"""API tests for /classify/breed endpoint — uses a mock model (no real weights)."""

import pytest
import torch
from fastapi.testclient import TestClient

from src.api import breed


pytestmark = pytest.mark.api


@pytest.fixture
def client(monkeypatch, fake_breed_model):
    """Replace breed model + prototypes with fakes."""
    monkeypatch.setattr(breed, "_breed_model", fake_breed_model)
    # 4 dummy prototypes covering first 4 breeds, so top-3 always picks from these
    monkeypatch.setattr(
        breed,
        "_protos",
        torch.stack(
            [
                torch.nn.functional.normalize(torch.tensor(
                    [1.0, 0.0] + [0.0] * 510, dtype=torch.float32), p=2, dim=0),
                torch.nn.functional.normalize(torch.tensor(
                    [0.0, 1.0] + [0.0] * 510, dtype=torch.float32), p=2, dim=0),
                torch.nn.functional.normalize(torch.tensor(
                    [0.0, 0.0, 1.0] + [0.0] * 509, dtype=torch.float32), p=2, dim=0),
                torch.nn.functional.normalize(torch.tensor(
                    [0.0, 0.0, 0.0, 1.0] + [0.0] * 508, dtype=torch.float32), p=2, dim=0),
            ]
        ),
    )
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(breed.router)
    return TestClient(app)


class TestBreedEndpoint:
    def test_returns_top3_with_confidence(self, client, b64_sharp):
        r = client.post("/classify/breed", json={"image": b64_sharp})
        assert r.status_code == 200
        body = r.json()
        assert "breed" in body
        assert "breed_cn" in body
        assert "confidence" in body
        assert len(body["top3"]) == 3

    def test_top3_sorted_by_confidence_desc(self, client, b64_sharp):
        r = client.post("/classify/breed", json={"image": b64_sharp})
        confs = [item["confidence"] for item in r.json()["top3"]]
        assert confs == sorted(confs, reverse=True)

    def test_top3_confidences_sum_to_roughly_one(self, client, b64_sharp):
        """Softmax over 3 values should sum to ~1.0."""
        r = client.post("/classify/breed", json={"image": b64_sharp})
        confs = [item["confidence"] for item in r.json()["top3"]]
        assert sum(confs) == pytest.approx(1.0, abs=1e-3)

    def test_breed_id_is_integer_in_range(self, client, b64_sharp):
        r = client.post("/classify/breed", json={"image": b64_sharp})
        body = r.json()
        assert isinstance(body["breed_id"], int)
        assert 0 <= body["breed_id"] < len(breed._BREED_NAMES)


# ---------------- Static data sanity ----------------

class TestBreedData:
    def test_breed_names_and_cn_same_length(self):
        assert len(breed._BREED_NAMES) == len(breed._BREED_CN)

    def test_all_breed_names_have_cn_translation(self):
        """Every breed in _BREED_NAMES should have a non-empty Chinese name."""
        for name in breed._BREED_NAMES:
            assert name in breed._BREED_CN
            assert breed._BREED_CN[name]  # truthy, non-empty

    def test_breed_names_unique(self):
        assert len(breed._BREED_NAMES) == len(set(breed._BREED_NAMES))


# ---------------- Cache key helpers ----------------

class TestProtoCacheKey:
    def test_cache_key_returns_12_char_string(self):
        """Cache key should be a short MD5 prefix for debuggability."""
        key = breed._proto_cache_key()
        assert isinstance(key, str)
        assert len(key) == 12
        assert key.isalnum()

    def test_cache_key_stable_when_inputs_unchanged(self):
        """Same model file + train dir → same key."""
        k1 = breed._proto_cache_key()
        k2 = breed._proto_cache_key()
        assert k1 == k2