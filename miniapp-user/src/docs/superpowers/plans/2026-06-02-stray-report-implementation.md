# 流浪动物发现上报 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增「发现页」入口，支持用户上报流浪动物（照片 + GPS + 描述），提交后 pending 审核；管理员审核通过后自动创建 Animal 档案。

**Architecture:** 用户端新增 report/index.vue 页面（发现页）；后端修改 confirmEvent 逻辑，当审核通过 report 类型事件时自动创建 Animal；采集流程和发现流程从入口层就分开。

**Tech Stack:** NestJS + TypeORM + MySQL（后端），UniApp（用户端 + 管理端）

---

## 文件结构

```
miniapp-user/
├── src/pages/report/index.vue          # 新建：发现页（流浪上报入口）
├── src/pages.json                       # 修改：注册 report 路由，加入底部 Tab
├── src/services/api.js                  # 修改：apiUploadFile 已存在，review 确认
└── src/pages/collect/index.vue          # 修改：GPS 失败时禁止提交（0,0 校验）

backend/
├── src/events/events.service.ts          # 修改：confirm() 自动创建 Animal
├── src/events/dto/create-event.dto.ts    # 修改：添加位置校验
├── src/nose/nose.service.ts             # 修改：collect() 位置 0 禁止提交
├── src/admin/admin.service.ts            # 修改：confirmEvent() 自动创建 Animal（report 类型）
└── src/admin/admin.controller.ts         # 修改：confirmEvent 传参确认
```

---

## Task 1: 后端 - 事件确认时自动创建 Animal（report 类型）

**Files:**
- Modify: `backend/src/admin/admin.service.ts:99-122`

- [ ] **Step 1: Read admin.service.ts confirmEvent method**

```typescript
// 当前 confirmEvent 逻辑（约 line 99-122）：
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

- [ ] **Step 2: Modify confirmEvent — 新增 report 类型自动建档逻辑**

将 `confirmEvent` 方法体替换为：

```typescript
async confirmEvent(event_id: string, animal_id?: string) {
  const event = await this.eventRepo.findOne({ where: { event_id } });
  if (!event) throw new Error('Event not found');

  if (animal_id) {
    // 手动指定关联动物 → 标记为重复
    const animal = await this.animalRepo.findOne({ where: { animal_id } });
    if (!animal) throw new Error('Animal not found');
    await this.eventRepo.update({ event_id }, {
      animal_id,
      status: 'duplicated' as any,
      is_duplicate: true,
    } as any);
  } else if (event.event_type === 'report' && !event.animal_id) {
    // report 类型 + 无 animal_id → 自动创建 Animal（status=FOUND）
    const { v4: uuidv4 } = require('uuid');
    const animal_id = uuidv4();
    const now = new Date();
    const newAnimal = this.animalRepo.create({
      animal_id,
      species: (event as any).species || 'other',
      breed: (event as any).breed || null,
      color: (event as any).color || null,
      gender: (event as any).gender || 'unknown',
      status: 'found',
      location_lat: event.location_lat,
      location_lng: event.location_lng,
      address: event.address || null,
      photos: event.photos || [],
      notes: event.description || null,
      first_seen_at: event.occurred_at || now,
      last_seen_at: event.occurred_at || now,
    });
    await this.animalRepo.save(newAnimal);

    await this.eventRepo.update({ event_id }, {
      animal_id,
      status: 'confirmed' as any,
      is_duplicate: false,
    } as any);
  } else {
    // 其他情况：纯标签更新（向后兼容）
    await this.eventRepo.update({ event_id }, {
      status: 'duplicated' as any,
      is_duplicate: true,
    } as any);
  }

  return this.getEventDetail(event_id);
}
```

- [ ] **Step 3: Run build to verify no compile errors**

```bash
cd F:/swcup2026/backend && npx tsc --noEmit
```
Expected: No errors (compilation succeeds)

---

## Task 2: 后端 - CreateEventDto 位置校验

**Files:**
- Modify: `backend/src/events/dto/create-event.dto.ts:56-66`

- [ ] **Step 1: Read create-event.dto.ts location fields**

当前 `location_lat` 和 `location_lng` 的定义（约 line 56-66）：

```typescript
@ApiProperty()
@IsNumber()
@IsNotEmpty()
@Type(() => Number)
location_lat: number;

