﻿<template>
  <!-- 主内容 -->
  <view class="page" v-if="animal">
    <!-- 主图轮播 -->
    <view class="photo-section">
      <swiper
        class="photo-swiper"
        circular
        :indicator-dots="true"
        indicator-color="rgba(255,255,255,0.4)"
        indicator-active-color="#FFFFFF"
      >
        <swiper-item v-for="(photo, idx) in animal.photos || []" :key="idx">
          <image
            class="photo"
            :src="resolveImageUrl(photo) || '/static/mock/dog-placeholder.png'"
            mode="aspectFill"
          />
        </swiper-item>
        <swiper-item v-if="(animal.photos || []).length === 0">
          <image
            class="photo"
            src="/static/mock/dog-placeholder.png"
            mode="aspectFill"
          />
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
          <text class="gender">{{
            animal.gender === "male" ? "♂️ 弟弟" : "♀️ 妹妹"
          }}</text>
        </view>
        <view class="fuse-score" v-if="showFuseScore">
          <text class="score-label">融合得分</text>
          <text class="score-val">{{ (fuseScore * 100).toFixed(0) }}%</text>
        </view>
      </view>

      <view class="info-grid">
        <view class="info-cell">
          <text class="cell-label">物种</text>
          <text class="cell-value">{{
            animal.species === "dog"
              ? "🐶 狗狗"
              : animal.species === "cat"
                ? "🐱 猫咪"
                : "🐾 其他"
          }}</text>
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
          <text class="cell-value">{{
            animal.sterilized ? "✓ 已绝育" : "✗ 未绝育"
          }}</text>
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
          <image
            class="section-title-icon"
            src="/static/icons/icon-mappin.svg"
            mode="aspectFit"
          />
          <text class="section-title">发现地点</text>
        </view>
        <text class="map-nav">导航 ›</text>
      </view>
      <text class="address-text">{{ animal.address }}</text>
      <view class="map-preview" v-if="animal.location_lat" @click="openMap">
        <view class="map-overlay">
          <image
            class="map-icon"
            src="/static/icons/icon-mappin.svg"
            mode="aspectFit"
          />
          <text>点击查看地图</text>
        </view>
      </view>
    </view>

    <!-- 备注信息 -->
    <view class="section notes-section" v-if="animal.notes">
      <view class="section-title-wrap">
        <image
          class="section-title-icon"
          src="/static/icons/icon-filetext.svg"
          mode="aspectFit"
        />
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
      <view class="section-header-row">
        <text class="section-title">📋 事件时间线</text>
        <text class="timeline-entry" @click="goTimeline">查看完整时间轴 ›</text>
      </view>
      <view class="timeline">
        <view class="timeline-item">
          <view class="timeline-dot"></view>
          <view class="timeline-content">
            <text class="timeline-title">首次发现</text>
            <text class="timeline-time">{{
              formatDate(animal.first_seen_at)
            }}</text>
          </view>
        </view>
        <view class="timeline-item">
          <view class="timeline-dot active"></view>
          <view class="timeline-content">
            <text class="timeline-title">最近更新</text>
            <text class="timeline-time">{{
              formatDate(animal.last_seen_at)
            }}</text>
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

    <!-- 评论入口 - 移入 page 内部 -->
    <navigator
      :url="'/pages/animal-detail/comments?animal_id=' + animalId"
      hover-class="none"
      class="comments-entry"
      v-if="animal.animal_id"
    >
      <text class="comments-entry-text">查看评论 ({{ commentCount }})</text>
    </navigator>

    <!-- 底部操作栏 - 未认领状态 -->
    <view class="bottom-bar" v-if="animal.status !== 'claimed'">
      <view class="bar-left">
        <view class="bar-icon-btn" @click="onShare">
          <image
            class="icon-img"
            src="/static/icons/icon-share.svg"
            mode="aspectFit"
          />
          <text class="label">分享</text>
        </view>
        <view class="bar-icon-btn" @click="onCollect">
          <image
            class="icon-img"
            src="/static/icons/icon-fingerprint.svg"
            mode="aspectFit"
          />
          <text class="label">鼻纹</text>
        </view>
      </view>
      <view class="action-buttons">
        <button class="btn-secondary" size="mini" @click="onSighting">
          我又看到这只
        </button>
        <button class="btn-primary" size="mini" @click="onClaim">
          申请认领
        </button>
      </view>
    </view>

    <!-- 底部操作栏 - 已认领状态 -->
    <view class="bottom-bar" v-if="animal.status === 'claimed'">
      <view class="claimed-notice">
        <text>该动物已被认领，等待审核中</text>
      </view>
    </view>
  </view>

  <!-- 加载状态 - 独立的 v-if，不与 v-else 关联 -->
  <view class="page-loading" v-if="!animal">
    <text>加载中...</text>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  onLoad,
  onShow,
  onShareAppMessage,
  onShareTimeline,
} from "@dcloudio/uni-app";
import {
  apiGetAnimalDetail,
  apiCreateSighting,
  apiGetComments,
  resolveImageUrl,
} from "@/services/api";

