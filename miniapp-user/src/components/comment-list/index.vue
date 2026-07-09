<template>
  <view class="comment-list" v-if="items && items.length">
    <view class="item" v-for="c in items" :key="c.comment_id">
      <view class="row1">
        <text class="badge" :class="sentimentClass(c.sentiment)">{{
          sentimentLabel(c.sentiment)
        }}</text>
        <text class="time">{{ formatTime(c.created_at) }}</text>
      </view>
      <view class="content">{{ c.content }}</view>
    </view>
  </view>
  <view v-else class="empty">{{ emptyText }}</view>
</template>

<script>
const SENTIMENTS = [
  { key: "care", label: "关心", cls: "care" },
  { key: "seek", label: "求助", cls: "seek" },
  { key: "report", label: "目击", cls: "report" },
  { key: "thanks", label: "感谢", cls: "thanks" },
  { key: "fake", label: "疑似营销", cls: "fake" },
  { key: "neutral", label: "其他", cls: "neutral" },
];

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

export default {
  name: "comment-list",
  props: {
    items: { type: Array, default: () => [] },
    emptyText: { type: String, default: "暂无评论" },
  },
  methods: {
    sentimentClass(s) {
      const f = SENTIMENTS.find((x) => x.key === s);
      return f ? f.cls : "neutral";
    },
    sentimentLabel(s) {
      const f = SENTIMENTS.find((x) => x.key === s);
      return f ? f.label : "其他";
    },
    // ========== 修改这里：东八区时区转换 ==========
    formatTime(iso) {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      // UTC 时间 + 8 小时 = 北京时间
      const local = new Date(d.getTime() + 8 * 60 * 60 * 1000);
      const Y = local.getFullYear();
      const M = pad(local.getMonth() + 1);
      const D = pad(local.getDate());
      const h = pad(local.getHours());
      const m = pad(local.getMinutes());
      return Y + "-" + M + "-" + D + " " + h + ":" + m;
    },
  },
};
</script>

<style lang="scss" scoped>
.comment-list {
  display: block;
}
.item {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.badge {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  color: #ffffff;
}
.badge.care {
  background: #ff9f45;
}
.badge.seek {
  background: #3b82f6;
}
.badge.report {
  background: #0fbf9f;
}
.badge.thanks {
  background: #a78bfa;
}
.badge.fake {
  background: #ef4444;
}
.badge.neutral {
  background: #94a3b8;
}
.time {
  font-size: 22rpx;
  color: #94a3b8;
}
.content {
  font-size: 28rpx;
  line-height: 1.6;
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-word;
}
.empty {
  text-align: center;
  font-size: 26rpx;
  color: #94a3b8;
  padding: 60rpx 0;
}
</style>
