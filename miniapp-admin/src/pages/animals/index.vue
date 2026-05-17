<template>
  <view class="page">
    <!-- 搜索筛选 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input class="search-input" placeholder="搜索动物档案" v-model="keyword" @confirm="onSearch" />
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

    <!-- 动物列表 -->
    <scroll-view class="list-area" scroll-y @scrolltolower="onLoadMore">
      <view class="empty-state" v-if="animals.length === 0 && !loading">
        <text class="empty-icon">🐾</text>
        <text class="empty-text">暂无动物档案</text>
      </view>

      <view
        v-for="animal in animals"
        :key="animal.animal_id"
        class="animal-row"
        @click="showAnimalDetail(animal)"
      >
        <image class="animal-photo" :src="animal.photos?.[0] || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
        <view class="animal-info">
          <view class="info-header">
            <text class="breed">{{ animal.breed }}</text>
            <view :class="['status-tag', 'status-' + animal.status]">{{ statusMap[animal.status] }}</view>
          </view>
          <text class="color">{{ animal.color }} · {{ animal.gender === 'male' ? '♂️' : '♀️' }}</text>
          <text class="address">📍 {{ animal.address }}</text>
        </view>
        <text class="arrow">›</text>
      </view>

      <view class="no-more" v-if="!hasMore && animals.length > 0">
        <text>— 没有更多了 —</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAdminAnimals } from '@/services/api'

const keyword = ref('')
const currentStatus = ref('all')
const animals = ref<any[]>([])
const loading = ref(false)
const hasMore = ref(true)
const page = ref(1)
const pageSize = 10

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '走失', value: 'lost' },
  { label: '发现', value: 'found' },
  { label: '待认领', value: 'claimed' }
]

const statusMap: Record<string, string> = {
  lost: '走失', found: '发现', claimed: '待认领', archived: '归档'
}

// TabBar 页面切换时 onMounted 触发，加载数据
onMounted(() => {
  console.log('[DEBUG] animals onMounted fired, calling loadAnimals')
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

  try {
    console.log('[PAGE] apiGetAdminAnimals called, params=', JSON.stringify(params)); const res: any = await apiGetAdminAnimals(params)
    if (res.code === 0) {
      if (append) {
        animals.value.push(...res.data?.list || [])
      } else {
        animals.value = res.data?.list || []
      }
      hasMore.value = (res.data?.total || 0) > animals.value.length
      if (hasMore.value) page.value++
    }
  } catch (e) {}
  loading.value = false
}

function onSearch() {
  animals.value = []
  console.log('[PAGE>>] loadAnimals called'); loadAnimals()
}

function onFilter(status: string) {
  currentStatus.value = status
  animals.value = []
  console.log('[PAGE>>] loadAnimals called'); loadAnimals()
}

function onLoadMore() {
  if (!hasMore.value) return
  loadAnimals(true)
}

function showAnimalDetail(animal: any) {
  uni.navigateTo({ url: `/pages/animals/detail/index?animal_id=${animal.animal_id}` })
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

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1A1A1A;
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
  padding: 32rpx 36rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
}

.animal-row {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.animal-photo {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  margin-right: 16rpx;
  background: #E8FDF8;
  flex-shrink: 0;
}

.animal-info {
  flex: 1;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 4rpx;
}

.breed {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.status-tag {
  font-size: 18rpx;
  color: #FFFFFF;
  background: #FF6B6B;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
}

.status-lost { background: #FF6B6B !important; }
.status-found { background: #0FBF9F !important; }
.status-claimed { background: #FF9F00 !important; }

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
}

.arrow {
  font-size: 36rpx;
  color: #CCCCCC;
  margin-left: 12rpx;
}

.no-more {
  text-align: center;
  padding: 24rpx;
  font-size: 24rpx;
  color: #999999;
}
</style>