const animal = ref<any>(null);
const showFuseScore = ref(false);
const fuseScore = ref(0);
const commentCount = ref(0);
const animalId = ref("");

const statusMap: Record<string, string> = {
  lost: "走失中",
  found: "发现中",
  claimed: "待认领",
  archived: "已归档",
};

const ageMap: Record<string, string> = {
  puppy: "幼年",
  adult: "成年",
  senior: "老年",
  unknown: "未知",
};

const healthMap: Record<string, string> = {
  healthy: "健康",
  injured: "受伤",
  ill: "生病",
  unknown: "未知",
};

// 页面加载
onLoad((query: any) => {
  animalId.value = query?.animal_id || "a001";
});

// 页面显示 - 获取评论数
onShow(() => {
  if (!animalId.value) return;
  apiGetComments(animalId.value, { limit: 1, offset: 0 })
    .then((cr: any) => {
      if (cr && cr.code === 0 && typeof cr.data?.total === "number") {
        commentCount.value = cr.data.total;
      }
    })
    .catch(() => {
      // 静默失败
    });
});

// 页面挂载 - 获取详情
onMounted(async () => {
  uni.showLoading({ title: "加载中..." });
  try {
    const res: any = await apiGetAnimalDetail(animalId.value);
    if (res.code === 0) {
      animal.value = res.data;
    }
    // 检查是否有融合得分
    const score = uni.getStorageSync("currentFuseScore");
    if (score) {
      showFuseScore.value = true;
      fuseScore.value = score;
    }
  } catch (e) {
    console.error("获取数据失败", e);
  }
  uni.hideLoading();

  // 启用分享菜单
  uni.showShareMenu({
    withShareTicket: true,
    menus: ["shareAppMessage", "shareTimeline"],
  });
});

// 分享给朋友
onShareAppMessage(() => {
  if (!animal.value) return {};
  return {
    title: `${animal.value.breed} ${statusMap[animal.value.status]} | ${animal.value.address}`,
    imageUrl:
      resolveImageUrl(animal.value.photos?.[0]) ||
      "/static/mock/dog-placeholder.png",
    path: `/pages/animal-detail/index?animal_id=${animal.value.animal_id}`,
  };
});

// 分享到朋友圈
onShareTimeline(() => {
  if (!animal.value) return {};
  return {
    title: `${animal.value.breed} ${statusMap[animal.value.status]}`,
    imageUrl:
      resolveImageUrl(animal.value.photos?.[0]) ||
      "/static/mock/dog-placeholder.png",
    query: `animal_id=${animal.value.animal_id}`,
  };
});

// 格式化日期
function formatDate(isoString: string) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 打开地图
function openMap() {
  if (!animal.value?.location_lat || !animal.value?.location_lng) {
    uni.showToast({ title: "暂无位置坐标", icon: "none" });
    return;
  }
  const name =
    animal.value.address ||
    `${animal.value.location_lat},${animal.value.location_lng}`;
  uni.openLocation({
    latitude: Number(animal.value.location_lat),
    longitude: Number(animal.value.location_lng),
    name,
    address: animal.value.address,
    fail: (err) => {
      console.error("openLocation fail", err);
      uni.showToast({ title: "地图打开失败", icon: "none" });
    },
  });
}

