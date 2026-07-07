
"""
clue_matcher.py
===============

评论触发"跨模态线索发现"的核心模块(建议 #1)

设计原则
--------
- 不开 DB,所有待审线索落 ``ai-service/comments/clue_state/*.json``
- 单 animal_id 一个文件,便于备份与人工 review
- 后端 POST /v1/comments 接到请求后,先创建评论入库,然后
  调用本模块 ``try_match_comment_to_event()``:
      - 拉该动物最近的 rescue_events (由后端提供,函数不读 DB)
      - 取评论的情感 + 关键词 + reporter_id
      - 满足条件: 命中 report/seek 意图 + reporter 不等于事件 reporter
      - 落一条 ``CommentClueMatch`` 进本地 JSON,**不调用任何推送**

调用约定
--------
::

    from comments.clue_matcher import try_match_comment_to_event

    clue = try_match_comment_to_event(
        comment=dict(comment_id=..., animal_id=..., content=..., reporter_id=...,
                     sentiment=..., keywords=[...], created_at=...),
        recent_events_for_animal=[
            dict(event_id=..., event_type='rescue'|'report', reporter_id=...,
                 occurred_at=..., location_lat=..., location_lng=..., address=...),
            ...
        ],
        state_dir='.../clue_state',
    )
    print(clue.status)   # 'pending' / 'no_match' / 'cooldown' / 'self_match'
"""
from __future__ import annotations
import hashlib
import json
import os
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Optional


# 仅 report/seek 情感的评论才会触发线索匹配
_TRIGGER_SENTIMENTS = frozenset({"report", "seek"})


@dataclass
class CommentClueMatch:
    match_id: str                           # sha256 前 16 hex
    comment_id: str
    animal_id: str
    comment_reporter_id: str
    sentiment: str
    keywords: List[str] = field(default_factory=list)
    created_at: str = ""                    # ISO

    candidate_event_id: str = ""             # 命中的事件
    candidate_event_reporter_id: str = ""   # 事件上报人 → 接收线索者
    candidate_event_address: str = ""       # 事件地址

    match_score: float = 0.0                # 0~1; 简易打分
    match_reasons: List[str] = field(default_factory=list)

    status: str = "pending"                 # pending | confirmed | rejected | no_match
    decided_by: str = ""                    # admin_id
    decided_at: str = ""                    # ISO
    decision_note: str = ""

    state_path: str = ""                    # 写到哪个 JSON 文件


def _match_id(comment_id: str, animal_id: str) -> str:
    return hashlib.sha256(
        (comment_id + "|" + animal_id).encode("utf-8")
    ).hexdigest()[:16]


def _score(comment: dict, event: dict) -> tuple:
    """返回 (score 0~1, reasons list)。只考虑语义与时间相近度,不计算地理。"""
    score = 0.0
    reasons = []

    # 1. 情感加成
    sentiment = comment.get("sentiment", "")
    if sentiment == "report":
        score += 0.5
        reasons.append("sentiment=report:+0.5")
    elif sentiment == "seek":
        score += 0.4
        reasons.append("sentiment=seek:+0.4")

    # 2. 关键词与事件 description/address 字符 overlap (简易)
    kws = set(comment.get("keywords") or [])
    addr = (event.get("address") or "").strip()
    if kws and addr:
        hits = sum(1 for k in kws if k and k in addr)
        if hits > 0:
            score += min(0.3, 0.1 * hits)
            reasons.append("kw_in_addr:{0}:+{1}".format(hits, min(0.3, 0.1 * hits)))

    desc = (event.get("description") or "").strip()
    if kws and desc:
        hits = sum(1 for k in kws if k and k in desc)
        if hits > 0:
            score += min(0.2, 0.05 * hits)
            reasons.append("kw_in_desc:{0}:+{1}".format(hits, min(0.2, 0.05 * hits)))

    # 3. 时间接近 (评论时间 与 事件 occurred_at 越接近越好)
    co = comment.get("created_at")
    eo = event.get("occurred_at")
    try:
        if co and eo:
            t_co = _parse_iso(co)
            t_eo = _parse_iso(eo)
            delta_sec = abs(t_co - t_eo)
            if delta_sec <= 3600 * 24 * 3:  # 3 天内
                bonus = 0.15 * (1 - delta_sec / (3600 * 24 * 7))
                bonus = max(0.0, bonus)
                score += bonus
                reasons.append("time_close:delta_sec={0}:+{1:.3f}".format(
                    int(delta_sec), bonus))
    except Exception:
        pass

    return min(1.0, score), reasons


def _parse_iso(s):
    # 容忍 Z 与不带时区的 ISO 字符串
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    from datetime import datetime
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is not None:
        return dt.timestamp()
    return dt.timestamp()


