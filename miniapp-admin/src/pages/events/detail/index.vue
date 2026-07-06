<template>
  <view class="page">
    <!-- 加载中 -->
    <view class="loading-state" v-if="loading">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else-if="!event">
      <view class="empty-icon-bg">
        <image class="empty-icon-img" src="/static/icons/icon-list.svg" mode="aspectFit" />
      </view>
      <text class="empty-title">未找到该事件</text>
      <text class="empty-sub">可能已被删除或链接失效</text>
    </view>

    <template v-else>
      <!-- 事件头部 -->
      <view class="event-header-card" :class="'card-accent-' + event.status">
        <view class="event-header">
          <view :class="['event-type', 'type-' + event.event_type]">
            <view class="type-dot" :class="'type-dot-' + event.event_type"></view>
            <text>{{ eventTypeMap[event.event_type] }}</text>
          </view>
          <view :class="['status-badge', 'status-' + event.status]">
            <view class="status-dot" :class="'status-dot-' + event.status"></view>
            <text>{{ statusMap[event.status] }}</text>
          </view>
        </view>
        <text class="event-desc">{{ event.description }}</text>
      </view>

      <!-- 基本信息 -->
      <view class="info-card" :class="'card-accent-' + event.status">
        <view class="card-title-row">
          <image class="card-title-icon" src="/static/icons/icon-list.svg" mode="aspectFit" />
          <text class="section-title">基本信息</text>
        </view>
        <view class="info-list">
          <view class="info-item">
            <text class="label">事件类型</text>
            <text class="value">{{ eventTypeMap[event.event_type] }}</text>
          </view>
          <view class="info-item">
            <text class="label">状态</text>
            <view :class="['value-tag', 'value-status-' + event.status]">
              <view class="value-dot" :class="'status-dot-' + event.status"></view>
              <text>{{ statusMap[event.status] }}</text>
            </view>
          </view>
          <view class="info-item">
            <text class="label">发生时间</text>
            <text class="value">{{ formatTime(event.occurred_at) }}</text>
          </view>
          <view class="info-item">
            <text class="label">上报人</text>
            <text class="value value-mono">{{ event.reporter_id }}</text>
          </view>
        </view>
      </view>

      <!-- 位置信息 -->
      <view class="info-card" :class="'card-accent-' + event.status">
        <view class="card-title-row">
          <image class="card-title-icon" src="/static/icons/icon-mappin.svg" mode="aspectFit" />
          <text class="section-title">位置信息</text>
        </view>
        <view class="address-wrap">
          <image class="address-icon" src="/static/icons/icon-mappin.svg" mode="aspectFit" />
          <text class="address">{{ event.address }}</text>
        </view>
        <view class="map-preview" @click="openMap" v-if="event.location_lat">
          <view class="map-overlay">
            <view class="map-button">
              <image class="map-icon" src="/static/icons/icon-mappin.svg" mode="aspectFit" />
              <text>点击查看地图</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 关联动物 -->
      <view class="info-card" :class="'card-accent-' + event.status" v-if="event.animal_id">
        <view class="card-title-row">
          <image class="card-title-icon" src="/static/icons/icon-paw.svg" mode="aspectFit" />
          <text class="section-title">关联动物</text>
        </view>
        <view class="animal-link" @click="goToAnimal(event.animal_id)">
          <text class="link-text">查看动物档案</text>
          <image class="link-arrow" src="/static/icons/icon-chevron-right.svg" mode="aspectFit" />
        </view>
      </view>

      <!-- 融合得分 -->
      <view class="info-card" :class="'card-accent-' + event.status" v-if="event.fusion_score">
        <view class="card-title-row">
          <image class="card-title-icon" src="/static/icons/icon-brain.svg" mode="aspectFit" />
          <text class="section-title">AI 融合得分</text>
        </view>
        <view :class="['score-display', 'score-' + fusionLevel(event.fusion_score)]">
          <view class="score-ring">
            <text class="score-value">{{ (event.fusion_score * 100).toFixed(0) }}</text>
            <text class="score-unit">%</text>
          </view>
          <text class="score-label">重复匹配度</text>
          <view class="score-level" :class="'level-' + fusionLevel(event.fusion_score)">
            {{ fusionLevelText(event.fusion_score) }}
          </view>
        </view>
      </view>

      <!-- 时间线 -->
      <view class="info-card" :class="'card-accent-' + event.status">
        <view class="card-title-row">
          <image class="card-title-icon" src="/static/icons/icon-clock.svg" mode="aspectFit" />
          <text class="section-title">时间记录</text>
        </view>
        <view class="timeline">
          <view class="timeline-item">
            <view class="timeline-dot"></view>
            <view class="timeline-content">
              <text class="timeline-label">创建时间</text>
              <text class="timeline-value">{{ formatTime(event.created_at) }}</text>
            </view>
          </view>
          <view class="timeline-item">
            <view class="timeline-dot"></view>
            <view class="timeline-content">
              <text class="timeline-label">发生时间</text>
              <text class="timeline-value">{{ formatTime(event.occurred_at) }}</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAdminEventDetail, resolveImageUrl } from '@/services/api'

