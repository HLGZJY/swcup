
"""
moderate.py
===========
L0~L4 ÃƒÂ¦Ã¢â‚¬Â¹Ã‚Â¦ÃƒÂ¦Ã‹â€ Ã‚Âª,ÃƒÂ¤Ã‚Â¸Ã‚ÂÃƒÂ¥Ã‚Â¼Ã¢â€šÂ¬ LLM
"""
from __future__ import annotations
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from .dict_loader import get_default

EMOJI_RANGES = ((0x1F300, 0x1FAFF), (0x2600, 0x27BF), (0x1F000, 0x1F1FF))
LENGTH_MIN = 1
LENGTH_MAX = 500

RE_CHINESE_MOBILE = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")
RE_WECHAT_LIKE = re.compile(r"(?<![A-Za-z0-9])(?:vx|wx|weixin|vxin)[A-Za-z0-9_]{4,15}(?![A-Za-z0-9])", re.IGNORECASE)
RE_QQ_LIKE = re.compile(r"(?<!\d)[1-9]\d{6,10}(?!\d)")
RE_URL = re.compile(r"https?://[\w\-./?=&%#]+|www\.[\w\-.]+", re.IGNORECASE)
RE_DRAIN_KEYWORDS = re.compile(r"(ÃƒÂ¥Ã…Â Ã‚Â \s*ÃƒÂ¦Ã‹â€ Ã¢â‚¬Ëœ|ÃƒÂ¦Ã¢â‚¬Â°Ã‚Â«\s*ÃƒÂ§Ã‚Â Ã‚Â|ÃƒÂ§Ã¢â‚¬Å¡Ã‚Â¹\s*ÃƒÂ¥Ã‚Â¤Ã‚Â´\s*ÃƒÂ¥Ã†â€™Ã‚Â|ÃƒÂ§Ã‚Â§Ã‚Â\s*ÃƒÂ¨Ã‚ÂÃ…Â |ÃƒÂ§Ã¢â‚¬Å¡Ã‚Â¹\s*ÃƒÂ¨Ã‚Â¿Ã¢â€žÂ¢\s*ÃƒÂ©Ã¢â‚¬Â¡Ã…â€™)", re.IGNORECASE)


@dataclass
class ModerateResult:
    verdict: str
    suggested_action: str
    reasons: List[str] = field(default_factory=list)
    features: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return dict(verdict=self.verdict, suggested_action=self.suggested_action,
                    reasons=self.reasons, features=self.features)


def _is_all_emoji(s):
    if not s:
        return False
    total = 0
    hits = 0
    for ch in s:
        if ch.isspace():
            continue
        total += 1
        cp = ord(ch)
        if any(lo <= cp <= hi for lo, hi in EMOJI_RANGES):
            hits += 1
        else:
            return False
    return total > 0 and hits >= max(1, total - 1)


def _kw_hits(text, words):
    out = []
    for w in sorted(words, key=len, reverse=True):
        if w and w in text:
            out.append(w)
    return out


def moderate(content, *, reporter_id=None, recent_violations_count=0):
    reasons = []
    features = {}
    s = (content or "").strip()
    if len(s) < LENGTH_MIN:
        return ModerateResult("hide", "hide", ["L0:empty"], {"empty": 1})
    if len(s) > LENGTH_MAX:
        reasons.append("L0:too_long:" + str(len(s)))
        features["too_long"] = 1
        return ModerateResult("hide", "hide", reasons, features)
    if _is_all_emoji(s):
        return ModerateResult("review", "needs_review", ["L0:emoji_only"], {"emoji_only": 1})

    if RE_URL.search(s) and len(s) <= 60:
        reasons.append("L0:short_text_with_url")
        features["url_in_short_text"] = 1

    loader = get_default()
    bad = _kw_hits(s, loader.get("badwords").entries)
    if bad:
        reasons.extend(["L1:badword:" + w for w in bad])
        features["badword_hits"] = len(bad)
    fake = _kw_hits(s, loader.get("fake_keywords").entries)
    if fake:
        reasons.extend(["L1:fake:" + w for w in fake])
        features["fake_hits"] = len(fake)

    if RE_CHINESE_MOBILE.search(s):
        reasons.append("L2:mobile_pattern"); features["mobile_pattern"] = 1
    if RE_WECHAT_LIKE.search(s):
        reasons.append("L2:wechat_pattern"); features["wechat_pattern"] = 1
    if RE_QQ_LIKE.search(s):
        reasons.append("L2:qq_pattern"); features["qq_pattern"] = 1
    if RE_DRAIN_KEYWORDS.search(s):
        reasons.append("L2:drain_keywords"); features["drain_keywords"] = 1

    l4 = False
    if reporter_id is not None and recent_violations_count >= 3:
        reasons.append("L4:repeat_offender:" + str(recent_violations_count))
        features["repeat_offender"] = 1
        l4 = True

    if bad or l4:
        v, a = "hide", "hide"
    elif fake or len(reasons) >= 2:
        v, a = "review", "needs_review"
    elif reasons:
        v, a = "review", "needs_review"
    else:
        v, a = "allow", "allow"

    return ModerateResult(v, a, reasons, features)
