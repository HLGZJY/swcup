<template>
  <view class="page">
    <!-- 品牌区 -->
    <view class="brand-section">
      <view class="brand-logo">
        <image class="logo-icon" src="/static/icons/icon-fingerprint.png" mode="aspectFit" />
      </view>
      <text class="brand-name">鼻纹智救</text>
      <text class="brand-slogan">AI 流浪动物 · 防重复救助</text>
    </view>

    <!-- 登录表单 -->
    <view class="login-form">
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
          placeholder="请输入密码"
          v-model="password"
        />
      </view>

      <!-- 登录按钮 -->
      <button
        class="login-btn"
        :class="{ disabled: !canLogin }"
        @click="onLogin"
      >
        登录
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
import { apiLogin, apiRegister } from '@/services/api'

const phone = ref('')
const password = ref('')

const canLogin = computed(() => {
  return phone.value.length === 11 && password.value.length >= 6
})

async function onLogin() {
  if (!canLogin.value) {
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
  uni.showModal({
    title: '注册',
    content: '注册功能开发中，请联系管理员创建账号',
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

.login-form {
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
  margin-top: 16rpx;
}

.login-btn.disabled {
  background: #CCCCCC;
  box-shadow: none;
}

.login-btn::after {
  border: none;
}

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
}
</style>
