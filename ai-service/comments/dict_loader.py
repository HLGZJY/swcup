"""
comment_dict_loader.py
======================

Ã¨Â¯â€žÃ¨Â®Âº AI Ã¦Â¨Â¡Ã¥Ââ€”Ã§Å¡â€žÃ¨Â¯ÂÃ¥â€¦Â¸Ã¥Å Â Ã¨Â½Â½Ã¥â„¢Â¨:

Ã§â€°Â¹Ã¦â‚¬Â§
----
1. Ã¨Â¯ÂÃ¥â€¦Â¸Ã¤Â»Â¥ JSON Ã¦â€“â€¡Ã¤Â»Â¶Ã¥Â½Â¢Ã¥Â¼ÂÃ¥Â­ËœÃ¦â€Â¾Ã¥Å“Â¨ ``$DICTS_DIR`` (Ã©Â»ËœÃ¨Â®Â¤ ai-service/data/dicts)
2. Ã¥Å Â Ã¨Â½Â½Ã¤Â½Â¿Ã§â€Â¨ trie / set Ã§Â¼â€œÃ¥Â­Ëœ,O(N) Ã¨Â¯ÂÃ©â€¢Â¿Ã¥Å’Â¹Ã©â€¦Â,O(1) Ã¦Å¸Â¥Ã¨Â¯Â¢
3. **Ã§Æ’Â­Ã¥Å Â Ã¨Â½Â½**: Ã¦Â¯ÂÃ©Å¡â€ ``reload_interval_sec`` Ã¦â€°Â stat Ã¦â€“â€¡Ã¤Â»Â¶ mtime;
   Ã¦â€“â€¡Ã¤Â»Â¶Ã¦â€Â¹Ã¥Å Â¨Ã¥ÂÅ½Ã¤Â¸â€¹Ã¦Â¬Â¡Ã¨Â¯Â·Ã¦Â±â€šÃ¨â€¡ÂªÃ¥Å Â¨ reload,Ã¦â€”Â Ã©Å“â‚¬Ã©â€¡ÂÃ¥ÂÂ¯Ã¨Â¿â€ºÃ§Â¨â€¹
4. Ã¥Â¼ÂºÃ¥Ë†Â¶Ã¥Ë†Â·Ã¦â€“Â°: Ã¨Â°Æ’Ã§â€Â¨ ``force_reload()`` Ã¦Ë†â€“ POST /api/dicts/reload
5. Ã¥Å Â Ã¦â€“Â°Ã¨Â¯Â: Ã¦â€Â¹ JSON Ã¥ÂÂ³Ã¥ÂÂ¯,**Ã¤Â¸ÂÃ©Å“â‚¬Ã¨Â¦ÂÃ¦â€Â¹ Python Ã¤Â»Â£Ã§Â Â**

Ã¨Â¯ÂÃ¥â€¦Â¸ JSON schema::

    {
      "version": "2026-07-06",
      "description": "Ã¨Â¯ÂÃ¥â€¦Â¸Ã¨Â¯Â­Ã¤Â¹â€°Ã¨Â¯Â´Ã¦ËœÅ½",
      "weight_hint": 1.0,         # Ã¥ÂÂ¯Ã©â‚¬â€°,Ã©Â»ËœÃ¨Â®Â¤ 1.0
      "entries": ["Ã¨Â¯Â1", "Ã§Å¸Â­Ã¨Â¯Â­2", ...]
    }

Ã¥Â¤Â±Ã¨Â´Â¥Ã¦Â¨Â¡Ã¥Â¼Â
--------
- Ã¦â€“â€¡Ã¤Â»Â¶Ã¤Â¸ÂÃ¥Â­ËœÃ¥Å“Â¨: Ã¥ÂÂ¯Ã¥Å Â¨Ã¦Å“Å¸ loud-fail (raise) - Ã¥ÂÂ¯Ã¥Å Â¨Ã¥Â°Â±Ã¨Â¯Â¥Ã§â€šÂ¸
- Ã¦â€“â€¡Ã¤Â»Â¶Ã¨Â§Â£Ã¦Å¾ÂÃ¥Â¤Â±Ã¨Â´Â¥: Ã¥ÂÂ¯Ã¥Å Â¨Ã¦Å“Å¸ loud-fail
- Ã¨Â¿ÂÃ¨Â¡Å’Ã¦Å“Å¸Ã¦â€“â€¡Ã¤Â»Â¶Ã¨Â¢Â«Ã¥Ë†Â : Ã©Ââ„¢Ã©Â»Ëœ fallback Ã¥Ë†Â°Ã§Â©ÂºÃ©â€ºâ€  (Ã©ËœÂ²Ã¦Â­Â¢Ã¦Å“ÂÃ¥Å Â¡Ã¦Å’â€šÃ¦Å½â€°)
- mtime Ã¦â€Â¹Ã¤Â½â€  JSON Ã¥ÂÂÃ¤Âºâ€ : Ã¤Â¿ÂÃ§â€¢â„¢Ã¦â€”Â§Ã©â€ºâ€ Ã¥ÂË†,Ã¨Â®Â°Ã¦â€”Â¥Ã¥Â¿â€”,Ã§Â»Â§Ã§Â»Â­Ã¦Å“ÂÃ¥Å Â¡
"""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from threading import RLock
from typing import Dict, FrozenSet, Optional



