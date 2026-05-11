<template>
  <view class="stat-card" :style="{ borderLeftColor: color }">
    <view class="stat-value">{{ formattedValue }}</view>
    <view class="stat-label">{{ label }}</view>
    <view class="stat-trend" v-if="trend">
      <text class="trend-icon">{{ trend > 0 ? '↑' : '↓' }}</text>
      <text class="trend-text">{{ Math.abs(trend) }}%</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value: number
  label: string
  color?: string
  trend?: number
}>(), {
  color: '#FF6B6B',
  trend: 0
})

const formattedValue = computed(() => {
  if (props.value >= 10000) {
    return (props.value / 10000).toFixed(1) + 'w'
  }
  if (props.value >= 1000) {
    return (props.value / 1000).toFixed(1) + 'k'
  }
  return String(props.value)
})
</script>

<style scoped lang="scss">
.stat-card {
  background: #2A2A2A;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  border-left: 6rpx solid #FF6B6B;
  min-width: 200rpx;
}

.stat-value {
  font-size: 48rpx;
  font-weight: 700;
  color: #FFFFFF;
  line-height: 1;
  margin-bottom: 8rpx;
}

.stat-label {
  font-size: 24rpx;
  color: #999999;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 4rpx;
  margin-top: 8rpx;
}

.trend-icon {
  font-size: 20rpx;
  color: #07C160;
}

.trend-text {
  font-size: 20rpx;
  color: #07C160;
}
</style>
