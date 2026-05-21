<template>
  <view class="page">
    <!-- 品牌区 -->
    <view class="brand-section">
      <view class="brand-card">
        <image class="logo-icon" src="/static/icons/icon-fingerprint.png" mode="aspectFit" />
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
  background: linear-gradient(160deg, #F0FBF8 0%, #F7F8FA 50%, #FFF5F5 100%);
  display: flex;
  flex-direction: column;
}

.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0 60rpx;
}

.brand-card {
  width: 140rpx;
  height: 140rpx;
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  border-radius: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(15, 191, 159, 0.25);
}

.logo-icon {
  width: 80rpx;
  height: 80rpx;
}

.brand-name {
  font-size: 52rpx;
  font-weight: 700;
  color: #1A1A1A;
  letter-spacing: 2rpx;
}

.brand-slogan {
  font-size: 26rpx;
  color: #999999;
  margin-top: 10rpx;
  letter-spacing: 4rpx;
}

.login-form {
  background: #FFFFFF;
  margin: 0 40rpx;
  border-radius: 28rpx;
  padding: 52rpx 44rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
}

.form-item {
  margin-bottom: 36rpx;
}

.form-label {
  font-size: 26rpx;
  color: #666666;
  display: block;
  margin-bottom: 12rpx;
  font-weight: 500;
}

.form-input {
  height: 88rpx;
  background: #F7F8FA;
  border: 2rpx solid #EEEEEE;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #1A1A1A;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #0FBF9F;
  background: #FFFFFF;
}

.form-input::placeholder {
  color: #BBBBBB;
}

.login-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16rpx;
  border: none;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
  transition: opacity 0.2s, box-shadow 0.2s;
}

.login-btn.disabled {
  background: #CCCCCC;
  box-shadow: none;
}
</style>
