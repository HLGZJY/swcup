"""
POST /detect/liveness — 图片质量检测（简化版活体检测）
输入：base64 图片
输出：{quality, score}
"""
from fastapi import APIRouter
from pydantic import BaseModel
from utils.image import load_image_from_base64, check_image_quality

router = APIRouter()


class LivenessRequest(BaseModel):
    image: str  # base64 编码的图片字符串


class LivenessResponse(BaseModel):
    quality: str  # "ok" / "low" / "poor"
    score: float  # 0.0 ~ 1.0


@router.post("/liveness", response_model=LivenessResponse)
async def liveness_check(req: LivenessRequest):
    image = load_image_from_base64(req.image)
    quality, score = check_image_quality(image)
    return LivenessResponse(quality=quality, score=score)
