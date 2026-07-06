<template>
  <view class="page">
    <view class="content">
      <text class="title">隐私政策</text>
      <view class="text-block">
        <text class="text">鼻纹智救高度重视您的个人信息保护。在您使用鼻纹智救服务时，我们可能会收集和使用您的相关信息。</text>
      </view>
      <view class="text-block">
        <text class="heading">一、信息收集</text>
        <text class="text">我们收集的信息包括：设备信息、位置信息、您主动提供的动物鼻纹照片等。这些信息用于为您提供鼻纹识别和动物救助服务。</text>
      </view>
      <view class="text-block">
        <text class="heading">二、信息使用</text>
        <text class="text">您的信息将用于：提供鼻纹比对服务、动物走失预警、与动物救助组织协作等。我们不会将您的信息用于未经您同意的商业目的。</text>
      </view>
      <view class="text-block">
        <text class="heading">三、信息共享</text>
        <text class="text">除法律法规要求外，我们不会与任何第三方共享您的个人信息。如需与救助组织协作，我们会事先征得您的同意。</text>
      </view>
      <view class="text-block">
        <text class="heading">四、信息安全</text>
        <text class="text">我们采取行业标准的安全措施保护您的个人信息，防止数据遭到未经授权的访问、使用或泄露。</text>
      </view>
      <view class="text-block">
        <text class="heading">五、您的权利</text>
        <text class="text">您有权查看、更正或删除您的个人信息。如有任何疑问，请联系我们。</text>
      </view>
      <view class="text-block">
        <text class="text">如您对本政策有任何疑问，请联系我们的客服团队。</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: #FFFFFF;
  padding: 32rpx;
}

.content {
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1A1A1A;
  text-align: center;
  display: block;
  margin-bottom: 40rpx;
}

.text-block {
  margin-bottom: 24rpx;
}

.heading {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
  display: block;
  margin-bottom: 12rpx;
}

.text {
  font-size: 26rpx;
  color: #666666;
  line-height: 1.6;
  display: block;
}
</style>