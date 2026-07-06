<template>
  <view class="animal-card" @click="$emit('click', animal)">
    <!-- 照片区 -->
    <view class="card-photo-wrap">
      <image
        class="card-photo"
        :src="resolveImageUrl(animal.photos?.[0]) || '/static/mock/dog-placeholder.png'"
        mode="aspectFill"
      />
      <view v-if="showStatus" :class="['status-tag', 'status-' + animal.status]">
        {{ statusMap[animal.status] }}
      </view>
    </view>

    <!-- 信息区 -->
    <view class="card-info">
      <view class="info-header">
        <text class="breed">{{ animal.breed }}</text>
        <text class="gender">{{ animal.gender === 'male' ? '♂️' : animal.gender === 'female' ? '♀️' : '' }}</text>
      </view>

      <view class="info-detail" v-if="showDetail">
        <text class="detail-item" v-if="animal.color">
          <text class="detail-icon">🎨</text>
          {{ animal.color }}
        </text>
        <text class="detail-item" v-if="animal.address">
          <text class="detail-icon">📍</text>
          {{ animal.address }}
        </text>
      </view>

      <view class="info-tags" v-if="showTags && animal.tags && animal.tags.length">
        <text class="tag" v-for="tag in animal.tags.slice(0, 3)" :key="tag">{{ tag }}</text>
      </view>

      <view class="info-footer">
        <text class="time">{{ formattedTime }}</text>
        <view v-if="showAction" class="action-btn" @click.stop="$emit('action', animal)">
          <text>{{ actionText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveImageUrl } from '@/services/api'

interface Animal {
  animal_id: string
  status: 'lost' | 'found' | 'claimed' | 'archived'
  species: string
  breed: string
  color?: string
  gender?: string
  age_estimate?: string
  address?: string
  tags?: string[]
  photos?: string[]
  last_seen_at?: string
}

const props = withDefaults(defineProps<{
  animal: Animal
  showStatus?: boolean
  showDetail?: boolean
  showTags?: boolean
  showAction?: boolean
  actionText?: string
}>(), {
  showStatus: true,
  showDetail: true,
  showTags: true,
  showAction: false,
  actionText: '鼻纹比对'
})

defineEmits<{
  (e: 'click', animal: Animal): void
  (e: 'action', animal: Animal): void
}>()

const statusMap: Record<string, string> = {
  lost: '走失中',
  found: '发现中',
  claimed: '待认领',
  archived: '已归档'
}

const formattedTime = computed(() => {
  if (!props.animal.last_seen_at) return ''
  const date = new Date(props.animal.last_seen_at)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000

  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  return Math.floor(diff / 86400) + '天前'
})
</script>

<style scoped lang="scss">
.animal-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
  display: flex;
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

.status-found { background: #0FBF9F !important; }
.status-claimed { background: #FF9F00 !important; }
.status-archived { background: #999999 !important; }

.card-info {
  flex: 1;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.breed {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.gender {
  font-size: 28rpx;
}

.info-detail {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.detail-item {
  font-size: 22rpx;
  color: #666666;
  display: flex;
  align-items: center;
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
}

.time {
  font-size: 20rpx;
  color: #999999;
}

.action-btn {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  font-size: 22rpx;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}
</style>
