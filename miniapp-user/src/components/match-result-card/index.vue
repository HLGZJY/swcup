<template>
  <view
    :class="['match-card', { top1: rank === 1 }]"
    @click="$emit('click', item)"
  >
    <!-- 排名 -->
    <view class="match-rank">
      <text class="rank-num">{{ rank }}</text>
    </view>

    <!-- 照片 -->
    <image
      class="match-photo"
      :src="resolveImageUrl(item.animal?.photos?.[0]) || '/static/mock/dog-placeholder.png'"
      mode="aspectFill"
    />

    <!-- 信息 -->
    <view class="match-info">
      <view class="match-header">
        <text class="match-breed">{{ item.animal?.breed }}</text>
        <view class="match-score" :class="scoreClass">
          {{ (item.fusion_score * 100).toFixed(0) }}%
        </view>
      </view>
      <text class="match-color">{{ item.animal?.color }}</text>
      <text class="match-location">{{ item.animal?.address }}</text>
      <view class="match-tags">
        <text class="match-tag">距 {{ item.gps_distance_m }}m</text>
        <text class="match-tag status-badge" :class="'status-' + (item.animal?.status || 'orphan')">
          {{ statusMap[item.animal?.status || 'orphan'] || '未建档' }}
        </text>
      </view>
    </view>

    <!-- 箭头 -->
    <text class="arrow">›</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveImageUrl } from '@/services/api'

interface Animal {
  animal_id: string | null
  status: 'lost' | 'found' | 'claimed' | 'archived' | 'orphan'
  breed: string
  color?: string
  address?: string
  photos?: string[]
}

interface MatchItem {
  animal_id: string | null
  fusion_score: number
  gps_distance_m: number
  text_match_rate: number
  animal: Animal | null
}

const props = defineProps<{
  item: MatchItem
  rank: number
}>()

defineEmits<{
  (e: 'click', item: MatchItem): void
}>()

const statusMap: Record<string, string> = {
  lost: '走失中',
  found: '发现中',
  claimed: '待认领',
  archived: '已归档',
  orphan: '未建档'
}

const scoreClass = computed(() => {
  const score = props.item.fusion_score
  if (score >= 0.88) return 'score-high'
  if (score >= 0.75) return 'score-mid'
  return 'score-low'
})
</script>

<style scoped lang="scss">
.match-card {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: #FAFAFA;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}

.match-card.top1 {
  background: #E8FDF8;
  border: 2rpx solid #0FBF9F;
}

.match-rank {
  width: 48rpx;
  height: 48rpx;
  background: #CCCCCC;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.match-card.top1 .match-rank {
  background: #0FBF9F;
}

.rank-num {
  font-size: 24rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.match-photo {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  margin-right: 16rpx;
  background: #E8FDF8;
  flex-shrink: 0;
}

.match-info {
  flex: 1;
  min-width: 0;
}

.match-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4rpx;
}

.match-breed {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.match-score {
  font-size: 26rpx;
  font-weight: 700;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.score-high { color: #07C160; background: #E8FDF8; }
.score-mid { color: #FF9F00; background: #FFF8E8; }
.score-low { color: #999999; background: #F5F5F5; }

.match-color, .match-location {
  font-size: 22rpx;
  color: #666666;
  display: block;
}

.match-tags {
  display: flex;
  gap: 12rpx;
  margin-top: 8rpx;
}

.match-tag {
  font-size: 20rpx;
  color: #666666;
  background: #F0F0F0;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.status-badge {
  color: #FFFFFF;
}

.status-lost { background: #FF6B6B !important; }
.status-found { background: #0FBF9F !important; }
.status-claimed { background: #FF9F00 !important; }

.arrow {
  font-size: 40rpx;
  color: #CCCCCC;
  margin-left: 16rpx;
  flex-shrink: 0;
}
</style>
