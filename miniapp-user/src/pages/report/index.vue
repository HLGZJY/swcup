<template>
  <view class="page">
    <!-- 顶部引导区 -->
    <view class="guide-header">
      <view class="guide-title">
        <text class="title-main">流浪动物上报</text>
        <text class="title-sub">提供线索，帮助它们回家</text>
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
          @click="onSelectSpecies(spec.value)"
        >
          <image class="species-icon" :src="spec.icon" mode="aspectFit" />
          <text class="species-name">{{ spec.label }}</text>
        </view>
      </view>
    </view>

    <!-- Step 1: 拍摄照片 -->
    <view class="section" v-show="currentStep === 1">
      <text class="section-title">拍摄照片</text>
      <text class="section-hint">请上传 1-3 张照片</text>

      <view class="photo-grid">
        <view
          v-for="(photo, index) in photos"
          :key="index"
          class="photo-item"
        >
          <image class="photo-img" :src="photo" mode="aspectFill" />
          <view class="photo-remove" @click="onRemovePhoto(index)">
            <text class="remove-icon">×</text>
          </view>
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

    <!-- Step 2: 获取 GPS 位置 -->
    <view class="section" v-show="currentStep === 2">
      <text class="section-title">获取位置</text>
      <text class="section-hint">请提供发现流浪动物的位置</text>

      <view class="location-box" @click="onManualSelect">
        <view class="location-icon-wrap">
          <image class="location-icon" src="/static/mock/location-icon.png" mode="aspectFit" @error="onLocationIconError" />
        </view>
        <view class="location-info">
          <text class="location-text">{{ locationText }}</text>
          <text class="location-tip">点击重新选择位置</text>
        </view>
      </view>
    </view>

    <!-- Step 3: 填写描述 -->
    <view class="section" v-show="currentStep === 3">
      <text class="section-title">填写描述</text>
      <text class="section-hint">描述该动物的特征（可选）</text>

      <textarea
        class="description-input"
        v-model="description"
        placeholder="例如：黄色柴犬，左耳有伤，右后腿行动不便..."
        placeholder-class="textarea-placeholder"
        maxlength="500"
      />
      <text class="char-count">{{ description.length }}/500</text>
    </view>

    <!-- Step 4: 确认提交 -->
    <view class="section" v-show="currentStep === 4">
      <text class="section-title">确认提交</text>

      <view class="confirm-card">
        <view class="confirm-item">
          <text class="confirm-label">物种</text>
          <text class="confirm-value">{{ speciesLabel }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">照片</text>
          <view class="confirm-photos">
            <image
              v-for="(photo, index) in photos"
              :key="index"
              class="confirm-photo-thumb"
              :src="photo"
              mode="aspectFill"
            />
          </view>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">位置</text>
          <text class="confirm-value">{{ locationText }}</text>
        </view>
        <view class="confirm-item">
          <text class="confirm-label">描述</text>
          <text class="confirm-value">{{ description || '未填写' }}</text>
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
        <text>{{ currentStep < 4 ? '下一步' : '确认上报' }}</text>
      </view>
    </view>

    <!-- 成功弹窗 -->
    <view class="success-modal" v-if="showSuccess" @click="showSuccess = false">
      <view class="success-content" @click.stop>
        <view class="success-icon-wrap">
          <text class="success-icon">✓</text>
        </view>
        <text class="success-title">上报成功</text>
        <text class="success-subtitle">感谢您提供线索，我们将尽快处理</text>
        <view class="success-btns">
          <view class="btn-view-reports" @click="goToMyReports">
            <text>查看我的上报</text>
          </view>
          <view class="btn-go-home" @click="goHome">
            <text>返回首页</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { apiUploadFile, apiReportEvent } from '@/services/api'

const currentStep = ref(0)
const selectedSpecies = ref('dog')
const photos = ref<string[]>([])
const photoUrls = ref<string[]>([])
const description = ref('')
const locationText = ref('定位中...')
const locationLat = ref<number | null>(null)
const locationLng = ref<number | null>(null)
const showSuccess = ref(false)

const steps = ['选择物种', '拍摄照片', '获取位置', '填写描述', '确认提交']

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
  if (currentStep.value === 3) return true
  return true
})

function getLocation() {
  uni.getLocation({
    type: 'gcj02',
    success: (res) => {
      locationLat.value = res.latitude
      locationLng.value = res.longitude
      locationText.value = `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`
    },
    fail: () => {
      locationText.value = '定位失败'
      uni.showToast({ title: '定位失败，请手动选择位置', icon: 'none' })
    }
  })
}

function onManualSelect() {
  uni.chooseLocation({
    success: (res) => {
      locationLat.value = res.latitude
      locationLng.value = res.longitude
      locationText.value = res.address || `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`
    },
    fail: () => {
      uni.showToast({ title: '请允许位置权限', icon: 'none' })
    }
  })
}

