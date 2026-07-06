<template>
  <view class="timeline-page">
    <view v-if="loading" class="loading">加载中…</view>
    <block v-else>
      <view
        v-for="evt in timeline"
        :key="evt.event_id"
        class="timeline-card"
      >
        <view class="card-content">
          <text class="reporter-name">{{ evt.reporter?.nickname || '匿名用户' }}</text>
          <text class="event-action">在 {{ evt.address || '未知地点' }} 看到了这只动物</text>
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
      <view v-if="!timeline.length" class="empty">还没有人上报过观察记录</view>
    </block>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { apiGetAnimalTimeline, resolveImageUrl } from '@/services/api.js'

const loading = ref(true)
const timeline = ref<any[]>([])

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function load(animalId: string) {
  loading.value = true
  try {
    const res: any = await apiGetAnimalTimeline(animalId)
    timeline.value = res?.events || []
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
    timeline.value = []
  } finally {
    loading.value = false
  }
}

onLoad((query: any) => {
  if (query?.id) load(query.id)
  else loading.value = false
})
</script>

<style scoped>
.timeline-page { padding: 20rpx; }
.loading, .empty { text-align: center; color: #999; margin-top: 60rpx; }
.timeline-card { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 20rpx; }
.reporter-name { font-weight: bold; display: block; }
.event-action { color: #333; display: block; margin: 8rpx 0; }
.photos { display: flex; flex-wrap: wrap; gap: 10rpx; }
.photo { width: 200rpx; height: 200rpx; border-radius: 8rpx; }
.event-time { color: #999; font-size: 24rpx; display: block; margin-top: 8rpx; }
</style>
