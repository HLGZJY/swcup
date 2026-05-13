<template>
  <view class="page">
    <!-- Tab切换 -->
    <view class="audit-tabs">
      <view
        :class="['tab-item', { active: currentTab === 'events' }]"
        @click="switchTab('events')"
      >
        <text>事件审核</text>
        <view class="tab-badge" v-if="pendingEvents > 0">{{ pendingEvents }}</view>
      </view>
      <view
        :class="['tab-item', { active: currentTab === 'claims' }]"
        @click="switchTab('claims')"
      >
        <text>认领审核</text>
        <view class="tab-badge claim" v-if="pendingClaims > 0">{{ pendingClaims }}</view>
      </view>
    </view>

    <!-- 事件审核列表 -->
    <view v-if="currentTab === 'events'">
      <!-- 加载状态 -->
      <view class="loading-state" v-if="loading">
        <text class="loading-icon">⏳</text>
        <text class="loading-text">加载中...</text>
      </view>
      <!-- 空状态（仅在非加载且无数据时显示） -->
      <view class="empty-state" v-else-if="events.length === 0">
        <text class="empty-icon">✅</text>
        <text class="empty-text">暂无待审核事件</text>
      </view>

      <audit-event-card
        v-for="item in events"
        :key="item.event_id"
        :event="item"
        @confirm="onConfirmEvent(item.event_id)"
        @reject="onRejectEvent(item.event_id)"
      />
    </view>

    <!-- 认领审核列表 -->
    <view v-if="currentTab === 'claims'">
      <!-- 加载状态 -->
      <view class="loading-state" v-if="loading">
        <text class="loading-icon">⏳</text>
        <text class="loading-text">加载中...</text>
      </view>
      <!-- 空状态（仅在非加载且无数据时显示） -->
      <view class="empty-state" v-else-if="claims.length === 0">
        <text class="empty-icon">🏠</text>
        <text class="empty-text">暂无待审核认领</text>
      </view>

      <view
        v-for="item in claims"
        :key="item.claim_id"
        class="audit-card claim-card"
      >
        <view class="card-header">
          <text class="claim-title">认领申请</text>
          <text class="event-time">{{ formatTime(item.created_at) }}</text>
        </view>

        <view class="card-body">
          <view class="user-info">
            <text class="user-name">{{ item.user?.nickname }}</text>
            <text class="user-phone">{{ item.user?.phone }}</text>
          </view>

          <view class="animal-preview">
            <image class="animal-thumb" :src="item.animal?.photos[0] || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
            <view class="animal-meta">
              <text class="animal-breed">{{ item.animal?.breed }}</text>
              <text class="animal-color">{{ item.animal?.color }}</text>
              <text class="animal-address">{{ item.animal?.address }}</text>
            </view>
          </view>

          <view class="claim-notes">
            <text class="notes-label">认领说明：</text>
            <text class="notes-text">{{ item.notes }}</text>
          </view>
        </view>

        <view class="card-actions">
          <view class="action-reject" @click="onRejectClaim(item.claim_id)">
            <text>驳回</text>
          </view>
          <view class="action-confirm approve" @click="onApproveClaim(item.claim_id)">
            <text>批准认领</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { mockGetAdminEvents, mockGetAdminClaims, mockConfirmEvent, mockRejectEvent, mockApproveClaim, mockRejectClaim } from '@/services/mock'
import AuditEventCard from '@/components/audit-event-card/index.vue'

const currentTab = ref('events')
const events = ref<any[]>([])
const claims = ref<any[]>([])
const pendingEvents = ref(0)
const pendingClaims = ref(0)
const loading = ref(true)

const eventTypeMap: Record<string, string> = {
  report: '上报', rescue: '救助', medical: '医疗', adopt: '领养', transfer: '转运', release: '放归'
}

onMounted(async () => {
  // 读取 URL 参数初始化 Tab
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = (currentPage as any).options || {}
  if (options.type === 'claims') {
    currentTab.value = 'claims'
  }

  const [eRes, cRes] = await Promise.all([
    mockGetAdminEvents({ status: 'pending' }),
    mockGetAdminClaims({ status: 'pending' })
  ])

  if (eRes.code === 0) {
    events.value = eRes.data.list
    pendingEvents.value = eRes.data.total
  }
  if (cRes.code === 0) {
    claims.value = cRes.data.list
    pendingClaims.value = cRes.data.total
  }
  loading.value = false
})

