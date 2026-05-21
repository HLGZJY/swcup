<template>
  <view class="page">
    <!-- 加载中 -->
    <view class="loading-state" v-if="loading">
      <text>加载中...</text>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else-if="!animal">
      <image class="empty-icon-img" src="/static/icons/icon-search.png" mode="aspectFit" />
      <text class="empty-text">未找到该动物档案</text>
    </view>

    <template v-else>
      <!-- 照片区 -->
      <view class="photo-section">
        <image class="main-photo" :src="resolveImageUrl(animal?.photos?.[0]) || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
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
        <view class="address-wrap">
          <image class="address-icon" src="/static/icons/icon-mappin.png" mode="aspectFit" />
          <text class="address">{{ animal?.address }}</text>
        </view>
        <view class="map-preview" @click="openMap" v-if="animal?.location_lat">
          <image class="map-thumb" :src="getStaticMapUrl(animal?.location_lat, animal?.location_lng)" mode="aspectFill" />
          <view class="map-overlay">
            <text>点击查看地图</text>
          </view>
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
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAdminAnimalDetail, resolveImageUrl } from '@/services/api'

const animal = ref<any>(null)
const loading = ref(false)

const statusMap: Record<string, string> = { lost: '走失', found: '发现', claimed: '待认领', archived: '归档' }
const genderMap: Record<string, string> = { male: '公', female: '母', unknown: '未知' }
const ageMap: Record<string, string> = { puppy: '幼年', adult: '成年', senior: '老年' }
const healthMap: Record<string, string> = { healthy: '健康', injured: '受伤', ill: '生病', unknown: '未知' }

// 使用原生 getCurrentPages 获取跳转时携带的 query 参数（与 user 端保持一致）
onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const animalId = currentPage?.options?.animal_id
  if (!animalId) return

  loading.value = true
  try {
    const res: any = await apiGetAdminAnimalDetail(animalId)
    if (res.code === 0) {
      animal.value = res.data
    }
  } catch (e) {
    // error handled in api
  } finally {
    loading.value = false
  }
})

function formatTime(isoString?: string) {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function openMap() {
  if (!animal.value) return
  if (!animal.value.location_lat || !animal.value.location_lng) {
    uni.showToast({ title: '暂无位置坐标', icon: 'none' })
    return
  }
  const name = animal.value.address || `${animal.value.location_lat},${animal.value.location_lng}`
  uni.openLocation({
    latitude: Number(animal.value.location_lat),
    longitude: Number(animal.value.location_lng),
    name,
    address: animal.value.address,
    fail: (err) => {
      console.error('openLocation fail', err)
      uni.showToast({ title: '地图打开失败', icon: 'none' })
    }
  })
}

function getStaticMapUrl(lat: number | string | undefined, lng: number | string | undefined) {
  if (!lat || !lng) return ''
  const key = 'OB4BZ-D4W3R-BMFVO-3CJEN-3Y6LZ-G7F6Q'
  const latStr = String(lat)
  const lngStr = String(lng)
  return `https://apis.map.qq.com/ws/staticmap/v2?center=${latStr},${lngStr}&zoom=15&size=400*300&maptype=roadmap&markers=size:large|color:0xFF6B6B|${latStr},${lngStr}&key=${key}`
}
</script>

<style scoped lang="scss">
.page { min-height: 100vh; background: #F5F5F5; padding-bottom: 40rpx; }
.loading-state { display: flex; justify-content: center; align-items: center; height: 60vh; font-size: 28rpx; color: #999; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; }
.empty-icon { font-size: 80rpx; margin-bottom: 24rpx; }
.empty-icon-img { width: 80rpx; height: 80rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 28rpx; color: #999; }
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
.address-wrap { display: flex; align-items: center; }
.address-icon { width: 22rpx; height: 22rpx; margin-right: 6rpx; flex-shrink: 0; }
.map-preview {
  height: 320rpx;
  background: linear-gradient(135deg, #E8FDF8 0%, #D0F0E8 100%);
  border-radius: 24rpx;
  margin-top: 16rpx;
  overflow: hidden;
  position: relative;
}

.map-thumb {
  width: 100%;
  height: 100%;
}

.map-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8rpx;
}

.map-overlay text {
  font-size: 24rpx;
  color: #1A1A1A;
  background: rgba(255, 255, 255, 0.8);
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}
.time-item { display: flex; justify-content: space-between; padding: 8rpx 0; border-bottom: 1rpx solid #F5F5F5; }
.time-item:last-child { border-bottom: none; }
.notes { font-size: 26rpx; color: #666; line-height: 1.6; }
.tags { display: flex; flex-wrap: wrap; gap: 12rpx; }
.tag { background: #E8FDF8; color: #0FBF9F; font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 8rpx; }
.nose-id { font-size: 24rpx; color: #666; font-family: monospace; }
</style>
