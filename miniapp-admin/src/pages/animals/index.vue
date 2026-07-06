<template>
  <view class="page">
    <!-- 搜索筛选 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon-img" src="/static/icons/icon-search.svg" mode="aspectFit" />
        <input class="search-input" placeholder="搜索动物档案" v-model="keyword" @confirm="onSearch" />
      </view>
    </view>

    <!-- 状态筛选 + 归档 toggle -->
    <view class="filter-bar">
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
      <view class="archive-toggle">
        <switch :checked="showArchived" @change="onToggleArchive" color="#0FBF9F" style="transform: scale(0.8);" />
        <text class="archive-label">显示归档</text>
      </view>
    </view>

    <!-- 动物列表 -->
    <scroll-view class="list-area" scroll-y @scrolltolower="onLoadMore">
      <view class="empty-state" v-if="animals.length === 0 && !loading">
        <view class="empty-icon-bg">
          <image class="empty-icon-img" src="/static/icons/icon-paw-filled.svg" mode="aspectFit" />
        </view>
        <text class="empty-title">{{ showArchived ? '暂无归档档案' : '暂无动物档案' }}</text>
      </view>

      <view
        v-for="animal in animals"
        :key="animal.animal_id"
        class="animal-row"
        @click="showAnimalDetail(animal)"
      >
        <view class="card-accent" :class="'accent-' + animal.status"></view>
        <view class="card-content">
          <image class="animal-photo" :src="resolveImageUrl(animal.photos?.[0]) || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
          <view class="animal-info">
            <view class="info-header">
              <text class="breed">{{ animal.breed }}</text>
              <view :class="['status-tag', 'status-' + animal.status]">{{ statusMap[animal.status] }}</view>
            </view>
            <text class="color">{{ animal.color }} · {{ animal.gender === 'male' ? '♂️' : '♀️' }}</text>
            <view class="address-wrap">
              <image class="address-icon" src="/static/icons/icon-mappin.svg" mode="aspectFit" />
              <text class="address">{{ animal.address }}</text>
            </view>
          </view>
          <image class="arrow-img" src="/static/icons/icon-chevron-right.svg" mode="aspectFit" />
        </view>
      </view>

      <view class="no-more" v-if="!hasMore && animals.length > 0">
        <text>— 没有更多了 —</text>
      </view>
    </scroll-view>

    <!-- 浮动新建按钮 -->
    <view class="fab-add" @click="onCreateNew">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAdminAnimals, resolveImageUrl } from '@/services/api'

const keyword = ref('')
const currentStatus = ref('all')
const showArchived = ref(false)
const animals = ref<any[]>([])
const loading = ref(false)
const hasMore = ref(true)
const page = ref(1)
const pageSize = 10

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '走失', value: 'lost' },
  { label: '发现', value: 'found' },
  { label: '待认领', value: 'claimed' },
  { label: '归档', value: 'archived' },
]

const statusMap: Record<string, string> = {
  lost: '走失', found: '发现', claimed: '待认领', archived: '归档'
}

onMounted(() => {
  loadAnimals()
})

async function loadAnimals(append = false) {
  if (loading.value) return
  loading.value = true

  if (!append) {
    page.value = 1
    animals.value = []
  }

  const params: any = { page: page.value, limit: pageSize }
  if (currentStatus.value !== 'all') params.status = currentStatus.value
  if (keyword.value) params.keyword = keyword.value
  params.include_archived = showArchived.value

  try {
    const res: any = await apiGetAdminAnimals(params)
    if (res.code === 0) {
      if (append) {
        animals.value.push(...res.data?.list || [])
      } else {
        animals.value = res.data?.list || []
      }
      hasMore.value = (res.data?.total || 0) > animals.value.length
      if (hasMore.value) page.value++
    }
  } catch (e) {
    // 错误已由 api.js 拦截器统一处理
  }
  loading.value = false
}

function onSearch() {
  animals.value = []
  loadAnimals()
}

function onFilter(status: string) {
  currentStatus.value = status
  animals.value = []
  loadAnimals()
}

function onToggleArchive(e: any) {
  showArchived.value = e.detail.value
  // 开启归档 toggle 时,若当前在 lost/found/claimed tab,自动切到"全部",
  // 避免双重过滤造成列表混乱
  if (e.detail.value && currentStatus.value !== 'archived') {
    currentStatus.value = 'all'
  }
  loadAnimals()
}

function onLoadMore() {
  if (!hasMore.value) return
  loadAnimals(true)
}

