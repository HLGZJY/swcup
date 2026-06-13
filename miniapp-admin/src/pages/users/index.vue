<template>
  <view class="page">
    <!-- 搜索 -->
    <view class="search-bar">
    <view class="search-input-wrap">
        <image class="search-icon" src="/static/icons/icon-search.png" mode="aspectFit" />
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
        <text>共 {{ total }} 位用户</text>
      </view>

      <view
        v-for="u in users"
        :key="u.user_id"
        :class="['user-row', { 'user-row-blocked': u.role === 'blocked' }]"
      >
        <view class="user-info">
          <view class="info-header">
            <text class="nickname">{{ u.nickname }}</text>
            <view :class="['role-tag', 'role-' + u.role]">{{ roleMap[u.role] }}</view>
          </view>
          <text class="phone">{{ u.phone }}</text>
          <text class="join-date">注册于 {{ formatDate(u.created_at) }}</text>
        </view>
        <view class="user-actions">
          <uni-switch :checked="u.role === 'blocked'" @change="() => onToggleBlock(u)" />
          <text class="detail-link" @tap="goToDetail(u.user_id)">查看详情 →</text>
        </view>
      </view>

      <view class="loading-more" v-if="loadingMore">
        <text>加载中...</text>
      </view>
      <view class="no-more" v-else-if="!hasMore && users.length > 0">
        <text>— 没有更多了 —</text>
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
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #F5F5F5;
}

.search-bar {
  background: #FFFFFF;
  padding: 16rpx 24rpx;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  background: #F5F5F5;
  border-radius: 40rpx;
  padding: 16rpx 24rpx;
}

.search-icon { width: 32rpx; height: 32rpx; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 26rpx; }

.filter-tabs {
  display: flex;
  background: #FFFFFF;
  padding: 0 16rpx;
  border-bottom: 1rpx solid #EEEEEE;
}

.filter-tab {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  font-size: 26rpx;
  color: #666666;
}

.filter-tab.active {
  color: #FF6B6B;
  font-weight: 600;
}

.list-area {
  flex: 1;
  padding: 28rpx;
  box-sizing: border-box;
}

.total-bar {
  padding: 0 0 16rpx;
  font-size: 24rpx;
  color: #999999;
}

.user-row {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border-radius: 12rpx;
  padding: 20rpx;
  margin: 0 0 16rpx 0;
}

.user-row-blocked {
  opacity: 0.5;
}

.user-info {
  flex: 1;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 4rpx;
}

.nickname {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.role-tag {
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  color: #FFFFFF;
}

.role-user { background: #0FBF9F; }
.role-admin { background: #FF6B6B; }
.role-org { background: #FF9F00; }
.role-blocked { background: #999999; }

.user-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
  margin-left: 16rpx;
}

.detail-link {
  font-size: 22rpx;
  color: #FF6B6B;
}

.phone {
  font-size: 24rpx;
  color: #666666;
  display: block;
}

.join-date {
  font-size: 20rpx;
  color: #999999;
  display: block;
  margin-top: 4rpx;
}

.no-more {
  text-align: center;
  padding: 24rpx;
  font-size: 24rpx;
  color: #999999;
}

.loading-more {
  text-align: center;
  padding: 24rpx;
  font-size: 24rpx;
  color: #0FBF9F;
}
</style>