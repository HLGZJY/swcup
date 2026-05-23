# 新动物上报流程设计（Plan B）

## 背景

**当前设计的问题：** 后端在 `fusion_score < 0.75` 时自动创建 animal 档案，用户没有机会说"否"。这意味着用户即使选择"取消"不报案，数据库里也已经多了一条动物记录——用户并没有被真正赋予拒绝的权利。

**Plan B 的核心改变：** 后端将"是否创建动物档案"的决定权交还给用户。后端在 `< 0.75` 时**不自动建档**，而是在比对接口响应中携带 `next_action: "ask_user_create"`，由前端展示确认弹窗，用户选择"创建"或"取消"。

---

## 业务流程

### 场景 A：比对匹配到已知动物（fusion_score ≥ 0.75）
- 后端正常返回匹配列表
- 前端展示匹配卡片 + "上报此动物"按钮
- 用户点击 → 直接跳转 `animal-detail`

### 场景 B：比对无匹配（fusion_score < 0.75 或 results 为空）
- 后端返回 `next_action: "ask_user_create"`，`results: []`
- 前端展示"未找到匹配动物"状态 + 确认弹窗
- 用户点击"创建档案" → 前端**先**调 `POST /animals` 创建动物档案 → **再**调 `POST /events` 上报事件 → 跳转详情页
- 用户点击"取消" → 流程结束，留在比对结果页

---

## 后端改动

### 1. `POST /nose/compare` 响应结构扩展

**现有响应：**
```json
{ "total": 0, "results": [], "threshold_confirmed": 0.88, "threshold_suspected": 0.75 }
```

**B 方案新增字段（当 fusion_score < 0.75 时）：**
```json
{
  "total": 0,
  "results": [],
  "threshold_confirmed": 0.88,
  "threshold_suspected": 0.75,
  "next_action": "ask_user_create",
  "candidate": null
}
```

当 `next_action === "ask_user_create"` 时，前端触发确认弹窗，后端**不创建任何记录**。

### 2. 新增 `POST /animals` — 独立创建动物档案

**请求体：**
```json
{
  "species": "dog",
  "breed": "金毛",
  "color": "金色",
  "gender": "male",
  "age_estimate": "adult",
  "health_status": "healthy",
  "location_lat": 22.123,
  "location_lng": 113.456,
  "address": "深圳市南山区",
  "notes": "在楼下发现",
  "primary_nose_id": "uuid-of-nose-vector",
  "photos": []
}
```

**响应：**
```json
{ "animal_id": "uuid", "status": "found" }
```

### 3. `POST /events` 改为明确模式

**`confirm_new_animal` 标志（新增）：**
```json
{
  "event_type": "report",
  "nose_vector_id": "uuid",
  "animal_id": "刚创建的animal_uuid",
  "confirm_new_animal": true,
  "species": "dog",
  "location_lat": 22.123,
  "location_lng": 113.456,
  ...
}
```

- `confirm_new_animal: false`（默认）→ 不自动建档，不关联 animal
- `confirm_new_animal: true` → 关联已有 animal_id，不新建

---

## 前端改动

### 1. `result.vue` — 三分支状态逻辑

```javascript
// 状态分支
const hasMatch = computed(() => {
  if (!compareResult.value) return false
  const results = compareResult.value.results
  return results && results.length > 0 && results[0].fusion_score >= 0.75
})

const needsConfirmation = computed(() => {
  if (!compareResult.value) return false
  return compareResult.value.next_action === 'ask_user_create'
})

const showMatchList = computed(() => hasMatch.value && !needsConfirmation.value)
```

**UI 展示：**
- `hasMatch === true` → 显示匹配卡片列表 + "上报此动物"
- `needsConfirmation === true` → 显示"未找到匹配动物"提示 + 底部「创建档案」「取消」双按钮
- 其他情况 → 显示空状态或加载中

### 2. 确认弹窗（不再用 uni.showModal）

**底部固定操作栏：**
```html
<view class="bottom-actions" v-if="needsConfirmation">
  <view class="action-hint">
    <text class="hint-icon">ℹ️</text>
    <text>未在数据库中找到匹配动物</text>
  </view>
  <view class="btn-primary" @click="onCreateAnimal">
    <text>创建档案</text>
  </view>
  <view class="btn-secondary" @click="onCancel">
    <text>取消</text>
  </view>
</view>
```

### 3. 创建档案 + 上报事件顺序调用

```javascript
async function onCreateAnimal() {
  if (!canCreate.value) return

  uni.showLoading({ title: '创建中...' })
  try {
    // Step 1: 创建动物档案
    const animalRes: any = await apiCreateAnimal({
      species: selectedSpecies.value,
      primary_nose_id: noseId.value,
      location_lat: locationLat.value,
      location_lng: locationLng.value,
    })
    const animalId = animalRes.data.animal_id

    // Step 2: 上报事件（关联到新建的动物）
    await apiReportEvent({
      event_type: 'report',
      animal_id: animalId,
      nose_vector_id: noseId.value,
      species: selectedSpecies.value,
      location_lat: locationLat.value,
      location_lng: locationLng.value,
    })

    uni.hideLoading()
    uni.showToast({ title: '创建成功', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/animal-detail/index?animal_id=${animalId}` })
    }, 1000)
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '创建失败，请重试', icon: 'none' })
  }
}

function onCancel() {
  uni.switchTab({ url: '/pages/index/index' })
}
```

### 4. 新增 `apiCreateAnimal` 接口（miniapp-user/src/services/api.js）

```javascript
export function apiCreateAnimal(params) {
  return request('/animals', {
    method: 'POST',
    body: params
  })
}
```

---

## 数据流

```
采集页
  └─ 比对页 (result.vue)
       ├─ POST /nose/compare { nose_id, species }
       │
       ├─ fusion_score ≥ 0.75 → results 有数据
       │    └─ 展示匹配列表 → "上报此动物"
       │         └─ animal-detail?animal_id=xxx
       │
       └─ fusion_score < 0.75 → next_action: "ask_user_create"
            └─ 显示"未找到匹配动物" + 双按钮
                 ├─ 用户点"取消" → 留在此页，流程结束
                 └─ 用户点"创建档案"
                      ├─ POST /animals → animal_id
                      ├─ POST /events { animal_id } → event_id
                      └─ animal-detail?animal_id=xxx
```

---

## 状态定义

| 状态 | fusion_score | next_action | 前端行为 |
|------|-------------|-------------|---------|
| 确认重复 | ≥ 0.88 | — | 展示匹配列表 |
| 疑似重复 | 0.75 ~ 0.88 | — | 展示匹配列表 + 提示审核 |
| **无匹配（Plan B）** | **< 0.75** | **"ask_user_create"** | **双按钮，用户决定** |

---

## 实施清单

### 后端（backend）
- [ ] `nose.service.ts` — compare 方法在 `< 0.75` 时返回 `next_action: "ask_user_create"`
- [ ] 新增 `POST /animals` 端点 + `AnimalsService.createAnimal(dto)`
- [ ] `POST /events` — 移除自动创建 animal 逻辑，改为明确传入 `animal_id`

### 前端（miniapp-user）
- [ ] `api.js` — 新增 `apiCreateAnimal()`
- [ ] `result.vue` — 三分支 UI 逻辑 + 双按钮操作栏 + 顺序调用 onCreateAnimal
- [ ] `pages.json` — 确认 report/new 路由已移除（Plan B 不需要独立表单页）

### 架构文档
- [ ] 更新 `docs/架构设计.md` 3.2.3 和 4.3 关于 `< 0.75` 的描述