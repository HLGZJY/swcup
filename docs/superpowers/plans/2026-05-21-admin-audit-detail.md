# 事件审核详情页实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在管理端实现事件审核详情页，展示四维度得分和比对候选列表，支持 confirm/reject/process 三个操作

**Architecture:** 前端优先——先用 mock 数据验证 UI，等后端接口就绪后再接入真实 API。后端接口补充作为独立任务。

**Tech Stack:** UniApp (Vue3 + `<script setup>` + SCSS)，现有 `api.js` 服务层

---

## 文件结构

| 文件 | 改动类型 | 职责 |
|------|----------|------|
| `miniapp-admin/src/pages/admin/audit-detail/index.vue` | 新建 | 事件审核详情页（包含候选列表） |
| `miniapp-admin/src/pages.json` | 修改 | 注册 `audit-detail` 路由 |
| `miniapp-admin/src/services/api.js` | 修改 | `apiConfirmEvent` 支持 `animal_id` 参数（等后端就绪） |
| `miniapp-admin/src/pages/admin/audit/index.vue` | 修改 | 卡片点击改为跳转到详情页 |

---

## Task 1: 创建 audit-detail 页面骨架（mock 数据）

**Files:**
- Create: `miniapp-admin/src/pages/admin/audit-detail/index.vue`

- [ ] **Step 1: 创建页面文件**