// 分享按钮（提示用户使用右上角菜单）
function onShare() {
  uni.showToast({ title: "请点击右上角···分享", icon: "none", duration: 2000 });
}

// 鼻纹采集
function onCollect() {
  const id = animal.value?.animal_id;
  if (!id) {
    uni.showToast({ title: "档案信息缺失", icon: "none" });
    return;
  }
  uni.navigateTo({ url: `/pages/collect/index?animal_id=${id}` });
}

// 申请认领
function onClaim() {
  if (!animal.value) return;
  uni.navigateTo({
    url: `/pages/claim/index?animal_id=${animal.value.animal_id}`,
  });
}

// 【2026-07-09 重构】二次目击 — 直接调 POST /animals/:id/sightings,不入审核流
//   旧流程: setStorageSync(pending_sighting_animal_id) + switchTab 到 report/index 多步表单
//   新流程: 拿当前位置,调 sightings 接口,refresh 列表
async function onSighting() {
  const id = animal.value?.animal_id;
  if (!id) {
    uni.showToast({ title: "档案信息缺失", icon: "none" });
    return;
  }
  try {
    // 取当前位置 (无 GPS 时用兜底坐标 0,后端允许)
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const loc: any = await uni.getLocation({ type: "gcj02" });
      if (loc && loc.latitude && loc.longitude) {
        lat = Number(loc.latitude);
        lng = Number(loc.longitude);
      }
    } catch {
      // 静默,允许 lat/lng 为 null
    }

    await apiCreateSighting(id, {
      reporter_lat: lat ?? 0,
      reporter_lng: lng ?? 0,
      photos: [],
      seen_at: new Date().toISOString(),
    });

    uni.showToast({ title: "已记录最新目击位置", icon: "success" });
    // 刷新当前动物详情(更新 last_seen_at/address)
    const res: any = await apiGetAnimalDetail(id);
    if (res.code === 0) {
      animal.value = res.data;
    }
  } catch (e: any) {
    console.error("[onSighting] 失败", e);
    uni.showToast({ title: "记录失败,请重试", icon: "none" });
  }
}

// 跳转到完整时间轴
function goTimeline() {
  const id = animal.value?.animal_id;
  if (!id) {
    uni.showToast({ title: "档案信息缺失", icon: "none" });
    return;
  }
  uni.navigateTo({ url: `/pages/animal-detail/timeline?id=${id}` });
}

// 暴露方法给模板使用
defineExpose({
  animal,
  showFuseScore,
  fuseScore,
  commentCount,
  animalId,
  statusMap,
  ageMap,
  healthMap,
  formatDate,
  openMap,
  onShare,
  onCollect,
  onClaim,
  onSighting,
  goTimeline,
  resolveImageUrl,
});
</script>
<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 200rpx; /* 增加底部内边距，为固定底部栏腾出更多空间 */
  position: relative;
}

/* 加载状态 */
.page-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #999999;
  font-size: 28rpx;
  background: #f5f5f5;
}

/* 轮播区域 */
.photo-section {
  position: relative;
}

.photo-swiper {
  height: 500rpx;
}

.photo {
  width: 100%;
  height: 100%;
  background: #e8fdf8;
}

/* 状态标签 */
.status-badge {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #ffffff;
  background: #ff6b6b;
  z-index: 10;
}

.status-found {
  background: #0fbf9f !important;
}
.status-claimed {
  background: #ff9f00 !important;
}
.status-archived {
  background: #999999 !important;
}

/* 通用区块 */
.section {
  background: #ffffff;
  margin: 24rpx;
  border-radius: 16rpx;
  padding: 32rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.section:first-of-type {
  margin-top: 24rpx;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  color: #1a1a1a;
}

/* 基本信息 */
.basic-section .basic-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24rpx;
}

.basic-title {
  flex: 1;
}

