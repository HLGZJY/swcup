<template>
  <view class="page">
    <!-- 顶部 Hero 区：渐变 + 欢迎语 + 退出 -->
    <view class="hero">
      <view class="hero-bg"></view>
      <view class="hero-content">
        <view class="hero-left">
          <text class="hero-greeting">{{ greeting }}，{{ adminName }}</text>
          <text class="hero-date">{{ todayStr }}</text>
        </view>
        <view class="logout-btn" @click="handleLogout" aria-label="退出登录">
          <image class="logout-icon" src="/static/icons/icon-logout.svg" mode="aspectFit" />
        </view>
      </view>
    </view>

    <!-- 主统计卡片（6 项） -->
    <view class="stats-card">
      <view class="stats-card-header">
        <text class="stats-card-title">系统概览</text>
        <text class="stats-card-sub">实时数据</text>
      </view>
      <view class="stats-grid">
        <view class="stat-cell" @click="goToPage('/pages/animals/index')">
          <text class="stat-num" style="color: #0FBF9F;">{{ stats.totalAnimals }}</text>
          <text class="stat-label">动物总数</text>
        </view>
        <view class="stat-cell" @click="goToPage('/pages/animals/index')">
          <text class="stat-num" style="color: #FF6B6B;">{{ stats.lostAnimals }}</text>
          <text class="stat-label">走失中</text>
        </view>
        <view class="stat-cell" @click="goToPage('/pages/animals/index')">
          <text class="stat-num" style="color: #0FBF9F;">{{ stats.foundAnimals }}</text>
          <text class="stat-label">发现中</text>
        </view>
        <view class="stat-cell" @click="goToPage('/pages/animals/index')">
          <text class="stat-num" style="color: #FF9F00;">{{ stats.claimedAnimals }}</text>
          <text class="stat-label">待认领</text>
        </view>
        <view class="stat-cell" @click="goToAudit('events')">
          <text class="stat-num" style="color: #FF6B6B;">{{ stats.pendingEvents }}</text>
          <text class="stat-label">待审事件</text>
        </view>
        <view class="stat-cell" @click="goToAudit('claims')">
          <text class="stat-num" style="color: #FF9F00;">{{ stats.pendingClaims }}</text>
          <text class="stat-label">待审认领</text>
        </view>
      </view>
    </view>

    <!-- 今日概况 -->
    <view class="section-card">
      <view class="section-header">
        <view class="section-title-wrap">
          <image class="section-icon" src="/static/icons/icon-trending-up.svg" mode="aspectFit" />
          <text class="section-title">今日概况</text>
        </view>
        <text class="section-meta">截至 {{ nowTime }}</text>
      </view>
      <view class="today-stats">
        <view class="today-item">
          <text class="today-num today-num--primary">{{ stats.todayReports }}</text>
          <text class="today-label">新增上报</text>
        </view>
        <view class="today-divider"></view>
        <view class="today-item">
          <text class="today-num today-num--success">{{ stats.todayResolved }}</text>
          <text class="today-label">已完成</text>
        </view>
        <view class="today-divider"></view>
        <view class="today-item">
          <text class="today-num today-num--warning">{{ stats.todayProcessing }}</text>
          <text class="today-label">处理中</text>
        </view>
      </view>
    </view>

    <!-- 待办事项 -->
    <view class="section-card">
      <view class="section-header">
        <view class="section-title-wrap">
          <image class="section-icon" src="/static/icons/icon-sparkles.svg" mode="aspectFit" />
          <text class="section-title">待办事项</text>
        </view>
        <text class="section-meta">优先处理</text>
      </view>

      <view class="todo-item todo-item--event" @click="goToAudit('events')">
        <view class="todo-left">
          <view class="todo-icon-wrap todo-icon-wrap--event">
            <image class="todo-icon-img" src="/static/icons/icon-event.svg" mode="aspectFit" />
          </view>
          <view class="todo-info">
            <text class="todo-name">待审核事件</text>
            <text class="todo-desc">疑似重复 / 待确认的事件</text>
          </view>
        </view>
        <view class="todo-right">
          <view class="todo-badge todo-badge--event" v-if="stats.pendingEvents > 0">
            {{ stats.pendingEvents }}
          </view>
          <image class="arrow" src="/static/icons/icon-chevron-right.svg" mode="aspectFit" />
        </view>
      </view>

      <view class="todo-item todo-item--claim" @click="goToAudit('claims')">
        <view class="todo-left">
          <view class="todo-icon-wrap todo-icon-wrap--claim">
            <image class="todo-icon-img" src="/static/icons/icon-shield.svg" mode="aspectFit" />
          </view>
          <view class="todo-info">
            <text class="todo-name">待审核认领</text>
            <text class="todo-desc">用户提交的认领申请</text>
          </view>
        </view>
        <view class="todo-right">
          <view class="todo-badge todo-badge--claim" v-if="stats.pendingClaims > 0">
            {{ stats.pendingClaims }}
          </view>
          <image class="arrow" src="/static/icons/icon-chevron-right.svg" mode="aspectFit" />
        </view>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="section-card section-card--last">
      <view class="section-header">
        <view class="section-title-wrap">
          <image class="section-icon" src="/static/icons/icon-grid.svg" mode="aspectFit" />
          <text class="section-title">快捷入口</text>
        </view>
      </view>
      <view class="quick-grid">
        <view class="quick-item" @click="goToPage('/pages/animals/index')">
          <view class="quick-icon-wrap quick-icon-wrap--paw">
            <image class="quick-icon-img" src="/static/icons/icon-paw-filled.svg" mode="aspectFit" />
          </view>
          <text class="quick-name">动物档案</text>
        </view>
        <view class="quick-item" @click="goToPage('/pages/events/index')">
          <view class="quick-icon-wrap quick-icon-wrap--event">
            <image class="quick-icon-img" src="/static/icons/icon-event.svg" mode="aspectFit" />
          </view>
          <text class="quick-name">事件管理</text>
        </view>
        <view class="quick-item" @click="goToPage('/pages/users/index')">
          <view class="quick-icon-wrap quick-icon-wrap--users">
            <image class="quick-icon-img" src="/static/icons/icon-users.svg" mode="aspectFit" />
          </view>
          <text class="quick-name">用户管理</text>
        </view>
        <view class="quick-item" @click="goToAudit('events')">
          <view class="quick-icon-wrap quick-icon-wrap--check">
            <image class="quick-icon-img" src="/static/icons/icon-check-circle.svg" mode="aspectFit" />
          </view>
          <text class="quick-name">审核中心</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiGetStats } from '@/services/api'

