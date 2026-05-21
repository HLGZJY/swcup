"""Feature extraction endpoint."""

import torch
from PIL import Image
from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np

from ..models.mobilenet import load_model, extract_feature
from ..utils.image import base64_to_image, image_to_tensor

router = APIRouter(prefix="/extract", tags=["extract"])

# Global model (lazy load on first request)
_model = None


def get_model():
    global _model
    if _model is None:
        _model = load_model(weights_path="weights/stage1_oxford.pth", embedding_dim=512)
    return _model


class ExtractRequest(BaseModel):
    image: str  # base64 encoded image


class ExtractResponse(BaseModel):
    vector: list[float]  # 512-dim
    embedding_dim: int


@router.post("/feature", response_model=ExtractResponse)
async def extract_feature_endpoint(body: ExtractRequest):
    """
    Extract 512-dim feature vector from a base64 image.
    Uses MobileNetV2 pretrained on ImageNet (no fine-tuning yet).
    """
    img = base64_to_image(body.image)
    tensor = image_to_tensor(img).unsqueeze(0)  # (1, 3, 224, 224)

    model = get_model()
    vector = extract_feature(model, tensor)  # (512,)

    return ExtractResponse(
        vector=vector.tolist(),
        embedding_dim=512,
    )
