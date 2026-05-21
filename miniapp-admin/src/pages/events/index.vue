<template>
  <view class="page">
    <!-- 搜索 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon-img" src="/static/icons/icon-search.png" mode="aspectFit" />
        <input class="search-input" placeholder="搜索事件描述/地址" v-model="keyword" @confirm="onSearch" />
      </view>
    </view>

    <!-- 状态筛选 -->
    <view class="filter-tabs">
      <view
        v-for="tab in statusTabs"
        :key="tab.value"
        :class="['filter-tab', { active: currentStatus === tab.value }]"
        @click="onFilter(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <!-- 事件列表 -->
    <scroll-view class="list-area" scroll-y @scrolltolower="onLoadMore">
      <view class="empty-state" v-if="events.length === 0 && !loading">
        <image class="empty-icon-img" src="/static/icons/icon-filetext.png" mode="aspectFit" />
        <text class="empty-text">暂无事件</text>
      </view>

      <view
        v-for="item in events"
        :key="item.event_id"
        class="event-card"
        @click="goToDetail(item.event_id)"
      >
        <view class="event-header">
          <text :class="['event-type', 'type-' + item.event_type]">{{ eventTypeMap[item.event_type] }}</text>
          <view :class="['status-badge', 'status-' + item.status]">{{ statusMap[item.status] }}</view>
        </view>

        <text class="event-desc">{{ item.description }}</text>

        <view class="event-meta">
          <view class="meta-item">
            <image class="meta-icon" src="/static/icons/icon-mappin.png" mode="aspectFit" />
            <text>{{ item.address }}</text>
          </view>
          <view class="meta-item">
            <image class="meta-icon" src="/static/icons/icon-clock.png" mode="aspectFit" />
            <text>{{ formatTime(item.occurred_at) }}</text>
          </view>
        </view>

        <view class="event-footer">
          <text class="reporter">上报人: {{ item.reporter_id }}</text>
          <text class="score" v-if="item.fusion_score">
            融合得分: {{ (item.fusion_score * 100).toFixed(0) }}%
          </text>
        </view>
      </view>

      <view class="no-more" v-if="!hasMore && events.length > 0">
        <text>— 没有更多了 —</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAdminEvents } from '@/services/api'

const keyword = ref('')
const currentStatus = ref('all')
const events = ref<any[]>([])
const loading = ref(false)
const hasMore = ref(true)

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: 'pending' },
  { label: '已确认', value: 'confirmed' },
  { label: '已完成', value: 'resolved' }
]

const statusMap: Record<string, string> = {
  pending: '待处理', confirmed: '已确认', duplicated: '重复', linked: '关联', resolved: '已完成', rejected: '已驳回'
}

const eventTypeMap: Record<string, string> = {
  report: '上报', rescue: '救助', medical: '医疗', adopt: '领养', transfer: '转运', release: '放归'
}

// TabBar 页面切换时 onMounted 触发
onMounted(() => {
  console.log('[DEBUG] events onMounted fired, calling loadEvents')
  loadEvents()
})

async function loadEvents() {
  if (loading.value) return
  loading.value = true

const params: any = { page: 1, limit: 20 }
  if (currentStatus.value !== 'all') params.status = currentStatus.value
  if (keyword.value) params.keyword = keyword.value

  try {
    console.log('[PAGE] apiGetAdminEvents called'); const res: any = await apiGetAdminEvents(params)
    if (res.code === 0) {
      events.value = res.data?.list || []
      hasMore.value = (res.data?.total || 0) > events.value.length
    }
  } catch (e) {
    console.error('加载事件列表失败', e)
    uni.showToast({ title: '加载失败，请重试', icon: 'none' })
  }
  loading.value = false
}

function onSearch() {
  events.value = []
  loadEvents()
}

function onFilter(status: string) {
  currentStatus.value = status
  events.value = []
  loadEvents()
}

function onLoadMore() {
  if (!hasMore.value) return
  loadEvents()
}

function formatTime(isoString: string) {
  const d = new Date(isoString)
  return `${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function goToDetail(eventId: string) {
  uni.navigateTo({ url: `/pages/events/detail/index?event_id=${eventId}` })
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

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.search-icon-img {
  width: 28rpx;
  height: 28rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
}

.filter-tabs {
  display: flex;
  background: #FFFFFF;
  padding: 0 36rpx;
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
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon { font-size: 80rpx; margin-bottom: 16rpx; }
.empty-icon-img { width: 80rpx; height: 80rpx; margin-bottom: 16rpx; }
.empty-text { font-size: 28rpx; color: #999999; }

.event-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  cursor: pointer;
}

.event-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.event-type {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: #E8FDF8;
  color: #0FBF9F;
}

.type-rescue { background: #FFF0F0; color: #FF6B6B; }
.type-medical { background: #FFF8E8; color: #FF9F00; }

.status-badge {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  color: #FFFFFF;
}

.status-pending { background: #FF9F00; }
.status-confirmed { background: #07C160; }
.status-resolved { background: #0FBF9F; }
.status-rejected { background: #999999; }

.event-desc {
  font-size: 26rpx;
  color: #1A1A1A;
  display: block;
  margin-bottom: 12rpx;
}

.event-meta {
  display: flex;
  gap: 24rpx;
  margin-bottom: 12rpx;
}

.meta-item {
  font-size: 22rpx;
  color: #999999;
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.meta-icon {
  width: 20rpx;
  height: 20rpx;
  flex-shrink: 0;
}

.event-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12rpx;
  border-top: 1rpx solid #F5F5F5;
}

.reporter {
  font-size: 22rpx;
  color: #999999;
}

.score {
  font-size: 22rpx;
  color: #FF6B6B;
  font-weight: 600;
}

.no-more {
  text-align: center;
  padding: 24rpx;
  font-size: 24rpx;
  color: #999999;
}
</style>
