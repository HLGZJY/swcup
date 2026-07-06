"""Unit tests for src/utils/vector.py — pure functions, no fixtures needed."""

import math
import numpy as np
import pytest

from src.utils.vector import cosine_similarity, l2_distance


pytestmark = pytest.mark.unit


# ---------------- cosine_similarity ----------------

class TestCosineSimilarity:
    def test_identical_unit_vectors_returns_one(self):
        v = np.array([1.0, 0.0, 0.0])
        assert cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors_returns_zero(self):
        a = np.array([1.0, 0.0, 0.0])
        b = np.array([0.0, 1.0, 0.0])
        assert cosine_similarity(a, b) == pytest.approx(0.0)

    def test_opposite_vectors_returns_minus_one(self):
        a = np.array([1.0, 0.0, 0.0])
        b = np.array([-1.0, 0.0, 0.0])
        assert cosine_similarity(a, b) == pytest.approx(-1.0)

    def test_zero_vector_returns_zero(self):
        """Zero-norm vector is treated as invalid — should return 0, not NaN."""
        a = np.zeros(3)
        b = np.array([1.0, 2.0, 3.0])
        result = cosine_similarity(a, b)
        assert result == 0.0
        assert not math.isnan(result)

    def test_scale_invariance(self):
        """cos(a, b) == cos(k*a, b) for any k>0."""
        a = np.array([0.3, 0.4, 0.5])
        b = np.array([0.1, 0.2, 0.3])
        assert cosine_similarity(a, b) == pytest.approx(
            cosine_similarity(a * 100, b)
        )

    def test_2d_arrays_are_flattened(self):
        """cosine_similarity should work on 2D arrays (image feature maps)."""
        a = np.array([[1.0, 0.0], [0.0, 0.0]])
        b = np.array([[1.0, 0.0], [0.0, 0.0]])
        assert cosine_similarity(a, b) == pytest.approx(1.0)

    def test_512_dim_realistic(self):
        """Sanity check on 512-dim random unit vectors."""
        rng = np.random.default_rng(42)
        a = rng.standard_normal(512)
        b = rng.standard_normal(512)
        a /= np.linalg.norm(a)
        b /= np.linalg.norm(b)
        sim = cosine_similarity(a, b)
        assert -1.0 <= sim <= 1.0


# ---------------- l2_distance ----------------

class TestL2Distance:
    def test_identical_vectors_returns_zero(self):
        v = np.array([1.0, 2.0, 3.0])
        assert l2_distance(v, v) == 0.0

    def test_known_3_4_5_triangle(self):
        a = np.array([0.0, 0.0])
        b = np.array([3.0, 4.0])
        assert l2_distance(a, b) == pytest.approx(5.0)

    def test_symmetric(self):
        rng = np.random.default_rng(7)
        a = rng.standard_normal(64)
        b = rng.standard_normal(64)
        assert l2_distance(a, b) == pytest.approx(l2_distance(b, a))

    def test_non_negative(self):
        rng = np.random.default_rng(11)
        a = rng.standard_normal(32)
        b = rng.standard_normal(32)
        assert l2_distance(a, b) >= 0.0