@ApiProperty()
@IsNumber()
@IsNotEmpty()
@Type(() => Number)
location_lng: number;
```

- [ ] **Step 2: Add custom validator for non-zero coordinates**

在文件顶部添加自定义校验器：

```typescript
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

function IsValidCoordinate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidCoordinate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const num = Number(value);
          return !isNaN(num) && num !== 0;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid non-zero coordinate`;
        },
      },
    });
  };
}
```

然后修改 `location_lat` 和 `location_lng` 字段的装饰器：

```typescript
@ApiProperty({ description: '纬度坐标（必填，不能为0）' })
@IsNumber()
@IsNotEmpty()
@Type(() => Number)
@IsValidCoordinate({ message: '请提供有效的位置坐标（不能为0）' })
location_lat: number;

@ApiProperty({ description: '经度坐标（必填，不能为0）' })
@IsNumber()
@IsNotEmpty()
@Type(() => Number)
@IsValidCoordinate({ message: '请提供有效的位置坐标（不能为0）' })
location_lng: number;
```

- [ ] **Step 3: Run build to verify no compile errors**

```bash
cd F:/swcup2026/backend && npx tsc --noEmit
```
Expected: No errors

---

## Task 3: 后端 - nose.service.ts collect() 位置 0 禁止提交

**Files:**
- Modify: `backend/src/nose/nose.service.ts:158-213`

- [ ] **Step 1: Read collect() method**

当前 `collect()` 方法（line 158-213），找到提交前校验位置：

```typescript
async collect(dto: CollectNoseDto, user_id: string) {
  if (!dto.nose_photo) {
    throw new Error('缺少鼻纹照片');
  }
  // ... vector extraction ...
```

- [ ] **Step 2: Add location zero check after nose_photo check**

在 `if (!dto.nose_photo)` 检查之后添加：

```typescript
if (!dto.nose_photo) {
  throw new Error('缺少鼻纹照片');
}

// 校验位置坐标有效性（禁止 0,0）
if (!dto.location_lat || !dto.location_lng || dto.location_lat === 0 || dto.location_lng === 0) {
  throw new Error('请提供有效的位置信息，不支持默认坐标');
}
```

- [ ] **Step 3: Run build to verify no compile errors**

```bash
cd F:/swcup2026/backend && npx tsc --noEmit
```
Expected: No errors

---

## Task 4: 前端 - 新建发现页 report/index.vue

**Files:**
- Create: `miniapp-user/src/pages/report/index.vue`

- [ ] **Step 1: Write report/index.vue — Step 1 (物种选择)**

