/**
 * Bug1 修复测试：event_type=collect 与 report 应能区分
 *
 * 背景：
 *   原来 collect 流程和 report 流程都创建 event_type='report' 的事件，
 *   导致用户在"我的上报"列表里看到两条看起来一样的记录。
 *
 * 修复目标：
 *   - collect 流程的"无匹配"分支(onCreateAnimal)创建 event_type='collect' 的事件
 *   - report 流程继续使用 event_type='report'
 *   - 两者在列表里能通过 type 区分
 *   - 不破坏现有数据(老数据仍是 'report')
 */
import { test, expect, request } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PHONE = '13900000001';
const ADMIN_PWD = 'admin123';

async function adminLoginAndToken() {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const r = await ctx.post('/v1/auth/login', { data: { phone: ADMIN_PHONE, password: ADMIN_PWD } });
  expect(r.ok(), `admin login failed: ${r.status()} ${await r.text()}`).toBeTruthy();
  const token = (await r.json()).data.token;
  return { ctx, token };
}

test.describe('Bug1 修复：event_type 区分 collect vs report', () => {

  test('1. 事件 DTO 接受 event_type="collect"', async () => {
    const { ctx, token } = await adminLoginAndToken();

    // 收集基线事件总数
    const before = await ctx.get('/v1/admin/events?limit=1', { headers: { Authorization: `Bearer ${token}` } });
    const beforeTotal = (await before.json()).data.total;

    // 创建一个 collect 类型事件
    const createRes = await ctx.post('/v1/events', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        event_type: 'collect',
        species: 'dog',
        location_lat: 30.5,
        location_lng: 114.3,
        address: 'Playwright 测试 - collect 类型',
        description: 'collect 流程创建的事件',
      },
    });
    console.log(`[Test1] 创建 collect 事件: status=${createRes.status()}, body=${(await createRes.text()).slice(0, 300)}`);

    expect(createRes.ok(), `create collect event failed: ${createRes.status()}`).toBeTruthy();
    const body = await createRes.json();
    expect(body.code).toBe(0);
    expect(body.data.event_id).toBeTruthy();

    // 验证事件确实创建了，type 是 'collect'
    const detailRes = await ctx.get(`/v1/admin/events/${body.data.event_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const detail = (await detailRes.json()).data;
    console.log(`[Test1] 事件详情: event_type=${detail.event_type}, status=${detail.status}`);
    expect(detail.event_type).toBe('collect');
    expect(detail.status).toBe('pending');

    // 验证总数 +1
    const after = await ctx.get('/v1/admin/events?limit=1', { headers: { Authorization: `Bearer ${token}` } });
    const afterTotal = (await after.json()).data.total;
    expect(afterTotal).toBe(beforeTotal + 1);

    await ctx.dispose();
  });

  test('2. 事件 DTO 仍然接受 event_type="report"（向后兼容）', async () => {
    const { ctx, token } = await adminLoginAndToken();

    const createRes = await ctx.post('/v1/events', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        event_type: 'report',
        species: 'cat',
        location_lat: 30.5,
        location_lng: 114.3,
        address: 'Playwright 测试 - report 类型',
      },
    });
    console.log(`[Test2] 创建 report 事件: status=${createRes.status()}`);
    expect(createRes.ok()).toBeTruthy();
    const body = await createRes.json();
    const detailRes = await ctx.get(`/v1/admin/events/${body.data.event_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const detail = (await detailRes.json()).data;
    expect(detail.event_type).toBe('report');
    await ctx.dispose();
  });

  test('3. 列表能正确返回并区分 collect / report 类型', async () => {
    const { ctx, token } = await adminLoginAndToken();
    const res = await ctx.get('/v1/admin/events?limit=100', { headers: { Authorization: `Bearer ${token}` } });
    const events = (await res.json()).data.list;

    const collectEvents = events.filter((e: any) => e.event_type === 'collect');
    const reportEvents = events.filter((e: any) => e.event_type === 'report');

    console.log(`[Test3] 总事件: ${events.length}, collect: ${collectEvents.length}, report: ${reportEvents.length}`);
    for (const e of collectEvents) {
      console.log(`  collect: ${e.event_id.slice(0, 8)}, animal_id=${e.animal_id?.slice(0, 8) ?? 'NULL'}`);
    }
    for (const e of reportEvents) {
      console.log(`  report:  ${e.event_id.slice(0, 8)}, animal_id=${e.animal_id?.slice(0, 8) ?? 'NULL'}`);
    }

    // 修复后: 至少 1 个 collect (本测试创建的) + 原有 report 事件
    expect(collectEvents.length).toBeGreaterThanOrEqual(1);
    expect(reportEvents.length).toBeGreaterThanOrEqual(1);

    await ctx.dispose();
  });

  test('4. 验证非法 event_type 仍被拒绝', async () => {
    const { ctx, token } = await adminLoginAndToken();
    const createRes = await ctx.post('/v1/events', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        event_type: 'invalid_type_xyz',  // 非法类型
        species: 'dog',
        location_lat: 30.5,
        location_lng: 114.3,
      },
    });
    console.log(`[Test4] 非法 event_type 响应: status=${createRes.status()}`);
    expect(createRes.ok()).toBeFalsy();
    expect(createRes.status()).toBe(400);

    await ctx.dispose();
  });

});
