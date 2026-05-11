<template>
  <view class="page">
    <!-- 顶部统计 -->
    <view class="stats-header">
      <view class="header-bg"></view>
      <view class="admin-info">
        <text class="admin-title">管理后台</text>
        <text class="admin-sub">鼻纹智救 · 管理员</text>
      </view>
    </view>

    <!-- 快捷统计卡片 -->
    <view class="stats-card">
      <view class="stat-row">
        <view class="stat-item">
          <text class="stat-num">{{ stats.totalAnimals }}</text>
          <text class="stat-label">动物总数</text>
        </view>
        <view class="stat-item">
          <text class="stat-num lost">{{ stats.lostAnimals }}</text>
          <text class="stat-label">走失中</text>
        </view>
        <view class="stat-item">
          <text class="stat-num found">{{ stats.foundAnimals }}</text>
          <text class="stat-label">发现中</text>
        </view>
      </view>
      <view class="stat-row">
        <view class="stat-item">
          <text class="stat-num claimed">{{ stats.claimedAnimals }}</text>
          <text class="stat-label">待认领</text>
        </view>
        <view class="stat-item">
          <text class="stat-num pending">{{ stats.pendingEvents }}</text>
          <text class="stat-label">待审核事件</text>
        </view>
        <view class="stat-item">
          <text class="stat-num claim">{{ stats.pendingClaims }}</text>
          <text class="stat-label">待审核认领</text>
        </view>
      </view>
    </view>

    <!-- 今日概况 -->
    <view class="today-card">
      <text class="card-title">📊 今日概况</text>
      <view class="today-stats">
        <view class="today-item">
          <text class="today-num">{{ stats.todayReports }}</text>
          <text class="today-label">新增上报</text>
        </view>
        <view class="today-divider"></view>
        <view class="today-item">
          <text class="today-num">3</text>
          <text class="today-label">已完成</text>
        </view>
        <view class="today-divider"></view>
        <view class="today-item">
          <text class="today-num">2</text>
          <text class="today-label">处理中</text>
        </view>
      </view>
    </view>

    <!-- 待办事项 -->
    <view class="todo-section">
      <text class="section-title">⚡ 待办事项</text>

      <view class="todo-item" @click="goToAudit('events')">
        <view class="todo-left">
          <text class="todo-icon">📋</text>
          <view class="todo-info">
            <text class="todo-name">待审核事件</text>
            <text class="todo-desc">疑似重复/待确认的事件</text>
          </view>
        </view>
        <view class="todo-right">
          <view class="todo-badge" v-if="stats.pendingEvents > 0">{{ stats.pendingEvents }}</view>
          <text class="arrow">›</text>
        </view>
      </view>

      <view class="todo-item" @click="goToAudit('claims')">
        <view class="todo-left">
          <text class="todo-icon">🏠</text>
          <view class="todo-info">
            <text class="todo-name">待审核认领</text>
            <text class="todo-desc">用户提交的认领申请</text>
          </view>
        </view>
        <view class="todo-right">
          <view class="todo-badge claim" v-if="stats.pendingClaims > 0">{{ stats.pendingClaims }}</view>
          <text class="arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="quick-section">
      <text class="section-title">🔧 快捷入口</text>
      <view class="quick-grid">
        <view class="quick-item" @click="goToPage('/pages/animals/index')">
          <text class="quick-icon">🐕</text>
          <text class="quick-name">动物档案</text>
        </view>
        <view class="quick-item" @click="goToPage('/pages/events/index')">
          <text class="quick-icon">📑</text>
          <text class="quick-name">事件管理</text>
        </view>
        <view class="quick-item" @click="goToPage('/pages/users/index')">
          <text class="quick-icon">👥</text>
          <text class="quick-name">用户管理</text>
        </view>
        <view class="quick-item" @click="goToAudit('events')">
          <text class="quick-icon">✅</text>
          <text class="quick-name">审核中心</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { mockGetStats } from '@/services/mock'

const stats = ref({
  totalAnimals: 0, lostAnimals: 0, foundAnimals: 0, claimedAnimals: 0,
  pendingEvents: 0, pendingClaims: 0, todayReports: 0
})

onMounted(async () => {
  const res: any = await mockGetStats()
  if (res.code === 0) {
    stats.value = res.data
  }
})

function goToAudit(type: string) {
  uni.navigateTo({ url: `/pages/admin/audit/index?type=${type}` })
}

function goToPage(url: string) {
  uni.switchTab({ url })
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F5F5;
}

.stats-header {
  background: linear-gradient(135deg, #1A1A1A 0%, #333333 100%);
  padding: 32rpx 24rpx 80rpx;
}

.admin-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #FFFFFF;
  display: block;
}

.admin-sub {
  font-size: 24rpx;
  color: rgba(255,255,255,0.6);
  display: block;
  margin-top: 4rpx;
}

.stats-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  margin: -60rpx 24rpx 24rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.1);
}

.stat-row {
  display: flex;
  margin-bottom: 24rpx;
}

.stat-row:last-child {
  margin-bottom: 0;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-num {
  font-size: 44rpx;
  font-weight: 700;
  color: #0FBF9F;
  display: block;
}

.stat-num.lost { color: #FF6B6B; }
.stat-num.found { color: #0FBF9F; }
.stat-num.claimed { color: #FF9F00; }
.stat-num.pending { color: #FF6B6B; }
.stat-num.claim { color: #FF9F00; }

.stat-label {
  font-size: 22rpx;
  color: #999999;
  display: block;
  margin-top: 4rpx;
}

.today-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  margin: 0 24rpx 24rpx;
  padding: 24rpx 32rpx;
}

.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
  display: block;
  margin-bottom: 16rpx;
}

.today-stats {
  display: flex;
  align-items: center;
}

.today-item {
  flex: 1;
  text-align: center;
}

.today-num {
  font-size: 36rpx;
  font-weight: 700;
  color: #FF6B6B;
  display: block;
}

.today-label {
  font-size: 22rpx;
  color: #999999;
  display: block;
  margin-top: 4rpx;
}

.today-divider {
  width: 1rpx;
  height: 60rpx;
  background: #EEEEEE;
}

.todo-section, .quick-section {
  background: #FFFFFF;
  border-radius: 16rpx;
  margin: 0 24rpx 24rpx;
  padding: 24rpx 32rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
  display: block;
  margin-bottom: 16rpx;
}

.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F5F5F5;
}

.todo-item:last-child {
  border-bottom: none;
}

.todo-left {
  display: flex;
  align-items: center;
}

.todo-icon {
  font-size: 40rpx;
  margin-right: 16rpx;
}

.todo-info {
  display: flex;
  flex-direction: column;
}

.todo-name {
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 600;
}

.todo-desc {
  font-size: 22rpx;
  color: #999999;
  margin-top: 4rpx;
}

.todo-right {
  display: flex;
  align-items: center;
}

.todo-badge {
  background: #FF6B6B;
  color: #FFFFFF;
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  margin-right: 12rpx;
}

.todo-badge.claim {
  background: #FF9F00;
}

.arrow {
  font-size: 32rpx;
  color: #CCCCCC;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 8rpx;
  background: #F5F5F5;
  border-radius: 12rpx;
}

.quick-icon {
  font-size: 36rpx;
  margin-bottom: 8rpx;
}

.quick-name {
  font-size: 20rpx;
  color: #666666;
}
</style>
