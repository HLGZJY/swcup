/**
 * Bug6 综合修复测试: 同图二次采集去重
 *
 * 核心 bug 链路:
 *   1. 第一次 collect() → 生成孤儿 NoseFeature (animal_id=NULL)
 *      走 "create archive" 流程 → AnimalsService.create() 之前没有把 dto.primary_nose_id
 *      存到 DB, 导致 Animal.primary_nose_id=NULL
 *      后续 collect 走 findSimilarAnimals 永远 0 结果
 *
 * 综合修复验证:
 *   1. DTO + Service 修复: AnimalsService.create() 持久化 primary_nose_id (bug6-primary-nose-id.spec.ts 已覆盖)
 *   2. findSimilarNoseFeatures 兜底: collect() / compare() 找不到动物时, 直接查 NoseFeature 表
 *   3. AnimalsService.create() 回填孤儿: 已有 NoseFeature.vector_id=dto.primary_nose_id 的孤儿, 会被回填 animal_id
 *
 * 注意:
 *   - 本测试依赖 mock AI service (test/bug6-mock-ai-server.js)
 *   - mock AI service 接收同样的 base64 一定返回同样的 512 维向量
 *   - 所以同图两次 collect 的 cosine_similarity = 1.0, 必然超过 0.88 阈值
 *   - 启动方式: 在跑测试前, 用 AI_SERVICE_URL=http://127.0.0.1:18000 启动后端
 */