```vue
<template>
  <view class="page">
    <!-- 加载中 -->
    <view class="loading-state" v-if="loading">
      <text>加载中...</text>
    </view>

    <!-- 无候选时提示 -->
    <view class="empty-state" v-else-if="!event">
      <text>未找到该事件</text>
    </view>

    <template v-else>
      <!-- 事件头部 -->
      <view class="event-header-card">
        <view class="event-header">
          <text :class="['event-type', 'type-' + event.event_type]">{{ eventTypeMap[event.event_type] }}</text>
          <view :class="['status-badge', 'status-' + event.status]">{{ statusMap[event.status] }}</view>
        </view>
        <text class="event-desc">{{ event.description }}</text>
        <view class="event-meta">
          <view class="meta-item">
            <image class="meta-icon" src="/static/icons/icon-mappin.png" mode="aspectFit" />
            <text>{{ event.address }}</text>
          </view>
          <view class="meta-item">
            <image class="meta-icon" src="/static/icons/icon-clock.png" mode="aspectFit" />
            <text>{{ formatTime(event.occurred_at) }}</text>
          </view>
        </view>
        <!-- 照片缩略图 -->
        <view class="photo-row" v-if="event.photos?.length">
          <image
            v-for="(photo, idx) in event.photos"
            :key="idx"
            class="photo-thumb"
            :src="resolveImageUrl(photo)"
            mode="aspectFill"
          />
        </view>
      </view>

      <!-- AI 比对结果 -->
      <view class="score-card">
        <text class="section-title">AI 比对结果</text>
        <view class="score-row">
          <text class="score-label">向量相似度</text>
          <text class="score-weight">40%</text>
          <view class="progress-bar"><view class="progress-fill" :style="{ width: (event.vector_similarity * 100) + '%' }"></view></view>
          <text class="score-val">{{ event.vector_similarity?.toFixed(2) || '-' }}</text>
        </view>
        <view class="score-row">
          <text class="score-label">位置接近度</text>
          <text class="score-weight">20%</text>
          <view class="progress-bar"><view class="progress-fill" :style="{ width: (event.gps_similarity * 100) + '%' }"></view></view>
          <text class="score-val">{{ event.gps_similarity?.toFixed(2) || '-' }}</text>
        </view>
        <view class="score-row">
          <text class="score-label">图像相似度</text>
          <text class="score-weight">20%</text>
          <view class="progress-bar"><view class="progress-fill" :style="{ width: (event.image_similarity * 100) + '%' }"></view></view>
          <text class="score-val">{{ event.image_similarity?.toFixed(2) || '-' }}</text>
        </view>
        <view class="score-row">
          <text class="score-label">文本匹配度</text>
          <text class="score-weight">20%</text>
          <view class="progress-bar"><view class="progress-fill" :style="{ width: (event.text_match_rate * 100) + '%' }"></view></view>
          <text class="score-val">{{ event.text_match_rate?.toFixed(2) || '-' }}</text>
        </view>
        <view class="score-row fusion-row">
          <text class="score-label">融合得分</text>
          <text class="score-val fusion-val">{{ event.fusion_score?.toFixed(2) || '-' }}</text>
        </view>
      </view>

      <!-- 比对候选列表 -->
      <view class="candidates-card" v-if="event.candidates?.length">
        <text class="section-title">比对候选（{{ event.candidates.length }}个）</text>
        <view
          v-for="c in event.candidates"
          :key="c.animal_id"
          :class="['candidate-card', { selected: selectedCandidateId === c.animal_id }]"
          @click="selectCandidate(c.animal_id)"
        >
          <image class="candidate-photo" :src="resolveImageUrl(c.photos?.[0]) || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
          <view class="candidate-info">
            <text class="candidate-breed">{{ c.breed }}</text>
            <text class="candidate-color">{{ c.color }} · {{ c.gender === 'male' ? '♂️' : '♀️' }}</text>
            <text class="candidate-address">{{ c.address }}</text>
            <view class="candidate-footer">
              <text :class="['candidate-status', 'status-' + c.status]">{{ statusMap[c.status] }}</text>
              <view class="candidate-score">
                <text class="score-num">{{ c.fusion_score?.toFixed(2) || '-' }}</text>
                <view class="recommend-badge" v-if="c.is_recommended">推荐</view>
              </view>
            </view>
          </view>
          <view :class="['radio-circle', { checked: selectedCandidateId === c.animal_id }]"></view>
        </view>
      </view>

      <!-- 无候选时展示 -->
      <view class="no-candidates-hint" v-else>
        <text>AI识别后即可查看比对候选</text>
        <view class="process-btn" @click="onProcess">
          <text>AI识别</text>
        </view>
      </view>

      <!-- 操作区 -->
      <view class="action-bar">
        <view class="action-reject" @click="onReject">
          <text>驳回</text>
        </view>
        <view
          :class="['action-confirm', { disabled: !selectedCandidateId }]"
          @click="onConfirm"
        >
          <text>确认合并</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiConfirmEvent, apiRejectEvent, apiProcessEvent, resolveImageUrl } from '@/services/api'

const loading = ref(false)
const event = ref<any>(null)
const selectedCandidateId = ref<string | null>(null)

const statusMap: Record<string, string> = {
  lost: '走失', found: '发现', claimed: '待认领', archived: '归档',
  pending: '待审核', confirmed: '已确认', duplicated: '重复', resolved: '已完成', rejected: '已驳回'
}

const eventTypeMap: Record<string, string> = {
  report: '上报', rescue: '救助', medical: '医疗', adopt: '领养', transfer: '转运', release: '放归'
}

// 页面参数获取
onMounted(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const eventId = currentPage?.options?.event_id
  if (eventId) {
    loadMockData(eventId)
  }
})

// 模拟数据（等后端就绪后替换为真实接口调用）
function loadMockData(eventId: string) {
  loading.value = true
  setTimeout(() => {
    event.value = {
      event_id: eventId,
      event_type: 'report',
      status: 'pending',
      description: '在小区附近发现一只走失柴犬，很乖巧但有点怕人',
      address: '北京市朝阳区某小区',
      occurred_at: new Date().toISOString(),
      photos: [],
      fusion_score: 0.64,
      vector_similarity: 0.72,
      gps_similarity: 0.55,
      image_similarity: 0.68,
      text_match_rate: 0.41,
      candidates: [
        {
          animal_id: 'A001',
          breed: '柴犬',
          color: '黄色',
          gender: 'male',
          status: 'lost',
          photos: [],
          address: '北京市朝阳区',
          fusion_score: 0.81,
          vector_similarity: 0.85,
          gps_similarity: 0.78,
          image_similarity: 0.82,
          text_match_rate: 0.75,
          is_recommended: true
        },
        {
          animal_id: 'A002',
          breed: '田园犬',
          color: '黑色',
          gender: 'female',
          status: 'claimed',
          photos: [],
          address: '北京市海淀区',
          fusion_score: 0.52,
          vector_similarity: 0.60,
          gps_similarity: 0.45,
          image_similarity: 0.55,
          text_match_rate: 0.48,
          is_recommended: false
        }
      ]
    }
    // 默认选中推荐候选
    const recommended = event.value.candidates.find((c: any) => c.is_recommended)
    if (recommended) selectedCandidateId.value = recommended.animal_id
    loading.value = false
  }, 300)
}

function formatTime(isoString?: string) {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function selectCandidate(animalId: string) {
  selectedCandidateId.value = animalId
}

async function onConfirm() {
  if (!selectedCandidateId.value || !event.value) return
  const candidate = event.value.candidates.find((c: any) => c.animal_id === selectedCandidateId.value)
  uni.showModal({
    title: '确认合并',
    content: `合并到：${candidate?.breed}，${candidate?.address}`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiConfirmEvent(event.value.event_id, { animal_id: selectedCandidateId.value })
          uni.showToast({ title: '已确认合并', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 1500)
        } catch (e) {
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}

async function onReject() {
  if (!event.value) return
  uni.showModal({
    title: '确认驳回',
    content: '确定要驳回该事件吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiRejectEvent(event.value.event_id)
          uni.showToast({ title: '已驳回', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 1500)
        } catch (e) {
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}

async function onProcess() {
  if (!event.value) return
  uni.showModal({
    title: 'AI识别',
    content: '确定要触发AI识别吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiProcessEvent(event.value.event_id)
          uni.showToast({ title: 'AI识别中，请稍后刷新', icon: 'none' })
        } catch (e) {
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}
</script>

<style scoped lang="scss">
.page { min-height: 100vh; background: #F5F5F5; padding-bottom: 120rpx; }
.loading-state { display: flex; justify-content: center; align-items: center; height: 60vh; font-size: 28rpx; color: #999; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; font-size: 28rpx; color: #999; }

// 事件头部
.event-header-card { background: #FFF; padding: 28rpx; margin-bottom: 20rpx; }
.event-header { display: flex; align-items: center; gap: 12rpx; margin-bottom: 12rpx; }
.event-type { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 8rpx; background: #FF6B6B22; color: #FF6B6B; }
.type-rescue { background: #0FBF9F22; color: #0FBF9F; }
.type-medical { background: #FF9F0022; color: #FF9F00; }
.status-badge { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 8rpx; background: #FF9F0022; color: #FF9F00; }
.status-confirmed { background: #07C16022; color: #07C160; }
.status-resolved { background: #0FBF9F22; color: #0FBF9F; }
.status-rejected { background: #99999922; color: #999; }
.event-desc { font-size: 26rpx; color: #1A1A1A; line-height: 1.5; display: block; margin-bottom: 12rpx; }
.event-meta { display: flex; gap: 24rpx; margin-bottom: 12rpx; }
.meta-item { display: flex; align-items: center; gap: 6rpx; font-size: 22rpx; color: #999; }
.meta-icon { width: 20rpx; height: 20rpx; flex-shrink: 0; }
.photo-row { display: flex; gap: 12rpx; }
.photo-thumb { width: 160rpx; height: 160rpx; border-radius: 12rpx; object-fit: cover; background: #E8FDF8; }

// AI 比对结果
.score-card { background: #FFF; margin: 0 24rpx 20rpx; border-radius: 16rpx; padding: 24rpx; }
.section-title { font-size: 28rpx; font-weight: 600; color: #1A1A1A; display: block; margin-bottom: 16rpx; }
.score-row { display: flex; align-items: center; margin-bottom: 12rpx; }
.score-label { font-size: 24rpx; color: #666; width: 140rpx; flex-shrink: 0; }
.score-weight { font-size: 20rpx; color: #999; width: 56rpx; text-align: center; flex-shrink: 0; }
.progress-bar { flex: 1; height: 12rpx; background: #E8FDF8; border-radius: 6rpx; margin: 0 12rpx; overflow: hidden; }
.progress-fill { height: 100%; background: #0FBF9F; border-radius: 6rpx; transition: width 0.3s; }
.score-val { font-size: 24rpx; color: #1A1A1A; font-weight: 600; width: 52rpx; text-align: right; flex-shrink: 0; }
.fusion-row { margin-top: 8rpx; padding-top: 12rpx; border-top: 1rpx solid #F0F0F0; }
.fusion-val { font-size: 32rpx; color: #FF6B6B; font-weight: 700; }

// 比对候选
.candidates-card { background: #FFF; margin: 0 24rpx 20rpx; border-radius: 16rpx; padding: 24rpx; }
.candidate-card { display: flex; align-items: center; background: #FFF; border-radius: 16rpx; border: 2rpx solid transparent; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); padding: 20rpx; margin-bottom: 16rpx; cursor: pointer; transition: border-color 0.2s; }
.candidate-card:last-child { margin-bottom: 0; }
.candidate-card.selected { border-color: #0FBF9F; }
.candidate-photo { width: 120rpx; height: 120rpx; border-radius: 12rpx; margin-right: 16rpx; background: #E8FDF8; flex-shrink: 0; object-fit: cover; }
.candidate-info { flex: 1; }
.candidate-breed { font-size: 28rpx; font-weight: 600; color: #1A1A1A; display: block; margin-bottom: 4rpx; }
.candidate-color { font-size: 22rpx; color: #666; display: block; margin-bottom: 4rpx; }
.candidate-address { font-size: 20rpx; color: #999; display: block; margin-bottom: 8rpx; }
.candidate-footer { display: flex; align-items: center; justify-content: space-between; }
.candidate-status { font-size: 18rpx; padding: 2rpx 10rpx; border-radius: 8rpx; background: #FF6B6B; color: #FFF; }
.status-lost { background: #FF6B6B !important; }
.status-found { background: #0FBF9F !important; }
.status-claimed { background: #FF9F00 !important; }
.candidate-score { display: flex; align-items: center; gap: 8rpx; }
.score-num { font-size: 26rpx; font-weight: 700; color: #FF6B6B; }
.recommend-badge { background: #FF6B6B; color: #FFF; font-size: 18rpx; padding: 2rpx 10rpx; border-radius: 8rpx; }
.radio-circle { width: 36rpx; height: 36rpx; border-radius: 50%; border: 2rpx solid #DDD; margin-left: 12rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: border-color 0.2s; }
.radio-circle.checked { border-color: #0FBF9F; background: #0FBF9F; }

// 无候选提示
.no-candidates-hint { background: #FFF; margin: 0 24rpx 20rpx; border-radius: 16rpx; padding: 48rpx 24rpx; display: flex; flex-direction: column; align-items: center; gap: 24rpx; }
.no-candidates-hint text { font-size: 26rpx; color: #999; }
.process-btn { background: #0FBF9F; color: #FFF; font-size: 26rpx; padding: 16rpx 48rpx; border-radius: 40rpx; font-weight: 600; }

// 操作区
.action-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #FFF; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); display: flex; gap: 24rpx; box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06); }
.action-reject { flex: 1; text-align: center; padding: 24rpx; border-radius: 40rpx; background: #F5F5F5; color: #999; font-size: 28rpx; font-weight: 600; }
.action-confirm { flex: 2; text-align: center; padding: 24rpx; border-radius: 40rpx; background: #FF6B6B; color: #FFF; font-size: 28rpx; font-weight: 600; }
.action-confirm.disabled { background: #CCC; color: #FFF; }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add miniapp-admin/src/pages/admin/audit-detail/index.vue
git commit -m "feat: add admin audit detail page with mock data"
```