const stats = ref({
  totalAnimals: 0, lostAnimals: 0, foundAnimals: 0, claimedAnimals: 0,
  pendingEvents: 0, pendingClaims: 0, todayReports: 0, todayResolved: 0, todayProcessing: 0
})

// 顶部欢迎语 + 管理员名
const adminName = computed(() => {
  try {
    const u = uni.getStorageSync('user_info')
    return u?.nickname || u?.name || '管理员'
  } catch { return '管理员' }
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '凌晨好'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const todayStr = computed(() => {
  const d = new Date()
  const w = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} · ${w}`
})

const nowTime = computed(() => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
})

onMounted(async () => {
  try {
    const res: any = await apiGetStats()
    console.log('[ADMIN-INDEX] stats res=', JSON.stringify(res))
    if (res.code === 0) {
      Object.assign(stats.value, res.data)
      console.log('[ADMIN-INDEX] stats after assign=', JSON.stringify(stats.value))
    }
  } catch (e) {
    console.error('[ADMIN-INDEX] stats error=', e)
  }
})

function goToAudit(type: string) {
  uni.reLaunch({ url: `/pages/admin/audit/index?type=${type}` })
}

function goToPage(url: string) {
  uni.switchTab({ url })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出管理后台吗？',
    confirmText: '退出',
    cancelText: '取消',
    confirmColor: '#FF6B6B',
    success: (r) => {
      if (r.confirm) {
        uni.removeStorageSync('token')
        uni.removeStorageSync('adminInfo')
        uni.reLaunch({ url: '/pages/login/login' })
      }
    }
  })
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 40rpx;
}

/* ============ 顶部 Hero ============ */
.hero {
  position: relative;
  background: linear-gradient(135deg, #1A1A1A 0%, #2D3748 100%);
  padding: 24rpx 32rpx 120rpx;  /* 底部留白给 stats-card 浮起 */
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  top: -200rpx;
  right: -200rpx;
  width: 600rpx;
  height: 600rpx;
  background: radial-gradient(circle, rgba(15,191,159,0.18) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 40rpx;
}

.hero-left {
  display: flex;
  flex-direction: column;
}

.hero-greeting {
  font-size: 36rpx;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: 1rpx;
}

.hero-date {
  font-size: 24rpx;
  color: rgba(255,255,255,0.55);
  margin-top: 8rpx;
  letter-spacing: 1rpx;
}

.logout-btn {
  width: 72rpx;
  height: 72rpx;
  background: rgba(255,255,255,0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(255,255,255,0.08);
  transition: background 0.2s;
}

.logout-btn:active {
  background: rgba(255,255,255,0.2);
}

.logout-icon {
  width: 36rpx;
  height: 36rpx;
  /* SVG currentColor → 强制白色 */
  filter: brightness(0) invert(1);
  opacity: 0.85;
}

/* ============ 主统计卡片（6 项 grid） ============ */
.stats-card {
  background: #FFFFFF;
  border-radius: 24rpx;
  margin: -80rpx 24rpx 24rpx;
  padding: 28rpx 24rpx 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.08);
  position: relative;
  z-index: 1;
}

.stats-card-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 24rpx;
  padding: 0 4rpx;
}

.stats-card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1A1A1A;
}

.stats-card-sub {
  font-size: 22rpx;
  color: #999999;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 8rpx;
  border-radius: 12rpx;
  transition: background 0.2s;
}

.stat-cell:active {
  background: #F5F7FA;
}

.stat-num {
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 22rpx;
  color: #999999;
  margin-top: 8rpx;
}

/* ============ 通用 section 卡片 ============ */
.section-card {
  background: #FFFFFF;
  border-radius: 24rpx;
  margin: 0 24rpx 24rpx;
  padding: 24rpx 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}

.section-card--last {
  margin-bottom: 40rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-title-wrap {
  display: flex;
  align-items: center;
}

.section-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 10rpx;
  color: #0FBF9F;
  flex-shrink: 0;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.section-meta {
  font-size: 22rpx;
  color: #BBBBBB;
}

/* ============ 今日概况 ============ */
.today-stats {
  display: flex;
  align-items: center;
  padding: 8rpx 0 4rpx;
}

.today-item {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.today-num {
  font-size: 44rpx;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

/* 语义色：新增（主题色）/ 完成（成功色）/ 处理中（警告色） */
.today-num--primary { color: #0FBF9F; }
.today-num--success { color: #07C160; }
.today-num--warning { color: #FF9F00; }

.today-label {
  font-size: 22rpx;
  color: #999999;
  margin-top: 8rpx;
}

.today-divider {
  width: 1rpx;
  height: 56rpx;
  background: #EEEEEE;
}

/* ============ 待办事项 ============ */
.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 16rpx 20rpx 20rpx;
  border-radius: 16rpx;
  background: #FAFBFC;
  margin-bottom: 12rpx;
  position: relative;
  overflow: hidden;
  transition: background 0.2s, transform 0.1s;
}

/* 左侧 4px 强调边（颜色随类型） */
.todo-item::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 6rpx;
  border-radius: 0 6rpx 6rpx 0;
}

.todo-item--event::before { background: #FF6B6B; }
.todo-item--claim::before { background: #FF9F00; }

.todo-item:last-child { margin-bottom: 0; }

.todo-item:active {
  background: #F0F2F5;
  transform: scale(0.99);
}

.todo-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.todo-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.todo-icon-wrap--event {
  background: rgba(255, 107, 107, 0.1);
}
.todo-icon-wrap--event .todo-icon-img {
  filter: none;
  color: #FF6B6B;
}

.todo-icon-wrap--claim {
  background: rgba(255, 159, 0, 0.1);
}
.todo-icon-wrap--claim .todo-icon-img {
  color: #FF9F00;
}

.todo-icon-img {
  width: 36rpx;
  height: 36rpx;
}

.todo-info {
  display: flex;
  flex-direction: column;
  flex: 1;
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
  gap: 12rpx;
}

.todo-badge {
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 12rpx;
  color: #FFFFFF;
  font-size: 22rpx;
  font-weight: 600;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

.todo-badge--event { background: #FF6B6B; }
.todo-badge--claim { background: #FF9F00; }

.arrow {
  width: 28rpx;
  height: 28rpx;
  color: #CCCCCC;
  flex-shrink: 0;
}

/* ============ 快捷入口 ============ */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin-top: 4rpx;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 8rpx 20rpx;
  border-radius: 16rpx;
  transition: background 0.2s, transform 0.1s;
}

.quick-item:active {
  background: #F5F7FA;
  transform: scale(0.97);
}

.quick-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
}

.quick-icon-wrap--paw    { background: rgba(15, 191, 159, 0.1); }
.quick-icon-wrap--event  { background: rgba(255, 107, 107, 0.1); }
.quick-icon-wrap--users  { background: rgba(76, 144, 230, 0.1); }
.quick-icon-wrap--check  { background: rgba(255, 159, 0, 0.1); }

.quick-icon-wrap--paw   .quick-icon-img { color: #0FBF9F; }
.quick-icon-wrap--event .quick-icon-img { color: #FF6B6B; }
.quick-icon-wrap--users .quick-icon-img { color: #4C90E6; }
.quick-icon-wrap--check .quick-icon-img { color: #FF9F00; }

.quick-icon-img {
  width: 44rpx;
  height: 44rpx;
}

.quick-name {
  font-size: 22rpx;
  color: #666666;
  font-weight: 500;
}
</style>
