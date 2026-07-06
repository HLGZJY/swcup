# 阶段 3 设计 — 前端统一表单 + admin 端动作闭合 UI

> **状态**:📐 已设计,待评审,**不动代码**
> **编写时间**:2026-07-06
> **对应架构**:`2026-07-06-unified-event-model.md` §7.1 / §7.2
> **依赖**:`feat(events): 统一事件模型阶段 1+2 后端落地` (commit `e42fe63`) 已落地
> **本文档目的**:把 §7.1 的 5 项前端改造从架构层细化到可实施层

---

## 0. TL;DR

阶段 1+2 后端已支持 `intent` 字段 + admin 端 4 动作闭合。阶段 3 是把这些能力在用户端和管理端铺出来,落地为可用的 UI:

1. **后端补一个端点**:`GET /v1/animals/:id/timeline` — 时间轴页数据源
2. **前端抽出共享组件**:`<UnifiedReportForm mode="collect"|"report">` — collect/report 共用表单骨架
3. **5 项页面改造** (按 doc §7.1):
   - `collect/index.vue` 步骤 4 (metadata) 加 intent 收音机
   - `report/index.vue` 复用骨架,intent 默认 `stray_sighting`
   - `animal-detail/index.vue` 拆并排按钮
   - 新增 `pages/animal-detail/timeline.vue` 时间轴页
   - `my-reports/index.vue` 事件卡片加"关联到动物"入口

---

## 1. 目标 / 非目标

### 1.1 目标

1. **场景 A-D 全部走通 UI**:无鼻纹走失、捡到、流浪目击都能在用户端跑通
2. **"我又看到这只"成为详情页标准能力**:任何 animal 详情页都能追加事件
3. **animal 时间轴可视化**:动物详情页可点进时间轴,看多 reporter + 多次观察
4. **my-reports 关联入口**:用户在自己的上报列表里能自助关联到动物 (但要走后端审核)
5. **零回归**:现有 5 个动物流程不破,已有功能不破

### 1.2 非目标

1. ❌ 不动后端 intent 字段语义 (阶段 1+2 已固定)
2. ❌ 不做 schema 迁移 (阶段 4)
3. ❌ 不引入 Pinia / Vuex (CLAUDE.md 规定 Vue3 响应式足够)
4. ❌ 不重做 admin 后台 (admin UI 走老端点即可)
5. ❌ 不做 i18n 多语言切换
6. ❌ 不写 Playwright E2E (留作后续,本次靠 Vitest + 手动 walkthrough)

---

## 2. 交付清单 (6 大项)

| 编号 | 类别 | 内容 | 文件 | 预计 |
|------|------|------|------|------|
| 1 | 后端 | `GET /v1/animals/:id/timeline` | `backend/src/animals/animals.controller.ts` + service + spec | 1h |
| 2 | 前端组件 | `<UnifiedReportForm>` 抽出 | `miniapp-user/src/components/unified-report-form/index.vue` | 1.5h |
| 3 | 前端页面 | collect intent 收音机 | `miniapp-user/src/pages/collect/index.vue` | 0.5h |
| 4 | 前端页面 | report 共用骨架 | `miniapp-user/src/pages/report/index.vue` | 0.5h |
| 5 | 前端页面 | animal-detail 拆按钮 + timeline 子页 | `miniapp-user/src/pages/animal-detail/index.vue` + `timeline.vue` (新) | 1.5h |
| 6 | 前端页面 | my-reports 关联入口 | `miniapp-user/src/pages/my-reports/index.vue` | 1h |
| 7 | 验证 | Vitest 组件单测 + 后端 jest 不回归 + 手动 walkthrough | — | 1h |

总计约 7h,与架构 doc §8 阶段 3 预估的 6~8h 一致。

---

## 3. 后端 — `GET /v1/animals/:id/timeline`

### 3.1 端点定义

