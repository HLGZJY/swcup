# 采集页位置选择功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 user 端采集页(`pages/collect/index`)增加位置选择功能,顶部固定 location-box,点击调 `uni.chooseLocation` 选点,GPS 失败时降级引导手动选。

**Architecture:** 单文件改动 `miniapp-user/src/pages/collect/index.vue`,三处(template / script / style),与现有报告页 `pages/report/index.vue` 保持一致。`uni.chooseLocation` 是微信原生 API,后端不动,manifest.json 权限已就绪。

**Tech Stack:** uni-app + Vue 3 + TypeScript + 微信小程序(vitest + @vue/test-utils 测试)

---

## File Structure

**改 1 个文件:**
- `miniapp-user/src/pages/collect/index.vue`
  - template(line ~3 后):加 location-box DOM
  - script(line ~314-425):加 onManualSelectLocation / onLocationIconError,改 getLocation fail 分支
  - style(line ~1133 后末尾):加 location-box / location-icon / location-text / location-tip 样式

**新建 1 个测试文件:**
- `miniapp-user/test/pages/collect-location-selector.spec.ts`
  - 验证 location-box 在所有步骤可见
  - 验证点击 location-box 触发 `uni.chooseLocation`

**不动:**
- `miniapp-user/src/manifest.json`(权限已就绪)
- `miniapp-user/src/pages/report/index.vue`(参考样板,不动)
- 后端任何文件

---

## Tasks

### Task 1: 写失败测试 - location-box 渲染

**Files:**
- Create: `miniapp-user/test/pages/collect-location-selector.spec.ts`

- [ ] **Step 1.1: 创建测试文件,写第一个测试**

新建文件 `miniapp-user/test/pages/collect-location-selector.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CollectPage from '@/pages/collect/index.vue'

// 屏蔽 setup 顶层调用的 uni.getLocation(避免抛错)
;(globalThis as any).uni = {
  getLocation: vi.fn(),
  chooseLocation: vi.fn(),
  showToast: vi.fn(),
  chooseImage: vi.fn(),
  setStorageSync: vi.fn(),
  getStorageSync: vi.fn(() => null),
  redirectTo: vi.fn(),
  navigateTo: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
}

describe('collect 页 location-box', () => {
  it('默认渲染 location-box', () => {
    const wrapper = mount(CollectPage)
    const box = wrapper.find('.location-box')
    expect(box.exists()).toBe(true)
  })

  it('location-box 包含位置文本和提示', () => {
    const wrapper = mount(CollectPage)
    expect(wrapper.find('.location-text').exists()).toBe(true)
    expect(wrapper.find('.location-tip').exists()).toBe(true)
  })

  it('location-text 默认显示定位中', () => {
    const wrapper = mount(CollectPage)
    expect(wrapper.find('.location-text').text()).toBe('定位中...')
  })
})
```

- [ ] **Step 1.2: 跑测试验证失败**

```bash
cd "F:/swcup2026/miniapp-user" && npx vitest run test/pages/collect-location-selector.spec.ts
```

Expected: FAIL,因为 collect 页还没有 `.location-box` 元素,`wrapper.find('.location-box').exists()` 返回 false。

- [ ] **Step 1.3: 提交测试**

```bash
git -C "F:/swcup2026" add miniapp-user/test/pages/collect-location-selector.spec.ts
git -C "F:/swcup2026" commit -m "test(collect): 失败用例 - location-box 渲染"
```

---

### Task 2: 写失败测试 - 点击 location-box 触发 chooseLocation

**Files:**
- Modify: `miniapp-user/test/pages/collect-location-selector.spec.ts`(追加测试)

- [ ] **Step 2.1: 追加测试**

在 `describe('collect 页 location-box', ...)` 块内,`it('location-text 默认显示定位中'...)` 之后追加:

