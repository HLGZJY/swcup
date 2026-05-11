"""
POST /extract/feature — 特征提取端点
输入：base64 图片
输出：128 维向量（list[float]）
使用 MobileNetV2 预训练权重（无训练权重时直接输出特征）
"""
from fastapi import APIRouter
from pydantic import BaseModel
import torch

from models.mobilenet import get_model
from utils.image import load_image_from_base64, pil_to_tensor

router = APIRouter()

# 加载预训练 MobileNetV2（全局单例）
model = get_model(pretrained=True)
model.eval()


class ExtractRequest(BaseModel):
    image: str  # base64 编码的图片字符串


class ExtractResponse(BaseModel):
    vector: list[float]  # 128 维归一化向量
    shape: list[int]     # (128,)


@router.post("/feature", response_model=ExtractResponse)
async def extract_feature(req: ExtractRequest):
    image = load_image_from_base64(req.image)
    tensor = pil_to_tensor(image)  # (1, 3, 224, 224)

    with torch.no_grad():
        vector = model(tensor)  # (1, 128)

    vector_list = vector.squeeze(0).tolist()
    return ExtractResponse(vector=vector_list, shape=[128])