```
GET /v1/animals/:animal_id/timeline
Auth: required (JwtAuthGuard,任意登录用户)
Response: {
  animal_id: string,
  total: number,
  events: [
    {
      event_id: string,
      reporter: { user_id, nickname, avatar? } | null,
      occurred_at: string (ISO),
      address: string | null,
      location_lat: number | null,
      location_lng: number | null,
      photos: string[],
      description: string | null,
      intent: 'lost' | 'found' | 'stray_sighting' | 'unknown',  // 派生自 event_type
      status: 'pending' | 'confirmed' | 'duplicated' | 'rejected' | 'resolved',
    }
  ]
}
```

### 3.2 数据来源

按 doc §3.3 "时间轴抽象":
- 不增表
- `rescue_events.animal_id = :animal_id` + `ORDER BY occurred_at DESC`
- 可选 `LIMIT 100` 防单动物事件过多导致页面卡顿

### 3.3 实现位置

`backend/src/animals/animals.service.ts` 新增 `getTimeline(animal_id)` 方法。

### 3.4 intent 派生规则

按 doc §5.3 决策 (option A:不持久化):
```typescript
function deriveIntent(event: RescueEvent): string {
  // event_type 是持久化字段,意图从 event_type 推
  if (event.event_type === 'collect') return 'profile_build';
  if (event.event_type === 'report') return 'stray_sighting';
  return 'unknown';
}
```

注:此规则当前事件没有 `intent` 列 (阶段 4 才加),先按 event_type 推。

### 3.5 测试 (TDD)

`backend/src/animals/animals.service.spec.ts` 新增 describe 块:
- `getTimeline` 找不到 animal → 抛 NotFoundException
- `getTimeline` 正常返回 (按 occurred_at DESC 排序)
- `getTimeline` 不限动物档案权限,任意登录用户可看
- `getTimeline` 空数组处理 (animal 存在但无事件)

---

## 4. 前端 — `<UnifiedReportForm>` 共享组件

### 4.1 组件设计

```vue
<!-- miniapp-user/src/components/unified-report-form/index.vue -->
<template>
  <view class="unified-report-form">
    <!-- Step 1: 物种选择 -->
    <SpeciesPicker v-model="formData.species" />

    <!-- Step 2: 鼻纹采集 (mode=collect 时显示) -->
    <NoseCollector v-if="mode === 'collect'" v-model="formData.nose_photo" />

    <!-- Step 3: 全身照 + GPS -->
    <BodyPhotoUploader v-model="formData.body_photo" />
    <LocationPicker v-model="formData.location_lat" v-model:location_lng="formData.location_lng" />

    <!-- Step 4: metadata -->
    <MetadataForm v-model="formData" />

    <!-- 阶段 3 新增: intent 收音机 (仅 collect 模式显示) -->
    <view v-if="mode === 'collect'" class="intent-radio">
      <text>我的意图:</text>
      <radio-group v-model="formData.intent">
        <label><radio value="lost" :checked="formData.intent === 'lost'" />我走失了狗</label>
        <label><radio value="found" :checked="formData.intent === 'found'" />我捡到狗</label>
      </radio-group>
    </view>

    <!-- 提交按钮 -->
    <button @click="handleSubmit">{{ submitButtonText }}</button>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  mode: 'collect' | 'report'  // collect=录入档案(report lost/found),report=上报一只
  defaultIntent?: 'lost' | 'found' | 'stray_sighting'  // 外部传默认 intent
}

const props = withDefaults(defineProps<Props>(), {
  defaultIntent: undefined,
})

const emit = defineEmits<{
  (e: 'submit', payload: any): void
}>()

const formData = ref({
  species: '',
  breed: '',
  color: '',
  gender: '',
  intent: props.defaultIntent || (props.mode === 'collect' ? 'lost' : 'stray_sighting'),
  // ...
})

const submitButtonText = computed(() => {
  return props.mode === 'collect' ? '提交我的' : '提交上报'
})

function handleSubmit() {
  // 校验 + 组装 payload + emit
  emit('submit', formData.value)
}
</script>
```

### 4.2 props 文档

| prop | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `mode` | `'collect' \| 'report'` | ✅ | — | 决定表单形态 |
| `defaultIntent` | `'lost' \| 'found' \| 'stray_sighting'` | ❌ | 模式默认 | 外部覆盖默认 intent |

### 4.3 行为差异表 (collect vs report)

