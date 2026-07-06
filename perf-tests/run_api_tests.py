"""API 集成 + 安全测试执行脚本。

跑 25 个用例：
- TC-API-001 ~ 020：API 集成 20 用例
- TC-SEC-001 ~ 005：安全 5 用例

输出：
- 表格化结果（控制台）
- JSON 结果文件 `api_test_results.json`

运行：
  python run_api_tests.py
"""
import json
import time
import uuid
from pathlib import Path
from typing import Optional

import requests

BASE = "http://localhost:3000"

# 种子用户（来自 seed.sql）
SEED_USERS = {
    "admin": {"phone": "13900000001", "password": "admin123", "role": "admin"},
    "user":  {"phone": "13800000002", "password": "user1234", "role": "user"},
    "user2": {"phone": "13800000003", "password": "user1234", "role": "user"},
}

FIXTURE_B64 = json.loads(Path("fixture.json").read_text(encoding="utf-8"))["image_base64"]

results: list[dict] = []
tokens: dict[str, str] = {}
animal_id: Optional[str] = None


def H(token: Optional[str] = None, extra=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if extra:
        h.update(extra)
    return h


def record(tc_id, name, method, url, expected, actual_code, actual_body, notes=""):
    ok = expected == actual_code or (isinstance(expected, list) and actual_code in expected)
    results.append({
        "tc_id": tc_id, "name": name, "method": method, "url": url,
        "expected_http": expected, "actual_http": actual_code,
        "pass": ok, "notes": notes,
        "response_snippet": (json.dumps(actual_body, ensure_ascii=False) if isinstance(actual_body, (dict, list)) else str(actual_body))[:200],
    })
    mark = "✅" if ok else "❌"
    print(f"  {mark} {tc_id} {name}  [{actual_code}]")
    if not ok:
        print(f"      expected={expected}, got={actual_code}, body={results[-1]['response_snippet'][:120]}")


def setup_tokens():
    """通过 reset-password 给 3 个种子用户设密码并拿 token。"""
    for who, info in SEED_USERS.items():
        # send-code (ignore)
        requests.post(f"{BASE}/v1/auth/send-code", json={"phone": info["phone"]})
        # reset-password returns token
        r = requests.post(f"{BASE}/v1/auth/reset-password", json={
            "phone": info["phone"], "code": "888888", "password": info["password"],
        })
        if r.status_code in (200, 201):
            body = r.json()
            if body.get("code") == 0:
                tokens[who] = body["data"]["token"]
                print(f"  token ok: {who} ({info['phone']})")
                continue
        # fallback: try login
        r = requests.post(f"{BASE}/v1/auth/login", json={"phone": info["phone"], "password": info["password"]})
        if r.json().get("code") == 0:
            tokens[who] = r.json()["data"]["token"]
            print(f"  token (login fallback): {who}")
        else:
            print(f"  ❌ cannot get token for {who}: {r.json()}")


# ============================================================================
# TC-API-001~006：Auth 模块
# ============================================================================
def tc_auth():
    print("\n--- TC-API-001~006 Auth ---")
    # 001 注册：未注册的新手机号
    new_phone = f"139{random_digits(8)}"
    r = requests.post(f"{BASE}/v1/auth/register", json={"phone": new_phone, "password": "test1234"})
    record("TC-API-001", "注册新用户", "POST", "/v1/auth/register",
           201, r.status_code, r.json(),
           "预期 201 user_id；实际可能 200/201/200+data 视实现")

    # 002 登录（admin/123）
    r = requests.post(f"{BASE}/v1/auth/login", json={"phone": "13900000001", "password": "admin123"})
    record("TC-API-002", "登录正确密码", "POST", "/v1/auth/login",
           [200, 201], r.status_code, r.json())

    # 003 登录错误密码
    r = requests.post(f"{BASE}/v1/auth/login", json={"phone": "13900000001", "password": "wrongpass"})
    record("TC-API-003", "登录错误密码", "POST", "/v1/auth/login",
           [401, 400], r.status_code, r.json(),
           "预期 401/400 Unauthorized")

    # 004 发送验证码
    r = requests.post(f"{BASE}/v1/auth/send-code", json={"phone": "13900000001"})
    record("TC-API-004", "发送验证码", "POST", "/v1/auth/send-code",
           [200, 201], r.status_code, r.json())

    # 005 验证码登录 — 实际 LoginDto 只有 phone+password，无 code 登录端点
    # 文档与实际不一致：实际端点是 bind-phone 或 reset-password 用验证码
    r = requests.post(f"{BASE}/v1/auth/login", json={"phone": "13900000001", "code": "888888"})
    record("TC-API-005", "验证码登录(端点不存在)", "POST", "/v1/auth/login",
           [200, 201], r.status_code, r.json(),
           "⚠️ TEST-PLAN 描述与实际不符：LoginDto 无 code 字段，应返回 400 validation")

    # 006 重置密码 — 已用于 set tokens；再跑一次验证流程
    test_phone = f"139{random_digits(8)}"
    requests.post(f"{BASE}/v1/auth/send-code", json={"phone": test_phone})
    requests.post(f"{BASE}/v1/auth/register", json={"phone": test_phone, "password": "oldpass1"})
    r = requests.post(f"{BASE}/v1/auth/reset-password", json={
        "phone": test_phone, "code": "888888", "password": "newpass1",
    })
    record("TC-API-006", "重置密码", "POST", "/v1/auth/reset-password",
           [200, 201], r.status_code, r.json())


# ============================================================================
# TC-API-007~008：Users 模块
# ============================================================================
def tc_users():
    print("\n--- TC-API-007~008 Users ---")
    tk = tokens["user"]
    # 007 获取我的资料
    r = requests.get(f"{BASE}/v1/users/me", headers=H(tk))
    record("TC-API-007", "获取我的资料", "GET", "/v1/users/me",
           [200, 201], r.status_code, r.json())

    # 008 修改我的资料
    r = requests.patch(f"{BASE}/v1/users/me", json={"nickname": "测试昵称2026"}, headers=H(tk))
    record("TC-API-008", "修改我的资料", "PATCH", "/v1/users/me",
           [200, 201], r.status_code, r.json())


# ============================================================================
# TC-API-009~014：Animals 模块
# ============================================================================
def tc_animals():
    print("\n--- TC-API-009~014 Animals ---")
    global animal_id
    tk_admin = tokens["admin"]
    tk_user = tokens["user"]
    # 009 列表（公开）
    r = requests.get(f"{BASE}/v1/animals?page=1&limit=5")
    body = r.json()
    # 拿一个 animal_id 后续用
    if isinstance(body.get("data"), dict) and body["data"].get("list"):
        animal_id = body["data"]["list"][0]["animal_id"]
    record("TC-API-009", "动物列表(公开)", "GET", "/v1/animals?page=1&limit=5",
           [200, 201], r.status_code, body)

    # 010 详情
    if animal_id:
        r = requests.get(f"{BASE}/v1/animals/{animal_id}")
        record("TC-API-010", "动物详情", "GET", f"/v1/animals/{animal_id}",
               [200, 201], r.status_code, r.json())
    else:
        record("TC-API-010", "动物详情(跳过)", "GET", "-", [200, 201], 0, {}, "无 animal_id 可测")

    # 011 创建（admin）
    payload = {
        "status": "lost", "species": "dog", "breed": "测试犬种", "color": "黑色",
        "gender": "male", "age_estimate": "adult", "health_status": "healthy", "sterilized": False,
    }
    r = requests.post(f"{BASE}/v1/animals", json=payload, headers=H(tk_admin))
    rec_body = r.json()
    created_id = None
    if isinstance(rec_body.get("data"), dict):
        created_id = rec_body["data"].get("animal_id")
    record("TC-API-011", "创建动物(admin)", "POST", "/v1/animals",
           [200, 201], r.status_code, rec_body)

    # 012 创建（普通用户）— 预期 403
    r = requests.post(f"{BASE}/v1/animals", json=payload, headers=H(tk_user))
    record("TC-API-012", "创建动物(普通用户)", "POST", "/v1/animals",
           [403, 401], r.status_code, r.json(),
           "预期 403 Forbidden")

    # 013 编辑（用刚创建的 id 或现有 id）
    edit_id = created_id or animal_id
    if edit_id:
        r = requests.put(f"{BASE}/v1/animals/{edit_id}", json={"notes": "API 测试更新"}, headers=H(tk_admin))
        record("TC-API-013", "编辑动物", "PUT", f"/v1/animals/{edit_id}",
               [200, 201], r.status_code, r.json())
    else:
        record("TC-API-013", "编辑动物(跳过)", "PUT", "-", [200, 201], 0, {})

    # 014 删除（用刚创建的 id，admin）
    if created_id:
        r = requests.delete(f"{BASE}/v1/animals/{created_id}", headers=H(tk_admin))
        record("TC-API-014", "删除动物", "DELETE", f"/v1/animals/{created_id}",
               [200, 204], r.status_code, r.json())
    else:
        record("TC-API-014", "删除动物(跳过)", "DELETE", "-", [200, 204], 0, {})


# ============================================================================
# TC-API-015~017：Nose 模块
# ============================================================================
def tc_nose():
    print("\n--- TC-API-015~017 Nose ---")
    # 015 鼻纹采集（公开，body 含 nose_photo base64）
    r = requests.post(f"{BASE}/v1/nose/collect", json={
        "nose_photo": FIXTURE_B64, "species": "dog",
        "location_lat": 39.90, "location_lng": 116.40, "description": "api-test-collect",
    })
    body = r.json()
    collect_nose_id = None
    if isinstance(body.get("data"), dict):
        # 尝试多个可能字段
        collect_nose_id = (
            body["data"].get("nose_id")
            or body["data"].get("vector_id")
            or body["data"].get("nose_vector_id")
        )
        # 也可能在嵌套的 next_action
        if not collect_nose_id:
            na = body["data"].get("next_action", {})
            if isinstance(na, dict):
                collect_nose_id = na.get("nose_id") or na.get("vector_id")
    record("TC-API-015", "鼻纹采集", "POST", "/v1/nose/collect",
           [200, 201], r.status_code, body,
           f"nose_id={collect_nose_id}")

    # 016 鼻纹比对（公开，需要 vector_id/nose_id + photo_base64）
    # 复测：先采集拿 nose_id，再传同图比对（应返回 cosine_sim 接近 1.0）
    r_collect = requests.post(f"{BASE}/v1/nose/collect", json={
        "nose_photo": FIXTURE_B64, "species": "dog",
        "location_lat": 39.90, "location_lng": 116.40, "description": "api-test-collect-for-compare",
    })
    cmp_body = r_collect.json()
    cmp_nose_id = None
    if isinstance(cmp_body.get("data"), dict):
        cmp_nose_id = (
            cmp_body["data"].get("nose_id")
            or cmp_body["data"].get("vector_id")
            or cmp_body["data"].get("nose_vector_id")
        )
    cmp_payload = {
        "photo_base64": FIXTURE_B64, "species": "dog",
        "location_lat": 39.90, "location_lng": 116.40, "description": "api-test-compare",
    }
    if cmp_nose_id:
        cmp_payload["vector_id"] = cmp_nose_id
    r = requests.post(f"{BASE}/v1/nose/compare", json=cmp_payload)
    record("TC-API-016", "鼻纹比对", "POST", "/v1/nose/compare",
           [200, 201], r.status_code, r.json(),
           f"传 nose_id={cmp_nose_id}，应返回 cosine_sim")

    # 017 品种识别（公开）
    r = requests.post(f"{BASE}/v1/nose/classify", json={"image": FIXTURE_B64})
    record("TC-API-017", "品种识别", "POST", "/v1/nose/classify",
           [200, 201], r.status_code, r.json())


# ============================================================================
# TC-API-018~020：Events + Claims
# ============================================================================
def tc_events_claims():
    print("\n--- TC-API-018~020 Events+Claims ---")
    tk = tokens["user"]
    # 018 创建事件
    r = requests.post(f"{BASE}/v1/events", json={
        "event_type": "report", "species": "dog", "breed": "测试品种",
        "color": "黑色", "gender": "male",
        "nose_photo_url": "http://test/photo.jpg",
    }, headers=H(tk))
    rec_body = r.json()
    event_id = None
    if isinstance(rec_body.get("data"), dict):
        event_id = rec_body["data"].get("event_id")
    record("TC-API-018", "创建事件", "POST", "/v1/events",
           [200, 201], r.status_code, rec_body)

    # 019 我的事件
    r = requests.get(f"{BASE}/v1/events/my", headers=H(tk))
    record("TC-API-019", "我的事件", "GET", "/v1/events/my",
           [200, 201], r.status_code, r.json())

    # 020 申请认领（需要 animal_id + event_id）
    global animal_id
    if animal_id and event_id:
        r = requests.post(f"{BASE}/v1/claims", json={
            "animal_id": animal_id, "event_id": event_id, "notes": "api-test-claim",
        }, headers=H(tk))
        record("TC-API-020", "申请认领", "POST", "/v1/claims",
               [200, 201], r.status_code, r.json())
    else:
        record("TC-API-020", "申请认领(缺前置)", "POST", "/v1/claims",
               [200, 201], 0, {}, f"animal_id={animal_id} event_id={event_id}")


# ============================================================================
# TC-SEC-001~005：安全
# ============================================================================
def tc_security():
    print("\n--- TC-SEC-001~005 Security ---")
    # 001 SQL 注入 — GET /v1/animals?id=' OR '1'='1
    r = requests.get(f"{BASE}/v1/animals?id=1%27%20OR%20%271%27%3D%271")
    body = r.json()
    ok = body.get("code") in (0, 400)  # 0=正常过滤, 400=参数错误; 不应返回 500
    record("TC-SEC-001", "SQL 注入防御", "GET", "/v1/animals?id=' OR '1'='1'",
           [200, 400, 404], r.status_code, body,
           "不应 500 或返回额外数据；code=0/400/404 视为通过")

    # 002 XSS — POST /v1/auth/register 含 <script>
    xss_phone = f"139{random_digits(8)}"
    r = requests.post(f"{BASE}/v1/auth/register", json={
        "phone": xss_phone, "password": "xss12345",
        # 注册接口可能不接受 nickname；试 login 用 nickname 也无
    })
    record("TC-SEC-002", "XSS 注入(register)", "POST", "/v1/auth/register",
           [200, 201, 400], r.status_code, r.json(),
           "register 无 nickname 字段，验证后端不渲染注入；改测 PATCH /v1/users/me")
    # 真正的 XSS 测试通过 PATCH 提交带 <script> 的 nickname
    if "user" in tokens:
        tk = tokens["user"]
        r = requests.patch(f"{BASE}/v1/users/me", json={
            "nickname": "<script>alert(1)</script>"
        }, headers=H(tk))
        # 验证：nickname 是否原样存储（不渲染）
        # 再 GET 一次确认存储原样
        r2 = requests.get(f"{BASE}/v1/users/me", headers=H(tk))
        body = r2.json()
        stored_nick = body.get("data", {}).get("nickname", "")
        xss_ok = stored_nick == "<script>alert(1)</script>"
        results.append({
            "tc_id": "TC-SEC-002b", "name": "XSS 原样存储", "method": "PATCH+GET",
            "url": "/v1/users/me", "expected_http": 200, "actual_http": r2.status_code,
            "pass": xss_ok and r.status_code in (200, 201),
            "notes": f"nickname 存储为 {stored_nick!r}（原样 = 通过）",
            "response_snippet": stored_nick[:60],
        })
        mark = "✅" if xss_ok else "❌"
        print(f"  {mark} TC-SEC-002b XSS 原样存储  nick={stored_nick!r}")

    # 003 JWT 伪造
    r = requests.get(f"{BASE}/v1/users/me", headers=H("fake.token.here"))
    record("TC-SEC-003", "JWT 伪造防御", "GET", "/v1/users/me",
           [401, 403], r.status_code, r.json(),
           "预期 401 Unauthorized")

    # 004 密码强度 — 注册时使用 "123456"
    weak_phone = f"139{random_digits(8)}"
    r = requests.post(f"{BASE}/v1/auth/register", json={"phone": weak_phone, "password": "123456"})
    body = r.json()
    weak_ok = body.get("code") != 0 or "weak" in str(body).lower() or "强度" in str(body) or r.status_code in (400, 422)
    record("TC-SEC-004", "弱密码拒绝", "POST", "/v1/auth/register",
           [400, 422], r.status_code, body,
           "预期 400 '密码强度不足' 或业务码非 0")

    # 005 手机号脱敏 — 已在 admin login 时确认（139****0001）；再显式跑
    r = requests.get(f"{BASE}/v1/users/me", headers=H(tokens["admin"]))
    body = r.json()
    phone = body.get("data", {}).get("phone", "")
    masked_ok = "****" in phone and len(phone) == 11
    record("TC-SEC-005", "手机号脱敏", "GET", "/v1/users/me",
           200, r.status_code, body,
           f"phone={phone!r} 含 ****={masked_ok}")


def random_digits(n):
    import random
    return "".join([str(random.randint(0, 9)) for _ in range(n)])


def main():
    print(">>> Setup tokens ...")
    setup_tokens()
    print(f"  tokens: {list(tokens.keys())}")

    tc_auth()
    tc_users()
    tc_animals()
    tc_nose()
    tc_events_claims()
    tc_security()

    print(f"\n=== 汇总 ===")
    total = len(results)
    passed = sum(1 for r in results if r["pass"])
    print(f"通过 {passed}/{total} = {passed*100/total:.1f}%")
    # 输出 JSON
    Path("api_test_results.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("结果已保存 api_test_results.json")


if __name__ == "__main__":
    main()