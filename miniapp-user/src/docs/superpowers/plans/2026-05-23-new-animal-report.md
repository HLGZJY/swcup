# 新动物上报流程（Plan B）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Plan B：比对无匹配时（fusion_score < 0.75）由用户主动确认是否创建动物档案，后端不自动建档。

**Architecture:** 后端 `nose.service.ts` 在比对无匹配时返回 `next_action: "ask_user_create"`，前端展示双按钮确认 UI，用户选择"创建档案"后先调用 `POST /animals` 再调用 `POST /events`。

**Tech Stack:** NestJS + TypeORM + MySQL (backend), uni-app/Vue 3 (frontend), FastAPI AI-service

---

## File Structure

```
backend/src/
├── nose/nose.service.ts              — compare() 返回 next_action 字段
├── animals/animals.controller.ts    — 新增 Public POST /animals 端点
├── animals/animals.service.ts        — 不变，已有待用方法
├── events/events.service.ts          — create() 支持关联已有 animal_id
└── events/events.controller.ts       — 不变

miniapp-user/src/
├── pages/collect/result.vue          — 三分支 UI + 双按钮确认
└── services/api.js                    — 新增 apiCreateAnimal()
```

---

## Task 1: Backend — `nose.service.ts` 返回 `next_action: "ask_user_create"`

**Files:**
- Modify: `F:\swcup2026\backend\src\nose\nose.service.ts:167-172`

- [ ] **Step 1: 修改 compare() 返回结构，当无匹配时添加 next_action**

找到 `nose.service.ts` 第 167-172 行附近的返回语句：

```typescript
    // 过滤 null 并按 fusion_score 降序
    const validResults = results.filter(Boolean) as any[];
    validResults.sort((a, b) => b.fusion_score - a.fusion_score);
    validResults.forEach((r, i) => (r as any).is_recommended = i === 0);

    // === Plan B: 无匹配时返回 next_action ===
    if (validResults.length === 0 || validResults[0].fusion_score < 0.75) {
      return {
        total: 0,
        results: [],
        threshold_confirmed,
        threshold_suspected,
        next_action: 'ask_user_create',
        candidate: null,
      };
    }

    return { total: validResults.length, results: validResults, threshold_confirmed, threshold_suspected };
```

**注意：** 只在 `validResults.length === 0` 或 `fusion_score < 0.75` 时返回 `next_action: 'ask_user_create'`。有高置信度匹配时仍返回正常结果列表。

- [ ] **Step 2: 提交**

```bash
cd F:/swcup2026/backend && git add src/nose/nose.service.ts && git commit -m "feat(nose): 返回 next_action: ask_user_create 当无匹配时"
```

---

## Task 2: Backend — 新增用户端 `POST /animals` 端点

**Files:**
- Modify: `F:\swcup2026\backend\src\animals\animals.controller.ts:32-38`
- Test: `F:\swcup2026\backend\src\animals\animals.controller.spec.ts`（若存在）

- [ ] **Step 1: 在 AnimalsController 中新增 Public POST 端点**

在 `animals.controller.ts` 的 `@UseGuards(RolesGuard)` + `@Roles('admin')` 之前，添加一个新的公开端点（不需要 admin 角色，但需要 JWT 认证）：

```typescript
  // === Plan B: 用户端创建动物档案（无需 admin 角色）===
  @UseGuards(JwtAuthGuard)  // 需要登录，但不需要 admin
  @Post()
  @ApiOperation({ summary: '创建动物档案（用户端，Plan B）' })
  createForUser(@Body() dto: CreateAnimalDto, @Request() req: any) {
    return this.animalsService.create(dto);
  }
```

将此新方法放在 `@Roles('admin') @Post()` 方法上方。

- [ ] **Step 2: 验证端点可访问**

Run: `curl -s -X POST http://localhost:3000/animals -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d '{"species":"dog","breed":"金毛","color":"金色","location_lat":22.5,"location_lng":113.9}' | jq .`

Expected: 返回新建动物的 `animal_id`

- [ ] **Step 3: 提交**

```bash
cd F:/swcup2026/backend && git add src/animals/animals.controller.ts && git commit -m "feat(animals): 新增用户端 POST /animals 端点（Plan B）"
```

---

## Task 3: Backend — `POST /events` 支持关联已有 animal_id（可选扩展）

**Files:**
- Modify: `F:\swcup2026\backend\src\events\events.service.ts:16-31`
- Modify: `F:\swcup2026\backend\src\events\dto\create-event.dto.ts`

- [ ] **Step 1: 在 CreateEventDto 中新增 animal_id 可选字段**

在 `create-event.dto.ts` 的 `nose_vector_id` 字段后添加：

```typescript
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  animal_id?: string;
```

- [ ] **Step 2: 修改 EventsService.create() 支持关联已有 animal**

在 `events.service.ts` 的 `create()` 方法中，保存事件后，如果有 `animal_id` 则关联事件与动物：

