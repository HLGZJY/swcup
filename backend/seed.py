#!/usr/bin/env python3
"""
鼻纹智救 - 数据库填充脚本
直接在数据库中写入完整数据，不依赖后端 API
用法: python seed.py
"""
import uuid
import random
import hashlib
from datetime import datetime, timedelta
import pymysql
import json

# ─── 配置 ───────────────────────────────────────────────
DB_HOST = '127.0.0.1'
DB_PORT = 3307
DB_USER = 'root'
DB_PASSWORD = 'rootpassword'
DB_NAME = 'nose_rescue'

# ─── 连接 ───────────────────────────────────────────────
conn = pymysql.connect(
    host=DB_HOST, port=DB_PORT, user=DB_USER,
    password=DB_PASSWORD, database=DB_NAME,
    charset='utf8mb4', autocommit=True
)
cur = conn.cursor()

def uid(prefix=''):
    return f"{prefix}{str(uuid.uuid4())[:8]}-{str(uuid.uuid4())[:4]}-{str(uuid.uuid4())[:4]}-{str(uuid.uuid4())[:4]}-{str(uuid.uuid4())[:12]}"

def random_buffer(dim=128):
    """生成随机 128 维特征向量（模拟真实鼻纹特征）"""
    import numpy as np
    vec = np.random.rand(dim).astype(np.float32)
    vec = vec / (np.linalg.norm(vec) + 1e-8)
    return vec.tobytes()

def ts(days_ago=0, hours_ago=0):
    return (datetime.now() - timedelta(days=days_ago, hours=hours_ago)).strftime('%Y-%m-%d %H:%M:%S')

# ─── 1. 清空所有表 ──────────────────────────────────────
print("=== 1. 清空数据 ===")
cur.execute("SET FOREIGN_KEY_CHECKS = 0")
for t in ['nose_features', 'claims', 'rescue_events', 'animals', 'users']:
    cur.execute(f"TRUNCATE TABLE {t}")
cur.execute("SET FOREIGN_KEY_CHECKS = 1")
print("  所有表已清空")

# ─── 2. 创建用户 ────────────────────────────────────────
print("\n=== 2. 创建用户 ===")
users = [
    ('admin',  '13900000001', '管理员A',     'admin'),
    ('user1',  '13800000002', '李明',         'user'),
    ('user2',  '13800000003', '王小红',       'user'),
    ('user3',  '13800000004', '张小华',       'user'),
    ('user4',  '13800000005', '陈建国',       'user'),
    ('user5',  '13800000006', '刘秀英',       'user'),
    ('user6',  '13800000007', '赵大力',       'user'),
    ('user7',  '13800000008', '周小燕',       'user'),
    ('org1',   '13800000010', '上海宠物救助站', 'org'),
    ('org2',   '13800000011', '北京流浪动物保护中心', 'org'),
]

user_ids = {}
for key, phone, nickname, role in users:
    uid_val = uid()
    cur.execute(
        "INSERT INTO users (user_id, nickname, phone, role, created_at, updated_at) "
        "VALUES (%s,%s,%s,%s,%s,%s)",
        (uid_val, nickname, phone, role, ts(30), ts())
    )
    user_ids[key] = uid_val
    print(f"  [{role:5}] {nickname} ({phone}) → {uid_val[:8]}...")

admin_id = user_ids['admin']
user1_id = user_ids['user1']
user2_id = user_ids['user2']

# ─── 3. 创建动物档案 ────────────────────────────────────
print("\n=== 3. 创建动物档案 ===")

