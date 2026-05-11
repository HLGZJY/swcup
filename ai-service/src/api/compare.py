"""Vector comparison endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np

from ..utils.vector import cosine_similarity, l2_distance

router = APIRouter(prefix="/compare", tags=["compare"])


class CompareRequest(BaseModel):
    vector_a: list[float]
    vector_b: list[float]


class CompareResponse(BaseModel):
    cosine_similarity: float
    l2_distance: float


@router.post("/vector", response_model=CompareResponse)
async def compare_vectors(body: CompareRequest):
    """
    Compute similarity between two 128-dim vectors.
    """
    a = np.array(body.vector_a, dtype=np.float32)
    b = np.array(body.vector_b, dtype=np.float32)

    return CompareResponse(
        cosine_similarity=cosine_similarity(a, b),
        l2_distance=l2_distance(a, b),
    )
