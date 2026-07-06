<template>
  <view class="page">
    <!-- 装饰背景 -->
    <view class="bg-decor">
      <view class="bg-blob bg-blob-1" />
      <view class="bg-blob bg-blob-2" />
    </view>

    <!-- 品牌区 -->
    <view class="brand-section">
      <view class="brand-logo">
        <view class="brand-logo-glow" />
        <image class="logo-icon" src="/static/icons/icon-fingerprint.svg" mode="aspectFit" />
      </view>
      <text class="brand-name">鼻纹智救</text>
      <view class="brand-slogan-row">
        <view class="slogan-line" />
        <text class="brand-slogan">AI 流浪动物 · 防重复救助</text>
        <view class="slogan-line" />
      </view>
    </view>

    <!-- 登录表单 -->
    <view class="login-form">
      <!-- 左侧色条 -->
      <view class="form-accent" />

      <!-- 手机号 -->
      <view class="form-item">
        <text class="form-label">手机号</text>
        <view class="input-wrap">
          <image class="input-icon" src="/static/icons/icon-phone.svg" mode="aspectFit" />
          <input
            type="text"
            class="form-input"
            placeholder="请输入手机号"
            v-model="phone"
            maxlength="11"
            inputmode="numeric"
          />
        </view>
      </view>

      <!-- 密码 -->
      <view class="form-item">
        <text class="form-label">密码</text>
        <view class="input-wrap">
          <image class="input-icon" src="/static/icons/icon-lock.svg" mode="aspectFit" />
          <input
            type="password"
            class="form-input"
            placeholder="请输入密码"
            v-model="password"
          />
        </view>
      </view>

      <!-- 忘记密码 -->
      <view class="forgot-row">
        <text class="forgot-link" @click="onForgot">忘记密码？</text>
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

      <!-- 登录按钮 -->
      <button
        class="login-btn"
        :class="{ disabled: !canLogin }"
        @click="onLogin"
      >
        登录
      </button>

      <!-- 微信登录按钮 -->
      <button
        class="weixin-login-btn"
        @click="onWxLogin"
      >
        <image class="wx-icon" src="/static/icons/icon-wechat.svg" mode="aspectFit" />
        <text>微信一键登录</text>
      </button>

      <!-- 注册入口 -->
      <view class="register-row">
        <text class="register-text">还没有账号？</text>
        <text class="register-link" @click="onRegister">立即注册</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { apiLogin, apiRegister, apiWeixinLogin } from '@/services/api'

const phone = ref('')
const password = ref('')
const privacyAgreed = ref(false)

const canLogin = computed(() => {
  return phone.value.length === 11 && password.value.length >= 6 && privacyAgreed.value
})

function onPrivacyChange(e: any) {
  privacyAgreed.value = e.detail.value.includes('1')
}

function showPrivacy() {
  uni.navigateTo({ url: '/pages/privacy/index' })
}

async function onLogin() {
  if (!canLogin.value) {
    if (!privacyAgreed.value) {
      uni.showToast({ title: '请先同意隐私政策', icon: 'none' })
      return
    }
    if (phone.value.length !== 11) {
      uni.showToast({ title: '请输入11位手机号', icon: 'none' })
      return
    }
    if (password.value.length < 6) {
      uni.showToast({ title: '密码至少6位', icon: 'none' })
      return
    }
    return
  }

  uni.showLoading({ title: '登录中...' })

  try {
    const res: any = await apiLogin(phone.value, password.value)

    // 保存登录态
    uni.setStorageSync('token', res.data.token)
    uni.setStorageSync('user_info', res.data.user)

    uni.hideLoading()
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 800)
  } catch (err: any) {
    uni.hideLoading()
    // 错误已由拦截器统一处理，这里只做兜底
    if (err.code === 40301) {
      uni.showToast({ title: '手机号或密码错误', icon: 'none' })
    }
  }
}

function onRegister() {
  if (!privacyAgreed.value) {
    uni.showToast({ title: '请先阅读并同意隐私政策', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages/register/index' })
}

function onForgot() {
  uni.navigateTo({ url: '/pages/login/reset-password/index' })
}

async function onWxLogin() {
  uni.showLoading({ title: '登录中...' })

  try {
    // 1. 获取微信登录凭证
    const loginRes = await uni.login({ provider: 'weixin' })
    if (!loginRes.code) {
      uni.hideLoading()
      uni.showToast({ title: '微信登录失败', icon: 'none' })
      return
    }

    // 2. 发送到后端换 token
    const result = await apiWeixinLogin(loginRes.code)

    // 保存登录态
    uni.setStorageSync('token', result.data.token)
    uni.setStorageSync('user_info', result.data.user)

    uni.hideLoading()
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 800)
  } catch (err: any) {
    uni.hideLoading()
    uni.showToast({ title: err.message || '登录失败', icon: 'none' })
  }
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #E8FDF8 0%, #F5F9F8 60%, #FFFFFF 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 48rpx;
  position: relative;
  overflow: hidden;
}

/* 装饰背景 */
.bg-decor {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 520rpx;
  pointer-events: none;
  overflow: hidden;
}

.bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40rpx);
  opacity: 0.45;
}