---

## Task 2: 注册路由

**Files:**
- Modify: `miniapp-admin/src/pages.json:75`（在 `audit/index` 条目后添加 `audit-detail`）

- [ ] **Step 1: 添加路由条目**

在 `pages.json` 的 `pages` 数组中，`pages/admin/audit/index` 条目**之后**添加：

```json
{
  "path": "pages/admin/audit-detail/index",
  "style": {
    "navigationBarTitleText": "事件审核详情",
    "navigationBarBackgroundColor": "#FFFFFF",
    "navigationBarTextStyle": "black"
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add miniapp-admin/src/pages.json
git commit -m "feat: register audit-detail route"
```

---

## Task 3: 审核列表 → 跳详情页

**Files:**
- Modify: `miniapp-admin/src/pages/admin/audit/index.vue`
- Modify: `miniapp-admin/src/components/audit-event-card/index.vue`

- [ ] **Step 1: 修改 audit-event-card 组件，点击卡片时触发 `@click` 事件（已有点击事件，但 audit/index.vue 中未监听）**

在 `miniapp-admin/src/pages/admin/audit/index.vue` 中，给 `<audit-event-card>` 组件添加 `@click` 处理器，跳转到详情页：

在第 38-40 行附近找到：
```vue
<audit-event-card
  v-for="item in events"
  :key="item.event_id"
  :event="item"
  @confirm="onConfirmEvent(item.event_id)"
  @reject="onRejectEvent(item.event_id)"
/>
```