```typescript
  async create(dto: CreateEventDto, user_id: string) {
    const event_id = uuidv4();
    const event = this.eventRepo.create({
      event_id,
      reporter_id: user_id,
      event_type: dto.event_type as EventType || EventType.REPORT,
      location_lat: Number(dto.location_lat),
      location_lng: Number(dto.location_lng),
      address: dto.address || undefined,
      description: dto.description || undefined,
      photos: dto.photos || undefined,
      occurred_at: new Date(),
      status: EventStatus.PENDING,
      animal_id: dto.animal_id || undefined,  // Plan B: 关联已有动物
    } as Partial<RescueEvent>);
    await this.eventRepo.save(event);
    return { event_id, is_duplicate: false, fusion_score: null, status: 'pending' };
  }
```

（注意：当前 `RescueEvent` entity 已有 `animal_id` 字段，无需修改 entity）

- [ ] **Step 3: 验证**

Run: 后端已实现，直接测试 Step 2 的完整流程（Task 5 一起测）

- [ ] **Step 4: 提交**

```bash
cd F:/swcup2026/backend && git add src/events/dto/create-event.dto.ts src/events/events.service.ts && git commit -m "feat(events): create 支持关联已有 animal_id（Plan B）"
```

---

## Task 4: Frontend — `api.js` 新增 `apiCreateAnimal()`

**Files:**
- Modify: `F:\swcup2026\miniapp-user\src\services\api.js:180-193`

- [ ] **Step 1: 在 api.js 末尾（`apiResetPassword` 函数之后，`request` 函数之前）添加 apiCreateAnimal**

```javascript
/**
 * 创建动物档案（Plan B）
 * POST /animals
 * 请求: { species, breed, color, gender, age_estimate, health_status, location_lat, location_lng, address, notes }
 */
export function apiCreateAnimal(params) {
  return request('/animals', {
    method: 'POST',
    body: params
  })
}
```

- [ ] **Step 2: 提交**

```bash
cd F:/swcup2026/miniapp-user && git add src/services/api.js && git commit -m "feat(api): 新增 apiCreateAnimal（Plan B）"
```

---

## Task 5: Frontend — `result.vue` 三分支 UI + 双按钮确认

**Files:**
- Modify: `F:\swcup2026\miniapp-user\src\pages\collect\result.vue`

**重构后的 computed 逻辑（替换现有的 topScore、resultClass、statusIcon、statusText 计算属性）：**

```javascript
// ============ Plan B 三分支状态 ============
const hasMatch = computed(() => {
  if (!compareResult.value) return false
  const results = compareResult.value.results
  return results && results.length > 0 && results[0].fusion_score >= 0.75
})

const needsConfirmation = computed(() => {
  if (!compareResult.value) return false
  return compareResult.value.next_action === 'ask_user_create'
})

const showMatchList = computed(() => hasMatch.value)
```

**替换现有的 bottom-actions 区域（约第 72-85 行）：**

```html
    <!-- 底部操作 -->
    <view class="bottom-actions">
      <!-- 确认重复提示 -->
      <view class="action-hint" v-if="topScore >= 0.88">
        <text class="hint-icon">⚠️</text>
        <text>已确认重复，管理员将审核合并</text>
      </view>
      <!-- 有匹配：上报此动物 -->
      <view class="btn-primary" v-if="showMatchList" @click="onReport">
        <text>上报此动物</text>
      </view>
      <view class="btn-secondary" v-if="showMatchList" @click="onBackHome">
        <text>返回首页</text>
      </view>
      <!-- Plan B 无匹配：双按钮 -->
      <view class="action-hint info-hint" v-if="needsConfirmation">
        <text class="hint-icon">ℹ️</text>
        <text>未在数据库中找到匹配动物</text>
      </view>
      <view class="btn-primary" v-if="needsConfirmation" @click="onCreateAnimal">
        <text>创建档案</text>
      </view>
      <view class="btn-secondary" v-if="needsConfirmation" @click="onCancel">
        <text>取消</text>
      </view>
    </view>
```

**新增导入（script setup 顶部）：**

```javascript
import { apiNoseCompare, apiCreateAnimal, apiReportEvent } from '@/services/api'
```

**新增 computed 和方法（替换原有的 onReport 和 onBackHome，保留 goToDetail）：**

