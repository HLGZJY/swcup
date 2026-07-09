<!--
  通用空状态组件
  用法: <EmptyStatus title="..." sub="..." :icon="..." />
  默认 icon: 绿色对勾
-->
<template>
  <view class="empty-state">
    <view class="empty-icon-wrap">
      <image
        class="empty-icon"
        :src="icon || '/static/icons/icon-check-circle-success.svg'"
        mode="aspectFit"
      />
    </view>
    <text class="empty-title">{{ title }}</text>
    <text class="empty-sub" v-if="sub">{{ sub }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  sub?: string
  icon?: string
}>()
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}
.empty-icon-wrap {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(15, 191, 159, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}
.empty-icon {
  width: 60rpx;
  height: 60rpx;
}
.empty-title {
  color: #333;
  font-size: 30rpx;
  font-weight: 600;
}
.empty-sub {
  color: #999;
  font-size: 24rpx;
  margin-top: 8rpx;
}
</style>