animals_data = [
    # 走失狗
    dict(name="豆豆",   species="dog", breed="金毛",      color="金色",   gender="male",   age="adult", health="healthy", sterilized=True,  status="lost",    lat=31.2304, lng=121.4737, addr="上海市静安区南京西路1788号",    notes="走失时佩戴蓝色项圈，尾巴尖有白毛，很亲人",    tags=["走失", "佩戴项圈", "亲人"], days_ago=5),
    dict(name="旺财",   species="dog", breed="土狗",       color="棕色",   gender="female", age="adult", health="healthy", sterilized=False, status="lost",    lat=31.2404, lng=121.4837, addr="上海市静安区北京西路100号",       notes="左耳有缺口，很温顺，旁边有狗粮",             tags=["走失", "温顺"], days_ago=3),
    dict(name="小白",   species="dog", breed="萨摩耶",     color="白色",   gender="male",   age="young", health="healthy", sterilized=True,  status="lost",    lat=31.2504, lng=121.4937, addr="上海市静安区华山路88号",         notes="走失时穿红色背心，很干净，毛发洁白",          tags=["走失", "穿背心"], days_ago=2),
    dict(name="大黄",   species="dog", breed="拉布拉多",   color="黄色",   gender="male",   age="adult", health="injured", sterilized=True,  status="lost",    lat=31.2604, lng=121.5037, addr="上海市浦东新区世纪大道200号",    notes="右后腿受伤，行走缓慢，急需救助",             tags=["走失", "受伤", "急需救助"], days_ago=1),
    dict(name="黑妞",   species="dog", breed="柴犬",       color="黑色",   gender="female", age="adult", health="healthy", sterilized=False, status="lost",    lat=31.2104, lng=121.4637, addr="上海市徐汇区淮海中路999号",       notes="棕色围脖，很警觉，不让人靠近",               tags=["走失", "警觉"], days_ago=4),
    # 已找到/已认领狗
    dict(name="花花",   species="dog", breed="边牧",       color="黑白",   gender="female", age="adult", health="healthy", sterilized=True,  status="claimed", lat=31.2204, lng=121.4537, addr="上海市长宁区延安西路100号",       notes="被人捡到，已联系主人认领",                   tags=["捡到", "已认领"], days_ago=10),
    dict(name="来福",   species="dog", breed="柯基",       color="黄白",   gender="male",   age="puppy", health="healthy", sterilized=False, status="found",   lat=31.2704, lng=121.5137, addr="上海市闵行区莘庄镇莘建路88号",    notes="走失小狗，在路边徘徊，疑似走失",             tags=["捡到", "待认领"], days_ago=6),
    # 走失猫
    dict(name="咪咪",   species="cat", breed="中华田园猫", color="橘色",   gender="male",   age="adult", health="healthy", sterilized=False, status="lost",    lat=31.2304, lng=121.4637, addr="上海市静安区新闸路200号",         notes="橘色狸花，胖胖的，佩戴粉色项圈",             tags=["走失", "佩戴项圈"], days_ago=7),
    dict(name="团子",   species="cat", breed="英短",       color="蓝灰色", gender="female", age="adult", health="ill",    sterilized=True,  status="lost",    lat=31.2404, lng=121.4737, addr="上海市静安区昌平路50号",          notes="英短蓝猫，眼睛有分泌物，需治疗",             tags=["走失", "生病"], days_ago=3),
    dict(name="雪球",   species="cat", breed="波斯猫",     color="白色",   gender="male",   age="senior",health="healthy", sterilized=True,  status="found",   lat=31.2504, lng=121.4837, addr="上海市静安区江宁路88号",          notes="纯白波斯猫，很温顺，在小区内徘徊",           tags=["捡到", "待找主人"], days_ago=8),
]

animal_ids = {}
for i, a in enumerate(animals_data):
    aid = uid('a')
    first_seen = ts(days_ago=a['days_ago']+2)
    last_seen  = ts(days_ago=a['days_ago'])
    cur.execute(
        "INSERT INTO animals (animal_id, status, species, breed, color, gender, age_estimate, health_status, sterilized, first_seen_at, last_seen_at, location_lat, location_lng, address, notes, tags, photos, created_at, updated_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (aid, a['status'], a['species'], a['breed'], a['color'], a['gender'],
         a['age'], a['health'], a['sterilized'], first_seen, last_seen,
         a['lat'], a['lng'], a['addr'], a['notes'],
         json.dumps(a['tags']), json.dumps([]), ts(), ts())
    )
    animal_ids[i] = {'id': aid, 'name': a['name']}
    print(f"  [{a['status']:7}] {a['name']} ({a['species']} {a['breed']}) → {aid[:8]}...")

# ─── 4. 创建鼻纹特征 ────────────────────────────────────
print("\n=== 4. 创建鼻纹特征 ===")

nose_photo_pool = [
    '/static/uploads/nose/dog_001.jpg', '/static/uploads/nose/dog_002.jpg',
    '/static/uploads/nose/dog_003.jpg', '/static/uploads/nose/dog_004.jpg',
    '/static/uploads/nose/dog_005.jpg', '/static/uploads/nose/cat_001.jpg',
    '/static/uploads/nose/cat_002.jpg', '/static/uploads/nose/cat_003.jpg',
]

# 每个动物 3-5 个鼻纹样本
nose_ids = {}
sample_count = 0
for i, a in enumerate(animals_data):
    n_ids = []
    for j in range(random.randint(3, 5)):
        vid = uid('v')
        is_primary = (j == 0)
        cur.execute(
            "INSERT INTO nose_features (vector_id, animal_id, feature_vector, vector_dimension, nose_photo_url, landmark_data, confidence_score, is_primary, collection_angle, model_version, liveness_check_passed, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (vid, animal_ids[i]['id'],
             random_buffer(128), 128,
             random.choice(nose_photo_pool),
             json.dumps({'landmarks': [], 'bbox': [100, 100, 200, 200]}),
             round(random.uniform(0.82, 0.98), 4),
             is_primary,
             random.choice(['front', 'left', 'right']),
             'v1.0.0',
             random.choice([True, True, True]),  # 70%活体通过
             ts(days_ago=a['days_ago']+1, hours_ago=random.randint(0, 12))
            )
        )
        n_ids.append(vid)
        sample_count += 1
    nose_ids[i] = n_ids
    # 随机选一个主鼻纹
    primary_nose = n_ids[0]
    cur.execute("UPDATE animals SET primary_nose_id=%s WHERE animal_id=%s", (primary_nose, animal_ids[i]['id']))
    print(f"  {a['name']}: {len(n_ids)} 个鼻纹样本 (primary: {primary_nose[:8]}...)")

