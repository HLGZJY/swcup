<template>
  <view class='comment-input'>
    <textarea
      class='textarea'
      v-model='content'
      :maxlength='500'
      placeholder='说点什么...'
      auto-height
      :disabled='submitting'
    />
    <view class='bar'>
      <text class='count'>{{ content.length }}/500</text>
      <button class='btn' :disabled='!canSubmit || submitting' @click='submit'>
        {{ submitting ? '提交中' : '发布' }}
      </button>
    </view>
  </view>
</template>


<script>
export default {
  name: 'comment-input',
  props: {
    submitting: { type: Boolean, default: false },
  },
  emits: ['submit'],
  data() {
    return { content: '' }
  },
  computed: {
    canSubmit() {
      const s = (this.content || '').trim()
      return s.length >= 1 && s.length <= 500
    },
  },
  methods: {
    submit() {
      const s = (this.content || '').trim()
      if (!s || this.submitting) return
      this.('submit', s)
    },
    reset() {
      this.content = ''
    },
  },
}
</script>

<style lang="scss" scoped>
.comment-input {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06);
}
.textarea {
  width: 100%;
  min-height: 100rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: #1F2937;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}
.count {
  font-size: 22rpx;
  color: #94A3B8;
}
.btn {
  background: #0FBF9F;
  color: #FFFFFF;
  font-size: 28rpx;
  padding: 0 32rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: 32rpx;
  border: none;
}
.btn[disabled] {
  background: #cbd5e1;
  color: #FFFFFF;
}
</style>
