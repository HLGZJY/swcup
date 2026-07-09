<template>
  <view class="page">
    <!-- 自定义 navbar（custom 模式） -->
    <view class="navbar">
      <view class="navbar-statusbar" />
      <view class="navbar-content">
        <view class="navbar-back" @click="goBack">
          <image
            class="navbar-back-icon"
            src="/static/icons/icon-chevron-left.svg"
            mode="aspectFit"
          />
        </view>
        <text class="navbar-title">我的上报</text>
        <view class="navbar-spacer" />
      </view>
    </view>

    <view class="list-empty" v-if="reports.length === 0 && !loading">
      <image
        class="empty-icon"
        src="/static/icons/icon-filetext.svg"
        mode="aspectFit"
      />
      <text class="empty-text">暂无上报记录</text>
      <text class="empty-hint">快去发现身边的流浪动物吧</text>
    </view>

    <view
      v-for="item in reports"
      :key="item.event_id"
      class="report-card"
      :class="'card-' + item.status"
      @click="goToAnimal(item.animal_id)"
    >
      <!-- 左侧状态色条 -->
      <view :class="['card-accent', 'accent-' + item.status]" />

      <!-- 缩略图（有照片显示首张，无则 SVG 占位） -->
      <view class="report-thumb-wrap">
        <image
          v-if="item.photos && item.photos.length > 0"
          class="report-thumb"
          :src="resolveImageUrl(item.photos[0])"
          mode="aspectFill"
          @error="onThumbError(item)"
        />
        <image
          v-else
          class="report-thumb-placeholder"
          src="/static/icons/icon-image.svg"
          mode="aspectFit"
        />
      </view>

      <!-- 右侧文本区 -->
      <view class="report-body">
        <view class="report-header">
          <view class="report-type">{{ eventTypeMap[item.event_type] }}</view>
          <view :class="['report-status', 'status-' + item.status]">
            {{ statusMap[item.status] }}
          </view>
        </view>

        <!-- 阶段 3 (2026-07-06): 待审核且未关联时,允许用户自助关联到动物 -->
        <view
          v-if="item.status === 'pending' && !item.animal_id"
          class="report-link-action"
          @click.stop="openAnimalPicker(item.event_id)"
        >
          <text>关联到动物 ›</text>
        </view>

        <view class="report-event-id">
          事件 #{{ shortEventId(item.event_id) }}
        </view>

        <text class="report-desc">{{ formatEventDesc(item) }}</text>

        <view class="report-footer">
          <view class="report-footer-left">
            <image
              class="report-location-icon"
              src="/static/icons/icon-mappin.svg"
              mode="aspectFit"
            />
            <text class="report-location">{{ formatEventAddress(item) }}</text>
          </view>
          <view class="report-footer-right">
            <text class="report-time">{{ formatTime(item.occurred_at) }}</text>
            <text class="report-created"
              >创建于 {{ formatCreatedAt(item.created_at) }}</text
            >
          </view>
        </view>
      </view>
    </view>

    <view class="loading" v-if="loading">
      <text>加载中...</text>
    </view>

    <!-- 阶段 3 (2026-07-06): 动物选择器弹层 -->
    <view v-if="pickerVisible" class="picker-mask" @click="closePicker">
      <view class="picker-panel" @click.stop>
        <text class="picker-title">选择要关联的动物</text>
        <view v-if="pickerLoading" class="picker-loading">
          <text>加载中…</text>
        </view>
        <scroll-view v-else scroll-y class="picker-list">
          <view
            v-for="a in pickerAnimals"
            :key="a.animal_id"
            class="picker-item"
            @click="confirmLink(a.animal_id)"
          >
            <text class="picker-item-title">{{ a.breed || '未命名' }} #{{ (a.animal_id || '').slice(-6) }}</text>
            <text class="picker-item-sub">{{ a.address || '未知地点' }}</text>
          </view>
          <view v-if="!pickerLoading && pickerAnimals.length === 0" class="picker-empty">
            <text>暂无可关联的动物</text>
          </view>
        </scroll-view>
        <view class="picker-cancel" @click="closePicker">
          <text>取消</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { apiGetMyEvents, apiGetAnimals, apiLinkEventToAnimal } from "@/services/api";
import { resolveImageUrl } from "@/services/api";

const reports = ref<any[]>([]);
const loading = ref(false);

