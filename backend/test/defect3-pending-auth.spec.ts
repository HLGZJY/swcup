/**
 * Defect 3 (2026-07-08): pending-animal-request 未携带 token 应被 JWT 拒绝
 *
 * 根因:
 *   nose.controller.ts:38 pending-animal-request 被加了 @Public()
 *   → JwtAuthGuard 短路 → req.user.user_id 永远 undefined
 *   → nose.service.ts:558 抛 400 "请先登录后再提交动物档案"
 *   但 400 让前端误以为是业务校验失败,不是鉴权失败,体验混乱
 *
 * 期望行为:
 *   无 token / 无效 token → 401 Unauthorized(标准 JWT 行为)
 *   有效 token → 进 service 校验 user_id(后续业务逻辑)
 *
 * TDD 流程:
 *   RED: 本测试期望无 token 返回 401,当前实现返回 400
 *   GREEN: 移除 @Public() 装饰器
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const API = '/v1';

test.describe('Defect 3: pending-animal-request 必须鉴权', () => {

  test('无 token 提交应返回 401 (修复前返回 400,证明 @Public() 误开)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}${API}/nose/pending-animal-request`, {
      // 不带 Authorization header
      data: {
        species: 'dog',
        breed: 'shiba',
        color: 'yellow',
        gender: 'male',
        location_lat: 31.22,
        location_lng: 121.44,
        nose_vector_id: 'v-test-no-auth',
      },
    });
    // 期望 401 (标准 JWT 拒绝),不是 400 (业务校验错)
    expect(res.status()).toBe(401);
  });

  test('有效 token 提交 → user_id 应被注入到 service 调用', async ({ request }) => {
    // 先登录拿 token
    const loginRes = await request.post(`${BASE_URL}${API}/auth/login`, {
      data: {
        phone: '13900000001',
        password: 'admin123',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginJson = await loginRes.json();
    const token = loginJson?.data?.token;
    expect(token).toBeTruthy();

    // 带 token 调用: 业务字段不全应抛 400,但不再是 "请先登录" (说明 user_id 已注入)
    const res = await request.post(`${BASE_URL}${API}/nose/pending-animal-request`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        // 故意缺 location_lat/lng,触发"缺少位置信息"的业务校验
        species: 'dog',
        breed: 'shiba',
        nose_vector_id: 'v-test-with-auth',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    // 不再是 "请先登录后再提交动物档案" — 说明已过了鉴权层
    expect(body?.message).not.toContain('请先登录');
  });
});