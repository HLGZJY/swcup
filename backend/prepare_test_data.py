#!/usr/bin/env python3
"""准备测试数据：动物、鼻纹、事件、认领"""
import requests
import json
import time

BASE = "http://127.0.0.1:3000"

# 读取 Base64 图片
def load_b64(path):
    with open(path) as f:
        return f.read().strip()

DOG_A_B64 = load_b64("/tmp/dog_a.txt")
DOG_B_B64 = load_b64("/tmp/dog_b.txt")
DOG_C_B64 = load_b64("/tmp/dog_c.txt")
DOG_D_B64 = load_b64("/tmp/dog_d.txt")
DOG_E_B64 = load_b64("/tmp/dog_e.txt")

# ========================
# 1. 登录（普通用户 + 管理员）
# ========================
print("=== 1. 登录获取 token ===")

admin_login = requests.post(f"{BASE}/auth/login", json={
    "phone": "13900000001", "password": "password123"
}).json()
admin_token = admin_login["data"]["token"]
print(f"管理员登录: code={admin_login['code']}, role={admin_login['data']['user']['role']}")

user_login = requests.post(f"{BASE}/auth/login", json={
    "phone": "13800000002", "password": "password123"
}).json()
user_token = user_login["data"]["token"]
user_id = user_login["data"]["user"]["user_id"]
print(f"用户登录: code={user_login['code']}, user_id={user_id}")

HEADERS = {"Authorization": f"Bearer {admin_token}"}
USER_HEADERS = {"Authorization": f"Bearer {user_token}"}

# ========================
# 2. 创建 3 个动物档案（管理员）
# ========================
print("\n=== 2. 创建动物档案 ===")

animals = []
for name, species, breed, color, status in [
    ("豆豆", "dog", "金毛", "金色", "lost"),
    ("旺财", "dog", "土狗", "棕色", "lost"),
    ("小白", "dog", "萨摩耶", "白色", "lost"),
]:
    resp = requests.post(f"{BASE}/admin/animals", json={
        "status": status, "species": species, "breed": breed,
        "color": color, "gender": "unknown", "age_estimate": "adult",
        "health_status": "healthy", "sterilized": False,
        "first_seen_at": "2026-05-10T08:00:00.000Z",
        "last_seen_at": "2026-05-13T10:00:00.000Z",
        "location_lat": 31.2304, "location_lng": 121.4737,
        "address": "上海市静安区", "notes": f"{name}是一只可爱的{species}"
    }, headers=HEADERS).json()
    print(f"创建动物 {name}: code={resp['code']}, animal_id={resp['data']['animal_id'] if resp['code']==0 else resp.get('message')}")
    if resp["code"] == 0:
        animals.append({"name": name, "id": resp["data"]["animal_id"]})

print(f"共创建 {len(animals)} 个动物")

# ========================
# 3. 采集鼻纹（每个动物 3 个样本 = 满足认领条件）
# ========================
print("\n=== 3. 采集鼻纹 ===")

nose_photos = [
    (animals[0]["id"], DOG_A_B64, "dog_a_1"),
    (animals[0]["id"], DOG_B_B64, "dog_a_2"),
    (animals[0]["id"], DOG_C_B64, "dog_a_3"),
    (animals[1]["id"], DOG_B_B64, "dog_b_1"),
    (animals[1]["id"], DOG_C_B64, "dog_b_2"),
    (animals[1]["id"], DOG_D_B64, "dog_b_3"),
    (animals[2]["id"], DOG_C_B64, "dog_c_1"),
    (animals[2]["id"], DOG_D_B64, "dog_c_2"),
    (animals[2]["id"], DOG_E_B64, "dog_c_3"),
]

nose_ids = []
for animal_id, b64, label in nose_photos:
    resp = requests.post(f"{BASE}/nose/collect", json={
        "nose_photo": b64,
        "species": "dog",
        "animal_id": animal_id,
        "location_lat": 31.2304,
        "location_lng": 121.4737,
        "device_id": "test_device",
        "timestamp": "2026-05-13T12:00:00.000Z"
    }).json()
    status = "OK" if resp["code"] == 0 else f"FAIL({resp.get('message')})"
    nose_id = resp["data"]["nose_id"] if resp["code"] == 0 else "N/A"
    print(f"鼻纹采集 {label}: {status}, nose_id={nose_id}")
    if resp["code"] == 0:
        nose_ids.append(nose_id)

