<template>
  <view class="page">
    <!-- 顶部引导区 -->
    <view class="guide-header">
      <view class="guide-title">
        <text class="title-main">鼻纹采集</text>
        <text class="title-sub">为你的宠物建立唯一身份档案</text>
      </view>
      <!-- 鼻纹示意 -->
      <view class="nose-preview">
        <image class="nose-icon" src="/static/mock/nose-guide.png" mode="aspectFit" @error="onImageError" />
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

    <!-- 物种选择 -->
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

    <!-- 拍摄引导 -->
    <view class="section" v-show="currentStep === 1">
      <text class="section-title">拍摄鼻纹</text>

      <!-- 相机区域 -->
      <view class="camera-area" @click="onOpenCamera">
        <image
          v-if="!nosePhoto"
          class="camera-placeholder"
          src="/static/mock/camera-guide.png"
          mode="aspectFit"
        />
        <image
          v-else
          class="captured-photo"
          :src="nosePhoto"
          mode="aspectFill"
        />
        <view class="camera-overlay" v-if="!nosePhoto">
          <text class="camera-text">点击拍摄鼻纹照片</text>
          <view class="nose-outline">
            <view class="outline-ring"></view>
            <text class="outline-hint">将鼻子置于框内</text>
          </view>
        </view>
        <view class="retake-btn" v-if="nosePhoto" @click.stop="onRetake">
          <text>重新拍摄</text>
        </view>
      </view>

      <!-- 拍摄提示 -->
      <view class="tips-box">
        <view class="tips-title">
          <image class="tips-title-icon" src="/static/icons/icon-camera.png" mode="aspectFit" />
          <text>拍摄技巧</text>
        </view>
        <view class="tip-item" v-for="tip in tips" :key="tip">
          <text class="tip-bullet">•</text>
          <text class="tip-text">{{ tip }}</text>
        </view>
      </view>
    </view>

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

    <!-- 确认提交 -->
    <view class="section" v-show="currentStep === 3">
      <text class="section-title">确认信息</text>

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

      <!-- 质量评估 -->
      <view class="quality-card" v-if="collectResult">
        <text class="quality-title">采集质量评估</text>
        <view class="quality-row">
          <text>置信度</text>
          <view class="quality-bar-bg">
            <view class="quality-bar-fill" :style="{ width: (collectResult.confidence_score * 100) + '%' }"></view>
          </view>
          <text class="quality-percent">{{ (collectResult.confidence_score * 100).toFixed(0) }}%</text>
        </view>
        <view class="quality-row">
          <text>活体检测</text>
          <text :class="['liveness-tag', collectResult.liveness_passed ? 'pass' : 'fail']">
            {{ collectResult.liveness_passed ? '通过 ✓' : '未通过 ✗' }}
          </text>
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
        <text v-if="currentStep < 3">{{ currentStep === 1 && !nosePhoto ? '上传鼻纹' : '下一步' }}</text>
        <text v-else>开始比对</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { apiNoseCollect } from '@/services/api'

const currentStep = ref(0)
const selectedSpecies = ref('dog')
const nosePhoto = ref('')
const nosePhotoBase64 = ref('') // Base64 格式用于上传
const locationText = ref('定位中...')
const collectResult = ref<any>(null)
const locationLat = ref<number | null>(null)
const locationLng = ref<number | null>(null)

const breed = ref('')
const color = ref('')
const gender = ref('unknown')
const genderOptions = [
  { value: 'unknown', label: '未知' },
  { value: 'male', label: '公' },
  { value: 'female', label: '母' },
]
const genderLabel = computed(() => {
  return genderOptions.find(g => g.value === gender.value)?.label || '未知'
})

const steps = ['选择物种', '拍摄鼻纹', '填写信息', '确认提交']
const tips = [
  '保持光线充足，避免强烈反光',
  '鼻头正对镜头，距离10-20cm',
  '确保鼻纹纹路清晰可见',
  '避免拍摄到嘴唇或毛发干扰'
]

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
  if (currentStep.value === 1) return !!nosePhoto.value
  if (currentStep.value === 2) return true  // 新步骤，允许空
  return true
})

