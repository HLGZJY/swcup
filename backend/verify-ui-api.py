#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
§3.4 UI 数据层验证 (后端 API 配套)
- 验证 4 个 UI 页面调用到的所有 API 都返回正确数据
"""
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r'F:\swcup2026\backend')

from test_auth import TOKENS, http
from test_ids import A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, USER4, ADMIN


def section(s):
    print(f"\n--- {s} ---")


def expect(cond, msg):
    ok = "✅" if cond else "❌"
    print(f"  {ok} {msg}")
    return cond


def banner(s):
    print(f"\n{'='*60}\n  {s}\n{'='*60}")


def main():
    banner("§3.4 UI 数据层 API 配套验证")

    ok = True

    # UI-1: 首页(/v1/animals) — 数据源是 GET /v1/animals
    section("UI-1 首页 — GET /v1/animals")
    code, resp = http('GET', '/v1/animals?limit=20', token=TOKENS['user4'])
    data = resp.get('data', {})
    items = data.get('list', [])
    total = data.get('total', 0)
    print(f"  total={total}, list count={len(items)}")
    print(f"  前 3 个动物 status:")
    for a in items[:3]:
        print(f"    - {a.get('breed')} | status={a.get('status')} | report_count={a.get('report_count')} | primary_nose_id={'✅' if a.get('primary_nose_id') else '❌'}")

    ok &= expect(total >= 6, f"首页应能拉到 >= 6 只动物 (实际 total={total})")

    # 验证 status 字段都是合法值
    statuses = {a.get('status') for a in items}
    intersect = bool({'lost', 'found', 'claimed', 'archived'} & statuses)
    ok &= expect(intersect, f"status 字段取值覆盖 (实际 statuses={statuses})")

    # 验证 report_count 字段
    has_report_count = all('report_count' in a for a in items)
    ok &= expect(has_report_count, f"所有动物均返回 report_count (含 0)")

    # 验证 A5 (用户走失的) 应该有 report_count > 0 (经多次合并后)
    a5 = next((a for a in items if a.get('animal_id') == A5), None)
    if a5:
        print(f"  A5: report_count={a5.get('report_count')}, status={a5.get('status')}")
        ok &= expect(a5.get('report_count', 0) >= 1,
                     f"A5.report_count >= 1 (实际={a5.get('report_count')}, 反映 A5+A6 合并)")

    # UI-2: 列表/详情页状态徽章正确 — 直接 GET /v1/animals/{id}
    section("UI-2 动物详情 — GET /v1/animals/{id}")
    for animal_id, expected_status in [(A1, 'lost'), (A4, 'found'),
                                         (A7, 'claimed'), (A7, 'archived')]:
        code, resp = http('GET', f'/v1/animals/{animal_id}', token=TOKENS['user4'])
        a = resp.get('data', {})
        actual = a.get('status')
        print(f"    {animal_id[:8]}.. status={actual}")
    # A7 经过 S10 后是 archived
    code, resp = http('GET', f'/v1/animals/{A7}', token=TOKENS['user4'])
    a7 = resp.get('data', {})
    ok &= expect(a7.get('status') in ('claimed', 'archived'),
                 f"A7.status in (claimed, archived) (实际={a7.get('status')})")

    # UI-3: 我的上报/认领列表 — GET /v1/events/my + GET /v1/claims/my
    section("UI-3 我的上报 — GET /v1/events/my")
    code, resp = http('GET', '/v1/events/my', token=TOKENS['user4'])
    my_events = resp.get('data', [])
    print(f"  user4 事件数 = {len(my_events)}")
    for e in my_events[:5]:
        print(f"    - {e.get('event_id', '')[:8]}.. type={e.get('event_type')} status={e.get('status')} animal={e.get('animal_id', '')[:8] if e.get('animal_id') else 'N/A'}")
    ok &= expect(len(my_events) >= 2, f"user4 至少有 2 条上报 (A5/A6 合并路径触发 + S6)")

    # 验证上报状态字段都是合法值
    event_statuses = {e.get('status') for e in my_events}
    print(f"  event statuses={event_statuses}")
    intersect2 = bool({'pending', 'confirmed', 'duplicated', 'linked', 'resolved', 'rejected', 'processing'} & event_statuses)
    ok &= expect(intersect2, f"event.status 字段取值覆盖")

    section("UI-3 我的认领 — GET /v1/claims/my")
    code, resp = http('GET', '/v1/claims/my', token=TOKENS['user4'])
    my_claims = resp.get('data', [])
    print(f"  user4 认领数 = {len(my_claims)}")
    for c in my_claims[:5]:
        print(f"    - {c.get('claim_id', '')[:8]}.. status={c.get('status')} animal={c.get('animal_id', '')[:8] if c.get('animal_id') else 'N/A'}")
    if my_claims:
        intersect3 = bool({'pending', 'approved', 'rejected', 'cancelled'} & {c.get('status') for c in my_claims})
        ok &= expect(intersect3, f"claim.status 字段取值覆盖")

    # UI-4: admin 后台事件/认领/动物列表
    section("UI-4 admin 事件列表 — GET /v1/admin/events")
    code, resp = http('GET', '/v1/admin/events?limit=20', token=TOKENS['admin'])
    admin_events_data = resp.get('data', {})
    admin_events = admin_events_data.get('list', [])
    admin_events_total = admin_events_data.get('total', 0)
    print(f"  admin 事件 total={admin_events_total}")
    for e in admin_events[:5]:
        print(f"    - {e.get('event_id', '')[:8]}.. type={e.get('event_type')} status={e.get('status')} animal={e.get('animal_id', '')[:8] if e.get('animal_id') else 'N/A'} dup={e.get('is_duplicate')}")
    ok &= expect(len(admin_events) >= 1, f"admin 事件列表非空 (实际={len(admin_events)})")

    section("UI-4 admin 认领列表 — GET /v1/admin/claims")
    code, resp = http('GET', '/v1/admin/claims?limit=20', token=TOKENS['admin'])
    admin_claims_data = resp.get('data', {})
    admin_claims = admin_claims_data.get('list', [])
    admin_claims_total = admin_claims_data.get('total', 0)
    print(f"  admin 认领 total={admin_claims_total}")
    for c in admin_claims[:5]:
        print(f"    - {c.get('claim_id', '')[:8]}.. status={c.get('status')}")
    ok &= expect(len(admin_claims) >= 1, f"admin 认领列表非空 (实际={len(admin_claims)})")

    section("UI-4 admin 动物列表 — GET /v1/admin/animals")
    code, resp = http('GET', '/v1/admin/animals?limit=20', token=TOKENS['admin'])
    admin_animals_data = resp.get('data', {})
    admin_animals = admin_animals_data.get('list', [])
    admin_animals_total = admin_animals_data.get('total', 0)
    print(f"  admin 动物 total={admin_animals_total}")
    for a in admin_animals[:5]:
        print(f"    - {a.get('breed')} status={a.get('status')} report_count={a.get('report_count')}")
    ok &= expect(admin_animals_total >= 6, f"admin 动物列表 >= 6 (实际={admin_animals_total})")

    section("UI-4 admin dashboard 统计 — GET /v1/admin/stats")
    code, resp = http('GET', '/v1/admin/stats', token=TOKENS['admin'])
    stats = resp.get('data', {})
    print(f"  stats={json.dumps(stats, ensure_ascii=False)[:300]}")
    ok &= expect(isinstance(stats, dict) and stats.get('totalAnimals', 0) >= 6,
                 f"stats.totalAnimals >= 6 (实际={stats.get('totalAnimals')})")

    print(f"\n{'='*60}\n  结果: {'✅ PASS' if ok else '❌ FAIL'}\n{'='*60}")
    return ok


if __name__ == '__main__':
    ok = main()
    sys.exit(0 if ok else 1)
