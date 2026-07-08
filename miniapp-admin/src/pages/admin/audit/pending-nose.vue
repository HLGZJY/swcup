<template>
  <view class="page">
    <!-- 顶部条 -->
    <view class="hero">
      <view class="hero-bg"></view>
      <view class="hero-content">
        <view class="hero-left">
          <text class="hero-title">待审鼻纹记录</text>
          <text class="hero-sub">含 LOW_SCORE_NOSE + USER_CREATE_REQUEST 双源</text>
        </view>
        <view class="hero-stat">
          <text class="stat-num">{{ list.length }}</text>
          <text class="stat-label">待处理</text>
        </view>
      </view>
    </view>

    <view v-if="loading && list.length === 0" class="empty-state">
      <text class="empty-text">加载中…</text>
    </view>

    <view v-else-if="list.length === 0" class="empty-state">
      <text class="empty-icon">✅</text>
      <text class="empty-text">暂无待审记录</text>
    </view>

    <!-- 列表卡片 -->
    <view v-else>
      <view
        v-for="item in list"
        :key="item.record_id"
        class="record-card"
      >
        <!-- 来源标签 -->
        <view class="source-bar">
          <view
            class="source-badge"
            :class="item.source === 'user_create_request' ? 'src-user' : 'src-low'"
          >
            <text>{{ sourceText[item.source] || item.source }}</text>
          </view>
          <text class="time-text">{{ formatTime(item.created_at) }}</text>
        </view>

        <!-- 动物基础信息 -->
        <view class="info-row">
          <text class="info-key">品种</text>
          <text class="info-val">{{ item.breed || '-' }}</text>
        </view>
        <view class="info-row">
          <text class="info-key">毛色</text>
          <text class="info-val">{{ item.color || '-' }}</text>
        </view>
        <view class="info-row">
          <text class="info-key">性别</text>
          <text class="info-val">{{ genderText[item.gender] || item.gender || '-' }}</text>
        </view>
        <view class="info-row">
          <text class="info-key">地址</text>
          <text class="info-val">{{ item.address || '-' }}</text>
        </view>
        <view v-if="item.notes" class="info-row notes-row">
          <text class="info-key">备注</text>
          <text class="info-val">{{ item.notes }}</text>
        </view>

        <!-- 提交者 -->
        <view class="info-row">
          <text class="info-key">采集者</text>
          <text class="info-val">{{ item.collector_id?.slice(0, 8) || '-' }}</text>
        </view>

        <!-- 操作按钮: 通过 / 驳回 -->
        <view class="action-bar">
          <view
            class="action-btn reject"
            :class="{ disabled: item._busy }"
            @click="onReject(item)"
          >
            <text>驳回</text>
          </view>
          <view
            class="action-btn approve"
            :class="{ disabled: item._busy }"
            @click="onApprove(item)"
          >
            <text>通过并新建</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import {
  apiGetAdminPendingNoseRecords,
  apiPostAdminPendingNoseApprove,
  apiPostAdminPendingNoseReject,
} from '@/services/api'

const list = ref<any[]>([])
const loading = ref(false)

const sourceText: Record<string, string> = {
  low_score_nose: '低分鼻纹',
  user_create_request: '用户建档',
}
const genderText: Record<string, string> = {
  male: '公',
  female: '母',
  unknown: '未知',
}

onShow(() => loadList())

onPullDownRefresh(async () => {
  await loadList()
  uni.stopPullDownRefresh()
})

async function loadList() {
  loading.value = true
  try {
    const res: any = await apiGetAdminPendingNoseRecords({ status: 'pending', limit: 50 })
    if (res.code === 0) {
      list.value = (res.data?.list || []).map((it: any) => ({ ...it, _busy: false }))
    }
  } catch (e) {
    console.error('[pending-nose] load fail', e)
    uni.showToast({ title: '加载失败，请重试', icon: 'none' })
  }
  loading.value = false
}

async function onApprove(item: any) {
  if (item._busy) return
  item._busy = true
  try {
    const res: any = await apiPostAdminPendingNoseApprove(item.record_id)
    if (res.code === 0) {
      uni.showToast({ title: '已通过', icon: 'success' })
      await loadList()
    } else {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: '网络异常', icon: 'none' })
  }
  item._busy = false
}

async function onReject(item: any) {
  if (item._busy) return
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '驳回此记录?',
      content: '驳回后用户可在小程序端重新提交',
      success: (r) => resolve(r.confirm),
      fail: () => resolve(false),
    })
  })
  if (!confirmed) return
  item._busy = true
  try {
    const res: any = await apiPostAdminPendingNoseReject(item.record_id)
    if (res.code === 0) {
      uni.showToast({ title: '已驳回', icon: 'success' })
      await loadList()
    } else {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: '网络异常', icon: 'none' })
  }
  item._busy = false
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = Date.now()
  const diffMin = Math.round((now - d.getTime()) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 32rpx;
}

.hero {
  background: linear-gradient(135deg, #4A90E2 0%, #5872E0 100%);
  padding: 32rpx 32rpx 36rpx;
  position: relative;
}
.hero-bg { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.05); }
.hero-content {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #FFFFFF;
}
.hero-title { font-size: 36rpx; font-weight: 700; display: block; }
.hero-sub { font-size: 22rpx; opacity: 0.85; display: block; margin-top: 6rpx; }
.hero-stat {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12rpx;
  padding: 12rpx 20rpx;
  text-align: center;
}
.stat-num { font-size: 36rpx; font-weight: 700; display: block; line-height: 1; }
.stat-label { font-size: 18rpx; opacity: 0.85; display: block; margin-top: 4rpx; }

.empty-state {
  padding: 200rpx 32rpx;
  text-align: center;
}
.empty-icon { font-size: 96rpx; display: block; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 16rpx; display: block; }

.record-card {
  background: #FFFFFF;
  margin: 24rpx 24rpx 0;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.source-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
  border-bottom: 2rpx solid #F0F0F0;
  margin-bottom: 16rpx;
}
.source-badge {
  display: inline-flex;
  padding: 6rpx 16rpx;
  border-radius: 30rpx;
  font-size: 22rpx;
  color: #FFFFFF;
}
.src-user { background: #0FBF9F; }
.src-low  { background: #FF9F00; }
.time-text { font-size: 22rpx; color: #999; }

.info-row {
  display: flex;
  margin-bottom: 12rpx;
}
.info-row.notes-row {
  align-items: flex-start;
  flex-direction: column;
  background: #FAFAFA;
  padding: 12rpx 16rpx;
  border-radius: 8rpx;
}
.info-key {
  width: 120rpx;
  font-size: 24rpx;
  color: #999;
  flex-shrink: 0;
}
.info-val {
  flex: 1;
  font-size: 26rpx;
  color: #1A1A1A;
  word-break: break-all;
}

.action-bar {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 2rpx solid #F0F0F0;
}
.action-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: 600;
  transition: background 0.15s;
}
.action-btn:active { opacity: 0.7; }
.action-btn.disabled { opacity: 0.5; pointer-events: none; }
.action-btn.reject {
  background: #FFFFFF;
  color: #FF6B6B;
  border: 2rpx solid #FF6B6B;
}
.action-btn.approve {
  background: #0FBF9F;
  color: #FFFFFF;
}
</style>
