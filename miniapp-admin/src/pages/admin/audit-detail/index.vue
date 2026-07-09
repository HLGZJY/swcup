<template>
  <view class="page">
    <!-- 顶部 Hero -->
    <view class="hero">
      <view class="hero-bg"></view>
      <view class="hero-content">
        <view class="back-btn" @click="goBack" aria-label="返回">
          <image class="back-icon" src="/static/icons/icon-arrow-left.svg" mode="aspectFit" />
        </view>
        <view class="hero-info">
          <text class="hero-title">事件审核详情</text>
          <text class="hero-sub">EVENT #{{ event_id.slice(-8) || '----' }}</text>
        </view>
        <view class="status-pill" :class="'pill-' + event.status">
          <view class="pill-dot"></view>
          <text>{{ statusMap[event.status] || event.status }}</text>
        </view>
      </view>
    </view>

    <!-- 事件信息卡 -->
    <view class="event-card">
      <view class="event-card-head">
        <view class="event-type-tag" :class="'type-' + event.event_type">
          <image
            class="type-icon"
            :src="typeIconMap[event.event_type] || '/static/icons/icon-list.svg'"
            mode="aspectFit"
          />
          <text>{{ eventTypeMap[event.event_type] || event.event_type }}</text>
        </view>
      </view>

      <text class="event-desc">{{ event.description || '用户提交的事件，等待审核' }}</text>

      <view class="event-meta">
        <view class="meta-item">
          <image class="meta-icon" src="/static/icons/icon-mappin.svg" mode="aspectFit" />
          <text class="meta-text">{{ event.address || '未知地址' }}</text>
        </view>
        <view class="meta-item">
          <image class="meta-icon" src="/static/icons/icon-clock.svg" mode="aspectFit" />
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
          @click="previewPhoto(photo)"
        />
      </view>
    </view>

    <!-- AI 匹配分析 -->
    <view class="ai-card">
      <view class="ai-card-head">
        <view class="ai-head-left">
          <view class="ai-icon-wrap">
            <image class="ai-icon" src="/static/icons/icon-brain.svg" mode="aspectFit" />
          </view>
          <view>
            <text class="ai-card-title">AI 匹配分析</text>
            <text class="ai-card-sub">四维融合 · 多模态识别</text>
          </view>
        </view>
        <!-- 综合得分大圆 -->
        <view class="fusion-orb" :class="'orb-' + fusionLevel">
          <text class="orb-num">{{ (fusion_score * 100).toFixed(0) }}</text>
          <text class="orb-label">综合</text>
        </view>
      </view>

      <view class="score-items">
        <view
          v-if="event.event_type !== 'report'"
          class="score-item"
        >
          <view class="score-label-row">
            <text class="score-label">鼻纹相似度</text>
            <text class="score-weight-tag weight--high">权重 50%</text>
          </view>
          <view class="score-bar-row">
            <view class="score-bar-bg">
              <view
                class="score-bar-fill"
                :class="'fill-nose'"
                :style="{ width: (vector_similarity * 100) + '%' }"
              ></view>
            </view>
            <text class="score-value" :class="'fill-nose-text'">
              {{ (vector_similarity * 100).toFixed(0) }}%
            </text>
          </view>
        </view>

        <view class="score-item">
          <view class="score-label-row">
            <text class="score-label">位置接近度</text>
            <text class="score-weight-tag weight--mid">
              权重 {{ event.event_type === 'report' ? '50%' : '30%' }}
            </text>
          </view>
          <view class="score-bar-row">
            <view class="score-bar-bg">
              <view
                class="score-bar-fill"
                :class="'fill-gps'"
                :style="{ width: (gps_similarity * 100) + '%' }"
              ></view>
            </view>
            <text class="score-value" :class="'fill-gps-text'">
              {{ (gps_similarity * 100).toFixed(0) }}%
            </text>
          </view>
        </view>

        <view class="score-item">
          <view class="score-label-row">
            <text class="score-label">文本匹配度</text>
            <text class="score-weight-tag weight--low">
              权重 {{ event.event_type === 'report' ? '30%' : '20%' }}
            </text>
          </view>
          <view class="score-bar-row">
            <view class="score-bar-bg">
              <view
                class="score-bar-fill"
                :class="'fill-text'"
                :style="{ width: (text_match_rate * 100) + '%' }"
              ></view>
            </view>
            <text class="score-value" :class="'fill-text-text'">
              {{ (text_match_rate * 100).toFixed(0) }}%
            </text>
          </view>
        </view>

        <view v-if="event.event_type === 'report'" class="score-item">
          <view class="score-label-row">
            <text class="score-label">时间接近度</text>
            <text class="score-weight-tag weight--low">权重 20%</text>
          </view>
          <view class="score-bar-row">
            <view class="score-bar-bg">
              <view
                class="score-bar-fill"
                :class="'fill-time'"
                :style="{ width: (time_score * 100) + '%' }"
              ></view>
            </view>
            <text class="score-value" :class="'fill-time-text'">
              {{ (time_score * 100).toFixed(0) }}%
            </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 候选列表 / 空状态 -->
    <view v-if="candidates.length" class="candidates-section">
      <view class="candidates-head">
        <view class="candidates-head-left">
          <image class="head-icon" src="/static/icons/icon-target.svg" mode="aspectFit" />
          <text class="candidates-title">匹配候选</text>
        </view>
        <text class="candidates-count">共 {{ candidates.length }} 只动物</text>
      </view>

      <view
        v-for="candidate in candidates"
        :key="candidateKey(candidate)"
        :class="['candidate-card', { selected: selectedId === candidateKey(candidate), recommended: candidate.is_recommended }]"
        @click="selectCandidate(candidate)"
      >
        <view class="candidate-accent"></view>
        <view class="candidate-content">
          <view class="candidate-photo-wrap">
            <image
              class="candidate-photo"
              :src="resolveImageUrl(candidate.photos?.[0]) || '/static/mock/avatar-default.png'"
              mode="aspectFill"
            />
            <view class="candidate-recommend" v-if="candidate.is_recommended">
              <image class="rec-icon" src="/static/icons/icon-sparkles.svg" mode="aspectFit" />
              <text>推荐</text>
            </view>
          </view>
          <view class="candidate-info">
            <text class="candidate-breed">{{ candidate.breed }}</text>
            <view class="candidate-info-row">
              <text class="candidate-color" v-if="candidate.color">🎨 {{ candidate.color }}</text>
            </view>
            <view class="candidate-info-row">
              <text class="candidate-address">📍 {{ candidate.address }}</text>
            </view>
          </view>
          <view class="candidate-score-wrap">
            <view class="candidate-score-num">
              <text class="num-val">{{ (candidate.fusion_score * 100).toFixed(0) }}</text>
              <text class="num-unit">分</text>
            </view>
            <text class="candidate-score-label">融合度</text>
          </view>
        </view>
        <view class="candidate-radio">
          <view :class="['radio-circle', { filled: selectedId === candidateKey(candidate) }]">
            <image
              v-if="selectedId === candidateKey(candidate)"
              class="check-icon"
              src="/static/icons/icon-check.svg"
              mode="aspectFit"
            />
          </view>
        </view>
      </view>
    </view>

    <view v-else class="empty-hint">
      <view class="empty-icon-bg">
        <image class="empty-icon" src="/static/icons/icon-layers.svg" mode="aspectFit" />
      </view>
      <text class="empty-title">尚未识别</text>
      <text class="empty-text">点击下方按钮，让 AI 自动提取特征并匹配候选动物</text>
      <view class="empty-btn-wrap">
        <view class="empty-btn" @click="onProcess">
          <image class="empty-btn-icon" src="/static/icons/icon-brain.svg" mode="aspectFit" />
          <text>AI 智能识别</text>
        </view>
      </view>
    </view>

    <!-- Spacer for fixed action bar -->
    <view class="bottom-spacer"></view>

    <!-- Fixed action bar -->
    <!-- 【2026-07-09 重构】固定 3 按钮布局,候选为空时仅禁"合并" -->
    <view class="action-bar">
      <view class="action-reject" @click="onReject">
        <image class="action-icon" src="/static/icons/icon-x.svg" mode="aspectFit" />
        <text>驳回</text>
      </view>
      <view class="action-create" @click="onCreateNew">
        <image class="action-icon" src="/static/icons/icon-plus.svg" mode="aspectFit" />
        <text>同意新建</text>
      </view>
      <view
        :class="['action-confirm', { disabled: !selectedId }]"
        @click="onMerge"
      >
        <image
          class="action-icon"
          :src="selectedId ? '/static/icons/icon-merge.svg' : '/static/icons/icon-check.svg'"
          mode="aspectFit"
        />
        <text>{{ selectedId ? '合并到候选' : '合并(请先选)' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiGetAdminAuditDetail, apiRejectEvent, apiProcessEvent, apiCreateAnimalFromEvent, apiMergeEvent, resolveImageUrl } from '@/services/api'

const event_id = ref('')
const event = ref<any>({
  event_type: 'report',
  status: 'pending',
  description: '',
  address: '',
  created_at: '',
  photos: []
})

const fusion_score = ref(0)
const vector_similarity = ref(0)
const gps_similarity = ref(0)
const text_match_rate = ref(0)
const time_score = ref(0)

const candidates = ref<any[]>([])
const selectedId = ref('')
const loading = ref(false)
const processing = ref(false)

const eventTypeMap: Record<string, string> = {
  collect: '鼻纹采集', report: '事件上报', rescue: '救助',
  medical: '医疗', adopt: '领养', transfer: '转移', release: '放归'
}

const typeIconMap: Record<string, string> = {
  collect: '/static/icons/icon-fingerprint.svg',
  report:  '/static/icons/icon-list.svg',
  rescue:  '/static/icons/icon-shield.svg',
  medical: '/static/icons/icon-heart.svg',
  adopt:   '/static/icons/icon-heart.svg',
  transfer:'/static/icons/icon-event.svg',
  release: '/static/icons/icon-paw.svg',
}

const statusMap: Record<string, string> = {
  pending: '待审核', confirmed: '已确认', rejected: '已驳回',
  processed: '已处理', duplicated: '重复', resolved: '已处理'
}

// 融合度分级（高=红/中=橙/低=灰）
const fusionLevel = computed(() => {
  const s = fusion_score.value || 0
  if (s >= 0.88) return 'high'
  if (s >= 0.75) return 'mid'
  return 'low'
})

onMounted(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const eventId = currentPage?.options?.event_id
  if (eventId) {
    event_id.value = eventId
    loadAuditDetail(eventId)
  }
})