```vue
<template>
  <view class="page">
    <!-- 顶部引导区 -->
    <view class="guide-header">
      <view class="guide-title">
        <text class="title-main">发现上报</text>
        <text class="title-sub">报告你身边的流浪动物</text>
      </view>
    </view>

    <!-- 步骤指示 -->
    <view class="steps-indicator">
      <view
        v-for="(step, index) in steps"
        :key="index"
        :class="['step-item', { active: currentStep === index, completed: currentStep > index }]"
      >
        <view class="step-circle">
          <text v-if="currentStep <= index">{{ index + 1 }}</text>
          <text v-else>✓</text>
        </view>
        <text class="step-text">{{ step }}</text>
        <view v-if="index < steps.length - 1" class="step-line" :class="{ filled: currentStep > index }"></view>
      </view>
    </view>

    <!-- Step 0: 选择物种 -->
    <view class="section" v-show="currentStep === 0">
      <text class="section-title">选择物种</text>
      <view class="species-grid">
        <view
          v-for="spec in speciesList"
          :key="spec.value"
          :class="['species-card', { selected: selectedSpecies === spec.value }]"
          @click="selectedSpecies = spec.value"
        >
          <image class="species-icon" :src="spec.icon" mode="aspectFit" />
          <text class="species-name">{{ spec.label }}</text>
        </view>
      </view>
    </view>

    <!-- Step 1: 拍摄照片 -->
    <view class="section" v-show="currentStep === 1">
      <text class="section-title">拍摄照片</text>
      <text class="section-hint">请上传 1-3 张能看清外形的照片</text>

      <view class="photo-grid">
        <view
          v-for="(photo, index) in photos"
          :key="index"
          class="photo-item"
        >
          <image class="photo-img" :src="photo" mode="aspectFill" />
          <view class="photo-remove" @click="removePhoto(index)">×</view>
        </view>
        <view
          v-if="photos.length < 3"
          class="photo-add"
          @click="onAddPhoto"
        >
          <text class="add-icon">+</text>
          <text class="add-text">添加照片</text>
        </view>
      </view>
    </view>

    <!-- Step 2: 获取位置 -->
    <view class="section" v-show="currentStep === 2">
      <text class="section-title">发现位置</text>
      <text class="section-hint">GPS 坐标用于显示动物发现地点</text>

      <view class="location-display">
        <image class="location-icon-img" src="/static/icons/icon-mappin.png" mode="aspectFit" />
        <view class="location-info">
          <text class="location-text">{{ locationText }}</text>
          <text class="location-coords" v-if="locationLat && locationLng">
            {{ locationLat.toFixed(6) }}, {{ locationLng.toFixed(6) }}
          </text>
        </view>
        <view class="location-refresh" @click="getLocation">
          <text>刷新</text>
        </view>
      </view>

      <view class="location-actions">
        <view class="btn-locate" v-if="!locationLat" @click="getLocation">
          <text>获取当前位置</text>
        </view>
        <view class="btn-manual" v-if="!locationLat" @click="onManualSelect">
          <text>手动选择位置</text>
        </view>
      </view>
    </view>

    <!-- Step 3: 填写描述 -->
    <view class="section" v-show="currentStep === 3">
      <text class="section-title">补充描述（选填）</text>
      <textarea
        class="description-input"
        v-model="description"
        placeholder="简单描述一下这只动物的情况，例如：比较亲人、在觅食、左耳有缺口..."
        placeholder-class="input-placeholder"
      />
    </view>

    <!-- Step 4: 确认提交 -->
    <view class="section" v-show="currentStep === 4">
      <text class="section-title">确认信息</text>

      <view class="confirm-card">
        <view class="confirm-item">
          <text class="confirm-label">物种</text>
          <text class="confirm-value">{{ speciesLabel }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">照片</text>
          <view class="confirm-photos">
            <image
              v-for="(photo, i) in photos.slice(0, 3)"
              :key="i"
              class="confirm-thumb"
              :src="photo"
              mode="aspectFill"
            />
          </view>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">位置</text>
          <text class="confirm-value">{{ locationText }}</text>
        </view>
        <view class="confirm-item" v-if="description">
          <text class="confirm-label">描述</text>
          <text class="confirm-value">{{ description }}</text>
        </view>
      </view>
    </view>

    <!-- 底部按钮 -->
    <view class="bottom-bar">
      <view class="btn-back" v-if="currentStep > 0" @click="onBack">
        <text>上一步</text>
      </view>
      <view
        :class="['btn-next', { disabled: !canNext }]"
        @click="onNext"
      >
        <text v-if="currentStep < 4">{{ currentStep === 2 ? '下一步' : '下一步' }}</text>
        <text v-else>提交</text>
      </view>
    </view>

    <!-- 提交成功弹窗 -->
    <view class="success-modal" v-if="showSuccess">
      <view class="success-content">
        <text class="success-icon">✓</text>
        <text class="success-title">提交成功</text>
        <text class="success-desc">感谢你的上报，管理员审核通过后将在首页展示</text>
        <view class="success-actions">
          <view class="btn-view" @click="goToMyReports">
            <text>查看我的上报</text>
          </view>
          <view class="btn-home" @click="goHome">
            <text>返回首页</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
```

- [ ] **Step 2: Write script section**

