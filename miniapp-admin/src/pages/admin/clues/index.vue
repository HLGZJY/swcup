<!--
  pages/admin/clues/index.vue
  评论线索审核列表 (P3 2026-07-07)
  复用 audit/index.vue 的 hero 风格
-->
<template>
  <view class="page">
    <view class="hero">
      <view class="hero-bg"></view>
      <view class="hero-content">
        <view class="hero-left">
          <text class="hero-title">评论线索</text>
          <text class="hero-sub">{{ pendingTotal }} 条待确认 · AI 自动匹配</text>
        </view>
        <view class="hero-stat" :class="pendingTotal > 0 ? 'has-pending' : 'all-clear'">
          <text class="stat-num">{{ pendingTotal }}</text>
          <text class="stat-label">{{ pendingTotal > 0 ? 'pending' : '已清' }}</text>
        </view>
      </view>
    </view>

    <view v-if="loading" class="loading-state">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="items.length === 0" class="empty-state">
      <view class="empty-icon-wrap">
        <image class="empty-icon" src="/static/icons/icon-check-circle-success.svg" mode="aspectFit" />
      </view>
      <text class="empty-title">暂无待审核线索</text>
      <text class="empty-sub">用户报告类评论暂时没有匹配到任何事件 ✨</text>
    </view>

    <view v-else class="clue-list">
      <view v-for="item in items" :key="item.match_id" class="clue-card">
        <view class="clue-header">
          <view class="score-badge" :class="scoreClass(item.match_score)">
            <text class="score-num">{{ (item.match_score * 100).toFixed(0) }}</text>
            <text class="score-label">score</text>
          </view>
          <view class="meta">
            <text class="sentiment-tag" :class="'sentiment-' + item.sentiment">{{ item.sentiment }}</text>
            <text class="recorded-time">{{ formatTime(item.recorded_at) }}</text>
          </view>
        </view>

        <view class="clue-body">
          <view class="comment-block">
            <text class="comment-label">用户评论</text>
            <text class="comment-content">{{ commentPreview[item.comment_id] || '加载中...' }}</text>
            <view class="keyword-row" v-if="item.keywords && item.keywords.length">
              <text class="kw-chip" v-for="k in item.keywords" :key="k">{{ k }}</text>
            </view>
          </view>

          <view class="arrow-line">
            <text class="arrow-text">↓ 匹配到 ↓</text>
          </view>

          <view class="event-block">
            <text class="event-label">候选事件</text>
            <view class="event-info-row">
              <text class="event-eventid">#{{ item.candidate_event_id.slice(0, 8) }}</text>
              <text class="event-address">{{ item.candidate_event_address || '(无地址)' }}</text>
            </view>
            <view class="match-reasons" v-if="item.match_reasons && item.match_reasons.length">
              <text class="reason" v-for="(r, i) in item.match_reasons" :key="i">• {{ r }}</text>
            </view>
          </view>
        </view>

        <view class="clue-actions">
          <view class="action-btn reject" @click="onDecide(item, 'rejected')">
            <image class="action-icon" src="/static/icons/icon-x.svg" mode="aspectFit" />
            <text>驳回</text>
          </view>
          <view class="action-btn approve" @click="onDecide(item, 'confirmed')">
            <image class="action-icon" src="/static/icons/icon-check.svg" mode="aspectFit" />
            <text>确认关联</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiGetPendingClues, apiDecideClue } from '@/services/clue'

const items = ref<any[]>([])
const commentPreview = ref<Record<string, string>>({})
const loading = ref(true)

const pendingTotal = computed(() => items.value.length)

function scoreClass(s: number) {
  if (s >= 0.7) return 'score-high'
  if (s >= 0.5) return 'score-mid'
  return 'score-low'
}

