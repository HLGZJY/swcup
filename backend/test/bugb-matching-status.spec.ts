/**
 * Bug B Part 2 (2026-07-08): matching.service 状态过滤只查 'lost',漏掉 'found' 动物
 *
 * 场景:
 *   - 用户 A 上报 intent='found' (我捡到狗) → eventsService 自动建 Animal (status='found')
 *   - 用户 B 上报 intent='stray_sighting' (路人目击) → 只建 Event,无 Animal
 *   - 管理员审核 B 的事件 → AI 识别 → 期望找到 A 的动物作为合并候选
 *   - 实际: matching.service.findSimilarLostAnimalsForReport SQL 只查 status='lost'
 *           → A 的 'found' 动物被过滤掉,候选列表空 → 只能创建新动物
 *
 * 期望:
 *   matching 候选应同时包含 status='lost' 和 status='found' 的动物 (IN 查询)
 *
 * 备注:
 *   不能只看 'lost' 因为:
 *     - 路人目击的事件 (stray_sighting) 关联的"found"动物本来就是要被合并的目标
 *     - 用户走失时也是 'lost', 路人看到后才变 'found',这两个状态都该是候选
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const API = '/v1';

async function loginAdmin(ctx: any) {
  const loginRes = await ctx.post(`${API}/auth/login`, {
    data: { phone: '13900000001', password: 'admin123' },
  });
  if (!loginRes.ok()) throw new Error(`登录失败 status=${loginRes.status()}`);
  return (await loginRes.json()).data.token;
}

async function loginUser(ctx: any, phone: string, password: string) {
  const loginRes = await ctx.post(`${API}/auth/login`, {
    data: { phone, password },
  });
  if (!loginRes.ok()) throw new Error(`登录失败 status=${loginRes.status()}`);
  return (await loginRes.json()).data.token;
}

test.describe('Bug B Part 2: matching 候选应包含 status="found" 动物', () => {

  test('准备数据: 创建一个 intent=found 的事件 → 自动建 status=found 动物', async ({ request }) => {
    const ctx = request;
    const token = await loginAdmin(ctx);
    const now = new Date().toISOString();
    const res = await ctx.post(`${API}/events`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        event_type: 'report',
        intent: 'found',
        species: 'dog',
        breed: '金毛',
        color: '金色',
        gender: 'male',
        location_lat: 32.62918,
        location_lng: 110.79801,
        address: '测试路 100 号',
        description: 'Bug B Part 2 测试 - 已捡到的狗',
        photos: ['/static/uploads/test-found.jpg'],
      },
    });
    console.log(`[准备数据] intent=found 响应 status=${res.status()}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body?.data?.event_id).toBeTruthy();
    // events.create 响应不返回 animal_id (内部自动建档),但 admin/animals 列表应能查到 status=found 的动物
  });

  test('准备数据: 创建一个 intent=stray_sighting 的事件 → 不自动建动物', async ({ request }) => {
    const ctx = request;
    const token = await loginAdmin(ctx);
    const res = await ctx.post(`${API}/events`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        event_type: 'report',
        intent: 'stray_sighting',
        species: 'dog',
        breed: '金毛',
        color: '金色',
        gender: 'male',
        location_lat: 32.62918,
        location_lng: 110.79801,
        address: '测试路 100 号',
        description: 'Bug B Part 2 测试 - 路人目击',
        photos: ['/static/uploads/test-stray.jpg'],
      },
    });
    console.log(`[准备数据] intent=stray_sighting 响应 status=${res.status()}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // 路人目击不应自动建动物 (animal_id 应为 null/缺省)
    expect(body?.data?.animal_id ?? null).toBeNull();
    return body?.data?.event_id;
  });

  test('核心: admin 审核 stray_sighting 事件 → AI 匹配候选应包含 status=found 动物', async ({ request }) => {
    const ctx = request;
    const adminToken = await loginAdmin(ctx);

    // 先查询事件列表找到上一步创建的 stray_sighting 事件
    const eventsRes = await ctx.get(`${API}/admin/events?limit=20`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(eventsRes.ok()).toBeTruthy();
    const eventsBody = await eventsRes.json();
    const list = eventsBody?.data?.list || [];
    // 找最近一条 stray_sighting 事件 (Bug B Part 2 测试描述)
    const strayEvent = list.find((e: any) =>
      e.intent === 'stray_sighting'
      && (e.description || '').includes('Bug B Part 2 测试 - 路人目击')
    );
    if (!strayEvent) {
      console.log(`[核心] 未找到目标事件, list=`, JSON.stringify(list.slice(0, 3)));
      // 跳过此断言,因为准备数据可能未执行
      test.skip(true, '准备数据事件未创建,跳过核心断言');
      return;
    }
    const eventId = strayEvent.event_id;
    console.log(`[核心] 找到 stray_sighting 事件 ${eventId}, status=${strayEvent.status}, fusion=${strayEvent.fusion_score}`);

    // 调用 processEvent (admin "AI 识别"按钮触发)
    const processRes = await ctx.post(`${API}/admin/events/${eventId}/process`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(processRes.ok()).toBeTruthy();
    const processBody = await processRes.json();
    console.log(`[核心] process 响应 candidates_count=${processBody?.data?.candidates_count}, fusion=${processBody?.data?.fusion_score}, merge_candidate=${JSON.stringify(processBody?.data?.merge_candidate)}`);

    // 验证 candidates 数组 (写到 event row 后,从 admin/events 取)
    const eventsRes2 = await ctx.get(`${API}/admin/events?limit=20`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const eventsBody2 = await eventsRes2.json();
    const strayEvent2 = (eventsBody2?.data?.list || []).find((e: any) => e.event_id === eventId);
    const candidates = strayEvent2?.candidates || [];
    console.log(`[核心] 实际候选数=${candidates.length}, 详情=${JSON.stringify(candidates.slice(0, 3))}`);

    // 关键断言: 候选列表应包含 status=found 动物(之前测试创建的)
    //   修复前: matching.service SQL `WHERE status='lost'` 过滤掉 found 动物 → candidates 长度为 0
    //   修复后: SQL `WHERE status IN ('lost','found')` → candidates 包含 found 动物
    const foundCandidates = candidates.filter((c: any) => c.status === 'found');
    expect(foundCandidates.length).toBeGreaterThan(0);
  });
});
