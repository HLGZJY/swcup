<template>
  <view class="timeline-page">
    <view v-if="loading" class="loading">加载中…</view>
    <block v-else>
      <!-- 调试信息面板 -->
      <view v-if="debugInfo" class="debug-panel">
        <text class="debug-text">总事件数: {{ timeline.length }}</text>
        <text v-if="eventTypeList.length" class="debug-text">类型: {{ eventTypeList.join(', ') }}</text>
      </view>
      
      <view
        v-for="evt in timeline"
        :key="evt.event_id"
        class="timeline-card"
      >
        <view class="card-content">
          <text class="reporter-name">{{ evt.reporter?.nickname || '匿名用户' }}</text>
          <text class="event-action">在 {{ evt.address || '未知地点' }} 看到了这只动物</text>
          <!-- 调试：显示事件类型 -->
          <text class="event-type-tag">[{{ evt.intent || 'no-intent' }}]</text>
          <view v-if="evt.photos && evt.photos.length" class="photos">
            <image
              v-for="(url, i) in evt.photos"
              :key="i"
              :src="resolveImageUrl(url)"
              mode="aspectFill"
              class="photo"
            />
          </view>
          <text class="event-time">{{ formatTime(evt.occurred_at) }}</text>
        </view>
      </view>
      <view v-if="!timeline.length" class="empty">
        <text>还没有人上报过观察记录</text>
        <text class="debug-hint">(调试: animal_id={{ currentAnimalId }})</text>
      </view>
    </block>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { apiGetAnimalTimeline, resolveImageUrl } from '@/services/api.js'

const loading = ref(true)
const timeline = ref<any[]>([])
const debugInfo = ref(true)
const currentAnimalId = ref('')

const eventTypeList = computed(() => {
  const types = timeline.value.map(e => e.intent || 'unknown')
  return [...new Set(types)]
})

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function load(animalId: string) {
  loading.value = true
  currentAnimalId.value = animalId
  console.log('[Timeline] 开始加载, animal_id:', animalId)
  
  try {
    const res: any = await apiGetAnimalTimeline(animalId)
    console.log('[Timeline] API 响应:', res)
    
    const events = res?.data?.events
    if (events && Array.isArray(events)) {
      console.log('[Timeline] 事件数量:', events.length)
      console.log('[Timeline] 事件列表:', events.map((e: any) => ({
        event_id: e.event_id,
        intent: e.intent,
        occurred_at: e.occurred_at
      })))
      timeline.value = events
    } else {
      console.warn('[Timeline] events 不是数组或为空:', events)
      timeline.value = []
    }
  } catch (e) {
    console.error('[Timeline] 加载失败:', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
    timeline.value = []
  } finally {
    loading.value = false
  }
}

onLoad((query: any) => {
  console.log('[Timeline] 页面参数:', query)
  if (query?.id) load(query.id)
  else {
    console.warn('[Timeline] 缺少 id 参数')
    loading.value = false
  }
})
</script>

<style scoped>
.timeline-page { padding: 20rpx; }
.loading, .empty { text-align: center; color: #999; margin-top: 60rpx; }
.empty { display: flex; flex-direction: column; gap: 16rpx; }
.debug-hint { font-size: 20rpx; color: #ccc; }
.timeline-card { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 20rpx; }
.reporter-name { font-weight: bold; display: block; }
.event-action { color: #333; display: block; margin: 8rpx 0; }
.event-type-tag { font-size: 20rpx; color: #0FBF9F; background: #E8FDF8; padding: 4rpx 12rpx; border-radius: 8rpx; display: inline-block; margin: 8rpx 0; }
.photos { display: flex; flex-wrap: wrap; gap: 10rpx; }
.photo { width: 200rpx; height: 200rpx; border-radius: 8rpx; }
.event-time { color: #999; font-size: 24rpx; display: block; margin-top: 8rpx; }
.debug-panel { background: #FFF8E8; padding: 16rpx; border-radius: 8rpx; margin-bottom: 20rpx; }
.debug-text { font-size: 22rpx; color: #FF9F00; display: block; margin: 4rpx 0; }
</style>