| 维度 | collect | report |
|------|---------|--------|
| 鼻纹采集 | ✅ 显示 | ❌ 隐藏 |
| intent 收音机 | ✅ 显 (lost/found) | ❌ 隐,默认 `stray_sighting` |
| 提交按钮文案 | "提交我的" | "提交上报" |
| 提交 API | `POST /events` (intent=lost/found) | `POST /events` (intent=stray_sighting) |
| 后续跳转 | `/collect/result` | 弹 toast "已上报,等待审核" |
| 自动建档 | 后端自动 (阶段 1+2) | 不自动 |

### 4.4 测试 (Vitest)

`miniapp-user/src/components/unified-report-form/index.spec.ts`:
- props.mode='collect' 时,渲染意图收音机
- props.mode='report' 时,收音机隐藏
- props.defaultIntent 覆盖默认值
- 提交事件 emit 完整 payload
- 表单校验失败时不 emit

---

## 5. 前端 — 5 项页面改造

### 5.1 `collect/index.vue` 改造

**改动**:把现有的步骤 4 metadata 段落替换为 `<UnifiedReportForm mode="collect" />` 组件引用。

```diff
- <view class="step-4">
-   <!-- 旧: 大量内联表单 -->
- </view>
+ <UnifiedReportForm
+   mode="collect"
+   :defaultIntent="'lost'"
+   @submit="handleCollectSubmit"
+ />
```

**新增意图字段透传**:handleCollectSubmit 把 `intent` 字段加到 `/v1/events` 请求 body 和 `/v1/animals` (如果走 profile_build 路径) 中。

### 5.2 `report/index.vue` 改造

**改动**:同样换成 `<UnifiedReportForm mode="report" />` 组件引用。

```diff
- <view class="report-form">
-   <!-- 旧: 大量内联表单,与 collect 重复 -->
- </view>
+ <UnifiedReportForm
+   mode="report"
+   @submit="handleReportSubmit"
+ />
```

### 5.3 `animal-detail/index.vue` 改造

**原状态**:单个"认领此动物"按钮。

**改动**:拆为横向并排两个按钮:

```vue
<view class="action-buttons">
  <button
    class="btn-secondary"
    @click="handleSighting"
  >我又看到这只</button>
  <button
    class="btn-primary"
    @click="handleClaim"
  >这是我的狗(申请认领)</button>
</view>
```

**handleSighting 行为**:
- 跳到 `report/index.vue?animal_id=<current_animal_id>` 模式
- `report/index.vue` 读 onLoad query 的 `animal_id`,作为 prop 传给 `<UnifiedReportForm>`
- `<UnifiedReportForm mode="report">` 渲染时,如果 props.animal_id 存在,把它写入 formData.animal_id
- 提交时 `POST /v1/events` body 带 `animal_id`, 后端事件关联到这只动物 (走 stray_sighting intent,animal_id 已传 → 不自动建档)
- UI 顶部显示一条提示:"你在为 [动物名] 追加一条观察记录"

### 5.4 `animal-detail/timeline.vue` (新页面)

**新增文件**:`miniapp-user/src/pages/animal-detail/timeline.vue`

**功能**:渲染该 animal 的所有事件时间轴。

```vue
<template>
  <view class="timeline-page">
    <view v-for="evt in timeline" :key="evt.event_id" class="timeline-card">
      <Avatar :user="evt.reporter" />
      <view class="card-content">
        <text class="reporter-name">{{ evt.reporter?.nickname || '匿名' }}</text>
        <text class="event-action">在 {{ evt.address }} 看到了这只动物</text>
        <Photo :urls="evt.photos" />
        <text class="event-time">{{ formatRelative(evt.occurred_at) }}</text>
      </view>
    </view>
    <view v-if="timeline.length === 0" class="empty">还没有人上报过观察记录</view>
  </view>
</template>
```

**入口**:`animal-detail/index.vue` 头部加"查看时间轴"按钮,`navigateTo('/pages/animal-detail/timeline?id=...')`。

**数据源**:调 `GET /v1/animals/:id/timeline` (新加的后端端点)。

### 5.5 `my-reports/index.vue` 改造

**改动**:每条事件卡片 (status=pending 且 animal_id=null 时) 加"关联到动物"按钮。

