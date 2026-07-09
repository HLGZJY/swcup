<template>
  <view class="audit-card" @click="$emit('click', event)">
    <!-- 左侧 4px 强调边 -->
    <view class="card-accent" :class="'accent-' + event.event_type"></view>

    <view class="card-content">
      <!-- 顶部：类型 tag + 融合得分进度条 -->
      <view class="card-header">
        <view class="header-left">
          <view class="event-type-tag" :class="'type-' + event.event_type">
            <image
              class="tag-icon"
              :src="typeIconMap[event.event_type] || '/static/icons/icon-list.svg'"
              mode="aspectFit"
            />
            <text>{{ eventTypeMap[event.event_type] || event.event_type }}</text>
          </view>
        </view>
        <view class="header-right" v-if="event.fusion_score">
          <text class="fusion-label">融合度</text>
          <view class="fusion-bar">
            <view
              class="fusion-bar-fill"
              :class="'fusion-' + fusionLevel"
              :style="{ width: (event.fusion_score * 100) + '%' }"
            ></view>
          </view>
          <text class="fusion-val" :class="'fusion-' + fusionLevel">
            {{ (event.fusion_score * 100).toFixed(0) }}%
          </text>
        </view>
      </view>

      <!-- 主体：描述 + 位置 + 时间 -->
      <view class="card-body">
        <text class="event-desc">{{ formatEventDesc(event) }}</text>
        <view class="meta-row">
          <image class="meta-icon" src="/static/icons/icon-mappin.svg" mode="aspectFit" />
          <text class="meta-text">{{ formatEventAddress(event) }}</text>
        </view>
        <view class="meta-row">
          <image class="meta-icon" src="/static/icons/icon-clock.svg" mode="aspectFit" />
          <text class="meta-text">{{ formatTime(event.occurred_at) }}</text>
        </view>
      </view>

      <!-- 底部：操作按钮 — 流程文档第2节:三按钮固定(驳回/同意新建/合并) -->
      <view class="card-footer">
        <view class="action-btn reject" @click.stop="$emit('reject', event)" aria-label="驳回">
          <image class="action-icon" src="/static/icons/icon-x.svg" mode="aspectFit" />
          <text>驳回</text>
        </view>
        <view class="action-btn create-new" @click.stop="$emit('create-new', event)" aria-label="同意新建">
          <image class="action-icon" src="/static/icons/icon-plus.svg" mode="aspectFit" />
          <text>同意新建</text>
        </view>
        <view class="action-btn merge" @click.stop="$emit('merge', event)" aria-label="合并">
          <image class="action-icon" src="/static/icons/icon-merge.svg" mode="aspectFit" />
          <text>合并</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Event {
  event_id: string
  event_type: string
  status: string
  description?: string
  address?: string
  location_lat?: number | string
  location_lng?: number | string
  occurred_at: string
  fusion_score?: number
  is_duplicate?: boolean
  reporter_id?: string
}

const props = defineProps<{ event: Event }>()

// 【P1 合规改造 2026-07-09】三按钮事件:reject / create-new / merge
//   原 confirm (调 apiConfirmEvent,旧 API 误用为"确认通过") 已删除,语义与三按钮冲突
//   merge 跳转到 audit-detail 页(卡片层无候选列表,候选选择需在详情页完成)
defineEmits<{
  (e: 'click', event: Event): void
  (e: 'reject', event: Event): void
  (e: 'create-new', event: Event): void
  (e: 'merge', event: Event): void
}>()

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

// 融合度分级（颜色 + 标签）
const fusionLevel = computed(() => {
  const s = props.event?.fusion_score || 0
  if (s >= 0.88) return 'high'
  if (s >= 0.75) return 'mid'
  return 'low'
})

function formatTime(isoString: string) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatEventDesc(event: any) {
  if (event.description) return event.description
  if (event.event_type === 'collect') return '用户进行了鼻纹采集比对'
  return '无描述'
}

function formatEventAddress(event: any) {
  if (event.address) return event.address
  if (event.location_lat && event.location_lng) {
    return `${Number(event.location_lat).toFixed(4)}, ${Number(event.location_lng).toFixed(4)}`
  }
  return '未知地点'
}
</script>

<style scoped lang="scss">
.audit-card {
  position: relative;
  display: flex;
  background: #FFFFFF;
  border-radius: 20rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);
  overflow: hidden;
  transition: transform 0.1s;
}

.audit-card:active {
  transform: scale(0.99);
}

/* 左侧强调边 */
.card-accent {
  width: 6rpx;
  flex-shrink: 0;
}

