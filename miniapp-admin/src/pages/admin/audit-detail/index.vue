<template>
  <view class="page">
    <!-- Event header card -->
    <view class="event-card">
      <view class="event-tags">
        <view class="tag-type">{{ eventTypeMap[event.event_type] || event.event_type }}</view>
        <view :class="['tag-status', event.status]">{{ statusMap[event.status] || event.status }}</view>
      </view>
      <view class="event-desc">{{ event.description }}</view>
      <view class="event-meta">
        <view class="meta-item">
          <image class="meta-icon" src="/static/icons/icon-mappin.png" mode="aspectFit" />
          <text class="meta-text">{{ event.address || '未知地址' }}</text>
        </view>
        <view class="meta-item">
          <image class="meta-icon" src="/static/icons/icon-clock.png" mode="aspectFit" />
          <text class="meta-text">{{ formatTime(event.created_at) }}</text>
        </view>
      </view>
      <view class="photo-row" v-if="event.photos && event.photos.length">
        <image
          v-for="(photo, idx) in event.photos"
          :key="idx"
          class="photo-thumb"
          :src="resolveImageUrl(photo)"
          mode="aspectFill"
        />
      </view>
    </view>

    <!-- AI scores card -->
    <view class="scores-card">
      <view class="scores-title">AI 匹配分析</view>
      <view class="score-items">
        <view class="score-item">
          <view class="score-label">向量相似度</view>
          <view class="score-bar-wrap">
            <view class="score-bar-bg">
              <view class="score-bar-fill" :style="{ width: (vector_similarity * 100) + '%' }"></view>
            </view>
            <text class="score-value">{{ (vector_similarity * 100).toFixed(0) }}%</text>
          </view>
          <view class="score-weight">权重 40%</view>
        </view>
        <view class="score-item">
          <view class="score-label">位置接近度</view>
          <view class="score-bar-wrap">
            <view class="score-bar-bg">
              <view class="score-bar-fill" :style="{ width: (gps_similarity * 100) + '%' }"></view>
            </view>
            <text class="score-value">{{ (gps_similarity * 100).toFixed(0) }}%</text>
          </view>
          <view class="score-weight">权重 20%</view>
        </view>
        <view class="score-item">
          <view class="score-label">图像相似度</view>
          <view class="score-bar-wrap">
            <view class="score-bar-bg">
              <view class="score-bar-fill" :style="{ width: (image_similarity * 100) + '%' }"></view>
            </view>
            <text class="score-value">{{ (image_similarity * 100).toFixed(0) }}%</text>
          </view>
          <view class="score-weight">权重 20%</view>
        </view>
        <view class="score-item">
          <view class="score-label">文本匹配度</view>
          <view class="score-bar-wrap">
            <view class="score-bar-bg">
              <view class="score-bar-fill" :style="{ width: (text_match_rate * 100) + '%' }"></view>
            </view>
            <text class="score-value">{{ (text_match_rate * 100).toFixed(0) }}%</text>
          </view>
          <view class="score-weight">权重 20%</view>
        </view>
      </view>
      <view class="fusion-row">
        <text class="fusion-label">综合得分</text>
        <text class="fusion-score">{{ (fusion_score * 100).toFixed(0) }}</text>
      </view>
    </view>

    <!-- Candidate list -->
    <view class="candidates-section" v-if="candidates.length">
      <view class="section-title">匹配候选</view>
      <view
        v-for="candidate in candidates"
        :key="candidate.animal_id"
        :class="['candidate-card', { selected: selectedId === candidate.animal_id }]"
        @click="selectCandidate(candidate)"
      >
        <view class="candidate-radio">
          <view class="radio-circle" :class="{ filled: selectedId === candidate.animal_id }"></view>
        </view>
        <image class="candidate-photo" :src="resolveImageUrl(candidate.photos?.[0]) || '/static/mock/avatar-default.png'" mode="aspectFill" />
        <view class="candidate-info">
          <view class="candidate-header">
            <text class="candidate-breed">{{ candidate.breed }}</text>
            <view class="candidate-recommend" v-if="candidate.is_recommended">推荐</view>
          </view>
          <text class="candidate-color">{{ candidate.color }}</text>
          <text class="candidate-address">{{ candidate.address }}</text>
        </view>
        <view class="candidate-score-wrap">
          <text class="candidate-score">{{ (candidate.fusion_score * 100).toFixed(0) }}</text>
          <text class="candidate-score-label">融合分</text>
        </view>
      </view>
    </view>

    <!-- No candidates hint -->
    <view class="empty-hint" v-else>
      <text class="hint-text">AI识别后即可查看比对候选</text>
      <view class="hint-btn" @click="onProcess">
        <text>AI 识别</text>
      </view>
    </view>

    <!-- Spacer for fixed action bar -->
    <view class="bottom-spacer"></view>

    <!-- Fixed action bar -->
    <view class="action-bar">
      <view class="action-reject" @click="onReject">
        <text>驳回</text>
      </view>
      <view :class="['action-confirm', { disabled: !selectedId }]" @click="onConfirm">
        <text>确认合并</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiConfirmEvent, apiRejectEvent, apiProcessEvent, resolveImageUrl } from '@/services/api'

