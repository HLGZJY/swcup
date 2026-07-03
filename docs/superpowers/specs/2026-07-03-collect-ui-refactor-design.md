# 采集页 UI 视觉对齐(发现页风格)设计

> 日期:2026-07-03
> 状态:用户已审核(选择方案 A)
> 目的:把 `pages/collect/index` 的整体视觉风格对齐到发现页(`pages/report/index`),功能 0 改动。

---

## 1. 概述

### 1.1 背景

`pages/collect/index`(鼻纹采集)与 `pages/report/index`(发现/上报)是两个并列的多步骤表单页。两者结构相似(选物种 → 拍/传照片 → 取位置 → 填信息 → 确认),但视觉风格不一致:

| 维度 | collect 页现状 | report 页(参考) |
|---|---|---|
| 卡片底色 | `#FFFFFF` 白底 | `#F5F5F5` 灰底 |
| 圆角 | 16~24rpx 混用 | 统一 12rpx |
| 步骤指示 | 数字圆圈 + 横线 | 进度条 + 步骤计数 |
| 顶部品牌区 | 标题 + 鼻纹图 | paw logo + 标题 + 副标题 |
| 强调色 | 浅绿/蓝色混用 | 薄荷绿 `#E8FDF8` + 品牌绿 `#0FBF9F` |
| 按钮 | 单色填充 | 渐变主按钮 + 灰次按钮 |

### 1.2 目标

把 collect 页视觉风格**全部对齐**到 report 页:

- 卡片统一灰底 `#F5F5F5` + 12rpx 圆角
- 顶部 guide-header 改 paw logo + 副标题结构
- 步骤指示器改进度条 + 步骤计数
- 按钮、输入框、确认卡片用统一 token
- 独有功能(camera-area、AI 提示、tips-box、quality-card)保留并套用同样的卡片样式

### 1.3 范围

**包含:** 改 `miniapp-user/src/pages/collect/index.vue` 一个文件
- template 改动 2 处:`guide-header`、`steps-indicator`
- SCSS 改动:所有卡片/按钮/输入框 token 替换
- 新增 SCSS:进度条、薄荷绿选中态

**不包含:**
- 改 `pages/report/index.vue`(参考样板,不动)
- 改后端 API
- 改测试
- 改静态资源
- 改 `manifest.json`

---

## 2. 设计

### 2.1 Template 改动

#### 2.1.1 `guide-header`(line 15-26)

**改前:**
```vue
<view class="guide-header">
  <view class="guide-title">
    <text class="title-main">鼻纹采集</text>
    <text class="title-sub">为你的宠物建立唯一身份档案</text>
  </view>
  <view class="nose-preview">
    <image class="nose-icon" src="/static/mock/nose-guide.png" mode="aspectFit" @error="onImageError" />
  </view>
</view>
```

**改后:**
```vue
<view class="guide-header">
  <view class="guide-brand">
    <view class="guide-logo">
      <image class="logo-icon" src="/static/icons/icon-paw-filled.svg" mode="aspectFit" @error="onImageError" />
    </view>
    <view class="guide-title">
      <text class="title-main">鼻纹采集</text>
      <text class="title-sub">为你的宠物建立唯一身份档案</text>
    </view>
  </view>
</view>
```

> **说明:** 移除 `nose-preview`(鼻纹引导图),改成 paw logo(爪子图标)。功能上原本只是装饰图,不影响业务。

#### 2.1.2 `steps-indicator`(line 27-41)

**改前:** 5 个数字圆圈 + 步骤名 + 横线进度

**改后:**
```vue
<view class="steps-indicator">
  <view class="steps-progress">
    <view class="steps-progress-fill" :style="{ width: ((currentStep + 1) / steps.length * 100) + '%' }" />
  </view>
  <view class="steps-info">
    <text class="steps-counter">步骤 {{ currentStep + 1 }} / {{ steps.length }}</text>
    <text class="steps-name">{{ steps[currentStep] }}</text>
  </view>
</view>
```

> **说明:** 用 `currentStep + 1` 计算进度填充宽度,样式跟 report 一致。`steps` 数组原样保留。

#### 2.1.3 `navbar-placeholder`(在 page 内最顶部)

**新增:**
```vue
<view class="navbar-placeholder" />
```

report 页有这个,collect 页没有。补上以保持顶部留白一致。

### 2.2 SCSS 改动

#### 2.2.1 设计 token

| Token | 值 | 用途 |
|---|---|---|
| 卡片背景 | `#F5F5F5` | section / form-item / confirm-card / tips-box / quality-card / camera-area / location-box |
| 卡片圆角 | `12rpx` | 统一 |
| 强调色背景 | `#E8FDF8` | 选中态、图标底、tip 强调 |
| 强调色文字 | `#0FBF9F` | 主按钮、选中标签 |
| 主按钮 | 渐变 `#0FBF9F` → `#0DA68A` | 底部主操作按钮 |
| 次按钮 | `#F5F5F5` 灰底 | 上一步 |
| 标题色 | `#1A1A1A` | section-title / title-main |
| 副标题色 | `#666666` | section-hint / title-sub |
| 提示色 | `#AAAAAA` | location-tip / char-count |