```typescript
<script setup lang="ts">
import { ref, computed } from 'vue'
import { apiReportEvent, apiUploadFile } from '@/services/api'

const currentStep = ref(0)
const selectedSpecies = ref('dog')
const photos = ref<string[]>([])      // 本地路径列表（用于预览）
const photoUrls = ref<string[]>([])    // 上传后的 URL 列表
const description = ref('')
const locationText = ref('获取中...')
const locationLat = ref<number | null>(null)
const locationLng = ref<number | null>(null)
const showSuccess = ref(false)

const steps = ['选择物种', '拍摄照片', '获取位置', '补充描述', '确认提交']

const speciesList = [
  { value: 'dog', label: '狗狗', icon: '/static/mock/dog-icon.png' },
  { value: 'cat', label: '猫咪', icon: '/static/mock/cat-icon.png' },
  { value: 'other', label: '其他', icon: '/static/mock/other-icon.png' }
]

const speciesLabel = computed(() => {
  return speciesList.find(s => s.value === selectedSpecies.value)?.label || ''
})

const canNext = computed(() => {
  if (currentStep.value === 0) return true
  if (currentStep.value === 1) return photos.value.length > 0
  if (currentStep.value === 2) return locationLat.value !== null && locationLng.value !== null
  return true
})

// 获取位置
function getLocation() {
  uni.getLocation({
    type: 'gcj02',
    success: (res) => {
      locationLat.value = res.latitude
      locationLng.value = res.longitude
      locationText.value = `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`
    },
    fail: () => {
      uni.showToast({ title: '定位失败，请手动选择位置', icon: 'none' })
      locationText.value = '定位失败'
    }
  })
}

// 手动选择位置（打开地图选点）
function onManualSelect() {
  uni.chooseLocation({
    success: (res) => {
      locationLat.value = res.latitude
      locationLng.value = res.longitude
      locationText.value = res.address || `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`
    },
    fail: () => {
      uni.showToast({ title: '请允许定位权限', icon: 'none' })
    }
  })
}

// 添加照片
function onAddPhoto() {
  uni.chooseImage({
    count: 3 - photos.value.length,
    sourceType: ['camera', 'album'],
    success: async (res) => {
      for (const filePath of res.tempFilePaths) {
        photos.value.push(filePath)
        // 上传获得 URL
        const url = await apiUploadFile(filePath)
        photoUrls.value.push(url)
      }
    }
  })
}

// 移除照片
function removePhoto(index: number) {
  photos.value.splice(index, 1)
  photoUrls.value.splice(index, 1)
}

function onBack() {
  if (currentStep.value > 0) currentStep.value--
}

async function onNext() {
  if (!canNext.value) {
    if (currentStep.value === 1 && photos.value.length === 0) {
      uni.showToast({ title: '请至少上传一张照片', icon: 'none' })
    }
    if (currentStep.value === 2 && !locationLat.value) {
      uni.showToast({ title: '请先获取位置信息', icon: 'none' })
    }
    return
  }

  if (currentStep.value < 4) {
    currentStep.value++
    if (currentStep.value === 2 && !locationLat.value) {
      getLocation()
    }
    return
  }

  // 提交
  uni.showLoading({ title: '提交中...' })
  try {
    await apiReportEvent({
      event_type: 'report',
      species: selectedSpecies.value,
      location_lat: locationLat.value!,
      location_lng: locationLng.value!,
      address: locationText.value,
      description: description.value || undefined,
      photos: photoUrls.value,
    })
    uni.hideLoading()
    showSuccess.value = true
  } catch (e: any) {
    uni.hideLoading()
    if (!e.code) {
      uni.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
    }
  }
}

function goToMyReports() {
  uni.switchTab({ url: '/pages/user/index' })
  setTimeout(() => {
    uni.navigateTo({ url: '/pages/my-reports/index' })
  }, 100)
}

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

// 初始化获取位置
getLocation()
</script>
```

- [ ] **Step 3: Write style section**

