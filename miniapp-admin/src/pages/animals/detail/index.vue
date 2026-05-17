<template>
  <view class="page">
    <!-- 照片区 -->
    <view class="photo-section">
      <image class="main-photo" :src="animal?.photos[0] || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
    </view>

    <!-- 基本信息 -->
    <view class="info-card">
      <view class="info-header">
        <text class="breed">{{ animal?.breed }}</text>
        <view :class="['status-tag', 'status-' + animal?.status]">{{ statusMap[animal?.status] }}</view>
      </view>
      <view class="info-grid">
        <view class="info-item"><text class="label">颜色</text><text class="value">{{ animal?.color }}</text></view>
        <view class="info-item"><text class="label">性别</text><text class="value">{{ genderMap[animal?.gender] }}</text></view>
        <view class="info-item"><text class="label">年龄</text><text class="value">{{ ageMap[animal?.age_estimate] }}</text></view>
        <view class="info-item"><text class="label">健康</text><text class="value">{{ healthMap[animal?.health_status] }}</text></view>
        <view class="info-item"><text class="label">绝育</text><text class="value">{{ animal?.sterilized ? '已绝育' : '未绝育' }}</text></view>
      </view>
    </view>

    <!-- 位置信息 -->
    <view class="info-card">
      <text class="section-title">位置信息</text>
      <text class="address">📍 {{ animal?.address }}</text>
      <view class="map-placeholder" @click="openMap">
        <text>点击查看地图</text>
      </view>
    </view>

    <!-- 时间线 -->
    <view class="info-card">
      <text class="section-title">时间记录</text>
      <view class="time-item"><text class="label">首次发现</text><text class="value">{{ formatTime(animal?.first_seen_at) }}</text></view>
      <view class="time-item"><text class="label">最后出现</text><text class="value">{{ formatTime(animal?.last_seen_at) }}</text></view>
    </view>

    <!-- 备注 -->
    <view class="info-card" v-if="animal?.notes">
      <text class="section-title">备注</text>
      <text class="notes">{{ animal?.notes }}</text>
    </view>

    <!-- 标签 -->
    <view class="info-card" v-if="animal?.tags?.length">
      <text class="section-title">标签</text>
      <view class="tags">
        <view class="tag" v-for="t in animal.tags" :key="t">{{ t }}</view>
      </view>
    </view>

    <!-- 鼻纹ID -->
    <view class="info-card">
      <text class="section-title">鼻纹特征</text>
      <text class="nose-id">{{ animal?.primary_nose_id || '暂无' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAdminAnimalDetail } from '@/services/api'

const animal = ref<any>(null)

const statusMap: Record<string, string> = { lost: '走失', found: '发现', claimed: '待认领', archived: '归档' }
const genderMap: Record<string, string> = { male: '公', female: '母', unknown: '未知' }
const ageMap: Record<string, string> = { puppy: '幼年', adult: '成年', senior: '老年' }
const healthMap: Record<string, string> = { healthy: '健康', injured: '受伤', ill: '生病', unknown: '未知' }

onMounted(async () => {
  const pages = uni.getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = (currentPage as any).options || {}
  const animalId = options.animal_id
  if (!animalId) return

  try {
    const res: any = await apiGetAdminAnimalDetail(animalId)
    if (res.code === 0) {
      animal.value = res.data
    }
  } catch (e) {}
})

function formatTime(isoString?: string) {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function openMap() {
  if (!animal.value) return
  uni.openLocation({
    latitude: animal.value.location_lat,
    longitude: animal.value.location_lng,
    name: animal.value.address,
    fail: () => uni.showToast({ title: '地图打开失败', icon: 'none' })
  })
}
</script>

<style scoped lang="scss">
.page { min-height: 100vh; background: #F5F5F5; padding-bottom: 40rpx; }
.photo-section { background: #000; }
.main-photo { width: 100%; height: 500rpx; }
.info-card { background: #FFF; margin: 24rpx; border-radius: 16rpx; padding: 24rpx; }
.info-header { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; }
.breed { font-size: 36rpx; font-weight: 700; color: #1A1A1A; }
.status-tag { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 8rpx; color: #FFF; background: #FF6B6B; }
.status-lost { background: #FF6B6B !important; }
.status-found { background: #0FBF9F !important; }
.status-claimed { background: #FF9F00 !important; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.info-item { display: flex; flex-direction: column; }
.label { font-size: 22rpx; color: #999; }
.value { font-size: 26rpx; color: #1A1A1A; margin-top: 4rpx; }
.section-title { font-size: 28rpx; font-weight: 600; color: #1A1A1A; display: block; margin-bottom: 16rpx; }
.address { font-size: 26rpx; color: #666; display: block; margin-bottom: 16rpx; }
.map-placeholder { background: #F5F5F5; border-radius: 12rpx; padding: 32rpx; text-align: center; font-size: 24rpx; color: #999; }
.time-item { display: flex; justify-content: space-between; padding: 8rpx 0; border-bottom: 1rpx solid #F5F5F5; }
.time-item:last-child { border-bottom: none; }
.notes { font-size: 26rpx; color: #666; line-height: 1.6; }
.tags { display: flex; flex-wrap: wrap; gap: 12rpx; }
.tag { background: #E8FDF8; color: #0FBF9F; font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 8rpx; }
.nose-id { font-size: 24rpx; color: #666; font-family: monospace; }
</style>
