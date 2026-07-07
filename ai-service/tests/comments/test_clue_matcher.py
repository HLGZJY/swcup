
"""
test_clue_matcher
===================
è·¨æ¨¡æ€çº¿ç´¢åŒ¹é…å›žå½’æµ‹è¯•
"""
import json
import os

import pytest

from comments.clue_matcher import (
    _match_id,
    list_pending_clues,
    try_match_comment_to_event,
)


@pytest.fixture
def tmp_state(tmp_path):
    return str(tmp_path / "state")


def _ev(eid="e001", reporter="u_owner", addr="åŒ—äº¬å¸‚æœé˜³åŒºå»ºå¤–SOHO", desc="æ¡åˆ°èµ°å¤±ç‹—",
        occurred="2026-07-05T08:00:00Z", evtype="report"):
    return dict(
        event_id=eid, event_type=evtype, reporter_id=reporter,
        occurred_at=occurred,
        location_lat=39.9042, location_lng=116.4074,
        address=addr, description=desc,
    )


def test_match_id_is_deterministic():
    a = _match_id("c1", "a1")
    b = _match_id("c1", "a1")
    assert a == b
    assert len(a) == 16


def test_neutral_sentiment_doesnt_trigger(tmp_state):
    res = try_match_comment_to_event(
        comment=dict(comment_id="c1", animal_id="a1",
                     content="ä»Šå¤©å¤©æ°”ä¸é”™", reporter_id="u_x",
                     sentiment="neutral", keywords=[],
                     created_at="2026-07-06T10:00:00Z"),
        recent_events_for_animal=[_ev()],
        state_dir=tmp_state,
    )
    assert res.status == "no_match"


def test_empty_event_list_returns_no_match(tmp_state):
    res = try_match_comment_to_event(
        comment=dict(comment_id="c1", animal_id="a1",
                     content="æˆ‘åˆšåœ¨æœé˜³çœ‹åˆ°ä¸€åª", reporter_id="u_x",
                     sentiment="report", keywords=[],
                     created_at="2026-07-06T10:00:00Z"),
        recent_events_for_animal=[],
        state_dir=tmp_state,
    )
    assert res.status == "no_match"


def test_self_match_returns_self_match_status(tmp_state):
    res = try_match_comment_to_event(
        comment=dict(comment_id="c1", animal_id="a1",
                     content="æˆ‘åˆšåœ¨æœé˜³çœ‹åˆ°ä¸€åª", reporter_id="u_owner",
                     sentiment="report", keywords=[],
                     created_at="2026-07-06T10:00:00Z"),
        recent_events_for_animal=[_ev(reporter="u_owner")],
        state_dir=tmp_state,
    )
    assert res.status == "self_match"


def test_strong_match_returns_pending_and_dumps_file(tmp_state):
    res = try_match_comment_to_event(
        comment=dict(comment_id="c1", animal_id="a1",
                     content="æˆ‘åˆšåœ¨æœé˜³çœ‹åˆ°ä¸€åª", reporter_id="u_x",
                     sentiment="report", keywords=["æœé˜³"],
                     created_at="2026-07-05T10:00:00Z"),
        recent_events_for_animal=[_ev()],
        state_dir=tmp_state,
    )
    assert res.status == "pending"
    assert os.path.isfile(res.state_path)
    on_disk = json.load(open(res.state_path, encoding="utf-8"))
    assert any(r["status"] == "pending" for r in on_disk)


def test_list_pending_clues(tmp_state):
    try_match_comment_to_event(
        comment=dict(comment_id="c1", animal_id="a1",
                     content="åˆšåœ¨æœé˜³çœ‹åˆ°", reporter_id="u_x",
                     sentiment="report", keywords=["æœé˜³"],
                     created_at="2026-07-05T10:00:00Z"),
        recent_events_for_animal=[_ev()],
        state_dir=tmp_state,
    )
    pending = list_pending_clues(tmp_state)
    assert "a1" in pending
    assert len(pending["a1"]) == 1


def test_strong_match_with_keywords_overlap(tmp_state):
    res = try_match_comment_to_event(
        comment=dict(comment_id="c1", animal_id="a1",
                     content="æˆ‘åˆšåœ¨æœé˜³å…¬å›­çœ‹åˆ°ä¸€åªå¾ˆåƒçš„",
                     reporter_id="u_x",
                     sentiment="report", keywords=["æœé˜³", "å…¬å›­", "çœ‹åˆ°"],
                     created_at="2026-07-05T10:00:00Z"),
        recent_events_for_animal=[_ev()],
        state_dir=tmp_state,
    )
    assert res.status == "pending"
    assert res.match_score >= 0.5