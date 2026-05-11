<template>
  <view class="nose-guide-box">
    <view class="guide-content">
      <view class="guide-icon">👃</view>
      <view class="guide-text">
        <text class="guide-title">{{ title }}</text>
        <text class="guide-desc">{{ desc }}</text>
      </view>
    </view>
    <view class="guide-ring">
      <view class="ring-outer"></view>
      <view class="ring-inner"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  species?: string
}>(), {
  species: 'dog'
})

const title = '鼻纹采集区域'
const desc = '将鼻头置于框内'
</script>

<style scoped lang="scss">
.nose-guide-box {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.guide-content {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  top: -100rpx;
}

.guide-icon {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}

.guide-text {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.guide-title {
  font-size: 24rpx;
  color: #FFFFFF;
  font-weight: 600;
  background: rgba(0,0,0,0.5);
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.guide-desc {
  font-size: 20rpx;
  color: rgba(255,255,255,0.7);
  margin-top: 4rpx;
}

.guide-ring {
  position: relative;
  width: 300rpx;
  height: 300rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-outer {
  position: absolute;
  width: 280rpx;
  height: 280rpx;
  border: 4rpx dashed rgba(255,255,255,0.5);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.ring-inner {
  position: absolute;
  width: 200rpx;
  height: 200rpx;
  border: 2rpx dashed rgba(255,255,255,0.3);
  border-radius: 50%;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.05); opacity: 1; }
}
</style>
