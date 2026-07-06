/**
 * Bug2 修复测试：上报事件审核流程
 *
 * 背景:
 *   现有 processEvent 对 event_type='report' 的事件 (无 nose_vector_id) 必死:
 *   noseService.compare({ vector_id: null }) 抛"缺少鼻纹记录ID" -> 500
 *   同样, confirmEvent 对 report 事件创建新 Animal 时没设 animal_id, 也会 500
 *   整个 audit 流程对 report 事件完全不可用.
 *
 * 修复目标:
 *   1. processEvent 根据 event.nose_vector_id 是否存在, 分支调用:
 *      - 有鼻纹 -> 现有 noseService.compare (collect 流程)
 *      - 无鼻纹 -> 新 MatchingService.findSimilarLostAnimals (report 流程, 用 image+GPS+text+time)
 *   2. confirmEvent 创建新 Animal 时用 uuidv4() 设 animal_id
 *   3. report 事件 process 后能填充 candidates 列表 (从 lost 动物中匹配)
 */
import { test, expect, request } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_PHONE = '13900000001';
const ADMIN_PWD = 'admin123';

async function adminLogin() {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const r = await ctx.post('/v1/auth/login', { data: { phone: ADMIN_PHONE, password: ADMIN_PWD } });
  expect(r.ok()).toBeTruthy();
  return { ctx, token: (await r.json()).data.token };
}

