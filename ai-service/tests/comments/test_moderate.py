# -*- coding: utf-8 -*-
"""moderate.py test - explicit utf-8 line 1."""
from comments.moderate import moderate
import pytest


@pytest.mark.parametrize("text,expect", [
    ("正常的关心评论", "allow"),
    ("我去打死它", "hide"),
    ("加我微信领养哦 vx123abc", "review"),
    ("今天天气不错", "allow"),
    ("点击 https://t.com 优惠", "review"),
    ("13800138000 联系我", "review"),
    ("123456", "allow"),
    ("1234567", "review"),
    ("", "hide"),
    ("x" * 600, "hide"),
])
def test_moderate_basic(text, expect):
    r = moderate(text)
    assert r.verdict == expect, repr(text) + " should " + expect + " got " + r.verdict + " (" + str(r.reasons) + ")"


def test_too_long_text_hidden():
    r = moderate("x" * 501)
    assert r.verdict == "hide"
    assert any("too_long" in s for s in r.reasons)


def test_emoji_only_needs_review():
    r = moderate("\U0001F436\U0001F431\U0001F430")
    assert r.verdict == "review"
    assert any("emoji_only" in s for s in r.reasons)


def test_repeat_offender_l4():
    r = moderate("你好", reporter_id="u_x", recent_violations_count=4)
    assert r.verdict == "hide"
    assert any("L4:" in s for s in r.reasons)


def test_recent_violations_count_under_threshold_allow():
    r = moderate("你好", reporter_id="u_x", recent_violations_count=2)
    assert r.verdict == "allow"


def test_short_text_with_url_needs_review():
    r = moderate("https://t.com")
    assert any("url" in s for s in r.reasons)