print(f"  共创建 {sample_count} 条鼻纹特征")

# ─── 5. 创建救助事件 ────────────────────────────────────
print("\n=== 5. 创建救助事件 ===")

events_data = [
    # 走失上报
    dict(type="report", animal_i=0, reporter='user1', status="confirmed",  dup=False,  desc="在小区内发现一只金毛犬，疑似走失，佩戴蓝色项圈，尾巴尖有白毛，很亲人",         lat=31.2304, lng=121.4737, addr="上海市静安区南京西路1788号", days_ago=5),
    dict(type="report", animal_i=1, reporter='user2', status="confirmed",  dup=True,   desc="路边发现一只棕色土狗，很温顺，左耳有缺口，旁边有狗粮，疑似走失",                     lat=31.2404, lng=121.4837, addr="上海市静安区北京西路100号",   days_ago=3),
    dict(type="report", animal_i=2, reporter='user3', status="pending",    dup=False,  desc="小区门口发现一只萨摩耶，很干净，走失时穿红色背心，看起来很着急",                           lat=31.2504, lng=121.4937, addr="上海市静安区华山路88号",       days_ago=2),
    dict(type="report", animal_i=3, reporter='user4', status="confirmed",  dup=False,  desc="发现一只拉布拉多右后腿受伤，行走缓慢，趴在路边不动，急需救助",                               lat=31.2604, lng=121.5037, addr="上海市浦东新区世纪大道200号",  days_ago=1),
    dict(type="report", animal_i=4, reporter='user5', status="pending",    dup=False,  desc="发现一只黑色柴犬，棕色围脖，很警觉，不让人靠近，在小区内徘徊",                             lat=31.2104, lng=121.4637, addr="上海市徐汇区淮海中路999号",    days_ago=4),
    # 捡到上报
    dict(type="report", animal_i=5, reporter='user6', status="resolved",   dup=False,  desc="在小区内捡到一只边牧，黑色白色，已联系主人认领",                                               lat=31.2204, lng=121.4537, addr="上海市长宁区延安西路100号",   days_ago=10),
    dict(type="report", animal_i=6, reporter='user7', status="pending",    dup=False,  desc="路边发现一只柯基，走失小狗，在路边徘徊，疑似与主人走散",                                         lat=31.2704, lng=121.5137, addr="上海市闵行区莘庄镇莘建路88号", days_ago=6),
    # 猫
    dict(type="report", animal_i=7, reporter='user1', status="confirmed",  dup=False,  desc="小区内发现一只橘色狸花猫，胖胖的，佩戴粉色项圈，在垃圾桶旁边找吃的",                       lat=31.2304, lng=121.4637, addr="上海市静安区新闸路200号",    days_ago=7),
    dict(type="report", animal_i=8, reporter='user2', status="pending",    dup=False,  desc="发现一只英短蓝猫，眼睛有分泌物，精神不佳，疑似生病，需送医治疗",                               lat=31.2404, lng=121.4737, addr="上海市静安区昌平路50号",     days_ago=3),
    dict(type="report", animal_i=9, reporter='user3', status="pending",    dup=False,  desc="小区内发现一只纯白波斯猫，很温顺，在长椅上晒太阳，疑似走失",                                   lat=31.2504, lng=121.4837, addr="上海市静安区江宁路88号",     days_ago=8),
    # 额外待处理事件
    dict(type="report", animal_i=None, reporter='user4', status="pending", dup=False, desc="路边发现一只哈士奇，蓝色眼睛，胖胖的，很亲人，在路边找水喝",                               lat=31.2804, lng=121.5237, addr="上海市浦东新区张江镇碧波路",  days_ago=1),
    dict(type="report", animal_i=None, reporter='user5', status="pending", dup=False, desc="小区内发现一只泰迪，棕色，剪了造型，很干净，疑似走失",                                     lat=31.2304, lng=121.4837, addr="上海市静安区陕西北路100号",   days_ago=2),
    dict(type="rescue", animal_i=None, reporter='org1', status="pending", dup=False, desc="救助站收容一只流浪金毛，身体健康，性格温顺，待领养",                                         lat=31.3000, lng=121.5500, addr="上海市闵行区救助站",         days_ago=2),
    dict(type="medical",animal_i=None, reporter='org2', status="pending", dup=False, desc="收容一只受伤流浪猫，左前腿骨折，已送医治疗，急需手术费",                                     lat=31.2500, lng=121.5100, addr="北京朝阳区流浪动物保护中心",  days_ago=1),
    dict(type="report", animal_i=None, reporter='user6', status="pending", dup=False, desc="在公园发现一只松狮，棕色毛发打结，很脏，疑似被遗弃",                                        lat=31.2604, lng=121.4937, addr="上海市静安区静安公园",        days_ago=3),
]