```vue
<view v-for="evt in myReports" :key="evt.event_id" class="report-card">
  <!-- 原事件信息 -->
  <view class="card-body">
    <text>{{ evt.species }} - {{ evt.address }}</text>
    <text class="event-time">{{ formatRelative(evt.occurred_at) }}</text>
  </view>
  <view v-if="evt.status === 'pending' && !evt.animal_id" class="card-actions">
    <button @click="openAnimalPicker(evt.event_id)">关联到动物</button>
  </view>
</view>
```

**UI 提示**:关联成功后显示 toast "已关联,等待管理员最终确认"。因为后端 `linkToAnimal` 设置 status=pending,不是 status=confirmed,需 admin 二次确认。

**openAnimalPicker 行为**:
- 弹出动物选择器 (搜索 input + 列表)
- 用户选中后,调 `PUT /v1/admin/events/:event_id/action` body `{ action: 'confirm', animal_id: <selected> }`
- 注:此端点实际是 admin 端点,user 端不能直接调

**user 端调用的替代方案** (待确认):
- 方案 A:后端新增 `POST /v1/events/:id/link` 端点,user 可调
- 方案 B:此功能延迟,user 端只能看,关联需走 admin 审核
- 选:**方案 A**(后端新增 1 个端点,~30 行代码,在阶段 3 一并做)

后端新增端点(放在 `backend/src/events/events.controller.ts`):

```typescript
@Post(':event_id/link')
@ApiOperation({ summary: '用户自助关联事件到动物' })
async linkEventToAnimal(
  @Param('event_id') id: string,
  @Body() body: { animal_id: string },
  @Request() req: any,
) {
  // 校验:事件 reporter_id === req.user.user_id
  // 校验:animal_id 存在
  // 行为:event.animal_id = body.animal_id, event.status = 'pending' (走 admin 二次确认)
  return this.eventsService.linkToAnimal(id, body.animal_id, req.user.user_id);
}
```

> 实际是 `event.status = 'pending'`(走 admin 在 `dispatchEventAction` 二次确认),不直接 `confirmed`。这是 self-service 入口,与 admin 的 confirmEvent 有微差。

---

## 6. 数据流 (典型场景)

### 场景 A: 用户走失无鼻纹

```
collect/index.vue
  → <UnifiedReportForm mode="collect" defaultIntent="lost">
  → 跳鼻纹采集 (无鼻纹 → 软化为 ask_user_confirm)
  → 跳时间轴 (无鼻纹 → 跳过该步)
  → @submit { intent: 'lost', location: {lat,lng}, photos: [...], body_colors: [...] }
  → POST /v1/events body { intent: 'lost', species, location_*, photos, body_colors }
  → 后端 EventsService.create (阶段 1+2):
      - intent='lost' + animal_id=undefined → 自动 AnimalsService.create (status=lost)
      - event.animal_id ← 新 animal_id
  → 后端 setImmediate → processEvent (无鼻纹 → MatchingService 文本+GPS+时间)
  → 跳 /collect/result 显示 candidates
```

### 场景 D: 用户捡到有鼻纹

```
animal-detail/index.vue (点击"我又看到这只")
  → navigateTo('/pages/report?animal_id=...')
  → <UnifiedReportForm mode="report">  (intent 隐 = stray_sighting)
  → @submit { intent: 'stray_sighting', animal_id, ... }
  → POST /v1/events body { intent: 'stray_sighting', animal_id: <current>, ... }
  → 后端 EventsService.create:
      - intent='stray_sighting' → 不自动建档 (animal_id 已传 → 沿用)
      - event.animal_id ← 用户传入的
  → 跳 toast "已上报,等待审核"
  → animal 时间轴多一条事件
```

---

## 7. 错误处理

| 场景 | UI 行为 | 后端 |
|------|---------|------|
| intent 必填但用户没选 (collect) | 提交按钮 disabled | — |
| `GET /animals/:id/timeline` 找不到 animal | 显示"动物档案不存在" | 404 NotFoundException |
| 关联时 animal_id 已被认领 | 显示"该动物已被人认领" | 409 Conflict |
| 用户调 linkToAnimal 但不是 reporter | 403 Forbidden | 权限校验 |
| 上传图片失败 | 重试按钮 | — |