print(f"共采集 {len(nose_ids)} 个鼻纹样本")

# ========================
# 4. 上报救助事件（用户）
# ========================
print("\n=== 4. 上报救助事件 ===")

events = []
for i, (animal_id, species, notes) in enumerate([
    (animals[0]["id"], "dog", "在小区内发现豆豆，疑似走失，佩戴蓝色项圈"),
    (animals[1]["id"], "dog", "路边发现旺财，很温顺，旁边有狗粮"),
    (None, "dog", "路边发现一只萨摩耶，看起来像是走丢了"),
]):
    resp = requests.post(f"{BASE}/events", json={
        "event_type": "report",
        "species": species,
        "gender": "unknown",
        "age_estimate": "adult",
        "health_status": "healthy",
        "sterilized": False,
        "color": ["金色", "棕色", "白色"][i],
        "breed": ["金毛", "土狗", "萨摩耶"][i],
        "notes": notes,
        "first_seen_at": "2026-05-13T08:00:00.000Z",
        "last_seen_at": "2026-05-13T10:00:00.000Z",
        "location_lat": 31.2304 + i * 0.01,
        "location_lng": 121.4737 + i * 0.01,
        "address": f"上海市静安区某路{i+1}号",
        "tags": ["走失", "佩戴项圈"] if i < 2 else ["走失"],
        "photos": []
    }, headers=USER_HEADERS).json()
    print(f"事件上报 [{i+1}]: code={resp['code']}, event_id={resp['data']['event_id'] if resp['code']==0 else resp.get('message')}")
    if resp["code"] == 0:
        events.append({"id": resp["data"]["event_id"], "animal_id": animal_id, "notes": notes})

# ========================
# 5. 管理端：AI处理 + 确认/驳回
# ========================
print("\n=== 5. 管理端处理事件 ===")

if events:
    # 处理第一个事件
    resp = requests.post(f"{BASE}/admin/events/{events[0]['id']}/process", headers=HEADERS).json()
    print(f"AI处理事件1: code={resp['code']}, status={resp['data']['status'] if resp['code']==0 else resp.get('message')}")

    # 确认第一个事件（重复）
    resp = requests.put(f"{BASE}/admin/events/{events[0]['id']}/confirm", headers=HEADERS).json()
    print(f"确认事件1: code={resp['code']}")

    # 驳回第二个事件
    if len(events) > 1:
        resp = requests.put(f"{BASE}/admin/events/{events[1]['id']}/reject", headers=HEADERS).json()
        print(f"驳回事件2: code={resp['code']}")

# ========================
# 6. 创建认领（用户）
# ========================
print("\n=== 6. 创建认领申请 ===")

if animals:
    resp = requests.post(f"{BASE}/claims", json={
        "animal_id": animals[0]["id"],
        "event_id": events[0]["id"] if events else None,
        "notes": "这是我家走失的豆豆，三个月前从家里跑出去，佩戴蓝色项圈，尾巴尖有一点白毛",
        "contact_method": "phone",
        "contact_value": "13800000002"
    }, headers=USER_HEADERS).json()
    print(f"认领申请: code={resp['code']}, claim_id={resp['data']['claim_id'] if resp['code']==0 else resp.get('message')}")
    claim_id = resp["data"]["claim_id"] if resp["code"] == 0 else None

    # 管理端审批认领
    if claim_id:
        resp = requests.put(f"{BASE}/admin/claims/{claim_id}/approve", headers=HEADERS).json()
        print(f"审批认领: code={resp['code']}")

        # 更新动物状态为 claimed
        resp = requests.put(f"{BASE}/admin/animals/{animals[0]['id']}", json={
            "status": "claimed"
        }, headers=HEADERS).json()
        print(f"更新动物状态为claimed: code={resp['code']}")

# ========================
# 7. 打印统计
# ========================
print("\n=== 7. 管理端统计 ===")
resp = requests.get(f"{BASE}/admin/stats", headers=HEADERS).json()
print(f"统计: {json.dumps(resp['data'], ensure_ascii=False, indent=2)}")

print("\n=== 测试数据准备完成 ===")
print(f"动物数: {len(animals)}")
print(f"鼻纹样本: {len(nose_ids)}")
print(f"事件数: {len(events)}")