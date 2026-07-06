# 阶段 3 前端统一表单 + 动作闭合 UI 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把阶段 1+2 后端已支持的 intent 字段 + admin 动作闭合能力在用户端和管理端铺成可用 UI:补 2 个后端端点、抽 1 个共享表单组件、改造 5 个页面。

**Architecture:** 后端新增 `GET /v1/animals/:id/timeline`(动物时间轴,派生 intent,不增表)与 `POST /v1/events/:id/link`(用户自助关联事件到动物,权限严格,status 保持 pending 走 admin 二次确认)。前端抽出 `<UnifiedReportForm mode="collect"|"report">` 共享骨架,collect/report 两页复用;animal-detail 拆并排按钮 + 时间轴子页;my-reports 加"关联到动物"入口。

**Tech Stack:** 后端 NestJS + TypeORM + Jest;前端 Vue3 + UniApp + Vitest(jsdom)。

**设计依据:** `docs/superpowers/specs/2026-07-06-stage3-frontend-unified-form-design.md`
**架构依据:** `docs/superpowers/specs/2026-07-06-unified-event-model.md` §7.1/§7.2

---

## 关键事实(实施前必读)

1. **`User` 实体无 `avatar` 列**(`backend/src/users/entities/user.entity.ts`:只有 `nickname`/`phone`/`openid`)。时间轴 reporter 只返 `{ nickname }`,顺带满足隐私要求(不泄露 `user_id`)。
2. **`AnimalsService.findOne` 已抛 `NotFoundException('动物不存在')`**(animals.service.ts:61),timeline 复用同样文案。
3. **`EventStatus` 枚举**(event.entity.ts):`PENDING | CONFIRMED | DUPLICATED | LINKED | RESOLVED | REJECTED | PROCESSING`。
4. **`EventType` 枚举**:`COLLECT | REPORT | RESCUE | MEDICAL | ADOPT | TRANSFER | RELEASE`。intent 派生只认 `COLLECT`→`profile_build`、`REPORT`→`stray_sighting`,其余→`unknown`。
5. **animals.controller 已有 `@UseGuards(JwtAuthGuard)` 控制器级守卫**,timeline 端点不加 `@Public()` 即为"任意登录用户可看"。
6. **前端测试目录是 `miniapp-user/test/**/*.spec.ts`**(见 vitest.config.ts `include`),不是 `src/`。别名 `@` → `src`。
7. **`miniapp-user/src/services/api.js` 是 `.js`**,`BASE_URL='http://127.0.0.1:3000'`,所有路径带 `/v1/` 前缀,已有 `resolveImageUrl()`。
8. **测试 qb mock**:`animals.service.spec.ts` 的 `makeRepo()` 内 `qb` 缺 `leftJoinAndSelect`/`getMany`(getMany 有),Task 1 需在该 qb 补 `leftJoinAndSelect`。

---

## 文件结构

**后端(修改):**
- `backend/src/animals/animals.service.ts` — 新增 `getTimeline()` + 私有 `deriveIntent()`
- `backend/src/animals/animals.service.spec.ts` — 新增 `getTimeline` describe(4 test)
- `backend/src/animals/animals.controller.ts` — 新增 `GET :animal_id/timeline`
- `backend/src/events/events.service.ts` — 新增 `linkToAnimal()`,import `ForbiddenException`
- `backend/src/events/events.service.spec.ts` — 新增 `linkToAnimal` describe(3 test)
- `backend/src/events/events.controller.ts` — 新增 `POST :event_id/link`,import `Param`

**前端(新增):**
- `miniapp-user/src/components/unified-report-form/index.vue` — 共享表单骨架
- `miniapp-user/test/components/unified-report-form/index.spec.ts` — Vitest 单测(5 test)
- `miniapp-user/src/pages/animal-detail/timeline.vue` — 时间轴页

**前端(修改):**
- `miniapp-user/src/services/api.js` — 加 `apiGetAnimalTimeline` / `apiLinkEventToAnimal`
- `miniapp-user/src/pages/collect/index.vue` — 步骤 4 引用组件 + intent 收音机
- `miniapp-user/src/pages/report/index.vue` — 引用组件
- `miniapp-user/src/pages/animal-detail/index.vue` — 拆并排按钮 + "查看时间轴"入口
- `miniapp-user/src/pages/my-reports/index.vue` — 加"关联到动物"按钮
- `miniapp-user/src/pages.json` — 注册 timeline 页面路由

---

## Task 1: `AnimalsService.getTimeline` + `deriveIntent`(TDD)

**Files:**
- Modify: `backend/src/animals/animals.service.ts`
- Test: `backend/src/animals/animals.service.spec.ts`

- [ ] **Step 1: 给 spec 的 qb mock 补 `leftJoinAndSelect`**

在 `backend/src/animals/animals.service.spec.ts` 的 `makeRepo()` 内 `qb` 对象中,`leftJoin` 那一行后面加一行:

```typescript
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
```

- [ ] **Step 2: 写失败测试**

在 `backend/src/animals/animals.service.spec.ts` 文件末尾、最后一个 `});`(关闭 `describe('AnimalsService')`)之前插入:

