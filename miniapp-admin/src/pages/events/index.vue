<template>
  <view class="page">
    <!-- 搜索 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon-img" src="/static/icons/icon-search.svg" mode="aspectFit" />
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
        <image class="empty-icon-img" src="/static/icons/icon-list.svg" mode="aspectFit" />
        <text class="empty-text">暂无事件</text>
      </view>

      <view
        v-for="item in events"
        :key="item.event_id"
        class="event-card"
        @click="goToDetail(item.event_id)"
      >
        <view class="card-accent" :class="'accent-' + item.status"></view>
        <view class="card-content">
          <view class="event-header">
            <view :class="['event-type', 'type-' + item.event_type]">
              <view class="type-dot" :class="'type-dot-' + item.event_type"></view>
              <text>{{ eventTypeMap[item.event_type] }}</text>
            </view>
            <view :class="['status-badge', 'status-' + item.status]">
              <view class="status-dot" :class="'status-dot-' + item.status"></view>
              <text>{{ statusMap[item.status] }}</text>
            </view>
          </view>

          <text class="event-desc">{{ formatEventDesc(item) }}</text>

          <view class="event-meta">
            <view class="meta-item">
              <image class="meta-icon" src="/static/icons/icon-mappin.svg" mode="aspectFit" />
              <text>{{ formatEventAddress(item) }}</text>
            </view>
            <view class="meta-item">
              <image class="meta-icon" src="/static/icons/icon-clock.svg" mode="aspectFit" />
              <text>{{ formatTime(item.occurred_at) }}</text>
            </view>
          </view>

          <view class="event-footer">
            <text class="reporter">上报人: {{ item.reporter_id }}</text>
            <view v-if="item.fusion_score" :class="['score', 'score-' + fusionLevel(item.fusion_score)]">
              <text class="score-label">融合度</text>
              <text class="score-num">{{ (item.fusion_score * 100).toFixed(0) }}%</text>
            </view>
          </view>
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
  { label: '已完成', value: 'resolved' },
  { label: '重复', value: 'duplicated' },
  { label: '已驳回', value: 'rejected' }
]

const statusMap: Record<string, string> = {
  pending: '待处理', confirmed: '已确认', duplicated: '重复', linked: '关联', resolved: '已完成', rejected: '已驳回'
}

