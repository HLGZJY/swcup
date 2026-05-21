# 地图预览优化设计

> **Goal:** 把地图区域从"点击才显示"改为"直接展示预览图"，同时保留点击导航功能

## 方案概述

- 扩大预览区高度（200rpx → 320rpx）
- 使用大圆角（24rpx）提升质感
- 用静态渐变占位图 + 地图图标装饰
- 保留"点击查看地图"遮罩，点击跳转到 openLocation 导航

## 视觉规格

### 地图预览区块
- 高度：`320rpx`
- 圆角：`24rpx`
- 背景：线性渐变 `#E8FDF8 → #D0F0E8`（淡绿色调，柔和）
- 装饰：居中显示地图图标（icon-mappin.png），图标透明度 60%
- 遮罩层：半透明白色遮罩 + "点击查看地图" 文字

### 点击行为
- 点击区块 → 调用 `uni.openLocation` 打开地图导航
- 不影响原有 openLocation 逻辑

## 应用范围

- `miniapp-user/src/pages/animal-detail/index.vue`
- `miniapp-admin/src/pages/events/detail/index.vue`
- `miniapp-admin/src/pages/animals/detail/index.vue`

## 改动说明

仅修改 CSS 样式，不改 JS 逻辑：
- `.map-preview` / `.map-placeholder`：高度 + 圆角 + 背景
- `.map-overlay`：调整透明度使遮罩更柔和

## 不涉及

- openLocation 代码不变
- 不申请地图 API key
- 不使用 map 组件