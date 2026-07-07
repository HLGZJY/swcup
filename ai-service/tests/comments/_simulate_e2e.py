"""
E2E 模拟: 验证 clue_matcher + moderate 的端到端语义.
不修改 backend/ai-service 源码, 只在测试脚本里手工模拟 backend 行为.
"""
import json
import os
import re
import sys
import tempfile
import shutil

sys.path.insert(0, ".")

from comments.clue_matcher import try_match_comment_to_event, list_pending_clues
import comments.moderate as M

# ai-service moderate() 不返回 primary_sentiment/is_hidden.
# backend stub (ai-bridge.service.ts) 本地计算 sentiment.
# 这里复刻 backend 的 3 个集合:
REPORT_WORDS = set(["看到", "见到", "目击", "刚发现"])
REWARD_WORDS = set(["找到", "谢谢", "感谢", "已找回", "团聚"])
POSITIVE_WORDS = set(["可怜", "心疼", "希望", "保佑", "加油", "挺住", "平安", "回家"])

def backend_sentiment_stub(content):
    s = (content or "").strip()
    if any(w in s for w in REWARD_WORDS):
        return "thanks"
    if any(w in s for w in REPORT_WORDS):
        return "report"
    if any(w in s for w in POSITIVE_WORDS):
        return "care"
    return "neutral"

recent_events = [
    dict(
        event_id="e1", event_type="report", reporter_id="u_owner",
        occurred_at="2026-07-06T08:00:00Z",
        location_lat=39.92, location_lng=116.46,
        address="北京朝阳区朝阳公园南门",
        description="一只金毛走失,脖子有红色项圈",
    ),
    dict(
        event_id="e2", event_type="rescue", reporter_id="u_rescuer",
        occurred_at="2026-07-05T15:00:00Z",
        location_lat=39.91, location_lng=116.47,
        address="北京朝阳区团结湖",
        description="流浪狗救助",
    ),
]

state_dir = os.path.join(tempfile.gettempdir(), "clue_state_sim")
if os.path.exists(state_dir):
    shutil.rmtree(state_dir)
os.makedirs(state_dir, exist_ok=True)


def extract_keywords(content):
    return list(set(re.findall(r"[\u4e00-\u9fa5]{2,6}", content)))[:8]


scenarios = [
    dict(name="A: 目击 + 关键词命中 e1 (不同 reporter, 应 pending)",
         content="我刚在朝阳公园看到一只很像的狗", reporter="u_sighting_user", empty_events=False),
    dict(name="B: self-match (评论人 == 事件 reporter, 应 self_match)",
         content="我刚才在朝阳公园门口又看到它了", reporter="u_owner", empty_events=False),
    dict(name="C: 鼓励性评论 (非 report/seek, 应 no_match)",
         content="希望它快点找到主人,加油!", reporter="u_random", empty_events=False),
    dict(name="D: 报目击但事件表空 (应 no_match)",
         content="我刚在朝阳公园看到一只", reporter="u_x", empty_events=True),
]

for i, sc in enumerate(scenarios, 1):
    print("==========", sc["name"], "==========")
    content = sc["content"]
    reporter = sc["reporter"]
    sentiment = backend_sentiment_stub(content)
    print(f"[backend-stub] sentiment={sentiment}")
    kws = extract_keywords(content)
    print(f"[keywords] {kws}")
    events = [] if sc.get("empty_events") else recent_events
    res = try_match_comment_to_event(
        comment=dict(
            comment_id=f"c00{i}", animal_id="a001",
            content=content, reporter_id=reporter,
            sentiment=sentiment, keywords=kws,
            created_at="2026-07-06T10:00:00Z",
        ),
        recent_events_for_animal=events,
        state_dir=state_dir,
    )
    print(f"[matcher] status={res.status} score={res.match_score} candidate={res.candidate_event_id}")
    if res.match_reasons:
        for r in res.match_reasons[:3]:
            print("          -", r)

print()
print("========== admin list_pending_clues ==========")
pending = list_pending_clues(state_dir)
print(json.dumps(pending, ensure_ascii=False, indent=2))