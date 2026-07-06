"""API tests for /detect/liveness endpoint."""

import pytest
from fastapi.testclient import TestClient

from src.api.detect import router


pytestmark = pytest.mark.api


@pytest.fixture
def client():
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


class TestLivenessEndpoint:
    def test_sharp_bright_image_passes(self, client, b64_sharp):
        """A normal-quality image should pass liveness."""
        r = client.post("/detect/liveness", json={"image": b64_sharp})
        assert r.status_code == 200
        body = r.json()
        assert body["liveness_pass"] is True
        assert body["reason"] == "Image quality OK"
        assert body["blur_score"] > 0
        assert body["brightness"] > 0

    def test_blurry_image_rejected(self, client, b64_blurry):
        r = client.post("/detect/liveness", json={"image": b64_blurry})
        assert r.status_code == 200
        body = r.json()
        assert body["liveness_pass"] is False
        assert "blurry" in body["reason"].lower()
        assert body["blur_score"] < 50.0

    def test_dark_image_rejected(self, client, dark_image):
        """A dark image should fail liveness (either on blur or brightness).

        We only assert rejection — reason text is informational and may vary
        depending on which quality check triggers first.
        """
        import io, base64
        buf = io.BytesIO()
        dark_image.save(buf, format="JPEG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        r = client.post("/detect/liveness", json={"image": b64})
        assert r.status_code == 200
        body = r.json()
        assert body["liveness_pass"] is False
        assert body["reason"]  # non-empty explanation
        assert body["brightness"] < 50.0  # brightness IS low, regardless of which check fired

    def test_overexposed_image_rejected(self, client, bright_image):
        """An overexposed image should fail liveness on brightness maximum."""
        import io, base64
        buf = io.BytesIO()
        bright_image.save(buf, format="JPEG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        r = client.post("/detect/liveness", json={"image": b64})
        assert r.status_code == 200
        body = r.json()
        assert body["liveness_pass"] is False
        assert "brightness" in body["reason"].lower()
        assert body["brightness"] > 220.0

    def test_invalid_image_returns_pass_false_no_crash(self, client, b64_invalid):
        """Non-image bytes should return liveness_pass=False, not 500."""
        r = client.post("/detect/liveness", json={"image": b64_invalid})
        assert r.status_code == 200
        body = r.json()
        assert body["liveness_pass"] is False
        assert "invalid" in body["reason"].lower()