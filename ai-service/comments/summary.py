
"""summary.py comment AI summary using keyword + template only."""

from __future__ import annotations
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Tuple

import jieba
import jieba.analyse

from .dict_loader import get_default


STOPWORDS = frozenset({
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "个",
    "上", "也", "到", "说", "要", "去", "你", "会", "着", "没", "看", "好",
    "自己", "这", "那", "里", "把", "被", "他", "她", "它", "们", "什么",
    "怎么", "啊", "呢", "嘛", "吗", "吧", "哦", "呀", "嗯", "哈",
    "今天", "明天", "昨天", "前天", "后天", "刚才", "现在", "以前",
    "这里", "那里", "这个", "那个", "这样", "那样",
    "好像", "应该", "可能", "也许", "觉得", "发现",
})


@dataclass
class OneAnalysis:
    sentiment_scores: Dict[str, float] = field(default_factory=dict)
    primary_sentiment: str = "neutral"
    keywords: List[str] = field(default_factory=list)


@dataclass
class BatchSummary:
    total: int = 0
    sentiment_dist: Dict[str, int] = field(default_factory=dict)
    top_keywords: List[str] = field(default_factory=list)
    auto_summary: str = ""

    def to_openapi(self) -> dict:
        return {
            "total": self.total,
            "sentiment_dist": self.sentiment_dist,
            "top_keywords": self.top_keywords,
            "auto_summary": self.auto_summary,
        }


_SENTIMENT_NAMES = ("care", "seek", "fake", "thanks", "report", "neutral")


def _kw_hits_count(text, words):
    if not text or not words:
        return 0, 0.0
    matched = set()
    try:
        tokens = set(jieba.lcut(text))
    except Exception:
        tokens = set(text)
    for tok in tokens:
        t = tok.strip()
        if t and t in words:
            matched.add(t)
    for w in sorted(words, key=len, reverse=True):
        if len(w) < 3:
            continue
        if w in text:
            matched.add(w)
    cnt = len(matched)
    return cnt, float(cnt)


def analyze_one(content):
    s = (content or "").strip()
    if not s:
        return OneAnalysis(primary_sentiment="neutral")

    loader = get_default()
    scores = {n: 0.0 for n in _SENTIMENT_NAMES}

    for dict_name in ("care_keywords", "seek_keywords", "report_keywords",
                      "thanks_keywords", "fake_keywords"):
        e = loader.get(dict_name)
        cnt, weighted = _kw_hits_count(s, e.entries)
        if cnt:
            sentiment_name = dict_name.replace("_keywords", "")
            scores[sentiment_name] += weighted * e.weight_hint

    if max(scores.values()) == 0.0:
        scores["neutral"] = 1.0

    primary = max(scores.items(), key=lambda kv: kv[1])[0]

    raw_kws = []
    try:
        raw_kws = jieba.analyse.textrank(s, topK=5, withWeight=False)
    except Exception:
        raw_kws = []

    keywords = [w for w in raw_kws
                if w and len(w) >= 2 and w not in STOPWORDS][:5]

    return OneAnalysis(
        sentiment_scores=scores,
        primary_sentiment=primary,
        keywords=keywords,
    )


def analyze_batch(comments):
    items = list(comments)
    total = len(items)
    if total == 0:
        return BatchSummary(total=0, auto_summary="0 条评论")

    sentiment_counter = Counter()
    kw_counter = Counter()

    for it in items:
        text = it if isinstance(it, str) else (it.get("content") if isinstance(it, dict) else "")
        if not text:
            continue
        a = analyze_one(text)
        sentiment_counter[a.primary_sentiment] += 1
        for kw in a.keywords:
            kw_counter[kw] += 1

    top_kws = [kw + "(" + str(n) + ")" for kw, n in kw_counter.most_common(8)]
    dist = dict(sentiment_counter)
    total_f = float(total)
    care_pct = round(dist.get("care", 0) * 100 / total_f)
    seek_pct = round(dist.get("seek", 0) * 100 / total_f)
    thanks_pct = round(dist.get("thanks", 0) * 100 / total_f)
    report_pct = round(dist.get("report", 0) * 100 / total_f)
    fake_pct = round(dist.get("fake", 0) * 100 / total_f)

    parts = ["共 " + str(total) + " 条评论"]
    breakdown = []
    if care_pct:
        breakdown.append("关心 " + str(care_pct) + "%")
    if seek_pct:
        breakdown.append("求助 " + str(seek_pct) + "%")
    if thanks_pct:
        breakdown.append("感谢 " + str(thanks_pct) + "%")
    if report_pct:
        breakdown.append("目击线索 " + str(report_pct) + "%")
    if fake_pct:
        breakdown.append("疑似营销 " + str(fake_pct) + "%")
    if breakdown:
        parts.append(";情感分布:" + ",".join(breakdown))
    if top_kws:
        parts.append(";高频词:" + ",".join(top_kws[:5]))

    auto = "".join(parts)
    return BatchSummary(
        total=total,
        sentiment_dist=dist,
        top_keywords=top_kws,
        auto_summary=auto,
    )