#### 2.2.2 改动清单

| 选择器 | 改动 |
|---|---|
| `.navbar-placeholder` | 新增,`height: var(--navbar-height, 64rpx)` |
| `.guide-header` | padding/spacing 调整 |
| `.guide-brand` | 新增,flex 横向布局 |
| `.guide-logo` | 新增,`64rpx` 圆 + 薄荷绿底 |
| `.logo-icon` | 新增,`36rpx` 内置图 |
| `.guide-title` | 改 flex 纵向,左对齐 |
| `.nose-preview` `.nose-icon` | 删除 |
| `.steps-indicator` | 改纵向布局 |
| `.steps-progress` | 新增,`8rpx` 高灰底 |
| `.steps-progress-fill` | 新增,薄荷绿填充 |
| `.steps-info` | 新增,横向 justify-between |
| `.steps-counter` `.steps-name` | 新增 |
| `.step-circle` `.step-text` `.step-line` | 删除 |
| `.section` | 改 `#F5F5F5` + `12rpx` |
| `.section-title` | 字号/颜色对齐 report |
| `.section-hint` | 颜色 `#666666` |
| `.species-item` `.species-item.selected` | 选中态改薄荷绿填充 |
| `.species-paw-mark` | 复用(已有) |
| `.form-item` `.form-label` `.form-input` | 灰底 + 12rpx |
| `.gender-options` `.gender-option` | 选中态改薄荷绿底 |
| `.camera-area` | 灰底 + 12rpx |
| `.camera-overlay` | 文字色对齐 |
| `.tips-box` | 灰底 + 12rpx + 薄荷图标底 |
| `.quality-card` | 灰底 + 12rpx |
| `.confirm-card` | 灰底 + 12rpx |
| `.bottom-bar` | 背景/边框对齐 |
| `.btn-back` `.btn-next` | 灰底次按钮 + 渐变主按钮 |
| `.step-hint` | 字号缩小 |

> **不变:** `.location-box` 系列(已在 commit 83f5b18 完成)

### 2.3 功能保留

下列功能**一字不改**:
- `onManualSelectLocation` / `getLocation` / `chooseLocation`
- `onOpenBodyCamera` / `onOpenCamera` / `onRetakeBody` / `onRetake`
- `onImageError` / `onLocationIconError`
- `aiBreedSuggestion` AI 识别
- `onNext` / `onBack` 步骤导航
- 所有 `data` 字段(photos、breed、color、gender、description、locationLat/Lng、locationText)
- `submit` 提交逻辑
- 5 个 vitest 测试

---

## 3. 行为变化

| 场景 | 改前 | 改后 |
|---|---|---|
| 进入页面 | 顶部白底+鼻纹图 | 顶部 paw logo + 标题(薄荷绿圆底) |
| 步骤指示 | 5 数字圆圈,已完成显示 ✓ | 进度条(薄荷绿填充) + "步骤 X / 5" + 步骤名 |
| 选物种卡片 | 白底 | 灰底,选中态薄荷绿填充 |
| 拍照区 | 白底 | 灰底卡片 |
| 拍摄技巧 | 白底 | 灰底,图标薄荷绿圆底 |
| 表单输入 | 白底 | 灰底 |
| 确认卡片 | 白底 | 灰底 |
| 质量评估 | 白底 | 灰底 |
| 底部按钮 | 单色绿 | 渐变绿 + 灰底次按钮 |
| 位置选择 | ✅(已对齐) | 一致 |
| 提交/拍照/AI/导航 | 功能不变 | 完全保留 |

---

## 4. 边界情况

| 情况 | 处理 |
|---|---|
| `icon-paw-filled.svg` 不存在 | `@error="onImageError"` 静默忽略 |
| 进度条宽度极端(0% 或 100%) | 直接用百分比,无溢出风险 |
| 测试断言 `.location-box` 等结构 | 结构不变,测试通过 |

---

## 5. 关键文件

- 改动:`miniapp-user/src/pages/collect/index.vue`(约 50 行 template + 200 行 SCSS)
- 不动:`pages/report/index.vue`(参考样板)、`test/pages/collect-location-selector.spec.ts`
- 复用静态资源:`/static/icons/icon-paw-filled.svg`(report 页同款)

---

## 6. 验证

1. `npx vitest run test/pages/collect-location-selector.spec.ts` → 5/5 通过
2. `npm run build:mp-weixin` → DONE Build complete
3. 微信开发者工具视觉对比:collect 页与 report 页同色系、同圆角、同步骤指示风格
4. 功能回归:5 步流程仍可正常导航、拍照、AI 识别、提交

---

## 7. 下一步

- 用户审 spec ✓
- 通过后:进入 `superpowers:writing-plans` 写实施计划(因改动单一文件,可考虑直接实施)
- 实施完成后:跑测试 + 构建 + commit