const event_id = ref('')
const event = ref<any>({
  event_type: 'report',
  status: 'pending',
  description: '',
  address: '',
  created_at: '',
  photos: []
})

const fusion_score = ref(0.64)
const vector_similarity = ref(0.72)
const gps_similarity = ref(0.55)
const image_similarity = ref(0.68)
const text_match_rate = ref(0.41)

const candidates = ref<any[]>([])
const selectedId = ref('')

const eventTypeMap: Record<string, string> = {
  report: '上报', rescue: '救助', medical: '医疗', adopt: '领养', transfer: '转运', release: '放归'
}

const statusMap: Record<string, string> = {
  pending: '待审核', confirmed: '已确认', rejected: '已驳回', processed: '已处理'
}

onMounted(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const query = (currentPage as any).options || {}

  event_id.value = query.event_id || ''

  // Mock data
  event.value = {
    event_type: 'report',
    status: 'pending',
    description: '在小区附近发现一只走失犬只，请协助处理',
    address: '北京市朝阳区望京街道某小区',
    created_at: new Date().toISOString(),
    photos: []
  }

  fusion_score.value = 0.64
  vector_similarity.value = 0.72
  gps_similarity.value = 0.55
  image_similarity.value = 0.68
  text_match_rate.value = 0.41

  candidates.value = [
    {
      animal_id: 'A001',
      breed: '柴犬',
      color: '黄色',
      address: '北京市朝阳区望京街道某小区',
      fusion_score: 0.81,
      is_recommended: true,
      photos: []
    },
    {
      animal_id: 'A002',
      breed: '田园犬',
      color: '白色',
      address: '北京市朝阳区望京街道某小区',
      fusion_score: 0.52,
      is_recommended: false,
      photos: []
    }
  ]

  // Default select the recommended candidate
  const recommended = candidates.value.find(c => c.is_recommended)
  if (recommended) {
    selectedId.value = recommended.animal_id
  }
})

function selectCandidate(candidate: any) {
  selectedId.value = candidate.animal_id
}

function onProcess() {
  uni.showLoading({ title: 'AI 识别中...' })
  // Mock: simulate AI process completion
  setTimeout(() => {
    uni.hideLoading()
    uni.showToast({ title: '识别完成', icon: 'success' })
  }, 1500)
}

