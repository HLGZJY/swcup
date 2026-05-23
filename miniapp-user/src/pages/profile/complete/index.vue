<template>
  <view class="page">
    <!-- 品牌区 -->
    <view class="brand-section">
      <view class="brand-logo">
        <image class="logo-icon" src="/static/icons/icon-fingerprint.png" mode="aspectFit" />
      </view>
      <text class="brand-name">鼻纹智救</text>
      <text class="brand-slogan">完善您的个人信息</text>
    </view>

    <!-- 完善资料表单 -->
    <view class="profile-form">
      <!-- 昵称 -->
      <view class="form-item">
        <text class="form-label">昵称</text>
        <input
          type="text"
          class="form-input"
          placeholder="请输入昵称（2-20个字符）"
          v-model="nickname"
          maxlength="20"
        />
      </view>

      <!-- 角色选择 -->
      <view class="form-item">
        <text class="form-label">角色身份</text>
        <view class="role-grid">
          <view
            class="role-card"
            :class="{ selected: role === 'user' }"
            @click="onSelectRole('user')"
          >
            <text class="role-icon">🐾</text>
            <text class="role-name">普通用户</text>
            <text class="role-desc">流浪动物发现与上报</text>
            <view class="role-check" v-if="role === 'user'">✓</view>
          </view>
          <view
            class="role-card"
            :class="{ selected: role === 'org' }"
            @click="onSelectRole('org')"
          >
            <text class="role-icon">🏠</text>
            <text class="role-name">机构用户</text>
            <text class="role-desc">动物救助组织/医院</text>
            <view class="role-check" v-if="role === 'org'">✓</view>
          </view>
        </view>
      </view>

      <!-- 提交按钮 -->
      <button
        class="submit-btn"
        :class="{ disabled: !canSubmit }"
        @click="onSubmit"
      >
        完成
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { apiUpdateCurrentUser } from '@/services/api'

const nickname = ref('')
const role = ref<'user' | 'org'>('user')

const canSubmit = computed(() => {
  return nickname.value.trim().length >= 2 && nickname.value.trim().length <= 20
})

function onSelectRole(r: 'user' | 'org') {
  role.value = r
}

async function onSubmit() {
  if (!canSubmit.value) {
    uni.showToast({ title: '请输入2-20位昵称', icon: 'none' })
    return
  }

  uni.showLoading({ title: '保存中...' })

  try {
    const res: any = await apiUpdateCurrentUser({
      nickname: nickname.value.trim(),
      role: role.value
    })

    // 更新本地存储的用户信息
    const storedUser = uni.getStorageSync('user_info') || {}
    uni.setStorageSync('user_info', {
      ...storedUser,
      nickname: nickname.value.trim(),
      role: role.value
    })

    uni.hideLoading()
    uni.showToast({ title: '保存成功', icon: 'success' })
    // 通知"我的"页面刷新数据
    uni.$emit('page:refresh-user')
    setTimeout(() => {
      uni.navigateBack()
    }, 800)
  } catch (err: any) {
    uni.hideLoading()
    uni.showToast({ title: err.message || '保存失败', icon: 'none' })
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

.profile-form {
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

.role-grid {
  display: flex;
  gap: 24rpx;
}

.role-card {
  flex: 1;
  background: #F8F8F8;
  border-radius: 16rpx;
  padding: 32rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  border: 2rpx solid transparent;
  transition: all 0.2s;
}

.role-card.selected {
  background: #E8FDF8;
  border-color: #0FBF9F;
}

.role-icon {
  font-size: 56rpx;
  margin-bottom: 12rpx;
}

.role-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
  display: block;
  margin-bottom: 4rpx;
}

.role-desc {
  font-size: 20rpx;
  color: #999999;
  text-align: center;
  display: block;
}

.role-check {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 36rpx;
  height: 36rpx;
  background: #0FBF9F;
  border-radius: 50%;
  color: #FFFFFF;
  font-size: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-btn {
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

.submit-btn.disabled {
  background: #CCCCCC;
  box-shadow: none;
}

.submit-btn::after {
  border: none;
}
</style>