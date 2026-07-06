<template>
  <view class="page">
    <!-- 品牌区 -->
    <view class="brand-section">
      <view class="brand-card">
        <image
          class="logo-icon"
          src="/static/icons/icon-fingerprint.png"
          mode="aspectFit"
        />
      </view>
      <text class="brand-name">鼻纹智救</text>
      <text class="brand-slogan">管理后台 · ADMIN</text>
    </view>

    <!-- 登录表单 -->
    <view class="login-form">
      <!-- 手机号 -->
      <view class="form-item">
        <text class="form-label">手机号</text>
        <view class="input-wrap">
          <image
            class="input-icon input-icon--prefix"
            src="/static/icons/icon-phone.svg"
            mode="aspectFit"
          />
          <input
            type="text"
            class="form-input"
            placeholder="请输入管理员手机号"
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
          <image
            class="input-icon input-icon--prefix"
            src="/static/icons/icon-lock.svg"
            mode="aspectFit"
          />
          <input
            :type="showPwd ? 'text' : 'password'"
            class="form-input"
            placeholder="请输入密码"
            v-model="password"
          />
          <view
            class="input-icon input-icon--suffix"
            hover-class="suffix-hover"
            :hover-stay-time="80"
            @click="showPwd = !showPwd"
            role="button"
            :aria-label="showPwd ? '隐藏密码' : '显示密码'"
          >
            <image
              class="input-icon-svg"
              :src="showPwd ? '/static/icons/icon-eye-off.svg' : '/static/icons/icon-eye.svg'"
              mode="aspectFit"
            />
          </view>
        </view>
      </view>

      <!-- 登录按钮（初始即主色，校验交给按钮反馈） -->
      <button
        class="login-btn"
        :class="{ loading: isLoading }"
        :disabled="isLoading"
        @click="onLogin"
      >
        {{ isLoading ? '登录中...' : '登 录' }}
      </button>

      <!-- 测试账号提示（演示用，整张卡片可点击） -->
      <view
        v-if="showTestTip"
        class="test-tip"
        hover-class="test-tip--hover"
        :hover-stay-time="120"
        @click="fillTestAccount"
        role="button"
        aria-label="点击填入演示账号"
      >
        <view class="test-tip-header">
          <image
            class="test-tip-icon"
            src="/static/icons/icon-sparkles.png"
            mode="aspectFit"
          />
          <text class="test-tip-title">演示账号</text>
        </view>
        <view class="test-tip-body">
          <text class="test-tip-line">管理员：</text>
          <text class="test-tip-cred">13900000001</text>
          <text class="test-tip-sep"> / </text>
          <text class="test-tip-cred">admin123</text>
        </view>
        <view class="test-tip-action">
          <text class="test-tip-action-text">点击自动填入</text>
          <text class="test-tip-arrow">→</text>
        </view>
      </view>
    </view>

    <!-- 底部版权 -->
    <view class="footer">
      <text class="footer-text">© 鼻纹智救 · 第十五届中国软件杯</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const phone = ref('')
const password = ref('')
const showPwd = ref(false)
const isLoading = ref(false)
// 默认显示测试账号提示（演示项目；正式提交可改为 false）
const showTestTip = ref(true)

const canLogin = computed(() => {
  return phone.value.length === 11 && password.value.length >= 6
})

function fillTestAccount() {
  phone.value = '13900000001'
  password.value = 'admin123'
  uni.showToast({ title: '已填入演示账号', icon: 'none' })
}

async function onLogin() {
  if (isLoading.value) return

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

  isLoading.value = true

  try {
    const res: any = await uni.request({
      url: 'http://192.168.32.1:3000/v1/auth/login',
      method: 'POST',
      data: { phone: phone.value, password: password.value }
    })

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
    uni.showToast({ title: '网络异常，请检查网络', icon: 'none' })
  } finally {
    isLoading.value = false
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
  padding: 100rpx 0 40rpx;  /* 缩小顶部留白 */
}

.brand-card {
  width: 140rpx;
  height: 140rpx;
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  border-radius: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28rpx;
  box-shadow: 0 8rpx 32rpx rgba(15, 191, 159, 0.25);
  position: relative;
}

.logo-icon {
  width: 80rpx;
  height: 80rpx;
  /* 黑色图标 → 白色（与品牌色协调） */
  filter: brightness(0) invert(1);
}

.brand-name {
  font-size: 48rpx;        /* 略缩，与 LOGO 比例更协调 */
  font-weight: 700;
  color: #1A1A1A;
  letter-spacing: 2rpx;
}

.brand-slogan {
  font-size: 24rpx;
  color: #999999;
  margin-top: 8rpx;
  letter-spacing: 2rpx;     /* 缩小字间距，不再"散" */
}

.login-form {
  background: #FFFFFF;
  margin: 0 40rpx;
  border-radius: 28rpx;
  padding: 48rpx 40rpx 40rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
}

.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 26rpx;
  color: #666666;
  display: block;
  margin-bottom: 14rpx;
  font-weight: 500;
}

