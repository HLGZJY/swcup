
"""
test_dict_loader
================
è¯å…¸åŠ è½½å™¨å›žå½’æµ‹è¯•
- 6 ä¸ªè¯å…¸éƒ½èƒ½åŠ è½½
- åŠ è¯ä¸åŠ¨ä»£ç  (æ”¹ JSON åŽ force_reload åº”å¯è§)
"""
import json
import os
from pathlib import Path

import pytest

from comments.dict_loader import DictLoader, get_default


DICTS_DIR = str(Path(__file__).resolve().parents[2] / "data" / "dicts")


def test_default_loader_loads_all_6_dicts():
    loader = DictLoader(DICTS_DIR)
    names = loader.names()
    expected = {"care_keywords", "seek_keywords", "report_keywords",
                "thanks_keywords", "fake_keywords", "badwords"}
    assert expected.issubset(set(names)), "missing dicts: " + str(expected - set(names))


def test_each_dict_has_minimum_entries():
    loader = DictLoader(DICTS_DIR)
    for n in loader.names():
        e = loader.get(n)
        assert len(e.entries) >= 15, n + " has too few entries: " + str(len(e.entries))


def test_weight_hint_is_positive():
    loader = DictLoader(DICTS_DIR)
    for n in loader.names():
        assert loader.get(n).weight_hint > 0


def test_force_reload_picks_up_json_changes(tmp_path):
    test_dir = tmp_path / "dicts"
    test_dir.mkdir()
    sample = test_dir / "test_dict.json"
    sample.write_text(json.dumps({
        "version": "2026-07-06",
        "description": "fixture",
        "weight_hint": 1.0,
        "entries": ["hello", "world"],
    }), encoding="utf-8")
    loader = DictLoader(str(test_dir))
    assert "hello" in loader.get("test_dict").entries

    sample.write_text(json.dumps({
        "version": "2026-07-06",
        "description": "fixture",
        "weight_hint": 1.0,
        "entries": ["hello", "world", "FOO_NEW"],
    }), encoding="utf-8")
    loader.force_reload()
    assert "FOO_NEW" in loader.get("test_dict").entries, "force_reload æ²¡è¯»åˆ°æ–°è¯"


def test_get_unknown_dict_returns_empty():
    loader = DictLoader(DICTS_DIR)
    e = loader.get("nonexistent_dict_xyz")
    assert e.entries == frozenset()