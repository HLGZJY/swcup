<template>
  <view class="page">
    <!-- 搜索 -->
    <view class="search-bar">
    <view class="search-input-wrap">
        <image class="search-icon" src="/static/icons/icon-search.svg" mode="aspectFit" />
        <input class="search-input" placeholder="搜索用户昵称/手机号" v-model="keyword" @confirm="onSearch" />
      </view>
    </view>

    <!-- 角色筛选 -->
    <view class="filter-tabs">
      <view
        v-for="tab in roleTabs"
        :key="tab.value"
        :class="['filter-tab', { active: currentRole === tab.value }]"
        @click="onFilterRole(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <!-- 用户列表 -->
    <scroll-view
      class="list-area"
      scroll-y
      @scrolltolower="onLoadMore"
    >
      <view class="total-bar">
        <text class="total-num">{{ total }}</text>
        <text class="total-label">位用户</text>
      </view>

      <view
        v-for="u in users"
        :key="u.user_id"
        :class="['user-row', { 'user-row-blocked': u.role === 'blocked' }]"
        @click="goToDetail(u.user_id)"
      >
        <view class="card-accent" :class="'accent-' + u.role"></view>
        <view class="card-content">
          <view class="user-info">
            <view class="info-header">
              <text class="nickname">{{ u.nickname }}</text>
              <view :class="['role-tag', 'role-' + u.role]">
                <view class="role-dot"></view>
                <text>{{ roleMap[u.role] }}</text>
              </view>
            </view>
            <text class="phone">{{ u.phone }}</text>
            <text class="join-date">注册于 {{ formatDate(u.created_at) }}</text>
          </view>
          <view class="user-actions" @click.stop>
            <uni-switch :checked="u.role === 'blocked'" @change="() => onToggleBlock(u)" />
            <view class="detail-link" @click="goToDetail(u.user_id)">
              <text>查看详情</text>
              <image class="detail-arrow" src="/static/icons/icon-chevron-right.svg" mode="aspectFit" />
            </view>
          </view>
        </view>
      </view>

      <view class="loading-more" v-if="loadingMore">
        <view class="loading-spinner-small"></view>
        <text>加载中...</text>
      </view>
      <view class="no-more" v-else-if="!hasMore && users.length > 0">
        <view class="no-more-line"></view>
        <text>— 没有更多了 —</text>
        <view class="no-more-line"></view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAdminUsers, apiUpdateUser } from '@/services/api'

const keyword = ref('')
const users = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const hasMore = ref(true)
const loadingMore = ref(false)

const roleTabs = [
  { label: '全部', value: 'all' },
  { label: '普通用户', value: 'user' },
  { label: '管理员', value: 'admin' },
  { label: '机构', value: 'org' },
  { label: '已禁用', value: 'blocked' }
]
const currentRole = ref('all')

const roleMap: Record<string, string> = {
  user: '普通用户', admin: '管理员', org: '机构', blocked: '已禁用'
}

// TabBar 页面切换时 onMounted 触发
onMounted(() => {
  console.log('[DEBUG] users onMounted fired, calling loadUsers')
  loadUsers()
})

async function loadUsers() {
  try {
    const res: any = await apiGetAdminUsers({
      page: 1,
      limit: limit.value,
      role: currentRole.value === 'all' ? undefined : currentRole.value,
      keyword: keyword.value.trim() || undefined
    })
    if (res.code === 0) {
      users.value = res.data?.list || []
      total.value = res.data?.total || 0
      hasMore.value = users.value.length < total.value
      page.value = 1
    }
  } catch (e) {
    console.error('加载用户列表失败', e)
    uni.showToast({ title: '加载失败，请重试', icon: 'none' })
  }
}

async function onLoadMore() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    const res: any = await apiGetAdminUsers({
      page: page.value + 1,
      limit: limit.value,
      role: currentRole.value === 'all' ? undefined : currentRole.value,
      keyword: keyword.value.trim() || undefined
    })
    if (res.code === 0) {
      const newUsers = res.data?.list || []
      users.value = [...users.value, ...newUsers]
      total.value = res.data?.total || 0
      hasMore.value = users.value.length < total.value
      page.value++
    }
  } catch (e) {
    console.error('加载更多用户失败', e)
  }
  loadingMore.value = false
}

function onSearch() {
  loadUsers()
}

function onFilterRole(role: string) {
  currentRole.value = role
  loadUsers()
}