.input-wrap {
  display: flex;
  align-items: center;
  height: 88rpx;
  background: #F7F8FA;
  border: 2rpx solid #EEEEEE;
  border-radius: 16rpx;
  padding: 0 20rpx;
  transition: border-color 0.2s, background 0.2s;
}

.input-wrap:focus-within {
  border-color: #0FBF9F;
  background: #FFFFFF;
}

/* SVG 图标通用样式（黑色 stroke → 浅灰，与 placeholder 同色系） */
.input-icon {
  filter: opacity(0.5);
  flex-shrink: 0;
  transition: filter 0.2s;
}

.input-wrap:focus-within .input-icon {
  filter: opacity(0.85);   /* focus 时加深 */
}

.input-icon--prefix {
  width: 36rpx;
  height: 36rpx;
  margin-right: 12rpx;
}

.input-icon--suffix {
  width: 56rpx;            /* 扩大触摸区域到 56rpx（>44px 标准） */
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8rpx;
  margin-right: -8rpx;     /* 视觉对齐到 input 右内边缘 */
}

.input-icon-svg {
  width: 36rpx;
  height: 36rpx;
}

/* 密码可见切换 hover 反馈 */
.suffix-hover {
  filter: opacity(0.85);
}

.form-input {
  flex: 1;
  height: 100%;
  background: transparent;
  border: none;
  padding: 0;
  font-size: 28rpx;
  color: #1A1A1A;
  outline: none;
}

.form-input::placeholder {
  color: #999999;            /* 加深 placeholder，提升可读性 */
}

/* ===== 登录按钮：初始即主色 ===== */
.login-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 4rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 12rpx;
  border: none;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
  transition: transform 0.1s, box-shadow 0.2s, opacity 0.2s;
}

/* 按下时的微动效（微信小程序 button 自带 hover-class 效果有限，手动加） */
.login-btn:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 8rpx rgba(15, 191, 159, 0.3);
}

/* loading 态：保留主色但加半透明 + 禁用点击 */
.login-btn.loading {
  opacity: 0.7;
}

/* 兼容微信 button disabled 灰底（用 [disabled] 属性选择器覆盖） */
.login-btn[disabled] {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%) !important;
  color: #FFFFFF !important;
  opacity: 0.7;
}

/* ===== 演示账号提示卡片（重设计：整张可点） ===== */
.test-tip {
  margin-top: 36rpx;
  padding: 24rpx;
  background: linear-gradient(135deg, #FFFBF0 0%, #FFF8E8 100%);
  border: 1rpx solid #FFE8B0;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  transition: transform 0.15s, box-shadow 0.2s;
}

.test-tip--hover {
  transform: scale(0.98);
  box-shadow: 0 2rpx 12rpx rgba(193, 138, 18, 0.18);
}

.test-tip-header {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.test-tip-icon {
  width: 28rpx;
  height: 28rpx;
  /* PNG 黑色 → 暖金色，与文字色 #B0770A 协调 */
  filter: brightness(0) saturate(100%) invert(40%) sepia(74%) saturate(694%) hue-rotate(2deg) brightness(96%) contrast(92%);
}

.test-tip-title {
  font-size: 26rpx;
  color: #B0770A;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.test-tip-body {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  line-height: 1.6;
}

.test-tip-line {
  font-size: 24rpx;
  color: #8B6914;
}

.test-tip-cred {
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
  font-size: 24rpx;
  font-weight: 600;
  color: #5C4500;
  background: rgba(255, 255, 255, 0.6);
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  margin: 0 2rpx;
}

.test-tip-sep {
  font-size: 24rpx;
  color: #B0770A;
  margin: 0 4rpx;
}

.test-tip-action {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 4rpx;
}

.test-tip-action-text {
  font-size: 24rpx;
  color: #0FBF9F;
  font-weight: 500;
}

.test-tip-arrow {
  font-size: 24rpx;
  color: #0FBF9F;
  font-weight: 500;
  transition: transform 0.2s;
  display: inline-block;
}

.test-tip--hover .test-tip-arrow {
  transform: translateX(6rpx);
}

/* ===== 底部版权 ===== */
.footer {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 60rpx;
}

.footer-text {
  font-size: 22rpx;
  color: #BBBBBB;
  letter-spacing: 1rpx;
}
</style>