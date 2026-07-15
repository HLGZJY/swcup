"""
comments/__init__.py
è¯„è®ºå®¡æ ¸ AI æœåŠ¡æ¨¡å—
"""

from fastapi import APIRouter
from .moderate import moderate
from .summary import analyze_batch as summarize
from .clue_matcher import try_match_comment_to_event
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# ============ Request/Response Models ============

class ModerateRequest(BaseModel):
    content: str
    reporter_id: str
    recent_violations_count: int = 0


class ModerateResponse(BaseModel):
    verdict: str
    suggested_action: str
    reasons: List[str]
    features: Dict[str, int]


class SummaryRequest(BaseModel):
    animal_id: str
    comments: List[Dict[str, Any]]


class SummaryResponse(BaseModel):
    total: int
    sentiment_dist: Dict[str, int]
    top_keywords: List[str]
    auto_summary: str


# ============ Router ============

router = APIRouter(prefix="/api/comments", tags=["è¯„è®ºå®¡æ ¸"])


@router.post("/moderate", response_model=ModerateResponse)
async def moderate_endpoint(req: ModerateRequest):
    """L0~L4 è¯„è®ºå®¡æ ¸ï¼ˆä¸è°ƒç”¨ LLMï¼‰"""
    result = moderate(
        content=req.content,
        reporter_id=req.reporter_id,
        recent_violations_count=req.recent_violations_count,
    )
    return result.to_dict()


@router.post("/summary", response_model=SummaryResponse)
async def summary_endpoint(req: SummaryRequest):
    """è¯„è®º AI æ‘˜è¦"""
    result = summarize(req.comments)
    return result.to_openapi()


# å¯¼å‡º
__all__ = [
    "router",
    "moderate",
    "summarize",
    "try_match_comment_to_event",
]