function goBack() {
  uni.navigateBack()
}

async function loadAuditDetail(eventId: string) {
  loading.value = true
  try {
    const res: any = await apiGetAdminAuditDetail(eventId)
    if (res.code === 0) {
      event.value = res.data
      fusion_score.value = res.data.fusion_score ?? 0
      vector_similarity.value = res.data.vector_similarity ?? 0
      gps_similarity.value = res.data.gps_similarity ?? 0
      text_match_rate.value = res.data.text_match_rate ?? 0
      time_score.value = res.data.time_score ?? 0
      candidates.value = res.data.candidates || []
      const recommended = candidates.value.find((c: any) => c.is_recommended)
      if (recommended) selectedId.value = candidateKey(recommended)
    }
  } catch (e) {
    console.error('加载审核详情失败', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// Bug 4 修复 (2026-07-08): 用复合键避免孤儿记录 animal_id=null 全部"全选"bug
// 旧逻辑: :key="candidate.animal_id" + selectedId.value = candidate.animal_id
//   → 孤儿所有 animal_id=null, 点击任一孤儿 → 全部 orphan 卡同时显示 selected
// 新逻辑: candidateKey() 优先用 animal_id, 兜底用 vector_id/nose_id/index,保证每条候选独立
function candidateKey(c: any): string {
  return c.animal_id || c.vector_id || c.nose_id || `idx-${candidates.value.indexOf(c)}`
}

function selectCandidate(candidate: any) {
  selectedId.value = candidateKey(candidate)
  uni.vibrateShort && uni.vibrateShort({ type: 'light' })
}

function previewPhoto(photo: string) {
  uni.previewImage({
    urls: event.value.photos.map((p: string) => resolveImageUrl(p))
  })
}

async function onProcess() {
  if (processing.value) return
  processing.value = true
  try {
    const res: any = await apiProcessEvent(event_id.value)
    if (res.code === 0) {
      uni.showToast({ title: '识别完成', icon: 'success' })
      await loadAuditDetail(event_id.value)
    } else {
      uni.showToast({ title: res.message || '识别失败', icon: 'none' })
    }
  } catch (e) {
    console.error('AI识别失败', e)
    uni.showToast({ title: '识别失败', icon: 'none' })
  } finally {
    processing.value = false
  }
}

function formatTime(isoString: string) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return `今天 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function onReject() {
  uni.showModal({
    title: '驳回事件',
    content: '确定要驳回该事件吗？',
    confirmText: '驳回',
    cancelText: '取消',
    confirmColor: '#FF6B6B',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiRejectEvent(event_id.value)
          uni.showToast({ title: '已驳回', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 1200)
        } catch (e) {
          console.error('驳回失败', e)
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}

function onMerge() {
  if (!selectedId.value) {
    uni.showToast({ title: '请先选择候选动物', icon: 'none' })
    return
  }

  // Bug 4 修复: 用 candidateKey 查候选,API 仍传真实 animal_id
  const candidate = candidates.value.find(c => candidateKey(c) === selectedId.value)
  if (!candidate) return
  if (!candidate.animal_id) {
    // [2026-07-09 重构] 没有 animal_id 的孤儿候选不再触发"低分鼻纹审核"提示
    //   旧流程的 pending_nose_records 表已废弃,新流程走 admin 自行拒绝/同意新建
    uni.showModal({
      title: '该候选未建档',
      content: '该候选尚未关联动物档案,无法直接合并。请选其他候选,或使用"同意新建"。',
      showCancel: false,
      confirmText: '我知道了',
    })
    return
  }

  uni.showModal({
    title: '合并到该动物',
    content: `将本次事件合并到：\n${candidate.breed || '未知品种'}（${candidate.address || '未知地点'}）`,
    confirmText: '合并',
    cancelText: '取消',
    confirmColor: '#07C160',
    success: async (res) => {
      if (res.confirm) {
        try {
          // [2026-07-09 重构] 走统一 dispatchEventAction,action=merge
          await apiMergeEvent(event_id.value, candidate.animal_id)
          uni.showToast({ title: '已合并', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 1200)
        } catch (e) {
          console.error('合并失败', e)
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}

// 【Bug 6 / 2026-07-08】无候选时,admin 从发现页上报事件创建新动物
// 后端: PUT /admin/events/:event_id/action body={ action: 'create_new' }
// 成功 → 事件字段 → 新 Animal,event.status=confirmed,刷新列表
function onCreateNew() {
  uni.showModal({
    title: '创建新动物',
    content: '将从该事件的照片与位置信息建立新动物档案,事件标记为已确认。',
    confirmText: '创建',
    cancelText: '取消',
    confirmColor: '#5B7CFA',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiCreateAnimalFromEvent(event_id.value)
          uni.showToast({ title: '已创建', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 1200)
        } catch (e) {
          console.error('创建新动物失败', e)
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
  background: #F5F7FA;
  padding-bottom: 180rpx;
}

/* ============ 顶部 Hero ============ */
.hero {
  position: relative;
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
  padding: 24rpx 32rpx 100rpx;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  top: -150rpx;
  right: -150rpx;
  width: 500rpx;
  height: 500rpx;
  background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding-top: 40rpx;
}

.back-btn {
  width: 64rpx;
  height: 64rpx;
  background: rgba(255,255,255,0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(255,255,255,0.15);
  flex-shrink: 0;
}

.back-btn:active {
  background: rgba(255,255,255,0.25);
}

.back-icon {
  width: 36rpx;
  height: 36rpx;
  filter: brightness(0) invert(1);
}

.hero-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.hero-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: 1rpx;
}

.hero-sub {
  font-size: 22rpx;
  color: rgba(255,255,255,0.7);
  margin-top: 6rpx;
  font-family: 'Courier New', monospace;
  letter-spacing: 1rpx;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  background: rgba(255,255,255,0.95);
  font-size: 22rpx;
  font-weight: 600;
  flex-shrink: 0;
}

.pill-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}

.status-pill.pill-pending   { color: #FF9F00; }
.status-pill.pill-pending   .pill-dot { background: #FF9F00; }
.status-pill.pill-confirmed { color: #07C160; }
.status-pill.pill-confirmed .pill-dot { background: #07C160; }
.status-pill.pill-rejected  { color: #999999; }
.status-pill.pill-rejected  .pill-dot { background: #999999; }
.status-pill.pill-duplicated{ color: #FF6B6B; }
.status-pill.pill-duplicated .pill-dot { background: #FF6B6B; }

/* ============ 事件信息卡 ============ */
.event-card {
  position: relative;
  background: #FFFFFF;
  border-radius: 24rpx;
  margin: -60rpx 24rpx 0;
  padding: 28rpx;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.08);
  z-index: 1;
}

.event-card-head {
  margin-bottom: 16rpx;
}

.event-type-tag {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 14rpx 6rpx 10rpx;
  border-radius: 10rpx;
  background: #F0F0F0;
  color: #666666;
}

.type-icon {
  width: 24rpx;
  height: 24rpx;
}

.event-type-tag.type-collect { background: rgba(15, 191, 159, 0.1); color: #0FBF9F; }
.event-type-tag.type-collect .type-icon { color: #0FBF9F; }
.event-type-tag.type-report  { background: rgba(255, 107, 107, 0.1); color: #FF6B6B; }
.event-type-tag.type-report  .type-icon { color: #FF6B6B; }
.event-type-tag.type-rescue  { background: rgba(76, 144, 230, 0.1); color: #4C90E6; }
.event-type-tag.type-rescue  .type-icon { color: #4C90E6; }
.event-type-tag.type-medical { background: rgba(255, 159, 0, 0.1); color: #FF9F00; }
.event-type-tag.type-medical .type-icon { color: #FF9F00; }
.event-type-tag.type-adopt   { background: rgba(255, 133, 192, 0.1); color: #FF85C0; }
.event-type-tag.type-adopt   .type-icon { color: #FF85C0; }
.event-type-tag.type-transfer{ background: rgba(155, 123, 255, 0.1); color: #9B7BFF; }
.event-type-tag.type-transfer .type-icon { color: #9B7BFF; }
.event-type-tag.type-release { background: rgba(7, 193, 96, 0.1); color: #07C160; }
.event-type-tag.type-release .type-icon { color: #07C160; }

.event-desc {
  font-size: 30rpx;
  color: #1A1A1A;
  font-weight: 500;
  line-height: 1.6;
  display: block;
  margin-bottom: 16rpx;
  word-break: break-all;
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
  width: 24rpx;
  height: 24rpx;
  color: #BBBBBB;
  flex-shrink: 0;
}

.meta-text {
  font-size: 24rpx;
  color: #999999;
}

.photo-row {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  margin-top: 8rpx;
}

.photo-thumb {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #F5F5F5;
  border: 2rpx solid #FFFFFF;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
}

/* ============ AI 匹配分析 ============ */
.ai-card {
  background: #FFFFFF;
  border-radius: 24rpx;
  margin: 24rpx 24rpx 0;
  padding: 24rpx 24rpx 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}

.ai-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #F5F5F5;
}

.ai-head-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.ai-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  background: linear-gradient(135deg, rgba(15, 191, 159, 0.15) 0%, rgba(76, 144, 230, 0.15) 100%);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-icon {
  width: 36rpx;
  height: 36rpx;
  color: #0FBF9F;
}

.ai-card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1A1A1A;
  display: block;
}

.ai-card-sub {
  font-size: 22rpx;
  color: #999999;
  display: block;
  margin-top: 4rpx;
}

/* 大圆综合得分 */
.fusion-orb {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.fusion-orb::before {
  content: '';
  position: absolute;
  inset: -6rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, transparent 0%, transparent 100%);
  z-index: -1;
  opacity: 0.4;
}

.fusion-orb.orb-high {
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
  color: #FFFFFF;
  box-shadow: 0 6rpx 20rpx rgba(255, 107, 107, 0.35);
}

.fusion-orb.orb-mid {
  background: linear-gradient(135deg, #FFB84D 0%, #FF9F00 100%);
  color: #FFFFFF;
  box-shadow: 0 6rpx 20rpx rgba(255, 159, 0, 0.35);
}

.fusion-orb.orb-low {
  background: #F5F5F5;
  color: #999999;
  border: 2rpx dashed #DDDDDD;
}

.orb-num {
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.orb-label {
  font-size: 18rpx;
  margin-top: 4rpx;
  opacity: 0.9;
  font-weight: 500;
}

.fusion-orb.orb-low .orb-num { color: #999999; }
.fusion-orb.orb-low .orb-label { color: #BBBBBB; }

/* 分数项 */
.score-items {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.score-item {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.score-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.score-label {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 500;
}

.score-weight-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-weight: 500;
}

.weight--high { background: rgba(255, 107, 107, 0.1); color: #FF6B6B; }
.weight--mid  { background: rgba(76, 144, 230, 0.1); color: #4C90E6; }
.weight--low  { background: rgba(155, 123, 255, 0.1); color: #9B7BFF; }

.score-bar-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.score-bar-bg {
  flex: 1;
  height: 14rpx;
  background: #F5F5F5;
  border-radius: 7rpx;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: 7rpx;
  transition: width 0.4s ease-out;
}

.fill-nose    { background: linear-gradient(90deg, #FF6B6B 0%, #FF9F00 100%); }
.fill-gps     { background: linear-gradient(90deg, #4C90E6 0%, #0FBF9F 100%); }
.fill-text    { background: linear-gradient(90deg, #9B7BFF 0%, #4C90E6 100%); }
.fill-time    { background: linear-gradient(90deg, #FF85C0 0%, #9B7BFF 100%); }

.fill-nose-text    { color: #FF6B6B; }
.fill-gps-text     { color: #4C90E6; }
.fill-text-text    { color: #9B7BFF; }
.fill-time-text    { color: #FF85C0; }

.score-value {
  font-size: 26rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 64rpx;
  text-align: right;
}

/* ============ 候选列表 ============ */
.candidates-section {
  margin: 24rpx 24rpx 0;
}

.candidates-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
  padding: 0 4rpx;
}

.candidates-head-left {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.head-icon {
  width: 32rpx;
  height: 32rpx;
  color: #0FBF9F;
}

.candidates-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1A1A1A;
}

.candidates-count {
  font-size: 22rpx;
  color: #999999;
  background: #F5F5F5;
  padding: 4rpx 14rpx;
  border-radius: 16rpx;
}

.candidate-card {
  position: relative;
  display: flex;
  align-items: stretch;
  background: #FFFFFF;
  border-radius: 20rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
  overflow: hidden;
  border: 2rpx solid transparent;
  transition: border-color 0.2s, transform 0.1s;
}

.candidate-card:active {
  transform: scale(0.99);
}

.candidate-card.selected {
  border-color: #0FBF9F;
  background: linear-gradient(135deg, rgba(15, 191, 159, 0.04) 0%, rgba(7, 193, 96, 0.04) 100%);
}

.candidate-accent {
  width: 6rpx;
  background: #EEEEEE;
  flex-shrink: 0;
  transition: background 0.2s;
}

.candidate-card.selected .candidate-accent { background: linear-gradient(180deg, #0FBF9F 0%, #07C160 100%); }
.candidate-card.recommended .candidate-accent { background: linear-gradient(180deg, #FF9F00 0%, #FF6B6B 100%); }
.candidate-card.recommended.selected .candidate-accent {
  background: linear-gradient(180deg, #0FBF9F 0%, #FF9F00 50%, #FF6B6B 100%);
}

.candidate-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;
  min-width: 0;
}

.candidate-photo-wrap {
  position: relative;
  flex-shrink: 0;
}

.candidate-photo {
  width: 120rpx;
  height: 120rpx;
  border-radius: 16rpx;
  background: #F5F5F5;
}

.candidate-recommend {
  position: absolute;
  top: -8rpx;
  left: -8rpx;
  display: flex;
  align-items: center;
  gap: 4rpx;
  background: linear-gradient(135deg, #FF9F00 0%, #FF6B6B 100%);
  color: #FFFFFF;
  font-size: 18rpx;
  font-weight: 600;
  padding: 4rpx 10rpx;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 6rpx rgba(255, 107, 107, 0.3);
}

.rec-icon {
  width: 18rpx;
  height: 18rpx;
  filter: brightness(0) invert(1);
}

.candidate-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.candidate-breed {
  font-size: 30rpx;
  font-weight: 700;
  color: #1A1A1A;
  display: block;
  margin-bottom: 4rpx;
}

.candidate-info-row {
  display: flex;
  align-items: center;
}

.candidate-color, .candidate-address {
  font-size: 22rpx;
  color: #999999;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280rpx;
}

.candidate-score-wrap {
  flex-shrink: 0;
  text-align: center;
  min-width: 96rpx;
}

.candidate-score-num {
  display: flex;
  align-items: baseline;
  justify-content: center;
  color: #0FBF9F;
}

.num-val {
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.num-unit {
  font-size: 20rpx;
  margin-left: 2rpx;
  color: #0FBF9F;
}

.candidate-score-label {
  font-size: 20rpx;
  color: #BBBBBB;
  margin-top: 4rpx;
  display: block;
}

.candidate-radio {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24rpx 0 0;
  flex-shrink: 0;
}

.radio-circle {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 2rpx solid #DDDDDD;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.radio-circle.filled {
  border-color: #0FBF9F;
  background: #0FBF9F;
}

.check-icon {
  width: 24rpx;
  height: 24rpx;
  filter: brightness(0) invert(1);
}

/* ============ 空状态 ============ */
.empty-hint {
  background: #FFFFFF;
  border-radius: 24rpx;
  margin: 24rpx 24rpx 0;
  padding: 60rpx 32rpx 56rpx;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
  border: 2rpx dashed #E8E8E8;
}

.empty-icon-bg {
  width: 144rpx;
  height: 144rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(15, 191, 159, 0.1) 0%, rgba(76, 144, 230, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24rpx;
}

.empty-icon {
  width: 80rpx;
  height: 80rpx;
  color: #0FBF9F;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1A1A1A;
  display: block;
  margin-bottom: 12rpx;
}

.empty-text {
  font-size: 24rpx;
  color: #999999;
  display: block;
  margin-bottom: 32rpx;
  line-height: 1.6;
  padding: 0 32rpx;
}

.empty-btn-wrap {
  display: flex;
  justify-content: center;
}

.empty-btn {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  font-size: 28rpx;
  font-weight: 600;
  padding: 18rpx 40rpx;
  border-radius: 40rpx;
  box-shadow: 0 6rpx 20rpx rgba(15, 191, 159, 0.3);
  transition: transform 0.1s, opacity 0.2s;
}

.empty-btn:active {
  transform: scale(0.97);
  opacity: 0.9;
}

.empty-btn-icon {
  width: 32rpx;
  height: 32rpx;
  filter: brightness(0) invert(1);
}

/* ============ 底部操作条 ============ */
.bottom-spacer {
  height: 140rpx;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #FFFFFF;
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.08);
  z-index: 10;
}

.action-reject, .action-confirm, .action-create {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 88rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: 600;
  transition: opacity 0.2s, transform 0.1s;
}

.action-icon {
  width: 32rpx;
  height: 32rpx;
}

.action-reject {
  background: #F5F5F5;
  color: #999999;
}

.action-reject .action-icon { color: #999999; }

.action-reject:active {
  background: #EEEEEE;
  transform: scale(0.99);
}

.action-confirm {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  box-shadow: 0 4rpx 16rpx rgba(15, 191, 159, 0.3);
}

.action-confirm .action-icon { filter: brightness(0) invert(1); }

.action-confirm:active {
  opacity: 0.9;
  transform: scale(0.99);
}

.action-confirm.disabled {
  background: #EEEEEE;
  color: #BBBBBB;
  box-shadow: none;
}

.action-confirm.disabled .action-icon {
  filter: none;
  color: #BBBBBB;
}

/* 【Bug 6 / 2026-07-08】创建新动物 — 与"合并"区分的蓝色主操作 */
.action-create {
  background: linear-gradient(135deg, #5B7CFA 0%, #3D5AFE 100%);
  color: #FFFFFF;
  box-shadow: 0 4rpx 16rpx rgba(91, 124, 250, 0.3);
}

.action-create .action-icon { filter: brightness(0) invert(1); }

.action-create:active {
  opacity: 0.9;
  transform: scale(0.99);
}
</style>
