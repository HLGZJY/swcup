<template>
  <view class="page">
    <!-- 结果概览 -->
    <view class="result-overview">
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

    <!-- 四维度得分 -->
    <view class="dimension-section">
      <text class="section-title">四维度融合分析</text>
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
    </view>

    <!-- Top-N 匹配列表 -->
    <view class="match-section">
      <text class="section-title">匹配结果</text>
      <view class="match-count">共 {{ matchList.length }} 条匹配</view>
      <view
        v-for="(item, index) in matchList"
        :key="item.animal_id"
        :class="['match-card', { top1: index === 0 }]"
        @click="goToDetail(item.animal_id)"
      >
        <view class="match-rank">
          <text class="rank-num">{{ index + 1 }}</text>
        </view>
        <image
          class="match-photo"
          :src="item.animal.photos[0] || '/static/mock/dog-placeholder.png'"
          mode="aspectFill"
        />
        <view class="match-info">
          <view class="match-header">
            <text class="match-breed">{{ item.animal.breed }}</text>
            <view class="match-score" :class="getScoreClass(item.fusion_score)">
              {{ (item.fusion_score * 100).toFixed(0) }}%
            </view>
          </view>
          <text class="match-color">{{ item.animal.color }}</text>
          <text class="match-location">{{ item.animal.address }}</text>
          <view class="match-tags">
            <text class="match-tag">距 {{ item.gps_distance_m }}m</text>
            <text class="match-tag status-badge" :class="'status-' + item.animal.status">
              {{ statusTextMap[item.animal.status] }}
            </text>
          </view>
        </view>
        <text class="arrow">›</text>
      </view>
    </view>

    <!-- 底部操作 -->
    <view class="bottom-actions">
      <view class="action-hint" v-if="topScore >= 0.88">
        <text class="hint-icon">⚠️</text>
        <text>已确认重复，管理员将审核合并</text>
      </view>
      <view class="btn-primary" @click="onReport">
        <text>上报此动物</text>
      </view>
      <view class="btn-secondary" @click="onBackHome">
        <text>返回首页</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { mockNoseCompare } from '@/services/mock'

const compareResult = ref<any>(null)
const selectedSpecies = ref('dog')
const vectorId = ref('')

onMounted(async () => {
  // 从 URL 参数读取采集时传递的数据
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const { vector_id, species } = currentPage.options || {}

  vectorId.value = vector_id || ''
  selectedSpecies.value = species || uni.getStorageSync('selectedSpecies') || 'dog'

  uni.showLoading({ title: '比对中...' })
  const result: any = await mockNoseCompare({
    species: selectedSpecies.value,
    vector_id: vectorId.value
  })
  compareResult.value = result.data
  uni.hideLoading()
})

const statusTextMap: Record<string, string> = {
  lost: '走失中',
  found: '发现中',
  claimed: '待认领'
}

const topScore = computed(() => {
  if (!compareResult.value) return 0
  return (compareResult.value.results[0]?.fusion_score * 100).toFixed(0)
})

const resultClass = computed(() => {
  if (!compareResult.value) return ''
  const score = compareResult.value.results[0]?.fusion_score
  if (score >= 0.88) return 'result-confirmed'
  if (score >= 0.75) return 'result-suspected'
  return 'result-none'
})

const statusIcon = computed(() => {
  if (!compareResult.value) return ''
  const score = compareResult.value.results[0]?.fusion_score
  if (score >= 0.88) return '✅'
  if (score >= 0.75) return '⚠️'
  return 'ℹ️'
})

const statusText = computed(() => {
  if (!compareResult.value) return ''
  const score = compareResult.value.results[0]?.fusion_score
  if (score >= 0.88) return '确认重复，系统将自动合并'
  if (score >= 0.75) return '疑似重复，需管理员审核'
  return '未匹配到相似动物'
})

const matchList = computed(() => {
  if (!compareResult.value) return []
  return compareResult.value.results
})

// GPS 维度得分：≤500m=1.0, ≥1500m=0, 中间线性衰减
function calcLocationScore(distanceM) {
  if (distanceM <= 500) return 1.0
  if (distanceM >= 1500) return 0
  return Math.max(0, 1 - (distanceM - 500) / 1000)
}

const dimensions = computed(() => {
  if (!compareResult.value || !compareResult.value.results[0]) return []
  const r = compareResult.value.results[0]
  const gpsScore = calcLocationScore(r.gps_distance_m)
  return [
    { name: '鼻纹相似度', value: (r.vector_similarity * 100).toFixed(0) + '%', percent: r.vector_similarity * 100, desc: '128维特征向量余弦相似度', color: '#0FBF9F' },
    { name: 'GPS距离', value: r.gps_distance_m + 'm', percent: gpsScore * 100, desc: '≤500m满分，≥1500m得0分', color: '#FF9F00' },
    { name: '图像相似度', value: (r.image_similarity * 100).toFixed(0) + '%', percent: r.image_similarity * 100, desc: 'pHash感知哈希相似度', color: '#07C160' },
    { name: '文本匹配度', value: (r.text_match_rate * 100).toFixed(0) + '%', percent: r.text_match_rate * 100, desc: '品种+颜色+性别关键词', color: '#5872E0' }
  ]
})

function getScoreClass(score: number) {
  if (score >= 0.88) return 'score-high'
  if (score >= 0.75) return 'score-mid'
  return 'score-low'
}

function goToDetail(animalId: string) {
  uni.navigateTo({
    url: `/pages/animal-detail/index?animal_id=${animalId}`
  })
}

function onReport() {
  uni.navigateTo({
    url: '/pages/animal-detail/index?animal_id=' + matchList.value[0]?.animal_id
  })
}

function onBackHome() {
  uni.switchTab({
    url: '/pages/index/index'
  })
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 300rpx;
}

.result-overview {
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

.dimension-section {
  background: #FFFFFF;
  margin: 24rpx;
  border-radius: 16rpx;
  padding: 32rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1A1A1A;
  margin-bottom: 24rpx;
  display: block;
}

.dimension-list {
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

.match-section {
  background: #FFFFFF;
  margin: 24rpx;
  border-radius: 16rpx;
  padding: 32rpx;
}

.match-count {
  font-size: 24rpx;
  color: #999999;
  margin-bottom: 24rpx;
}

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
}

.match-info {
  flex: 1;
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
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #FFFFFF;
  padding: 24rpx 32rpx 48rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.06);
}

.action-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx;
  background: #FFF8E8;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}

.hint-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
}

.action-hint text:last-child {
  font-size: 24rpx;
  color: #FF9F00;
}

.btn-primary {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
}

.btn-secondary {
  background: #FFFFFF;
  color: #666666;
  text-align: center;
  padding: 28rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: 2rpx solid #EEEEEE;
}
</style>
