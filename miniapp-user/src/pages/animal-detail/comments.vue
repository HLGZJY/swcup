<template>
  <view class='page'>
    <view class='navbar'>
      <view class='back' @click='goBack'><text class='back-arrow'>\u2039</text></view>
      <text class='title'>评论 ({{ total }})</text>
    </view>


    <view class='summary-card' v-if='summary'>

      <text class='summary-title'>AI 摘要</text>

      <text class='summary-text'>{{ summary.auto_summary }}</text>

    </view>



    <comment-list class='list' :items='list' empty-text='还没有评论,第一个留言吧' />



    <view class='input-zone'>
      <comment-input :submitting='submitting' @submit='onSubmit' />
    </view>
  </view>
</template>


<script lang='ts'>
import { apiGetComments, apiCreateComment, apiGetCommentsSummary } from '@/services/api'
export default {
  data() {
    return {
      animalId: '',
      list: [] as any[],
      total: 0,
      summary: null as any,
      submitting: false,
      lastSent: '', // 用于客户端 30s 防抖
    }
  },
  onLoad(query: any) {
    this.animalId = query?.animal_id || ''
    if (!this.animalId) {
      uni.showToast({ title: '参数缺失', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 800)
      return
    }
    this.loadAll()
  },
  methods: {
    goBack() { uni.navigateBack() },
    async loadAll() {
      try {
        const [listR, sumR] = await Promise.all([
          apiGetComments(this.animalId, { limit: 50, offset: 0 }),
          apiGetCommentsSummary(this.animalId),
        ])
        if (listR && listR.code === 0 && listR.data) {
          this.list = listR.data.items || []
          this.total = listR.data.total || 0
        }
        if (sumR && sumR.code === 0) this.summary = sumR.data
      } catch (e) {
        uni.showToast({ title: '加载失败', icon: 'none' })
      }
    },
    async onSubmit(content: string) {
      // 客户端 30s 去重 (兼容后端 60s 去重,前端更快)
      const now = Date.now()
      if (this.lastSent && content === this.lastSent.split('|')[1] && now - Number(this.lastSent.split('|')[0]) < 30_000) {
        uni.showToast({ title: '请勿重复提交', icon: 'none' })
        return
      }
      this.submitting = true
      try {
        const r: any = await apiCreateComment({ animal_id: this.animalId, content })
        if (r && r.code === 0) {
          this.lastSent = String(now) + '|' + content
          uni.showToast({ title: '已发布', icon: 'success' })
          this.loadAll()
        } else {
          const msg = (r && (r.message || (r.data && r.data.message))) || '发布失败'
          uni.showToast({ title: String(msg).slice(0, 18), icon: 'none' })
        }
      } catch (e) {
        uni.showToast({ title: '网络异常', icon: 'none' })
      } finally {
        this.submitting = false
      }
    },
  },
}
</script>

<style lang='scss' scoped>
.page {
  min-height: 100vh;
  background: #F8FAFC;
  display: flex;
  flex-direction: column;
  padding-bottom: 200rpx;
}
.navbar {
  display: flex;
  align-items: center;
  height: 88rpx;
  background: #FFFFFF;
  border-bottom: 1rpx solid #E5E7EB;
  padding: 0 24rpx;
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
  color: #1F2937;
}
.title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  color: #1F2937;
  margin-right: 64rpx;
}
.summary-card {
  background: linear-gradient(135deg, #E0F7F2 0%, #FFFFFF 100%);
  margin: 24rpx;
  padding: 24rpx;
  border-radius: 16rpx;
}
.summary-title {
  font-size: 24rpx;
  color: #0FBF9F;
  font-weight: 600;
}
.summary-text {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: #1F2937;
}
.list {
  padding: 0 24rpx;
}
.input-zone {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  z-index: 10;
}
</style>
