<template>
  <view class="page">
    <!-- é¡¶éƒ¨ Heroï¼ˆåŽ»é‡å®¡æ ¸ä¸­å¿ƒæ ‡é¢˜ï¼‰ -->
    <view class="hero">
      <view class="hero-bg"></view>
      <view class="hero-content">
        <view class="hero-left">
          <text class="hero-title">å¾…å®¡ä¸­å¿ƒ</text>
          <text class="hero-sub">{{ pendingTotal }} ä»¶å¾…å¤„ç† Â· å®žæ—¶åŒæ­¥</text>
        </view>
        <view class="hero-stat" :class="pendingTotal > 0 ? 'has-pending' : 'all-clear'">
          <text class="stat-num">{{ pendingTotal }}</text>
          <text class="stat-label">{{ pendingTotal > 0 ? 'å¾…å®¡' : 'å·²æ¸…' }}</text>
        </view>
      </view>
    </view>

    <!-- Tab åˆ‡æ¢ -->
    <view class="audit-tabs">
      <view
        :class="['tab-item', { active: currentTab === 'events' }]"
        @click="switchTab('events')"
      >
        <image
          class="tab-icon"
          src="/static/icons/icon-event.svg"
          mode="aspectFit"
        />
        <text class="tab-text">äº‹ä»¶å®¡æ ¸</text>
        <view class="tab-badge" v-if="pendingEvents > 0">{{ pendingEvents }}</view>
      </view>
      <view
        :class="['tab-item', { active: currentTab === 'claims' }]"
        @click="switchTab('claims')"
      >
        <image
          class="tab-icon"
          src="/static/icons/icon-shield.svg"
          mode="aspectFit"
        />
        <text class="tab-text">è®¤é¢†å®¡æ ¸</text>
        <view class="tab-badge tab-badge--claim" v-if="pendingClaims > 0">{{ pendingClaims }}</view>
      </view>
    </view>

      <view
        :class="['tab-item', { active: currentTab === 'clues' }]"
        @click="goClues"
      >
        <image
          class="tab-icon"
          src="/static/icons/icon-target.svg"
          mode="aspectFit"
        />
        <text class="tab-text">线索审核</text>
        <view class="tab-badge tab-badge--clue" v-if="pendingClues > 0">{{ pendingClues }}</view>
      </view>
    </view>

    <!-- äº‹ä»¶å®¡æ ¸åˆ—è¡¨ -->
    <view v-if="currentTab === 'events'" class="tab-content">
      <view class="loading-state" v-if="loading">
        <view class="loading-spinner"></view>
        <text class="loading-text">åŠ è½½ä¸­...</text>
      </view>
      <view class="empty-state" v-else-if="events.length === 0">
        <view class="empty-icon-wrap">
          <image class="empty-icon" src="/static/icons/icon-check-circle-success.svg" mode="aspectFit" />
        </view>
        <text class="empty-title">æš‚æ— å¾…å®¡æ ¸äº‹ä»¶</text>
        <text class="empty-sub">æ‰€æœ‰äº‹ä»¶å·²å¤„ç†å®Œæ¯• âœ¨</text>
      </view>

      <audit-event-card
        v-for="item in events"
        :key="item.event_id"
        :event="item"
        @confirm="onConfirmEvent(item.event_id)"
        @reject="onRejectEvent(item.event_id)"
        @click="goToDetail(item.event_id)"
      />
    </view>

    <!-- è®¤é¢†å®¡æ ¸åˆ—è¡¨ -->
    <view v-if="currentTab === 'claims'" class="tab-content">
      <view class="loading-state" v-if="loading">
        <view class="loading-spinner"></view>
        <text class="loading-text">åŠ è½½ä¸­...</text>
      </view>
      <view class="empty-state" v-else-if="claims.length === 0">
        <view class="empty-icon-wrap">
          <image class="empty-icon" src="/static/icons/icon-shield.svg" mode="aspectFit" />
        </view>
        <text class="empty-title">æš‚æ— å¾…å®¡æ ¸è®¤é¢†</text>
        <text class="empty-sub">æ‰€æœ‰è®¤é¢†ç”³è¯·å·²å¤„ç†å®Œæ¯•</text>
      </view>

      <view
        v-for="item in claims"
        :key="item.claim_id"
        class="claim-card"
      >
        <view class="claim-accent"></view>
        <view class="claim-content">
          <view class="claim-header">
            <view class="claim-user">
              <view class="user-avatar">
                <image class="avatar-img" :src="resolveImageUrl(item.user?.avatar) || '/static/mock/avatar-default.png'" mode="aspectFill" />
              </view>
              <view class="user-info">
                <text class="user-name">{{ item.user?.nickname || 'åŒ¿åç”¨æˆ·' }}</text>
                <text class="user-phone">{{ item.user?.phone || '' }}</text>
              </view>
            </view>
            <text class="claim-time">{{ formatTime(item.created_at) }}</text>
          </view>

          <view class="claim-animal">
            <image
              class="animal-thumb"
              :src="resolveImageUrl(item.animal?.photos?.[0]) || '/static/mock/dog-placeholder.png'"
              mode="aspectFill"
            />
            <view class="animal-meta">
              <text class="animal-breed">{{ item.animal?.breed || 'æœªçŸ¥å“ç§' }}</text>
              <view class="animal-info-row">
                <text class="animal-info-item">ðŸ“ {{ item.animal?.address || 'æœªçŸ¥åœ°ç‚¹' }}</text>
              </view>
              <view class="animal-info-row">
                <text class="animal-info-item" v-if="item.animal?.color">ðŸŽ¨ {{ item.animal?.color }}</text>
              </view>
            </view>
          </view>

          <view class="claim-notes" v-if="item.notes">
            <text class="notes-label">è®¤é¢†è¯´æ˜Ž</text>
            <text class="notes-text">{{ item.notes }}</text>
          </view>

          <view class="claim-actions">
            <view class="action-btn reject" @click="onRejectClaim(item.claim_id)">
              <image class="action-icon" src="/static/icons/icon-x.svg" mode="aspectFit" />
              <text>é©³å›ž</text>
            </view>
            <view class="action-btn approve" @click="onApproveClaim(item.claim_id)">
              <image class="action-icon" src="/static/icons/icon-check.svg" mode="aspectFit" />
              <text>æ‰¹å‡†è®¤é¢†</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiGetAdminEvents, apiGetAdminClaims, apiGetPendingClues, apiConfirmEvent, apiRejectEvent, apiApproveClaim, apiRejectClaim, apiUpdateAnimal, resolveImageUrl } from '@/services/api'
