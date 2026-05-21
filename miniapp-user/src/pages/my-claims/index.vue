<template>
  <view class="page">
    <view class="list-empty" v-if="claims.length === 0 && !loading">
      <image class="empty-icon" src="/static/icons/icon-heart.png" mode="aspectFit" />
      <text class="empty-text">暂无认领记录</text>
      <text class="empty-hint">快去认领你心仪的动物吧</text>
    </view>

    <view
      v-for="item in claims"
      :key="item.claim_id"
      class="claim-card"
      @click="goToAnimal(item.animal_id)"
    >
      <view class="claim-header">
        <text class="claim-animal">认领申请 #{{ item.claim_id.slice(-6) }}</text>
        <view :class="['claim-status', 'status-' + item.status]">
          {{ statusMap[item.status] }}
        </view>
      </view>
      <text class="claim-notes">{{ item.notes || '无备注' }}</text>
      <view class="claim-footer">
        <text class="claim-time">{{ formatTime(item.created_at) }}</text>
        <image class="claim-arrow" src="/static/icons/icon-chevron-right.png" mode="aspectFit" />
      </view>
    </view>

    <view class="loading" v-if="loading">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetMyClaims } from '@/services/api'

const claims = ref<any[]>([])
const loading = ref(false)

const statusMap: Record<string, string> = {
  pending: '待审核',
  approved: '已批准',
  rejected: '已驳回',
  cancelled: '已取消'
}

onMounted(async () => {
  loading.value = true
  try {
    const res: any = await apiGetMyClaims()
    claims.value = res.data
  } catch (e) {
    console.error('加载我的认领失败', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
  loading.value = false
})

function formatTime(isoString: string) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  return Math.floor(diff / 86400) + '天前'
}

function goToAnimal(animalId: string) {
  if (!animalId) return
  uni.navigateTo({
    url: `/pages/animal-detail/index?animal_id=${animalId}`
  })
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F5F5;
  padding: 24rpx;
}

.list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  width: 96rpx;
  height: 96rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #666666;
}

.empty-hint {
  font-size: 24rpx;
  color: #999999;
  margin-top: 8rpx;
}

.claim-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.claim-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.claim-animal {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.claim-status {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
}

.status-pending { background: #FFF8E8; color: #FF9F00; }
.status-approved { background: #E8FDF8; color: #07C160; }
.status-rejected { background: #FFF0F0; color: #FF6B6B; }
.status-cancelled { background: #F0F0F0; color: #999999; }

.claim-notes {
  font-size: 24rpx;
  color: #666666;
  display: block;
  margin-bottom: 12rpx;
  line-height: 1.5;
}

.claim-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.claim-time {
  font-size: 22rpx;
  color: #999999;
}

.claim-arrow {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
}

.loading {
  text-align: center;
  padding: 24rpx;
  color: #999999;
  font-size: 24rpx;
}
</style>
