<template>
  <view class="custom-tabbar">
    <view
      v-for="(item, idx) in tabs"
      :key="item.path"
      :class="['tab-item', { active: currentPath === item.path }]"
      @click="onTap(idx)"
    >
      <image
        class="tab-icon"
        :src="currentPath === item.path ? item.iconActive : item.icon"
        mode="aspectFit"
      />
      <text class="tab-label">{{ item.text }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const tabs = [
  {
    text: '首页',
    path: 'pages/index/index',
    icon: '/static/icons/tab-home.svg',
    iconActive: '/static/icons/tab-home-active.svg'
  },
  {
    text: '发现',
    path: 'pages/report/index',
    icon: '/static/icons/tab-find.svg',
    iconActive: '/static/icons/tab-find-active.svg'
  },
  {
    text: '我的',
    path: 'pages/user/index',
    icon: '/static/icons/tab-user.svg',
    iconActive: '/static/icons/tab-user-active.svg'
  }
]

const currentPath = ref('')

onMounted(() => {
  const pages = getCurrentPages()
  if (pages.length > 0) {
    const route = pages[pages.length - 1]?.route || ''
    currentPath.value = route
  }
})

function onTap(idx: number) {
  const item = tabs[idx]
  if (!item) return
  if (currentPath.value === item.path) return
  uni.switchTab({
    url: '/' + item.path,
    fail: (err) => {
      console.error('switchTab fail', err)
    }
  })
}
</script>

<style scoped lang="scss">
.custom-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  background: #FAFCFB;
  border-top: 1rpx solid #F0F0F0;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 999;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16rpx 0 12rpx;
  transition: transform 0.15s ease;
}

.tab-item.active {
  transform: translateY(-2rpx);
}

.tab-item:active {
  transform: scale(0.95);
}

.tab-icon {
  width: 44rpx;
  height: 44rpx;
}

.tab-label {
  font-size: 20rpx;
  color: #B5BCC4;
  margin-top: 4rpx;
  font-weight: 500;
  transition: color 0.2s ease, font-weight 0.2s ease;
}

.tab-item.active .tab-label {
  color: #0FBF9F;
  font-weight: 700;
}
</style>