<template>
  <view class="page">
    <!-- 导航栏 -->
    <view class="navbar">
      <view class="back" @click="goBack">
        <text class="back-arrow">‹</text>
      </view>
      <text class="title">评论 ({{ total }})</text>
    </view>

    <!-- 滚动内容区域 -->
    <scroll-view
      class="scroll-content"
      scroll-y
      :style="{ height: scrollHeight }"
    >
      <!-- AI 摘要 -->
      <view class="summary-card" v-if="summary && summary.auto_summary">
        <view class="summary-header">
          <text class="summary-icon">🤖</text>
          <text class="summary-title">AI 摘要</text>
        </view>
        <text class="summary-text">{{ summary.auto_summary }}</text>
      </view>

      <!-- 评论列表 -->
      <view class="comment-list" v-if="list.length > 0">
        <view class="comment-item" v-for="(item, index) in list" :key="index">
          <view class="comment-avatar">
            <text class="avatar-text">{{
              item.user_name ? item.user_name.charAt(0).toUpperCase() : "U"
            }}</text>
          </view>
          <view class="comment-content">
            <view class="comment-header">
              <text class="user-name">{{ item.user_name || "匿名用户" }}</text>
              <text class="comment-time">{{
                formatTime(item.created_at)
              }}</text>
            </view>
            <text class="comment-text">{{ item.content }}</text>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view class="empty-state" v-else>
        <text class="empty-icon">💬</text>
        <text class="empty-text">还没有评论，第一个留言吧</text>
      </view>

      <!-- 底部占位 -->
      <view class="bottom-placeholder"></view>
    </scroll-view>

    <!-- 底部输入框 -->
    <view class="input-zone">
      <view class="input-wrapper">
        <input
          class="comment-input"
          v-model="inputContent"
          placeholder="说点什么..."
          placeholder-class="placeholder-style"
          confirm-type="send"
          @confirm="onSubmit"
          :disabled="submitting"
        />
        <button
          class="send-btn"
          @click="onSubmit"
          :disabled="!inputContent.trim() || submitting"
          :class="{ 'send-active': inputContent.trim() }"
        >
          {{ submitting ? "发送中" : "发送" }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import {
  apiGetComments,
  apiCreateComment,
  apiGetCommentsSummary,
} from "@/services/api";

const animalId = ref("");
const list = ref<any[]>([]);
const total = ref(0);
const summary = ref<any>(null);
const submitting = ref(false);
const inputContent = ref("");
const scrollHeight = ref("calc(100vh - 100rpx)");

// 加载评论数据
async function loadAll() {
  if (!animalId.value) return;

  uni.showLoading({ title: "加载中..." });
  try {
    const [listR, sumR] = await Promise.all([
      apiGetComments(animalId.value, { limit: 50, offset: 0 }),
      apiGetCommentsSummary(animalId.value),
    ]);

    if (listR && listR.code === 0 && listR.data) {
      list.value = listR.data.items || [];
      total.value = listR.data.total || 0;
    }

    if (sumR && sumR.code === 0) {
      summary.value = sumR.data;
    }
  } catch (e) {
    console.error("加载评论失败", e);
    uni.showToast({ title: "加载失败", icon: "none" });
  } finally {
    uni.hideLoading();
  }
}

// 提交评论
async function onSubmit() {
  const content = inputContent.value.trim();
  if (!content || submitting.value) return;

  submitting.value = true;
  try {
    const r: any = await apiCreateComment({
      animal_id: animalId.value,
      content: content,
    });

    if (r && r.code === 0) {
      inputContent.value = "";
      uni.showToast({ title: "评论成功", icon: "success" });
      // 重新加载评论列表
      await loadAll();
    } else {
      const msg = r?.message || r?.data?.message || "发布失败";
      uni.showToast({ title: msg, icon: "none" });
    }
  } catch (e) {
    console.error("提交评论失败", e);
    uni.showToast({ title: "网络异常，请重试", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

// 格式化时间
function formatTime(dateStr: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return "刚刚";
  if (diff < 3600) return Math.floor(diff / 60) + "分钟前";
  if (diff < 86400) return Math.floor(diff / 3600) + "小时前";
  if (diff < 604800) return Math.floor(diff / 86400) + "天前";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// 返回上一页
function goBack() {
  uni.navigateBack();
}

// 页面加载
onLoad((query: any) => {
  animalId.value = query?.animal_id || "";
  if (!animalId.value) {
    uni.showToast({ title: "参数缺失", icon: "none" });
    setTimeout(() => uni.navigateBack(), 800);
    return;
  }
  loadAll();
});

// 计算滚动高度
onMounted(() => {
  const systemInfo = uni.getSystemInfoSync();
  const windowHeight = systemInfo.windowHeight;
  // 减去导航栏和输入框的高度
  scrollHeight.value = windowHeight - 120 + "px";
});
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

/* 导航栏 */
.navbar {
  display: flex;
  align-items: center;
  height: 88rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #e5e7eb;
  padding: 0 24rpx;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.back {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: #1a1a1a;
  cursor: pointer;
}

.back:active {
  opacity: 0.6;
}

.title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-right: 64rpx;
}

/* 滚动内容 */
.scroll-content {
  flex: 1;
  padding-bottom: 20rpx;
}

/* AI 摘要 */
.summary-card {
  background: linear-gradient(135deg, #e8fdf8 0%, #f0faf8 100%);
  margin: 24rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid #d0f0e8;
}

.summary-header {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.summary-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
}

.summary-title {
  font-size: 24rpx;
  color: #0fbf9f;
  font-weight: 600;
}

.summary-text {
  display: block;
  font-size: 26rpx;
  line-height: 1.6;
  color: #1a1a1a;
}

/* 评论列表 */
.comment-list {
  padding: 0 24rpx;
}

.comment-item {
  display: flex;
  background: #ffffff;
  padding: 24rpx;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.comment-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #0fbf9f 0%, #0a8f7a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 16rpx;
}

.avatar-text {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.user-name {
  font-size: 26rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.comment-time {
  font-size: 20rpx;
  color: #999999;
}

.comment-text {
  font-size: 26rpx;
  color: #333333;
  line-height: 1.6;
  display: block;
  word-break: break-all;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999999;
}

/* 底部占位 */
.bottom-placeholder {
  height: 20rpx;
}

/* 底部输入框 */
.input-zone {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1rpx solid #e5e7eb;
  z-index: 10;
  flex-shrink: 0;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.comment-input {
  flex: 1;
  height: 72rpx;
  background: #f5f5f5;
  border-radius: 36rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #1a1a1a;
}

.placeholder-style {
  color: #999999;
  font-size: 28rpx;
}

.send-btn {
  width: 120rpx;
  height: 72rpx;
  border-radius: 36rpx;
  background: #f0f0f0;
  color: #999999;
  font-size: 26rpx;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.send-active {
  background: linear-gradient(135deg, #0fbf9f 0%, #0a8f7a 100%);
  color: #ffffff;
  box-shadow: 0 4rpx 12rpx rgba(15, 191, 159, 0.3);
}

.send-btn:active {
  transform: scale(0.95);
}
</style>
