<template>
  <view class="page">
    <!-- 品牌区 -->
    <view class="brand-section">
      <view class="brand-logo">
        <text class="logo-icon">🐾</text>
      </view>
      <text class="brand-name">鼻纹智救</text>
      <text class="brand-slogan">管理后台</text>
    </view>

    <!-- 登录表单 -->
    <view class="login-form">
      <!-- 手机号 -->
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input
          type="text"
          class="form-input"
          placeholder="请输入管理员手机号"
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
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

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
    const res: any = await uni.request({
      url: 'http://192.168.32.1:3000/auth/login',
      method: 'POST',
      data: { phone: phone.value, password: password.value }
    })

    uni.hideLoading()

    if (res.data.code === 0) {
      uni.setStorageSync('token', res.data.data.token)
      uni.setStorageSync('user_info', res.data.data.user)
      uni.setStorageSync('role', res.data.data.user.role)
      uni.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/admin/index' })
      }, 800)
    }
    // 其他错误由 api.js 拦截器处理
  } catch (err: any) {
    uni.hideLoading()
    uni.showToast({ title: '网络异常，请检查网络', icon: 'none' })
  }
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1A1A1A 0%, #333333 100%);
  display: flex;
  flex-direction: column;
}

.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0 80rpx;
}

.brand-logo {
  width: 120rpx;
  height: 120rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.logo-icon {
  font-size: 64rpx;
}

.brand-name {
  font-size: 48rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.brand-slogan {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 8rpx;
}

.login-form {
  background: #FFFFFF;
  margin: 0 32rpx;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
}

.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 26rpx;
  color: #666666;
  display: block;
  margin-bottom: 12rpx;
}

.form-input {
  height: 88rpx;
  background: #F5F5F5;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.login-btn {
  width: 100%;
  height: 88rpx;
  background: #FF6B6B;
  color: #FFFFFF;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16rpx;
  border: none;
}

.login-btn.disabled {
  background: #CCCCCC;
}
</style>