```scss
<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 160rpx;
}

.guide-header {
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
  padding: 48rpx 32rpx 32rpx;
  display: flex;
  align-items: center;
}

.title-main {
  font-size: 40rpx;
  font-weight: 700;
  color: #FFFFFF;
  display: block;
}

.title-sub {
  font-size: 24rpx;
  color: rgba(255,255,255,0.8);
  display: block;
  margin-top: 8rpx;
}

.steps-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background: #FFFFFF;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.step-circle {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #E0E0E0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.step-item.active .step-circle { background: #FF6B6B; }
.step-item.completed .step-circle { background: #E53A3A; }

.step-text {
  font-size: 20rpx;
  color: #999999;
  margin-top: 8rpx;
}

.step-item.active .step-text { color: #FF6B6B; font-weight: 600; }

.step-line {
  position: absolute;
  top: 28rpx;
  left: 70rpx;
  width: 120rpx;
  height: 4rpx;
  background: #E0E0E0;
}

.step-line.filled { background: #FF6B6B; }

.section {
  margin: 24rpx;
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 32rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1A1A1A;
  display: block;
  margin-bottom: 8rpx;
}

.section-hint {
  font-size: 24rpx;
  color: #999999;
  display: block;
  margin-bottom: 24rpx;
}

.species-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24rpx;
}

.species-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx;
  background: #F5F5F5;
  border-radius: 16rpx;
  border: 4rpx solid transparent;
  transition: all 0.2s;
}

.species-card.selected {
  border-color: #FF6B6B;
  background: #FFF0F0;
}

.species-icon {
  width: 80rpx;
  height: 80rpx;
  margin-bottom: 12rpx;
  background: #FFF0F0;
  border-radius: 50%;
}

.species-name {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 600;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12rpx;
  overflow: hidden;
}

.photo-img {
  width: 100%;
  height: 100%;
}

.photo-remove {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 40rpx;
  height: 40rpx;
  background: rgba(0,0,0,0.5);
  color: #FFFFFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}

.photo-add {
  aspect-ratio: 1;
  border: 2rpx dashed #DDDDDD;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.add-icon {
  font-size: 48rpx;
  color: #DDDDDD;
}

.add-text {
  font-size: 22rpx;
  color: #AAAAAA;
  margin-top: 8rpx;
}

.location-display {
  display: flex;
  align-items: center;
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.location-icon-img {
  width: 40rpx;
  height: 40rpx;
  margin-right: 16rpx;
}

.location-info { flex: 1; }

.location-text {
  font-size: 26rpx;
  color: #1A1A1A;
  display: block;
}

.location-coords {
  font-size: 22rpx;
  color: #999999;
  display: block;
  margin-top: 4rpx;
}

.location-refresh {
  font-size: 24rpx;
  color: #FF6B6B;
  padding: 8rpx 16rpx;
}

.location-actions {
  display: flex;
  gap: 16rpx;
}

.btn-locate, .btn-manual {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.btn-locate {
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
  color: #FFFFFF;
}

.btn-manual {
  background: #F5F5F5;
  color: #666666;
}

.description-input {
  width: 100%;
  min-height: 200rpx;
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  color: #1A1A1A;
  box-sizing: border-box;
}

.input-placeholder { color: #AAAAAA; }

.confirm-card {
  background: #FAFAFA;
  border-radius: 12rpx;
  padding: 24rpx;
}

.confirm-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #F0F0F0;
}

.confirm-item:last-child { border-bottom: none; }

.confirm-label {
  font-size: 26rpx;
  color: #666666;
  flex-shrink: 0;
}

.confirm-value {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 600;
  max-width: 65%;
  text-align: right;
}

.confirm-photos {
  display: flex;
  gap: 8rpx;
}

.confirm-thumb {
  width: 80rpx;
  height: 80rpx;
  border-radius: 8rpx;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx 48rpx;
  background: #FFFFFF;
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.06);
}

.btn-back {
  flex: 1;
  background: #F5F5F5;
  color: #666666;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.btn-next {
  flex: 2;
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
  color: #FFFFFF;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(255,107,107,0.3);
}

.btn-next.disabled {
  background: #CCCCCC;
  box-shadow: none;
}

.success-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.success-content {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  width: 600rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.success-icon {
  font-size: 80rpx;
  color: #07C160;
  margin-bottom: 16rpx;
}

.success-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1A1A1A;
  margin-bottom: 12rpx;
}

.success-desc {
  font-size: 26rpx;
  color: #666666;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 32rpx;
}

.success-actions {
  display: flex;
  gap: 16rpx;
  width: 100%;
}

.btn-view, .btn-home {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.btn-view {
  background: #F5F5F5;
  color: #666666;
}

.btn-home {
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
  color: #FFFFFF;
}
</style>
```