function formatTime(iso: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${m}-${day} ${hh}:${mm}`
  } catch {
    return iso
  }
}

async function loadList() {
  loading.value = true
  try {
    const r: any = await apiGetPendingClues()
    const payload = r && r.data ? r.data : r
    const list = (payload && payload.items) || []
    items.value = list
    for (const it of list) {
      commentPreview.value[it.comment_id] = `[comment ${it.comment_id.slice(0, 8)}] sentiment=${it.sentiment}, kw=${(it.keywords || []).slice(0, 3).join(',')}`
    }
  } catch (e) {
    console.error('[clues] loadList failed', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function onDecide(item: any, decision: 'confirmed' | 'rejected') {
  const note = ''
  try {
    const r: any = await apiDecideClue(item.animal_id, item.match_id, decision, note)
    const ok = r && (r.ok || (r.data && r.data.ok))
    if (ok) {
      uni.showToast({ title: decision === 'confirmed' ? '已确认关联' : '已驳回', icon: 'success' })
      items.value = items.value.filter((x) => x.match_id !== item.match_id)
    } else {
      uni.showToast({ title: '操作失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '网络异常', icon: 'none' })
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.page { min-height: 100vh; background: #F5F5F5; padding-bottom: 40rpx; }

.hero { position: relative; padding: 40rpx 32rpx 32rpx; background: linear-gradient(135deg, #1A1A1A, #2A2A2A); overflow: hidden; }
.hero-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle at 80% 20%, rgba(255,107,107,0.15) 0%, transparent 60%); }
.hero-content { position: relative; display: flex; align-items: center; justify-content: space-between; }
.hero-left { flex: 1; }
.hero-title { display: block; color: #FFFFFF; font-size: 40rpx; font-weight: 700; margin-bottom: 8rpx; }
.hero-sub { color: #999; font-size: 24rpx; }
.hero-stat { display: flex; flex-direction: column; align-items: center; padding: 16rpx 24rpx; border-radius: 16rpx; min-width: 100rpx; }
.hero-stat.has-pending { background: rgba(255,107,107,0.2); }
.hero-stat.all-clear { background: rgba(15,191,159,0.2); }
.hero-stat .stat-num { font-size: 36rpx; font-weight: 700; color: #FFFFFF; line-height: 1; }
.hero-stat.has-pending .stat-num { color: #FF6B6B; }
.hero-stat.all-clear .stat-num { color: #0FBF9F; }
.hero-stat .stat-label { font-size: 18rpx; color: #999; margin-top: 4rpx; }

.loading-state { display: flex; flex-direction: column; align-items: center; padding: 200rpx 0; }
.loading-spinner { width: 48rpx; height: 48rpx; border: 4rpx solid #E0E0E0; border-top-color: #FF6B6B; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { margin-top: 16rpx; color: #999; font-size: 24rpx; }

.empty-state { display: flex; flex-direction: column; align-items: center; padding: 200rpx 0; }
.empty-icon-wrap { width: 120rpx; height: 120rpx; border-radius: 50%; background: rgba(15,191,159,0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 24rpx; }
.empty-icon { width: 60rpx; height: 60rpx; }
.empty-title { color: #333; font-size: 30rpx; font-weight: 600; }
.empty-sub { color: #999; font-size: 24rpx; margin-top: 8rpx; }

.clue-list { padding: 24rpx 32rpx; }
.clue-card { background: #FFFFFF; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04); }
.clue-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.score-badge { display: flex; flex-direction: column; align-items: center; padding: 8rpx 16rpx; border-radius: 12rpx; min-width: 80rpx; }
.score-badge.score-high { background: rgba(255,107,107,0.15); }
.score-badge.score-mid { background: rgba(255,159,0,0.15); }
.score-badge.score-low { background: rgba(153,153,153,0.15); }
.score-num { font-size: 32rpx; font-weight: 700; line-height: 1; }
.score-high .score-num { color: #FF6B6B; }
.score-mid .score-num { color: #FF9F00; }
.score-low .score-num { color: #999; }
.score-label { font-size: 16rpx; color: #999; margin-top: 2rpx; }
.meta { display: flex; flex-direction: column; align-items: flex-end; }
.sentiment-tag { display: inline-block; padding: 4rpx 12rpx; border-radius: 8rpx; font-size: 20rpx; margin-bottom: 6rpx; }
.sentiment-tag.sentiment-report { background: #FFF3E0; color: #FF6B6B; }
.sentiment-tag.sentiment-seek { background: #E3F2FD; color: #2196F3; }
.sentiment-tag.sentiment-thanks { background: #E8F5E9; color: #0FBF9F; }
.sentiment-tag.sentiment-care { background: #FCE4EC; color: #E91E63; }
.sentiment-tag.sentiment-neutral { background: #F0F0F0; color: #666; }
.recorded-time { font-size: 20rpx; color: #999; }

.clue-body { padding: 16rpx 0; border-top: 1rpx solid #F0F0F0; border-bottom: 1rpx solid #F0F0F0; }
.comment-block, .event-block { padding: 12rpx 0; }
.comment-label, .event-label { display: block; font-size: 20rpx; color: #999; margin-bottom: 8rpx; }
.comment-content { display: block; color: #333; font-size: 28rpx; line-height: 1.5; }
.keyword-row { margin-top: 12rpx; display: flex; flex-wrap: wrap; gap: 8rpx; }
.kw-chip { padding: 4rpx 12rpx; background: #FFF3E0; color: #FF6B6B; border-radius: 8rpx; font-size: 20rpx; }
.arrow-line { text-align: center; padding: 12rpx 0; }
.arrow-text { color: #999; font-size: 22rpx; letter-spacing: 4rpx; }
.event-info-row { display: flex; align-items: baseline; gap: 12rpx; }
.event-eventid { color: #999; font-size: 22rpx; }
.event-address { color: #333; font-size: 26rpx; flex: 1; }
.match-reasons { margin-top: 12rpx; padding: 12rpx; background: #FAFAFA; border-radius: 8rpx; }
.reason { display: block; color: #666; font-size: 20rpx; line-height: 1.6; }

.clue-actions { display: flex; gap: 16rpx; padding-top: 16rpx; }
.action-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8rpx; padding: 16rpx; border-radius: 12rpx; }
.action-btn.reject { background: #FAFAFA; color: #999; border: 1rpx solid #E0E0E0; }
.action-btn.approve { background: linear-gradient(135deg, #FF6B6B, #FF9F00); color: #FFFFFF; }
.action-icon { width: 28rpx; height: 28rpx; }
.action-btn text { font-size: 26rpx; font-weight: 600; }
.action-btn.reject text { color: #999; }
</style>