<template>
  <view class="page">
    <!-- 动物信息卡片 -->
    <view class="animal-card" v-if="animal">
      <image class="animal-photo" :src="animal.photos[0] || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
      <view class="animal-info">
        <text class="animal-breed">{{ animal.breed }}</text>
        <text class="animal-color">{{ animal.color }}</text>
        <text class="animal-address">{{ animal.address }}</text>
      </view>
    </view>

    <!-- 认领说明 -->
    <view class="notice-box">
      <text class="notice-title">📋 认领须知</text>
      <view class="notice-item" v-for="item in notices" :key="item">
        <text class="bullet">•</text>
        <text class="notice-text">{{ item }}</text>
      </view>
    </view>

    <!-- 认领表单 -->
    <view class="form-section">
      <text class="form-title">认领信息</text>

      <!-- 手机号 -->
      <view class="form-item">
        <text class="form-label">手机号 <text class="required">*</text></text>
        <input class="form-input" v-model="form.phone" type="number" placeholder="请输入您的手机号" maxlength="11" />
      </view>

      <!-- 认领说明 -->
      <view class="form-item">
        <text class="form-label">认领说明 <text class="required">*</text></text>
        <textarea
          class="form-textarea"
          v-model="form.description"
          placeholder="请描述您与该动物的关系、如何确认它是您的宠物、是否有照片/视频/项圈等证明材料..."
          maxlength="500"
        />
        <text class="char-count">{{ form.description.length }}/500</text>
      </view>
    </view>

    <!-- 证明材料上传 -->
    <view class="form-section">
      <text class="form-title">证明材料</text>
      <text class="form-subtitle">上传能够证明您是动物主人的材料，如合照、疫苗本、项圈照片等</text>

      <view class="upload-grid">
        <view
          v-for="(img, idx) in form.proof_photos"
          :key="idx"
          class="upload-item"
        >
          <image class="upload-img" :src="img" mode="aspectFill" />
          <view class="upload-remove" @click="removePhoto(idx)">✕</view>
        </view>
        <view class="upload-add" @click="chooseImage" v-if="form.proof_photos.length < 9">
          <text class="add-icon">+</text>
          <text class="add-text">添加照片</text>
        </view>
      </view>
    </view>

    <!-- 协议确认 -->
    <view class="agreement-row" @click="form.agreed = !form.agreed">
      <view :class="['checkbox', { checked: form.agreed }]">
        <text v-if="form.agreed">✓</text>
      </view>
      <text class="agreement-text">
        我已阅读并同意<text class="link" @click.stop="showProtocol">《认领协议》</text>，承诺所填信息真实有效
      </text>
    </view>

    <!-- 提交按钮 -->
    <view class="submit-bar">
      <view :class="['btn-submit', { disabled: !canSubmit }]" @click="onSubmit">
        <text>提交认领申请</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiGetAnimalDetail, apiSubmitClaim } from '@/services/api'

const animal = ref<any>(null)
const eventId = ref('')
const form = ref({
  phone: '',
  description: '',
  proof_photos: [] as string[],
  agreed: false
})

const notices = [
  '认领申请提交后，将由管理员进行审核',
  '请确保填写的联系方式真实有效',
  '审核结果将通过短信/小程序通知您',
  '如有疑问请联系官方客服'
]

const canSubmit = computed(() => {
  return form.value.phone.length === 11 &&
    form.value.description.length >= 10 &&
    form.value.agreed
})

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const { animal_id, event_id } = currentPage?.options || {}

  if (animal_id) {
    try {
      const res: any = await apiGetAnimalDetail(animal_id)
      animal.value = res.data
    } catch (e) {
      // animal not found, ignore
    }
  }

  eventId.value = event_id || ''
})

function chooseImage() {
  uni.chooseImage({
    count: 9 - form.value.proof_photos.length,
    sourceType: ['album', 'camera'],
    success: (res) => {
      form.value.proof_photos = [...form.value.proof_photos, ...res.tempFilePaths]
    }
  })
}

function removePhoto(idx: number) {
  form.value.proof_photos.splice(idx, 1)
}