function switchTab(tab: string) {
  currentTab.value = tab
}

function formatTime(isoString: string) {
  const d = new Date(isoString)
  return `${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function onConfirmEvent(eventId: string) {
  uni.showModal({
    title: '确认操作',
    content: '确定要确认该事件为重复吗？',
    success: async (res) => {
      if (res.confirm) {
        const r: any = await mockConfirmEvent(eventId)
        if (r.code === 0) {
          uni.showToast({ title: '已确认', icon: 'success' })
          events.value = events.value.filter(e => e.event_id !== eventId)
          pendingEvents.value--
        }
      }
    }
  })
}

async function onRejectEvent(eventId: string) {
  uni.showModal({
    title: '确认驳回',
    content: '确定要驳回该事件吗？',
    success: async (res) => {
      if (res.confirm) {
        const r: any = await mockRejectEvent(eventId)
        if (r.code === 0) {
          uni.showToast({ title: '已驳回', icon: 'success' })
          events.value = events.value.filter(e => e.event_id !== eventId)
          pendingEvents.value--
        }
      }
    }
  })
}

async function onApproveClaim(claimId: string) {
  uni.showModal({
    title: '批准认领',
    content: '确定要批准该认领申请吗？',
    success: async (res) => {
      if (res.confirm) {
        const r: any = await mockApproveClaim(claimId)
        if (r.code === 0) {
          uni.showToast({ title: '已批准', icon: 'success' })
          claims.value = claims.value.filter(c => c.claim_id !== claimId)
          pendingClaims.value--
        }
      }
    }
  })
}

async function onRejectClaim(claimId: string) {
  uni.showModal({
    title: '驳回认领',
    content: '确定要驳回该认领申请吗？',
    success: async (res) => {
      if (res.confirm) {
        const r: any = await mockRejectClaim(claimId)
        if (r.code === 0) {
          uni.showToast({ title: '已驳回', icon: 'success' })
          claims.value = claims.value.filter(c => c.claim_id !== claimId)
          pendingClaims.value--
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
}

.audit-tabs {
  display: flex;
  background: #FFFFFF;
  padding: 0 32rpx;
  border-bottom: 1rpx solid #EEEEEE;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  font-size: 28rpx;
  color: #666666;
  position: relative;
}

.tab-item.active {
  color: #FF6B6B;
  font-weight: 600;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: #FF6B6B;
  border-radius: 2rpx;
}

.tab-badge {
  background: #FF6B6B;
  color: #FFFFFF;
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 20rpx;
  margin-left: 8rpx;
}

.tab-badge.claim {
  background: #FF9F00;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.loading-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.loading-text {
  font-size: 28rpx;
  color: #999999;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
}

.audit-card {
  background: #FFFFFF;
  margin: 24rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.claim-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.event-time {
  font-size: 22rpx;
  color: #999999;
}

.card-body {
  margin-bottom: 20rpx;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.user-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.user-phone {
  font-size: 24rpx;
  color: #999999;
}

.animal-preview {
  display: flex;
  align-items: center;
  background: #F5F5F5;
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
}

.animal-thumb {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  margin-right: 16rpx;
  background: #E8FDF8;
}

.animal-meta {
  flex: 1;
}

.animal-breed {
  font-size: 26rpx;
  font-weight: 600;
  color: #1A1A1A;
  display: block;
}

.animal-color, .animal-address {
  font-size: 22rpx;
  color: #999999;
  display: block;
}

.claim-notes {
  background: #FAFAFA;
  border-radius: 8rpx;
  padding: 12rpx;
}

.notes-label {
  font-size: 22rpx;
  color: #999999;
}

.notes-text {
  font-size: 24rpx;
  color: #666666;
}

.card-actions {
  display: flex;
  gap: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #F5F5F5;
}

.action-reject, .action-confirm {
  flex: 1;
  text-align: center;
  padding: 20rpx;
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

.action-confirm.approve {
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
}
</style>