def try_match_comment_to_event(
    *,
    comment: dict,
    recent_events_for_animal: List[dict],
    state_dir: str,
) -> CommentClueMatch:
    """对单条评论尝试匹配最佳事件候选。

    Args:
        comment: 必备字段 comment_id / animal_id / content / reporter_id / sentiment / keywords / created_at
        recent_events_for_animal: animal_id 对应的近期事件(后端调用方提供)
        state_dir: 落盘目录,通常 ai-service/comments/clue_state/

    Returns:
        CommentClueMatch(status in {pending, no_match, self_match, cooldown})
    """
    animal_id = comment.get("animal_id", "")
    comment_reporter_id = comment.get("reporter_id", "")
    sentiment = comment.get("sentiment", "")

    # 触发条件: 内容太短 / sentiment 不在触发集 → no_match
    content = (comment.get("content") or "").strip()
    if not content or sentiment not in _TRIGGER_SENTIMENTS:
        m = CommentClueMatch(
            match_id=_match_id(comment.get("comment_id", ""), animal_id),
            comment_id=comment.get("comment_id", ""),
            animal_id=animal_id,
            comment_reporter_id=comment_reporter_id,
            sentiment=sentiment,
            status="no_match",
        )
        return m

    # 没事件候选,自然 no_match
    if not recent_events_for_animal:
        m = CommentClueMatch(
            match_id=_match_id(comment.get("comment_id", ""), animal_id),
            comment_id=comment.get("comment_id", ""),
            animal_id=animal_id,
            comment_reporter_id=comment_reporter_id,
            sentiment=sentiment,
            status="no_match",
        )
        return m

    # 给每个 event 打分
    best = None
    best_score = 0.0
    best_reasons: List[str] = []
    for ev in recent_events_for_animal:
        s, rs = _score(comment, ev)
        if s > best_score:
            best = ev
            best_score = s
            best_reasons = rs

    # 阈值: 太低算 no_match
    THRESHOLD = 0.5
    if best is None or best_score < THRESHOLD:
        m = CommentClueMatch(
            match_id=_match_id(comment.get("comment_id", ""), animal_id),
            comment_id=comment.get("comment_id", ""),
            animal_id=animal_id,
            comment_reporter_id=comment_reporter_id,
            sentiment=sentiment,
            status="no_match",
        )
        return m

    # self-match (评论人就是事件 reporter): 跳过
    if best.get("reporter_id") == comment_reporter_id:
        m = CommentClueMatch(
            match_id=_match_id(comment.get("comment_id", ""), animal_id),
            comment_id=comment.get("comment_id", ""),
            animal_id=animal_id,
            comment_reporter_id=comment_reporter_id,
            sentiment=sentiment,
            status="self_match",
        )
        return m

    # 落盘
    os.makedirs(state_dir, exist_ok=True)
    safe_aid = animal_id.replace("/", "_").replace("\\\\", "_")
    state_path = os.path.join(state_dir, safe_aid + ".json")
    state_list = _load_state(state_path)
    state_list.append({
        "match_id": _match_id(comment.get("comment_id", ""), animal_id),
        "comment_id": comment.get("comment_id", ""),
        "animal_id": animal_id,
        "comment_reporter_id": comment_reporter_id,
        "sentiment": sentiment,
        "keywords": comment.get("keywords") or [],
        "created_at": comment.get("created_at", ""),
        "candidate_event_id": best.get("event_id", ""),
        "candidate_event_reporter_id": best.get("reporter_id", ""),
        "candidate_event_address": best.get("address", ""),
        "match_score": round(best_score, 4),
        "match_reasons": best_reasons,
        "status": "pending",
        "recorded_at": _now_iso(),
    })
    _save_state(state_path, state_list)

    return CommentClueMatch(
        match_id=_match_id(comment.get("comment_id", ""), animal_id),
        comment_id=comment.get("comment_id", ""),
        animal_id=animal_id,
        comment_reporter_id=comment_reporter_id,
        sentiment=sentiment,
        keywords=list(comment.get("keywords") or []),
        created_at=comment.get("created_at", ""),
        candidate_event_id=best.get("event_id", ""),
        candidate_event_reporter_id=best.get("reporter_id", ""),
        candidate_event_address=best.get("address", ""),
        match_score=round(best_score, 4),
        match_reasons=best_reasons,
        status="pending",
        state_path=state_path,
    )


def _now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _load_state(path: str) -> List[dict]:
    if not os.path.exists(path):
        return []
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh) or []
    except Exception:
        return []


def _save_state(path: str, data: List[dict]) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def list_pending_clues(state_dir: str) -> Dict[str, List[dict]]:
    """给 admin-web 读:返回 {animal_id: [clue, ...]} pending 状态的清单。"""
    out: Dict[str, List[dict]] = {}
    if not os.path.isdir(state_dir):
        return out
    for name in sorted(os.listdir(state_dir)):
        if not name.endswith(".json"):
            continue
        p = os.path.join(state_dir, name)
        recs = _load_state(p)
        pending = [r for r in recs if r.get("status") == "pending"]
        if pending:
            out[name[:-5]] = pending
    return out