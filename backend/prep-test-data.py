#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一次性预录入脚本(2026-07-06 模拟机测试专用)
- 上传 8 张鼻纹图(aa1/3/4/5/7/8/9/10)写入 nose_features
- 写 SQL 把 10 只动物插入 animals,primary_nose_id 指向已入库鼻纹
- 用户后续用模拟机 / admin 后台触发事件
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

BE_BASE = 'http://localhost:3000'
TEST_DIR = r'F:\swcup2026\test_data\测试批'

# (编号, 鼻纹图, 动物图, 名字, 种类, 品种, 颜色, 性别, 年龄, 健康, 绝育, 状态, lat, lng, 地址, 备注, tags, 主人 user_id)
ANIMALS = [
    ('A1', 'aa1.jpg', 'A1.jpg', '豆豆', 'dog', '金毛', '金色', 'male', 'adult', 'healthy', True, 'lost',
     31.2280, 121.4470, '上海市静安区南京西路 1788 号(静安公园)', '佩戴蓝色项圈,尾巴尖有白毛,亲人',
     '["走失","佩戴项圈","亲人"]', 'utestu01-0001-0000-0000-000000000020'),
    ('A2', None, 'A2.jpg', '豆豆(二次发现)', 'dog', '金毛', '金色', 'male', 'adult', 'healthy', True, 'lost',
     31.2285, 121.4475, '上海市静安区南京西路 1788 号(静安公园)', '同豆豆,二次发现(80m 内)',
     '["走失","二次发现"]', 'utestu01-0001-0000-0000-000000000020'),
    ('A3', 'aa3.jpg', 'A3.jpg', '大黄', 'dog', '拉布拉多', '黄色', 'male', 'adult', 'injured', True, 'lost',
     31.2550, 121.5950, '上海市浦东新区金桥路 200 号', '右后腿受伤,行走缓慢,急需救助',
     '["走失","受伤","急需救助"]', 'utestu02-0001-0000-0000-000000000021'),
    ('A4', 'aa4.jpg', 'A4.jpg', '小白', 'dog', '萨摩耶', '白色', 'male', 'puppy', 'healthy', True, 'found',
     31.2650, 121.4980, '上海市虹口区四川北路 1888 号', '路边徘徊,穿红色背心,疑似走失',
     '["捡到","待认领"]', 'utestu03-0001-0000-0000-000000000022'),
    ('A5', 'aa5.jpg', 'A5.jpg', '旺财', 'dog', '土狗', '棕色', 'female', 'adult', 'healthy', False, 'lost',
     31.1950, 121.4350, '上海市徐汇区衡山路 999 号', '左耳有缺口,温顺,旁边有狗粮',
     '["走失","温顺"]', 'utestu04-0001-0000-0000-000000000023'),
    ('A6', None, 'A6.jpg', '旺财(二次发现)', 'dog', '土狗', '棕色', 'female', 'adult', 'healthy', False, 'lost',
     31.1958, 121.4358, '上海市徐汇区衡山路 999 号', '同旺财,二次发现(100m 内)',
     '["走失","二次发现"]', 'utestu04-0001-0000-0000-000000000023'),
    ('A7', 'aa7.jpg', 'A7.jpg', '花花', 'dog', '边牧', '黑白', 'female', 'adult', 'healthy', True, 'lost',
     31.2200, 121.4180, '上海市长宁区中山公园', '走失 3 天,已联系主人认领',
     '["走失","已联系"]', 'utestu03-0001-0000-0000-000000000022'),
    ('A8', 'aa8.jpg', 'A8.jpg', '黑妞', 'dog', '柴犬', '黑色', 'female', 'adult', 'healthy', False, 'found',
     31.1100, 121.3820, '上海市闵行区莘庄镇莘建路 88 号', '棕色围脖,警觉,不让人靠近,需专业救助',
     '["捡到","警觉","需救助"]', 'utestu04-0001-0000-0000-000000000023'),
    ('A9', 'aa9.jpg', 'A9.png', '咪咪', 'cat', '中华田园猫', '橘色', 'male', 'adult', 'healthy', False, 'lost',
     31.2280, 121.4470, '上海市静安区南京西路 1788 号(静安公园)', '橘色狸花,胖胖的,佩戴粉色项圈',
     '["走失","佩戴项圈"]', 'utestu05-0001-0000-0000-000000000024'),
    ('A10', 'aa10.jpg', 'A10.jpg', '团子', 'cat', '英短', '蓝灰色', 'female', 'adult', 'ill', True, 'claimed',
     31.2500, 121.3950, '上海市普陀区长寿路 200 号', '英短蓝猫,眼睛有分泌物,需治疗',
     '["走失","生病"]', 'utestu05-0001-0000-0000-000000000024'),
]


