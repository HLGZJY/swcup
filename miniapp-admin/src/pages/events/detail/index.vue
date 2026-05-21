<template>
  <view class="page">
    <!-- 加载中 -->
    <view class="loading-state" v-if="loading">
      <text>加载中...</text>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else-if="!event">
      <image class="empty-icon-img" src="/static/icons/icon-filetext.png" mode="aspectFit" />
      <text class="empty-text">未找到该事件</text>
    </view>

    <template v-else>
      <!-- 事件头部 -->
      <view class="event-header-card">
        <view class="event-header">
          <text :class="['event-type', 'type-' + event.event_type]">{{ eventTypeMap[event.event_type] }}</text>
          <view :class="['status-badge', 'status-' + event.status]">{{ statusMap[event.status] }}</view>
        </view>
        <text class="event-desc">{{ event.description }}</text>
      </view>

      <!-- 基本信息 -->
      <view class="info-card">
        <text class="section-title">基本信息</text>
        <view class="info-grid">
          <view class="info-item"><text class="label">事件类型</text><text class="value">{{ eventTypeMap[event.event_type] }}</text></view>
          <view class="info-item"><text class="label">状态</text><text class="value">{{ statusMap[event.status] }}</text></view>
          <view class="info-item"><text class="label">发生时间</text><text class="value">{{ formatTime(event.occurred_at) }}</text></view>
          <view class="info-item"><text class="label">上报人</text><text class="value">{{ event.reporter_id }}</text></view>
        </view>
      </view>

      <!-- 位置信息 -->
      <view class="info-card">
        <text class="section-title">位置信息</text>
        <view class="address-wrap">
          <image class="address-icon" src="/static/icons/icon-mappin.png" mode="aspectFit" />
          <text class="address">{{ event.address }}</text>
        </view>
        <view class="map-preview" @click="openMap" v-if="event.location_lat">
          <image class="map-thumb" :src="getStaticMapUrl(event.location_lat, event.location_lng)" mode="aspectFill" />
          <view class="map-overlay">
            <text>点击查看地图</text>
          </view>
        </view>
      </view>

      <!-- 关联动物 -->
      <view class="info-card" v-if="event.animal_id">
        <text class="section-title">关联动物</text>
        <view class="animal-link" @click="goToAnimal(event.animal_id)">
          <text class="link-text">查看动物档案 →</text>
        </view>
      </view>

      <!-- 融合得分 -->
      <view class="info-card" v-if="event.fusion_score">
        <text class="section-title">AI 融合得分</text>
        <view class="score-display">
          <text class="score-value">{{ (event.fusion_score * 100).toFixed(0) }}%</text>
          <text class="score-label">重复匹配度</text>
        </view>
      </view>

      <!-- 时间线 -->
      <view class="info-card">
        <text class="section-title">时间记录</text>
        <view class="time-item"><text class="label">创建时间</text><text class="value">{{ formatTime(event.created_at) }}</text></view>
        <view class="time-item"><text class="label">发生时间</text><text class="value">{{ formatTime(event.occurred_at) }}</text></view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAdminEventDetail, resolveImageUrl } from '@/services/api'

const event = ref<any>(null)
const loading = ref(false)

const statusMap: Record<string, string> = {
  pending: '待处理', confirmed: '已确认', duplicated: '重复', linked: '关联', resolved: '已完成', rejected: '已驳回'
}

const eventTypeMap: Record<string, string> = {
  report: '上报', rescue: '救助', medical: '医疗', adopt: '领养', transfer: '转运', release: '放归'
}

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const eventId = currentPage?.options?.event_id
  if (!eventId) return

  loading.value = true
  try {
    const res: any = await apiGetAdminEventDetail(eventId)
    if (res.code === 0) {
      event.value = res.data
    }
  } catch (e) {
    console.error('加载事件详情失败', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})

function formatTime(isoString?: string) {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function openMap() {
  if (!event.value?.location_lat || !event.value?.location_lng) {
    uni.showToast({ title: '暂无位置坐标', icon: 'none' })
    return
  }
  const name = event.value.address || `${event.value.location_lat},${event.value.location_lng}`
  uni.openLocation({
    latitude: Number(event.value.location_lat),
    longitude: Number(event.value.location_lng),
    name,
    address: event.value.address,
    fail: (err) => {
      console.error('openLocation fail', err)
      uni.showToast({ title: '地图打开失败', icon: 'none' })
    }
  })
}

function getStaticMapUrl(lat: number | string, lng: number | string) {
  const key = 'OB4BZ-D4W3R-BMFVO-3CJEN-3Y6LZ-G7F6Q'
  const latStr = String(lat)
  const lngStr = String(lng)
  return `https://apis.map.qq.com/ws/staticmap/v2?center=${latStr},${lngStr}&zoom=15&size=400*300&maptype=roadmap&markers=size:large|color:0xFF6B6B|${latStr},${lngStr}&key=${key}`
}

function goToAnimal(animalId: string) {
  uni.navigateTo({ url: `/pages/animals/detail/index?animal_id=${animalId}` })
}
</script>

<style scoped lang="scss">
.page { min-height: 100vh; background: #F5F5F5; padding-bottom: 40rpx; }
.loading-state { display: flex; justify-content: center; align-items: center; height: 60vh; font-size: 28rpx; color: #999; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; }
.empty-icon-img { width: 80rpx; height: 80rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 28rpx; color: #999; }

.event-header-card { background: #FFF; padding: 32rpx 24rpx; margin-bottom: 24rpx; }
.event-header { display: flex; align-items: center; gap: 16rpx; margin-bottom: 16rpx; }
.event-type { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 8rpx; color: #FFF; background: #0FBF9F; }
.status-badge { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 8rpx; color: #FFF; background: #FF9F00; }
.status-pending { background: #FF9F00 !important; }
.status-confirmed { background: #0FBF9F !important; }
.status-resolved { background: #07C160 !important; }
.status-rejected { background: #999 !important; }
.event-desc { font-size: 28rpx; color: #1A1A1A; line-height: 1.6; }

.info-card { background: #FFF; margin: 0 24rpx 24rpx; border-radius: 16rpx; padding: 24rpx; }
.section-title { font-size: 28rpx; font-weight: 600; color: #1A1A1A; display: block; margin-bottom: 16rpx; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.info-item { display: flex; flex-direction: column; }
.label { font-size: 22rpx; color: #999; }
.value { font-size: 26rpx; color: #1A1A1A; margin-top: 4rpx; }

.address-wrap { display: flex; align-items: center; margin-bottom: 16rpx; }
.address-icon { width: 22rpx; height: 22rpx; margin-right: 6rpx; flex-shrink: 0; }
.address { font-size: 26rpx; color: #666; flex: 1; }
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

.animal-link { padding: 16rpx 0; }
.link-text { font-size: 26rpx; color: #0FBF9F; }

.score-display { display: flex; flex-direction: column; align-items: center; padding: 16rpx 0; }
.score-value { font-size: 48rpx; font-weight: 700; color: #FF6B6B; }
.score-label { font-size: 22rpx; color: #999; margin-top: 8rpx; }

.time-item { display: flex; justify-content: space-between; padding: 8rpx 0; border-bottom: 1rpx solid #F5F5F5; }
.time-item:last-child { border-bottom: none; }
</style>