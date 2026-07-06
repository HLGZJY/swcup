# 用户端分享功能设计

> 日期：2026-05-21
> 状态：已完成设计

---

## 1. 概述

**目的：** 完善用户端分享功能，支持微信内分享到聊天和朋友圈

**范围：**
- 全局分享配置（App.vue）
- 动物详情页自定义分享
- 首页动物卡片快速分享入口

---

## 2. 技术实现

### 2.1 微信小程序分享 API

微信小程序提供两个分享 API：
- `onShareAppMessage()` - 分享到聊天
- `onShareTimeline()` - 分享到朋友圈

### 2.2 混合模式架构

```
App.vue（全局默认）
    ↓ 设置默认分享标题+图标
animal-detail/index.vue（override 自定义内容）
    ↓ 自定义 animal_id + 照片 + 状态
index/index.vue（卡片快速分享入口）
    ↓ 复用详情页分享逻辑
```

---

## 3. 全局配置（App.vue）

### 3.1 默认分享信息

```javascript
// miniapp-user/src/App.vue
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

---

## 4. 动物详情页（animal-detail/index.vue）

### 4.1 分享到聊天（onShareAppMessage）

```javascript
onShareAppMessage() {
  const animal = this.animal
  return {
    title: `${animal.breed} ${this.statusMap[animal.status]} | ${animal.address}`,
    imageUrl: animal.photos?.[0] || '/static/mock/dog-placeholder.png',
    path: `/pages/animal-detail/index?animal_id=${animal.animal_id}`
  }
}
```

### 4.2 分享到朋友圈（onShareTimeline）

```javascript
onShareTimeline() {
  const animal = this.animal
  return {
    title: `${animal.breed} ${this.statusMap[animal.status]}`,
    imageUrl: animal.photos?.[0] || '/static/mock/dog-placeholder.png',
    query: `animal_id=${animal.animal_id}`
  }
}
```

### 4.3 分享数据内容

| 字段 | 分享到聊天 | 分享到朋友圈 |
|------|-----------|-------------|
| title | `{品种} {状态} \| {地址}` | `{品种} {状态}` |
| imageUrl | 动物第一张照片 | 动物第一张照片 |
| path/query | `animal_id=xxx` | `animal_id=xxx` |

---

## 5. 首页动物卡片（index/index.vue）

### 5.1 分享按钮

在动物卡片右上角添加分享按钮，点击后触发分享：

```vue
<view class="card-actions">
  <view class="share-btn" @click.stop="onShareCard(animal)">
    <image src="/static/icons/icon-share.png" mode="aspectFit" />
  </view>
</view>
```

### 5.1 分享方法

```javascript
function onShareCard(animal) {
  // 调用动物详情页的分享逻辑
  // 方式：跳转到详情页让用户手动分享
  uni.navigateTo({
    url: `/pages/animal-detail/index?animal_id=${animal.animal_id}&share=1`
  })
}
```

或者使用 `uni.showShareMenu` 开启当前页面的分享功能：

```javascript
onLoad() {
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  })
}
```

---

## 6. 页面改动清单

| 文件 | 改动类型 |
|------|----------|
| `miniapp-user/src/App.vue` | 新增全局分享配置 |
| `miniapp-user/src/pages/animal-detail/index.vue` | 新增 onShareAppMessage 和 onShareTimeline |
| `miniapp-user/src/pages/index/index.vue` | 卡片增加分享按钮 |

---

## 7. 注意事项

1. **imageUrl 必须使用 https** - 微信要求分享图片必须是 https 链接
2. **path 参数限制** - 路径不能超过 128 字符
3. **朋友圈分享限制** - 朋友圈分享不支持自定义 path，只能通过 query 传参
4. **图片大小** - 建议图片不超过 500KB，否则展示可能有问题