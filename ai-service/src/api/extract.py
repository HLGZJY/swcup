"""Feature extraction endpoint."""

import torch
from PIL import Image
from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np

from ..models.mobilenet import ResNet50_512d
from ..utils.image import base64_to_image, image_to_tensor

router = APIRouter(prefix="/extract", tags=["extract"])

import torch
import asyncio
from fastapi import FastAPI
from contextlib import asynccontextmanager

# Pre-load model at startup (runs in startup event, not in request handler)
_model = None


def _load_nose_model():  # pragma: no cover
    global _model
    model = ResNet50_512d(embedding_dim=512, pretrained=False)
    state_dict = torch.load("weights/nose_v3_sgd.pth", map_location="cpu", weights_only=False)
    if isinstance(state_dict, dict) and "state_dict" in state_dict:
        state_dict = state_dict["state_dict"]
    model.load_state_dict(state_dict, strict=False)
    model.eval()
    _model = model
    print("[extract] Nose model loaded OK")


def get_model():
    global _model
    return _model


@asynccontextmanager
async def lifespan(app: FastAPI):  # pragma: no cover
    # Run blocking model loading in thread pool so it doesn't block the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _load_nose_model)
    yield


class ExtractRequest(BaseModel):
    image: str  # base64 encoded image


class ExtractResponse(BaseModel):
    vector: list[float]  # 512-dim
    embedding_dim: int


@router.post("/feature", response_model=ExtractResponse)
async def extract_feature_endpoint(body: ExtractRequest):
    """
    Extract 512-dim feature vector from a base64 image.
    Uses ResNet50_512d fine-tuned on nose print data.
    """
    img = base64_to_image(body.image)
    tensor = image_to_tensor(img).unsqueeze(0)  # (1, 3, 224, 224)

    model = get_model()
    vector = model(tensor).detach().squeeze().cpu().numpy().flatten()

    return ExtractResponse(
        vector=vector.tolist(),
        embedding_dim=512,
    )
