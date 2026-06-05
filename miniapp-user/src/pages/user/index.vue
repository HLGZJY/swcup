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
        <view v-if="user.openid && user.avatar_url" class="avatar-reset-btn" @click="onResetWechatAvatar">
          <text>恢复微信头像</text>
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

    <!-- 完善信息引导 Banner -->
    <view v-if="needsProfileComplete" class="profile-banner" @click="goToCompleteProfile">
      <view class="banner-left">
        <text class="banner-icon">⚠️</text>
        <text class="banner-text">完善您的昵称和角色信息</text>
      </view>
      <text class="banner-arrow">›</text>
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

      <!-- 绑定手机 -->
      <view class="menu-item" @click="goToBindPhone">
        <text class="menu-icon">📱</text>
        <text class="menu-text">绑定手机</text>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { apiGetCurrentUser, apiGetMyClaims, apiUpdateAvatar, apiResetWechatAvatar } from '@/services/api'

async function refreshUserData() {
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
}

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

const needsProfileComplete = computed(() => {
  return !user.value.nickname || user.value.nickname === '加载中...'
})

onMounted(async () => {
  await refreshUserData()
  // 监听每次显示此页面（从其他页面返回）
  uni.$on('page:refresh-user', refreshUserData)
})

onUnmounted(() => {
  uni.$off('page:refresh-user', refreshUserData)
})

function onAvatarError() {
  user.value.avatar_url = '/static/mock/avatar-default.png'
}

function onEditAvatar() {
  if (user.value.openid) {
    // 微信用户：显示选择菜单
    uni.showActionSheet({
      itemList: ['从微信头像选', '从相册选择'],
      success: (res: any) => {
        if (res.tapIndex === 0) {
          uni.chooseAvatar({
            success: (res: any) => uploadAvatar(res.avatarUrl),
          });
        } else {
          uni.chooseImage({
            count: 1,
            sourceType: ['album'],
            success: (res: any) => uploadAvatar(res.tempFilePaths[0]),
          });
        }
      }
    });
  } else {
    // 手机号用户：从相册选
    uni.chooseImage({
      count: 1,
      sourceType: ['album'],
      success: (res: any) => uploadAvatar(res.tempFilePaths[0]),
    });
  }
}

async function uploadAvatar(filePath: string) {
  uni.showLoading({ title: '上传中...' });
  try {
    const res = await apiUpdateAvatar(filePath);
    uni.hideLoading();
    if (res.code === 0) {
      user.value.avatar_url = res.data.avatar_url;
      uni.$emit('page:refresh-user');
    } else {
      uni.showToast({ title: res.message || '上传失败', icon: 'none' });
    }
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: '上传失败', icon: 'none' });
  }
}

async function onResetWechatAvatar() {
  uni.showModal({
    title: '恢复微信头像',
    content: '确定要恢复为微信头像吗？',
    success: async (res: any) => {
      if (res.confirm) {
        try {
          await apiResetWechatAvatar();
          uni.showToast({ title: '已恢复', icon: 'success' });
          refreshUserData();
        } catch (e) {
          uni.showToast({ title: '恢复失败，请重新登录', icon: 'none' });
        }
      }
    }
  });
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

function goToCompleteProfile() {
  uni.navigateTo({ url: '/pages/profile/complete/index' })
}

function goToBindPhone() {
  uni.navigateTo({ url: '/pages/profile/bind/index' })
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

.avatar-reset-btn {
  margin-left: 44px;
  margin-top: 8px;
  font-size: 22rpx;
  color: #0FBF9F;
  text-align: center;
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

.profile-banner {
  margin: 24rpx 24rpx 0;
  background: #FFF3E0;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1rpx solid #FFE0B2;
}

.banner-left {
  display: flex;
  align-items: center;
}

.banner-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.banner-text {
  font-size: 26rpx;
  color: #E65100;
}

.banner-arrow {
  font-size: 32rpx;
  color: #FFB74D;
}

.menu-section {
  background: #FFFFFF;
  margin: 24rpx 24rpx 24rpx;
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