function showAnimalDetail(animal: any) {
  uni.navigateTo({ url: `/pages/animals/detail/index?animal_id=${animal.animal_id}` })
}

function onCreateNew() {
  uni.navigateTo({ url: '/pages/animals/detail/index?mode=new' })
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
  border: 2rpx solid transparent;
  transition: border-color 0.2s, background 0.2s;
}

.search-input-wrap:focus-within {
  border-color: #0FBF9F;
  background: #FFFFFF;
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

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1A1A1A;
}

.filter-tabs {
  display: flex;
  background: #FFFFFF;
  padding: 0 24rpx;
}

.filter-tab {
  flex: 1;
  text-align: center;
  padding: 20rpx 8rpx;
  font-size: 26rpx;
  color: #666666;
  position: relative;
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
  padding: 28rpx 28rpx 160rpx 28rpx;
  box-sizing: border-box;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0 120rpx;
  min-height: 60vh;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.empty-icon-img {
  width: 96rpx;
  height: 96rpx;
  margin-bottom: 24rpx;
  color: #0FBF9F;
  opacity: 0.85;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
}

.animal-row {
  display: flex;
  align-items: stretch;
  background: #FFFFFF;
  border-radius: 20rpx;
  margin: 0 0 20rpx 0;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);
  overflow: hidden;
  transition: transform 0.1s, background 0.2s;
}

.animal-row:active {
  transform: scale(0.99);
  background: #FAFBFC;
}

/* 左侧 6rpx 状态色条 */
.card-accent {
  width: 6rpx;
  flex-shrink: 0;
}

.accent-lost    { background: linear-gradient(180deg, #FF6B6B 0%, #E53A3A 100%); }
.accent-found   { background: linear-gradient(180deg, #0FBF9F 0%, #07C160 100%); }
.accent-claimed { background: linear-gradient(180deg, #FFB84D 0%, #FF9F00 100%); }
.accent-archived{ background: linear-gradient(180deg, #BBBBBB 0%, #888888 100%); }
.accent-other   { background: #EEEEEE; }

.card-content {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 24rpx 24rpx 24rpx 20rpx;
  min-width: 0;
}

.animal-photo {
  width: 120rpx;
  height: 120rpx;
  border-radius: 14rpx;
  margin-right: 16rpx;
  background: #E8FDF8;
  flex-shrink: 0;
  border: 2rpx solid #FFFFFF;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
}

.animal-info {
  flex: 1;
  min-width: 0;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 6rpx;
}

.breed {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 20rpx;
  font-weight: 600;
  padding: 2rpx 10rpx;
  border-radius: 10rpx;
  color: #FF6B6B;
  background: rgba(255, 107, 107, 0.1);
}

.status-tag::before {
  content: '';
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: currentColor;
}

.status-lost    { color: #FF6B6B; background: rgba(255, 107, 107, 0.1); }
.status-found   { color: #0FBF9F; background: rgba(15, 191, 159, 0.1); }
.status-claimed { color: #FF9F00; background: rgba(255, 159, 0, 0.1); }
.status-archived{ color: #888888; background: rgba(187, 187, 187, 0.18); }

.color {
  font-size: 22rpx;
  color: #666666;
  display: block;
}

.address {
  font-size: 20rpx;
  color: #999999;
  display: block;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320rpx;
}

.address-wrap {
  display: flex;
  align-items: center;
  margin-top: 4rpx;
}

.address-icon {
  width: 18rpx;
  height: 18rpx;
  margin-right: 4rpx;
  flex-shrink: 0;
  color: #BBBBBB;
}

.arrow-img {
  width: 32rpx;
  height: 32rpx;
  margin-left: 12rpx;
  color: #CCCCCC;
  flex-shrink: 0;
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

.no-more::before,
.no-more::after {
  content: '';
  width: 60rpx;
  height: 1rpx;
  background: #DDDDDD;
}

.filter-bar {
  display: flex;
  align-items: center;
  background: #FFF;
  border-bottom: 1rpx solid #F5F5F5;
}
.filter-bar .filter-tabs { flex: 1; padding: 0 24rpx; }
.archive-toggle {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 0 24rpx;
  flex-shrink: 0;
}
.archive-label { font-size: 24rpx; color: #666; }
.fab-add {
  position: fixed;
  right: 32rpx;
  bottom: 140rpx;
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: #0FBF9F;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 20rpx rgba(15, 191, 159, 0.4);
  z-index: 100;
}
.fab-icon { color: #FFF; font-size: 56rpx; font-weight: 300; line-height: 1; }
</style>