import { test, expect, request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
const API = '/v1';
const ADMIN_PHONE = '13900000001';
const ADMIN_PWD = 'admin123';

// 一张"假"鼻纹照片的 base64 (随便一个 jpeg 头 + 一些 padding)
// 关键是 mock AI service 拿到这个 base64 后, 用 sha512 生成确定性 512 维向量
const FAKE_NOSE_PHOTO_B64_BASE =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';

// 为每次 e2e 测试生成唯一 base64 (在基础 base64 后面追加 unique suffix)
// mock AI 用 sha512 摘要, 唯一 suffix 会产生完全不同的 512 维向量
// 这样多次跑测试不会受前一次脏数据影响
function uniquePhoto(suffix: string): string {
  return FAKE_NOSE_PHOTO_B64_BASE + suffix;
}

test.describe('Bug6 综合修复: 同图二次采集去重', () => {

  test('0. 静态检查: collect/compare 都包含 findSimilarNoseFeatures 兜底调用', () => {
    const svcPath = path.resolve(__dirname, '..', 'src', 'nose', 'nose.service.ts');
    const content = fs.readFileSync(svcPath, 'utf-8');

    // collect() 必须调用 findSimilarNoseFeatures
    const collectFnMatch = content.match(/async collect\([\s\S]*?^  \}/m);
    expect(collectFnMatch, '应能找到 collect() 函数体').toBeTruthy();
    expect(
      collectFnMatch![0].includes('findSimilarNoseFeatures'),
      'collect() 必须有 findSimilarNoseFeatures 兜底调用',
    ).toBeTruthy();

    // compare() 必须调用 findSimilarNoseFeatures
    const compareFnMatch = content.match(/async compare\([\s\S]*?^  \}/m);
    expect(compareFnMatch, '应能找到 compare() 函数体').toBeTruthy();
    expect(
      compareFnMatch![0].includes('findSimilarNoseFeatures'),
      'compare() 必须有 findSimilarNoseFeatures 兜底调用',
    ).toBeTruthy();
  });

  test('0b. 静态检查: AnimalsService.create 包含孤儿 NoseFeature 回填逻辑', () => {
    const svcPath = path.resolve(__dirname, '..', 'src', 'animals', 'animals.service.ts');
    const content = fs.readFileSync(svcPath, 'utf-8');

    expect(
      /noseRepo\.update\(\s*\{\s*vector_id:\s*dto\.primary_nose_id/.test(content),
      'AnimalsService.create 应有回填孤儿 NoseFeature.animal_id 的 update 语句',
    ).toBeTruthy();

    // 还要注入 NoseFeature repo
    expect(
      /@InjectRepository\(NoseFeature\)/.test(content),
      'AnimalsService 应注入 NoseFeature repo',
    ).toBeTruthy();
  });

  test('0c. 静态检查: 兜底只在主链路 0 结果时才走 (避免重复 AI 调用)', () => {
    const svcPath = path.resolve(__dirname, '..', 'src', 'nose', 'nose.service.ts');
    const content = fs.readFileSync(svcPath, 'utf-8');

    // 验证: 兜底在 similarAnimals.length === 0 条件下才执行
    const collectFnMatch = content.match(/async collect\([\s\S]*?^  \}/m)!;
    expect(
      /similarAnimals\.length === 0[\s\S]{0,200}findSimilarNoseFeatures/.test(collectFnMatch![0]),
      'collect 兜底应在 similarAnimals.length === 0 时触发',
    ).toBeTruthy();

    const compareFnMatch = content.match(/async compare\([\s\S]*?^  \}/m)!;
    expect(
      /similarAnimals\.length === 0[\s\S]{0,200}findSimilarNoseFeatures/.test(compareFnMatch![0]),
      'compare 兜底应在 similarAnimals.length === 0 时触发',
    ).toBeTruthy();
  });

  test('1. 完整 e2e: collect→collect 同图, 第二次返回 is_duplicate=true (依赖 mock AI)', async () => {
    // 这个测试需要后端启动了 mock AI service
    // 通过 env 启动: AI_SERVICE_URL=http://127.0.0.1:18000 node dist/main.js
    // 若 mock AI 未启动, AI service 调用会失败, 这个测试会 fail — 提示用户先启动 mock
    const ctx = await request.newContext({ baseURL: BASE_URL });

    // 1. 管理员登录
    const loginRes = await ctx.post(`${API}/auth/login`, {
      data: { phone: ADMIN_PHONE, password: ADMIN_PWD },
    });
    if (!loginRes.ok()) {
      test.skip(true, '后端未启动, 跳过 e2e');
      return;
    }
    const token = (await loginRes.json()).data.token;

    // 用唯一 base64 (suffix + timestamp) 隔离这次测试, 不受历史数据影响
    const photo = uniquePhoto(`test1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    // 2. 第一次采集
    const collectRes1 = await ctx.post(`${API}/nose/collect`, {
      data: {
        nose_photo: photo,
        species: 'dog',
        location_lat: 30.5,
        location_lng: 114.3,
      },
    });
    if (!collectRes1.ok()) {
      const errBody = await collectRes1.text();
      if (errBody.includes('AggregateError') || errBody.includes('ECONNREFUSED')) {
        test.skip(true, 'AI service 不可达, 跳过 e2e (启动 mock: node test/bug6-mock-ai-server.js &)');
        return;
      }
    }
    expect(collectRes1.ok(), `第一次 collect 失败: ${await collectRes1.text()}`).toBeTruthy();
    const result1 = (await collectRes1.json()).data;
    console.log(`[Bug6-1] 第一次 collect: vector_id=${result1.vector_id?.slice(0, 8)}, is_duplicate=${result1.is_duplicate}, next=${result1.next_action}`);

    // 第一次: 全新鼻纹, 不应该是 duplicate
    expect(result1.is_duplicate).toBe(false);
    expect(result1.next_action).toBe('ask_user_create');

    // 3. 第二次采集同一张图
    const collectRes2 = await ctx.post(`${API}/nose/collect`, {
      data: {
        nose_photo: photo,
        species: 'dog',
        location_lat: 30.5,
        location_lng: 114.3,
      },
    });
    expect(collectRes2.ok(), `第二次 collect 失败: ${await collectRes2.text()}`).toBeTruthy();
    const result2 = (await collectRes2.json()).data;
    console.log(`[Bug6-1] 第二次 collect: vector_id=${result2.vector_id?.slice(0, 8)}, is_duplicate=${result2.is_duplicate}, next=${result2.next_action}, matched=${result2.matched_animal_id?.slice(0, 8) || 'null'}`);

    // 第二次: 兜底命中孤儿 NF, 应返回 is_duplicate=true
    // next_action: 'ask_link_or_new' (孤儿无 animal_id)
    expect(result2.is_duplicate, `第二次 collect 应识别为重复, 实际 is_duplicate=${result2.is_duplicate}`).toBe(true);
    expect(result2.similarity, `相似度应为 1.0 (同图), 实际=${result2.similarity}`).toBeCloseTo(1.0, 2);
    expect(result2.next_action).toMatch(/ask_(link_or_new|claim_existing|claim_or_new)/);
  });

  test('2. 完整 e2e: collect→建档→collect 同图, 第二次直接命中动物 (依赖 mock AI)', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });
    const loginRes = await ctx.post(`${API}/auth/login`, {
      data: { phone: ADMIN_PHONE, password: ADMIN_PWD },
    });
    if (!loginRes.ok()) {
      test.skip(true, '后端未启动, 跳过 e2e');
      return;
    }
    const token = (await loginRes.json()).data.token;

    // 唯一 base64, 避免历史 Animal 干扰
    const photo = uniquePhoto(`test2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    // 1. 第一次采集 (会生成孤儿 NF)
    const collectRes1 = await ctx.post(`${API}/nose/collect`, {
      data: {
        nose_photo: photo,
        species: 'dog',
        location_lat: 30.5,
        location_lng: 114.3,
      },
    });
    if (!collectRes1.ok()) {
      const errBody = await collectRes1.text();
      if (errBody.includes('AggregateError') || errBody.includes('ECONNREFUSED')) {
        test.skip(true, 'AI service 不可达, 跳过 e2e');
        return;
      }
    }
    expect(collectRes1.ok()).toBeTruthy();
    const result1 = (await collectRes1.json()).data;
    const firstNoseId = result1.vector_id;
    expect(firstNoseId, '第一次 collect 应返回 vector_id').toBeTruthy();

    // 2. 建档, 把 primary_nose_id 指向第一次的 vector_id
    const createRes = await ctx.post(`${API}/animals`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        species: 'dog',
        breed: 'bug6-comprehensive-test',
        color: '棕色',
        gender: 'unknown',
        location_lat: 30.5,
        location_lng: 114.3,
        notes: 'bug6 综合测试',
        primary_nose_id: firstNoseId,
      },
    });
    expect(createRes.ok(), `建档失败: ${await createRes.text()}`).toBeTruthy();
    const created = (await createRes.json()).data;
    expect(created.primary_nose_id, 'Animal.primary_nose_id 应被持久化').toBe(firstNoseId);
    console.log(`[Bug6-2] 建档成功: animal_id=${created.animal_id?.slice(0, 8)}, primary_nose_id=${created.primary_nose_id?.slice(0, 8)}`);

    // 3. 第二次采集同图 → 应该命中动物 (走主链路 findSimilarAnimals)
    const collectRes2 = await ctx.post(`${API}/nose/collect`, {
      data: {
        nose_photo: photo,
        species: 'dog',
        location_lat: 30.5,
        location_lng: 114.3,
      },
    });
    expect(collectRes2.ok()).toBeTruthy();
    const result2 = (await collectRes2.json()).data;
    console.log(`[Bug6-2] 建档后 collect: vector_id=${result2.vector_id?.slice(0, 8)}, is_duplicate=${result2.is_duplicate}, matched_animal=${result2.matched_animal_id?.slice(0, 8)}, next=${result2.next_action}`);

    // 关键断言: 第二次应该匹配到刚才创建的 animal
    expect(result2.is_duplicate, `建档后第二次 collect 应识别为重复, 实际 is_duplicate=${result2.is_duplicate}`).toBe(true);
    expect(result2.matched_animal_id, `应返回刚才创建的 animal_id=${created.animal_id}`).toBe(created.animal_id);
    expect(result2.next_action).toBe('ask_claim_or_new');

    // 4. 清理
    await ctx.delete(`${API}/animals/${created.animal_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('3. 静态检查: collect 返回 next_action=ask_link_or_new (孤儿无 animal_id 场景)', () => {
    // 验证: collect 的孤儿分支, next_action 区分 animal_id 是否为空
    const svcPath = path.resolve(__dirname, '..', 'src', 'nose', 'nose.service.ts');
    const content = fs.readFileSync(svcPath, 'utf-8');

    // 源码是跨行三元: orphanMatch.nose_feature.animal_id\n  ? 'ask_claim_existing' ... : 'ask_link_or_new'
    // 用 [\s\S]*? 跨行匹配
    expect(
      /orphanMatch\.nose_feature\.animal_id[\s\S]*?ask_claim_existing[\s\S]*?ask_link_or_new/.test(content),
      'collect 孤儿分支应区分 animal_id 空 vs 非空, 返回 ask_claim_existing 或 ask_link_or_new',
    ).toBeTruthy();
  });

  test('4. 静态检查: compare 合并主链路 + 孤儿, 按 animal_id/nose_id 去重', () => {
    const svcPath = path.resolve(__dirname, '..', 'src', 'nose', 'nose.service.ts');
    const content = fs.readFileSync(svcPath, 'utf-8');

    const compareFnMatch = content.match(/async compare\([\s\S]*?^  \}/m)!;
    expect(
      /seenAnimal/.test(compareFnMatch![0]),
      'compare 应有 seenAnimal 去重集合',
    ).toBeTruthy();
    expect(
      /seenNose/.test(compareFnMatch![0]),
      'compare 应有 seenNose 去重集合',
    ).toBeTruthy();
    expect(
      /is_orphan/.test(compareFnMatch![0]),
      'compare 应暴露 is_orphan 字段给前端',
    ).toBeTruthy();
  });
});
