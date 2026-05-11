<template>
  <view class="fusion-panel">
    <!-- 顶部概览 -->
    <view class="panel-overview">
      <view class="overview-bg">
        <view class="score-circle">
          <view class="score-value">{{ topScore }}</view>
          <view class="score-label">融合得分</view>
        </view>
      </view>
      <view class="result-status" :class="resultClass">
        <text class="status-icon">{{ statusIcon }}</text>
        <text class="status-text">{{ statusText }}</text>
      </view>
    </view>

    <!-- 四维度条 -->
    <view class="dimension-list">
      <view class="dimension-item" v-for="dim in dimensions" :key="dim.name">
        <view class="dim-header">
          <text class="dim-name">{{ dim.name }}</text>
          <text class="dim-value">{{ dim.value }}</text>
        </view>
        <view class="dim-bar-bg">
          <view class="dim-bar-fill" :style="{ width: dim.percent + '%', background: dim.color }"></view>
        </view>
        <text class="dim-desc">{{ dim.desc }}</text>
      </view>
    </view>

    <!-- 阈值说明 -->
    <view class="threshold-note" v-if="showThreshold">
      <text class="threshold-title">判定阈值说明</text>
      <view class="threshold-row">
        <view class="threshold-item confirmed">
          <text class="threshold-score">≥ 0.88</text>
          <text class="threshold-desc">确认重复</text>
        </view>
        <view class="threshold-item suspected">
          <text class="threshold-score">0.75~0.88</text>
          <text class="threshold-desc">疑似重复</text>
        </view>
        <view class="threshold-item none">
          <text class="threshold-score">&lt; 0.75</text>
          <text class="threshold-desc">无匹配</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ResultItem {
  fusion_score: number
  vector_similarity: number
  gps_distance_m: number
  image_similarity: number
  text_match_rate: number
}

const props = withDefaults(defineProps<{
  result: {
    results: ResultItem[]
  }
  showThreshold?: boolean
}>(), {
  showThreshold: true
})

// GPS 维度得分：≤500m=1.0, ≥1500m=0, 中间线性衰减
function calcLocationScore(distanceM: number) {
  if (distanceM <= 500) return 1.0
  if (distanceM >= 1500) return 0
  return Math.max(0, 1 - (distanceM - 500) / 1000)
}

const topScore = computed(() => {
  if (!props.result?.results?.[0]) return '0'
  return (props.result.results[0].fusion_score * 100).toFixed(0)
})

const topFusionScore = computed(() => {
  return props.result?.results?.[0]?.fusion_score ?? 0
})

const resultClass = computed(() => {
  const score = topFusionScore.value
  if (score >= 0.88) return 'result-confirmed'
  if (score >= 0.75) return 'result-suspected'
  return 'result-none'
})

const statusIcon = computed(() => {
  const score = topFusionScore.value
  if (score >= 0.88) return '✅'
  if (score >= 0.75) return '⚠️'
  return 'ℹ️'
})

const statusText = computed(() => {
  const score = topFusionScore.value
  if (score >= 0.88) return '确认重复，系统将自动合并'
  if (score >= 0.75) return '疑似重复，需管理员审核'
  return '未匹配到相似动物'
})

const dimensions = computed(() => {
  if (!props.result?.results?.[0]) return []
  const r = props.result.results[0]
  const gpsScore = calcLocationScore(r.gps_distance_m)
  return [
    { name: '鼻纹相似度', value: (r.vector_similarity * 100).toFixed(0) + '%', percent: r.vector_similarity * 100, desc: '128维特征向量余弦相似度', color: '#0FBF9F' },
    { name: 'GPS距离', value: r.gps_distance_m + 'm', percent: gpsScore * 100, desc: '≤500m满分，≥1500m得0分', color: '#FF9F00' },
    { name: '图像相似度', value: (r.image_similarity * 100).toFixed(0) + '%', percent: r.image_similarity * 100, desc: 'pHash感知哈希相似度', color: '#07C160' },
    { name: '文本匹配度', value: (r.text_match_rate * 100).toFixed(0) + '%', percent: r.text_match_rate * 100, desc: '品种+颜色+性别关键词', color: '#5872E0' }
  ]
})
</script>

<style scoped lang="scss">
.fusion-panel {
  background: #FFFFFF;
  border-radius: 16rpx;
  overflow: hidden;
}

.panel-overview {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  padding: 48rpx 32rpx;
  text-align: center;
}

.score-circle {
  width: 200rpx;
  height: 200rpx;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  margin: 0 auto 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.score-value {
  font-size: 64rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.score-label {
  font-size: 24rpx;
  color: rgba(255,255,255,0.8);
}

.result-status {
  display: inline-flex;
  align-items: center;
  padding: 12rpx 32rpx;
  border-radius: 40rpx;
  background: rgba(255,255,255,0.2);
}

.result-confirmed { background: rgba(7, 193, 96, 0.2); }
.result-suspected { background: rgba(255, 159, 0, 0.2); }
.result-none { background: rgba(255, 255, 255, 0.2); }

.status-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.status-text {
  font-size: 26rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.dimension-list {
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.dimension-item {
  display: flex;
  flex-direction: column;
}

.dim-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.dim-name {
  font-size: 26rpx;
  color: #1A1A1A;
}

.dim-value {
  font-size: 26rpx;
  font-weight: 600;
  color: #0FBF9F;
}

.dim-bar-bg {
  height: 12rpx;
  background: #F0F0F0;
  border-radius: 6rpx;
  overflow: hidden;
}

.dim-bar-fill {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.5s ease;
}

.dim-desc {
  font-size: 20rpx;
  color: #999999;
  margin-top: 4rpx;
}

.threshold-note {
  padding: 24rpx 32rpx;
  background: #FAFAFA;
  border-top: 1rpx solid #F0F0F0;
}

.threshold-title {
  font-size: 22rpx;
  color: #999999;
  display: block;
  margin-bottom: 16rpx;
}

.threshold-row {
  display: flex;
  gap: 16rpx;
}

.threshold-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx;
  border-radius: 8rpx;
}

.threshold-item.confirmed { background: #E8FDF8; }
.threshold-item.suspected { background: #FFF8E8; }
.threshold-item.none { background: #F5F5F5; }

.threshold-score {
  font-size: 24rpx;
  font-weight: 700;
  color: #1A1A1A;
}

.threshold-desc {
  font-size: 20rpx;
  color: #666666;
  margin-top: 4rpx;
}
</style>
