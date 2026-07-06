<template>
  <view class="page">
    <!-- 品牌区 -->
    <view class="brand-section">
      <view class="brand-logo">
        <image class="logo-icon" src="/static/icons/icon-fingerprint.svg" mode="aspectFit" />
      </view>
      <text class="brand-name">鼻纹智救</text>
      <text class="brand-slogan">绑定您的手机号</text>
    </view>

    <!-- 绑定表单 -->
    <view class="bind-form">
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

      <!-- 验证码 -->
      <view class="form-item">
        <text class="form-label">验证码</text>
        <view class="code-row">
          <input
            type="text"
            class="form-input code-input"
            placeholder="请输入验证码"
            v-model="code"
            maxlength="6"
            inputmode="numeric"
          />
          <button
            class="code-btn"
            :class="{ disabled: countdown > 0 }"
            @click="onSendCode"
          >
            {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
          </button>
        </view>
      </view>

      <!-- 设置密码 -->
      <view class="form-item">
        <text class="form-label">设置密码</text>
        <input
          type="password"
          class="form-input"
          placeholder="请输入密码（至少8位，包含字母和数字）"
          v-model="password"
        />
      </view>

      <!-- 绑定按钮 -->
      <button
        class="bind-btn"
        :class="{ disabled: !canBind }"
        @click="onBind"
      >
        绑定
      </button>

      <!-- 返回入口 -->
      <view class="back-row">
        <text class="back-text">绑定后可使用手机号登录</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { apiSendCode, apiBindPhone } from '@/services/api'

const phone = ref('')
const code = ref('')
const password = ref('')
const countdown = ref(0)

let countdownTimer: ReturnType<typeof setInterval> | null = null

const canBind = computed(() => {
  return phone.value.length === 11 &&
    code.value.length === 6 &&
    password.value.length >= 8
})

async function onSendCode() {
  if (countdown.value > 0) return
  if (phone.value.length !== 11) {
    uni.showToast({ title: '请输入11位手机号', icon: 'none' })
    return
  }

  uni.showLoading({ title: '发送中...' })
  try {
    await apiSendCode(phone.value)
    uni.hideLoading()
    uni.showToast({ title: '验证码已发送', icon: 'success' })
    // 倒计时60秒
    countdown.value = 60
    countdownTimer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        if (countdownTimer) clearInterval(countdownTimer)
        countdownTimer = null
      }
    }, 1000)
  } catch (err: any) {
    uni.hideLoading()
    uni.showToast({ title: err.message || '发送失败', icon: 'none' })
  }
}

async function onBind() {
  if (!canBind.value) {
    if (phone.value.length !== 11) {
      uni.showToast({ title: '请输入11位手机号', icon: 'none' })
      return
    }
    if (code.value.length !== 6) {
      uni.showToast({ title: '请输入6位验证码', icon: 'none' })
      return
    }
    if (password.value.length < 8) {
      uni.showToast({ title: '密码至少8位，需包含字母和数字', icon: 'none' })
      return
    }
    return
  }

  uni.showLoading({ title: '绑定中...' })
  try {
    const res: any = await apiBindPhone(phone.value, code.value, password.value)

    // 更新本地存储的用户信息
    const storedUser = uni.getStorageSync('user_info') || {}
    uni.setStorageSync('user_info', {
      ...storedUser,
      phone: res.data.user?.phone || phone.value,
    })

    uni.hideLoading()
    uni.showToast({ title: '绑定成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 800)
  } catch (err: any) {
    uni.hideLoading()
    uni.showToast({ title: err.message || '绑定失败', icon: 'none' })
  }
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

.bind-form {
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

.code-row {
  display: flex;
  gap: 16rpx;
}

.code-input {
  flex: 1;
}

.code-btn {
  width: 200rpx;
  height: 88rpx;
  background: #F8F8F8;
  border-radius: 16rpx;
  color: #0FBF9F;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  flex-shrink: 0;
}

.code-btn.disabled {
  color: #CCCCCC;
}

.code-btn::after {
  border: none;
}

.bind-btn {
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

.bind-btn.disabled {
  background: #CCCCCC;
  box-shadow: none;
}

.bind-btn::after {
  border: none;
}

.back-row {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 32rpx;
}

.back-text {
  font-size: 24rpx;
  color: #999999;
}
</style>