const event = ref<any>(null)
const loading = ref(false)

const statusMap: Record<string, string> = {
  pending: '待处理', confirmed: '已确认', duplicated: '重复', linked: '关联', resolved: '已完成', rejected: '已驳回'
}

const eventTypeMap: Record<string, string> = {
  report: '上报', rescue: '救助', medical: '医疗', adopt: '领养', transfer: '转运', release: '放归'
}

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const eventId = currentPage?.options?.event_id
  if (!eventId) return

  loading.value = true
  try {
    const res: any = await apiGetAdminEventDetail(eventId)
    if (res.code === 0) {
      event.value = res.data
    }
  } catch (e) {
    console.error('加载事件详情失败', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})

function formatTime(isoString?: string) {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function openMap() {
  if (!event.value?.location_lat || !event.value?.location_lng) {
    uni.showToast({ title: '暂无位置坐标', icon: 'none' })
    return
  }
  const name = event.value.address || `${event.value.location_lat},${event.value.location_lng}`
  uni.openLocation({
    latitude: Number(event.value.location_lat),
    longitude: Number(event.value.location_lng),
    name,
    address: event.value.address,
    fail: (err) => {
      console.error('openLocation fail', err)
      uni.showToast({ title: '地图打开失败', icon: 'none' })
    }
  })
}

function goToAnimal(animalId: string) {
  uni.navigateTo({ url: `/pages/animals/detail/index?animal_id=${animalId}` })
}

// 融合度分级（高/中/低）— 仅 UI 配色使用
function fusionLevel(score: number): string {
  if (score >= 0.88) return 'high'
  if (score >= 0.75) return 'mid'
  return 'low'
}

function fusionLevelText(score: number): string {
  const level = fusionLevel(score)
  if (level === 'high') return '高度疑似'
  if (level === 'mid')  return '疑似重复'
  return '相似度低'
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 60rpx;
  padding-top: env(safe-area-inset-top);
}

/* ============ 加载状态 ============ */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  gap: 16rpx;
}

.loading-spinner {
  width: 56rpx;
  height: 56rpx;
  border: 4rpx solid #F0F0F0;
  border-top-color: #0FBF9F;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-text {
  font-size: 26rpx;
  color: #999999;
}

/* ============ 空状态 ============ */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  padding: 0 32rpx;
}

.empty-icon-bg {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(15, 191, 159, 0.1) 0%, rgba(76, 144, 230, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.empty-icon-img {
  width: 80rpx;
  height: 80rpx;
  color: #0FBF9F;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1A1A1A;
  margin-bottom: 8rpx;
}

.empty-sub {
  font-size: 24rpx;
  color: #999999;
}

/* ============ 事件头部卡（带左侧色条）============ */
.event-header-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  padding: 32rpx 32rpx 32rpx 36rpx;
  margin-bottom: 16rpx;
  overflow: hidden;
}

.event-header-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6rpx;
}