import AuditEventCard from '@/components/audit-event-card/index.vue'

const currentTab = ref('events')
const events = ref<any[]>([])
const claims = ref<any[]>([])
const pendingEvents = ref(0)
const pendingClaims = ref(0)
const loading = ref(true)

const pendingClues = ref(0)
const pendingTotal = computed(() => pendingEvents.value + pendingClaims.value + pendingClues.value)

onMounted(() => {
  const launchOptions = uni.getLaunchOptionsSync()
  if (launchOptions.query?.type === 'claims') {
    currentTab.value = 'claims'
  }
  loadAuditData()
})

async function loadAuditData() {
  loading.value = true
  try {
    const [eRes, cRes] = await Promise.all([
      apiGetAdminEvents({ status: 'pending' }),
      apiGetAdminClaims({ status: 'pending' }),
      apiGetPendingClues().catch(() => ({ data: { items: [], total: 0 } })),
    ])

    if (eRes.code === 0) {
      events.value = eRes.data?.list || []
      pendingEvents.value = eRes.data?.total || 0
    }
    if (cRes.code === 0) {
      claims.value = cRes.data?.list || []
      pendingClaims.value = cRes.data?.total || 0
    }
    const pRes: any = results[2]
    const pPayload = pRes && pRes.data ? pRes.data : pRes
    pendingClues.value = (pPayload && pPayload.total) || (pPayload && pPayload.items ? pPayload.items.length : 0)
  } catch (e) {
    console.error('åŠ è½½å®¡æ ¸æ•°æ®å¤±è´¥', e)
    uni.showToast({ title: 'åŠ è½½å¤±è´¥ï¼Œè¯·é‡è¯•', icon: 'none' })
  }
  loading.value = false
}

function switchTab(tab: string) {
  currentTab.value = tab
}

function goClues() {
  uni.navigateTo({ url: '/pages/admin/clues/index' })
}

