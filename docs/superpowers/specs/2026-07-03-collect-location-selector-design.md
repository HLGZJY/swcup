# 采集页位置选择功能设计

> 日期:2026-07-03
> 状态:草稿,待用户审核
> 目的:为 user 端采集页(`pages/collect/index`)增加位置选择功能,与报告页(`pages/report/index`)保持一致

---

## 1. 概述

### 1.1 背景

当前 user 端采集页 (`pages/collect/index.vue`) 仅在 `setup()` 顶层调用一次 `uni.getLocation` 拿用户当前位置,采集流程中位置信息不可见、不可改。报告页 (`pages/report/index.vue`) 已经实现了完整的位置选择 UI(顶部固定位置栏 + `uni.chooseLocation`),但采集页缺失,导致:

- GPS 定位失败时,用户无法手动选择位置
- 采集过程中发现位置不对,无法纠正
- 体验与报告页不一致

### 1.2 目标

为采集页添加与报告页一致的位置选择能力:
- 顶部固定 location-box,所有步骤可见
- 点击弹 `uni.chooseLocation`(微信原生,带搜索栏)
- 选点后回填经纬度 + 地址,自动同步
- GPS 失败时降级为"点击选择位置",不阻断流程

### 1.3 范围

**包含:**
- 改 `miniapp-user/src/pages/collect/index.vue` 一个文件
- template: 顶部加 location-box
- script: 加 `onManualSelectLocation`,改 `getLocation` 失败处理
- style: 加 location-box 相关样式

**不包含:**
- 改 `manifest.json`(已声明 `chooseLocation` 权限)
- 改后端 API
- 改报告页(参考样板,不动)
- 改采集结果页(`pages/collect/result.vue`)

---

## 2. 设计

### 2.1 Template 改动

在 `guide-header` 之前(line 3 后)插入 location-box,**所有步骤都显示**:

```vue
<!-- 位置选择(始终可见,可点击重新选) -->
<view class="location-box" @click="onManualSelectLocation">
  <view class="location-icon-wrap">
    <image class="location-icon" src="/static/icons/icon-mappin.svg" mode="aspectFit" @error="onLocationIconError" />
  </view>
  <view class="location-info">
    <text class="location-text">{{ locationText }}</text>
    <text class="location-tip">点击选择位置</text>
  </view>
</view>
```

### 2.2 Script 改动

#### 2.2.1 新增 `onManualSelectLocation` 函数

```ts
function onManualSelectLocation() {
  uni.chooseLocation({
    success: (res) => {
      locationLat.value = res.latitude
      locationLng.value = res.longitude
      locationText.value = res.address || `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`
    },
    fail: (err) => {
      // 用户主动取消不报错;其他错误给提示
      if (err.errMsg && !err.errMsg.includes('cancel')) {
        uni.showToast({ title: '位置选择失败', icon: 'none' })
      }
    }
  })
}
```

#### 2.2.2 新增 `onLocationIconError` 函数(图片加载失败占位)

```ts
function onLocationIconError() {
  // 占位图加载失败时静默忽略
}
```

#### 2.2.3 改 `getLocation` 失败处理

**改前** (`index.vue:413-421`):
```ts
fail: (err) => {
  console.error('GPS 获取失败', err)
  locationText.value = '定位失败，请开启位置权限'
  uni.showToast({
    title: '需要定位权限才能记录救助位置',
    icon: 'none',
    duration: 3000
  })
}
```

**改后:**
```ts
fail: (err) => {
  console.error('GPS 获取失败', err)
  // 静默降级:显示"未定位,点击选择位置",用户可点击 location-box 手动选
  locationText.value = '未定位,点击选择位置'
}
```

**变更说明:** 原逻辑会弹 toast 阻断用户操作,改后静默降级,引导用户主动选点,符合"顶部固定位置栏可点击"的设计。

### 2.3 Style 改动