.bg-blob-1 {
  width: 360rpx;
  height: 360rpx;
  background: radial-gradient(circle, rgba(15, 191, 159, 0.35), transparent 70%);
  top: -120rpx;
  left: -100rpx;
}

.bg-blob-2 {
  width: 280rpx;
  height: 280rpx;
  background: radial-gradient(circle, rgba(7, 193, 96, 0.25), transparent 70%);
  top: 60rpx;
  right: -80rpx;
}

/* 品牌区 */
.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 96rpx 0 56rpx;
  position: relative;
  z-index: 2;
}

.brand-logo {
  width: 132rpx;
  height: 132rpx;
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28rpx;
  box-shadow: 0 12rpx 36rpx rgba(15, 191, 159, 0.4);
  position: relative;
  overflow: visible;
}

.brand-logo-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(15, 191, 159, 0.3), transparent 60%);
  z-index: -1;
  animation: glow-pulse 3s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
  50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.9; }
}

.logo-icon {
  width: 84rpx;
  height: 84rpx;
  filter: brightness(0) invert(1);
}

.brand-name {
  font-size: 44rpx;
  font-weight: 700;
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 2rpx;
}

.brand-slogan-row {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
}

.slogan-line {
  width: 24rpx;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, #0FBF9F);
}

.slogan-line:last-child {
  background: linear-gradient(90deg, #0FBF9F, transparent);
}

.brand-slogan {
  font-size: 24rpx;
  color: #666666;
  margin: 0 12rpx;
  letter-spacing: 1rpx;
}

/* 登录表单卡片 */
.login-form {
  width: 100%;
  background: #FFFFFF;
  border-radius: 28rpx;
  padding: 48rpx 36rpx 40rpx;
  box-shadow: 0 8rpx 32rpx rgba(15, 191, 159, 0.12);
  position: relative;
  z-index: 2;
  overflow: hidden;
}

.form-accent {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 6rpx;
  background: linear-gradient(180deg, #0FBF9F 0%, #07C160 50%, transparent 100%);
}

.form-item {
  margin-bottom: 28rpx;
}

.form-label {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 600;
  display: block;
  margin-bottom: 14rpx;
}

.input-wrap {
  display: flex;
  align-items: center;
  background: #F6FAF9;
  border-radius: 16rpx;
  padding: 0 24rpx;
  height: 92rpx;
  border: 2rpx solid transparent;
  transition: border-color 0.2s ease;
}

.input-wrap:focus-within {
  border-color: #0FBF9F;
  background: #FFFFFF;
  box-shadow: 0 0 0 4rpx rgba(15, 191, 159, 0.08);
}

.input-icon {
  width: 36rpx;
  height: 36rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
  opacity: 0.6;
}

.form-input {
  flex: 1;
  height: 100%;
  background: transparent;
  font-size: 28rpx;
  color: #1A1A1A;
}

.form-input::placeholder {
  color: #B8B8B8;
}

/* 忘记密码 */
.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 4rpx;
  margin-bottom: 20rpx;
}

.forgot-link {
  font-size: 24rpx;
  color: #0FBF9F;
  font-weight: 500;
}

/* 隐私协议 */
.privacy-row {
  margin: 20rpx 0 24rpx;
  padding: 4rpx 0;
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

/* 登录按钮 */
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
  box-shadow: 0 6rpx 20rpx rgba(15, 191, 159, 0.35);
  margin-top: 12rpx;
  letter-spacing: 2rpx;
  transition: opacity 0.2s ease, transform 0.1s ease;
}

.login-btn:active {
  transform: scale(0.98);
}

.login-btn.disabled {
  background: #D5D5D5;
  box-shadow: none;
  opacity: 0.7;
}

.login-btn::after {
  border: none;
}

/* 微信登录按钮 */
.weixin-login-btn {
  width: 100%;
  height: 92rpx;
  background: #FFFFFF;
  border-radius: 46rpx;
  color: #07C160;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #07C160;
  margin-top: 24rpx;
  transition: background 0.2s ease;
}

.weixin-login-btn::after {
  border: none;
}

.weixin-login-btn:active {
  background: rgba(7, 193, 96, 0.08);
}

.wx-icon {
  width: 36rpx;
  height: 36rpx;
  margin-right: 12rpx;
}

/* 注册入口 */
.register-row {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 32rpx;
}

.register-text {
  font-size: 24rpx;
  color: #999999;
}

.register-link {
  font-size: 24rpx;
  color: #0FBF9F;
  margin-left: 8rpx;
  font-weight: 600;
}
</style>