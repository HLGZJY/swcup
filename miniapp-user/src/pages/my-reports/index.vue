<template>
  <view class="page">
    <view class="list-empty" v-if="reports.length === 0 && !loading">
      <text class="empty-icon">📋</text>
      <text class="empty-text">暂无上报记录</text>
      <text class="empty-hint">快去发现身边的流浪动物吧</text>
    </view>

    <view
      v-for="item in reports"
      :key="item.event_id"
      class="report-card"
      @click="goToAnimal(item.animal_id)"
    >
      <view class="report-header">
        <view class="report-type">{{ eventTypeMap[item.event_type] }}</view>
        <view :class="['report-status', 'status-' + item.status]">
          {{ statusMap[item.status] }}
        </view>
      </view>
      <text class="report-desc">{{ item.description || '无描述' }}</text>
      <view class="report-footer">
        <text class="report-location">📍 {{ item.address || '未知地点' }}</text>
        <text class="report-time">{{ formatTime(item.occurred_at) }}</text>
      </view>
    </view>

    <view class="loading" v-if="loading">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const reports = ref<any[]>([])
const loading = ref(false)

const statusMap: Record<string, string> = {
  pending: '待审核',
  confirmed: '已确认',
  duplicated: '重复',
  linked: '已关联',
  resolved: '已处理',
  rejected: '已驳回'
}

const eventTypeMap: Record<string, string> = {
  report: '上报',
  rescue: '救助',
  medical: '医疗',
  adopt: '领养',
  transfer: '转移',
  release: '放生'
}

onMounted(async () => {
  loading.value = true
  // 真实接口：GET /api/user/events
  // Mock：暂无，用本地模拟数据
  await new Promise(resolve => setTimeout(resolve, 500))
  reports.value = [
    {
      event_id: 'e001',
      animal_id: 'a001',
      event_type: 'report',
      occurred_at: '2026-05-10T15:30:00Z',
      address: '北京市朝阳区建外SOHO',
      description: '发现时正在觅食，比较亲人',
      status: 'pending'
    },
    {
      event_id: 'e003',
      animal_id: null,
      event_type: 'rescue',
      occurred_at: '2026-05-08T10:00:00Z',
      address: '北京市朝阳区国贸CBD',
      description: '受伤柴犬，已送医',
      status: 'resolved'
    }
  ]
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
  font-size: 96rpx;
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

.report-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.report-type {
  font-size: 26rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.report-status {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
  background: #F0F0F0;
  color: #666666;
}

.status-pending { background: #FFF8E8; color: #FF9F00; }
.status-confirmed { background: #E8FDF8; color: #07C160; }
.status-resolved { background: #E8FDF8; color: #07C160; }
.status-rejected { background: #FFF0F0; color: #FF6B6B; }

.report-desc {
  font-size: 24rpx;
  color: #666666;
  display: block;
  margin-bottom: 12rpx;
  line-height: 1.5;
}

.report-footer {
  display: flex;
  justify-content: space-between;
}

.report-location, .report-time {
  font-size: 22rpx;
  color: #999999;
}

.loading {
  text-align: center;
  padding: 24rpx;
  color: #999999;
  font-size: 24rpx;
}
</style>