```javascript
// GPS 维度得分计算
function calcLocationScore(distanceM) {
  if (distanceM <= 500) return 1.0
  if (distanceM >= 1500) return 0
  return Math.max(0, 1 - (distanceM - 500) / 1000)
}

// onReport：跳转到匹配动物详情
function onReport() {
  if (!matchList.value || matchList.value.length === 0) {
    uni.showToast({ title: '无匹配结果，无法上报', icon: 'none' })
    return
  }
  const first = matchList.value[0]
  if (!first?.animal_id || first.animal_id === 'undefined') {
    uni.showToast({ title: '数据异常，请重新比对', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages/animal-detail/index?animal_id=' + first.animal_id })
}

// onBackHome：返回首页
function onBackHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

// ============ Plan B 无匹配流程 ============
async function onCreateAnimal() {
  if (!noseId.value) {
    uni.showToast({ title: '缺少鼻纹ID，请重新采集', icon: 'none' })
    return
  }
  uni.showLoading({ title: '创建中...' })
  try {
    // Step 1: 创建动物档案
    const animalRes: any = await apiCreateAnimal({
      species: selectedSpecies.value,
      breed: '',
      color: '',
      gender: 'unknown',
      age_estimate: 'unknown',
      health_status: 'unknown',
      location_lat: 0,
      location_lng: 0,
      address: '',
      notes: '通过鼻纹采集新建',
      primary_nose_id: noseId.value,
      photos: [],
    })
    const animalId = animalRes.data?.animal_id || animalRes.animal_id
    if (!animalId) throw new Error('创建动物档案失败')

    // Step 2: 上报事件（关联到新建的动物）
    await apiReportEvent({
      event_type: 'report',
      animal_id: animalId,
      nose_vector_id: noseId.value,
      species: selectedSpecies.value,
      location_lat: 0,
      location_lng: 0,
    })

    uni.hideLoading()
    uni.showToast({ title: '创建成功', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/animal-detail/index?animal_id=${animalId}` })
    }, 1000)
  } catch (e) {
    uni.hideLoading()
    console.error('[onCreateAnimal]', e)
    uni.showToast({ title: '创建失败，请重试', icon: 'none' })
  }
}

function onCancel() {
  uni.switchTab({ url: '/pages/index/index' })
}
```

**新增 info-hint 样式（style scoped 末尾）：**

```scss
.info-hint {
  background: #E8F4FF;
}
.info-hint text:last-child {
  color: #007AFF;
}
```

- [ ] **Step 1: 备份并替换 result.vue**

按照上述修改内容更新 `F:\swcup2026\miniapp-user\src\pages\collect\result.vue`，确保：
1. `apiNoseCompare` 保留，新增 `apiCreateAnimal` 和 `apiReportEvent` 导入
2. `hasMatch`、`needsConfirmation`、`showMatchList` 三个 computed 替换原有单分支逻辑
3. template 中 bottom-actions 使用 `v-if="showMatchList"` 和 `v-if="needsConfirmation"` 分支
4. `onCreateAnimal` 和 `onCancel` 方法替换原有的 `onReport` 和 `onBackHome`（保留两个方法，但原有两个保留是为了有匹配时的操作）
5. 新增 `.info-hint` 样式

**简化版：** 原有 `onReport` 和 `onBackHome` 在有匹配时使用，新增 `onCreateAnimal` 和 `onCancel` 在无匹配确认时使用。

- [ ] **Step 2: 提交**

```bash
cd F:/swcup2026/miniapp-user && git add src/pages/collect/result.vue && git commit -m "feat(result): Plan B 三分支 UI + 双按钮确认创建档案"
```

---

## Task 6: 集成测试

- [ ] **Step 1: 启动后端**

```bash
cd F:/swcup2026/backend && npm run start:dev
```

- [ ] **Step 2: 启动 AI-service**

```bash
cd F:/swcup2026/ai-service && python -m uvicorn src.api.main:app --reload --port 8000
```

- [ ] **Step 3: 完整流程测试**

1. 用户采集鼻纹 → 获得 `vector_id`
2. 调用 `POST /nose/compare` → 验证返回结构有 `next_action: "ask_user_create"`（当无匹配时）
3. 前端应显示"未找到匹配动物" + 「创建档案」「取消」双按钮
4. 点击「创建档案」→ `POST /animals` → `POST /events` → 跳转详情页
5. 点击「取消」→ 返回首页

- [ ] **Step 4: 有匹配时的正常流程仍正常**

1. 采集鼻纹（数据库中有已知走失动物）
2. 比对 → `fusion_score >= 0.75` → 显示匹配卡片 + "上报此动物"按钮
3. 点击上报 → 跳转 animal-detail

---

## Self-Review Checklist

**Spec coverage:**
- [x] `nose.service.ts` compare() 在 `< 0.75` 时返回 `next_action: "ask_user_create"` → Task 1
- [x] 新增 `POST /animals` 端点（用户端，非 admin） → Task 2
- [x] `POST /events` 支持 `animal_id` 关联 → Task 3
- [x] `apiCreateAnimal()` 前端方法 → Task 4
- [x] `result.vue` 三分支 UI + 双按钮 → Task 5
- [x] 集成测试流程 → Task 6

**Placeholder scan:**
- 无 "TBD"、"TODO"、placeholder 代码
- 所有步骤包含完整可运行的代码片段

**Type consistency:**
- `apiCreateAnimal(params)` — params 为 CreateAnimalDto 结构
- `onCreateAnimal()` — `animalRes.data?.animal_id` 兼容双层包装 `{code, data:{animal_id}}` 和扁平 `{animal_id}` 两种响应格式
- `needsConfirmation` 判断 `compareResult.next_action === 'ask_user_create'` 字符串值与 spec 一致

---

## 执行选项

Plan 已保存至 `docs/superpowers/plans/2026-05-23-new-animal-report.md`。

**1. Subagent-Driven（推荐）** — 每个 Task 分配独立 subagent，任务间有检查点

**2. Inline Execution** — 本会话内顺序执行，带检查点

选择哪种方式？