<template>
  <view class="page">
    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="user-avatar-wrap">
        <image
          class="user-avatar"
          :src="user.avatar_url || '/static/mock/avatar-default.png'"
          mode="aspectFill"
          @error="onAvatarError"
        />
        <view class="avatar-edit" @click="onEditAvatar">
          <text>✎</text>
        </view>
      </view>
      <view class="user-info">
        <text class="user-name">{{ user.nickname }}</text>
        <text class="user-phone">{{ user.phone }}</text>
        <view class="user-role">
          <text class="role-tag">{{ roleLabel }}</text>
        </view>
      </view>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-grid">
      <view class="stat-item" @click="goToMyReports">
        <text class="stat-num">{{ stats.reportCount }}</text>
        <text class="stat-label">上报事件</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item" @click="goToMyClaims">
        <text class="stat-num">{{ stats.claimCount }}</text>
        <text class="stat-label">认领记录</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-num">{{ stats.approvedCount }}</text>
        <text class="stat-label">已认领</text>
      </view>
    </view>

    <!-- 菜单列表 -->
    <view class="menu-section">
      <!-- 我的上报 -->
      <view class="menu-item" @click="goToMyReports">
        <image class="menu-icon-img" src="/static/icons/icon-filetext.png" mode="aspectFit" />
        <text class="menu-text">我的上报</text>
        <text class="menu-arrow">›</text>
      </view>

      <!-- 认领记录 -->
      <view class="menu-item" @click="goToMyClaims">
        <image class="menu-icon-img" src="/static/icons/icon-heart.png" mode="aspectFit" />
        <text class="menu-text">认领记录</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="menu-section">
      <!-- 帮助与反馈 -->
      <view class="menu-item" @click="goToHelp">
        <text class="menu-icon">❓</text>
        <text class="menu-text">帮助与反馈</text>
        <text class="menu-arrow">›</text>
      </view>

      <!-- 关于我们 -->
      <view class="menu-item" @click="goToAbout">
        <image class="menu-icon-img" src="/static/icons/icon-info-gray.png" mode="aspectFit" />
        <text class="menu-text">关于我们</text>
        <text class="menu-version">v1.0.0</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-btn" @click="onLogout">
      <text>退出登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiGetCurrentUser, apiGetMyClaims } from '@/services/api'

const user = ref<any>({
  nickname: '加载中...',
  phone: '',
  avatar_url: '',
  role: 'user'
})

const stats = ref({
  reportCount: 0,
  claimCount: 0,
  approvedCount: 0
})

const roleLabel = computed(() => {
  const map: Record<string, string> = {
    user: '普通用户',
    admin: '管理员',
    org: '机构用户'
  }
  return map[user.value.role] || '普通用户'
})

onMounted(async () => {
  const [userRes, claimRes] = await Promise.all([
    apiGetCurrentUser(),
    apiGetMyClaims()
  ])

  if (userRes.code === 0) {
    user.value = userRes.data
  }

  if (claimRes.code === 0) {
    stats.value.claimCount = claimRes.data.length
    stats.value.approvedCount = claimRes.data.filter((c: any) => c.status === 'approved').length
  }
})

function onAvatarError() {
  user.value.avatar_url = '/static/mock/avatar-default.png'
}

function onEditAvatar() {
  uni.chooseAvatar({
    success: (res: any) => {
      user.value.avatar_url = res.avatarUrl
    }
  })
}

function goToMyReports() {
  uni.navigateTo({ url: '/pages/my-reports/index' })
}

function goToMyClaims() {
  uni.navigateTo({ url: '/pages/my-claims/index' })
}

function goToHelp() {
  uni.showToast({ title: '帮助与反馈（开发中）', icon: 'none' })
}

function goToAbout() {
  uni.showToast({ title: '鼻纹智救 v1.0.0', icon: 'none' })
}

function onLogout() {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        uni.clearStorageSync()
        uni.reLaunch({ url: '/pages/index/index' })
      }
    }
  })
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 48rpx;
}

.user-card {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  padding: 48rpx 32rpx 32rpx;
  display: flex;
  align-items: center;
}

.user-avatar-wrap {
  position: relative;
  margin-right: 24rpx;
}

.user-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.2);
}

.avatar-edit {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40rpx;
  height: 40rpx;
  background: #FFFFFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  color: #0FBF9F;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 36rpx;
  font-weight: 700;
  color: #FFFFFF;
  display: block;
}

.user-phone {
  font-size: 24rpx;
  color: rgba(255,255,255,0.8);
  display: block;
  margin-top: 4rpx;
}

.user-role {
  margin-top: 8rpx;
}

.role-tag {
  background: rgba(255,255,255,0.2);
  color: #FFFFFF;
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
}

.stats-grid {
  background: #FFFFFF;
  display: flex;
  align-items: center;
  margin: 24rpx;
  border-radius: 16rpx;
  padding: 32rpx;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-num {
  font-size: 40rpx;
  font-weight: 700;
  color: #0FBF9F;
  display: block;
}

.stat-label {
  font-size: 22rpx;
  color: #999999;
  display: block;
  margin-top: 4rpx;
}

.stat-divider {
  width: 1rpx;
  height: 60rpx;
  background: #EEEEEE;
}

.menu-section {
  background: #FFFFFF;
  margin: 0 24rpx 24rpx;
  border-radius: 16rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #F5F5F5;
  position: relative;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon-img {
  width: 32rpx;
  height: 32rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.menu-text {
  font-size: 28rpx;
  color: #1A1A1A;
  flex: 1;
}

.menu-arrow {
  font-size: 32rpx;
  color: #CCCCCC;
  margin-left: 8rpx;
}

.menu-count {
  font-size: 22rpx;
  color: #999999;
  margin-right: 8rpx;
}

.menu-badge {
  background: #E53A3A;
  color: #FFFFFF;
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 20rpx;
  margin-right: 8rpx;
}

.menu-version {
  font-size: 22rpx;
  color: #999999;
  margin-right: 8rpx;
}

.logout-btn {
  margin: 48rpx 24rpx;
  background: #FFFFFF;
  text-align: center;
  padding: 28rpx;
  border-radius: 16rpx;
  font-size: 30rpx;
  color: #E53A3A;
}
</style>
