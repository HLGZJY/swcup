"""Shared pytest fixtures for ai-service tests.

All test images are generated programmatically (PIL/numpy) so tests are
self-contained and reproducible without external assets.
"""

import io
import base64
import pytest
import numpy as np
from PIL import Image, ImageFilter


# -------- Image factories (no external dependencies) --------

@pytest.fixture
def sharp_bright_image():
    """A sharp, well-lit 224x224 image (passes liveness)."""
    arr = np.random.randint(80, 180, (224, 224, 3), dtype=np.uint8)
    return Image.fromarray(arr, mode="RGB")


@pytest.fixture
def blurry_image():
    """A heavily blurred 224x224 image (fails blur threshold)."""
    arr = np.random.randint(80, 180, (224, 224, 3), dtype=np.uint8)
    img = Image.fromarray(arr, mode="RGB")
    return img.filter(ImageFilter.GaussianBlur(radius=10))


@pytest.fixture
def dark_image(sharp_bright_image):
    """A dark version of the sharp image — preserves edges, low brightness."""
    return sharp_bright_image.point(lambda p: int(p * 0.1))


@pytest.fixture
def bright_image(sharp_bright_image):
    """An overexposed version of the sharp image — preserves edges, high brightness."""
    return sharp_bright_image.point(lambda p: min(255, int(p * 1.6) + 60))


@pytest.fixture
def b64_sharp(sharp_bright_image):
    """Base64-encoded sharp image (with data URI prefix)."""
    buf = io.BytesIO()
    sharp_bright_image.save(buf, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


@pytest.fixture
def b64_blurry(blurry_image):
    """Base64-encoded blurry image."""
    buf = io.BytesIO()
    blurry_image.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture
def b64_invalid():
    """Invalid base64 string (not an image)."""
    return base64.b64encode(b"not an image at all").decode()


# -------- Mock models (no real weights required) --------

class _FakeNoseModel:
    """Deterministic stand-in for ResNet50_512d.

    Returns a fixed 512-dim vector regardless of input shape.
    """
    def __call__(self, tensor):
        import torch
        batch = tensor.shape[0]
        out = torch.zeros(batch, 512)
        out[:, 0] = 1.0  # unit-ish vector for cosine=1 self-similarity
        return out

    def eval(self):
        return self


class _FakeBreedModel:
    """Deterministic stand-in for the breed classifier model."""
    def __call__(self, tensor):
        import torch
        batch = tensor.shape[0]
        out = torch.zeros(batch, 512)
        out[:, 0] = 1.0
        return out

    def eval(self):
        return self


@pytest.fixture
def fake_nose_model():
    return _FakeNoseModel()


@pytest.fixture
def fake_breed_model():
    return _FakeBreedModel()