function showProtocol() {
  uni.showModal({
    title: '认领协议',
    content: '1. 申请人承诺所提交的信息真实有效\n2. 如发现虚假认领，将承担相应法律责任\n3. 管理员有权驳回不合规的认领申请\n4. 认领成功后，动物档案将更新为您名下',
    showCancel: false
  })
}

async function onSubmit() {
  if (!canSubmit.value) return

  uni.showLoading({ title: '提交中...' })
  try {
    const res: any = await apiSubmitClaim({
      animal_id: animal.value?.animal_id,
      event_id: eventId.value || null,
      notes: form.value.description,
      contact_method: 'phone',
      contact_value: form.value.phone
    })

    uni.hideLoading()
    uni.showToast({ title: '提交成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/user/index' })
    }, 1500)
  } catch (e: any) {
    uni.hideLoading()
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
  padding: 24rpx 24rpx 200rpx;
}

.animal-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}

.animal-photo {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  margin-right: 20rpx;
  background: #E8FDF8;
}

.animal-info {
  flex: 1;
}

.animal-breed {
  font-size: 30rpx;
  font-weight: 600;
  color: #1A1A1A;
  display: block;
}

.animal-color {
  font-size: 24rpx;
  color: #666666;
  display: block;
  margin-top: 4rpx;
}

.animal-address {
  font-size: 22rpx;
  color: #999999;
  display: block;
  margin-top: 4rpx;
}

.notice-box {
  background: #FFF8E8;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.notice-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #FF9F00;
  display: block;
  margin-bottom: 12rpx;
}

.notice-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8rpx;
}

.bullet {
  color: #FF9F00;
  margin-right: 8rpx;
}

.notice-text {
  font-size: 24rpx;
  color: #666666;
  flex: 1;
}

.form-section {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
}

.form-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1A1A1A;
  display: block;
  margin-bottom: 8rpx;
}

.form-subtitle {
  font-size: 24rpx;
  color: #999999;
  display: block;
  margin-bottom: 24rpx;
}

.form-item {
  margin-bottom: 28rpx;
}

.form-label {
  font-size: 26rpx;
  color: #1A1A1A;
  display: block;
  margin-bottom: 12rpx;
}

.required {
  color: #E53A3A;
}

.form-input {
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #1A1A1A;
}

.form-textarea {
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #1A1A1A;
  width: 100%;
  height: 200rpx;
  box-sizing: border-box;
}

.char-count {
  font-size: 22rpx;
  color: #999999;
  text-align: right;
  margin-top: 8rpx;
}

.relation-grid {
  display: flex;
  gap: 16rpx;
}

.relation-chip {
  background: #F5F5F5;
  padding: 16rpx 32rpx;
  border-radius: 40rpx;
  font-size: 26rpx;
  color: #666666;
  border: 4rpx solid transparent;
}

.relation-chip.selected {
  background: #E8FDF8;
  color: #0FBF9F;
  border-color: #0FBF9F;
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.upload-item {
  position: relative;
  aspect-ratio: 1;
}

.upload-img {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
}

.upload-remove {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  width: 40rpx;
  height: 40rpx;
  background: rgba(0,0,0,0.6);
  color: #FFFFFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}

.upload-add {
  aspect-ratio: 1;
  background: #F5F5F5;
  border-radius: 12rpx;
  border: 2rpx dashed #DDDDDD;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.add-icon {
  font-size: 48rpx;
  color: #CCCCCC;
}

.add-text {
  font-size: 22rpx;
  color: #999999;
  margin-top: 8rpx;
}

.agreement-row {
  display: flex;
  align-items: center;
  padding: 24rpx;
  background: #FFFFFF;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
}

.checkbox {
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid #CCCCCC;
  border-radius: 8rpx;
  margin-right: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.checkbox.checked {
  background: #0FBF9F;
  border-color: #0FBF9F;
  color: #FFFFFF;
  font-size: 24rpx;
}

.agreement-text {
  font-size: 24rpx;
  color: #666666;
  flex: 1;
}

.link {
  color: #0FBF9F;
}

.submit-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx 48rpx;
  background: #FFFFFF;
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.06);
}

.btn-submit {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
}

.btn-submit.disabled {
  background: #CCCCCC;
  box-shadow: none;
}
</style>
