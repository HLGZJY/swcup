
"""summary tests with explicit UTF-8 encoding."""
# -*- coding: utf-8 -*-
from comments.summary import analyze_one, analyze_batch


def test_analyze_one_no_match_stays_neutral():
    a = analyze_one("今天天气真不错")
    assert a.primary_sentiment == "neutral"


def test_analyze_one_care():
    a = analyze_one("可怜的小家伙,希望它平安回家")
    assert a.primary_sentiment == "care"


def test_analyze_one_seek():
    a = analyze_one("求主人联系,求扩散")
    assert a.primary_sentiment == "seek"


def test_analyze_one_fake():
    a = analyze_one("加微信 vx12345 免费送")
    assert a.primary_sentiment == "fake"


def test_analyze_one_thanks():
    a = analyze_one("找到了!太感谢大家了")
    assert a.primary_sentiment == "thanks"


def test_analyze_one_report():
    a = analyze_one("我刚在朝阳公园看到一只很像的狗")
    assert a.primary_sentiment == "report"


def test_analyze_batch_returns_openapi_shape():
    res = analyze_batch([
        "希望你平安回家",
        "我刚在朝阳公园看到一只很像",
        "加微信 vx12345 免费送",
        "找到了!太感谢",
    ])
    api = res.to_openapi()
    assert set(api.keys()) == {"total", "sentiment_dist", "top_keywords", "auto_summary"}
    assert api["total"] == 4
    assert "care" in api["sentiment_dist"]


def test_analyze_batch_empty():
    res = analyze_batch([])
    assert res.total == 0
    assert res.auto_summary == "0 条评论"


def test_analyze_batch_with_object_items():
    res = analyze_batch([
        {"content": "求帮忙转发"},
        {"content": "我刚看到,也在附近看到", "created_at": "2026-07-06"},
    ])
    assert res.total == 2


def test_auto_summary_includes_distribution():
    res = analyze_batch([
        "希望你平安",
        "希望你平安",
        "加微信 vx123 免费送",
    ])
    assert "关心" in res.auto_summary or "求助" in res.auto_summary