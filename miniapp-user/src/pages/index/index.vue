<template>
  <view class="page">
    <!-- 顶部占位（关掉系统胶囊后，需要 88rpx 让 hero 不顶到状态栏） -->
    <view class="navbar-placeholder" />

    <!-- 顶部搜索 & 定位 -->
    <view class="home-header">
      <!-- 装饰背景 -->
      <view class="hero-decor">
        <view class="hero-blob hero-blob-1" />
        <view class="hero-blob hero-blob-2" />
      </view>

      <view class="location-bar" @click="onRefreshLocation">
        <image class="location-icon-img" src="/static/icons/icon-mappin.svg" mode="aspectFit" />
        <text class="location-text">{{ locationText }}</text>
        <view class="refresh-icon-wrap" v-if="refreshing">
          <image class="refresh-icon-img" src="/static/icons/icon-refresh.svg" mode="aspectFit" />
        </view>
      </view>

      <view class="search-row">
        <view class="search-bar">
          <image class="search-icon-img" src="/static/icons/icon-search.svg" mode="aspectFit" />
          <input
            class="search-input"
            placeholder="搜索走失/发现的动物"
            v-model="searchKeyword"
            @confirm="onSearch"
            @input="onInputKeyword"
          />
          <view class="search-clear" v-if="searchKeyword" @click="onClearSearch">
            <image class="clear-icon-img" src="/static/icons/icon-close.svg" mode="aspectFit" />
          </view>
        </view>
        <view class="collect-btn" @click="onCollect">
          <image class="collect-icon-img" src="/static/icons/icon-camera.svg" mode="aspectFit" />
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
        <view class="empty-icon-wrap">
          <image class="empty-icon" src="/static/icons/icon-paw-filled.svg" mode="aspectFit" />
        </view>
        <text class="empty-text">暂无相关动物信息</text>
        <text class="empty-hint">成为第一个上报的人</text>
      </view>

      <view
        v-for="animal in animalList"
        :key="animal.animal_id"
        class="animal-card"
        @click="goToDetail(animal.animal_id)"
      >
        <!-- 左侧色条 -->
        <view :class="['card-accent', 'accent-' + animal.status]" />

        <!-- 照片区 -->
        <view class="card-photo-wrap">
          <image
            class="card-photo"
            :src="resolveImageUrl(animal.photos?.[0]) || '/static/mock/dog-placeholder.png'"
            mode="aspectFill"
          />
          <view :class="['status-tag', 'status-' + animal.status]">
            <view class="status-dot" />
            {{ statusMap[animal.status] }}
          </view>
          <!-- Bug5 修复: 显示已 N 次上报(后端 report_count 字段) -->
          <view v-if="animal.report_count && animal.report_count > 1" class="report-count-badge">
            <text>已 {{ animal.report_count }} 次上报</text>
          </view>
          <view class="card-actions">
            <view class="share-btn" @click.stop="onShareCard(animal)">
              <image src="/static/icons/icon-share.svg" mode="aspectFit" />
            </view>
          </view>
        </view>

        <!-- 信息区 -->
        <view class="card-info">
          <view class="info-header">
            <text class="breed">{{ animal.breed }}</text>
            <image
              class="gender-icon"
              :src="animal.gender === 'male' ? '/static/icons/icon-gender-male.svg' : '/static/icons/icon-gender-female.svg'"
              mode="aspectFit"
            />
          </view>

          <view class="info-detail">
            <text class="detail-item">颜色: {{ animal.color }}</text>
            <text class="detail-item">
              <image class="detail-icon-img" src="/static/icons/icon-mappin.svg" mode="aspectFit" />
              {{ animal.address }}
            </text>
          </view>

          <view class="info-tags">
            <text class="tag" v-for="tag in (animal.tags || []).slice(0, 3)" :key="tag">{{ tag }}</text>
          </view>

          <view class="info-footer">
            <text class="time">{{ formatTime(animal.last_seen_at) }}</text>
            <view class="action-btn">
              <image class="action-icon-img" src="/static/icons/icon-paw-white.svg" mode="aspectFit" />
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

    <!-- 自定义 tabBar（覆盖系统原生） -->
    <custom-tabbar />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAnimals, resolveImageUrl } from '@/services/api'
