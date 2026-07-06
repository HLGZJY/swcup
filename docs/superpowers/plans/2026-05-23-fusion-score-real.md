# 融合得分三维度真实化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GPS 用 Haversine 真实计算，text_match_rate 用用户填的 breed/color/gender 计算，事件记录保存 nose_vector_id，前端采集页增加表单步骤

**Architecture:** 前端在鼻纹采集第3步（确认提交前）增加 breed/color/gender 表单，通过 URL 参数传到 result.vue 再传后端；后端 CompareNoseDto 接收三字段，nose.service.ts 用 Haversine + 关键词匹配算真实分

**Tech Stack:** NestJS (TypeORM) / Vue 3 (uni-app) / Haversine formula

---

## 前端任务

### Task F1: 采集页新增 breed/color/gender 表单步骤

**Files:**
- Modify: `miniapp-user/src/pages/collect/index.vue`
- Test: 手动测试采集流程

**改动概述**：在 Step 1（拍摄鼻纹）和 Step 2（确认提交）之间插入 Step 2 填写信息，共 4 步。

- [ ] **Step 1: 修改 steps 定义（共4步）**

```javascript
// index.vue near line 158
const steps = ['选择物种', '拍摄鼻纹', '填写信息', '确认提交']
// currentStep === 0: 选择物种
// currentStep === 1: 拍摄鼻纹
// currentStep === 2: 填写信息（新增）
// currentStep === 3: 确认提交
```

- [ ] **Step 2: 添加表单数据绑定的 ref 变量**

```javascript
// index.vue data section (~line 146-157)
// 新增这三个 ref
const breed = ref('')
const color = ref('')
const gender = ref('unknown')

// 同时新增用于预览的 confirm-card 展示数据
const confirmBreed = ref('')
const confirmColor = ref('')
const confirmGender = ref('')
```

- [ ] **Step 3: 在 step === 2 时渲染表单（新增 section）**

在 `<!-- 确认提交 -->` section 之前，添加：

```vue
<!-- 填写信息 -->
<view class="section" v-show="currentStep === 2">
  <text class="section-title">填写宠物信息</text>

  <view class="form-item">
    <text class="form-label">品种</text>
    <input
      class="form-input"
      v-model="breed"
      placeholder="输入品种名称（如：柴犬）"
      placeholder-class="input-placeholder"
    />
  </view>

  <view class="form-item">
    <text class="form-label">颜色</text>
    <input
      class="form-input"
      v-model="color"
      placeholder="输入颜色（如：黄白）"
      placeholder-class="input-placeholder"
    />
  </view>

  <view class="form-item">
    <text class="form-label">性别</text>
    <view class="gender-options">
      <view
        v-for="opt in genderOptions"
        :key="opt.value"
        :class="['gender-btn', { selected: gender === opt.value }]"
        @click="gender = opt.value"
      >
        <text>{{ opt.label }}</text>
      </view>
    </view>
  </view>
</view>
```

```javascript
// index.vue data section
const genderOptions = [
  { value: 'unknown', label: '未知' },
  { value: 'male', label: '公' },
  { value: 'female', label: '母' },
]
```

- [ ] **Step 4: 修改 canNext 逻辑（step 2 必须填写）**

```javascript
// 修改 canNext computed (~line 176)
const canNext = computed(() => {
  if (currentStep.value === 0) return true
  if (currentStep.value === 1) return !!nosePhoto.value
  if (currentStep.value === 2) return true  // 新步骤，允许空（品种颜色非必填）
  return true
})
```

- [ ] **Step 5: 修改 onNext 末尾按钮文字**

```vue
<!-- bottom-bar 里的按钮文字（~line 138） -->
<text v-if="currentStep < 3">{{ currentStep === 1 && !nosePhoto ? '上传鼻纹' : '下一步' }}</text>
<text v-else>开始比对</text>
```

- [ ] **Step 6: 修改 confirm-card 展示 breed/color/gender**

将 confirm-card 部分（~line 94）改为：

```vue
<view class="confirm-card">
  <view class="confirm-item">
    <text class="confirm-label">物种</text>
    <text class="confirm-value">{{ speciesLabel }}</text>
  </view>
  <view class="confirm-item">
    <text class="confirm-label">鼻纹照片</text>
    <image v-if="nosePhoto" class="confirm-nose-thumb" :src="nosePhoto" mode="aspectFill" />
    <text v-else class="confirm-value danger">未上传</text>
  </view>
  <view class="confirm-item">
    <text class="confirm-label">品种</text>
    <text class="confirm-value">{{ breed || '未填写' }}</text>
  </view>
  <view class="confirm-item">
    <text class="confirm-label">颜色</text>
    <text class="confirm-value">{{ color || '未填写' }}</text>
  </view>
  <view class="confirm-item">
    <text class="confirm-label">性别</text>
    <text class="confirm-value">{{ genderLabel }}</text>
  </view>
  <view class="confirm-item">
    <text class="confirm-label">位置</text>
    <text class="confirm-value">{{ locationText }}</text>
  </view>
</view>
```