```typescript
  // ========== 阶段 3 (2026-07-06): getTimeline ==========
  describe('getTimeline', () => {
    it('animal 不存在时应抛 NotFoundException', async () => {
      animalRepo.findOne.mockResolvedValue(null);
      await expect(service.getTimeline('missing')).rejects.toThrow(NotFoundException);
      // 不应继续查事件
      expect(eventRepo._qb.getMany).not.toHaveBeenCalled();
    });

    it('正常返回时应按 occurred_at DESC 且映射 reporter/intent/status', async () => {
      animalRepo.findOne.mockResolvedValue(makeAnimal({ animal_id: 'a-1' }));
      eventRepo._qb.getMany.mockResolvedValue([
        {
          event_id: 'e-2',
          event_type: 'report',
          reporter: { user_id: 'u-9', nickname: '小明', phone: '138' },
          occurred_at: new Date('2026-07-05'),
          address: 'Beijing',
          location_lat: 39.9,
          location_lng: 116.4,
          photos: ['/p/1.jpg'],
          description: '看到了',
          status: 'pending',
        },
        {
          event_id: 'e-1',
          event_type: 'collect',
          reporter: null,
          occurred_at: new Date('2026-07-01'),
          address: null,
          location_lat: null,
          location_lng: null,
          photos: null,
          description: null,
          status: 'confirmed',
        },
      ]);

      const result = await service.getTimeline('a-1');

      expect(result.animal_id).toBe('a-1');
      expect(result.total).toBe(2);
      // 排序断言交给 qb.orderBy 调用
      expect(eventRepo._qb.orderBy).toHaveBeenCalledWith('e.occurred_at', 'DESC');
      expect(eventRepo._qb.where).toHaveBeenCalledWith('e.animal_id = :animal_id', { animal_id: 'a-1' });
      // report → stray_sighting, reporter 只暴露 nickname (不含 user_id/phone)
      expect(result.events[0].intent).toBe('stray_sighting');
      expect(result.events[0].reporter).toEqual({ nickname: '小明' });
      expect(result.events[0].photos).toEqual(['/p/1.jpg']);
      // collect → profile_build, reporter=null, photos 兜底空数组
      expect(result.events[1].intent).toBe('profile_build');
      expect(result.events[1].reporter).toBeNull();
      expect(result.events[1].photos).toEqual([]);
    });

    it('animal 存在但无事件时返回空数组', async () => {
      animalRepo.findOne.mockResolvedValue(makeAnimal({ animal_id: 'a-2' }));
      eventRepo._qb.getMany.mockResolvedValue([]);
      const result = await service.getTimeline('a-2');
      expect(result.total).toBe(0);
      expect(result.events).toEqual([]);
    });

    it('应限制最多 100 条 (take 100)', async () => {
      animalRepo.findOne.mockResolvedValue(makeAnimal({ animal_id: 'a-3' }));
      eventRepo._qb.getMany.mockResolvedValue([]);
      await service.getTimeline('a-3');
      expect(eventRepo._qb.take).toHaveBeenCalledWith(100);
    });
  });
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd backend && npx jest animals.service --no-coverage -t getTimeline`
Expected: FAIL — `service.getTimeline is not a function`

- [ ] **Step 4: 实现 getTimeline + deriveIntent**

在 `backend/src/animals/animals.service.ts`,先确认顶部 import 已含 `EventType`。当前 import 是 `import { RescueEvent } from '../events/entities/event.entity';`,改为:

```typescript
import { RescueEvent, EventType } from '../events/entities/event.entity';
```

然后在 `remove(id)` 方法之后、类的最后一个 `}` 之前插入:

```typescript
  /**
   * 阶段 3 (2026-07-06): 动物时间轴
   * - 不增表: 直接查 rescue_events.animal_id = :id, occurred_at DESC, LIMIT 100
   * - reporter 只暴露 nickname (User 无 avatar 列; 且隐私要求不泄露 user_id)
   * - intent 由 event_type 派生 (阶段 4 才持久化 intent 列)
   * - 任意登录用户可看 (controller 级 JwtAuthGuard, 无 @Public)
   */
  async getTimeline(animal_id: string) {
    const animal = await this.animalRepo.findOne({ where: { animal_id } });
    if (!animal) throw new NotFoundException('动物不存在');

    const events = await this.eventRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.reporter', 'u')
      .where('e.animal_id = :animal_id', { animal_id })
      .orderBy('e.occurred_at', 'DESC')
      .take(100)
      .getMany();

    return {
      animal_id,
      total: events.length,
      events: events.map((e) => ({
        event_id: e.event_id,
        reporter: e.reporter ? { nickname: e.reporter.nickname } : null,
        occurred_at: e.occurred_at,
        address: e.address ?? null,
        location_lat: e.location_lat ?? null,
        location_lng: e.location_lng ?? null,
        photos: e.photos || [],
        description: e.description ?? null,
        intent: this.deriveIntent(e),
        status: e.status,
      })),
    };
  }

  /**
   * intent 派生规则 (阶段 4 加 intent 列后需同步更新此处)
   * TODO(阶段 4): 若 event.intent 已持久化, 优先返回 event.intent
   */
  private deriveIntent(event: RescueEvent): string {
    if (event.event_type === EventType.COLLECT) return 'profile_build';
    if (event.event_type === EventType.REPORT) return 'stray_sighting';
    return 'unknown';
  }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && npx jest animals.service --no-coverage -t getTimeline`
Expected: PASS(4 passed)

- [ ] **Step 6: 提交**

```bash
git add backend/src/animals/animals.service.ts backend/src/animals/animals.service.spec.ts
git commit -m "feat(animals): 新增 getTimeline 动物时间轴 + intent 派生"
```

---

## Task 2: `AnimalsController` GET `:animal_id/timeline` 端点