import CustomTabbar from '@/components/custom-tabbar/custom-tabbar.vue'

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
  if (searchKeyword.value.trim()) {
    params.keyword = searchKeyword.value.trim()
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
      } catch (e) {
        console.error('加载动物列表失败', e)
      }
    }
  } catch (err) {
    console.error('刷新数据失败', err)
  }
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
  animalList.value = []
  loadAnimals()
}

function onInputKeyword() {
  // Small delay to wait for input to update
  setTimeout(() => {
    if (!searchKeyword.value.trim()) {
      page.value = 1
      animalList.value = []
      loadAnimals()
    }
  }, 300)
}

function onClearSearch() {
  searchKeyword.value = ''
  page.value = 1
  animalList.value = []
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
  background: #F5F8F7;
  overflow: hidden;
}

/* 顶部占位（关掉系统胶囊后，留 88rpx 让 hero 不顶到状态栏） */
.navbar-placeholder {
  height: 88rpx;
  background: #FAFCFB;
  flex-shrink: 0;
}

/* 顶部 hero */
.home-header {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  padding: 24rpx 32rpx 28rpx;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.hero-decor {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.hero-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40rpx);
  opacity: 0.4;
}

.hero-blob-1 {
  width: 280rpx;
  height: 280rpx;
  background: radial-gradient(circle, rgba(255,255,255,0.4), transparent 70%);
  top: -100rpx;
  right: -60rpx;
}

.hero-blob-2 {
  width: 200rpx;
  height: 200rpx;
  background: radial-gradient(circle, rgba(7,193,96,0.4), transparent 70%);
  bottom: -80rpx;
  left: -40rpx;
}

.location-bar {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
  position: relative;
  z-index: 2;
}

.location-icon-img {
  width: 32rpx;
  height: 32rpx;
  margin-right: 10rpx;
  filter: brightness(0) invert(1);
}

.location-text {
  font-size: 26rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.refresh-icon-wrap {
  margin-left: 10rpx;
  width: 28rpx;
  height: 28rpx;
  animation: spin 1s linear infinite;
  display: flex;
  align-items: center;
  justify-content: center;
}

.refresh-icon-img {
  width: 24rpx;
  height: 24rpx;
  filter: brightness(0) invert(1);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.search-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  position: relative;
  z-index: 2;
}

.search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border-radius: 40rpx;
  padding: 14rpx 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.08);
}

.search-icon-img {
  width: 32rpx;
  height: 32rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
  opacity: 0.5;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1A1A1A;
}

.search-clear {
  width: 36rpx;
  height: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #F0F0F0;
  border-radius: 50%;
}

.clear-icon-img {
  width: 22rpx;
  height: 22rpx;
  opacity: 0.6;
}

.collect-btn {
  background: rgba(255,255,255,0.25);
  border: 1rpx solid rgba(255,255,255,0.45);
  border-radius: 40rpx;
  padding: 14rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 8rpx;
  backdrop-filter: blur(8rpx);
}

.collect-btn text {
  font-size: 26rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.collect-icon-img {
  width: 30rpx;
  height: 30rpx;
  filter: brightness(0) invert(1);
}

/* 筛选标签 */
.filter-tabs {
  display: flex;
  background: #FFFFFF;
  padding: 0 16rpx;
  border-bottom: 1rpx solid #F0F0F0;
  position: relative;
  flex-shrink: 0;
}

.filter-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  font-size: 26rpx;
  color: #666666;
  position: relative;
  transition: color 0.2s ease;
}

.filter-tab.active {
  color: #0FBF9F;
  font-weight: 700;
}

.filter-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 64rpx;
  height: 8rpx;
  background: linear-gradient(90deg, #0FBF9F, #07C160);
  border-radius: 4rpx;
  box-shadow: 0 2rpx 8rpx rgba(15, 191, 159, 0.4);
}