```typescript
  it('点击 location-box 触发 uni.chooseLocation', async () => {
    const wrapper = mount(CollectPage)
    await wrapper.find('.location-box').trigger('click')
    expect((globalThis as any).uni.chooseLocation).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2.2: 跑测试验证失败**

```bash
cd "F:/swcup2026/miniapp-user" && npx vitest run test/pages/collect-location-selector.spec.ts
```

Expected: FAIL,因为 `.location-box` 还没被创建,测试找不到元素 → 抛错(可能 "Cannot read properties of null")。

- [ ] **Step 2.3: 跑测试总数检查(确认前 3 个也仍 fail)**

```bash
cd "F:/swcup2026/miniapp-user" && npx vitest run test/pages/collect-location-selector.spec.ts
```

Expected: 4 个测试全部 fail(前 3 个 + 新加的 1 个),因为还没实施代码。

---

### Task 3: 实施 template - 加 location-box

**Files:**
- Modify: `miniapp-user/src/pages/collect/index.vue`(line 3 后插入)

- [ ] **Step 3.1: 在 `guide-header` 前插入 location-box**

定位到 `miniapp-user/src/pages/collect/index.vue` 第 3 行 `<!-- 顶部品牌区(去掉与微信原生导航栏重复的 title-main) -->`,在它**之前**插入以下代码块:

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

- [ ] **Step 3.2: 验证 template 改动**

```bash
grep -n "location-box" "F:/swcup2026/miniapp-user/src/pages/collect/index.vue" | head -5
```

Expected: 看到刚加的 `class="location-box"`。

---

### Task 4: 实施 script - 加 onManualSelectLocation + onLocationIconError

**Files:**
- Modify: `miniapp-user/src/pages/collect/index.vue`(line 423 `getLocation() 上面` 之后插入新函数)

- [ ] **Step 4.1: 定位插入点**

在 `miniapp-user/src/pages/collect/index.vue` 找到 `getLocation()` 函数(约 405-423 行)结尾的 `}` 闭合花括号,在它**之后**插入新函数。

- [ ] **Step 4.2: 插入 onManualSelectLocation + onLocationIconError 函数**

```typescript

// 手动选择位置(微信原生 chooseLocation,弹窗带搜索栏)
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

// 占位图加载失败时静默忽略
function onLocationIconError() {
  // no-op
}
```

- [ ] **Step 4.3: 跑测试,验证 Task 1 + Task 2 测试通过**

```bash
cd "F:/swcup2026/miniapp-user" && npx vitest run test/pages/collect-location-selector.spec.ts
```

Expected: 4 个测试全部 PASS(location-box 渲染、文本和提示、默认显示"定位中..."、点击触发 chooseLocation)。

- [ ] **Step 4.4: 提交**

```bash
git -C "F:/swcup2026" add miniapp-user/src/pages/collect/index.vue miniapp-user/test/pages/collect-location-selector.spec.ts
git -C "F:/swcup2026" commit -m "feat(collect): 位置选择 - 顶部 location-box + chooseLocation"
```

---

### Task 5: 写失败测试 - GPS 失败降级

**Files:**
- Modify: `miniapp-user/test/pages/collect-location-selector.spec.ts`(追加测试)

- [ ] **Step 5.1: 追加测试**

在 `describe('collect 页 location-box', ...)` 块内,最后一个 `it` 之后追加:

```typescript
  it('GPS 获取失败时 locationText 降级为"未定位,点击选择位置"', async () => {
    ;(globalThis as any).uni.getLocation = vi.fn(({ fail }) => {
      fail && fail({ errMsg: 'getLocation:fail' })
    })
    const wrapper = mount(CollectPage)
    // 等待 micro task 队列清空
    await new Promise((r) => setTimeout(r, 0))
    expect(wrapper.find('.location-text').text()).toBe('未定位,点击选择位置')
  })
```

- [ ] **Step 5.2: 跑测试验证失败**

```bash
cd "F:/swcup2026/miniapp-user" && npx vitest run test/pages/collect-location-selector.spec.ts
```

Expected: 1 个新测试 fail(因为当前 `getLocation` 失败时 locationText 是 "定位失败,请开启位置权限")。

---

### Task 6: 实施 script - 改 getLocation 失败处理

**Files:**
- Modify: `miniapp-user/src/pages/collect/index.vue`(line 413-421)

- [ ] **Step 6.1: 定位现有 fail 分支**

在 `miniapp-user/src/pages/collect/index.vue` 第 413-421 行,找到:

```typescript
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

- [ ] **Step 6.2: 替换为降级处理**

替换成:

```typescript
    fail: (err) => {
      console.error('GPS 获取失败', err)
      // 静默降级:location-box 仍可点击,用户手动选位置
      locationText.value = '未定位,点击选择位置'
    }
```