function formatDate(isoString: string) {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const onToggleBlock = async (user: any) => {
  const newRole = user.role === 'blocked' ? 'user' : 'blocked'
  try {
    await apiUpdateUser(user.user_id, { role: newRole })
    loadUsers()
  } catch (e) {
    console.error('切换用户状态失败', e)
    uni.showToast({ title: '操作失败，请重试', icon: 'none' })
  }
}

const goToDetail = (userId: number) => {
  uni.navigateTo({ url: `/pages/users/detail/index?user_id=${userId}` })
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #F5F7FA;
}

.search-bar {
  background: #FFFFFF;
  padding: 16rpx 24rpx;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  background: #F5F7FA;
  border-radius: 40rpx;
  padding: 16rpx 24rpx;
  border: 2rpx solid transparent;
  transition: border-color 0.2s, background 0.2s;
}

.search-input-wrap:focus-within {
  border-color: #0FBF9F;
  background: #FFFFFF;
}

.search-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 12rpx;
  color: #999999;
  flex-shrink: 0;
}

.search-input-wrap:focus-within .search-icon {
  color: #0FBF9F;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1A1A1A;
}

.filter-tabs {
  display: flex;
  background: #FFFFFF;
  padding: 0 16rpx;
  border-bottom: 1rpx solid #F0F0F0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.filter-tab {
  flex: 0 0 auto;
  text-align: center;
  padding: 24rpx 16rpx;
  font-size: 26rpx;
  color: #666666;
  position: relative;
  white-space: nowrap;
}

.filter-tab.active {
  color: #FF6B6B;
  font-weight: 600;
}

.filter-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 32rpx;
  height: 4rpx;
  background: #FF6B6B;
  border-radius: 2rpx;
}

.list-area {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
  height: 0;
}

.total-bar {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
  padding: 0 8rpx 16rpx;
}

.total-num {
  font-size: 32rpx;
  font-weight: 800;
  color: #0FBF9F;
  font-variant-numeric: tabular-nums;
}

.total-label {
  font-size: 24rpx;
  color: #999999;
}

/* 用户卡 — 圆角+阴影+左侧色条 */
.user-row {
  position: relative;
  display: flex;
  align-items: stretch;
  background: #FFFFFF;
  border-radius: 20rpx;
  margin: 0 0 16rpx 0;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);
  overflow: hidden;
  transition: transform 0.1s, background 0.2s;
}

.user-row:active {
  transform: scale(0.99);
}

/* 6rpx 左侧色条（按 role 变色）*/
.card-accent {
  width: 6rpx;
  flex-shrink: 0;
}

.accent-user    { background: linear-gradient(180deg, #0FBF9F 0%, #07C160 100%); }
.accent-admin   { background: linear-gradient(180deg, #FF6B6B 0%, #E53A3A 100%); }
.accent-org     { background: linear-gradient(180deg, #FFB84D 0%, #FF9F00 100%); }
.accent-blocked { background: linear-gradient(180deg, #BBBBBB 0%, #888888 100%); }
.accent-other   { background: #EEEEEE; }

.card-content {
  flex: 1;
  display: flex;
  padding: 20rpx 20rpx 20rpx 16rpx;
  min-width: 0;
  gap: 12rpx;
}

/* 已禁用行：灰底弱化 */
.user-row-blocked {
  background: #F5F5F5;
}

.user-row-blocked .nickname,
.user-row-blocked .phone {
  color: #999999;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 8rpx;
  flex-wrap: wrap;
}

.nickname {
  font-size: 30rpx;
  font-weight: 700;
  color: #1A1A1A;
}

/* 角色 tag — 圆点+浅底（4 种颜色） */
.role-tag {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx 12rpx 4rpx 10rpx;
  border-radius: 10rpx;
  background: rgba(15, 191, 159, 0.1);
  color: #0FBF9F;
}

.role-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.role-user    { background: rgba(15, 191, 159, 0.1);  color: #0FBF9F; }
.role-admin   { background: rgba(255, 107, 107, 0.1); color: #FF6B6B; }
.role-org     { background: rgba(255, 159, 0, 0.1);   color: #FF9F00; }
.role-blocked { background: rgba(187, 187, 187, 0.18); color: #888888; }

.user-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14rpx;
  flex-shrink: 0;
  padding-top: 4rpx;
}

.detail-link {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  font-size: 24rpx;
  color: #FF6B6B;
  font-weight: 500;
  padding: 4rpx 6rpx;
}

.detail-arrow {
  width: 24rpx;
  height: 24rpx;
  color: #FF6B6B;
}

.phone {
  font-size: 26rpx;
  color: #666666;
  display: block;
  font-variant-numeric: tabular-nums;
}

.join-date {
  font-size: 22rpx;
  color: #999999;
  display: block;
  margin-top: 4rpx;
}

.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx 0;
  font-size: 22rpx;
  color: #BBBBBB;
  gap: 16rpx;
}

.no-more-line {
  width: 60rpx;
  height: 1rpx;
  background: #DDDDDD;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx 0;
  font-size: 24rpx;
  color: #0FBF9F;
  gap: 12rpx;
}

.loading-spinner-small {
  width: 28rpx;
  height: 28rpx;
  border: 3rpx solid #F0F0F0;
  border-top-color: #0FBF9F;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>