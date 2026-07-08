/**
 * Defect 3 (2026-07-08): pending-animal-request 允许 nose_vector_id 为空
 *
 * 场景:
 *   用户走失时没拍鼻纹, collect 返回 next_action='ask_user_confirm',
 *   用户在 result.vue 点击 "创建档案" → POST /v1/nose/pending-animal-request
 *   nose_vector_id 此时是空 (前端的 `null` 字符串化后是 'null'/'undefined')
 *
 * 期望行为:
 *   - nose_vector_id=null/'null'/'undefined'/缺省 → 不抛错,写一条 vector_id=NULL 的 pending
 *   - 正常字段入表(breed/color/photos/... 仍按要求)
 *   - 响应里 vector_id 字段返回 null (不是 'null' 字符串)
 *
 * RED (修复前):
 *   - nose.service.ts 没有 sanitize, dto.nose_vector_id='null' 直入库 → MySQL varchar(36) 接受
 *     但语义错 (字段里污染了字符串 'null',后续按值查找 IS NULL 永远查不到)
 *   - PendingNoseRecord.vector_id @Column 是 NOT NULL, dto 直接写 'null' 仍能写入
 *
 * GREEN (修复后):
 *   - service 显式映射 'null'/'undefined'/'非字符串' → null 落库
 *   - entity column 改 nullable,前端 'null' 字符串不会污染 DB
 *   - 响应 vector_id 字段返回 null
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const API = '/v1';

test.describe('Defect 3: pending-animal-request 无鼻纹场景 (Bug A)', () => {

  test('nose_vector_id 缺省 → 应返回 200, 响应 vector_id=null', async ({ request }) => {
    const loginRes = await request.post(`${BASE_URL}${API}/auth/login`, {
      data: { phone: '13900000001', password: 'admin123' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { data: { token } } = await loginRes.json();

    const res = await request.post(`${BASE_URL}${API}/nose/pending-animal-request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        // 故意不带 nose_vector_id — 模拟"用户走失未拍鼻纹"场景
        species: 'dog',
        breed: '土松',
        color: '橙黄',
        gender: 'male',
        location_lat: 32.62918,
        location_lng: 110.79801,
        photos: ['/static/uploads/1783489422947_7auzhvlf.jpg'],
        intent: 'lost',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    // 响应里 vector_id 应是 null, 不是字符串 'null'
    expect(body?.data?.vector_id).toBeNull();
    // record_id 应正常生成
    expect(body?.data?.record_id).toBeTruthy();
  });

  test('nose_vector_id="null" 字符串 → 应映射为 null (前端 sanitize)', async ({ request }) => {
    const loginRes = await request.post(`${BASE_URL}${API}/auth/login`, {
      data: { phone: '13900000001', password: 'admin123' },
    });
    const { data: { token } } = await loginRes.json();

    const res = await request.post(`${BASE_URL}${API}/nose/pending-animal-request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nose_vector_id: 'null',  // 前端 JS `${null}` 字符串化的产物
        species: 'dog',
        breed: '土松',
        color: '橙黄',
        gender: 'male',
        location_lat: 32.62918,
        location_lng: 110.79801,
        photos: ['/static/uploads/1783489422947_7auzhvlf.jpg'],
        intent: 'lost',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body?.data?.vector_id).toBeNull();
  });

  test('nose_vector_id="undefined" 字符串 → 同样映射为 null', async ({ request }) => {
    const loginRes = await request.post(`${BASE_URL}${API}/auth/login`, {
      data: { phone: '13900000001', password: 'admin123' },
    });
    const { data: { token } } = await loginRes.json();

    const res = await request.post(`${BASE_URL}${API}/nose/pending-animal-request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nose_vector_id: 'undefined',
        species: 'dog',
        breed: '土松',
        color: '橙黄',
        gender: 'male',
        location_lat: 32.62918,
        location_lng: 110.79801,
        intent: 'found',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body?.data?.vector_id).toBeNull();
  });
});