- [ ] **Step 6.3: 跑测试验证全部通过**

```bash
cd "F:/swcup2026/miniapp-user" && npx vitest run test/pages/collect-location-selector.spec.ts
```

Expected: 5 个测试全部 PASS。

- [ ] **Step 6.4: 提交**

```bash
git -C "F:/swcup2026" add miniapp-user/src/pages/collect/index.vue miniapp-user/test/pages/collect-location-selector.spec.ts
git -C "F:/swcup2026" commit -m "feat(collect): GPS 失败降级 - 引导用户手动选位置"
```

---

### Task 7: 实施 style - 加 location-box 样式

**Files:**
- Modify: `miniapp-user/src/pages/collect/index.vue`(style 块末尾)

- [ ] **Step 7.1: 定位插入点**

在 `miniapp-user/src/pages/collect/index.vue` 的 `</style>` 之前(约 1132 行 `.camera-hint` 样式之后)追加。

- [ ] **Step 7.2: 追加样式**

```scss

/* 顶部位置栏(跟 report 页一致) */
.location-box {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  padding: 24rpx 32rpx;
  margin: 24rpx 24rpx 0;
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

- [ ] **Step 7.3: 跑全部测试确认无回归**

```bash
cd "F:/swcup2026/miniapp-user" && npx vitest run
```

Expected: 全部测试通过(包含原有 components 测试 + 新加的 5 个 collect 测试)。

---

### Task 8: 构建验证

- [ ] **Step 8.1: 跑 mp-weixin 构建**

```bash
cd "F:/swcup2026/miniapp-user" && npm run build:mp-weixin 2>&1 | tail -10
```

Expected: 看到 `DONE Build complete.`,无报错。

- [ ] **Step 8.2: 验证 dist 包含新元素**

```bash
grep -o "location-box" "F:/swcup2026/miniapp-user/dist/build/mp-weixin/pages/collect/index.wxml" | wc -l
grep -o "chooseLocation" "F:/swcup2026/miniapp-user/dist/build/mp-weixin/pages/collect/index.js" | wc -l
```

Expected: 第一个命令输出 `>= 1`(location-box 至少 1 处);第二个输出 `>= 1`(chooseLocation 至少 1 处)。

---

### Task 9: 提交 + 跟测试场景 spec 联调

- [ ] **Step 9.1: 提交 style 改动**

```bash
git -C "F:/swcup2026" add miniapp-user/src/pages/collect/index.vue
git -C "F:/swcup2026" commit -m "style(collect): location-box 白底卡片样式"
```

- [ ] **Step 9.2: 验证测试场景 spec 中位置相关场景可执行**

参考 `docs/superpowers/specs/2026-07-03-test-scenario-design.md`:
- S1 走失上报 - user1 采集,需要选位置 → 现在有 location-box 可用
- S3 同区发现合并 - user2 采集,需要选跟 S1 接近的位置 → 选点时搜同一地址
- S4 跨区发现 - user2 在跨区位置采集 → location-box 选点
- S7 鼻纹匹配 - user3 采集 → location-box 选点

按 spec §6 手动测试 6 步(在 user 端开发者工具里跑一遍),确认 location-box 在所有步骤可见、点击弹 chooseLocation、选点回填正确、提交后数据库 `rescue_events.location_lat/lng/address` 字段记录正确。

- [ ] **Step 9.3: 跑 lint/类型检查(如项目配置)**

```bash
cd "F:/swcup2026/miniapp-user" && cat package.json | grep -E '"(lint|tsc|typecheck)"'
```

Expected: 如果有 `lint` 或 `tsc` script,跑一下确认无错。

---

## 验收 Checklist

- [ ] 5 个 vitest 测试全部通过
- [ ] mp-weixin 构建成功
- [ ] dist 中 location-box 和 chooseLocation 出现
- [ ] 微信开发者工具中 5 步流程各显示 location-box
- [ ] GPS 拒绝时不弹 toast,显示"未定位,点击选择位置"
- [ ] 点击 location-box 弹 `chooseLocation` 选点
- [ ] 选点后 locationText 自动更新为地址
- [ ] 提交时 lat/lng/address 正确入库
