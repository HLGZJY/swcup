"""Liveness detection endpoint."""

from PIL import Image
from fastapi import APIRouter
from pydantic import BaseModel

from ..utils.image import base64_to_image, calculate_blur_score, calculate_brightness

router = APIRouter(prefix="/detect", tags=["detect"])


class LivenessRequest(BaseModel):
    image: str  # base64 encoded image


class LivenessResponse(BaseModel):
    liveness_pass: bool
    reason: str
    blur_score: float
    brightness: float


@router.post("/liveness", response_model=LivenessResponse)
async def liveness_check(body: LivenessRequest):
    """
    Simplified liveness check: image quality assessment.
    Checks blur and brightness to filter out low-quality captures.
    """
    try:
        img = base64_to_image(body.image)
    except Exception as e:
        return LivenessResponse(
            liveness_pass=False,
            reason=f"Invalid image: {e}",
            blur_score=0.0,
            brightness=0.0,
        )

    blur = calculate_blur_score(img)
    brightness = calculate_brightness(img)

    # Thresholds (tune later with real data)
    BLUR_THRESHOLD = 50.0
    BRIGHTNESS_MIN = 30.0
    BRIGHTNESS_MAX = 220.0

    if blur < BLUR_THRESHOLD:
        return LivenessResponse(
            liveness_pass=False,
            reason=f"Image too blurry (blur={blur:.1f}, threshold={BLUR_THRESHOLD})",
            blur_score=blur,
            brightness=brightness,
        )
    if brightness < BRIGHTNESS_MIN or brightness > BRIGHTNESS_MAX:
        return LivenessResponse(
            liveness_pass=False,
            reason=f"Bad brightness (brightness={brightness:.1f}, range=[{BRIGHTNESS_MIN},{BRIGHTNESS_MAX}])",
            blur_score=blur,
            brightness=brightness,
        )

    return LivenessResponse(
        liveness_pass=True,
        reason="Image quality OK",
        blur_score=blur,
        brightness=brightness,
    )