def post_json(url, payload, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8', errors='replace'))


def get_token(user_id: str, role: str = 'user') -> str:
    node_script = (
        "const jwt = require('jsonwebtoken');"
        f"console.log(jwt.sign({{ user_id: '{user_id}', role: '{role}' }},"
        f" 'swcup2026_nose_rescue_jwt_secret_key', {{ expiresIn: '7d' }}));"
    )
    return subprocess.check_output(
        ['node', '-e', node_script],
        cwd=r'F:\swcup2026\backend'
    ).decode().strip()


def upload_nose(nose_filename, user_id, lat=31.2280, lng=121.4470):
    img_path = os.path.join(TEST_DIR, nose_filename)
    with open(img_path, 'rb') as f:
        img_b64 = base64.b64encode(f.read()).decode()
    # 用上报人本人 token,让 vector 关联到他名下
    token = get_token(user_id)
    payload = {
        'nose_photo': img_b64,
        'location_lat': lat,
        'location_lng': lng,
        'description': f'pre-record {nose_filename}',
    }
    code, resp = post_json(f'{BE_BASE}/v1/nose/collect', payload, token)
    if code in (200, 201) and resp.get('code') == 0:
        return resp['data']['vector_id']
    print(f"  !! nose/collect 失败 {nose_filename}: {code} {json.dumps(resp, ensure_ascii=False)[:200]}")
    return None


def upload_animal_photos(photo_filenames):
    """模拟上传动物照片,直接读 base64,不调真实接口;返回逗号分隔路径占位"""
    return json.dumps([f'/static/uploads/animals/{f}' for f in photo_filenames], ensure_ascii=False)


def main():
    # 1. 上传 8 张鼻纹
    print("\n=== Step 1: 采集 8 张鼻纹(预录入) ===")
    nose_pairs = [
        ('aa1.jpg', 'utestu01-0001-0000-0000-000000000020'),  # A1 by user1
        ('aa3.jpg', 'utestu02-0001-0000-0000-000000000021'),  # A3 by user2
        ('aa4.jpg', 'utestu03-0001-0000-0000-000000000022'),  # A4 by user3
        ('aa5.jpg', 'utestu04-0001-0000-0000-000000000023'),  # A5 by user4
        ('aa7.jpg', 'utestu03-0001-0000-0000-000000000022'),  # A7 by user3
        ('aa8.jpg', 'utestu04-0001-0000-0000-000000000023'),  # A8 by user4
        ('aa9.jpg', 'utestu05-0001-0000-0000-000000000024'),  # A9 by user5
        ('aa10.jpg', 'utestu05-0001-0000-0000-000000000024'),  # A10 by user5
    ]
    nose_v = {}
    for nose_file, uid in nose_pairs:
        v = upload_nose(nose_file, uid)
        if v:
            nose_v[nose_file.replace('aa', '').replace('.jpg', '')] = v  # '1' -> vector_id
            print(f"  {nose_file} -> vector_id={v}")

    # 2. 写 SQL 插入 10 只动物
    print("\n=== Step 2: 插入 10 只动物 ===")
    sql_lines = []
    for (code, nose_file, photo_file, name, species, breed, color, gender,
         age, health, sterilized, status, lat, lng, address, notes, tags, owner) in ANIMALS:
        # uuid 用 sql 在线生成,这里用伪 uuid 占位
        import uuid
        animal_uuid = str(uuid.uuid4())
        primary_nose = nose_v.get(code.replace('A', '')) if nose_file else 'NULL'
        photos_json = json.dumps([f'/static/uploads/animals/{photo_file}'], ensure_ascii=False)

        # 注意:报告人(reporter_id)和 owner 不直接存在 animals 表。user_id 仅注释用。
        sql = f"""INSERT INTO animals (
            animal_id, status, species, breed, color, gender,
            age_estimate, health_status, sterilized,
            first_seen_at, last_seen_at,
            location_lat, location_lng, address, notes, tags, photos,
            primary_nose_id, size, coat_length, ear_type, tail_type,
            created_at, updated_at
        ) VALUES (
            '{animal_uuid}', '{status}', '{species}', '{breed}', '{color}', '{gender}',
            '{age}', '{health}', {1 if sterilized else 0},
            NOW(), NOW(),
            {lat}, {lng},
            '{address}',
            '{notes.replace("'", "''")}',
            '{tags.replace("'", "''")}',
            '{photos_json.replace("'", "''")}',
            {f"'{primary_nose}'" if primary_nose != 'NULL' else 'NULL'},
            'medium', 'medium', 'erect', 'long',
            NOW(), NOW()
        );"""
        sql_lines.append(sql)
        # 把动物 UUID 也存到 nose_v.json 里备用
        nose_v[f'_animal_{code}'] = animal_uuid
        print(f"  {code} {name} ({species}/{breed}/{status}) -> {animal_uuid}")
        if primary_nose != 'NULL':
            print(f"       primary_nose_id={primary_nose}")

    # 3. 落盘
    sql_path = r'F:\swcup2026\backend\prep-test-data.sql'
    with open(sql_path, 'w', encoding='utf-8') as f:
        f.write('SET FOREIGN_KEY_CHECKS = 0;\n')
        # animals 已经被 TRUNCATE,但 nose_features 没动;为幂等,先清
        f.write("DELETE FROM nose_features WHERE nose_photo_url LIKE '/static/uploads/nose/pre%';\n")
        f.write('\n'.join(sql_lines) + '\n')
        f.write('SET FOREIGN_KEY_CHECKS = 1;\n')
    print(f"\n  wrote {sql_path} ({len(sql_lines)} INSERT)")

    # 4. 缓存鼻纹 vector_id 与动物 UUID 映射
    cache_path = r'F:\swcup2026\backend\.prep_cache.json'
    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(nose_v, f, ensure_ascii=False, indent=2)
    print(f"  wrote {cache_path} ({len(nose_v)} entries)")

    # 5. 执行 SQL — 用文件而非 stdin(避免 cp1252 中文编码问题)
    print("\n=== Step 3: 执行 SQL ===")
    r = subprocess.run(
        ['mysql', '-u', 'root', '-prootpassword', '-h', '127.0.0.1', '-P', '3307',
         'nose_rescue', '--default-character-set=utf8mb4'],
        stdin=open(sql_path, encoding='utf-8'),
        capture_output=True,
    )
    print(f"  mysql exit={r.returncode}")
    if r.stderr:
        try:
            err_text = r.stderr.decode('utf-8', errors='replace').strip()[:300]
            print(f"  stderr: {err_text}")
        except Exception:
            pass
    if r.stdout:
        try:
            out_text = r.stdout.decode('utf-8', errors='replace').strip()[:200]
            print(f"  stdout: {out_text}")
        except Exception:
            pass

    # 6. 统计
    print("\n=== Step 4: 最终统计 ===")
    r2 = subprocess.run(
        ['mysql', '-u', 'root', '-prootpassword', '-h', '127.0.0.1', '-P', '3307', 'nose_rescue', '-e',
         'SELECT COUNT(*) AS animals FROM animals;'
         'SELECT COUNT(*) AS nose_features FROM nose_features;'
         'SELECT COUNT(*) AS users FROM users;'],
        capture_output=True, text=True,
    )
    print(r2.stdout)


if __name__ == '__main__':
    main()
