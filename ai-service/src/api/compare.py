"""
POST /compare — 向量比对端点
输入：两个 128 维向量（或一个查询向量 + 一个候选向量列表）
输出：余弦相似度

注：融合打分在后端 Node.js 做，AI 服务只负责向量比对
"""
from fastapi import APIRouter
from pydantic import BaseModel
from utils.vector import cosine_similarity

router = APIRouter()


class CompareRequest(BaseModel):
    vector_a: list[float]  # 128 维向量
    vector_b: list[float]   # 128 维向量


class CompareResponse(BaseModel):
    similarity: float  # -1.0 ~ 1.0，余弦相似度
    distance: float   # 0.0 ~ 2.0，余弦距离


@router.post("", response_model=CompareResponse)
async def compare_vectors(req: CompareRequest):
    sim = cosine_similarity(req.vector_a, req.vector_b)
    dist = 1.0 - sim
    return CompareResponse(similarity=sim, distance=dist)