---

## 8. 验证 (Vitest 单元 + 后端 jest + 手动 walkthrough)

### 8.1 Vitest 单元 (组件)

`miniapp-user/src/components/unified-report-form/index.spec.ts`:
1. mode='collect' 渲染 intent 收音机
2. mode='report' 隐藏 intent 收音机
3. defaultIntent 覆盖默认值
4. 表单校验失败时按钮 disabled
5. submit 时 emit 完整 payload

### 8.2 后端 jest 不回归

- `npx jest --no-coverage` 期望 207+ pass
- 新增 4 个 timeline 测试 (找/不找/排序/权限)
- 新增 2-3 个 linkToAnimal 测试 (权限/状态/错误)

### 8.3 小程序手动 walkthrough (P1-P11)

按架构 doc §12 阶段 3 验收清单:
- P1 注册 / 登录
- P2 录入档案 (intent=lost, 有鼻纹)
- P3 录入档案 (intent=lost, 无鼻纹) — 验证 nose 软化
- P4 录入档案 (intent=found) — 验证 status=found
- P5 上报一只 (intent=stray_sighting, 无鼻纹)
- P6 上报一只 (intent=stray_sighting, 有鼻纹)
- P7 详情页"我又看到这只" → 跳 report 预填
- P8 详情页"这是我的狗" → 跳 claim
- P9 时间轴页渲染
- P10 my-reports "关联到动物"
- P11 admin 后台 dispatchEventAction 4 动作

---

## 9. 风险与权衡

| 风险 | 缓解 |
|------|------|
| `<UnifiedReportForm>` 组件 props 复杂,未来难维护 | 写详细 props 文档 (JSDoc) + Vitest 单测覆盖 props 矩阵 |
| timeline 端点性能:某动物被多次上报,查询慢 | `LIMIT 100` + `occurred_at DESC` 索引 (后续可加分页) |
| user 端 `linkToAnimal` 端点可能与 admin 端 `dispatchEventAction` 重叠 | 后端 `linkToAnimal` 仅允许 event.reporter_id === req.user.user_id,权限严格隔离 |
| 阶段 4 加 `intent` 列后,本设计派生规则要调整 | 在 `deriveIntent` 加 TODO 注释,阶段 4 同步更新 |
| 时间轴页用户身份泄露(reporter.user_id) | 不返 user_id,只返 nickname + avatar;隐私字段脱敏 |

---

## 10. 验收清单 (可勾选)

### 后端
- [ ] `GET /v1/animals/:id/timeline` 实现 + 4 个 spec
- [ ] `POST /v1/events/:id/link` 实现 + 3 个 spec
- [ ] `npx jest` 214+ 全绿

### 前端
- [ ] `<UnifiedReportForm>` 组件抽出 + Vitest 单测
- [ ] `collect/index.vue` 步骤 4 引用组件 + intent 收音机
- [ ] `report/index.vue` 引用组件
- [ ] `animal-detail/index.vue` 拆并排按钮 + "查看时间轴"入口
- [ ] `animal-detail/timeline.vue` (新) 渲染时间轴
- [ ] `my-reports/index.vue` 加"关联到动物"按钮 + 选择器

### 端到端
- [ ] P1-P11 全部走通 (小程序手动)
- [ ] 已有 5 个动物的流程不破

---

## 11. 实施顺序 (建议)

1. 后端 `GET /animals/:id/timeline` (TDD) — 1h
2. 后端 `POST /events/:id/link` (TDD) — 30min
3. 前端 `<UnifiedReportForm>` 抽出 + Vitest — 1.5h
4. 前端 5 项页面改造 — 3.5h
5. 手动 walkthrough P1-P11 — 1h

总计 ~7h。

---

## 12. 关联文档

- 架构:`2026-07-06-unified-event-model.md` §7.1 / §7.2 / §12 阶段 3
- 后端阶段 1+2:commit `e42fe63`
- 测试报告:`2026-07-06-manual-test-pic-flow.md`
- Bug 索引:`issues/2026-07-06/README.md`