参考 `report/index.vue` 的 location-box 样式,在 `collect/index.vue` 的 `<style>` 块末尾追加:

```scss
/* 顶部位置栏(跟 report 页一致) */
.location-box {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  padding: 24rpx 32rpx;
  margin: 0 24rpx 16rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}

.location-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  background: #E8FDF8;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.location-icon {
  width: 36rpx;
  height: 36rpx;
  /* 注意:location-box 是白底,SVG 保持原色(绿色),不需要 brightness/invert 滤镜 */
}

.location-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.location-text {
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.location-tip {
  font-size: 22rpx;
  color: #999999;
  margin-top: 4rpx;
}
```

---

## 3. 行为变化对照

| 场景 | 改前 | 改后 |
|---|---|---|
| 启动 | `setup()` 调 `getLocation` 一次 | 一致 |
| GPS 成功 | 显示坐标(如 `31.2304, 121.4737`) | 一致 |
| GPS 失败 | 显示"定位失败" + 弹 toast | 静默 + 显示"未定位,点击选择位置" |
| 任何步骤 | 无位置 UI | 顶部固定 location-box,所有步骤可见 |
| 点击位置栏 | 无反应 | 弹 `uni.chooseLocation` 选点 |
| 选点成功 | — | 自动回填 lat/lng + 地址 |
| 选点失败/取消 | — | 静默,不动 lat/lng |
| 确认页位置 | 只读展示(在 confirm-card) | 顶部栏可点改;confirm-card 同步显示新值 |
| 提交校验 | `!lat \|\| !lng \|\| lat===0 \|\| lng===0` → 拒绝 | 一致 |

---

## 4. 边界情况

| 情况 | 处理 |
|---|---|
| 用户拒绝 GPS 权限 | 静默 → 显示"未定位,点击选择位置" |
| `chooseLocation` 弹窗中用户取消 | 静默,不动 lat/lng |
| `chooseLocation` 选到偏远无地址点 | 降级用 `${lat}, ${lng}` 字符串(已有逻辑) |
| 用户从未选位置直接提交 | onNext 已有校验拒绝:`请提供有效的位置信息` |
| 静态资源 `location-icon.png` 加载失败 | onLocationIconError 静默忽略,UI 不崩 |

---

## 5. 关键文件

- 改动:`miniapp-user/src/pages/collect/index.vue`
- 参考样板(不动):`miniapp-user/src/pages/report/index.vue` line 89-95, 369-380, 位置 box 样式
- 静态资源(已有):`/static/icons/icon-mappin.svg`(与主页 `index.vue` 用的位置图标一致)
- 权限配置(已就绪):`miniapp-user/src/manifest.json` `requiredPrivateInfos: ["chooseLocation", "getLocation"]`

---

## 6. 验证

手动测试步骤(由测试人员执行,不在本 spec 范围):

1. 启动采集页,允许位置权限
   - 预期:顶部 location-box 显示当前坐标(如 `31.2304, 121.4737`),所有步骤可见
2. 拒绝位置权限后重启
   - 预期:location-box 显示"未定位,点击选择位置",**不**弹 toast
3. 在任意步骤点击 location-box
   - 预期:弹 `chooseLocation` 选点弹窗
4. 在弹窗搜索框输入地址(如"上海人民广场")选点
   - 预期:location-box 切换为所选地址(如"上海市黄浦区人民大道");切换步骤时位置栏不丢
5. 不选位置,直接走完所有步骤点"开始比对"
   - 预期:toast 提示"请提供有效的位置信息",停在确认页
6. 选好位置后提交
   - 预期:成功后跳到 result 页;数据库 `rescue_events.location_lat/lng/address` 字段记录正确

---

## 7. 下一步

- 用户审 spec
- 通过后:进入 `superpowers:writing-plans` 写实施计划
- 实施完成后:跟测试场景 spec (`2026-07-03-test-scenario-design.md`) 联调,验证 S1/S3/S4 场景中位置信息能正确流转
