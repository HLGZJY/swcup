<template>
  <view class="page">
    <!-- 顶部搜索 & 定位 -->
    <view class="home-header">
      <view class="location-bar" @click="onRefreshLocation">
        <image class="location-icon-img" src="/static/icons/icon-mappin.png" mode="aspectFit" />
        <text class="location-text">{{ locationText }}</text>
        <text class="refresh-icon" v-if="refreshing">⟳</text>
      </view>
      <view class="search-row">
        <view class="search-bar">
          <image class="search-icon-img" src="/static/icons/icon-search.png" mode="aspectFit" />
          <input
            class="search-input"
            placeholder="搜索走失/发现的动物"
            v-model="searchKeyword"
            @confirm="onSearch"
          />
        </view>
        <view class="collect-btn" @click="onCollect">
          <text>采集</text>
        </view>
      </view>
    </view>

    <!-- 筛选标签 -->
    <view class="filter-tabs">
      <view
        v-for="tab in filterTabs"
        :key="tab.value"
        :class="['filter-tab', { active: currentFilter === tab.value }]"
        @click="onFilter(tab.value)"
      >
        <text>{{ tab.label }}</text>
        <view class="tab-count" v-if="tab.count">{{ tab.count }}</view>
      </view>
    </view>

    <!-- 动物列表 -->
    <scroll-view
      class="animal-list"
      scroll-y
      @scrolltolower="onLoadMore"
      :refresher-enabled="true"
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="list-empty" v-if="animalList.length === 0 && !loading">
        <image class="empty-icon" src="/static/icons/icon-image.png" mode="aspectFit" />
        <text class="empty-text">暂无相关动物信息</text>
        <text class="empty-hint">成为第一个上报的人</text>
      </view>

      <view
        v-for="animal in animalList"
        :key="animal.animal_id"
        class="animal-card"
        @click="goToDetail(animal.animal_id)"
      >
        <!-- 照片区 -->
        <view class="card-photo-wrap">
          <image
            class="card-photo"
            :src="animal.photos?.[0] || '/static/mock/dog-placeholder.png'"
            mode="aspectFill"
          />
          <view :class="['status-tag', 'status-' + animal.status]">
            {{ statusMap[animal.status] }}
          </view>
          <view class="card-actions">
            <view class="share-btn" @click.stop="onShareCard(animal)">
              <image src="/static/icons/icon-share.png" mode="aspectFit" />
            </view>
          </view>
        </view>

        <!-- 信息区 -->
        <view class="card-info">
          <view class="info-header">
            <text class="breed">{{ animal.breed }}</text>
            <text class="gender">{{ animal.gender === 'male' ? '♂️' : '♀️' }}</text>
          </view>

          <view class="info-detail">
            <text class="detail-item">颜色: {{ animal.color }}</text>
            <text class="detail-item">
              <image class="detail-icon-img" src="/static/icons/icon-mappin.png" mode="aspectFit" />
              {{ animal.address }}
            </text>
          </view>

          <view class="info-tags">
            <text class="tag" v-for="tag in animal.tags.slice(0, 3)" :key="tag">{{ tag }}</text>
          </view>

          <view class="info-footer">
            <text class="time">{{ formatTime(animal.last_seen_at) }}</text>
            <view class="action-btn">
              <text>鼻纹比对</text>
            </view>
          </view>
        </view>
      </view>

      <view class="load-more" v-if="hasMore && !loading">
        <text>上拉加载更多</text>
      </view>

      <view class="no-more" v-if="!hasMore && animalList.length > 0">
        <text>— 没有更多了 —</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAnimals } from '@/services/api'

const locationText = ref('北京市朝阳区')
const searchKeyword = ref('')
const currentFilter = ref('all')
const animalList = ref<any[]>([])
const loading = ref(false)
const isRefreshing = ref(false)
const refreshing = ref(false)
const hasMore = ref(true)
const page = ref(1)

const statusMap: Record<string, string> = {
  lost: '走失中',
  found: '发现中',
  claimed: '待认领',
  archived: '已归档'
}

const filterTabs = ref([
  { label: '全部', value: 'all', count: 0 },
  { label: '走失', value: 'lost', count: 0 },
  { label: '发现', value: 'found', count: 0 },
  { label: '待认领', value: 'claimed', count: 0 }
])

onMounted(async () => {
  // 未登录且非游客，跳转登录页
  const token = uni.getStorageSync('token')
  const isGuest = uni.getStorageSync('is_guest')
  if (!token && !isGuest) {
    uni.redirectTo({ url: '/pages/login/index' })
    return
  }
  await loadAnimals()
})

async function loadAnimals() {
  if (loading.value) return
  loading.value = true

  const params: any = { page: page.value, limit: 20 }
  if (currentFilter.value !== 'all') {
    params.status = currentFilter.value
  }

  try {
    const res: any = await apiGetAnimals(params)
    if (page.value === 1) {
      animalList.value = res.data.list
    } else {
      animalList.value = [...animalList.value, ...res.data.list]
    }
    hasMore.value = res.data.list.length >= 20

    // 更新 tab counts（仅第一页时）
    if (page.value === 1) {
      try {
        const allRes: any = await apiGetAnimals({ limit: 100 })
        filterTabs.value[0].count = allRes.data.total
        filterTabs.value[1].count = allRes.data.list.filter((a: any) => a.status === 'lost').length
        filterTabs.value[2].count = allRes.data.list.filter((a: any) => a.status === 'found').length
        filterTabs.value[3].count = allRes.data.list.filter((a: any) => a.status === 'claimed').length
      } catch (e) {}
    }
  } catch (err) {}
  loading.value = false
}