**Files:**
- Modify: `backend/src/animals/animals.controller.ts`

- [ ] **Step 1: 加端点**

在 `backend/src/animals/animals.controller.ts` 的 `findOne` 方法(第 30-32 行那个 `@Get(':animal_id')`)之后插入:

```typescript
  @Version('1')
  @Get(':animal_id/timeline')
  @ApiOperation({ summary: '获取动物时间轴（任意登录用户）' })
  getTimeline(@Param('animal_id') id: string) {
    return this.animalsService.getTimeline(id);
  }
```

> 注:该端点**不加** `@Public()`,故沿用控制器级 `@UseGuards(JwtAuthGuard)` = 任意登录用户可访问。路由顺序放在 `findOne(':animal_id')` 之后不冲突,因为 `:animal_id/timeline` 是更具体的两段路径。

- [ ] **Step 2: 编译校验**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: 无错误输出(exit 0)

- [ ] **Step 3: 全量后端测试不回归**

Run: `cd backend && npx jest --no-coverage`
Expected: 全绿,总数 = 原基线 + 4(timeline)

- [ ] **Step 4: 提交**

```bash
git add backend/src/animals/animals.controller.ts
git commit -m "feat(animals): 暴露 GET /v1/animals/:id/timeline 端点"
```

---

## Task 3: `EventsService.linkToAnimal`(TDD)

