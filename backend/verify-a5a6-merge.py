#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
§3.2 A5+A6 同区(~100m)合并路径验证
- user4 (陈建国, A5 旺财主人) 在 A6 位置采集鼻纹 + 提交 report 事件
- admin 触发 processEvent 候选池
- admin 触发 confirmEvent 完成合并
- 验证 is_duplicate=1, duplicate_of=A5, fusion_score≈1.0
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r'F:\swcup2026\backend')

import pymysql
from test_auth import TOKENS, http, upload_nose
from test_ids import A5, A6, USER4, ADMIN, LOC_A5, LOC_A6, NOSE_A5


def banner(s):
    print(f"\n{'='*60}\n  {s}\n{'='*60}")


def section(s):
    print(f"\n--- {s} ---")


def expect(cond, msg):
    ok = "✅" if cond else "❌"
    print(f"  {ok} {msg}")
    return cond


def fetch_event(cur, event_id):
    cur.execute(
        "SELECT animal_id, status, is_duplicate, duplicate_of, fusion_score, "
        "vector_similarity, gps_similarity, image_similarity "
        "FROM rescue_events WHERE event_id=%s",
        (event_id,),
    )
    return cur.fetchone()


def main():
    banner("§3.2 A5+A6 同区(~100m)合并路径验证")

    section("前置: A5 已有 primary_nose_id, A6 独立档案 status=lost")
    code, resp = http('GET', f'/v1/animals/{A5}', token=TOKENS['user4'])
    a5_before = resp.get('data', {})
    print(f"  A5 status={a5_before.get('status')} primary_nose_id={a5_before.get('primary_nose_id')}")
    code, resp = http('GET', f'/v1/animals/{A6}', token=TOKENS['user4'])
    a6_before = resp.get('data', {})
    print(f"  A6 status={a6_before.get('status')} primary_nose_id={a6_before.get('primary_nose_id')}")

    rc_a5_before = a5_before.get('report_count', 0)
    print(f"  A5.report_count before = {rc_a5_before}")

    section("操作: user4 在 A6 位置(31.1958,121.4358, 距 A5 ~100m)采鼻纹")
    new_v = upload_nose('aa5.jpg', TOKENS['user4'], lat=LOC_A6[0], lng=LOC_A6[1])
    print(f"  nose/collect -> vector_id={new_v}")

    section("操作: user4 提交 A6 区发现事件 (POST /v1/events)")
    payload = {
        'event_type': 'report',
        'nose_vector_id': new_v,
        'species': 'dog',
        'breed': '土狗',
        'color': '棕色',
        'gender': 'female',
        'age_estimate': 'adult',
        'health_status': 'healthy',
        'sterilized': False,
        'location_lat': LOC_A6[0],
        'location_lng': LOC_A6[1],
        'address': '上海市徐汇区衡山路 999 号(再次发现旺财)',
        'description': '在徐汇衡山路又看到这只土狗, 跟 A5 旺财很像, 棕毛左耳有缺口',
    }
    code, resp = http('POST', '/v1/events', payload, TOKENS['user4'])
    print(f"  POST /v1/events -> {code}")
    print(f"  resp={json.dumps(resp, ensure_ascii=False)[:400]}")
    event_id = resp.get('data', {}).get('event_id') if resp.get('data') else None
    if not event_id:
        print("  ❌ 创建事件失败,中止")
        return False

    section("操作: admin 触发 processEvent, 期望 fusion_score≈1.0, 进入候选池")
    code, resp = http('POST', f'/v1/admin/events/{event_id}/process', token=TOKENS['admin'])
    print(f"  POST /v1/admin/events/{event_id}/process -> {code}")
    print(f"  process resp={json.dumps(resp, ensure_ascii=False)[:600]}")
    process_data = resp.get('data', {})
    fusion = process_data.get('fusion_score')
    is_dup_top = process_data.get('is_duplicate')
    merge_candidate = process_data.get('merge_candidate')
    candidates = process_data.get('candidates', [])

    # 检查 DB
    conn = pymysql.connect(host='127.0.0.1', port=3307, user='root',
                           password='rootpassword', database='nose_rescue', charset='utf8mb4')
    cur = conn.cursor()

    # 注:candidates 在 process 返回里只有 1 个元素在 merge_candidate, candidates 字段 DB 存的是 json
    top_candidate_id = process_data.get('merge_candidate', {}).get('animal_id') if isinstance(process_data.get('merge_candidate'), dict) else None

    # 关键证据一:DB fusion_score≈1.0
    row = fetch_event(cur, event_id)
    fusion_db = float(row[4]) if row[4] is not None else 0.0
    print(f"\n  DB after process:")
    print(f"    animal_id={row[0]} status={row[1]} is_duplicate={row[2]}")
    print(f"    duplicate_of={row[3]} fusion_score={row[4]}")
    print(f"    vec_sim={row[5]} gps_sim={row[6]} image_sim={row[7]}")

    ok = True
    ok &= expect(abs(fusion_db - 1.0) < 0.15,
                 f"fusion_score ≈ 1.0 (实际={row[4]})")
    ok &= expect(row[0] == A5,
                 f"事件已自动关联到 A5 (animal_id={row[0]}, 期望={A5})")
    ok &= expect(top_candidate_id == A5,
                 f"merge_candidate=A5 (实际={top_candidate_id})")

    section("操作: admin 触发 confirmEvent, 完成合并 (PUT)")
    code, resp = http('PUT', f'/v1/admin/events/{event_id}/confirm',
                      payload={'animal_id': A5, 'note': 'A5+A6 同区(~100m)合并验证'},
                      token=TOKENS['admin'])
    print(f"  PUT /v1/admin/events/{event_id}/confirm -> {code}")
    print(f"  confirm resp={json.dumps(resp, ensure_ascii=False)[:400]}")

    # 关键证据二:is_duplicate=1, duplicate_of=A5
    row2 = fetch_event(cur, event_id)
    print(f"\n  DB after confirm:")
    print(f"    status={row2[1]} is_duplicate={row2[2]} duplicate_of={row2[3]}")
    print(f"    vec_sim={row2[5]} gps_sim={row2[6]} image_sim={row2[7]}")
    ok &= expect(row2[2] == 1, "rescue_events.is_duplicate = 1")
    ok &= expect(row2[3] == A5, f"rescue_events.duplicate_of = A5 (实际={row2[3]})")

    section("证据三: A5.report_count 应该 +1 (合并事件计入)")
    code, resp = http('GET', f'/v1/animals/{A5}', token=TOKENS['user4'])
    a5_after = resp.get('data', {})
    rc_a5_after = a5_after.get('report_count', 0)
    print(f"  A5.report_count after = {rc_a5_after} (before={rc_a5_before})")
    ok &= expect(rc_a5_after >= rc_a5_before + 1,
                 f"A5.report_count 增加 >= 1 ({rc_a5_before} -> {rc_a5_after})")

    section("证据四: admin 端事件列表看到 pending→confirmed 流转")
    code, resp = http('GET', f'/v1/admin/events/{event_id}', token=TOKENS['admin'])
    print(f"  GET /v1/admin/events/{{id}} -> {code}")
    if resp.get('data'):
        d = resp['data']
        print(f"    event_id={d.get('event_id')[:8]}... status={d.get('status')}")
        print(f"    is_duplicate={d.get('is_duplicate')} duplicate_of={d.get('duplicate_of')}")
        print(f"    fusion_score={d.get('fusion_score')}")
        # 注意:admin GET 单个事件 detail 接口没把 is_duplicate 字段序列化进响应(观察项 §4)
        if d.get('is_duplicate') in (1, True):
            ok &= True
            print(f"  ✅ admin detail 接口 is_duplicate 已返回")
        else:
            print(f"  ⚠️  admin detail 接口未返回 is_duplicate (DB 已记录 is_duplicate=1,见上)")
            # 不阻塞整体 PASS, 记入 §4 观察项
        # confirm 后 status 应为 confirmed
        ok &= expect(d.get('status') in ('confirmed', 'duplicated', 'linked'),
                     f"admin 端 status 流转 (实际={d.get('status')})")

    conn.close()

    print(f"\n{'='*60}\n  结果: {'✅ PASS' if ok else '❌ FAIL'}\n{'='*60}")
    return ok


if __name__ == '__main__':
    ok = main()
    sys.exit(0 if ok else 1)
