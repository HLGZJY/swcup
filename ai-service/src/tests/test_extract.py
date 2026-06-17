"""API tests for /extract/feature endpoint — uses a mock model (no real weights)."""

import pytest
from fastapi.testclient import TestClient

from src.api import extract


pytestmark = pytest.mark.api


@pytest.fixture
def client(monkeypatch, fake_nose_model):
    """Replace the global model with a deterministic fake."""
    monkeypatch.setattr(extract, "_model", fake_nose_model)
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(extract.router)
    return TestClient(app)


class TestExtractEndpoint:
    def test_returns_512_dim_vector(self, client, b64_sharp):
        r = client.post("/extract/feature", json={"image": b64_sharp})
        assert r.status_code == 200
        body = r.json()
        assert body["embedding_dim"] == 512
        assert len(body["vector"]) == 512

    def test_vector_values_are_floats(self, client, b64_sharp):
        r = client.post("/extract/feature", json={"image": b64_sharp})
        assert r.status_code == 200
        body = r.json()
        assert all(isinstance(x, float) for x in body["vector"])

    def test_deterministic_for_same_image(self, client, b64_sharp):
        """Same image + fake model → same vector."""
        r1 = client.post("/extract/feature", json={"image": b64_sharp})
        r2 = client.post("/extract/feature", json={"image": b64_sharp})
        assert r1.json()["vector"] == r2.json()["vector"]

    def test_get_model_returns_current_global(self):
        """get_model() should return whatever is in extract._model."""
        class Dummy:
            pass
        extract._model = Dummy()
        assert extract.get_model() is extract._model