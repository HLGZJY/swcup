/**
 * Bug B Part 1 (2026-07-08): collect-without-nose 也应写入 pending_nose_records
 *
 * 场景:
 *   用户 A 丢失狗,没拍鼻纹,只上传全身照+GPS
 *   调用 POST /v1/nose/collect {nose_photo: 空, body_photo_url, location_lat, location_lng}
 *   当前行为: 返回 ask_user_confirm,无任何 DB 写入
 *     → 如果用户关闭应用/走开, admin永远不知道这个人尝试采集过
 *     → 走失狗的数据被丢弃
 *   期望行为: 写入 pending_nose_records (vector_id=NULL, source=LOW_SCORE_NOSE),
 *     admin待审中心能看到,审核 approve_as_new 时建 animal
 *
 * TDD:
 *   RED: 当前无 record 写入,断言 admin/pending-nose-records 列表多一条 → 失败
 *   GREEN: nose.service.collect no-nose 分支加 pendingRepo.save → 断言通过
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const API = '/v1';

async function loginAdmin(ctx: any) {
  const r = await ctx.post(`${API}/auth/login`, {
    data: { phone: '13900000001', password: 'admin123' },
  });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).data.token;
}

test.describe('Bug B Part 1: collect-without-nose 自动建 pending 记录', () => {

  test('collect 无鼻纹 → admin 待审列表应出现新记录 (vector_id=NULL, source=LOW_SCORE_NOSE)', async ({ request }) => {
    const ctx = request;

    // 1. 准备: 先获取当前 admin 待审记录数 (作为基准)
    const adminToken = await loginAdmin(ctx);
    const beforeRes = await ctx.get(`${API}/admin/pending-nose-records?limit=100`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(beforeRes.ok()).toBeTruthy();
    const beforeBody = await beforeRes.json();
    const beforeIds = new Set(
      (beforeBody?.data?.list || []).map((p: any) => p.record_id)
    );
    const beforeTotal = beforeBody?.data?.total || 0;
    console.log(`[准备] 当前 pending 总数 ${beforeTotal}`);

    // 2. 调用 collect 无鼻纹 (用唯一 GPS,便于后续定位)
    //   必须登录,因为 collector_id NOT NULL,anonymous 不行
    const uniqueLat = 32.70000 + Math.random() * 0.001;
    const uniqueLng = 110.75000 + Math.random() * 0.001;

    const collectRes = await ctx.post(`${API}/nose/collect`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        nose_photo: '',  // 关键:空鼻纹
        nose_photo_url: '',
        body_photo_url: '/static/uploads/bugb-test-no-nose.jpg',
        location_lat: uniqueLat,
        location_lng: uniqueLng,
        species: 'dog',
        breed: '土松',
        color: '橙黄',
        gender: 'male',
        // intent 不传,默认 lost
      },
    });
    console.log(`[核心] collect 无鼻纹 响应 status=${collectRes.status()}`);
    expect(collectRes.ok()).toBeTruthy();

    // 3. 验证: admin 待审中心应多一条记录
    const afterRes = await ctx.get(`${API}/admin/pending-nose-records?limit=100`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(afterRes.ok()).toBeTruthy();
    const afterBody = await afterRes.json();
    const afterList = afterBody?.data?.list || [];
    const newRecords = afterList.filter((p: any) => !beforeIds.has(p.record_id));
    console.log(`[核心] 增量记录数=${newRecords.length}, 总=${afterBody?.data?.total}`);
    expect(newRecords.length).toBeGreaterThan(0);

    // 4. 验证新增记录字段: vector_id=NULL (因为没鼻纹), source=LOW_SCORE_NOSE
    if (newRecords.length > 0) {
      const r = newRecords[0];
      console.log(`[核心] 新记录 record_id=${r.record_id}, source=${r.source}, vector_id=${r.vector_id}, status=${r.status}`);
      // vector_id 应为 null (因为没鼻纹)
      expect(r.vector_id ?? null).toBeNull();
      // source 应该是 LOW_SCORE_NOSE 标记 (这是 collect 自动写入,不是用户主动 USER_CREATE_REQUEST)
      expect(r.source).toBe('low_score_nose');
    }
  });
});
