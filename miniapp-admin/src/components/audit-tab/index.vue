<!--
  通用 Tab 切换器
  用法:
    <AuditTab v-model="currentTab" :tabs="[
      { key: 'events', label: '事件审核', icon: '/static/icons/icon-event.svg', badge: pendingEvents },
      { key: 'claims', label: '认领审核', icon: '/static/icons/icon-shield.svg', badge: pendingClaims, badgeClass: 'tab-badge--claim' },
      { key: 'clues',  label: '线索审核', icon: '/static/icons/icon-target.svg', badge: pendingClues,  badgeClass: 'tab-badge--clue' },
    ]" />
-->
<template>
  <view class="audit-tabs">
    <view
      v-for="t in tabs"
      :key="t.key"
      :class="['tab-item', { active: modelValue === t.key }]"
      @click="$emit('update:modelValue', t.key)"
    >
      <image class="tab-icon" :src="t.icon" mode="aspectFit" />
      <text class="tab-text">{{ t.label }}</text>
      <view
        v-if="t.badge && t.badge > 0"
        :class="['tab-badge', t.badgeClass]"
        >{{ t.badge }}</view
      >
    </view>
  </view>
</template>

<script setup lang="ts">
export interface AuditTabItem {
  key: string;
  label: string;
  icon: string;
  badge?: number;
  badgeClass?: string;
}

defineProps<{
  modelValue: string;
  tabs: AuditTabItem[];
}>();

defineEmits<{
  "update:modelValue": [key: string];
}>();
</script>

<style scoped>
.audit-tabs {
  display: flex;
  background: #ffffff;
  margin: -40rpx 24rpx 0;
  border-radius: 20rpx;
  padding: 8rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}
.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 0;
  border-radius: 16rpx;
  position: relative;
  transition: background 0.2s;
}
/* 原红色渐变替换为深黑白渐变，和顶部header匹配 */
.tab-item.active {
  background: linear-gradient(135deg, #383838 0%, #1a1a1a 100%);
}
.tab-item.active .tab-text {
  color: #ffffff;
  font-weight: 600;
}
.tab-item.active .tab-icon {
  /* svg图标强制白色 */
  filter: brightness(100);
}
/* 默认事件角标激活态：白底+深灰文字 */
.tab-item.active .tab-badge {
  background: #ffffff;
  color: #222222;
}
.tab-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 8rpx;
  color: #999999;
  flex-shrink: 0;
}
.tab-text {
  color: #666666;
  font-size: 28rpx;
}
.tab-badge {
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  border-radius: 16rpx;
  background: #ff6b6b;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 32rpx;
  text-align: center;
  margin-left: 8rpx;
  position: absolute;
  top: 8rpx;
  right: 24rpx;
}
.tab-badge--claim {
  background: #ff9f00;
}
.tab-item.active .tab-badge--claim {
  background: #ffffff;
  color: #ff9f00;
}
.tab-badge--clue {
  background: #5872e0;
}
.tab-item.active .tab-badge--clue {
  background: #ffffff;
  color: #5872e0;
}
</style>
