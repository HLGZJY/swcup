/**
 * 页面分享配置
 * 用于微信小程序的全局分享（好友和朋友圈）
 */

export const shareAppMessage = () => {
  return {
    title: '鼻纹智救 · 帮你找到走失的宠物',
    imageUrl: '/static/icon-fingerprint.svg',
    path: '/pages/index/index'
  }
}

export const shareTimeline = () => {
  return {
    title: '鼻纹智救 · 帮你找到走失的宠物',
    imageUrl: '/static/icon-fingerprint.svg',
    query: ''
  }
}