// 获取位置（gcj02 坐标系，与腾讯/高德地图一致）
function getLocation() {
  uni.getLocation({
    type: 'gcj02',
    success: (res) => {
      locationLat.value = res.latitude
      locationLng.value = res.longitude
      locationText.value = `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`
    },
    fail: (err) => {
      console.error('GPS 获取失败', err)
      locationText.value = '定位失败，请开启位置权限'
      uni.showToast({
        title: '需要定位权限才能记录救助位置',
        icon: 'none',
        duration: 3000
      })
    }
  })
}

getLocation()

function onSelectSpecies(value: string) {
  selectedSpecies.value = value
  uni.setStorageSync('selectedSpecies', value)
}

function onImageError(e: any) {
  // 占位图加载失败时隐藏
}

/**
 * 图片压缩 + 转 Base64
 * 大小上限 5MB，超过则压缩到质量 0.8，宽高 ≤ 1024px
 */
function fileToBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.getFileInfo({
      filePath,
      success: (info) => {
        const sizeMB = info.size / 1024 / 1024
        if (sizeMB <= 5) {
          // 不超过5MB，直接转 Base64
          uni.getFileSystemManager().readFile({
            filePath,
            encoding: 'base64',
            success: (res) => {
              resolve('data:image/jpeg;base64,' + res.data)
            },
            fail: reject
          })
        } else {
          // 超过5MB，需要压缩
          uni.compressImage({
            src: filePath,
            quality: 80,
            success: (compressRes) => {
              uni.getFileSystemManager().readFile({
                filePath: compressRes.tempFilePath,
                encoding: 'base64',
                success: (res2) => {
                  resolve('data:image/jpeg;base64,' + res2.data)
                },
                fail: reject
              })
            },
            fail: reject
          })
        }
      },
      fail: reject
    })
  })
}

function onOpenCamera() {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0]
      nosePhoto.value = filePath // 用于本地预览

      uni.showLoading({ title: '处理图片...' })
      try {
        nosePhotoBase64.value = await fileToBase64(filePath)
      } catch (e) {
        uni.hideLoading()
        uni.showToast({ title: '图片处理失败', icon: 'none' })
        return
      }
      uni.hideLoading()
    },
    fail: () => {
      uni.showToast({ title: '请允许相机权限', icon: 'none' })
    }
  })
}

function onRetake() {
  nosePhoto.value = ''
  nosePhotoBase64.value = ''
}

function onBack() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

async function onNext() {
  if (currentStep.value < 2) {
    currentStep.value++
    return
  }

  if (!nosePhotoBase64.value) {
    uni.showToast({ title: '请先拍摄鼻纹照片', icon: 'none' })
    return
  }

  // 提交采集
  uni.showLoading({ title: '采集中...' })

  try {
    const collectRes: any = await apiNoseCollect({
      nose_photo: nosePhotoBase64.value,
      species: selectedSpecies.value,
      animal_id: null,
      location_lat: locationLat.value ?? 0,
      location_lng: locationLng.value ?? 0,
      device_id: 'miniapp_user',
      timestamp: new Date().toISOString()
    })

    collectResult.value = collectRes.data
    // 后端返回 vector_id，前端用 nose_id 作参数名（后端已兼容）
    const noseId = collectRes.data.vector_id || collectRes.data.nose_id
    uni.setStorageSync('vector_id', noseId)

    uni.hideLoading()
    uni.showToast({ title: '采集成功', icon: 'success' })

    // 跳转到结果页
    setTimeout(() => {
      uni.navigateTo({
        url: `/pages/collect/result?nose_id=${noseId}&species=${selectedSpecies.value}&breed=${encodeURIComponent(breed.value)}&color=${encodeURIComponent(color.value)}&gender=${encodeURIComponent(gender.value)}`
      })
    }, 1000)
  } catch (e: any) {
    uni.hideLoading()
    // 错误已由拦截器处理，这里只做兜底提示
    if (!e.code) {
      uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
    }
  }
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 160rpx;
}