.breed {
  font-size: 36rpx;
  font-weight: 700;
  color: #1a1a1a;
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
  flex-shrink: 0;
  margin-left: 16rpx;
}

.score-label {
  font-size: 20rpx;
  color: #999999;
  display: block;
}

.score-val {
  font-size: 36rpx;
  font-weight: 700;
  color: #0fbf9f;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.info-cell {
  background: #fafafa;
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
  color: #1a1a1a;
  font-weight: 600;
}

/* 位置信息 */
.location-section {
  cursor: pointer;
}

.map-nav {
  font-size: 24rpx;
  color: #0fbf9f;
}

.address-text {
  font-size: 26rpx;
  color: #666666;
  margin-top: 8rpx;
  display: block;
  line-height: 1.5;
}

.map-preview {
  height: 320rpx;
  background: linear-gradient(135deg, #e8fdf8 0%, #d0f0e8 100%);
  border-radius: 24rpx;
  margin-top: 16rpx;
  overflow: hidden;
  position: relative;
}

.map-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8rpx;
}

.map-overlay text {
  font-size: 24rpx;
  color: #1a1a1a;
  background: rgba(255, 255, 255, 0.8);
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}

/* 备注信息 */
.notes-text {
  font-size: 26rpx;
  color: #666666;
  line-height: 1.6;
  display: block;
  margin-top: 12rpx;
}

/* 标签 */
.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
}

.tag {
  font-size: 24rpx;
  color: #0fbf9f;
  background: #e8fdf8;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

/* 时间线 */
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
  content: "";
  position: absolute;
  left: 10rpx;
  top: 24rpx;
  bottom: -24rpx;
  width: 2rpx;
  background: #eeeeee;
}

.timeline-item:last-child::before {
  display: none;
}

.timeline-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: #cccccc;
  margin-right: 16rpx;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.timeline-dot.active {
  background: #0fbf9f;
}

.timeline-content {
  flex: 1;
}

.timeline-title {
  font-size: 26rpx;
  color: #1a1a1a;
  font-weight: 600;
  display: block;
}

.timeline-time {
  font-size: 22rpx;
  color: #999999;
  display: block;
  margin-top: 4rpx;
}

.timeline-entry {
  color: #0fbf9f;
  font-size: 26rpx;
  cursor: pointer;
}

/* 评论入口 */
.comments-entry {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border: 2rpx solid #0fbf9f;
  border-radius: 32rpx;
  padding: 18rpx 0;
  margin: 24rpx 32rpx;
  font-size: 28rpx;
  color: #0fbf9f;
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
}

.comments-entry:active {
  transform: scale(0.98);
  opacity: 0.8;
}

.comments-entry-text {
  font-size: 28rpx;
  color: #0fbf9f;
}

/* 底部固定栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom, 32rpx));
  background: #ffffff;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.08);
  z-index: 100;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.bottom-bar::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1rpx;
  background: linear-gradient(
    to right,
    transparent,
    rgba(0, 0, 0, 0.06),
    transparent
  );
}

.bar-left {
  display: flex;
  gap: 32rpx;
}

.bar-icon-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 8rpx 4rpx;
}

.bar-icon-btn:active {
  opacity: 0.6;
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

.action-buttons {
  display: flex;
  gap: 16rpx;
}

.action-buttons button {
  flex: 1;
  min-width: 160rpx;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 26rpx;
  border-radius: 32rpx;
  border: none;
  padding: 0 24rpx;
  margin: 0;
  font-weight: 500;
}

.btn-secondary {
  background: #f2f2f2;
  color: #333333;
}

.btn-secondary:active {
  background: #e5e5e5;
}

.btn-primary {
  background: linear-gradient(135deg, #ff6b6b 0%, #e53a3a 100%);
  color: #ffffff;
  box-shadow: 0 4rpx 12rpx rgba(255, 107, 107, 0.3);
}

.btn-primary:active {
  opacity: 0.85;
  transform: scale(0.96);
}

.claimed-notice {
  flex: 1;
  text-align: center;
  background: #f5f5f5;
  padding: 20rpx 24rpx;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #666666;
}

/* 工具类 */
.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
