"""Unit tests for src/utils/image.py — image preprocessing & quality metrics."""

import io
import base64
import numpy as np
import pytest
from PIL import Image

from src.utils.image import (
    base64_to_image,
    image_to_tensor,
    pil_to_cv2,
    cv2_to_pil,
    calculate_blur_score,
    calculate_brightness,
)


pytestmark = pytest.mark.unit


# ---------------- base64_to_image ----------------

class TestBase64ToImage:
    def test_plain_base64(self, sharp_bright_image):
        buf = io.BytesIO()
        sharp_bright_image.save(buf, format="JPEG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        img = base64_to_image(b64)
        assert isinstance(img, Image.Image)
        assert img.size == (224, 224)
        assert img.mode == "RGB"

    def test_data_uri_prefix_stripped(self, sharp_bright_image):
        buf = io.BytesIO()
        sharp_bright_image.save(buf, format="JPEG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        prefixed = f"data:image/jpeg;base64,{b64}"
        img = base64_to_image(prefixed)
        assert img.size == (224, 224)

    def test_invalid_base64_raises(self):
        """Non-image base64 should bubble up the decode error."""
        with pytest.raises(Exception):
            base64_to_image(base64.b64encode(b"not an image").decode())


# ---------------- image_to_tensor ----------------

class TestImageToTensor:
    def test_output_shape_is_chw_3_256_256(self, sharp_bright_image):
        """image.py transform is Resize((256, 256)) before ToTensor."""
        import torch
        t = image_to_tensor(sharp_bright_image)
        assert isinstance(t, torch.Tensor)
        assert t.shape == (3, 256, 256)

    def test_normalized_values_in_typical_range(self, sharp_bright_image):
        """After ImageNet normalization, values should be roughly in [-2.5, 2.5]."""
        t = image_to_tensor(sharp_bright_image)
        assert t.min() >= -3.0
        assert t.max() <= 3.0

    def test_different_input_size_resized(self):
        """A 100x50 image should be resized to 256x256 by the transform."""
        img = Image.new("RGB", (100, 50), color=(128, 128, 128))
        t = image_to_tensor(img)
        assert t.shape == (3, 256, 256)  # transform Resize((256, 256))


# ---------------- pil_to_cv2 / cv2_to_pil ----------------

class TestColorConversion:
    def test_pil_to_cv2_shape_and_channels(self, sharp_bright_image):
        arr = pil_to_cv2(sharp_bright_image)
        assert arr.shape == (224, 224, 3)
        assert arr.dtype == np.uint8

    def test_round_trip_preserves_shape(self, sharp_bright_image):
        """pil → cv2 → pil should preserve dimensions and mode."""
        arr = pil_to_cv2(sharp_bright_image)
        img = cv2_to_pil(arr)
        assert img.size == sharp_bright_image.size
        assert img.mode == "RGB"


# ---------------- calculate_blur_score ----------------

class TestCalculateBlurScore:
    def test_sharp_image_high_score(self, sharp_bright_image):
        """Sharp image with high-frequency content should score > 50."""
        score = calculate_blur_score(sharp_bright_image)
        assert score > 50.0

    def test_blurry_image_low_score(self, blurry_image):
        """Heavily blurred image should score < 50 (liveness threshold)."""
        score = calculate_blur_score(blurry_image)
        assert score < 50.0

    def test_returns_float(self, sharp_bright_image):
        score = calculate_blur_score(sharp_bright_image)
        assert isinstance(score, float)


# ---------------- calculate_brightness ----------------

class TestCalculateBrightness:
    def test_bright_image_high(self, bright_image):
        """Near-white image should be > 220."""
        b = calculate_brightness(bright_image)
        assert b > 220.0

    def test_dark_image_low(self, dark_image):
        """Near-black image should be < 30."""
        b = calculate_brightness(dark_image)
        assert b < 30.0

    def test_midrange_image_in_range(self, sharp_bright_image):
        """Random mid-tones should land in (30, 220)."""
        b = calculate_brightness(sharp_bright_image)
        assert 30.0 < b < 220.0

    def test_returns_float(self, sharp_bright_image):
        b = calculate_brightness(sharp_bright_image)
        assert isinstance(b, float)