function formatTime(isoString: string) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return `ä»Šå¤© ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function goToDetail(eventId: string) {
  uni.navigateTo({ url: `/pages/admin/audit-detail/index?event_id=${eventId}` })
}

async function onConfirmEvent(eventId: string) {
  uni.showModal({
    title: 'ç¡®è®¤é€šè¿‡',
    content: 'ç¡®å®šè¦å°†è¯¥äº‹ä»¶æ ‡è®°ä¸ºé‡å¤å¹¶åˆå¹¶æ¡£æ¡ˆå—ï¼Ÿ',
    confirmText: 'ç¡®è®¤',
    cancelText: 'å–æ¶ˆ',
    confirmColor: '#07C160',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiConfirmEvent(eventId)
          uni.showToast({ title: 'å·²ç¡®è®¤', icon: 'success' })
          events.value = events.value.filter(e => e.event_id !== eventId)
          pendingEvents.value = Math.max(0, pendingEvents.value - 1)
        } catch (e) {
          console.error('ç¡®è®¤äº‹ä»¶å¤±è´¥', e)
          uni.showToast({ title: 'æ“ä½œå¤±è´¥', icon: 'none' })
        }
      }
    }
  })
}

async function onRejectEvent(eventId: string) {
  uni.showModal({
    title: 'é©³å›žäº‹ä»¶',
    content: 'ç¡®å®šè¦é©³å›žè¯¥äº‹ä»¶å—ï¼Ÿ',
    confirmText: 'é©³å›ž',
    cancelText: 'å–æ¶ˆ',
    confirmColor: '#FF6B6B',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiRejectEvent(eventId)
          uni.showToast({ title: 'å·²é©³å›ž', icon: 'success' })
          events.value = events.value.filter(e => e.event_id !== eventId)
          pendingEvents.value = Math.max(0, pendingEvents.value - 1)
        } catch (e) {
          console.error('é©³å›žäº‹ä»¶å¤±è´¥', e)
          uni.showToast({ title: 'æ“ä½œå¤±è´¥', icon: 'none' })
        }
      }
    }
  })
}

async function onApproveClaim(claimId: string) {
  const claim = claims.value.find(c => c.claim_id === claimId)
  if (!claim) return

  uni.showModal({
    title: 'æ‰¹å‡†è®¤é¢†',
    content: `ç¡®å®šè¦æ‰¹å‡† ${claim.user?.nickname || 'è¯¥ç”¨æˆ·'} çš„è®¤é¢†ç”³è¯·å—ï¼Ÿ`,
    confirmText: 'æ‰¹å‡†',
    cancelText: 'å–æ¶ˆ',
    confirmColor: '#07C160',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiApproveClaim(claimId)
          if (claim.animal_id) {
            await apiUpdateAnimal(claim.animal_id, { status: 'claimed' })
          }
          uni.showToast({ title: 'å·²æ‰¹å‡†', icon: 'success' })
          claims.value = claims.value.filter(c => c.claim_id !== claimId)
          pendingClaims.value = Math.max(0, pendingClaims.value - 1)
        } catch (e) {
          console.error('æ‰¹å‡†è®¤é¢†å¤±è´¥', e)
          uni.showToast({ title: 'æ“ä½œå¤±è´¥', icon: 'none' })
        }
      }
    }
  })
}

async function onRejectClaim(claimId: string) {
  uni.showModal({
    title: 'é©³å›žè®¤é¢†',
    content: 'ç¡®å®šè¦é©³å›žè¯¥è®¤é¢†ç”³è¯·å—ï¼Ÿ',
    confirmText: 'é©³å›ž',
    cancelText: 'å–æ¶ˆ',
    confirmColor: '#FF6B6B',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiRejectClaim(claimId)
          uni.showToast({ title: 'å·²é©³å›ž', icon: 'success' })
          claims.value = claims.value.filter(c => c.claim_id !== claimId)
          pendingClaims.value = Math.max(0, pendingClaims.value - 1)
        } catch (e) {
          console.error('é©³å›žè®¤é¢†å¤±è´¥', e)
          uni.showToast({ title: 'æ“ä½œå¤±è´¥', icon: 'none' })
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
  padding-bottom: 40rpx;
}

/* ============ é¡¶éƒ¨ Hero ============ */
.hero {
  position: relative;
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
  padding: 24rpx 32rpx 80rpx;
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
  justify-content: space-between;
  padding-top: 40rpx;
}

.hero-left {
  display: flex;
  flex-direction: column;
}

.hero-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: 1rpx;
}

.hero-sub {
  font-size: 24rpx;
  color: rgba(255,255,255,0.75);
  margin-top: 8rpx;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: rgba(255,255,255,0.15);
  border: 2rpx solid rgba(255,255,255,0.25);
  backdrop-filter: blur(10rpx);
}

.hero-stat.has-pending {
  background: rgba(255,255,255,0.95);
  border-color: rgba(255,255,255,1);
}

.hero-stat.all-clear {
  background: rgba(7, 193, 96, 0.95);
  border-color: rgba(7, 193, 96, 1);
}

.hero-stat .stat-num {
  font-size: 56rpx;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.hero-stat.has-pending .stat-num { color: #FF6B6B; }
.hero-stat.all-clear .stat-num   { color: #FFFFFF; }

.hero-stat .stat-label {
  font-size: 20rpx;
  margin-top: 6rpx;
  font-weight: 500;
}

.hero-stat.has-pending .stat-label { color: #FF6B6B; }
.hero-stat.all-clear .stat-label   { color: rgba(255,255,255,0.9); }

/* ============ Tab åˆ‡æ¢ ============ */
.audit-tabs {
  display: flex;
  background: #FFFFFF;
  margin: -40rpx 24rpx 0;
  border-radius: 20rpx;
  padding: 8rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.08);
  position: relative;
  z-index: 1;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 0;
  border-radius: 16rpx;
  position: relative;
  transition: background 0.2s;
}

.tab-item.active {
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
}

.tab-item.active .tab-text { color: #FFFFFF; font-weight: 600; }
.tab-item.active .tab-icon { color: #FFFFFF; }
.tab-item.active .tab-badge { background: #FFFFFF; color: #FF6B6B; }

.tab-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 8rpx;
  color: #999999;
  flex-shrink: 0;
}

.tab-text {
  font-size: 28rpx;
  color: #666666;
}

.tab-badge {
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 10rpx;
  margin-left: 8rpx;
  background: #FF6B6B;
  color: #FFFFFF;
  font-size: 20rpx;
  font-weight: 600;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

.tab-badge--claim {
  background: #FF9F00;
}

/* ============ åˆ—è¡¨åŒº ============ */
.tab-content {
  padding: 24rpx;
  min-height: 400rpx;
}

/* ============ åŠ è½½çŠ¶æ€ ============ */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.loading-spinner {
  width: 56rpx;
  height: 56rpx;
  border: 4rpx solid #F0F0F0;
  border-top-color: #FF6B6B;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 20rpx;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 26rpx;
  color: #999999;
}

/* ============ ç©ºçŠ¶æ€ ============ */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0;
}

.empty-icon-wrap {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: rgba(7, 193, 96, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.empty-icon {
  width: 80rpx;
  height: 80rpx;
  color: #07C160;
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

/* ============ è®¤é¢†å¡ç‰‡ ============ */
.claim-card {
  position: relative;
  display: flex;
  background: #FFFFFF;
  border-radius: 20rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.05);
  overflow: hidden;
}

.claim-accent {
  width: 6rpx;
  background: linear-gradient(180deg, #FF9F00 0%, #FF6B6B 100%);
  flex-shrink: 0;
}

.claim-content {
  flex: 1;
  padding: 24rpx;
  min-width: 0;
}

.claim-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.claim-user {
  display: flex;
  align-items: center;
}

.user-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #F5F5F5;
  overflow: hidden;
  margin-right: 16rpx;
  flex-shrink: 0;
  border: 2rpx solid #FFFFFF;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.user-phone {
  font-size: 22rpx;
  color: #999999;
  margin-top: 4rpx;
}

.claim-time {
  font-size: 22rpx;
  color: #BBBBBB;
}

.claim-animal {
  display: flex;
  align-items: center;
  background: #FAFBFC;
  border-radius: 16rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
}

.animal-thumb {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  margin-right: 16rpx;
  background: #E8FDF8;
  flex-shrink: 0;
}

.animal-meta {
  flex: 1;
  min-width: 0;
}

.animal-breed {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
  display: block;
  margin-bottom: 8rpx;
}

.animal-info-row {
  margin-top: 4rpx;
}

.animal-info-item {
  font-size: 22rpx;
  color: #666666;
}

.claim-notes {
  background: #FFFBF0;
  border: 1rpx solid #FFE8B0;
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
}

.notes-label {
  font-size: 22rpx;
  color: #C8851A;
  font-weight: 600;
  display: block;
  margin-bottom: 6rpx;
}

.notes-text {
  font-size: 26rpx;
  color: #1A1A1A;
  line-height: 1.5;
  display: block;
  word-break: break-all;
}

.claim-actions {
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
  height: 72rpx;
  border-radius: 36rpx;
  font-size: 28rpx;
  font-weight: 600;
  transition: opacity 0.2s;
}

.action-icon {
  width: 28rpx;
  height: 28rpx;
}

.action-btn.approve {
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  box-shadow: 0 4rpx 12rpx rgba(15, 191, 159, 0.25);
}

.action-btn.approve .action-icon {
  filter: brightness(0) invert(1);
}

.action-btn.approve:active { opacity: 0.85; }

.action-btn.reject {
  background: #F5F5F5;
  color: #999999;
}

.action-btn.reject .action-icon { color: #999999; }

.action-btn.reject:active { background: #EEEEEE; }
</style>
