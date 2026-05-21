<template>
  <view class="page" v-if="animal">
    <!-- 主图轮播 -->
    <view class="photo-section">
      <swiper class="photo-swiper" circular :indicator-dots="true" indicator-color="rgba(255,255,255,0.4)" indicator-active-color="#FFFFFF">
        <swiper-item v-for="(photo, idx) in (animal.photos || [])" :key="idx">
          <image class="photo" :src="photo || '/static/mock/dog-placeholder.png'" mode="aspectFill" />
        </swiper-item>
        <swiper-item v-if="(animal.photos || []).length === 0">
          <image class="photo" src="/static/mock/dog-placeholder.png" mode="aspectFill" />
        </swiper-item>
      </swiper>
      <view :class="['status-badge', 'status-' + animal.status]">
        {{ statusMap[animal.status] }}
      </view>
    </view>

    <!-- 基本信息 -->
    <view class="section basic-section">
      <view class="basic-header">
        <view class="basic-title">
          <text class="breed">{{ animal.breed }}</text>
          <text class="gender">{{ animal.gender === 'male' ? '♂️ 弟弟' : '♀️ 妹妹' }}</text>
        </view>
        <view class="fuse-score" v-if="showFuseScore">
          <text class="score-label">融合得分</text>
          <text class="score-val">{{ (fuseScore * 100).toFixed(0) }}%</text>
        </view>
      </view>

      <view class="info-grid">
        <view class="info-cell">
          <text class="cell-label">物种</text>
          <text class="cell-value">{{ animal.species === 'dog' ? '🐶 狗狗' : animal.species === 'cat' ? '🐱 猫咪' : '🐾 其他' }}</text>
        </view>
        <view class="info-cell">
          <text class="cell-label">颜色</text>
          <text class="cell-value">{{ animal.color }}</text>
        </view>
        <view class="info-cell">
          <text class="cell-label">年龄</text>
          <text class="cell-value">{{ ageMap[animal.age_estimate] }}</text>
        </view>
        <view class="info-cell">
          <text class="cell-label">健康</text>
          <text class="cell-value">{{ healthMap[animal.health_status] }}</text>
        </view>
        <view class="info-cell">
          <text class="cell-label">是否绝育</text>
          <text class="cell-value">{{ animal.sterilized ? '✓ 已绝育' : '✗ 未绝育' }}</text>
        </view>
        <view class="info-cell">
          <text class="cell-label">发现时间</text>
          <text class="cell-value">{{ formatDate(animal.first_seen_at) }}</text>
        </view>
      </view>
    </view>

    <!-- 位置信息 -->
    <view class="section location-section" @click="openMap">
      <view class="section-header">
        <view class="section-title-wrap">
          <image class="section-title-icon" src="/static/icons/icon-mappin.png" mode="aspectFit" />
          <text class="section-title">发现地点</text>
        </view>
        <text class="map-nav">导航 ›</text>
      </view>
      <text class="address-text">{{ animal.address }}</text>
      <view class="map-preview" v-if="animal.location_lat">
        <image class="map-thumb" src="/static/mock/map-placeholder.png" mode="aspectFill" />
        <view class="map-overlay">
          <text>点击查看地图</text>
        </view>
      </view>
    </view>

    <!-- 备注信息 -->
    <view class="section notes-section" v-if="animal.notes">
      <view class="section-title-wrap">
        <image class="section-title-icon" src="/static/icons/icon-filetext.png" mode="aspectFit" />
        <text class="section-title">备注信息</text>
      </view>
      <text class="notes-text">{{ animal.notes }}</text>
    </view>

    <!-- 标签 -->
    <view class="section tags-section" v-if="animal.tags && animal.tags.length">
      <text class="section-title">🏷️ 标签</text>
      <view class="tags-list">
        <text class="tag" v-for="tag in animal.tags" :key="tag">{{ tag }}</text>
      </view>
    </view>

    <!-- 时间线 -->
    <view class="section timeline-section">
      <text class="section-title">📋 事件时间线</text>
      <view class="timeline">
        <view class="timeline-item">
          <view class="timeline-dot"></view>
          <view class="timeline-content">
            <text class="timeline-title">首次发现</text>
            <text class="timeline-time">{{ formatDate(animal.first_seen_at) }}</text>
          </view>
        </view>
        <view class="timeline-item">
          <view class="timeline-dot active"></view>
          <view class="timeline-content">
            <text class="timeline-title">最近更新</text>
            <text class="timeline-time">{{ formatDate(animal.last_seen_at) }}</text>
          </view>
        </view>
        <view class="timeline-item" v-if="animal.status === 'claimed'">
          <view class="timeline-dot"></view>
          <view class="timeline-content">
            <text class="timeline-title">已被认领</text>
            <text class="timeline-time">待管理员审核</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar" v-if="animal.status !== 'claimed'">
      <view class="bar-left">
        <view class="bar-icon-btn" @click="onShare">
          <image class="icon-img" src="/static/icons/icon-share.png" mode="aspectFit" />
          <text class="label">分享</text>
        </view>
        <view class="bar-icon-btn" @click="onCollect">
          <image class="icon-img" src="/static/icons/icon-fingerprint.png" mode="aspectFit" />
          <text class="label">鼻纹</text>
        </view>
      </view>
      <view class="btn-claim" @click="onClaim">
        <text>我要认领</text>
      </view>
    </view>

    <!-- 已认领状态 -->
    <view class="bottom-bar" v-else>
      <view class="claimed-notice">
        <text>该动物已被认领，等待审核中</text>
      </view>
    </view>
  </view>

  <view class="page-loading" v-else>
    <text>加载中...</text>
  </view>