const eventTypeMap: Record<string, string> = {
  collect: '采集', report: '上报', rescue: '救助', medical: '医疗', adopt: '领养', transfer: '转运', release: '放归'
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

// collect 类型在 DB 中 description/address 为 NULL 是预期行为,前端按类型兜底
function formatEventDesc(item: any) {
  if (item.description) return item.description
  if (item.event_type === 'collect') return '[鼻纹采集]'
  return '无描述'
}

// 融合度分级（高=红/中=橙/低=灰）— 仅 UI 配色使用
function fusionLevel(score: number): string {
  if (score >= 0.88) return 'high'
  if (score >= 0.75) return 'mid'
  return 'low'
}

function formatEventAddress(item: any) {
  if (item.address) return item.address
  if (item.location_lat && item.location_lng) {
    return `${Number(item.location_lat).toFixed(4)}, ${Number(item.location_lng).toFixed(4)}`
  }
  return '未知地点'
}

function goToDetail(eventId: string) {
  uni.navigateTo({ url: `/pages/events/detail/index?event_id=${eventId}` })
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
  font-size: 28rpx;
  margin-right: 12rpx;
}

.search-icon-img {
  width: 28rpx;
  height: 28rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
  color: #999999;
}

.search-input-wrap:focus-within .search-icon-img {
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0 120rpx;
  min-height: 60vh;
}

.empty-icon { font-size: 80rpx; margin-bottom: 16rpx; }
.empty-icon-img {
  width: 96rpx;
  height: 96rpx;
  margin-bottom: 24rpx;
  color: #BBBBBB;
  opacity: 0.85;
}
.empty-text { font-size: 28rpx; color: #999999; }

/* ============ 事件卡 ============ */
.event-card {
  display: flex;
  align-items: stretch;
  background: #FFFFFF;
  border-radius: 20rpx;
  margin: 0 0 16rpx 0;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);
  overflow: hidden;
  transition: transform 0.1s, background 0.2s;
}

.event-card:active {
  transform: scale(0.99);
  background: #FAFBFC;
}

/* 左侧 6rpx 状态色条（按事件 status 变色）*/
.card-accent {
  width: 6rpx;
  flex-shrink: 0;
}

.accent-pending   { background: linear-gradient(180deg, #FFB84D 0%, #FF9F00 100%); }
.accent-confirmed { background: linear-gradient(180deg, #0FBF9F 0%, #07C160 100%); }
.accent-resolved  { background: linear-gradient(180deg, #4C90E6 0%, #0FBF9F 100%); }
.accent-duplicated{ background: linear-gradient(180deg, #9B7BFF 0%, #8B5CF6 100%); }
.accent-rejected  { background: linear-gradient(180deg, #BBBBBB 0%, #888888 100%); }
.accent-linked    { background: linear-gradient(180deg, #FF85C0 0%, #9B7BFF 100%); }
.accent-other     { background: #EEEEEE; }

.card-content {
  flex: 1;
  padding: 24rpx 24rpx 24rpx 20rpx;
  min-width: 0;
}

.event-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
  gap: 12rpx;
}

/* 事件类型 tag — 圆点+浅底（7 种颜色） */
.event-type {
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

.type-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.type-collect   { background: rgba(15, 191, 159, 0.1);  color: #0FBF9F; }
.type-report    { background: rgba(255, 107, 107, 0.1); color: #FF6B6B; }
.type-rescue    { background: rgba(76, 144, 230, 0.1);  color: #4C90E6; }
.type-medical   { background: rgba(255, 159, 0, 0.1);   color: #FF9F00; }
.type-adopt     { background: rgba(255, 133, 192, 0.1); color: #FF85C0; }
.type-transfer  { background: rgba(155, 123, 255, 0.1); color: #9B7BFF; }
.type-release   { background: rgba(7, 193, 96, 0.1);    color: #07C160; }

/* 事件状态 badge — 圆点+浅底（按 status 配色） */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx 12rpx 4rpx 10rpx;
  border-radius: 10rpx;
  background: rgba(255, 159, 0, 0.1);
  color: #FF9F00;
}

.status-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-pending    { background: rgba(255, 159, 0, 0.1);  color: #FF9F00; }
.status-confirmed  { background: rgba(7, 193, 96, 0.1);   color: #07C160; }
.status-resolved   { background: rgba(76, 144, 230, 0.1); color: #4C90E6; }
.status-rejected   { background: rgba(187, 187, 187, 0.18); color: #888888; }
.status-duplicated { background: rgba(155, 123, 255, 0.1); color: #9B7BFF; }
.status-linked     { background: rgba(255, 133, 192, 0.1); color: #FF85C0; }

.event-desc {
  font-size: 28rpx;
  font-weight: 500;
  color: #1A1A1A;
  display: block;
  margin-bottom: 14rpx;
  line-height: 1.5;
  word-break: break-all;
}

.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 14rpx;
}

.meta-item {
  font-size: 22rpx;
  color: #999999;
  display: flex;
  align-items: center;
  gap: 6rpx;
  max-width: 100%;
}

.meta-item text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280rpx;
}

.meta-icon {
  width: 22rpx;
  height: 22rpx;
  flex-shrink: 0;
  color: #BBBBBB;
}

.event-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 14rpx;
  border-top: 1rpx solid #F0F0F0;
  gap: 12rpx;
}

.reporter {
  font-size: 22rpx;
  color: #999999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

/* 融合度 — 视觉化（高/中/低） */
.score {
  display: inline-flex;
  align-items: baseline;
  gap: 6rpx;
  font-size: 22rpx;
  font-weight: 700;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.score-label {
  font-size: 20rpx;
  font-weight: 500;
  color: #999999;
}

.score-num {
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1;
}

.score-high { color: #FF6B6B; }
.score-mid  { color: #FF9F00; }
.score-low  { color: #999999; }

.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx 0;
  font-size: 22rpx;
  color: #BBBBBB;
  gap: 16rpx;
}

.no-more::before,
.no-more::after {
  content: '';
  width: 60rpx;
  height: 1rpx;
  background: #DDDDDD;
}
</style>
