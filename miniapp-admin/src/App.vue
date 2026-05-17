<template>
  <view></view>
</template>

<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
onLaunch(() => {
  // 全局路由拦截：无 token 则跳转登录页
  const token = uni.getStorageSync('token')
  if (!token) {
    uni.reLaunch({ url: '/pages/login/login' })
  }
})
</script>

<style lang="scss">
@import "@/uni.scss";

page {
  background-color: #F5F5F5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --theme-color: #FF6B6B;
  --theme-light: #FFF0F0;
  --text-primary: #1A1A1A;
  --text-secondary: #666666;
  --border-color: #EEEEEE;
  --bg-white: #FFFFFF;
}
</style>
