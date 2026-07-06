/**
 * 实证测试两个 bug:
 * Bug1: 用户上报流程是否会重复创建事件
 * Bug2: 管理端是否能在事件列表中看到上报事件
 */
import { test, expect, request } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const API = '/v1';
const ADMIN_PHONE = '13900000001';
const ADMIN_PWD = 'admin123';

test.describe('Bug 实证测试', () => {

  test('1. 管理端 API 能返回事件列表', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });

    // 管理员登录
    const loginRes = await ctx.post('/v1/auth/login', {
      data: { phone: ADMIN_PHONE, password: ADMIN_PWD },
    });
    console.log(`[Bug2-1] 登录响应: status=${loginRes.status()}, body=${(await loginRes.text()).slice(0, 200)}`);
    expect(loginRes.ok()).toBeTruthy();
    const adminToken = (await loginRes.json()).data.token;
    console.log(`[Bug2-1] 管理员登录成功, token=${adminToken.slice(0, 30)}...`);

    // 获取所有事件
    const eventsRes = await ctx.get('/v1/admin/events', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(eventsRes.ok()).toBeTruthy();
    const eventsBody = await eventsRes.json();
    console.log(`[Bug2-2] 管理员事件列表: total=${eventsBody.data.total}, list.length=${eventsBody.data.list.length}`);

    // 详查每条事件,关注关键字段
    if (eventsBody.data.list.length > 0) {
      console.log(`[Bug2-3] === 前 5 条事件详情 ===`);
      for (const ev of eventsBody.data.list.slice(0, 5)) {
        console.log(`  Event ${ev.event_id.slice(0, 8)}: status=${ev.status}, type=${ev.event_type}, animal_id=${ev.animal_id?.slice(0, 8) ?? 'NULL'}, address=${ev.address?.slice(0, 20) ?? 'NULL'}, photos=${JSON.stringify(ev.photos ?? []).slice(0, 50)}, desc=${(ev.description ?? '').slice(0, 30)}`);
      }
    }

    expect(eventsBody.data.total).toBeGreaterThan(0);
  });

  test('2. 查看用户 30df041d 的事件历史', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });
    const loginRes = await ctx.post('/v1/auth/login', {
      data: { phone: ADMIN_PHONE, password: ADMIN_PWD },
    });
    const adminToken = (await loginRes.json()).data.token;

    // 拉取所有事件找 30df041d 的
    const eventsRes = await ctx.get('/v1/admin/events?limit=100', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const eventsBody = await eventsRes.json();
    const userEvents = eventsBody.data.list.filter((e: any) => e.reporter_id === '30df041d-663d-42d2-96b6-1101d338b086');
    console.log(`[Bug1-1] 用户 30df041d 事件总数: ${userEvents.length}`);

    for (const ev of userEvents) {
      console.log(`  - ${ev.event_id.slice(0, 8)}: created=${ev.created_at}, type=${ev.event_type}, animal_id=${ev.animal_id?.slice(0, 8) ?? 'NULL'}, address=${ev.address?.slice(0, 30) ?? 'NULL'}, desc=${(ev.description ?? '').slice(0, 30) || 'EMPTY'}`);
    }
  });

  test('3. 验证管理端能筛选不同 status 的事件', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });
    const loginRes = await ctx.post('/v1/auth/login', {
      data: { phone: ADMIN_PHONE, password: ADMIN_PWD },
    });
    const adminToken = (await loginRes.json()).data.token;

    for (const status of ['pending', 'confirmed', 'rejected', 'resolved', 'linked']) {
      const res = await ctx.get(`/v1/admin/events?status=${status}&limit=100`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const body = await res.json();
      console.log(`[Bug2-status] status=${status}: total=${body.data.total}`);
    }
  });

  test('4. 验证 management-frontend 期望的字段', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });
    const loginRes = await ctx.post('/v1/auth/login', {
      data: { phone: ADMIN_PHONE, password: ADMIN_PWD },
    });
    const adminToken = (await loginRes.json()).data.token;

    // 前端 AuditEventCard 用到的字段
    const eventsRes = await ctx.get('/v1/admin/events?limit=1', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const ev = (await eventsRes.json()).data.list[0];
    console.log(`[Bug2-frontend] Event 字段检查:`);
    console.log(`  event_id: ${ev.event_id ? '✓' : '✗'}`);
    console.log(`  event_type: ${ev.event_type ? '✓' : '✗'} (${ev.event_type})`);
    console.log(`  status: ${ev.status ? '✓' : '✗'} (${ev.status})`);
    console.log(`  description: ${'description' in ev ? '✓' : '✗'} (${ev.description})`);
    console.log(`  address: ${'address' in ev ? '✓' : '✗'} (${ev.address})`);
    console.log(`  photos: ${'photos' in ev ? '✓' : '✗'} (${JSON.stringify(ev.photos)})`);
    console.log(`  location_lat: ${'location_lat' in ev ? '✓' : '✗'} (${ev.location_lat})`);
    console.log(`  location_lng: ${'location_lng' in ev ? '✓' : '✗'} (${ev.location_lng})`);
    console.log(`  reporter_id: ${ev.reporter_id ? '✓' : '✗'}`);
    console.log(`  created_at: ${ev.created_at ? '✓' : '✗'}`);
  });

  test('5. 模拟用户流程 - 真实复现"两次提交"的可能性', async () => {
    // 复现方式: 调用 events 接口两次, 模拟用户两次点击提交按钮
    const ctx = await request.newContext({ baseURL: BASE_URL });
    const loginRes = await ctx.post('/v1/auth/login', {
      data: { phone: ADMIN_PHONE, password: ADMIN_PWD },
    });
    const adminToken = (await loginRes.json()).data.token;

    // 拿到 events 数量基线
    const before = await ctx.get('/v1/admin/events?limit=1', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const beforeTotal = (await before.json()).data.total;
    console.log(`[Bug1-before] 当前事件总数: ${beforeTotal}`);

    // 模拟"没拿到位置前的提交" - 用 0,0 占位
    const noLocRes = await ctx.post('/v1/events', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        event_type: 'report',
        description: 'Playwright 实证 #1 - 没拿到位置',
        address: '未知',
        location_lat: 0,
        location_lng: 0,
        photos: [],
      },
    });
    console.log(`[Bug1-step1] 没拿到位置的提交: status=${noLocRes.status()}`);

    // 模拟"拿到位置后的提交"
    const withLocRes = await ctx.post('/v1/events', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        event_type: 'report',
        description: 'Playwright 实证 #2 - 拿到位置',
        address: '湖北省武汉市',
        location_lat: 30.5,
        location_lng: 114.3,
        photos: ['/static/uploads/test.jpg'],
      },
    });
    console.log(`[Bug1-step2] 拿到位置的提交: status=${withLocRes.status()}`);

    // 检查最终数量
    const after = await ctx.get('/v1/admin/events?limit=1', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const afterTotal = (await after.json()).data.total;
    console.log(`[Bug1-after] 当前事件总数: ${afterTotal}, 增加了 ${afterTotal - beforeTotal}`);

    // 关键: 如果两次都成功,说明后端没去重,前端的两次提交会产生 2 条
    // 这就是用户感知的"重复"
  });

});
