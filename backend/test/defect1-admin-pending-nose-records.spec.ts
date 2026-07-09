/**
 * Defect 1 (2026-07-08): admin 待审核看不到「用户主动建档」记录
 *
 * 根因:
 *   用户提交 POST /v1/nose/pending-animal-request → 后端正确写入 pending_nose_records 表
 *   (source=USER_CREATE_REQUEST, status=pending, next_action=under_review)
 *   admin 后台 GET /admin/pending-nose-records → 数据能查到 (后端没问题)
 *   → admin miniapp 的 audit/index.vue 只查 rescue_events + claims + clues 三类,**完全不调**此接口
 *   → 用户提交后 admin 永远收不到审核工单
 *
 * 期望行为:
 *   用户提交待审档案 → admin 端 GET /admin/pending-nose-records 应返回该条记录
 *   列表中能看到 record_id / vector_id / species / breed / notes 全部字段
 *
 * TDD 流程:
 *   RED: 本测试构造一条带唯一标识 notes 的 pending 记录 → 调 admin 查询接口 → 断言能找到
 *   GREEN: 后端已经能查到 (这是后端 e2e,前端 UI 是单独章节) — 这条 spec 锁住后端契约,
 *          让后续实现 admin UI 时可以根据契约放心调接口
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const API = '/v1';

const USER_PHONE = '13900000099';
const USER_PWD = 'userpwd123';  // 密码规则: 字母+数字, 8 位以上
const ADMIN_PHONE = '13900000001';
const ADMIN_PWD = 'admin123';

test.describe('Defect 1: admin 端应能查到用户主动提交的待审档案', () => {

  test('用户 submit pending-animal-request → admin GET /admin/pending-nose-records 应返回该条', async ({ request }) => {
    // 1. 用户 (若不存在则注册)
    const userLogin = await request.post(`${BASE_URL}${API}/auth/login`, {
      data: { phone: USER_PHONE, password: USER_PWD },
    });
    if (!userLogin.ok()) {
      await request.post(`${BASE_URL}${API}/auth/register`, {
        data: { phone: USER_PHONE, password: USER_PWD, nickname: 'defect1-user' },
      });
    }
    const userLogin2 = await request.post(`${BASE_URL}${API}/auth/login`, {
      data: { phone: USER_PHONE, password: USER_PWD },
    });
    expect(userLogin2.ok(), `用户登录失败: ${await userLogin2.text()}`).toBeTruthy();
    const userBody = await userLogin2.json();
    const userToken = userBody.data?.token;
    expect(userToken, '用户 token 应存在').toBeTruthy();

    // 2. 用唯一标识 notes 提交待审 (这样能在列表中筛出本测试创建的记录)
    const marker = `DEFECT1-MARKER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const submit = await request.post(`${BASE_URL}${API}/nose/pending-animal-request`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        species: 'dog',
        breed: '萨摩耶',
        color: '纯白',
        gender: 'male',
        location_lat: 31.22344,
        location_lng: 121.44530,
        nose_vector_id: `v-defect1-${Date.now()}`,
        photos: [`/static/uploads/${marker}.jpg`],
        notes: marker,
        intent: 'found',
      },
    });
    expect(submit.status(), `submit 应返回 2xx, 实际 ${submit.status()}: ${await submit.text()}`)
      .toBeLessThan(300);

    // 3. admin 登录
    const adminLogin = await request.post(`${BASE_URL}${API}/auth/login`, {
      data: { phone: ADMIN_PHONE, password: ADMIN_PWD },
    });
    expect(adminLogin.ok(), `admin 登录失败: ${await adminLogin.text()}`).toBeTruthy();
    const adminBody = await adminLogin.json();
    const adminToken = adminBody.data?.token;
    expect(adminToken, 'admin token 应存在').toBeTruthy();

    // 4. admin 查 pending 列表,断言能找到带 marker 的记录
    const list = await request.get(`${BASE_URL}${API}/admin/pending-nose-records`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      params: { status: 'pending', limit: 100 },
    });
    expect(list.ok(), `admin 查询失败: ${await list.text()}`).toBeTruthy();
    const listBody = await list.json();
    const items = listBody?.data?.list || listBody?.data?.items || [];
    const found = items.find((it: any) => it?.notes === marker);
    expect(found, `应在 admin 待审列表中找到 notes="${marker}" 的记录,实际找到 ${items.length} 条`)
      .toBeTruthy();
    // 字段全: 后端返回 record_id + vector_id + species + photos
    expect(found.record_id).toBeTruthy();
    expect(found.vector_id).toBeTruthy();
    expect(found.species).toBe('dog');
  });
});