.accent-collect { background: #0FBF9F; }
.accent-report  { background: #FF6B6B; }
.accent-rescue  { background: #4C90E6; }
.accent-medical { background: #FF9F00; }
.accent-adopt   { background: #FF85C0; }
.accent-transfer{ background: #9B7BFF; }
.accent-release { background: #07C160; }

.card-content {
  flex: 1;
  padding: 24rpx 24rpx 20rpx 20rpx;
  min-width: 0;
}

/* ===== 顶部 ===== */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
  gap: 16rpx;
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
  white-space: nowrap;
}

.tag-icon {
  width: 24rpx;
  height: 24rpx;
  flex-shrink: 0;
}

.event-type-tag.type-collect { background: rgba(15, 191, 159, 0.1); color: #0FBF9F; }
.event-type-tag.type-collect .tag-icon { color: #0FBF9F; }
.event-type-tag.type-report  { background: rgba(255, 107, 107, 0.1); color: #FF6B6B; }
.event-type-tag.type-report  .tag-icon { color: #FF6B6B; }
.event-type-tag.type-rescue  { background: rgba(76, 144, 230, 0.1); color: #4C90E6; }
.event-type-tag.type-rescue  .tag-icon { color: #4C90E6; }
.event-type-tag.type-medical { background: rgba(255, 159, 0, 0.1); color: #FF9F00; }
.event-type-tag.type-medical .tag-icon { color: #FF9F00; }
.event-type-tag.type-adopt   { background: rgba(255, 133, 192, 0.1); color: #FF85C0; }
.event-type-tag.type-adopt   .tag-icon { color: #FF85C0; }
.event-type-tag.type-transfer{ background: rgba(155, 123, 255, 0.1); color: #9B7BFF; }
.event-type-tag.type-transfer .tag-icon { color: #9B7BFF; }
.event-type-tag.type-release { background: rgba(7, 193, 96, 0.1); color: #07C160; }
.event-type-tag.type-release .tag-icon { color: #07C160; }

/* 融合度进度条 */
.header-right {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.fusion-label {
  font-size: 20rpx;
  color: #999999;
}

.fusion-bar {
  width: 80rpx;
  height: 8rpx;
  background: #F0F0F0;
  border-radius: 4rpx;
  overflow: hidden;
}

.fusion-bar-fill {
  height: 100%;
  border-radius: 4rpx;
  transition: width 0.3s;
}

.fusion-val {
  font-size: 22rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 48rpx;
  text-align: right;
}

.fusion-high { color: #FF6B6B; }
.fusion-mid  { color: #FF9F00; }
.fusion-low  { color: #999999; }

.fusion-bar-fill.fusion-high { background: #FF6B6B; }
.fusion-bar-fill.fusion-mid  { background: #FF9F00; }
.fusion-bar-fill.fusion-low  { background: #BBBBBB; }

/* ===== 主体 ===== */
.card-body {
  margin-bottom: 20rpx;
}

.event-desc {
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 500;
  line-height: 1.5;
  display: block;
  margin-bottom: 12rpx;
  word-break: break-all;
}

.meta-row {
  display: flex;
  align-items: center;
  margin-bottom: 6rpx;
}

.meta-row:last-child { margin-bottom: 0; }

.meta-icon {
  width: 24rpx;
  height: 24rpx;
  margin-right: 8rpx;
  color: #BBBBBB;
  flex-shrink: 0;
}

.meta-text {
  font-size: 24rpx;
  color: #999999;
  line-height: 1.4;
}

/* ===== 底部操作按钮 ===== */
.card-footer {
  display: flex;
  gap: 12rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #F5F5F5;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 64rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  font-weight: 600;
  transition: opacity 0.2s;
}

.action-icon {
  width: 24rpx;
  height: 24rpx;
}

.action-btn.confirm,
.action-btn.create-new {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  box-shadow: 0 4rpx 12rpx rgba(15, 191, 159, 0.25);
}

.action-btn.confirm .action-icon,
.action-btn.create-new .action-icon {
  filter: brightness(0) invert(1);
}

.action-btn.confirm:active,
.action-btn.create-new:active {
  opacity: 0.85;
}

.action-btn.merge {
  background: linear-gradient(135deg, #4C90E6 0%, #9B7BFF 100%);
  color: #FFFFFF;
  box-shadow: 0 4rpx 12rpx rgba(76, 144, 230, 0.25);
}

.action-btn.merge .action-icon {
  filter: brightness(0) invert(1);
}

.action-btn.merge:active {
  opacity: 0.85;
}

.action-btn.reject {
  background: #F5F5F5;
  color: #999999;
}

.action-btn.reject .action-icon {
  color: #999999;
}

.action-btn.reject:active {
  background: #EEEEEE;
}
</style>
