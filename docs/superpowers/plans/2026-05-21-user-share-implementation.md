# 用户端分享功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为用户端添加微信内分享功能（聊天+朋友圈）

**Architecture:** 混合模式：App.vue 全局配置默认分享，animal-detail/index.vue 覆盖自定义分享内容（品种+状态+照片+地址）

**Tech Stack:** UniApp/Vue3 + 微信小程序

---

## File Structure

| 文件 | 改动类型 | 职责 |
|------|----------|------|
| `miniapp-user/src/App.vue` | 修改 | 全局分享配置（默认标题+图标） |
| `miniapp-user/src/pages/animal-detail/index.vue` | 修改 | 自定义分享（动物详情+照片） |
| `miniapp-user/src/pages/index/index.vue` | 修改 | 首页卡片分享按钮 |

---

## Task 1: App.vue 全局分享配置

**Files:**
- Modify: `miniapp-user/src/App.vue`

- [ ] **Step 1: 读取 App.vue 确认当前内容**

路径：`miniapp-user/src/App.vue`

- [ ] **Step 2: 添加全局分享方法**

在 `export default` 对象中添加：

```javascript
// App.vue
export default {
  onShareAppMessage() {
    return {
      title: '鼻纹智救 · 帮你找到走失的宠物',
      imageUrl: '/static/logo.png',
      path: '/pages/index/index'
    }
  },
  onShareTimeline() {
    return {
      title: '鼻纹智救 · 帮你找到走失的宠物',
      imageUrl: '/static/logo.png',
      query: ''
    }
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add miniapp-user/src/App.vue
git commit -m "feat(user): 全局分享配置（聊天+朋友圈）"
```

---

## Task 2: animal-detail/index.vue 自定义分享

**Files:**
- Modify: `miniapp-user/src/pages/animal-detail/index.vue`

- [ ] **Step 1: 读取 animal-detail/index.vue**

路径：`miniapp-user/src/pages/animal-detail/index.vue`

找到 `onShare` 函数（第210行）和 `statusMap` 定义位置。

- [ ] **Step 2: 替换 onShare 函数**

原有：
```javascript
function onShare() {
  uni.showToast({ title: '分享功能', icon: 'none' })
}
```

替换为：
```javascript
onShareAppMessage() {
  const animal = this.animal
  return {
    title: `${animal.breed} ${this.statusMap[animal.status]} | ${animal.address}`,
    imageUrl: animal.photos?.[0] || '/static/mock/dog-placeholder.png',
    path: `/pages/animal-detail/index?animal_id=${animal.animal_id}`
  }
},
onShareTimeline() {
  const animal = this.animal
  return {
    title: `${animal.breed} ${this.statusMap[animal.status]}`,
    imageUrl: animal.photos?.[0] || '/static/mock/dog-placeholder.png',
    query: `animal_id=${animal.animal_id}`
  }
}
```

注意：由于是 Options API 写法（不是 Composition API），需要将 `onShareAppMessage` 和 `onShareTimeline` 放在 methods 对象中，并确保 `this.animal` 可访问。

- [ ] **Step 3: 在 onMounted 中启用分享菜单**

```javascript
onMounted(async () => {
  // ... existing code ...

  // 启用分享菜单
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  })
})
```

- [ ] **Step 4: 提交**

```bash
git add miniapp-user/src/pages/animal-detail/index.vue
git commit -m "feat(user): 动物详情页自定义分享（聊天+朋友圈）"
```

---

## Task 3: index/index.vue 首页卡片分享按钮

**Files:**
- Modify: `miniapp-user/src/pages/index/index.vue`

- [ ] **Step 1: 读取 index/index.vue**

路径：`miniapp-user/src/pages/index/index.vue`

找到 animal-card 模板部分（第54-97行），在 `.card-info` 内部添加分享按钮。

- [ ] **Step 2: 添加分享按钮到卡片**

在 `.info-footer` 后面添加分享按钮：

```vue
<view class="info-footer">
  <text class="time">{{ formatTime(animal.last_seen_at) }}</text>
  <view class="action-btn">
    <text>鼻纹比对</text>
  </view>
</view>
<!-- 新增：分享按钮 -->
<view class="card-share-btn" @click.stop="onShareCard(animal)">
  <image src="/static/icons/icon-share.png" mode="aspectFit" />
</view>
```

- [ ] **Step 3: 添加样式**

在样式区域添加：
```scss
.card-share-btn {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.3);
  border-radius: 50%;
}

.card-share-btn image {
  width: 28rpx;
  height: 28rpx;
}
```

- [ ] **Step 4: 添加 onShareCard 方法**

在 script 中添加：
```javascript
function onShareCard(animal) {
  uni.navigateTo({
    url: `/pages/animal-detail/index?animal_id=${animal.animal_id}&share=1`
  })
}
```

注意：这个实现方式比较简洁——点击分享按钮跳转到详情页，用户可以在详情页使用小程序内置的分享按钮（右上角菜单）。

或者，可以直接在首页卡片点击时触发 `uni.share` API，但这样需要额外处理分享参数。

推荐先用第一种方式（跳转详情页），如果用户反馈体验不好再优化。

- [ ] **Step 5: 提交**

```bash
git add miniapp-user/src/pages/index/index.vue
git commit -m "feat(user): 首页动物卡片添加分享入口"
```

---

## 实施顺序

1. **Task 1：** App.vue 全局配置（先做，打好基础）
2. **Task 2：** animal-detail 自定义分享（核心功能）
3. **Task 3：** index 卡片分享入口（可选，用户体验增强）

**预计总时长：** 15-20 分钟