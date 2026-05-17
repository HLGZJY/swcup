<template>
  <view class="audit-card" @click="$emit('click', event)">
    <view class="card-header">
      <view class="event-type-tag" :class="'type-' + event.event_type">
        {{ eventTypeMap[event.event_type] || event.event_type }}
      </view>
      <view class="fusion-score" v-if="event.fusion_score">
        <text class="score-label">融合</text>
        <text class="score-val">{{ (event.fusion_score * 100).toFixed(0) }}%</text>
      </view>
    </view>

    <view class="card-body">
      <view class="info-row" v-if="event.description">
        <text class="info-text">{{ event.description }}</text>
      </view>
      <view class="info-row">
        <text class="info-icon">📍</text>
        <text class="info-text">{{ event.address || '未知地址' }}</text>
      </view>
      <view class="info-row">
        <text class="info-icon">🕐</text>
        <text class="info-text">{{ formatTime(event.occurred_at) }}</text>
      </view>
    </view>

    <view class="card-footer">
      <view class="status-badge" :class="'status-' + event.status">
        {{ statusMap[event.status] }}
      </view>
      <view class="action-group">
        <view class="action-btn confirm" @click.stop="$emit('confirm', event)">
          <text>确认</text>
        </view>
        <view class="action-btn reject" @click.stop="$emit('reject', event)">
          <text>驳回</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Event {
  event_id: string
  event_type: string
  status: string
  description?: string
  address?: string
  occurred_at: string
  fusion_score?: number
  is_duplicate?: boolean
  reporter_id?: string
}

defineProps<{ event: Event }>()

defineEmits<{
  (e: 'click', event: Event): void
  (e: 'confirm', event: Event): void
  (e: 'reject', event: Event): void
}>()

const eventTypeMap: Record<string, string> = {
  report: '上报',
  rescue: '救助',
  medical: '医疗',
  adopt: '领养',
  transfer: '转移',
  release: '放归'
}

const statusMap: Record<string, string> = {
  pending: '待审核',
  confirmed: '已确认',
  duplicated: '重复',
  resolved: '已处理',
  rejected: '已驳回'
}

function formatTime(isoString: string) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped lang="scss">
.audit-card {
  background: #2A2A2A;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid #3A3A3A;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.event-type-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: #3A3A3A;
  color: #FFFFFF;
}

.event-type-tag.type-report { background: #FF6B6B33; color: #FF6B6B; }
.event-type-tag.type-rescue { background: #0FBF9F33; color: #0FBF9F; }
.event-type-tag.type-medical { background: #FF9F0033; color: #FF9F00; }

.fusion-score {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.score-label {
  font-size: 20rpx;
  color: #999999;
}

.score-val {
  font-size: 24rpx;
  font-weight: 700;
  color: #FF6B6B;
}

.card-body {
  margin-bottom: 16rpx;
}

.info-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8rpx;
}

.info-icon {
  font-size: 22rpx;
  margin-right: 8rpx;
  flex-shrink: 0;
}

.info-text {
  font-size: 24rpx;
  color: #CCCCCC;
  line-height: 1.4;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.status-badge.status-pending { background: #FF9F0033; color: #FF9F00; }
.status-badge.status-confirmed { background: #07C16033; color: #07C160; }
.status-badge.status-rejected { background: #99999933; color: #999999; }

.action-group {
  display: flex;
  gap: 12rpx;
}

.action-btn {
  padding: 10rpx 24rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  font-weight: 600;
}

.action-btn.confirm {
  background: #FF6B6B;
  color: #FFFFFF;
}

.action-btn.reject {
  background: #3A3A3A;
  color: #999999;
}
</style>