def _default_dicts_dir():
    return os.environ.get(
        "DICTS_DIR",
        str(Path(__file__).resolve().parents[1] / "data" / "dicts"),
    )


@dataclass(frozen=True)
class DictEntry:
    """Ã¥Ââ€¢Ã¤Â¸ÂªÃ¨Â¯ÂÃ¥â€¦Â¸Ã§Å¡â€žÃ¤Â¸ÂÃ¥ÂÂ¯Ã¥ÂËœÃ¥Â¿Â«Ã§â€¦Â§Ã£â‚¬â€š"""

    version: str
    description: str
    weight_hint: float
    entries: FrozenSet[str]


class DictLoader:
    """Ã§ÂºÂ¿Ã§Â¨â€¹Ã¥Â®â€°Ã¥â€¦Â¨Ã§Å¡â€žÃ§Æ’Â­Ã¥Å Â Ã¨Â½Â½Ã¨Â¯ÂÃ¥â€¦Â¸Ã¥Â®Â¹Ã¥â„¢Â¨Ã£â‚¬â€š

    Ã¤Â½Â¿Ã§â€Â¨Ã¦â€“Â¹Ã¥Â¼Â::

        loader = DictLoader()           # Ã¨â€¡ÂªÃ¥Å Â¨Ã¤Â»Å½Ã©Â»ËœÃ¨Â®Â¤Ã§â€ºÂ®Ã¥Â½â€¢Ã¥Å Â Ã¨Â½Â½
        care = loader.get("care_keywords")
        if "Ã¥ÂÂ¯Ã¦â‚¬Å“" in care.entries:
            ...

    Ã¥ÂÂª load Ã¤Â¸â‚¬Ã¦Â¬Â¡Ã¥Â¯Â¹Ã¨Â±Â¡,Ã¦â€°â‚¬Ã¦Å“â€° `.get()` Ã¨ÂµÂ° hot-reload Ã¦Â£â‚¬Ã¦Å¸Â¥Ã£â‚¬â€š
    """

    RELOAD_INTERVAL_SEC = 60  # Ã¦Â¯Â 60s Ã¦â€°Â stat Ã¤Â¸â‚¬Ã¦Â¬Â¡,Ã©ÂÂ¿Ã¥â€¦ÂÃ¦Â¯ÂÃ¦ÂÂ¡Ã¨Â¯â€žÃ¨Â®Âº stat

    def __init__(self, dicts_dir: str = None) -> None:
        if dicts_dir is None:
            dicts_dir = _default_dicts_dir()
        self._dir = Path(dicts_dir)
        self._lock = RLock()
        self._cache: Dict[str, DictEntry] = {}
        self._mtimes: Dict[str, float] = {}
        self._next_check = 0.0  # 0 => Ã¤Â¸â€¹Ã¦Â¬Â¡ get() Ã¥Â¼ÂºÃ¥Ë†Â¶ check
        self._load_all(initial=True)

    # ------------------------------------------------------------------ load

    def _load_all(self, *, initial: bool) -> None:
        if not self._dir.exists():
            if initial:
                raise FileNotFoundError(
                    f"Ã¨Â¯ÂÃ¥â€¦Â¸Ã§â€ºÂ®Ã¥Â½â€¢Ã¤Â¸ÂÃ¥Â­ËœÃ¥Å“Â¨: {self._dir} (Ã¨Â¯Â·Ã¦Â£â‚¬Ã¦Å¸Â¥ DICTS_DIR Ã¦Ë†â€“Ã§Â¡Â®Ã¨Â®Â¤ data/dicts Ã¥Â·Â²Ã§â€Å¸Ã¦Ë†Â)"
                )
            return

        for path in sorted(self._dir.glob("*.json")):
            name = path.stem
            try:
                mtime = path.stat().st_mtime
            except OSError:
                continue
            if not initial and self._mtimes.get(name) == mtime:
                continue
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                entry = DictEntry(
                    version=str(raw.get("version", "0")),
                    description=str(raw.get("description", "")),
                    weight_hint=float(raw.get("weight_hint", 1.0)),
                    entries=frozenset(raw.get("entries", []) or []),
                )
                with self._lock:
                    self._cache[name] = entry
                    self._mtimes[name] = mtime
            except (json.JSONDecodeError, ValueError, TypeError) as exc:
                # Ã¨Â¿ÂÃ¨Â¡Å’Ã¦Å“Å¸Ã¦ÂÅ¸Ã¥ÂÂ: Ã¤Â¿ÂÃ§â€¢â„¢Ã¦â€”Â§Ã©â€ºâ€ Ã¥ÂË†,Ã§Â»Â§Ã§Â»Â­Ã¦Å“ÂÃ¥Å Â¡
                if not initial:
                    print(f"[dict_loader] skip broken {name}: {exc}")
                else:
                    raise

    def _maybe_reload(self) -> None:
        now = time.monotonic()
        if now < self._next_check:
            return
        self._next_check = now + self.RELOAD_INTERVAL_SEC
        self._load_all(initial=False)

    # ------------------------------------------------------------------ api

    def get(self, name: str) -> DictEntry:
        """Ã¨Å½Â·Ã¥Ââ€“Ã¨Â¯ÂÃ¥â€¦Â¸Ã¥Â¿Â«Ã§â€¦Â§;Ã¨â€¹Â¥Ã¦â€“â€¡Ã¤Â»Â¶Ã¥Â·Â²Ã¥ÂËœÃ¦â€ºÂ´,Ã¨â€¡ÂªÃ¥Å Â¨ reloadÃ£â‚¬â€š"""
        self._maybe_reload()
        with self._lock:
            entry = self._cache.get(name)
        if entry is None:
            return DictEntry(version="0", description="", weight_hint=1.0, entries=frozenset())
        return entry

    def names(self) -> list[str]:
        self._maybe_reload()
        with self._lock:
            return sorted(self._cache.keys())

    def force_reload(self) -> None:
        """Ã¥Â¼ÂºÃ¥Ë†Â¶Ã¥Ë†Â·Ã¦â€“Â°Ã¥â€¦Â¨Ã©Æ’Â¨Ã¨Â¯ÂÃ¥â€¦Â¸,Ã¥Â¿Â½Ã§â€¢Â¥ mtimeÃ£â‚¬â€š"""
        self._next_check = 0.0
        with self._lock:
            self._cache.clear()
            self._mtimes.clear()
        self._load_all(initial=False)


# Ã©Â»ËœÃ¨Â®Â¤Ã¥Ââ€¢Ã¤Â¾â€¹ (Ã¦Â¨Â¡Ã¥Ââ€”Ã§ÂºÂ§)
_default_loader: Optional[DictLoader] = None


def get_default() -> DictLoader:
    global _default_loader
    if _default_loader is None:
        _default_loader = DictLoader(_default_dicts_dir())
    return _default_loader