.guide-header {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
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

.nose-preview {
  width: 120rpx;
  height: 120rpx;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nose-icon {
  width: 80rpx;
  height: 80rpx;
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
  background: #0FBF9F;
}

.step-item.completed .step-circle {
  background: #07C160;
}

.step-text {
  font-size: 20rpx;
  color: #999999;
  margin-top: 8rpx;
}

.step-item.active .step-text {
  color: #0FBF9F;
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
  background: #0FBF9F;
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
  border-color: #0FBF9F;
  background: #E8FDF8;
}

.species-icon {
  width: 80rpx;
  height: 80rpx;
  margin-bottom: 12rpx;
  background: #E8FDF8;
  border-radius: 50%;
}

.species-name {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 600;
}

.camera-area {
  position: relative;
  height: 400rpx;
  background: #1A1A1A;
  border-radius: 16rpx;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-placeholder {
  width: 200rpx;
  height: 200rpx;
  opacity: 0.3;
}

.captured-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.camera-text {
  font-size: 28rpx;
  color: #FFFFFF;
  background: rgba(0,0,0,0.5);
  padding: 12rpx 24rpx;
  border-radius: 40rpx;
}

.nose-outline {
  margin-top: 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.outline-ring {
  width: 180rpx;
  height: 180rpx;
  border: 4rpx dashed rgba(255,255,255,0.6);
  border-radius: 50%;
}

.outline-hint {
  font-size: 22rpx;
  color: rgba(255,255,255,0.6);
  margin-top: 12rpx;
}

.retake-btn {
  position: absolute;
  bottom: 24rpx;
  right: 24rpx;
  background: rgba(0,0,0,0.6);
  color: #FFFFFF;
  font-size: 24rpx;
  padding: 12rpx 24rpx;
  border-radius: 40rpx;
}

.tips-box {
  margin-top: 24rpx;
  background: #FFF8E8;
  border-radius: 12rpx;
  padding: 20rpx;
}

.tips-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #FF9F00;
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.tips-title-icon {
  width: 28rpx;
  height: 28rpx;
  margin-right: 8rpx;
  flex-shrink: 0;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8rpx;
}

.tip-bullet {
  color: #FF9F00;
  margin-right: 8rpx;
}

.tip-text {
  font-size: 24rpx;
  color: #666666;
  flex: 1;
}

.confirm-card {
  background: #FAFAFA;
  border-radius: 12rpx;
  padding: 24rpx;
}

.confirm-item {
  display: flex;
  align-items: center;
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
}

.confirm-value {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 600;
}

.confirm-value.danger {
  color: #E53A3A;
}

.confirm-nose-thumb {
  width: 80rpx;
  height: 80rpx;
  border-radius: 8rpx;
}

.quality-card {
  margin-top: 24rpx;
  background: #E8FDF8;
  border-radius: 12rpx;
  padding: 24rpx;
}

.quality-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #0FBF9F;
  display: block;
  margin-bottom: 16rpx;
}

.quality-row {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
  font-size: 24rpx;
  color: #1A1A1A;
}

.quality-row text:first-child {
  width: 140rpx;
}

.quality-bar-bg {
  flex: 1;
  height: 12rpx;
  background: rgba(15, 191, 159, 0.2);
  border-radius: 6rpx;
  margin-right: 12rpx;
}

.quality-bar-fill {
  height: 100%;
  background: #0FBF9F;
  border-radius: 6rpx;
}

.quality-percent {
  width: 80rpx;
  text-align: right;
  color: #0FBF9F;
  font-weight: 600;
}

.liveness-tag {
  font-size: 24rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}

.liveness-tag.pass {
  background: #07C160;
  color: #FFFFFF;
}

.liveness-tag.fail {
  background: #E53A3A;
  color: #FFFFFF;
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
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
}

.btn-next.disabled {
  background: #CCCCCC;
  box-shadow: none;
}

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
</style>