const statusMap: Record<string, string> = {
  pending: "待审核",
  confirmed: "已确认",
  duplicated: "重复",
  linked: "已关联",
  resolved: "已处理",
  rejected: "已驳回",
  processing: "处理中",
};

const eventTypeMap: Record<string, string> = {
  collect: "采集",
  report: "上报",
  rescue: "救助",
  medical: "医疗",
  adopt: "领养",
  transfer: "转移",
  release: "放生",
};

onMounted(async () => {
  loading.value = true;
  try {
    const res: any = await apiGetMyEvents();
    reports.value = res.data || [];
  } catch (e) {
    console.error("加载我的上报失败", e);
    uni.showToast({ title: "加载失败", icon: "none" });
  }
  loading.value = false;
});

function formatTime(isoString: string) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (diff < 3600) return Math.floor(diff / 60) + "分钟前";
  if (diff < 86400) return Math.floor(diff / 3600) + "小时前";
  return Math.floor(diff / 86400) + "天前";
}

function formatCreatedAt(isoString: string) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function shortEventId(eventId: string) {
  if (!eventId) return "";
  return eventId.slice(-6);
}

function formatEventDesc(item: any) {
  if (item.description) return item.description;
  if (item.event_type === "collect") return "[鼻纹采集]";
  return "无描述";
}

function formatEventAddress(item: any) {
  if (item.address) return item.address;
  if (item.location_lat && item.location_lng) {
    return `${Number(item.location_lat).toFixed(4)}, ${Number(item.location_lng).toFixed(4)}`;
  }
  return "未知地点";
}

function onThumbError(item: any) {
  if (item && Array.isArray(item.photos) && item.photos.length > 0) {
    item.photos = [];
  }
}

// 修复返回逻辑：如果无法返回则跳转到首页
function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 });
  } else {
    // 如果没有上一页，跳转到首页（tabBar 页面）
    uni.switchTab({
      url: "/pages/home/index",
    });
  }
}

function goToAnimal(animalId: string) {
  if (!animalId) return;
  uni.navigateTo({
    url: `/pages/animal-detail/index?animal_id=${animalId}`,
  });
}

// 阶段 3 (2026-07-06): 关联到动物 — 待审事件自助 link 到现有动物
const pickerVisible = ref(false);
const pickerAnimals = ref<any[]>([]);
const linkingEventId = ref("");
const pickerLoading = ref(false);

async function openAnimalPicker(eventId: string) {
  linkingEventId.value = eventId
  pickerVisible.value = true
  pickerAnimals.value = []
  pickerLoading.value = true
  try {
    const res: any = await apiGetAnimals({ page: 1, limit: 20 })
    pickerAnimals.value = res?.data?.list || res?.list || []
  } catch (e) {
    uni.showToast({ title: '加载动物列表失败', icon: 'none' })
  } finally {
    pickerLoading.value = false
  }
}

async function confirmLink(animalId: string) {
  if (!linkingEventId.value || !animalId) return
  try {
    await apiLinkEventToAnimal(linkingEventId.value, animalId)
    uni.showToast({ title: '已关联,等待管理员确认', icon: 'none' })
    pickerVisible.value = false
    // 刷新列表
    loading.value = true
    const res: any = await apiGetMyEvents()
    reports.value = res.data || []
  } catch (e: any) {
    const msg = e?.data?.message || '关联失败'
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    loading.value = false
  }
}

function closePicker() {
  pickerVisible.value = false;
  linkingEventId.value = "";
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
  padding-top: 0;
}

/* 自定义 navbar（custom 模式：子页面，纯白底 + 左侧返回 + 中间标题） */
.navbar {
  background: #ffffff;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1rpx 0 rgba(0, 0, 0, 0.05);
}

.navbar-statusbar {
  height: 48rpx;
}

.navbar-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  position: relative;
}

.navbar-back {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -16rpx;
}

.navbar-back-icon {
  width: 40rpx;
  height: 40rpx;
}

.navbar-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-right: 40rpx; /* 视觉居中补偿左侧返回按钮宽度 */
}

.navbar-spacer {
  width: 0;
}

.list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  width: 96rpx;
  height: 96rpx;
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
  position: relative;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx 24rpx 24rpx 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: stretch;
  overflow: hidden;
}

/* 左侧状态色条（与首页动物卡片 accent 同源） */
.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 6rpx;
  height: 100%;
  border-radius: 16rpx 0 0 16rpx;
}

