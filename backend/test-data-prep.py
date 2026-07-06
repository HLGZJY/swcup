#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
按 2026-07-03-test-scenario-design.md §3-§5 准备测试数据。
步骤:
  1. 通过 backend /v1/nose/collect 上传 8 张鼻纹图(aa1/3/4/5/7/8/9/10),获得 vector_id
  2. 通过 SQL 插入 10 只动物(A1-A10),primary_nose_id 指向步骤 1 的 vector_id
"""
import base64
import json
import os
import sys
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

BE_BASE = 'http://localhost:3000'
TEST_DIR = r'F:\swcup2026\test_data\测试批'

# (动物编号, 鼻纹图, 动物图, 名字, 种类, 品种, 颜色, 性别, 年龄, 健康, 绝育, 状态, lat, lng, 地址, 备注, tags, 主人 user)
ANIMALS = [
    # A1 豆豆 (锚点1, lost, 静安公园) — 主人在 S1 创建, primary_nose_id 暂空
    ('A1', None, 'A1.jpg', '豆豆', 'dog', '金毛', '金色', 'male', 'adult', 'healthy', True, 'lost',
     31.2280, 121.4470, '上海市静安区南京西路 1788 号(静安公园)', '佩戴蓝色项圈,尾巴尖有白毛,亲人',
     '["走失","佩戴项圈","亲人"]', 'utestu01-0001-0000-0000-000000000020'),
    # A2 豆豆二次发现 (同A1区 ~80m, lost)
    ('A2', None, 'A2.jpg', '豆豆(二次发现)', 'dog', '金毛', '金色', 'male', 'adult', 'healthy', True, 'lost',
     31.2285, 121.4475, '上海市静安区南京西路 1788 号(静安公园)', '同豆豆,二次发现',
     '["走失","二次发现"]', 'utestu01-0001-0000-0000-000000000020'),
    # A3 大黄 (浦东金桥, lost)
    ('A3', 'aa3.jpg', 'A3.jpg', '大黄', 'dog', '拉布拉多', '黄色', 'male', 'adult', 'injured', True, 'lost',
     31.2550, 121.5950, '上海市浦东新区金桥路 200 号', '右后腿受伤,行走缓慢,急需救助',
     '["走失","受伤","急需救助"]', 'utestu02-0001-0000-0000-000000000021'),
    # A4 小白 (虹口四川北路, found)
    ('A4', 'aa4.jpg', 'A4.jpg', '小白', 'dog', '萨摩耶', '白色', 'male', 'adult', 'healthy', True, 'found',
     31.2650, 121.4980, '上海市虹口区四川北路 1888 号', '路边徘徊,穿红色背心,疑似走失',
     '["捡到","待认领"]', 'utestu03-0001-0000-0000-000000000022'),
    # A5 旺财 (徐汇衡山路, lost)
    ('A5', 'aa5.jpg', 'A5.jpg', '旺财', 'dog', '土狗', '棕色', 'female', 'adult', 'healthy', False, 'lost',
     31.1950, 121.4350, '上海市徐汇区衡山路 999 号', '左耳有缺口,温顺,旁边有狗粮',
     '["走失","温顺"]', 'utestu04-0001-0000-0000-000000000023'),
    # A6 旺财二次发现 (同A5区 ~100m, lost)
    ('A6', None, 'A6.jpg', '旺财(二次发现)', 'dog', '土狗', '棕色', 'female', 'adult', 'healthy', False, 'lost',
     31.1958, 121.4358, '上海市徐汇区衡山路 999 号', '同旺财,二次发现',
     '["走失","二次发现"]', 'utestu04-0001-0000-0000-000000000023'),
    # A7 花花 (长宁中山公园, lost)
    ('A7', 'aa7.jpg', 'A7.jpg', '花花', 'dog', '边牧', '黑白', 'female', 'adult', 'healthy', True, 'lost',
     31.2200, 121.4180, '上海市长宁区中山公园', '走失 3 天,已联系主人认领',
     '["走失","已联系"]', 'utestu03-0001-0000-0000-000000000022'),
    # A8 黑妞 (闵行莘庄, found)
    ('A8', 'aa8.jpg', 'A8.jpg', '黑妞', 'dog', '柴犬', '黑色', 'female', 'adult', 'healthy', False, 'found',
     31.1100, 121.3820, '上海市闵行区莘庄镇莘建路 88 号', '棕色围脖,警觉,不让人靠近,需专业救助',
     '["捡到","警觉","需救助"]', 'utestu04-0001-0000-0000-000000000023'),
    # A9 咪咪 (跨物种同A1位置, lost)
    ('A9', 'aa9.jpg', 'A9.png', '咪咪', 'cat', '中华田园猫', '橘色', 'male', 'adult', 'healthy', False, 'lost',
     31.2280, 121.4470, '上海市静安区南京西路 1788 号(静安公园)', '橘色狸花,胖胖的,佩戴粉色项圈',
     '["走失","佩戴项圈"]', 'utestu05-0001-0000-0000-000000000024'),
    # A10 团子 (普陀长寿路, claimed)
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


def upload_nose(nose_filename, token):
    """调用 /v1/nose/collect,返回 vector_id"""
    img_path = os.path.join(TEST_DIR, nose_filename)
    with open(img_path, 'rb') as f:
        img_b64 = base64.b64encode(f.read()).decode()
    payload = {
        'nose_photo': img_b64,
        'location_lat': 31.2280,
        'location_lng': 121.4470,
        'description': f'pre-record {nose_filename}',
    }
    code, resp = post_json(f'{BE_BASE}/v1/nose/collect', payload, token)
    if code == 201 and resp.get('code') == 0:
        return resp['data']['vector_id']
    else:
        print(f"  !! upload {nose_filename} failed: code={code} resp={resp}")
        return None


def main():
    # 用任意一个user token来上传鼻纹(无需特定归属,反正后续 SQL 关联)
    import subprocess
    node_script = (
        "const jwt = require('jsonwebtoken');"
        "console.log(jwt.sign("
        "{ user_id: 'utestu01-0001-0000-0000-000000000020', role: 'user' },"
        "'swcup2026_nose_rescue_jwt_secret_key',"
        "{ expiresIn: '7d' }));"
    )
    user1_token = subprocess.check_output(
        ['node', '-e', node_script],
        cwd='F:\\swcup2026\\backend'
    ).decode().strip()
    print(f"user1 token len: {len(user1_token)}")

    # 1. 上传 8 张鼻纹图,获取 vector_id
    nose_v = {}
    nose_animal_pairs = [
        ('aa1.jpg', 'A1'),   # A1 鼻纹 (S2 才会用到,但先存好)
        ('aa3.jpg', 'A3'),
        ('aa4.jpg', 'A4'),
        ('aa5.jpg', 'A5'),
        ('aa7.jpg', 'A7'),
        ('aa8.jpg', 'A8'),
        ('aa9.jpg', 'A9'),
        ('aa10.jpg', 'A10'),
    ]
    print("\n=== Step 1: 上传 8 张鼻纹 ===")
    for nose_file, animal_code in nose_animal_pairs:
        v = upload_nose(nose_file, user1_token)
        if v:
            nose_v[animal_code] = v
            print(f"  {nose_file} -> {animal_code}: vector_id={v}")
        else:
            print(f"  {nose_file} -> FAILED")

    # 2. 生成 SQL 插入 10 只动物
    print("\n=== Step 2: 生成 SQL ===")
    # 把 nose_v 写入临时 JSON,稍后让另一段 SQL 脚本读取
    with open(r'F:\swcup2026\backend\.nose_v.json', 'w', encoding='utf-8') as f:
        json.dump(nose_v, f, ensure_ascii=False, indent=2)
    print(f"  wrote nose_v.json ({len(nose_v)} entries)")


if __name__ == '__main__':
    main()