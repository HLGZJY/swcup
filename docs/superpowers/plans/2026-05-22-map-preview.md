# 地图预览优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩大地图预览区块高度至 320rpx，增加圆角至 24rpx，添加渐变背景装饰，保持点击导航功能不变

**Architecture:** 仅修改 SCSS 样式，不涉及 JS 逻辑或组件结构变更

**Tech Stack:** UniApp / Vue3 / SCSS

---

### Task 1: 修改用户端 animal-detail 地图预览样式

**Files:**
- Modify: `miniapp-user/src/pages/animal-detail/index.vue`

**改动说明：** 仅修改 `.map-preview` / `.map-overlay` 相关样式

- [ ] **Step 1: 修改 .map-preview 区块样式**

```scss
.map-preview {
  height: 320rpx;              // 原 200rpx → 320rpx
  background: linear-gradient(135deg, #E8FDF8 0%, #D0F0E8 100%);
  border-radius: 24rpx;         // 原 12rpx → 24rpx
  margin-top: 16rpx;
  overflow: hidden;
  position: relative;
}
```

- [ ] **Step 2: 修改 .map-overlay 遮罩样式**

```scss
.map-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.5);   // 原 rgba(0,0,0,0.3) → 更柔和的半透明白
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8rpx;
}

.map-overlay text {
  font-size: 24rpx;
  color: #1A1A1A;
  background: rgba(255, 255, 255, 0.8);
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}
```

- [ ] **Step 3: 添加地图图标装饰**

在 `.map-overlay` 内添加居中的地图图标，透明度 60%：
```scss
.map-overlay::before {
  content: '';
  display: block;
  width: 64rpx;
  height: 64rpx;
  background: url('/static/icons/icon-mappin.png') center/contain no-repeat;
  opacity: 0.6;
  margin-bottom: 8rpx;
}
```

- [ ] **Step 4: 提交**

```bash
git add miniapp-user/src/pages/animal-detail/index.vue
git commit -m "style(user): enlarge map preview to 320rpx with 24rpx radius"
```

---

### Task 2: 修改管理端 events/detail 地图预览样式

**Files:**
- Modify: `miniapp-admin/src/pages/events/detail/index.vue`

**改动说明：** 管理端目前用的是 `.map-placeholder`（纯文字区块），需将其升级为带渐变背景的预览区块

- [ ] **Step 1: 修改 .map-placeholder 区块样式**

```scss
.map-placeholder {
  height: 320rpx;                          // 原 padding 32rpx → 固定高度
  background: linear-gradient(135deg, #E8FDF8 0%, #D0F0E8 100%);
  border-radius: 24rpx;                    // 新增圆角
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  position: relative;
  overflow: hidden;
}
```

- [ ] **Step 2: 添加图标和遮罩文字样式**

```scss
// 在 .map-placeholder 下添加图标背景装饰
.map-placeholder::before {
  content: '';
  display: block;
  width: 80rpx;
  height: 80rpx;
  background: url('/static/icons/icon-mappin.png') center/contain no-repeat;
  opacity: 0.5;
}

.map-placeholder text {
  font-size: 24rpx;
  color: #666;
  background: rgba(255,255,255,0.7);
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}
```

- [ ] **Step 3: 提交**

```bash
git add miniapp-admin/src/pages/events/detail/index.vue
git commit -m "style(admin): enlarge map preview to 320rpx with gradient background"
```

---

### Task 3: 修改管理端 animals/detail 地图预览样式

**Files:**
- Modify: `miniapp-admin/src/pages/animals/detail/index.vue`

**改动说明：** 同 Task 2，管理端动物详情页的地图区块

- [ ] **Step 1: 修改 .map-placeholder 区块样式**（同 Task 2）

```scss
.map-placeholder {
  height: 320rpx;
  background: linear-gradient(135deg, #E8FDF8 0%, #D0F0E8 100%);
  border-radius: 24rpx;
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  position: relative;
  overflow: hidden;
}

.map-placeholder::before {
  content: '';
  display: block;
  width: 80rpx;
  height: 80rpx;
  background: url('/static/icons/icon-mappin.png') center/contain no-repeat;
  opacity: 0.5;
}

.map-placeholder text {
  font-size: 24rpx;
  color: #666;
  background: rgba(255,255,255,0.7);
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}
```

- [ ] **Step 2: 提交**

```bash
git add miniapp-admin/src/pages/animals/detail/index.vue
git commit -m "style(admin): enlarge map preview to 320rpx with gradient background"
```

---

## 自检清单

- [x] Spec 覆盖：`height: 320rpx` ✓、`border-radius: 24rpx` ✓、渐变背景 ✓、保留点击导航 ✓
- [x] 无占位符：所有样式代码完整
- [x] 文件路径正确：3 个文件路径均准确
- [x] 无跨文件依赖：每个 Task 独立修改一个文件