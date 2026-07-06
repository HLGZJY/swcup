#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""再写入一个 admin 账号 13900000001 / admin123"""
import sys
import uuid
import bcrypt
import pymysql

sys.stdout.reconfigure(encoding='utf-8')

PHONE = '13900000001'
PASSWORD = 'admin123'
NICKNAME = '管理员二号'
ROLE = 'admin'

conn = pymysql.connect(host='127.0.0.1', port=3307, user='root',
                      password='rootpassword', database='nose_rescue',
                      charset='utf8mb4')
cur = conn.cursor()
cur.execute("DELETE FROM users WHERE phone=%s", (PHONE,))
print(f"清理旧账号: {cur.rowcount} 行")

uid = str(uuid.uuid4())
ph = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(10)).decode()
cur.execute("""INSERT INTO users (user_id, phone, password_hash, nickname, role, agreed_privacy_at, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, NOW(), NOW(), NOW())""",
            (uid, PHONE, ph, NICKNAME, ROLE))
conn.commit()

cur.execute("SELECT user_id, phone, nickname, role FROM users WHERE phone=%s", (PHONE,))
print(f"已写入: {cur.fetchone()}")
conn.close()