event_ids = {}
for i, e in enumerate(events_data):
    eid = uid('e')
    animal_id = animal_ids[e['animal_i']]['id'] if e['animal_i'] is not None else None
    reporter_id = user_ids[e['reporter']]
    occurred_at = ts(days_ago=e['days_ago'], hours_ago=random.randint(8, 18))
    fusion_score = round(random.uniform(0.80, 0.97), 4) if e['status'] in ('confirmed', 'resolved') else None

    cur.execute(
        "INSERT INTO rescue_events (event_id, animal_id, event_type, reporter_id, station_id, occurred_at, location_lat, location_lng, address, photos, nose_photo_url, description, action_taken, is_duplicate, duplicate_of, fusion_score, status, created_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (eid, animal_id, e['type'], reporter_id, None, occurred_at,
         e['lat'], e['lng'], e['addr'],
         json.dumps([]), None, e['desc'], None,
         e['dup'], None, fusion_score, e['status'], ts())
    )
    event_ids[i] = eid
    print(f"  [{e['status']:10}] {e['type']:8} {e['desc'][:30]}... → {eid[:8]}...")

# ─── 6. 创建认领记录 ────────────────────────────────────
print("\n=== 6. 创建认领记录 ===")

claims_data = [
    # 用户认领自己的走失狗
    dict(animal_i=0, claimer='user1', event_i=0,  status="approved",  notes="这是我家走失的豆豆，三个月前从家里跑出去，佩戴蓝色项圈，尾巴尖有白毛，请好心人归还，必有重谢！"),
    dict(animal_i=5, claimer='user6', event_i=5,  status="approved",  notes="花花是我家的边牧，走失了3天，感谢好心人收留！"),
    # 待审批认领
    dict(animal_i=2, claimer='user3', event_i=2,  status="pending",   notes="小白是我家走失的萨摩耶，穿红色背心，走失2天了，非常着急，拜托好心人收留！"),
    dict(animal_i=7, claimer='user1', event_i=7,  status="pending",   notes="咪咪是我家的橘猫，胖胖的，佩戴粉色项圈，走失一周了，全家都很着急！"),
    dict(animal_i=6, claimer='user7', event_i=6,  status="pending",   notes="来福是我家的小柯基，走失了，昨天还在附近看到过，拜托大家帮忙留意！"),
    # 被驳回
    dict(animal_i=1, claimer='user2', event_i=1,  status="rejected",  notes="这只土狗看起来像我家的，但项圈颜色不对，也没有左耳缺口，不是我的狗"),
    dict(animal_i=4, claimer='user5', event_i=4,  status="rejected",  notes="我家的柴犬是黑色的，但这只黑色柴犬的围脖是棕色的，应该不是同一只"),
]

for c in claims_data:
    cid = uid('c')
    claimer_id = user_ids[c['claimer']]
    event_id = event_ids[c['event_i']]
    cur.execute(
        "INSERT INTO claims (claim_id, animal_id, claimer_id, event_id, claimed_at, status, notes, proof_photos, approved_by, approved_at, created_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (cid, animal_ids[c['animal_i']]['id'], claimer_id, event_id,
         ts(days_ago=random.randint(0, 3)),
         c['status'], c['notes'],
         json.dumps([]),
         admin_id if c['status'] == 'approved' else None,
         ts() if c['status'] == 'approved' else None,
         ts())
    )
    print(f"  [{c['status']:8}] {c['notes'][:35]}...")

# ─── 7. 统计 ───────────────────────────────────────────
print("\n=== 7. 数据统计 ===")
tables = ['users', 'animals', 'nose_features', 'rescue_events', 'claims']
for t in tables:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    cnt = cur.fetchone()[0]
    print(f"  {t}: {cnt} 条")

print("\n✅ 数据填充完成！")
print(f"\n测试账号:")
print(f"  管理员: 13900000001 / password123 (role=admin)")
print(f"  用户1:  13800000002 / password123 (role=user)")
print(f"  用户2:  13800000003 / password123 (role=user)")
print(f"  机构:   13800000010 / password123 (role=org)")

cur.close()
conn.close()