function formatTime(isoString: string) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return `${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function onReject() {
  uni.showModal({
    title: '确认驳回',
    content: '确定要驳回该事件吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiRejectEvent(event_id.value)
          uni.showToast({ title: '已驳回', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 1500)
        } catch (e) {
          console.error('驳回失败', e)
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}

function onConfirm() {
  if (!selectedId.value) return

  const candidate = candidates.value.find(c => c.animal_id === selectedId.value)
  if (!candidate) return

  uni.showModal({
    title: '合并确认',
    content: `合并到：${candidate.breed}，${candidate.address}`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiProcessEvent(event_id.value)
          uni.showToast({ title: '已合并', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 1500)
        } catch (e) {
          console.error('合并失败', e)
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F5F5;
  padding: 24rpx;
}

.event-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.event-tags {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.tag-type {
  background: #FFF3E0;
  color: #FF6B00;
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.tag-status {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.tag-status.pending {
  background: #FFF3E0;
  color: #FF6B00;
}

.tag-status.confirmed {
  background: #E8FDF8;
  color: #0FBF9F;
}

.tag-status.rejected {
  background: #FFE8E8;
  color: #FF6B6B;
}

.event-desc {
  font-size: 28rpx;
  color: #333333;
  line-height: 1.5;
  margin-bottom: 16rpx;
}

.event-meta {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 16rpx;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.meta-icon {
  width: 28rpx;
  height: 28rpx;
}

.meta-text {
  font-size: 24rpx;
  color: #999999;
}

.photo-row {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.photo-thumb {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  object-fit: cover;
  background: #F5F5F5;
}

.scores-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.scores-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
  margin-bottom: 20rpx;
}

.score-items {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.score-item {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  align-items: center;
  gap: 12rpx;
}

.score-label {
  font-size: 24rpx;
  color: #666666;
}

.score-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.score-bar-bg {
  flex: 1;
  height: 12rpx;
  background: #E8FDF8;
  border-radius: 6rpx;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  background: #0FBF9F;
  border-radius: 6rpx;
}

.score-value {
  font-size: 22rpx;
  color: #0FBF9F;
  font-weight: 600;
  width: 48rpx;
}

.score-weight {
  font-size: 20rpx;
  color: #BBBBBB;
  width: 80rpx;
  text-align: right;
}

.fusion-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #F5F5F5;
}

.fusion-label {
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 600;
}

.fusion-score {
  font-size: 48rpx;
  font-weight: 700;
  color: #0FBF9F;
}

.candidates-section {
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
  margin-bottom: 16rpx;
}

.candidate-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 20rpx;
  border: 2rpx solid transparent;
  transition: border-color 0.2s;
}

.candidate-card.selected {
  border-color: #0FBF9F;
}

.candidate-radio {
  flex-shrink: 0;
}

.radio-circle {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 2rpx solid #DDDDDD;
  display: flex;
  align-items: center;
  justify-content: center;
}

.radio-circle.filled {
  border-color: #0FBF9F;
  background: #0FBF9F;
}

.radio-circle.filled::after {
  content: '';
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #FFFFFF;
}

.candidate-photo {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  object-fit: cover;
  background: #F5F5F5;
  flex-shrink: 0;
}

.candidate-info {
  flex: 1;
  min-width: 0;
}

.candidate-header {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 4rpx;
}

.candidate-breed {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.candidate-recommend {
  background: #FF6B6B;
  color: #FFFFFF;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.candidate-color {
  font-size: 24rpx;
  color: #666666;
  display: block;
  margin-bottom: 4rpx;
}

.candidate-address {
  font-size: 22rpx;
  color: #999999;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-score-wrap {
  flex-shrink: 0;
  text-align: center;
}

.candidate-score {
  font-size: 36rpx;
  font-weight: 700;
  color: #0FBF9F;
  display: block;
}

.candidate-score-label {
  font-size: 20rpx;
  color: #BBBBBB;
}

.empty-hint {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 60rpx;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.hint-text {
  font-size: 28rpx;
  color: #999999;
  display: block;
  margin-bottom: 20rpx;
}

.hint-btn {
  display: inline-block;
  background: #0FBF9F;
  color: #FFFFFF;
  font-size: 28rpx;
  padding: 16rpx 40rpx;
  border-radius: 40rpx;
}

.bottom-spacer {
  height: 120rpx;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: #FFFFFF;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.action-reject, .action-confirm {
  flex: 1;
  text-align: center;
  padding: 24rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.action-reject {
  background: #F5F5F5;
  color: #999999;
}

.action-confirm {
  background: #FF6B6B;
  color: #FFFFFF;
}

.action-confirm.disabled {
  background: #DDDDDD;
  color: #FFFFFF;
}
</style>