</template>

<script>
export default {
  data() {
    return {
      statusMap: {
        lost: '走失中', found: '发现中', claimed: '待认领', archived: '已归档'
      }
    }
  },
  onShareAppMessage() {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const animal = currentPage.animal
    if (!animal) return {}
    return {
      title: `${animal.breed} ${this.statusMap[animal.status]} | ${animal.address}`,
      imageUrl: animal.photos?.[0] || '/static/mock/dog-placeholder.png',
      path: `/pages/animal-detail/index?animal_id=${animal.animal_id}`
    }
  },
  onShareTimeline() {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const animal = currentPage.animal
    if (!animal) return {}
    return {
      title: `${animal.breed} ${this.statusMap[animal.status]}`,
      imageUrl: animal.photos?.[0] || '/static/mock/dog-placeholder.png',
      query: `animal_id=${animal.animal_id}`
    }
  }
}
</script>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGetAnimalDetail } from '@/services/api'

const animal = ref<any>(null)
const showFuseScore = ref(false)
const fuseScore = ref(0)

const statusMap: Record<string, string> = {
  lost: '走失中', found: '发现中', claimed: '待认领', archived: '已归档'
}

const ageMap: Record<string, string> = {
  puppy: '幼年', adult: '成年', senior: '老年', unknown: '未知'
}

const healthMap: Record<string, string> = {
  healthy: '健康', injured: '受伤', ill: '生病', unknown: '未知'
}

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const animalId = currentPage?.options?.animal_id || 'a001'

  uni.showLoading({ title: '加载中...' })
  try {
    const res: any = await apiGetAnimalDetail(animalId)
    if (res.code === 0) {
      animal.value = res.data
    }
    // 检查是否有融合得分
    const score = uni.getStorageSync('currentFuseScore')
    if (score) {
      showFuseScore.value = true
      fuseScore.value = score
    }
  } catch (e) {}
  uni.hideLoading()

  // 启用分享菜单
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  })
})

function formatDate(isoString: string) {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function openMap() {
  if (!animal.value?.location_lat) return
  uni.openLocation({
    latitude: animal.value.location_lat,
    longitude: animal.value.location_lng,
    name: animal.value.address,
    fail: () => {
      uni.showToast({ title: '地图打开失败', icon: 'none' })
    }
  })
}

function onShare() {
  uni.showToast({ title: '分享功能', icon: 'none' })
}

function onCollect() {
  uni.navigateTo({ url: '/pages/collect/index' })
}

function onClaim() {
  if (!animal.value) return
  uni.navigateTo({
    url: `/pages/claim/index?animal_id=${animal.value.animal_id}`
  })
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 160rpx;
}

.page-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #999999;
}

