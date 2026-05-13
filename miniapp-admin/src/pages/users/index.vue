<template>
  <view class="page">
    <!-- 搜索 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
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
    <scroll-view class="list-area" scroll-y>
      <view class="total-bar">
        <text>共 {{ users.length }} 位用户</text>
      </view>

      <view
        v-for="u in users"
        :key="u.user_id"
        class="user-row"
      >
        <image class="user-avatar" src="/static/mock/avatar-default.png" mode="aspectFill" />
        <view class="user-info">
          <view class="info-header">
            <text class="nickname">{{ u.nickname }}</text>
            <view :class="['role-tag', 'role-' + u.role]">{{ roleMap[u.role] }}</view>
          </view>
          <text class="phone">{{ u.phone }}</text>
          <text class="join-date">注册于 {{ formatDate(u.created_at) }}</text>
        </view>
      </view>

      <view class="no-more" v-if="users.length > 0">
        <text>— 没有更多了 —</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { mockGetUsers, mockUsers } from '@/services/mock'

const keyword = ref('')
const users = ref<any[]>([])

const roleTabs = [
  { label: '全部', value: 'all' },
  { label: '普通用户', value: 'user' },
  { label: '管理员', value: 'admin' },
  { label: '机构', value: 'org' }
]
const currentRole = ref('all')

const roleMap: Record<string, string> = {
  user: '普通用户', admin: '管理员', org: '机构'
}

onMounted(async () => {
  const res: any = await mockGetUsers()
  if (res.code === 0) {
    users.value = res.data.list
  }
})

function onSearch() {
  // filter locally for mock
  mockGetUsers().then((res: any) => {
    if (res.code === 0) {
      if (keyword.value) {
        users.value = res.data.list.filter((u: any) =>
          u.nickname.includes(keyword.value) || u.phone.includes(keyword.value)
        )
      } else {
        users.value = res.data.list
      }
    }
  })
}

function onFilterRole(role: string) {
  currentRole.value = role
  if (role === 'all') {
    users.value = [...mockUsers]
  } else {
    users.value = mockUsers.filter(u => u.role === role)
  }
}

function formatDate(isoString: string) {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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

.search-icon { font-size: 28rpx; margin-right: 12rpx; }
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
  padding: 24rpx;
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
  margin-bottom: 16rpx;
}

.user-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  margin-right: 16rpx;
  background: #F5F5F5;
  flex-shrink: 0;
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
</style>