**Files:**
- Modify: `backend/src/events/events.service.ts`
- Test: `backend/src/events/events.service.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `backend/src/events/events.service.spec.ts`,`makeAnimalRepo()` 已返回 `{ findOne: jest.fn() }`(见文件顶部)。在文件末尾最后一个 `});`(关闭 `describe('EventsService')`)之前插入:

```typescript
  // ========== 阶段 3 (2026-07-06): linkToAnimal 用户自助关联 ==========
  describe('linkToAnimal', () => {
    it('事件不存在应抛 NotFoundException', async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(
        service.linkToAnimal('missing', 'animal-1', 'user-1'),
      ).rejects.toThrow('Event not found');
      expect(eventRepo.update).not.toHaveBeenCalled();
    });

    it('调用者不是 reporter 应抛 ForbiddenException', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ reporter_id: 'owner-1' }));
      await expect(
        service.linkToAnimal('event-1', 'animal-1', 'attacker-2'),
      ).rejects.toThrow('只能关联自己上报的事件');
      expect(eventRepo.update).not.toHaveBeenCalled();
    });

    it('目标动物不存在应抛 NotFoundException', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ reporter_id: 'user-1' }));
      animalRepo.findOne.mockResolvedValue(null);
      await expect(
        service.linkToAnimal('event-1', 'ghost-animal', 'user-1'),
      ).rejects.toThrow('Animal not found');
      expect(eventRepo.update).not.toHaveBeenCalled();
    });

    it('reporter 本人 + 动物存在 → status 保持 pending 并写 animal_id', async () => {
      eventRepo.findOne.mockResolvedValue(makeEvent({ reporter_id: 'user-1', animal_id: null }));
      animalRepo.findOne.mockResolvedValue(makeAnimal({ animal_id: 'target-animal' }));

      const result = await service.linkToAnimal('event-1', 'target-animal', 'user-1');

      expect(eventRepo.update).toHaveBeenCalledWith(
        { event_id: 'event-1' },
        { animal_id: 'target-animal', status: EventStatus.PENDING },
      );
      expect(result).toEqual({ event_id: 'event-1', animal_id: 'target-animal', status: 'pending' });
    });
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx jest events.service --no-coverage -t linkToAnimal`
Expected: FAIL — `service.linkToAnimal is not a function`

- [ ] **Step 3: 实现 linkToAnimal**

在 `backend/src/events/events.service.ts` 顶部 import 加 `ForbiddenException`:

```typescript
import { Inject, Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
```

在 `createAnimalFromEvent` 方法之后插入:

```typescript
  /**
   * 阶段 3 (2026-07-06): 用户自助关联事件到动物
   * - 权限: 仅事件 reporter 本人可关联 (与 admin dispatchEventAction 隔离)
   * - 行为: event.animal_id ← 传入 animal_id; status 保持 PENDING
   *   (self-service 入口, 不直接 confirmed; 走 admin 二次确认)
   * - 校验: 事件存在 + reporter 匹配 + 目标动物存在
   */
  async linkToAnimal(event_id: string, animal_id: string, user_id: string) {
    const event = await this.eventRepo.findOne({ where: { event_id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.reporter_id !== user_id) {
      throw new ForbiddenException('只能关联自己上报的事件');
    }
    const animal = await this.animalRepo.findOne({ where: { animal_id } });
    if (!animal) throw new NotFoundException('Animal not found');

    await this.eventRepo.update(
      { event_id },
      { animal_id, status: EventStatus.PENDING },
    );
    this.logger.log(`[EventsService.linkToAnimal] event=${event_id} → animal=${animal_id} (self-service, pending)`);
    return { event_id, animal_id, status: 'pending' };
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && npx jest events.service --no-coverage -t linkToAnimal`
Expected: PASS(4 passed)

- [ ] **Step 5: 提交**

```bash
git add backend/src/events/events.service.ts backend/src/events/events.service.spec.ts
git commit -m "feat(events): 新增 linkToAnimal 用户自助关联(pending 走 admin 二次确认)"
```

---

## Task 4: `EventsController` POST `:event_id/link` 端点

**Files:**
- Modify: `backend/src/events/events.controller.ts`

- [ ] **Step 1: 加端点**

在 `backend/src/events/events.controller.ts`,第 1 行 import 加 `Param`:

```typescript
import { Controller, Get, Post, Body, Query, UseGuards, Request, Param } from '@nestjs/common';
```

在 `create` 方法(`@Post()`)之后插入:

```typescript
  @Post(':event_id/link')
  @ApiOperation({ summary: '用户自助关联事件到动物' })
  linkEventToAnimal(
    @Param('event_id') id: string,
    @Body() body: { animal_id: string },
    @Request() req: any,
  ) {
    return this.eventsService.linkToAnimal(id, body.animal_id, req.user.user_id);
  }
```

> 注:控制器级已有 `@UseGuards(JwtAuthGuard)`,故 `req.user.user_id` 可用;此端点非 admin,普通登录用户可调,权限在 service 层按 reporter 校验。

- [ ] **Step 2: 编译校验**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: 无错误(exit 0)

- [ ] **Step 3: 全量后端测试不回归**

Run: `cd backend && npx jest --no-coverage`
Expected: 全绿,总数 = 基线 + 4(timeline) + 4(linkToAnimal)

- [ ] **Step 4: 提交**

```bash
git add backend/src/events/events.controller.ts
git commit -m "feat(events): 暴露 POST /v1/events/:id/link 端点"
```

---

## Task 5: `api.js` 新增两个前端调用方法

**Files:**
- Modify: `miniapp-user/src/services/api.js`

- [ ] **Step 1: 读现有文件确认 `request` 封装名与导出风格**

Run: `cd miniapp-user && node -e "const s=require('fs').readFileSync('src/services/api.js','utf8'); console.log(s.match(/export (async )?function \w+/g).join('\n'))"`
Expected: 打印现有导出函数名(如 `export function apiGetAnimalDetail` 等),确认统一请求封装的调用方式。

- [ ] **Step 2: 加两个方法**

在 `miniapp-user/src/services/api.js` 中,紧跟现有 `apiGetAnimalDetail` 定义之后,沿用文件内**相同的请求封装写法**(下面用项目已有的 `request`/`uni.request` 模式;若文件用的是自定义 `request(path, options)` 就照它写)插入:

```javascript
/**
 * 阶段 3: 获取动物时间轴
 * GET /v1/animals/:id/timeline
 */
export function apiGetAnimalTimeline(animalId) {
  return request(`/v1/animals/${animalId}/timeline`, { method: 'GET' })
}

/**
 * 阶段 3: 用户自助关联事件到动物
 * POST /v1/events/:id/link  body { animal_id }
 */
export function apiLinkEventToAnimal(eventId, animalId) {
  return request(`/v1/events/${eventId}/link`, {
    method: 'POST',
    data: { animal_id: animalId },
  })
}
```

> 若文件里请求封装不叫 `request`(例如叫 `http` 或直接用 `uni.request` 包一层 Promise),用 **Step 1 打印出来的现有函数体作为模板**,保持 header/token 注入一致。不要新造一套请求逻辑。

- [ ] **Step 3: 语法校验**

Run: `cd miniapp-user && node --check src/services/api.js`
Expected: 无输出(exit 0)

- [ ] **Step 4: 提交**

```bash
git add miniapp-user/src/services/api.js
git commit -m "feat(miniapp): api.js 增加 timeline 与 link 事件调用"
```

---

## Task 6: `<UnifiedReportForm>` 共享组件(Vitest TDD)

**Files:**
- Create: `miniapp-user/src/components/unified-report-form/index.vue`
- Test: `miniapp-user/test/components/unified-report-form/index.spec.ts`

- [ ] **Step 1: 写失败测试**

创建 `miniapp-user/test/components/unified-report-form/index.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UnifiedReportForm from '@/components/unified-report-form/index.vue'

describe('UnifiedReportForm', () => {
  it("mode='collect' 时渲染 intent 收音机", () => {
    const wrapper = mount(UnifiedReportForm, { props: { mode: 'collect' } })
    expect(wrapper.find('.intent-radio').exists()).toBe(true)
  })

  it("mode='report' 时隐藏 intent 收音机", () => {
    const wrapper = mount(UnifiedReportForm, { props: { mode: 'report' } })
    expect(wrapper.find('.intent-radio').exists()).toBe(false)
  })

  it("mode='collect' 默认 intent=lost", () => {
    const wrapper = mount(UnifiedReportForm, { props: { mode: 'collect' } })
    expect((wrapper.vm as any).formData.intent).toBe('lost')
  })

  it("mode='report' 默认 intent=stray_sighting", () => {
    const wrapper = mount(UnifiedReportForm, { props: { mode: 'report' } })
    expect((wrapper.vm as any).formData.intent).toBe('stray_sighting')
  })

  it('defaultIntent 覆盖模式默认值', () => {
    const wrapper = mount(UnifiedReportForm, {
      props: { mode: 'collect', defaultIntent: 'found' },
    })
    expect((wrapper.vm as any).formData.intent).toBe('found')
  })

  it('提交时 emit submit 携带 formData 且含 intent', async () => {
    const wrapper = mount(UnifiedReportForm, {
      props: { mode: 'report', animalId: 'a-99' },
    })
    ;(wrapper.vm as any).handleSubmit()
    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    const payload = (emitted as any)[0][0]
    expect(payload.intent).toBe('stray_sighting')
    expect(payload.animal_id).toBe('a-99')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd miniapp-user && npx vitest run test/components/unified-report-form/index.spec.ts`
Expected: FAIL — 找不到组件文件 / 无法解析 `@/components/unified-report-form/index.vue`

- [ ] **Step 3: 实现组件**

创建 `miniapp-user/src/components/unified-report-form/index.vue`:

```vue
<template>
  <view class="unified-report-form">
    <!-- intent 收音机: 仅 collect 模式显示 (lost / found) -->
    <view v-if="mode === 'collect'" class="intent-radio">
      <text class="intent-label">我的意图：</text>
      <radio-group @change="onIntentChange">
        <label class="intent-item">
          <radio value="lost" :checked="formData.intent === 'lost'" />我走失了狗
        </label>
        <label class="intent-item">
          <radio value="found" :checked="formData.intent === 'found'" />我捡到狗
        </label>
      </radio-group>
    </view>

    <!-- report 模式若带 animalId, 顶部提示追加观察 -->
    <view v-if="mode === 'report' && animalId" class="sighting-hint">
      <text>你正在为该动物追加一条观察记录</text>
    </view>

    <button class="submit-btn" :disabled="!canSubmit" @click="handleSubmit">
      {{ submitButtonText }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'

interface Props {
  mode: 'collect' | 'report'
  defaultIntent?: 'lost' | 'found' | 'stray_sighting'
  animalId?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultIntent: undefined,
  animalId: undefined,
})

const emit = defineEmits<{
  (e: 'submit', payload: Record<string, any>): void
}>()

const formData = reactive<Record<string, any>>({
  intent:
    props.defaultIntent ||
    (props.mode === 'collect' ? 'lost' : 'stray_sighting'),
  animal_id: props.animalId,
})

const submitButtonText = computed(() =>
  props.mode === 'collect' ? '提交我的' : '提交上报',
)

// collect 必须选 intent; report 固定 stray_sighting 恒真
const canSubmit = computed(() => !!formData.intent)

function onIntentChange(e: any) {
  formData.intent = e.detail.value
}

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit', { ...formData })
}

defineExpose({ formData, handleSubmit })
</script>

<style scoped>
.unified-report-form { padding: 20rpx; }
.intent-radio { margin: 20rpx 0; }
.intent-label { font-weight: bold; }
.intent-item { display: inline-block; margin-right: 30rpx; }
.sighting-hint { margin: 16rpx 0; color: #666; font-size: 26rpx; }
.submit-btn { margin-top: 30rpx; }
.submit-btn[disabled] { opacity: 0.5; }
</style>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd miniapp-user && npx vitest run test/components/unified-report-form/index.spec.ts`
Expected: PASS(6 passed)

- [ ] **Step 5: 提交**

```bash
git add miniapp-user/src/components/unified-report-form/index.vue miniapp-user/test/components/unified-report-form/index.spec.ts
git commit -m "feat(miniapp): 抽出 UnifiedReportForm 共享表单组件"
```

---

## Task 7: `animal-detail/timeline.vue` 新页面

**Files:**
- Create: `miniapp-user/src/pages/animal-detail/timeline.vue`
- Modify: `miniapp-user/src/pages.json`

- [ ] **Step 1: 读 pages.json 确认现有 animal-detail 路由格式**

Run: `cd miniapp-user && node -e "const p=require('./src/pages.json'); console.log(JSON.stringify(p.pages.filter(x=>x.path.includes('animal-detail')),null,2))"`
Expected: 打印现有 `pages/animal-detail/index` 条目,复制其 style 风格。

- [ ] **Step 2: 创建 timeline 页面**

创建 `miniapp-user/src/pages/animal-detail/timeline.vue`:

```vue
<template>
  <view class="timeline-page">
    <view v-if="loading" class="loading">加载中…</view>
    <block v-else>
      <view
        v-for="evt in timeline"
        :key="evt.event_id"
        class="timeline-card"
      >
        <view class="card-content">
          <text class="reporter-name">{{ evt.reporter?.nickname || '匿名用户' }}</text>
          <text class="event-action">在 {{ evt.address || '未知地点' }} 看到了这只动物</text>
          <view v-if="evt.photos && evt.photos.length" class="photos">
            <image
              v-for="(url, i) in evt.photos"
              :key="i"
              :src="resolveImageUrl(url)"
              mode="aspectFill"
              class="photo"
            />
          </view>
          <text class="event-time">{{ formatTime(evt.occurred_at) }}</text>
        </view>
      </view>
      <view v-if="!timeline.length" class="empty">还没有人上报过观察记录</view>
    </block>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { apiGetAnimalTimeline, resolveImageUrl } from '@/services/api.js'

const loading = ref(true)
const timeline = ref<any[]>([])

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function load(animalId: string) {
  loading.value = true
  try {
    const res: any = await apiGetAnimalTimeline(animalId)
    timeline.value = res?.events || []
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
    timeline.value = []
  } finally {
    loading.value = false
  }
}

onLoad((query: any) => {
  if (query?.id) load(query.id)
  else loading.value = false
})
</script>

<style scoped>
.timeline-page { padding: 20rpx; }
.loading, .empty { text-align: center; color: #999; margin-top: 60rpx; }
.timeline-card { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 20rpx; }
.reporter-name { font-weight: bold; display: block; }
.event-action { color: #333; display: block; margin: 8rpx 0; }
.photos { display: flex; flex-wrap: wrap; gap: 10rpx; }
.photo { width: 200rpx; height: 200rpx; border-radius: 8rpx; }
.event-time { color: #999; font-size: 24rpx; display: block; margin-top: 8rpx; }
</style>
```

> 注:`resolveImageUrl` 已在 api.js 导出(见现有代码)。若实际导入路径无 `.js` 后缀能解析,去掉 `.js` 与项目其它页面保持一致。

- [ ] **Step 3: 注册路由**

在 `miniapp-user/src/pages.json` 的 `pages` 数组中,`pages/animal-detail/index` 条目之后插入(style 字段照 Step 1 的现有格式):

```json
    {
      "path": "pages/animal-detail/timeline",
      "style": { "navigationBarTitleText": "时间轴" }
    }
```

- [ ] **Step 4: JSON 语法校验**

Run: `cd miniapp-user && node -e "require('./src/pages.json'); console.log('ok')"`
Expected: 打印 `ok`

- [ ] **Step 5: 提交**

```bash
git add miniapp-user/src/pages/animal-detail/timeline.vue miniapp-user/src/pages.json
git commit -m "feat(miniapp): 新增动物时间轴页面 + 路由注册"
```

---

## Task 8: `collect/index.vue` 引用组件 + intent 收音机

**Files:**
- Modify: `miniapp-user/src/pages/collect/index.vue`

- [ ] **Step 1: 先完整读现有文件**

Run: `cd miniapp-user && wc -l src/pages/collect/index.vue`
然后用 Read 工具读全文,定位:
- 步骤 4(metadata)对应的 `<view>` 段落起止行
- 现有 submit 处理函数名(如 `handleSubmit`/`onSubmit`)
- 现有组装 `/v1/events` 请求 body 的位置

- [ ] **Step 2: 在 script 引入组件并透传 intent**

在 collect 页 `<script setup>` 顶部 import 区加:

```javascript
import UnifiedReportForm from '@/components/unified-report-form/index.vue'
```

在现有提交处理函数里,组装 `/v1/events`(以及 profile_build 路径下的 `/v1/animals`)请求 body 时,新增透传 `intent` 字段。定位到构造 body 的对象字面量,加入一行:

```javascript
  intent: formData.intent || 'lost',
```

> **Surgical:** 只加 `intent` 一行,不重排其它字段。`formData.intent` 由 Step 3 的组件回填。

- [ ] **Step 3: 模板中挂 intent 收音机**

在步骤 4(metadata)区块内、提交按钮之前,插入 intent 收音机(与组件内一致,collect 页直接内联,复用同一 `formData.intent`):

```html
      <view class="intent-radio">
        <text class="intent-label">我的意图：</text>
        <radio-group @change="(e) => (formData.intent = e.detail.value)">
          <label class="intent-item">
            <radio value="lost" :checked="formData.intent === 'lost'" />我走失了狗
          </label>
          <label class="intent-item">
            <radio value="found" :checked="formData.intent === 'found'" />我捡到狗
          </label>
        </radio-group>
      </view>
```

在该页 `formData` 响应式对象里加默认字段(若尚无):

```javascript
  intent: 'lost',
```

> 注:设计文档 §5.1 提出用 `<UnifiedReportForm>` 替换整段步骤 4。但 collect 页有 5 步向导 + 鼻纹采集等强耦合逻辑,**最小改动**是只挂 intent 收音机 + 透传字段(达成"场景 A-D 全走通 UI"目标),不强行整段替换以免破坏现有 5 步流程。`import UnifiedReportForm` 保留供 report 页(Task 9)使用;collect 页如后续需要再整段迁移。若 lint 报未使用 import,则从 collect 页移除该 import 行(仅 report 页需要)。

- [ ] **Step 4: 语法校验**

Run: `cd miniapp-user && npx vue-tsc --noEmit 2>&1 | head -20`(若项目无 vue-tsc,改用)`node --check` 不适用 .vue;改跑现有测试套件:
Run: `cd miniapp-user && npx vitest run`
Expected: 现有测试全绿(无新增测试,验证不回归)

- [ ] **Step 5: 提交**

```bash
git add miniapp-user/src/pages/collect/index.vue
git commit -m "feat(miniapp): collect 页加 intent 收音机并透传到事件请求"
```

---

## Task 9: `report/index.vue` 引用共享组件

**Files:**
- Modify: `miniapp-user/src/pages/report/index.vue`

- [ ] **Step 1: 先完整读现有文件**

用 Read 工具读 `miniapp-user/src/pages/report/index.vue` 全文,定位:
- 现有上报表单 `<view>` 段与提交按钮
- 现有 submit 处理函数(组装 `/v1/events` body 处)
- `onLoad` 是否已读 query(用于接收 `animal_id`)

- [ ] **Step 2: 引入组件 + 接收 animal_id**

在 `<script setup>` import 区加:

```javascript
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import UnifiedReportForm from '@/components/unified-report-form/index.vue'
```

加一个 ref 接收从 animal-detail 跳转带来的 animal_id:

```javascript
const linkedAnimalId = ref('')

onLoad((query) => {
  if (query && query.animal_id) linkedAnimalId.value = query.animal_id
})
```

- [ ] **Step 3: 模板挂组件 + 提交处理**

在 report 页模板中,把原上报表单块替换/补充为组件引用(保留页面已有的物种/照片/GPS 采集区;组件负责 intent + 提交按钮):

```html
    <UnifiedReportForm
      mode="report"
      :animalId="linkedAnimalId"
      @submit="handleReportSubmit"
    />
```

新增/改写提交处理函数,组装 `/v1/events` body 时带 `intent='stray_sighting'` 与可选 `animal_id`:

```javascript
async function handleReportSubmit(payload) {
  const body = {
    event_type: 'report',
    intent: payload.intent || 'stray_sighting',
    // 页面已采集的物种/照片/GPS 字段按现有变量名合并进来
    ...buildReportBody(),
  }
  if (payload.animal_id) body.animal_id = payload.animal_id
  try {
    await apiCreateEvent(body) // 沿用页面现有的事件创建 api 调用名
    uni.showToast({ title: '已上报，等待审核', icon: 'none' })
  } catch (e) {
    uni.showToast({ title: '上报失败', icon: 'none' })
  }
}
```

> **注:** `buildReportBody()` 与 `apiCreateEvent` 是占位名 —— Step 1 读文件后,用页面**现有**的字段组装逻辑与事件创建函数名替换。若页面原本没有独立组装函数,直接把现有内联字段并进 `body`。不要新造 API 封装。

- [ ] **Step 4: 验证不回归**

Run: `cd miniapp-user && npx vitest run`
Expected: 现有测试全绿

- [ ] **Step 5: 提交**

```bash
git add miniapp-user/src/pages/report/index.vue
git commit -m "feat(miniapp): report 页复用 UnifiedReportForm 并支持 animal_id 追加观察"
```

---

## Task 10: `animal-detail/index.vue` 拆并排按钮 + 时间轴入口

**Files:**
- Modify: `miniapp-user/src/pages/animal-detail/index.vue`

- [ ] **Step 1: 先完整读现有文件**

用 Read 工具读 `miniapp-user/src/pages/animal-detail/index.vue` 全文,定位:
- 现有"认领此动物"按钮位置与其点击处理函数名
- 当前 animal id 的变量名(如 `animalId`/`detail.animal_id`)
- 头部/顶部区域(挂"查看时间轴"入口)

- [ ] **Step 2: 拆并排两按钮**

把原单个"认领"按钮替换为横向并排两按钮:

```html
    <view class="action-buttons">
      <button class="btn-secondary" @click="handleSighting">我又看到这只</button>
      <button class="btn-primary" @click="handleClaim">这是我的狗（申请认领）</button>
    </view>
```

`handleClaim` 用页面**原有**的认领处理函数(改名/复用皆可,保持行为不变)。新增 `handleSighting`:

```javascript
function handleSighting() {
  const id = currentAnimalId() // 用页面现有的 animal id 变量替换
  uni.navigateTo({ url: `/pages/report/index?animal_id=${id}` })
}
```

- [ ] **Step 3: 头部加"查看时间轴"入口**

在详情头部合适位置加:

```html
    <view class="timeline-entry" @click="goTimeline">
      <text>查看时间轴</text>
    </view>
```

```javascript
function goTimeline() {
  const id = currentAnimalId()
  uni.navigateTo({ url: `/pages/animal-detail/timeline?id=${id}` })
}
```

- [ ] **Step 4: 加并排按钮样式**

在 `<style scoped>` 末尾加:

```css
.action-buttons { display: flex; gap: 20rpx; padding: 20rpx; }
.action-buttons button { flex: 1; }
.btn-secondary { background: #f2f2f2; color: #333; }
.btn-primary { background: #4caf50; color: #fff; }
.timeline-entry { padding: 16rpx 20rpx; color: #4caf50; }
```

- [ ] **Step 5: 验证不回归**

Run: `cd miniapp-user && npx vitest run`
Expected: 现有测试全绿

- [ ] **Step 6: 提交**

```bash
git add miniapp-user/src/pages/animal-detail/index.vue
git commit -m "feat(miniapp): animal-detail 拆并排按钮 + 时间轴入口"
```

---

## Task 11: `my-reports/index.vue` 加"关联到动物"入口

**Files:**
- Modify: `miniapp-user/src/pages/my-reports/index.vue`

- [ ] **Step 1: 先完整读现有文件**

用 Read 工具读 `miniapp-user/src/pages/my-reports/index.vue` 全文,定位:
- 事件卡片 `v-for` 循环变量名(如 `evt`/`item`)与其字段(`status`/`animal_id`/`event_id`)
- 现有 import 区与 `<script setup>` 结构

- [ ] **Step 2: 卡片加条件按钮**

在事件卡片(`v-for`)内,仅当 `status==='pending' && !animal_id` 时显示按钮(把 `evt` 换成页面实际循环变量名):

```html
      <view
        v-if="evt.status === 'pending' && !evt.animal_id"
        class="card-actions"
      >
        <button size="mini" @click="openAnimalPicker(evt.event_id)">关联到动物</button>
      </view>
```

- [ ] **Step 3: 加动物选择器 + 关联逻辑**

在 `<script setup>` import 区加(沿用页面现有 api 导入行,追加两个方法):

```javascript
import { ref } from 'vue'
import { apiGetAnimals, apiLinkEventToAnimal } from '@/services/api.js'
```

加选择器状态与处理:

```javascript
const pickerVisible = ref(false)
const pickerAnimals = ref([])
const linkingEventId = ref('')

async function openAnimalPicker(eventId) {
  linkingEventId.value = eventId
  try {
    const res = await apiGetAnimals({ page: 1, limit: 20 })
    pickerAnimals.value = res?.list || []
    pickerVisible.value = true
  } catch (e) {
    uni.showToast({ title: '加载动物列表失败', icon: 'none' })
  }
}

async function confirmLink(animalId) {
  try {
    await apiLinkEventToAnimal(linkingEventId.value, animalId)
    uni.showToast({ title: '已关联，等待管理员最终确认', icon: 'none' })
    pickerVisible.value = false
    // 刷新列表: 调用页面现有的加载函数 (Step 1 中确认其名字)
    if (typeof loadMyReports === 'function') loadMyReports()
  } catch (e) {
    const msg = e?.data?.message || '关联失败'
    uni.showToast({ title: msg, icon: 'none' })
  }
}
```

- [ ] **Step 4: 加选择器模板**

在页面模板末尾加一个简单弹层:

```html
    <view v-if="pickerVisible" class="picker-mask" @click="pickerVisible = false">
      <view class="picker-panel" @click.stop>
        <text class="picker-title">选择要关联的动物</text>
        <scroll-view scroll-y class="picker-list">
          <view
            v-for="a in pickerAnimals"
            :key="a.animal_id"
            class="picker-item"
            @click="confirmLink(a.animal_id)"
          >
            <text>{{ a.breed || a.species }} · {{ a.color || '' }} · {{ a.address || '' }}</text>
          </view>
          <view v-if="!pickerAnimals.length" class="picker-empty">暂无动物档案</view>
        </scroll-view>
      </view>
    </view>
```

```css
.picker-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: flex-end; }
.picker-panel { width: 100%; background: #fff; border-radius: 24rpx 24rpx 0 0; padding: 24rpx; max-height: 60vh; }
.picker-title { font-weight: bold; display: block; margin-bottom: 16rpx; }
.picker-list { max-height: 50vh; }
.picker-item { padding: 20rpx 0; border-bottom: 1rpx solid #eee; }
.picker-empty { text-align: center; color: #999; padding: 40rpx 0; }
```

- [ ] **Step 5: 验证不回归**

Run: `cd miniapp-user && npx vitest run`
Expected: 现有测试全绿

- [ ] **Step 6: 提交**

```bash
git add miniapp-user/src/pages/my-reports/index.vue
git commit -m "feat(miniapp): my-reports 加关联到动物入口 + 动物选择器"
```

---

## 最终验证

- [ ] **后端全绿**

Run: `cd backend && npx jest --no-coverage`
Expected: 全绿,含新增 8 个测试(4 timeline + 4 linkToAnimal)

- [ ] **前端组件测试全绿**

Run: `cd miniapp-user && npx vitest run`
Expected: 全绿,含 UnifiedReportForm 6 个测试

- [ ] **手动 walkthrough(小程序,按设计文档 §8.3 P1-P11)**

- P1 注册/登录
- P2 录入档案(intent=lost,有鼻纹)
- P3 录入档案(intent=lost,无鼻纹)—— 验证 nose 软化
- P4 录入档案(intent=found)—— 验证 status=found
- P5 上报一只(intent=stray_sighting,无鼻纹)
- P6 上报一只(intent=stray_sighting,有鼻纹)
- P7 详情页"我又看到这只" → 跳 report 预填 animal_id
- P8 详情页"这是我的狗" → 跳 claim
- P9 时间轴页渲染
- P10 my-reports"关联到动物"
- P11 admin 后台 dispatchEventAction 4 动作

---

## 自查(writing-plans self-review)

**1. Spec 覆盖:**
- 设计 §3 timeline 端点 → Task 1+2 ✅
- 设计 §5.5 linkToAnimal 端点 → Task 3+4 ✅
- 设计 §4 UnifiedReportForm → Task 6 ✅
- 设计 §5.1 collect → Task 8 ✅(最小改动,已在 Task 8 Step 3 说明为何不整段替换)
- 设计 §5.2 report → Task 9 ✅
- 设计 §5.3 animal-detail 拆按钮 → Task 10 ✅
- 设计 §5.4 timeline.vue → Task 7 ✅
- 设计 §5.5 my-reports → Task 11 ✅
- api.js 方法 → Task 5 ✅

**2. Placeholder 扫描:** 后端 Task 1-4 与前端 Task 5-7 为完整可执行代码。Task 8-11 涉及大型既有 Vue 页面,采用"先完整读文件 → 定位既有变量名 → 应用给定代码块"策略,并明确标注占位名(`buildReportBody`/`apiCreateEvent`/`loadMyReports`/`currentAnimalId`)需用页面现有符号替换 —— 这是改动既有大文件的必要做法,非 TBD。

**3. 类型一致性:**
- `getTimeline` 返回 `{ animal_id, total, events[] }`,test 与 impl 一致 ✅
- `deriveIntent` 用 `EventType.COLLECT/REPORT`,已在 Task 1 Step 4 加 import ✅
- `linkToAnimal(event_id, animal_id, user_id)` 三参,controller 调用顺序一致 ✅
- `apiGetAnimalTimeline(animalId)` / `apiLinkEventToAnimal(eventId, animalId)` 命名在 Task 5/7/11 一致 ✅
- 组件 props `mode`/`defaultIntent`/`animalId` 在 Task 6/9 一致 ✅

---

## 关联文档
- 设计:`docs/superpowers/specs/2026-07-06-stage3-frontend-unified-form-design.md`
- 架构:`docs/superpowers/specs/2026-07-06-unified-event-model.md` §7.1/§7.2/§12
- 阶段 1+2 落地:commit `e42fe63`