在 `@reject` 之后添加 `@click` 处理：
```vue
<audit-event-card
  v-for="item in events"
  :key="item.event_id"
  :event="item"
  @confirm="onConfirmEvent(item.event_id)"
  @reject="onRejectEvent(item.event_id)"
  @click="goToDetail(item.event_id)"
/>
```

在 `formatTime` 函数后添加 `goToDetail` 函数：
```typescript
function goToDetail(eventId: string) {
  uni.navigateTo({ url: `/pages/admin/audit-detail/index?event_id=${eventId}` })
}
```

- [ ] **Step 2: 提交**

```bash
git add miniapp-admin/src/pages/admin/audit/index.vue
git commit -m "feat: navigate to audit detail page on card click"
```

---

## Task 4: API 层支持 animal_id 参数

**Files:**
- Modify: `miniapp-admin/src/services/api.js:117-121`

- [ ] **Step 1: 修改 `apiConfirmEvent` 支持 `animal_id` 参数**

当前实现（行 117-121）：
```javascript
export function apiConfirmEvent(eventId) {
  return request(`/admin/events/${eventId}/confirm`, {
    method: 'PUT'
  })
}
```

修改为：
```javascript
/**
 * 确认重复事件
 * PUT /admin/events/:event_id/confirm
 * 请求（等后端就绪）: { animal_id: string }  // 合并目标动物ID
 */
export function apiConfirmEvent(eventId, params = {}) {
  return request(`/admin/events/${eventId}/confirm`, {
    method: 'PUT',
    body: params
  })
}
```

