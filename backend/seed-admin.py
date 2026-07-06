#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性写入 admin 测试账号 13900000088 / test1234 / role=admin"""
import bcrypt
import json
import sys
import uuid

import pymysql

sys.stdout.reconfigure(encoding='utf-8')

PHONE = '13900000088'
PASSWORD = 'test1234'
NICKNAME = '测试管理员'
ROLE = 'admin'

DB_KW = dict(host='127.0.0.1', port=3307, user='root',
             password='rootpassword', database='nose_rescue', charset='utf8mb4')

conn = pymysql.connect(**DB_KW)
cur = conn.cursor()

# 1) 删旧(若存在)
cur.execute("DELETE FROM users WHERE phone=%s", (PHONE,))
deleted = cur.rowcount
print(f"清理旧账号: {deleted} 行")

# 2) 重新插
user_id = str(uuid.uuid4())
password_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(10)).decode()
sql = """INSERT INTO users (user_id, phone, password_hash, nickname, role, agreed_privacy_at, created_at, updated_at)
         VALUES (%s, %s, %s, %s, %s, NOW(), NOW(), NOW())"""
cur.execute(sql, (user_id, PHONE, password_hash, NICKNAME, ROLE))
conn.commit()

print(f"已插入 admin 账号:")
print(f"  user_id    = {user_id}")
print(f"  phone      = {PHONE}")
print(f"  password   = {PASSWORD}")
print(f"  nickname   = {NICKNAME}")
print(f"  role       = {ROLE}")

# 3) 校验
cur.execute("SELECT user_id, phone, nickname, role FROM users WHERE phone=%s", (PHONE,))
row = cur.fetchone()
print(f"\n数据库核对: {row}")
conn.close()
