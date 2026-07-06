<template>
  <view class="page">
    <!-- 品牌区 -->
    <view class="brand-section">
      <view class="brand-logo">
        <image class="logo-icon" src="/static/icons/icon-fingerprint.svg" mode="aspectFit" />
      </view>
      <text class="brand-name">鼻纹智救</text>
      <text class="brand-slogan">注册您的账号</text>
    </view>

    <!-- 注册表单 -->
    <view class="register-form">
      <!-- 手机号 -->
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input
          type="text"
          class="form-input"
          placeholder="请输入手机号"
          v-model="phone"
          maxlength="11"
          inputmode="numeric"
        />
      </view>

      <!-- 密码 -->
      <view class="form-item">
        <text class="form-label">密码</text>
        <input
          type="password"
          class="form-input"
          placeholder="请输入密码（至少8位，包含字母和数字）"
          v-model="password"
        />
      </view>

      <!-- 确认密码 -->
      <view class="form-item">
        <text class="form-label">确认密码</text>
        <input
          type="password"
          class="form-input"
          placeholder="请再次输入密码"
          v-model="confirmPassword"
        />
      </view>

      <!-- 隐私协议勾选 -->
      <view class="privacy-row">
        <checkbox-group @change="onPrivacyChange">
          <label class="privacy-label">
            <checkbox :checked="privacyAgreed" value="1" color="#0FBF9F" />
            <text class="privacy-text" @click="showPrivacy">我已阅读并同意《隐私政策》</text>
          </label>
        </checkbox-group>
      </view>

      <!-- 注册按钮 -->
      <button
        class="register-btn"
        :class="{ disabled: !canRegister }"
        @click="onRegister"
      >
        注册
      </button>

      <!-- 登录入口 -->
      <view class="login-row">
        <text class="login-text">已有账号？</text>
        <text class="login-link" @click="onLogin">立即登录</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { apiRegister } from '@/services/api'

const phone = ref('')
const password = ref('')
const confirmPassword = ref('')
const privacyAgreed = ref(false)

const canRegister = computed(() => {
  return phone.value.length === 11 &&
    password.value.length >= 8 &&
    confirmPassword.value.length >= 8 &&
    privacyAgreed.value
})

function onPrivacyChange(e: any) {
  privacyAgreed.value = e.detail.value.includes('1')
}

function showPrivacy() {
  uni.navigateTo({ url: '/pages/privacy/index' })
}

async function onRegister() {
  if (!canRegister.value) {
    if (!privacyAgreed.value) {
      uni.showToast({ title: '请先同意隐私政策', icon: 'none' })
      return
    }
    if (phone.value.length !== 11) {
      uni.showToast({ title: '请输入11位手机号', icon: 'none' })
      return
    }
    if (password.value.length < 8) {
      uni.showToast({ title: '密码至少8位，包含字母和数字', icon: 'none' })
      return
    }
    if (password.value !== confirmPassword.value) {
      uni.showToast({ title: '两次密码输入不一致', icon: 'none' })
      return
    }
    return
  }

  uni.showLoading({ title: '注册中...' })

  try {
    const res: any = await apiRegister(phone.value, password.value)

    // 保存登录态
    uni.setStorageSync('token', res.data.token)
    uni.setStorageSync('user_info', res.data.user)

    uni.hideLoading()
    uni.showToast({ title: '注册成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 800)
  } catch (err: any) {
    uni.hideLoading()
    if (err.code === 409) {
      uni.showToast({ title: '该手机号已注册', icon: 'none' })
    } else {
      uni.showToast({ title: err.message || '注册失败', icon: 'none' })
    }
  }
}

function onLogin() {
  uni.navigateBack()
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
  width: 80rpx;
  height: 80rpx;
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

.register-form {
  width: 100%;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 48rpx 32rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
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

.privacy-row {
  margin: 24rpx 0;
}

.privacy-label {
  display: flex;
  align-items: center;
}

.privacy-text {
  font-size: 24rpx;
  color: #666666;
  margin-left: 8rpx;
}

.register-btn {
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
  margin-top: 16rpx;
}

.register-btn.disabled {
  background: #CCCCCC;
  box-shadow: none;
}

.register-btn::after {
  border: none;
}

.login-row {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 32rpx;
}

.login-text {
  font-size: 24rpx;
  color: #999999;
}

.login-link {
  font-size: 24rpx;
  color: #0FBF9F;
  margin-left: 8rpx;
}
</style>