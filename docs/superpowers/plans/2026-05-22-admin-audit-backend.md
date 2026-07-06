# 管理端事件审核详情 — 后端接口实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 后端补充 events 表字段、process/confirm 接口逻辑、getEventDetail 扩展返回 candidates 列表

**Architecture:** 改动集中在 entity、service、controller 三层。processEvent 调用 noseService.compare() 将结果写入 event；getEventDetail 读取 event 拼装 candidates 列表；confirmEvent 接受 animal_id 关联事件与动物。

**Tech Stack:** NestJS + TypeORM + MySQL

---

## 文件结构

| 文件 | 改动类型 | 职责 |
|------|----------|------|
| `backend/src/events/entities/event.entity.ts` | 修改 | 新增 4 个四维度得分列 + candidates JSON 列 |
| `backend/src/nose/dto/nose.dto.ts` | 修改 | CompareNoseDto 新增 nose_photo_url 字段 |
| `backend/src/nose/nose.service.ts` | 修改 | compare 方法同时支持 vector_id 和 nose_photo_url 入参 |
| `backend/src/events/events.service.ts` | 修改 | processEvent 调用鼻纹比对并存储结果 |
| `backend/src/admin/admin.service.ts` | 修改 | getEventDetail 拼装 candidates；confirmEvent 支持 animal_id |
| `backend/src/admin/admin.controller.ts` | 修改 | confirmEvent 接受 @Body |

---

## Task 1: RescueEvent entity 新增字段

**Files:**
- Modify: `backend/src/events/entities/event.entity.ts`

- [ ] **Step 1: 添加新列装饰器**

在 `event.entity.ts` 文件中，在 `fusion_score` 字段后（行 86 附近）添加 4 个四维度得分列，在文件末尾（`created_at` 之前）添加 `candidates` JSON 列：

```typescript
@Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'vector_similarity' })
vector_similarity: number;

@Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'gps_similarity' })
gps_similarity: number;

@Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'image_similarity' })
image_similarity: number;

@Column({ type: 'decimal', precision: 5, scale: 4, nullable: true, name: 'text_match_rate' })
text_match_rate: number;

@Column({ type: 'json', nullable: true })
candidates: any[];
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/events/entities/event.entity.ts
git commit -m "feat: add four-dimension score fields and candidates JSON to RescueEvent"
```

---

## Task 2: CompareNoseDto 支持 nose_photo_url

**Files:**
- Modify: `backend/src/nose/dto/nose.dto.ts`

- [ ] **Step 1: 在 CompareNoseDto 中新增 nose_photo_url 字段**

在 `nose.dto.ts` 的 `CompareNoseDto` 类中（`photo_base64` 字段之后）添加：

```typescript
@ApiPropertyOptional()
@IsString()
@IsOptional()
nose_photo_url?: string;
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/nose/dto/nose.dto.ts
git commit -m "feat: add nose_photo_url field to CompareNoseDto"
```

---

## Task 3: noseService.compare 支持 nose_photo_url 入参

**Files:**
- Modify: `backend/src/nose/nose.service.ts`

- [ ] **Step 1: 改造 compare 方法，同时支持 vector_id 和 nose_photo_url**

将 `nose.service.ts` 中的 `compare` 方法改造为：

```typescript
async compare(dto: CompareNoseDto, user_id: string) {
  // Mock AI 比对结果 - 真实环境调用 FastAPI + 数据库向量
  const animals = await this.animalRepo.find();
  const threshold_confirmed = 0.88;
  const threshold_suspected = 0.75;

  // 模拟四维度得分计算（真实环境由 AI 模型输出）
  const results = animals.slice(0, 5).map((animal, i) => {
    const fusion_score = parseFloat((0.90 - i * 0.08).toFixed(4));
    const vector_similarity = parseFloat((0.95 - i * 0.03).toFixed(4));
    const gps_distance_m = [320, 850, 1250, 1600, 2100][i];
    const image_similarity = parseFloat((0.88 - i * 0.05).toFixed(4));
    const text_match_rate = parseFloat((0.80 - i * 0.04).toFixed(4));
    return {
      animal_id: animal.animal_id,
      fusion_score,
      vector_similarity,
      gps_distance_m,
      image_similarity,
      text_match_rate,
      animal: {
        animal_id: animal.animal_id,
        species: animal.species,
        breed: animal.breed,
        color: animal.color,
        gender: animal.gender,
        status: animal.status,
        first_seen_at: animal.first_seen_at,
        address: animal.address,
        photos: animal.photos || [],
      },
    };
  });

  // 按 fusion_score 降序排列，最高分为推荐
  results.sort((a, b) => b.fusion_score - a.fusion_score);
  results.forEach((r, i) => {
    (r as any).is_recommended = i === 0;
  });

  return { total: results.length, results, threshold_confirmed, threshold_suspected };
}
```

> **注意**：原方法使用 `animals.slice(0, 3)` 取前 3 个，现在改为 `slice(0, 5)` 取前 5 个，与前端设计 spec 一致。

- [ ] **Step 2: 提交**