.photo-section {
  position: relative;
}

.photo-swiper {
  height: 500rpx;
}

.photo {
  width: 100%;
  height: 100%;
  background: #E8FDF8;
}

.status-badge {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #FFFFFF;
  background: #FF6B6B;
}

.status-found { background: #0FBF9F !important; }
.status-claimed { background: #FF9F00 !important; }

.section {
  background: #FFFFFF;
  margin: 24rpx;
  border-radius: 16rpx;
  padding: 32rpx;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.breed {
  font-size: 36rpx;
  font-weight: 700;
  color: #1A1A1A;
  display: block;
}

.gender {
  font-size: 26rpx;
  color: #666666;
  display: block;
  margin-top: 4rpx;
}

.fuse-score {
  text-align: right;
}

.score-label {
  font-size: 20rpx;
  color: #999999;
  display: block;
}

.score-val {
  font-size: 36rpx;
  font-weight: 700;
  color: #0FBF9F;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.info-cell {
  background: #FAFAFA;
  padding: 16rpx;
  border-radius: 12rpx;
}

.cell-label {
  font-size: 22rpx;
  color: #999999;
  display: block;
  margin-bottom: 4rpx;
}

.cell-value {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 600;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title-wrap {
  display: flex;
  align-items: center;
}

.section-title-icon {
  width: 28rpx;
  height: 28rpx;
  margin-right: 8rpx;
  flex-shrink: 0;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

.map-nav {
  font-size: 24rpx;
  color: #0FBF9F;
}

.address-text {
  font-size: 26rpx;
  color: #666666;
  margin-top: 8rpx;
  display: block;
}

.map-preview {
  height: 200rpx;
  background: #F0F0F0;
  border-radius: 12rpx;
  margin-top: 16rpx;
  overflow: hidden;
  position: relative;
}

.map-thumb {
  width: 100%;
  height: 100%;
}

.map-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-overlay text {
  font-size: 24rpx;
  color: #FFFFFF;
  background: rgba(0,0,0,0.5);
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}

.notes-text {
  font-size: 26rpx;
  color: #666666;
  line-height: 1.6;
  display: block;
  margin-top: 12rpx;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
}

.tag {
  font-size: 24rpx;
  color: #0FBF9F;
  background: #E8FDF8;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

.timeline {
  margin-top: 16rpx;
  padding-left: 24rpx;
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 24rpx;
  position: relative;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: 10rpx;
  top: 24rpx;
  bottom: -24rpx;
  width: 2rpx;
  background: #EEEEEE;
}

.timeline-item:last-child::before {
  display: none;
}

.timeline-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: #CCCCCC;
  margin-right: 16rpx;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.timeline-dot.active {
  background: #0FBF9F;
}

.timeline-content {
  flex: 1;
}

.timeline-title {
  font-size: 26rpx;
  color: #1A1A1A;
  font-weight: 600;
  display: block;
}

.timeline-time {
  font-size: 22rpx;
  color: #999999;
  display: block;
  margin-top: 4rpx;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx 48rpx;
  background: #FFFFFF;
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.06);
}

.bar-left {
  display: flex;
  gap: 32rpx;
}

.bar-icon-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.icon {
  font-size: 36rpx;
}

.icon-img {
  width: 36rpx;
  height: 36rpx;
}

.label {
  font-size: 20rpx;
  color: #666666;
  margin-top: 4rpx;
}

.btn-claim {
  background: linear-gradient(135deg, #FF6B6B 0%, #E53A3A 100%);
  color: #FFFFFF;
  padding: 24rpx 64rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(255, 107, 107, 0.3);
}

.claimed-notice {
  flex: 1;
  text-align: center;
  background: #F5F5F5;
  padding: 24rpx;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #666666;
}
</style>