.event-header-card.card-accent-pending   ::before { background: linear-gradient(180deg, #FFB84D 0%, #FF9F00 100%); }
.event-header-card.card-accent-confirmed ::before { background: linear-gradient(180deg, #0FBF9F 0%, #07C160 100%); }
.event-header-card.card-accent-resolved  ::before { background: linear-gradient(180deg, #4C90E6 0%, #0FBF9F 100%); }
.event-header-card.card-accent-duplicated::before { background: linear-gradient(180deg, #9B7BFF 0%, #8B5CF6 100%); }
.event-header-card.card-accent-rejected  ::before { background: linear-gradient(180deg, #BBBBBB 0%, #888888 100%); }
.event-header-card.card-accent-linked    ::before { background: linear-gradient(180deg, #FF85C0 0%, #9B7BFF 100%); }

.event-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
  flex-wrap: wrap;
}

/* 事件类型 tag — 圆点+浅底（7 种颜色） */
.event-type {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx 12rpx 4rpx 10rpx;
  border-radius: 10rpx;
  background: rgba(15, 191, 159, 0.1);
  color: #0FBF9F;
}

.type-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.type-collect   { background: rgba(15, 191, 159, 0.1);  color: #0FBF9F; }
.type-report    { background: rgba(255, 107, 107, 0.1); color: #FF6B6B; }
.type-rescue    { background: rgba(76, 144, 230, 0.1);  color: #4C90E6; }
.type-medical   { background: rgba(255, 159, 0, 0.1);   color: #FF9F00; }
.type-adopt     { background: rgba(255, 133, 192, 0.1); color: #FF85C0; }
.type-transfer  { background: rgba(155, 123, 255, 0.1); color: #9B7BFF; }
.type-release   { background: rgba(7, 193, 96, 0.1);    color: #07C160; }

/* 事件状态 badge — 圆点+浅底 */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx 12rpx 4rpx 10rpx;
  border-radius: 10rpx;
  background: rgba(255, 159, 0, 0.1);
  color: #FF9F00;
}

.status-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-pending    { background: rgba(255, 159, 0, 0.1);  color: #FF9F00; }
.status-confirmed  { background: rgba(7, 193, 96, 0.1);   color: #07C160; }
.status-resolved   { background: rgba(76, 144, 230, 0.1); color: #4C90E6; }
.status-rejected   { background: rgba(187, 187, 187, 0.18); color: #888888; }
.status-duplicated { background: rgba(155, 123, 255, 0.1); color: #9B7BFF; }
.status-linked     { background: rgba(255, 133, 192, 0.1); color: #FF85C0; }

.event-desc {
  font-size: 30rpx;
  font-weight: 600;
  color: #1A1A1A;
  line-height: 1.5;
  word-break: break-all;
  display: block;
}

/* ============ 信息卡（带左侧色条 + 卡片标题行）============ */
.info-card {
  position: relative;
  background: #FFFFFF;
  margin: 0 24rpx 16rpx;
  border-radius: 20rpx;
  padding: 24rpx 24rpx 24rpx 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
  overflow: hidden;
}

.info-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6rpx;
  background: #EEEEEE;
}

.info-card.card-accent-pending   ::before { background: linear-gradient(180deg, #FFB84D 0%, #FF9F00 100%); }
.info-card.card-accent-confirmed ::before { background: linear-gradient(180deg, #0FBF9F 0%, #07C160 100%); }
.info-card.card-accent-resolved  ::before { background: linear-gradient(180deg, #4C90E6 0%, #0FBF9F 100%); }
.info-card.card-accent-duplicated::before { background: linear-gradient(180deg, #9B7BFF 0%, #8B5CF6 100%); }
.info-card.card-accent-rejected  ::before { background: linear-gradient(180deg, #BBBBBB 0%, #888888 100%); }
.info-card.card-accent-linked    ::before { background: linear-gradient(180deg, #FF85C0 0%, #9B7BFF 100%); }

/* 卡片标题行（icon + 标题）*/
.card-title-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.card-title-icon {
  width: 32rpx;
  height: 32rpx;
  color: #0FBF9F;
  flex-shrink: 0;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1A1A1A;
  letter-spacing: 1rpx;
}

/* 基本信息列表（4 行单列，避免长 ID 折行）*/
.info-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  min-height: 56rpx;
}

.info-item .label {
  font-size: 24rpx;
  color: #999999;
  flex-shrink: 0;
  min-width: 120rpx;
}

.info-item .value {
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 500;
  text-align: right;
  word-break: break-all;
  flex: 1;
  min-width: 0;
}

.value-mono {
  font-family: 'Courier New', 'Menlo', monospace;
  font-size: 24rpx;
  color: #666666;
  font-weight: 400;
}

/* "状态"字段特殊渲染：圆点+浅底 tag */
.value-tag {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 24rpx;
  font-weight: 600;
  padding: 4rpx 14rpx 4rpx 10rpx;
  border-radius: 12rpx;
  background: rgba(255, 159, 0, 0.1);
  color: #FF9F00;
}

.value-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: currentColor;
}

.value-status-pending    { background: rgba(255, 159, 0, 0.1);  color: #FF9F00; }
.value-status-confirmed  { background: rgba(7, 193, 96, 0.1);   color: #07C160; }
.value-status-resolved   { background: rgba(76, 144, 230, 0.1); color: #4C90E6; }
.value-status-rejected   { background: rgba(187, 187, 187, 0.18); color: #888888; }
.value-status-duplicated { background: rgba(155, 123, 255, 0.1); color: #9B7BFF; }
.value-status-linked     { background: rgba(255, 133, 192, 0.1); color: #FF85C0; }

/* ============ 位置信息 ============ */
.address-wrap {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
  padding: 14rpx 16rpx;
  background: #FAFBFC;
  border-radius: 12rpx;
}

.address-icon {
  width: 26rpx;
  height: 26rpx;
  margin-right: 10rpx;
  flex-shrink: 0;
  color: #0FBF9F;
}

.address {
  font-size: 28rpx;
  color: #1A1A1A;
  flex: 1;
  word-break: break-all;
  font-weight: 500;
}

/* 地图预览 — 毛玻璃圆形按钮 */
.map-preview {
  height: 320rpx;
  background: linear-gradient(135deg, #E8FDF8 0%, #D0F0E8 50%, #C5E5DD 100%);
  border-radius: 20rpx;
  margin-top: 16rpx;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 0 0 2rpx rgba(15, 191, 159, 0.1);
  transition: transform 0.15s;
}

.map-preview:active {
  transform: scale(0.99);
}

.map-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2rpx);
}

.map-button {
  display: flex;
  align-items: center;
  gap: 10rpx;
  background: rgba(255, 255, 255, 0.95);
  padding: 16rpx 32rpx;
  border-radius: 40rpx;
  box-shadow: 0 6rpx 24rpx rgba(15, 191, 159, 0.25);
  transition: transform 0.1s;
}

.map-preview:active .map-button {
  transform: scale(0.96);
}

.map-icon {
  width: 36rpx;
  height: 36rpx;
  color: #0FBF9F;
  flex-shrink: 0;
}

.map-button text {
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 600;
  letter-spacing: 1rpx;
}

/* ============ 关联动物链接 ============ */
.animal-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(15, 191, 159, 0.06);
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  transition: background 0.2s, transform 0.1s;
}

.animal-link:active {
  background: rgba(15, 191, 159, 0.12);
  transform: scale(0.99);
}

.link-text {
  font-size: 28rpx;
  color: #0FBF9F;
  font-weight: 600;
}

.link-arrow {
  width: 32rpx;
  height: 32rpx;
  color: #0FBF9F;
}

/* ============ AI 融合得分 — 视觉化 ============ */
.score-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 0 8rpx;
}

.score-ring {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin-bottom: 8rpx;
}

.score-value {
  font-size: 72rpx;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -2rpx;
}

.score-unit {
  font-size: 28rpx;
  font-weight: 700;
  margin-left: 4rpx;
  font-variant-numeric: tabular-nums;
}

.score-label {
  font-size: 24rpx;
  color: #999999;
  margin-top: 4rpx;
}

/* 等级色 */
.score-high .score-value,
.score-high .score-unit { color: #FF6B6B; }

.score-mid  .score-value,
.score-mid  .score-unit { color: #FF9F00; }

.score-low  .score-value,
.score-low  .score-unit { color: #BBBBBB; }

/* 等级标签 */
.score-level {
  margin-top: 12rpx;
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 18rpx;
  border-radius: 20rpx;
}

.level-high {
  background: rgba(255, 107, 107, 0.1);
  color: #FF6B6B;
}

.level-mid {
  background: rgba(255, 159, 0, 0.1);
  color: #FF9F00;
}

.level-low {
  background: rgba(187, 187, 187, 0.18);
  color: #888888;
}

/* ============ 时间线 ============ */
.timeline {
  display: flex;
  flex-direction: column;
  padding-left: 8rpx;
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  position: relative;
  padding-bottom: 20rpx;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

/* 时间线条 + 圆点 */
.timeline-item::before {
  content: '';
  position: absolute;
  left: 12rpx;
  top: 28rpx;
  bottom: 0;
  width: 2rpx;
  background: #F0F0F0;
}

.timeline-item:last-child::before {
  display: none;
}

.timeline-dot {
  width: 26rpx;
  height: 26rpx;
  border-radius: 50%;
  background: #FFFFFF;
  border: 4rpx solid #0FBF9F;
  flex-shrink: 0;
  margin-right: 16rpx;
  position: relative;
  z-index: 1;
}

.timeline-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  padding-top: 2rpx;
}

.timeline-label {
  font-size: 22rpx;
  color: #999999;
}

.timeline-value {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
</style>