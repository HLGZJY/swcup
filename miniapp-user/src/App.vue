<template>
  <view>
    <view class="app-theme-color" style="display:none"></view>
    <view class="app-theme-bg" style="display:none"></view>
  </view>
</template>

<script setup lang="ts">
// 全局样式在 uni.scss 中定义
import { shareAppMessage, shareTimeline } from '@/utils/page-share'

// 注册全局分享
onShareAppMessage(shareAppMessage)
onShareTimeline(shareTimeline)
</script>

<style lang="scss">
@import "@/uni.scss";

page {
  background-color: #F5F5F5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --theme-color: #0FBF9F;
  --theme-light: #E8FDF8;
  --text-primary: #1A1A1A;
  --text-secondary: #666666;
  --text-placeholder: #999999;
  --border-color: #EEEEEE;
  --bg-white: #FFFFFF;
  --bg-gray: #F5F5F5;
}
</style>