- [ ] **Step 4: Commit**

```bash
cd F:/swcup2026/miniapp-user
git add src/pages/report/index.vue
git commit -m "feat(report): add stray animal report page"
```

---

## Task 5: 前端 - 注册 report 路由并加入底部 Tab

**Files:**
- Modify: `miniapp-user/src/pages.json:1-147`

- [ ] **Step 1: Read current pages.json**

确认当前 pages.json 内容（已知结构，见上面 context）。

- [ ] **Step 2: Add report page entry after collect/result entry**

在 `pages` 数组中添加（位置约在 line 75-83 之间，collect/result 之后）：

```json
{
  "path": "pages/report/index",
  "style": {
    "navigationBarTitleText": "发现上报",
    "navigationBarBackgroundColor": "#FFFFFF",
    "navigationBarTextStyle": "black"
  }
},
```

- [ ] **Step 3: Modify tabBar.list — add 发现 tab**

找到 `tabBar.list`（约 line 131-143），修改为：

```json
"list": [
  {
    "pagePath": "pages/index/index",
    "text": "首页",
    "iconPath": "static/tab-home.png",
    "selectedIconPath": "static/tab-home-active.png"
  },
  {
    "pagePath": "pages/report/index",
    "text": "发现",
    "iconPath": "static/tab-find.png",
    "selectedIconPath": "static/tab-find-active.png"
  },
  {
    "pagePath": "pages/user/index",
    "text": "我的",
    "iconPath": "static/tab-user.png",
    "selectedIconPath": "static/tab-user-active.png"
  }
]
```

> 注意：如果 `static/` 目录下没有 `tab-find.png` 和 `tab-find-active.png`，先用 `tab-home.png` 复制两份作为占位图。

- [ ] **Step 4: Commit**

```bash
cd F:/swcup2026/miniapp-user
git add src/pages.json
git commit -m "feat(report): register route and add discover tab"
```

---

## Task 6: 前端 - 采集页 index.vue GPS 0 禁止提交

**Files:**
- Modify: `miniapp-user/src/pages/collect/index.vue:436-489`

- [ ] **Step 1: Read onNext function**

当前 `onNext()` 函数约在 line 436-489，其中提交逻辑约 line 447-464：

```typescript
// 提交采集
uni.showLoading({ title: '采集中...' })

try {
  const collectRes: any = await apiNoseCollect({
    nose_photo: nosePhotoBase64.value,
    species: selectedSpecies.value,
    animal_id: null,
    location_lat: locationLat.value ?? 0,
    location_lng: locationLng.value ?? 0,
    // ...
  })
```

- [ ] **Step 2: Add GPS validation before submit**

在 `uni.showLoading` 之前添加：

```typescript
// GPS 校验：禁止使用 (0,0) 默认值
if (!locationLat.value || !locationLng.value || locationLat.value === 0 || locationLng.value === 0) {
  uni.showToast({ title: '请提供有效的位置信息', icon: 'none' })
  return
}
```

- [ ] **Step 3: Commit**

```bash
cd F:/swcup2026/miniapp-user
git add src/pages/collect/index.vue
git commit -m "fix(collect): prevent submission with invalid GPS coordinates"
```

---

## Task 7: 验证

- [ ] **Step 1: 启动后端**

```bash
cd F:/swcup2026/backend && npm run start:dev
```

- [ ] **Step 2: 打开发现页**

微信开发者工具 → 编译运行 → 底部 Tab 点击「发现」→ 应显示 report/index.vue 页面

- [ ] **Step 3: 测试位置获取失败流程**

在 report/index 页面，刻意不授权定位，点击下一步应提示"请先获取位置信息"

- [ ] **Step 4: 测试完整提交流程**

填写所有必填字段后提交 → 应出现成功弹窗 → 事件进入 pending 状态

- [ ] **Step 5: 测试管理员审核**

管理员登录 miniapp-admin → 进入审核页 → 确认刚才的上报事件 → 应自动创建 Animal 档案 → 用户端首页应出现该动物

- [ ] **Step 6: 测试采集页 GPS 校验**

进入采集页（pages/collect/index）→ 不获取 GPS 直接提交 → 应提示"请提供有效的位置信息"