- [ ] **Step 2: 提交**

```bash
git add miniapp-admin/src/services/api.js
git commit -m "feat: apiConfirmEvent supports animal_id parameter"
```

---

## Task 5: 接入真实接口（等后端就绪后）

**Files:**
- Modify: `miniapp-admin/src/pages/admin/audit-detail/index.vue`
- Modify: `miniapp-admin/src/services/api.js`

> ⚠️ 此任务等后端完成以下工作后执行：
> 1. `GET /admin/events/:event_id` 返回 `candidates[]` + 四维度分项
> 2. `PUT /admin/events/:event_id/confirm` 支持 `animal_id` 参数

- [ ] **Step 1: 添加 `apiGetAdminAuditDetail` 接口**

在 `api.js` 中添加（位于 `apiGetAdminEventDetail` 附近）：

```javascript
/**
 * 获取审核详情（含候选列表）
 * GET /admin/events/:event_id
 * 响应新增: candidates[], vector_similarity, gps_similarity, image_similarity, text_match_rate
 */
export function apiGetAdminAuditDetail(eventId) {
  return request(`/admin/events/${eventId}`)
}
```

- [ ] **Step 2: 改造 `loadMockData` 为真实接口调用**

在 `audit-detail/index.vue` 中，替换 `loadMockData` 函数：

```typescript
async function loadAuditDetail(eventId: string) {
  loading.value = true
  try {
    const res: any = await apiGetAdminAuditDetail(eventId)
    if (res.code === 0) {
      event.value = res.data
      // 默认选中推荐候选
      const recommended = event.value.candidates?.find((c: any) => c.is_recommended)
      if (recommended) selectedCandidateId.value = recommended.animal_id
    }
  } catch (e) {
    console.error('加载审核详情失败', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
```

将 `onMounted` 中的 `loadMockData(eventId)` 替换为 `loadAuditDetail(eventId)`。

- [ ] **Step 3: 提交**

```bash
git add miniapp-admin/src/services/api.js miniapp-admin/src/pages/admin/audit-detail/index.vue
git commit -m "feat: connect real API for audit detail"
```

---

## 缺口记录

| 缺口 | 负责方 | 状态 | 阻塞 |
|------|--------|------|------|
| `GET /admin/events/:event_id` 返回 `candidates[]` + 四维度分项 | 后端 | ❌ | Task 5 |
| `PUT /admin/events/:event_id/confirm` 支持 `animal_id` 参数 | 后端 | ❌ | Task 4+5 |