function onRefresh() {
  isRefreshing.value = true
  page.value = 1
  loadAnimals().finally(() => {
    isRefreshing.value = false
  })
}

function onRefreshLocation() {
  refreshing.value = true
  uni.getLocation({
    type: 'gcj02',
    success: (res) => {
      locationText.value = `${res.latitude.toFixed(2)}, ${res.longitude.toFixed(2)}`
    },
    fail: () => {
      uni.showToast({ title: '定位失败', icon: 'none' })
    },
    complete: () => {
      refreshing.value = false
    }
  })
}

function onSearch() {
  page.value = 1
  loadAnimals()
}

function onFilter(value: string) {
  currentFilter.value = value
  page.value = 1
  animalList.value = []
  loadAnimals()
}

function onLoadMore() {
  if (!hasMore.value || loading.value) return
  page.value++
  loadAnimals()
}

function formatTime(isoString: string) {
  const date = new Date(isoString)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000

  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  return Math.floor(diff / 86400) + '天前'
}

function goToDetail(animalId: string) {
  uni.navigateTo({
    url: `/pages/animal-detail/index?animal_id=${animalId}`
  })
}

function onShareCard(animal: any) {
  uni.navigateTo({
    url: `/pages/animal-detail/index?animal_id=${animal.animal_id}&share=1`
  })
}

function onCollect() {
  uni.navigateTo({
    url: '/pages/collect/index'
  })
}
</script>

<style scoped lang="scss">
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #F5F5F5;
}

.home-header {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  padding: 16rpx 24rpx 20rpx;
}

.location-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.location-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
}

.location-text {
  font-size: 26rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.refresh-icon {
  font-size: 28rpx;
  color: #FFFFFF;
  margin-left: 8rpx;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.search-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border-radius: 40rpx;
  padding: 16rpx 24rpx;
}

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1A1A1A;
}

.collect-btn {
  background: rgba(255,255,255,0.25);
  border: 1rpx solid rgba(255,255,255,0.4);
  border-radius: 40rpx;
  padding: 16rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.collect-btn text {
  font-size: 26rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.filter-tabs {
  display: flex;
  background: #FFFFFF;
  padding: 0 16rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.filter-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 0;
  font-size: 26rpx;
  color: #666666;
  position: relative;
}

.filter-tab.active {
  color: #0FBF9F;
  font-weight: 600;
}

.filter-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: #0FBF9F;
  border-radius: 2rpx;
}

.tab-count {
  background: #0FBF9F;
  color: #FFFFFF;
  font-size: 18rpx;
  padding: 2rpx 8rpx;
  border-radius: 20rpx;
  margin-left: 6rpx;
}

.animal-list {
  flex: 1;
  padding: 24rpx 0;
}

.list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 96rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #666666;
}

.empty-hint {
  font-size: 24rpx;
  color: #999999;
  margin-top: 8rpx;
}

.animal-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  overflow: hidden;
  margin: 0 24rpx 24rpx;
  display: flex;
  min-height: 220rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.card-photo-wrap {
  position: relative;
  width: 220rpx;
  height: 220rpx;
  flex-shrink: 0;
}

.card-photo {
  width: 100%;
  height: 100%;
  background: #E8FDF8;
}

.status-tag {
  position: absolute;
  top: 12rpx;
  left: 0;
  background: #FF6B6B;
  color: #FFFFFF;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 0 12rpx 12rpx 0;
}

.card-actions {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  z-index: 10;
}

.share-btn {
  width: 48rpx;
  height: 48rpx;
  background: rgba(0,0,0,0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.share-btn image {
  width: 28rpx;
  height: 28rpx;
}

.status-found { background: #0FBF9F !important; }
.status-claimed { background: #FF9F00 !important; }
.status-archived { background: #999999 !important; }

.card-info {
  flex: 1;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  min-width: 0;
}

.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.breed {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.gender {
  font-size: 28rpx;
  flex-shrink: 0;
  margin-left: 8rpx;
}

.info-detail {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.detail-item {
  font-size: 22rpx;
  color: #666666;
  display: flex;
  align-items: flex-start;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.location-icon-img {
  width: 28rpx;
  height: 28rpx;
  margin-right: 8rpx;
  flex-shrink: 0;
}

.search-icon-img {
  width: 28rpx;
  height: 28rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
}

.detail-icon-img {
  width: 22rpx;
  height: 22rpx;
  margin-right: 4rpx;
  flex-shrink: 0;
  vertical-align: middle;
}

.detail-icon {
  margin-right: 4rpx;
}

.info-tags {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
}

.tag {
  font-size: 20rpx;
  color: #0FBF9F;
  background: #E8FDF8;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.info-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  margin-top: 8rpx;
}

.time {
  font-size: 20rpx;
  color: #999999;
  flex-shrink: 0;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-btn {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  font-size: 22rpx;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  flex-shrink: 0;
}

.load-more, .no-more {
  text-align: center;
  padding: 24rpx;
  font-size: 24rpx;
  color: #999999;
}
</style>