test.describe('Bug2 修复：上报事件审核流程', () => {

  test('1. processEvent 对 report 事件不应 500', async () => {
    const { ctx, token } = await adminLogin();
    // 用 user 30df041d 的 report 事件: 09e25dc0 (无鼻纹)
    const eventId = '09e25dc0-8f14-451a-882f-a48ec6d6f270';
    const res = await ctx.post(`/v1/admin/events/${eventId}/process`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`[Test1] processEvent on report: status=${res.status()}, body=${(await res.text()).slice(0, 300)}`);
    // 修复后: 不再 500
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.code).toBe(0);
    await ctx.dispose();
  });

  test('2. processEvent 后 report 事件应有 candidates 列表', async () => {
    const { ctx, token } = await adminLogin();
    const eventId = '09e25dc0-8f14-451a-882f-a48ec6d6f270';
    // 先 process
    const proc = await ctx.post(`/v1/admin/events/${eventId}/process`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(proc.ok()).toBeTruthy();

    // 再看详情
    const detailRes = await ctx.get(`/v1/admin/events/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const detail = (await detailRes.json()).data;
    console.log(`[Test2] report 事件 candidates 数量: ${detail.candidates?.length ?? 0}`);
    console.log(`[Test2] fusion_score: ${detail.fusion_score}`);
    console.log(`[Test2] vector_similarity: ${detail.vector_similarity} (应为空, report 无鼻纹)`);
    console.log(`[Test2] image_similarity: ${detail.image_similarity}`);
    console.log(`[Test2] gps_similarity: ${detail.gps_similarity}`);
    console.log(`[Test2] text_match_rate: ${detail.text_match_rate}`);

    // 修复后: 字段都应存在, vector_similarity 应为 null
    expect(detail.vector_similarity).toBeNull();
    expect(detail.image_similarity).not.toBeNull();
    expect(detail.gps_similarity).not.toBeNull();
    await ctx.dispose();
  });

  test('3. confirmEvent 对 report 事件 (无 animal_id) 不应 500', async () => {
    const { ctx, token } = await adminLogin();
    // 创建一个全新的 report 事件, 不关联任何 animal
    const createRes = await ctx.post('/v1/events', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        event_type: 'report',
        species: 'cat',
        location_lat: 30.5,
        location_lng: 114.3,
        address: 'Playwright 测 report 事件 confirm',
        description: '测试',
        photos: [],
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const eventId = (await createRes.json()).data.event_id;

    // 不选候选, 直接 confirm (即: 创建新动物)
    const confRes = await ctx.put(`/v1/admin/events/${eventId}/confirm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    console.log(`[Test3] confirm report 事件: status=${confRes.status()}, body=${(await confRes.text()).slice(0, 300)}`);
    expect(confRes.ok(), `confirm failed: ${confRes.status()}`).toBeTruthy();

    // 验证: 事件被关联到了一个新创建的动物
    const detailRes = await ctx.get(`/v1/admin/events/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const detail = (await detailRes.json()).data;
    console.log(`[Test3] 事件 animal_id: ${detail.animal_id}`);
    expect(detail.animal_id).toBeTruthy();
    expect(detail.status).toBe('confirmed');
    await ctx.dispose();
  });

  test('4. collect 事件 (有鼻纹) 的 processEvent 仍走鼻纹 AI 流程', async () => {
    const { ctx, token } = await adminLogin();
    // 用户 30df041d 的 collect 事件: 3afa9452 (有 animal_id, 来自 onCreateAnimal)
    const eventId = '3afa9452-b567-4729-8098-9c949da4154b';
    // 这个事件没有鼻纹 (因为我们之前 onCreateAnimal 创建时没传 nose_id)
    // 实际情况: collect 事件可能也没有鼻纹, 只是有 animal_id
    // 关键: collect 事件应该已经在创建时跑过鼻纹比对, 审核时不该再跑
    // 这里只验证 processEvent 对 collect 事件不再 500
    const res = await ctx.post(`/v1/admin/events/${eventId}/process`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`[Test4] processEvent on collect: status=${res.status()}`);
    // 修复后: 不再 500
    expect(res.ok()).toBeTruthy();
    await ctx.dispose();
  });

  test('5. MatchingService 单元行为: 不依赖鼻纹的匹配', async () => {
    // 这里我们通过集成测试间接验证: 创建一个 report 事件,
    // 让它指向"附近"已存在的 lost 动物的位置, 期望 candidates 里有该动物
    const { ctx, token } = await adminLogin();
    // 先创建一个 lost 动物作为目标
    const animalRes = await ctx.post('/v1/admin/animals', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        species: 'dog',
        breed: '柴犬',
        color: '黄色',
        gender: 'male',
        status: 'lost',
        location_lat: 30.5000,
        location_lng: 114.3000,
        address: '测试 lost 动物位置',
        photos: [],
      },
    });
    expect(animalRes.ok()).toBeTruthy();
    const lostAnimalId = (await animalRes.json()).data.animal_id;
    console.log(`[Test5] 创建 lost 动物: ${lostAnimalId}`);

    // 在"附近"创建一个 report 事件 (同品种, 同颜色, 距离 100m)
    const reportRes = await ctx.post('/v1/events', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        event_type: 'report',
        species: 'dog',
        breed: '柴犬',
        color: '黄色',
        gender: 'male',
        location_lat: 30.5009,  // ~100m away
        location_lng: 114.3000,
        address: 'Playwright 测 - 同一只柴犬',
        description: '黄色柴犬, 找主人',
        photos: [],
      },
    });
    expect(reportRes.ok()).toBeTruthy();
    const reportEventId = (await reportRes.json()).data.event_id;

    // process 后看 candidates
    const procRes = await ctx.post(`/v1/admin/events/${reportEventId}/process`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(procRes.ok()).toBeTruthy();
    const detailRes = await ctx.get(`/v1/admin/events/${reportEventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const detail = (await detailRes.json()).data;
    console.log(`[Test5] report 事件 candidates 数量: ${detail.candidates?.length ?? 0}`);
    for (const c of detail.candidates || []) {
      console.log(`  - ${c.animal_id?.slice(0, 8)}: fusion=${c.fusion_score}, address=${c.address}`);
    }
    // 修复后: 应该能匹配到刚创建的 lost 动物 (排序不稳定, 只验证它在候选中)
    expect(detail.candidates.length).toBeGreaterThanOrEqual(1);
    const matched = detail.candidates.find((c: any) => c.animal_id === lostAnimalId);
    expect(matched, `新创建的 lost 动物 ${lostAnimalId} 必须在候选列表中`).toBeTruthy();
    expect(matched.fusion_score).toBeGreaterThanOrEqual(0.5);
    // GPS 距离 < 500m, GPS 得分应 >= 1.0 (TypeORM 数值字段返回 string)
    expect(parseFloat(detail.gps_similarity)).toBeGreaterThanOrEqual(0.9);
    // 文本匹配度 (breed+color+gender 全中) 应 >= 0.9
    expect(parseFloat(detail.text_match_rate)).toBeGreaterThanOrEqual(0.9);
    await ctx.dispose();
  });
});
