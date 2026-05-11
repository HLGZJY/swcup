"""Vector similarity computation."""

import numpy as np
from numpy.linalg import norm


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors. Range: [-1, 1]."""
    a = a.flatten()
    b = b.flatten()
    if norm(a) == 0 or norm(b) == 0:
        return 0.0
    return float(np.dot(a, b) / (norm(a) * norm(b)))


def l2_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Compute L2 (Euclidean) distance between two vectors."""
    return float(norm(a.flatten() - b.flatten()))