function onLocationIconError() {
  // 占位图标加载失败时隐藏
}

function onSelectSpecies(value: string) {
  selectedSpecies.value = value
}

async function onAddPhoto() {
  const remaining = 3 - photos.value.length
  if (remaining <= 0) return

  uni.chooseImage({
    count: remaining,
    sourceType: ['camera', 'album'],
    success: async (res) => {
      for (const filePath of res.tempFilePaths) {
        photos.value.push(filePath)
        try {
          const uploadedUrl = await apiUploadFile(filePath)
          photoUrls.value.push(uploadedUrl)
        } catch (e) {
          console.error('[onAddPhoto] upload failed', e)
        }
      }
    },
    fail: () => {
      uni.showToast({ title: '请允许相机/相册权限', icon: 'none' })
    }
  })
}

function onRemovePhoto(index: number) {
  photos.value.splice(index, 1)
  photoUrls.value.splice(index, 1)
}

function onBack() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

async function onNext() {
  if (!canNext.value) {
    if (currentStep.value === 1) {
      uni.showToast({ title: '请至少上传一张照片', icon: 'none' })
    } else if (currentStep.value === 2) {
      uni.showToast({ title: '请先获取位置', icon: 'none' })
    }
    return
  }

  if (currentStep.value < 4) {
    currentStep.value++
    return
  }

  // 提交上报
  uni.showLoading({ title: '提交中...' })

  try {
    await apiReportEvent({
      event_type: 'report',
      species: selectedSpecies.value,
      location_lat: locationLat.value ?? 0,
      location_lng: locationLng.value ?? 0,
      address: locationText.value,
      description: description.value,
      photos: photoUrls.value
    })

    uni.hideLoading()
    showSuccess.value = true
  } catch (e: any) {
    uni.hideLoading()
    if (!e.code) {
      uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
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

// 初始化定位
getLocation()
</script>

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
  justify-content: space-between;
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

.step-item.active .step-circle {
  background: #FF6B6B;
}

.step-item.completed .step-circle {
  background: #E53A3A;
}

.step-text {
  font-size: 20rpx;
  color: #999999;
  margin-top: 8rpx;
}

.step-item.active .step-text {
  color: #FF6B6B;
  font-weight: 600;
}

.step-line {
  position: absolute;
  top: 28rpx;
  left: 70rpx;
  width: 120rpx;
  height: 4rpx;
  background: #E0E0E0;
}

.step-line.filled {
  background: #FF6B6B;
}

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
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-icon {
  color: #FFFFFF;
  font-size: 32rpx;
  line-height: 1;
}

.photo-add {
  aspect-ratio: 1;
  background: #F5F5F5;
  border-radius: 12rpx;
  border: 4rpx dashed #CCCCCC;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.add-icon {
  font-size: 48rpx;
  color: #CCCCCC;
  line-height: 1;
}

.add-text {
  font-size: 22rpx;
  color: #AAAAAA;
  margin-top: 8rpx;
}

.location-box {
  display: flex;
  align-items: center;
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 24rpx;
}

.location-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  background: #FFF0F0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.location-icon {
  width: 40rpx;
  height: 40rpx;
}

.location-info {
  flex: 1;
}

.location-text {
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 600;
  display: block;
}

.location-tip {
  font-size: 22rpx;
  color: #AAAAAA;
  display: block;
  margin-top: 4rpx;
}

.description-input {
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #1A1A1A;
  min-height: 200rpx;
  width: 100%;
  box-sizing: border-box;
}

.textarea-placeholder {
  color: #AAAAAA;
}

.char-count {
  font-size: 22rpx;
  color: #AAAAAA;
  text-align: right;
  display: block;
  margin-top: 8rpx;
}

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

.confirm-item:last-child {
  border-bottom: none;
}

.confirm-label {
  font-size: 26rpx;
  color: #666666;
  flex-shrink: 0;
}

.confirm-value {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 600;
  margin-left: 16rpx;
  text-align: right;
  flex: 1;
}

.confirm-photos {
  display: flex;
  gap: 8rpx;
  margin-left: 16rpx;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.confirm-photo-thumb {
  width: 60rpx;
  height: 60rpx;
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
  z-index: 999;
}

.success-content {
  width: 600rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 48rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.success-icon-wrap {
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.success-icon {
  font-size: 60rpx;
  color: #FFFFFF;
}

.success-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1A1A1A;
  display: block;
  margin-bottom: 12rpx;
}

.success-subtitle {
  font-size: 26rpx;
  color: #666666;
  text-align: center;
  display: block;
  margin-bottom: 32rpx;
}

.success-btns {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.btn-view-reports {
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
  color: #FFFFFF;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.btn-go-home {
  background: #F5F5F5;
  color: #666666;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
}
</style>