```bash
git add backend/src/nose/nose.service.ts
git commit -m "feat: noseService.compare returns top-5 candidates with is_recommended flag"
```

---

## Task 4: EventsService.processEvent 调用鼻纹比对并存储结果

**Files:**
- Modify: `backend/src/events/events.service.ts`

- [ ] **Step 1: 注入 NoseService**

在 `events.service.ts` 文件顶部添加 NoseService 导入，在构造函数中注入：

```typescript
import { NoseService } from '../nose/nose.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(RescueEvent) private readonly eventRepo: Repository<RescueEvent>,
    private readonly noseService: NoseService,  // 新增
  ) {}
```

在类的 `@InjectRepository` 装饰器之后添加 `Inject` 导入（如果没有）：
```typescript
import { Inject } from '@nestjs/common';
```

（NestJS 注入 service 需要在 module 中已声明 provider，如果 NoseService 已在其 module 中被导出（当前 nose.module.ts 有 `exports: [NoseService]`），则 events.module.ts 需要 import NoseModule）

- [ ] **Step 2: 改造 processEvent 方法**

将 `processEvent` 方法替换为：

```typescript
async processEvent(event_id: string) {
  try {
    const event = await this.eventRepo.findOne({ where: { event_id } });
    if (!event) throw new Error('Event not found');

    // 触发 AI 比对（使用事件的鼻纹照片 URL）
    const compareResult = await this.noseService.compare(
      { nose_photo_url: event.nose_photo_url } as any,
      event.reporter_id,
    );

    const candidates = compareResult.results.map((r: any) => ({
      animal_id: r.animal_id,
      breed: r.animal?.breed || '',
      color: r.animal?.color || '',
      gender: r.animal?.gender || '',
      status: r.animal?.status || '',
      photos: r.animal?.photos || [],
      address: r.animal?.address || '',
      fusion_score: r.fusion_score,
      vector_similarity: r.vector_similarity,
      gps_similarity: r.gps_distance_m ? parseFloat((1 - r.gps_distance_m / 5000).toFixed(4)) : 0, // 模拟 GPS 相似度
      image_similarity: r.image_similarity,
      text_match_rate: r.text_match_rate,
      is_recommended: r.is_recommended || false,
    }));

    // 取最高候选的融合得分
    const topFusionScore = candidates.length > 0 ? candidates[0].fusion_score : null;

    // 更新事件记录
    await this.eventRepo.update({ event_id }, {
      status: EventStatus.PENDING,
      fusion_score: topFusionScore,
      vector_similarity: candidates.length > 0 ? candidates[0].vector_similarity : null,
      gps_similarity: candidates.length > 0 ? candidates[0].gps_similarity : null,
      image_similarity: candidates.length > 0 ? candidates[0].image_similarity : null,
      text_match_rate: candidates.length > 0 ? candidates[0].text_match_rate : null,
      candidates: candidates as any,
    } as any);

    return {
      event_id,
      status: 'pending',
      fusion_score: topFusionScore,
      candidates_count: candidates.length,
      message: 'AI比对完成',
    };
  } catch (err) {
    console.error('[EventsService.processEvent] ERROR:', err.message);
    throw err;
  }
}
```

> **GPS 相似度说明**：`noseService.compare` 返回的是 `gps_distance_m`（距离），在存入 event 前需转换为相似度分数。这里用 `1 - distance/5000` 模拟（距离 0 时=1.0，距离 5000m 时=0）。

- [ ] **Step 3: events.module.ts 导入 NoseModule**

检查 `backend/src/events/events.module.ts`，确保导入了 `NoseModule`：

```typescript
import { NoseModule } from '../nose/nose.module';

@Module({
  imports: [TypeOrmModule.forFeature([RescueEvent]), NoseModule],
  ...
})
export class EventsModule {}
```

如果没有 `NoseModule` 导入，添加它。

- [ ] **Step 4: 提交**

```bash
git add backend/src/events/events.service.ts backend/src/events/events.module.ts
git commit -m "feat: processEvent calls noseService.compare and stores four-dimension scores"
```

---

## Task 5: AdminService.getEventDetail 拼装 candidates

**Files:**
- Modify: `backend/src/admin/admin.service.ts`

- [ ] **Step 1: 改造 getEventDetail 方法**

将 `admin.service.ts` 中的 `getEventDetail` 方法替换为：

