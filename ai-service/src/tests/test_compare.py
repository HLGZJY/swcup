"""API tests for /compare/vector endpoint."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from src.api.compare import router


pytestmark = pytest.mark.api


@pytest.fixture
def client():
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


class TestCompareEndpoint:
    def test_identical_vectors_return_cosine_one(self, client):
        v = [0.1] * 512
        r = client.post("/compare/vector", json={"vector_a": v, "vector_b": v})
        assert r.status_code == 200
        body = r.json()
        assert body["cosine_similarity"] == pytest.approx(1.0, abs=1e-5)
        assert body["l2_distance"] == pytest.approx(0.0, abs=1e-5)

    def test_orthogonal_vectors_return_zero(self, client):
        a = [1.0] + [0.0] * 511
        b = [0.0, 1.0] + [0.0] * 510
        r = client.post("/compare/vector", json={"vector_a": a, "vector_b": b})
        assert r.status_code == 200
        body = r.json()
        assert body["cosine_similarity"] == pytest.approx(0.0, abs=1e-5)

    def test_empty_vector_a_returns_400(self, client):
        r = client.post("/compare/vector", json={"vector_a": [], "vector_b": [0.1] * 512})
        assert r.status_code == 400
        assert "empty" in r.json()["detail"].lower()

    def test_empty_vector_b_returns_400(self, client):
        r = client.post("/compare/vector", json={"vector_a": [0.1] * 512, "vector_b": []})
        assert r.status_code == 400

    def test_known_vectors_match_numpy(self, client):
        """Endpoint result should match raw numpy computation."""
        rng = np.random.default_rng(99)
        a = rng.standard_normal(64).tolist()
        b = rng.standard_normal(64).tolist()
        r = client.post("/compare/vector", json={"vector_a": a, "vector_b": b})
        assert r.status_code == 200
        body = r.json()
        a_np, b_np = np.array(a), np.array(b)
        expected_cos = float(np.dot(a_np, b_np) / (np.linalg.norm(a_np) * np.linalg.norm(b_np)))
        expected_l2 = float(np.linalg.norm(a_np - b_np))
        assert body["cosine_similarity"] == pytest.approx(expected_cos, abs=1e-5)
        assert body["l2_distance"] == pytest.approx(expected_l2, abs=1e-5)