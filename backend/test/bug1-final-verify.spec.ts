/**
 * Bug1 修复终验：模拟用户视角的"我的上报"页
 *
 * 验证修复后:
 *   - 同一用户的 2 条事件能用 event_type 区分
 *   - collect 类型在事件详情里能正确返回
 *   - 不会因为重复 type 标签让用户困惑
 */
import { test, expect, request } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PHONE = '13900000001';
const ADMIN_PWD = 'admin123';

test('Bug1 终验：同一用户的两条事件能用 type 区分', async () => {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const loginRes = await ctx.post('/v1/auth/login', { data: { phone: ADMIN_PHONE, password: ADMIN_PWD } });
  const token = (await loginRes.json()).data.token;

  // 拉取用户 30df041d 的事件
  const eventsRes = await ctx.get('/v1/admin/events?limit=100', { headers: { Authorization: `Bearer ${token}` } });
  const events = (await eventsRes.json()).data.list;
  const userEvents = events.filter((e: any) => e.reporter_id === '30df041d-663d-42d2-96b6-1101d338b086');

  console.log(`[终验] 用户 30df041d 事件数: ${userEvents.length}`);
  for (const ev of userEvents) {
    const typeLabel = ev.event_type === 'collect' ? '采集' : ev.event_type === 'report' ? '上报' : ev.event_type;
    console.log(`  - ${ev.event_id.slice(0, 8)}: type=${ev.event_type} (${typeLabel}), animal_id=${ev.animal_id?.slice(0, 8) ?? '无'}, address=${ev.address ?? '无'}`);
  }

  // 验证: 两条事件类型必须不同
  expect(userEvents.length).toBe(2);
  const types = userEvents.map((e: any) => e.event_type).sort();
  expect(types).toEqual(['collect', 'report']);

  // 验证: 哪条是 collect (鼻纹采集),哪条是 report (主动上报) 清晰可辨
  const collectEvent = userEvents.find((e: any) => e.event_type === 'collect');
  const reportEvent = userEvents.find((e: any) => e.event_type === 'report');
  expect(collectEvent).toBeTruthy();
  expect(reportEvent).toBeTruthy();
  expect(collectEvent.animal_id).toBeTruthy();  // collect 流程必带 animal_id
  expect(reportEvent.address).toBeTruthy();     // report 流程必带 address

  console.log(`[终验] ✓ collect 事件有 animal_id, report 事件有 address - 语义清晰,用户不再困惑`);
});
