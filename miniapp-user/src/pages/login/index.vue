<template>
  <view class="page">
    <!-- 品牌区 -->
    <view class="brand-section">
      <view class="brand-logo">
        <text class="logo-icon">🐾</text>
      </view>
      <text class="brand-name">鼻纹智救</text>
      <text class="brand-slogan">AI 流浪动物 · 防重复救助</text>
    </view>

    <!-- 登录表单 -->
    <view class="login-form">
      <!-- 微信头像选择 -->
      <view class="avatar-section" @click="onChooseAvatar">
        <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onAvatarChoose">
          <image
            v-if="avatarUrl"
            class="avatar-img"
            :src="avatarUrl"
            mode="aspectFill"
          />
          <view v-else class="avatar-placeholder">
            <text class="avatar-add-icon">+</text>
          </view>
        </button>
        <text class="avatar-hint">点击选择微信头像</text>
      </view>

      <!-- 昵称输入 -->
      <view class="form-item">
        <text class="form-label">昵称</text>
        <input
          type="nickname"
          class="form-input"
          placeholder="请输入昵称"
          v-model="nickname"
          @blur="onNicknameBlur"
        />
      </view>

      <!-- 手机号（可选） -->
      <view class="form-item">
        <text class="form-label">手机号 <text class="optional-tag">选填</text></text>
        <input
          type="number"
          class="form-input"
          placeholder="用于接收认领通知"
          v-model="phone"
          maxlength="11"
        />
      </view>

      <!-- 协议 -->
      <view class="agreement-row">
        <view
          :class="['checkbox', { checked: agreed }]"
          @click="agreed = !agreed"
        >
          <text v-if="agreed" class="check-icon">✓</text>
        </view>
        <text class="agreement-text">
          已阅读并同意
          <text class="link" @click.stop="onShowPrivacy">《隐私政策》</text>
          和
          <text class="link" @click.stop="onShowTerms">《用户协议》</text>
        </text>
      </view>

      <!-- 登录按钮 -->
      <button
        class="login-btn"
        :class="{ disabled: !canLogin }"
        @click="onLogin"
      >
        确认登录
      </button>
    </view>

    <!-- 游客入口 -->
    <view class="guest-entry" @click="onGuestLogin">
      <text class="guest-text">暂不登录，游客浏览</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { mockLogin } from '@/services/mock'

const avatarUrl = ref('')
const nickname = ref('')
const phone = ref('')
const agreed = ref(false)

const canLogin = computed(() => {
  return avatarUrl.value && nickname.value.trim() && agreed.value
})

function onAvatarChoose(e: any) {
  // 微信选择头像后，会返回临时文件路径
  avatarUrl.value = e.detail.avatarUrl
}

function onNicknameBlur(e: any) {
  // 微信小程序的 type="nickname" input 会自动填充昵称
  if (!nickname.value && e.detail.value) {
    nickname.value = e.detail.value
  }
}

function onGuestLogin() {
  uni.setStorageSync('is_guest', true)
  uni.switchTab({ url: '/pages/index/index' })
}

async function onLogin() {
  if (!canLogin.value) {
    if (!avatarUrl.value) {
      uni.showToast({ title: '请选择头像', icon: 'none' })
      return
    }
    if (!nickname.value.trim()) {
      uni.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (!agreed.value) {
      uni.showToast({ title: '请阅读并同意协议', icon: 'none' })
      return
    }
    return
  }

  uni.showLoading({ title: '登录中...' })

  const res: any = await mockLogin({
    avatar: avatarUrl.value,
    nickname: nickname.value.trim(),
    phone: phone.value || undefined
  })

  uni.hideLoading()

  if (res.code === 0) {
    // 保存登录态
    uni.setStorageSync('token', res.data.token)
    uni.setStorageSync('user_info', res.data.user)
    uni.removeStorageSync('is_guest')

    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 800)
  } else {
    uni.showToast({ title: res.message || '登录失败', icon: 'none' })
  }
}

function onShowPrivacy() {
  uni.showModal({
    title: '隐私政策',
    content: '鼻纹智救重视您的隐私保护...（完整隐私政策内容）',
    showCancel: false
  })
}

function onShowTerms() {
  uni.showModal({
    title: '用户协议',
    content: '欢迎使用鼻纹智救...（完整用户协议内容）',
    showCancel: false
  })
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #E8FDF8 0%, #F5F5F5 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 48rpx;
}

.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0 60rpx;
}

.brand-logo {
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, #0FBF9F, #07C160);
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(15, 191, 159, 0.3);
}

.logo-icon {
  font-size: 60rpx;
}

.brand-name {
  font-size: 40rpx;
  font-weight: 700;
  color: #1A1A1A;
}

.brand-slogan {
  font-size: 24rpx;
  color: #999999;
  margin-top: 8rpx;
}

.login-form {
  width: 100%;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 48rpx 32rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40rpx;
}

.avatar-btn {
  width: 160rpx;
  height: 160rpx;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  border-radius: 50%;
  overflow: hidden;
}

.avatar-btn::after {
  border: none;
}

.avatar-img {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 4rpx solid #0FBF9F;
}

.avatar-placeholder {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #F5F5F5;
  border: 4rpx dashed #CCCCCC;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-add-icon {
  font-size: 60rpx;
  color: #CCCCCC;
  line-height: 1;
}

.avatar-hint {
  font-size: 22rpx;
  color: #999999;
  margin-top: 16rpx;
}

.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 600;
  display: block;
  margin-bottom: 12rpx;
}

.optional-tag {
  font-size: 20rpx;
  color: #999999;
  font-weight: 400;
}

.form-input {
  width: 100%;
  height: 88rpx;
  background: #F8F8F8;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #1A1A1A;
  box-sizing: border-box;
}

.form-input::placeholder {
  color: #CCCCCC;
}

.agreement-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 32rpx;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #CCCCCC;
  border-radius: 8rpx;
  margin-right: 12rpx;
  margin-top: 4rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.checkbox.checked {
  background: #0FBF9F;
  border-color: #0FBF9F;
}

.check-icon {
  font-size: 22rpx;
  color: #FFFFFF;
  font-weight: 700;
}

.agreement-text {
  font-size: 22rpx;
  color: #666666;
  line-height: 1.5;
}

.link {
  color: #0FBF9F;
}

.login-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  border-radius: 48rpx;
  color: #FFFFFF;
  font-size: 30rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  box-shadow: 0 4rpx 20rpx rgba(15, 191, 159, 0.3);
}

.login-btn.disabled {
  background: #CCCCCC;
  box-shadow: none;
}

.login-btn::after {
  border: none;
}

.guest-entry {
  margin-top: 40rpx;
  margin-bottom: 60rpx;
}

.guest-text {
  font-size: 24rpx;
  color: #999999;
}
</style>
