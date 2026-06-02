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
          :src="item.animal?.photos?.[0] || '/static/mock/dog-placeholder.png'"
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
        <image class="arrow-img" src="/static/icons/icon-chevron-right.png" mode="aspectFit" />
      </view>
    </view>

    <!-- 底部操作 -->
    <view class="bottom-actions">
      <!-- 确认重复：显示认领按钮 -->
      <view class="action-hint" v-if="isDuplicateConfirmed">
        <text class="hint-icon">⚠️</text>
        <text>已确认重复，是否认领这只动物？</text>
      </view>
      <view class="btn-primary" v-if="isDuplicateConfirmed" @click="onClaimAnimal">
        <text>认领此动物</text>
      </view>
      <!-- 有匹配：上报此动物 -->
      <view class="btn-primary" v-if="showMatchList && !isDuplicateConfirmed" @click="onReport">
        <text>上报此动物</text>
      </view>
      <view class="btn-secondary" v-if="showMatchList && !isDuplicateConfirmed" @click="onBackHome">
        <text>返回首页</text>
      </view>
      <!-- Plan B 无匹配：双按钮 -->
      <view class="action-hint info-hint" v-if="needsConfirmation">
        <text class="hint-icon">ℹ️</text>
        <text>未在数据库中找到匹配动物</text>
      </view>
      <view class="btn-primary" v-if="needsConfirmation" @click="onCreateAnimal">
        <text>创建档案</text>
      </view>
      <view class="btn-secondary" v-if="needsConfirmation" @click="onCancel">
        <text>取消</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiNoseCompare, apiCreateAnimal, apiReportEvent } from '@/services/api'

const collectResult = ref<any>(null)
const compareResult = ref<any>(null)
const selectedSpecies = ref('dog')
const noseId = ref('')
const formBreed = ref('')
const formColor = ref('')
const formGender = ref('')

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const { nose_id, species, breed, color, gender, is_duplicate, matched_animal_id, similarity } = currentPage.options || {}

  if (!nose_id || nose_id === 'undefined') {
    uni.showToast({ title: '缺少鼻纹ID，请重新采集', icon: 'none' })
    uni.navigateBack()
    return
  }

  noseId.value = nose_id
  selectedSpecies.value = species || uni.getStorageSync('selectedSpecies') || 'dog'

  formBreed.value = decodeURIComponent(breed || '')
  formColor.value = decodeURIComponent(color || '')
  formGender.value = decodeURIComponent(gender || 'unknown')

  // 如果是同狗重复采集（collect 时已查到重复），直接显示重复提示
  if (is_duplicate === 'true' && matched_animal_id && matched_animal_id !== 'null') {
    compareResult.value = {
      total: 1,
      results: [{
        animal_id: matched_animal_id,
        fusion_score: parseFloat(similarity) || 0,
        vector_similarity: parseFloat(similarity) || 0,
        gps_distance_m: 0,
        text_match_rate: 0,
        image_similarity: 0,
        is_recommended: true,
        animal: {
          animal_id: matched_animal_id,
          species: selectedSpecies.value,
          breed: formBreed.value,
          color: formColor.value,
          gender: formGender.value,
          status: 'lost',
          first_seen_at: new Date().toISOString(),
          address: '',
          photos: [],
        },
      }],
      threshold_confirmed: 0.88,
      threshold_suspected: 0.75,
      next_action: 'duplicate_detected',
      candidate: null,
    }
    return
  }

  uni.showLoading({ title: '比对中...' })
  try {
    const result: any = await apiNoseCompare({
      nose_id: noseId.value,
      species: selectedSpecies.value,
      breed: formBreed.value,
      color: formColor.value,
      gender: formGender.value,
    })
    compareResult.value = result.data
  } catch (e) {
    // 错误由拦截器处理
  } finally {
    uni.hideLoading()
  }
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
  if (compareResult.value.next_action === 'duplicate_detected') return '已确认重复，是否认领这只动物？'
  if (score >= 0.88) return '确认重复，系统将自动合并'
  if (score >= 0.75) return '疑似重复，需管理员审核'
  return '未匹配到相似动物'
})

const matchList = computed(() => {
  if (!compareResult.value) return []
  return compareResult.value.results
})

// ============ Plan B 三分支状态 ============
const hasMatch = computed(() => {
  if (!compareResult.value) return false
  const results = compareResult.value.results
  return results && results.length > 0 && results[0].fusion_score >= 0.75
})

const needsConfirmation = computed(() => {
  if (!compareResult.value) return false
  return compareResult.value.next_action === 'ask_user_create'
})

const showMatchList = computed(() => hasMatch.value)

// 高相似度（确认重复）时隐藏上报按钮，显示认领引导
const isDuplicateConfirmed = computed(() => {
  if (!compareResult.value) return false
  return compareResult.value.next_action === 'duplicate_detected'
    || (compareResult.value.results[0]?.fusion_score >= 0.88 && compareResult.value.results[0]?.animal_id)
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
  if (!matchList.value || matchList.value.length === 0) {
    uni.showToast({ title: '无匹配结果，无法上报', icon: 'none' })
    return
  }
  const first = matchList.value[0]
  if (!first?.animal_id || first.animal_id === 'undefined') {
    uni.showToast({ title: '数据异常，请重新比对', icon: 'none' })
    return
  }
  uni.navigateTo({
    url: '/pages/animal-detail/index?animal_id=' + first.animal_id
  })
}

function onBackHome() {
  uni.switchTab({
    url: '/pages/index/index'
  })
}

// 认领已确认重复的动物
async function onClaimAnimal() {
  const first = matchList.value[0]
  if (!first?.animal_id) {
    uni.showToast({ title: '数据异常，请重新采集', icon: 'none' })
    return
  }
  uni.navigateTo({
    url: '/pages/animal-detail/index?animal_id=' + first.animal_id
  })
}

// ============ Plan B 无匹配流程 ============
async function onCreateAnimal() {
  if (!noseId.value) {
    uni.showToast({ title: '缺少鼻纹ID，请重新采集', icon: 'none' })
    return
  }
  uni.showLoading({ title: '创建中...' })
  try {
    // Step 1: 创建动物档案
    const animalRes: any = await apiCreateAnimal({
      species: selectedSpecies.value,
      breed: formBreed.value,
      color: formColor.value,
      gender: formGender.value,
      age_estimate: 'unknown',
      health_status: 'unknown',
      location_lat: 0,
      location_lng: 0,
      address: '',
      notes: '通过鼻纹采集新建',
      primary_nose_id: noseId.value,
      photos: [],
    })
    const animalId = animalRes.data?.animal_id || animalRes.animal_id
    if (!animalId) throw new Error('创建动物档案失败')

    // Step 2: 上报事件（关联到新建的动物）
    await apiReportEvent({
      event_type: 'report',
      animal_id: animalId,
      nose_vector_id: noseId.value,
      species: selectedSpecies.value,
      location_lat: 0,
      location_lng: 0,
    })

    uni.hideLoading()
    uni.showToast({ title: '创建成功', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/animal-detail/index?animal_id=${animalId}` })
    }, 1000)
  } catch (e) {
    uni.hideLoading()
    console.error('[onCreateAnimal]', e)
    uni.showToast({ title: '创建失败，请重试', icon: 'none' })
  }
}

function onCancel() {
  uni.switchTab({ url: '/pages/index/index' })
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

.arrow-img {
  width: 40rpx;
  height: 40rpx;
  flex-shrink: 0;
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

.info-hint {
  background: #E8F4FF;
}
.info-hint text:last-child {
  color: #007AFF;
}
</style>