.accent-pending {
  background: linear-gradient(180deg, #ff9f00 0%, rgba(255, 159, 0, 0) 100%);
}
.accent-confirmed {
  background: linear-gradient(180deg, #0fbf9f 0%, rgba(15, 191, 159, 0) 100%);
}
.accent-resolved {
  background: linear-gradient(180deg, #0fbf9f 0%, rgba(15, 191, 159, 0) 100%);
}
.accent-linked {
  background: linear-gradient(180deg, #9b7bff 0%, rgba(155, 123, 255, 0) 100%);
}
.accent-duplicated {
  background: linear-gradient(180deg, #999999 0%, rgba(153, 153, 153, 0) 100%);
}
.accent-rejected {
  background: linear-gradient(180deg, #ff6b6b 0%, rgba(255, 107, 107, 0) 100%);
}
.accent-processing {
  background: linear-gradient(180deg, #4c90e6 0%, rgba(76, 144, 230, 0) 100%);
}
.accent-default {
  background: linear-gradient(180deg, #cccccc 0%, rgba(204, 204, 204, 0) 100%);
}

/* 缩略图区 */
.report-thumb-wrap {
  width: 140rpx;
  height: 140rpx;
  flex-shrink: 0;
  margin-right: 20rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.report-thumb {
  width: 100%;
  height: 100%;
}

.report-thumb-placeholder {
  width: 64rpx;
  height: 64rpx;
  opacity: 0.4;
}

/* 右侧文本区 */
.report-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6rpx;
}

.report-type {
  font-size: 26rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.report-status {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
  background: #f0f0f0;
  color: #666666;
  flex-shrink: 0;
}

.status-pending {
  background: #fff8e8;
  color: #ff9f00;
}
.status-confirmed {
  background: #e8fdf8;
  color: #07c160;
}
.status-resolved {
  background: #e8fdf8;
  color: #07c160;
}
.status-rejected {
  background: #fff0f0;
  color: #ff6b6b;
}
.status-duplicated {
  background: #f0f0f0;
  color: #999999;
}
.status-linked {
  background: #f2edff;
  color: #9b7bff;
}
.status-processing {
  background: #e8f2fd;
  color: #4c90e6;
}

/* 事件号副标题 */
.report-event-id {
  font-size: 22rpx;
  color: #999999;
  margin-bottom: 8rpx;
  font-variant-numeric: tabular-nums;
}

.report-desc {
  font-size: 24rpx;
  color: #666666;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
  margin-bottom: 8rpx;
  word-break: break-all;
}

.report-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12rpx;
}

.report-footer-left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.report-location-icon {
  width: 22rpx;
  height: 22rpx;
  margin-right: 4rpx;
  flex-shrink: 0;
}

.report-location {
  font-size: 22rpx;
  color: #999999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-footer-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.report-time {
  font-size: 22rpx;
  color: #999999;
}

.report-created {
  font-size: 20rpx;
  color: #bbbbbb;
  margin-top: 2rpx;
  font-variant-numeric: tabular-nums;
}

.loading {
  text-align: center;
  padding: 24rpx;
  color: #999999;
  font-size: 24rpx;
}

/* 阶段 3 (2026-07-06): 待关联入口 */
.report-link-action {
  margin-top: 12rpx;
  padding: 12rpx 20rpx;
  background: #e8fdf8;
  color: #0fbf9f;
  font-size: 24rpx;
  border-radius: 8rpx;
  align-self: flex-start;
}

/* 阶段 3 (2026-07-06): 动物选择器弹层 */
.picker-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.picker-panel {
  width: 100%;
  max-height: 70vh;
  background: #ffffff;
  border-top-left-radius: 20rpx;
  border-top-right-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
}
.picker-title {
  font-size: 30rpx;
  font-weight: bold;
  margin-bottom: 16rpx;
  text-align: center;
}
.picker-loading,
.picker-empty {
  text-align: center;
  padding: 40rpx 0;
  color: #999999;
  font-size: 26rpx;
}
.picker-list {
  max-height: 50vh;
}
.picker-item {
  padding: 20rpx 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.picker-item-title {
  display: block;
  font-size: 28rpx;
  color: #333333;
}
.picker-item-sub {
  display: block;
  font-size: 24rpx;
  color: #999999;
  margin-top: 6rpx;
}
.picker-cancel {
  margin-top: 16rpx;
  padding: 24rpx 0;
  text-align: center;
  background: #f5f5f5;
  border-radius: 12rpx;
  color: #666666;
  font-size: 28rpx;
}
</style>