```javascript
// computed 新增
const genderLabel = computed(() => {
  return genderOptions.find(g => g.value === gender.value)?.label || '未知'
})
```

- [ ] **Step 7: 跳转 URL 时带 breed/color/gender 参数**

找到 onNext 末尾跳转处（~line 328）：

```javascript
// 跳转到结果页
setTimeout(() => {
  uni.navigateTo({
    url: `/pages/collect/result?nose_id=${noseId}&species=${selectedSpecies.value}&breed=${encodeURIComponent(breed.value)}&color=${encodeURIComponent(color.value)}&gender=${encodeURIComponent(gender.value)}`
  })
}, 1000)
```

- [ ] **Step 8: 添加表单样式**

在 `<style scoped>` 里添加：

```scss
.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 600;
  display: block;
  margin-bottom: 12rpx;
}

.form-input {
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #1A1A1A;
}

.input-placeholder {
  color: #AAAAAA;
}

.gender-options {
  display: flex;
  gap: 16rpx;
}

.gender-btn {
  flex: 1;
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 20rpx;
  text-align: center;
  font-size: 28rpx;
  color: #666666;
  border: 4rpx solid transparent;
}

.gender-btn.selected {
  border-color: #0FBF9F;
  background: #E8FDF8;
  color: #0FBF9F;
  font-weight: 600;
}
```

- [ ] **Step 9: 提交**

```bash
git add miniapp-user/src/pages/collect/index.vue
git commit -m "feat(collect): add breed/color/gender form step before confirm"
```

---

### Task F2: result.vue 读取 URL 参数并传给 apiNoseCompare

**Files:**
- Modify: `miniapp-user/src/pages/collect/result.vue`

- [ ] **Step 1: 读取 URL 参数里的 breed/color/gender**

修改 onMounted（~line 109）：

```javascript
onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const { nose_id, species, breed, color, gender } = currentPage.options || {}

  if (!nose_id || nose_id === 'undefined') {
    uni.showToast({ title: '缺少鼻纹ID，请重新采集', icon: 'none' })
    uni.navigateBack()
    return
  }

  noseId.value = nose_id
  selectedSpecies.value = species || uni.getStorageSync('selectedSpecies') || 'dog'

  // 新增：保存表单数据用于展示
  formBreed.value = decodeURIComponent(breed || '')
  formColor.value = decodeURIComponent(color || '')
  formGender.value = decodeURIComponent(gender || 'unknown')

  uni.showLoading({ title: '比对中...' })
  try {
    const result: any = await apiNoseCompare({
      nose_id: noseId.value,
      species: selectedSpecies.value,
      breed: formBreed.value,
      color: formColor.value,
      gender: formGender.value,
    })
    compareResult.value = result.data
  } catch (e) {
    // 错误由拦截器处理
  } finally {
    uni.hideLoading()
  }
})
```

新增 data 变量：
```javascript
const formBreed = ref('')
const formColor = ref('')
const formGender = ref('')
```

- [ ] **Step 2: 提交**

```bash
git add miniapp-user/src/pages/collect/result.vue
git commit -m "feat(result): pass breed/color/gender to apiNoseCompare"
```

---

## 后端任务

### Task B2-1: CompareNoseDto 增加 breed/color/gender 字段

**Files:**
- Modify: `backend/src/nose/dto/nose.dto.ts`

- [ ] **Step 1: 在 CompareNoseDto 末尾添加三个字段**

在 `nose.dto.ts` 的 `CompareNoseDto` 类末尾（`nose_photo_url` 字段之后）添加：

```typescript
@ApiPropertyOptional()
@IsString()
@IsOptional()
breed?: string;

@ApiPropertyOptional()
@IsString()
@IsOptional()
color?: string;

@ApiPropertyOptional({ enum: ['male', 'female', 'unknown'] })
@IsString()
@IsOptional()
gender?: string;
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/nose/dto/nose.dto.ts
git commit -m "feat(nose): add breed/color/gender to CompareNoseDto"
```

---

### Task B2-2: nose.service.ts 三维度真实化

**Files:**
- Modify: `backend/src/nose/nose.service.ts`