.tab-count {
  background: linear-gradient(135deg, #0FBF9F, #07C160);
  color: #FFFFFF;
  font-size: 18rpx;
  font-weight: 600;
  padding: 2rpx 10rpx;
  border-radius: 20rpx;
  margin-left: 8rpx;
  min-width: 32rpx;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* 列表 */
.animal-list {
  flex: 1;
  min-height: 0;
  padding: 20rpx 0 160rpx;
}

.list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon-wrap {
  width: 140rpx;
  height: 140rpx;
  background: linear-gradient(135deg, #E8FDF8, #F5F9F8);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.empty-icon {
  width: 80rpx;
  height: 80rpx;
  opacity: 0.5;
}

.empty-text {
  font-size: 28rpx;
  color: #666666;
  font-weight: 500;
}

.empty-hint {
  font-size: 24rpx;
  color: #999999;
  margin-top: 8rpx;
}

/* 动物卡片 */
.animal-card {
  background: #FAFCFB;
  border-radius: 20rpx;
  overflow: hidden;
  margin: 0 24rpx 24rpx;
  display: flex;
  min-height: 220rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.06);
  position: relative;
  transition: transform 0.15s ease;
}

.animal-card:active {
  transform: scale(0.98);
}

/* 左侧色条（按状态变色） */
.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 6rpx;
}

.accent-lost     { background: linear-gradient(180deg, #FF6B6B 0%, rgba(255,107,107,0) 100%); }
.accent-found    { background: linear-gradient(180deg, #0FBF9F 0%, rgba(15,191,159,0) 100%); }
.accent-claimed  { background: linear-gradient(180deg, #FF9F00 0%, rgba(255,159,0,0) 100%); }
.accent-archived { background: linear-gradient(180deg, #999999 0%, rgba(153,153,153,0) 100%); }

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

/* 状态徽章：admin 同款（圆点+半透明背景） */
.status-tag {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 20rpx;
  font-weight: 600;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  color: #FF6B6B;
  background: rgba(255,255,255,0.95);
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.08);
}

.status-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: currentColor;
}

.status-lost     { color: #FF6B6B; }
.status-found    { color: #0FBF9F; }
.status-claimed  { color: #FF9F00; }
.status-archived { color: #888888; }

/* Bug5 修复: 已 N 次上报徽章 */
.report-count-badge {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  background: rgba(255, 107, 107, 0.92);
  color: #FFFFFF;
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 14rpx;
  border-radius: 20rpx;
  z-index: 10;
  box-shadow: 0 2rpx 8rpx rgba(255, 107, 107, 0.35);
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
  background: rgba(0,0,0,0.4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8rpx);
}

.share-btn image {
  width: 28rpx;
  height: 28rpx;
  filter: brightness(0) invert(1);
}

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
  font-size: 30rpx;
  font-weight: 700;
  color: #1A1A1A;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.gender-icon {
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
  margin-left: 8rpx;
}

.info-detail {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.detail-item {
  font-size: 22rpx;
  color: #666666;
  display: flex;
  align-items: center;
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
  margin-right: 6rpx;
  flex-shrink: 0;
  opacity: 0.7;
}

.info-tags {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
}

.tag {
  font-size: 20rpx;
  color: #0FBF9F;
  background: rgba(15, 191, 159, 0.08);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-weight: 500;
}

.info-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.time {
  font-size: 20rpx;
  color: #999999;
  flex-shrink: 0;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.action-btn {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  font-size: 24rpx;
  padding: 10rpx 22rpx;
  border-radius: 26rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-weight: 700;
  box-shadow: 0 4rpx 12rpx rgba(15, 191, 159, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.action-btn:active {
  transform: scale(0.95);
  box-shadow: 0 2rpx 6rpx rgba(15, 191, 159, 0.3);
}

.action-icon-img {
  width: 22rpx;
  height: 22rpx;
}

/* 加载 / 无更多 */
.load-more {
  text-align: center;
  padding: 24rpx;
  font-size: 24rpx;
  color: #999999;
}

.no-more {
  text-align: center;
  padding: 32rpx 0;
  font-size: 22rpx;
  color: #BBBBBB;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.no-more::before,
.no-more::after {
  content: '';
  width: 80rpx;
  height: 1rpx;
  background: #DDDDDD;
}
</style>