```typescript
async getEventDetail(event_id: string) {
  const event = await this.eventRepo.findOne({ where: { event_id } });
  if (!event) throw new Error('Event not found');

  // 基础字段映射
  const base = {
    event_id: event.event_id,
    event_type: event.event_type,
    status: event.status,
    description: event.description,
    address: event.address,
    location_lat: event.location_lat,
    location_lng: event.location_lng,
    occurred_at: event.occurred_at,
    photos: event.photos || [],
    fusion_score: event.fusion_score ?? null,
    vector_similarity: event.vector_similarity ?? null,
    gps_similarity: event.gps_similarity ?? null,
    image_similarity: event.image_similarity ?? null,
    text_match_rate: event.text_match_rate ?? null,
    reporter_id: event.reporter_id,
    created_at: event.created_at,
    animal_id: event.animal_id || null,
  };

  // 如果有 candidates 候选列表，进行精细化拼装
  if (event.candidates && event.candidates.length > 0) {
    // 获取候选对应的 animal 详情
    const animalIds = event.candidates.map((c: any) => c.animal_id).filter(Boolean);
    const animals = animalIds.length > 0
      ? await this.animalRepo.findByIds(animalIds)
      : [];
    const animalMap = new Map(animals.map((a: any) => [a.animal_id, a]));

    const candidates = event.candidates.map((c: any) => {
      const animal = animalMap.get(c.animal_id);
      return {
        animal_id: c.animal_id,
        breed: animal?.breed || c.breed || '',
        color: animal?.color || c.color || '',
        gender: animal?.gender || c.gender || '',
        status: animal?.status || c.status || '',
        photos: animal?.photos || c.photos || [],
        address: animal?.address || c.address || '',
        fusion_score: c.fusion_score,
        vector_similarity: c.vector_similarity,
        gps_similarity: c.gps_similarity,
        image_similarity: c.image_similarity,
        text_match_rate: c.text_match_rate,
        is_recommended: c.is_recommended || false,
      };
    });

    return { ...base, candidates };
  }

  return { ...base, candidates: [] };
}
```

> **注意**：`this.animalRepo.findByIds` 是 TypeORM Repository 方法。如果编译报错，改为 `await this.animalRepo.find({ where: { animal_id: In(animalIds) } })`（需要导入 `In` from `typeorm`）。

- [ ] **Step 2: 提交**

```bash
git add backend/src/admin/admin.service.ts
git commit -m "feat: getEventDetail returns four-dimension scores and enriched candidates list"
```

---

## Task 6: AdminService.confirmEvent 支持 animal_id + controller 改造

**Files:**
- Modify: `backend/src/admin/admin.service.ts`
- Modify: `backend/src/admin/admin.controller.ts`

- [ ] **Step 1: 改造 AdminService.confirmEvent 方法**

将 `admin.service.ts` 中的 `confirmEvent` 方法替换为：

```typescript
async confirmEvent(event_id: string, animal_id?: string) {
  const event = await this.eventRepo.findOne({ where: { event_id } });
  if (!event) throw new Error('Event not found');

  if (animal_id) {
    // 校验动物存在
    const animal = await this.animalRepo.findOne({ where: { animal_id } });
    if (!animal) throw new Error('Animal not found');

    await this.eventRepo.update({ event_id }, {
      animal_id,
      status: 'duplicated' as any,
      is_duplicate: true,
    } as any);
  } else {
    // 纯标签更新（向后兼容）
    await this.eventRepo.update({ event_id }, {
      status: 'duplicated' as any,
      is_duplicate: true,
    } as any);
  }

  return this.getEventDetail(event_id);
}
```

- [ ] **Step 2: 改造 AdminController.confirmEvent 端点**

将 `admin.controller.ts` 中的 `confirmEvent` 方法替换为：

```typescript
@Put('events/:event_id/confirm')
@ApiOperation({ summary: '确认重复事件' })
confirmEvent(@Param('event_id') id: string, @Body() body: { animal_id?: string }) {
  return this.adminService.confirmEvent(id, body.animal_id);
}
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/admin/admin.service.ts backend/src/admin/admin.controller.ts
git commit -m "feat: confirmEvent accepts animal_id and links event to animal"
```

---

## Task 7: 验证与测试

**Files:**
- N/A（手动 API 测试）

- [ ] **Step 1: 启动后端服务**

```bash
cd backend && npm run start:dev
```

- [ ] **Step 2: 测试 processEvent 接口**

用已有事件测试（需要事件有 nose_photo_url）：

```bash
curl -X POST http://localhost:3000/admin/events/{event_id}/process \
  -H "Authorization: Bearer {token}"
```

**预期响应**：
```json
{
  "event_id": "...",
  "status": "pending",
  "fusion_score": 0.82,
  "candidates_count": 5,
  "message": "AI比对完成"
}
```

- [ ] **Step 3: 测试 getEventDetail 接口**

```bash
curl http://localhost:3000/admin/events/{event_id} \
  -H "Authorization: Bearer {token}"
```

**预期响应**：包含 `vector_similarity`、`gps_similarity`、`image_similarity`、`text_match_rate`、`candidates` 数组。

- [ ] **Step 4: 测试 confirmEvent 带 animal_id**

```bash
curl -X PUT http://localhost:3000/admin/events/{event_id}/confirm \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"animal_id": "A001"}'
```

**预期**：event 的 `animal_id` 被设置，`status` 变为 `duplicated`。

---

## 缺口记录

| 缺口 | 状态 |
|------|------|
| events 表加字段（需数据库 migration） | ⚠️ TypeORM sync 会自动创建列（开发环境） |
| 前端接入真实接口（Task 5 等后端就绪） | ⏸️ BLOCKED |