- [ ] **Step 1: 修改 FUSION_WEIGHTS（去掉 image，改权重）**

```typescript
// line 11
const FUSION_WEIGHTS = { vector: 0.5, gps: 0.3, text: 0.2 };
```

- [ ] **Step 2: 添加 Haversine 和 textMatch 工具函数（在类之前）**

```typescript
// Haversine 计算两点间地球表面距离（米）
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function gpsScore(distanceM: number): number {
  return Math.max(0, Math.min(1, 1 - (distanceM - 500) / 1000))
}

function textMatch(dto: CompareNoseDto, animal: Animal): number {
  const kw1 = [dto.breed, dto.color, dto.gender].filter(Boolean)
  const kw2 = [animal.breed, animal.color, animal.gender].filter(Boolean)
  if (!kw1.length && !kw2.length) return 1
  if (!kw1.length || !kw2.length) return 0
  const intersection = kw1.filter(k =>
    kw2.some(v => v && k && (k.includes(v) || v.includes(k)))
  )
  return parseFloat((intersection.length / Math.max(kw1.length, kw2.length)).toFixed(4))
}
```

- [ ] **Step 3: 替换 compare() 方法里的 mock 计算**

找到 `// GPS 距离（模拟）` 和 `// 图像/文本相似度（mock）` 部分（约 line 130-136），替换为：

```typescript
// GPS 距离真实计算（用 animal 表的 location_* 字段）
const animalLat = animal.location_lat || 0
const animalLng = animal.location_lng || 0
const gps_distance_m = Math.round(haversineDistance(
  dto.location_lat || 0, dto.location_lng || 0,
  animalLat, animalLng
))
const gpsScoreVal = gpsScore(gps_distance_m)

// text_match_rate 真实计算（用 dto.breed/color/gender）
const textMatchVal = textMatch(dto, animal)

// fusion_score 三维度（去掉 image）
const fusion_score = parseFloat((
  FUSION_WEIGHTS.vector * vector_similarity +
  FUSION_WEIGHTS.gps * gpsScoreVal +
  FUSION_WEIGHTS.text * textMatchVal
).toFixed(4))
```

返回对象中移除 `image_similarity`（不再存在于融合公式中），保留 `text_match_rate`：

```typescript
return {
  animal_id: animal.animal_id,
  fusion_score,
  vector_similarity,
  gps_distance_m,
  text_match_rate: textMatchVal,
  animal: { ... }
}
```

- [ ] **Step 4: 提交**

```bash
git add backend/src/nose/nose.service.ts
git commit -m "feat(nose): use real Haversine GPS and text match, remove mock"
```

---

### Task B2-3: events.service.ts create() 保存 nose_vector_id

**Files:**
- Modify: `backend/src/events/events.service.ts`

- [ ] **Step 1: 在 create() 的 create() 调用中添加 nose_vector_id 和 nose_photo_url**

找到 `events.service.ts` 的 `create()` 方法中 `this.eventRepo.create({})` 调用（约 line 18-30），在 `animal_id` 之后添加：

```typescript
animal_id: dto.animal_id || undefined,
// 新增：
nose_vector_id: dto.nose_vector_id || undefined,
nose_photo_url: dto.nose_photo_url || undefined,
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/events/events.service.ts
git commit -m "fix(events): save nose_vector_id and nose_photo_url in create()"
```

---

### Task B2-4: admin getEventDetail scores 嵌套结构

**Files:**
- Modify: `backend/src/admin/admin.service.ts`

- [ ] **Step 1: 修改 getEventDetail 中 candidates 拼装逻辑**

找到 `getEventDetail` 方法中 candidates 映射部分（约 line 73-89），将扁平结构：

```typescript
const candidates = event.candidates.map((c: any) => {
  const animal = animalMap.get(c.animal_id)
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
  }
})
```

改为嵌套结构：

```typescript
const candidates = event.candidates.map((c: any) => {
  const animal = animalMap.get(c.animal_id)
  return {
    animal_id: c.animal_id,
    breed: animal?.breed || c.breed || '',
    color: animal?.color || c.color || '',
    gender: animal?.gender || c.gender || '',
    status: animal?.status || c.status || '',
    photos: animal?.photos || c.photos || [],
    address: animal?.address || c.address || '',
    fusion_score: c.fusion_score,
    scores: {
      cosine_similarity: c.vector_similarity ?? null,
      gps_score: c.gps_similarity ?? null,
      text_match_rate: c.text_match_rate ?? null,
    },
    is_recommended: c.is_recommended || false,
  }
})
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/admin/admin.service.ts
git commit -m "refactor(admin): nest candidate scores in scores object"
```