# 多部位颜色特征采集器 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把单点取色器升级为按 7 个动物身体部位采集颜色的多部位颜色特征采集器，后端 BodyColorDto 字段已对齐，无需改动。

**Architecture:** 4 个职责单一的 Vue 3 子组件（Container / PartTabs / PhotoCanvas / SamplePreview）+ 共享类型文件。主页是单一数据源（partColors 字典），子组件 prop down / event up。取色算法 100% 搬迁到 PhotoCanvas，颜色覆盖二次确认由 Container 用 uni.showModal 拦截。

**Tech Stack:** uni-app + Vue 3 + TypeScript + vitest + @vue/test-utils + Canvas API (uni.createSelectorQuery + canvas.getContext('2d'))

**Spec:** [`docs/superpowers/specs/2026-06-26-multi-part-color-picker-design.md`](../specs/2026-06-26-multi-part-color-picker-design.md)

**测试运行：** 用户偏好 —— "不要 git commit 除非明确指示"。本计划所有 commit 步骤标记 `⏸ 待确认`，需用户口头确认才执行。

---

## 阶段总览

| 阶段 | 范围 | Task |
|-----|------|------|
| 1 | 测试基建 | 1 |
| 2 | 共享类型 + SamplePreview | 2-3 |
| 3 | PhotoCanvas（取色算法） | 4-5 |
| 4 | PartTabs（含覆盖入口） | 6 |
| 5 | ColorPicker 容器 | 7-8 |
| 6 | 主页集成 | 9-10 |
| 7 | step 4 确认页 | 11 |
| 8 | E2E + 文档 | 12-13 |

---

## Phase 1: 测试基建

### Task 1: 添加 vitest + @vue/test-utils 到 miniapp-user

**Files:**
- Modify: `miniapp-user/package.json`
- Create: `miniapp-user/vitest.config.ts`
- Create: `miniapp-user/test/setup.ts`

- [ ] **Step 1: 安装依赖**

```bash
cd F:/swcup2026/miniapp-user
npm install --save-dev vitest@^1.6.0 @vue/test-utils@^2.4.6 @vitest/coverage-v8@^1.6.0 jsdom@^24.0.0
```

Expected: 安装成功，package.json devDependencies 增加 4 项。

- [ ] **Step 2: 添加 test 脚本到 package.json**

修改 `miniapp-user/package.json` 的 `scripts` 段，在最后追加：

```json
"test": "vitest run",
"test:watch": "vitest",
"test:cov": "vitest run --coverage"
```

- [ ] **Step 3: 创建 vitest.config.ts**

写入 `miniapp-user/vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

- [ ] **Step 4: 安装 @vitejs/plugin-vue**

```bash
npm install --save-dev @vitejs/plugin-vue@^5.0.4
```

- [ ] **Step 5: 创建测试 setup 文件**

写入 `miniapp-user/test/setup.ts`：

```ts
// 静默 uni 全局，避免测试环境报警告
;(globalThis as any).uni = {
  showToast: () => {},
  showModal: () => {},
  getImageInfo: () => {},
  createSelectorQuery: () => ({ select: () => ({ fields: () => ({ exec: () => {} }), boundingClientRect: () => ({ exec: () => {} }) }), exec: () => {} }),
}
```

- [ ] **Step 6: 验证空测试通过**

创建 `miniapp-user/test/sanity.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'

describe('测试基建', () => {
  it('vitest 工作正常', () => {
    expect(1 + 1).toBe(2)
  })
})
```

运行：

```bash
cd F:/swcup2026/miniapp-user && npm test
```

Expected: PASS，1 test passed。

- [ ] **Step 7: 删除 sanity 测试文件**

```bash
rm F:/swcup2026/miniapp-user/test/sanity.spec.ts
```

- [ ] **Step 8: 提交 ⏸ 待确认**

```bash
git add miniapp-user/package.json miniapp-user/package-lock.json miniapp-user/vitest.config.ts miniapp-user/test/setup.ts
git commit -m "test(miniapp-user): 添加 vitest + @vue/test-utils 测试基建"
```

---

## Phase 2: 共享类型 + SamplePreview

### Task 2: 创建共享类型 color-picker.ts

**Files:**
- Create: `miniapp-user/src/components/color-picker/color-picker.ts`

- [ ] **Step 1: 创建类型文件**

写入 `miniapp-user/src/components/color-picker/color-picker.ts`：

```ts
/**
 * 部位 key —— 必须与后端 BodyColorDto @Matches 正则保持一致
 * 后端: backend/src/animals/dto/create-animal.dto.ts BodyColorDto.part
 */
export type PartKey = 'back' | 'belly' | 'head' | 'chest' | 'tail' | 'legs' | 'face'

/**
 * 部位中文标签
 */
export const BODY_PARTS: ReadonlyArray<{ key: PartKey; label: string }> = [
  { key: 'back', label: '背脊' },
  { key: 'belly', label: '腹部' },
  { key: 'head', label: '头部' },
  { key: 'chest', label: '胸部' },
  { key: 'tail', label: '尾巴' },
  { key: 'legs', label: '四肢' },
  { key: 'face', label: '面部' },
] as const

/**
 * 单部位采到的颜色（含 5 采样点信息，供事后追溯）
 */
export interface PartColor {
  hex: string          // 平均 HEX
  label: string        // matchNearestColor 结果
  samples: string[]    // 5 个采样点 HEX
  touchX: number       // 屏幕坐标（picker 内坐标系）
  touchY: number
}

/**
 * 已选部位字典（7 个 key 都存在，未采为 null）
 */
export type PartColorsMap = Record<PartKey, PartColor | null>
```

- [ ] **Step 2: 类型检查通过**

```bash
cd F:/swcup2026/miniapp-user && npx vue-tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 3: 提交 ⏸ 待确认**

```bash
git add miniapp-user/src/components/color-picker/color-picker.ts
git commit -m "feat(color-picker): 抽离共享类型 PartKey/PartColor/BODY_PARTS"
```

---

### Task 3: 创建 SamplePreview 组件

**Files:**
- Create: `miniapp-user/src/components/color-picker/sample-preview.vue`
- Create: `miniapp-user/test/components/color-picker/sample-preview.spec.ts`

- [ ] **Step 1: 写失败测试**

写入 `miniapp-user/test/components/color-picker/sample-preview.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SamplePreview from '@/components/color-picker/sample-preview.vue'

describe('SamplePreview', () => {
  it('hex 为空时显示占位 #------', () => {
    const wrapper = mount(SamplePreview, {
      props: { hex: '', label: '', samples: [] },
    })
    expect(wrapper.text()).toContain('#------')
  })

  it('hex 有值时显示该 HEX', () => {
    const wrapper = mount(SamplePreview, {
      props: { hex: '#8B5A3C', label: '棕色', samples: ['#8B5A3C'] },
    })
    expect(wrapper.text()).toContain('#8B5A3C')
    expect(wrapper.text()).toContain('棕色')
  })

  it('label 为空时显示提示文字', () => {
    const wrapper = mount(SamplePreview, {
      props: { hex: '', label: '', samples: [] },
    })
    expect(wrapper.text()).toContain('点击照片选位置')
  })

  it('samples 为空时不渲染采样点区块', () => {
    const wrapper = mount(SamplePreview, {
      props: { hex: '', label: '', samples: [] },
    })
    expect(wrapper.find('.samples-row').exists()).toBe(false)
  })

  it('samples 非空时渲染 5 个采样点', () => {
    const wrapper = mount(SamplePreview, {
      props: {
        hex: '#8B5A3C',
        label: '棕色',
        samples: ['#8B5A3C', '#8B5A3C', '#8B5A3C', '#8B5A3C', '#8B5A3C'],
      },
    })
    const dots = wrapper.findAll('.sample-dot')
    expect(dots.length).toBe(5)
  })

  it('色卡预览的 background 等于 hex', () => {
    const wrapper = mount(SamplePreview, {
      props: { hex: '#8B5A3C', label: '棕色', samples: [] },
    })
    const preview = wrapper.find('.picker-color-preview')
    expect(preview.attributes('style')).toContain('#8B5A3C')
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
cd F:/swcup2026/miniapp-user && npm test -- sample-preview
```

Expected: FAIL — `Failed to resolve import` 或 component not found（因为还没创建）。

- [ ] **Step 3: 创建组件**

写入 `miniapp-user/src/components/color-picker/sample-preview.vue`：

```vue
<template>
  <view class="sample-preview">
    <view class="picker-color-preview" :style="{ background: hex || undefined }">
      <view v-if="!hex" class="picker-color-placeholder">
        <text>?</text>
      </view>
    </view>
    <view class="picker-color-meta">
      <text class="picker-hex">{{ hex || '#------' }}</text>
      <text class="picker-label">{{ label || '点击照片选位置' }}</text>
    </view>

    <view v-if="samples.length > 0" class="picker-samples">
      <text class="samples-title">采样点（{{ samples.length }}/5）</text>
      <view class="samples-row">
        <view
          v-for="(s, i) in samples"
          :key="i"
          class="sample-dot"
          :style="{ background: s }"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  hex: string
  label: string
  samples: string[]
}>()
</script>

<style scoped lang="scss">
.sample-preview {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx;
  background: #F9FAFB;
  border-radius: 16rpx;
}

.picker-color-preview {
  width: 80rpx;
  height: 80rpx;
  border-radius: 16rpx;
  border: 2rpx solid #E5E7EB;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.picker-color-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999999;
  font-size: 36rpx;
  font-weight: 700;
  background: #F3F4F6;
  border-radius: 14rpx;
}

.picker-color-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.picker-hex {
  font-size: 28rpx;
  font-weight: 700;
  color: #1A1A1A;
  font-family: 'Courier New', monospace;
  font-variant-numeric: tabular-nums;
}

.picker-label {
  font-size: 24rpx;
  color: #6B7280;
}

.picker-samples {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  width: 100%;
  margin-top: 8rpx;
}

.samples-title {
  font-size: 22rpx;
  color: #6B7280;
}

.samples-row {
  display: flex;
  flex-direction: row;
  gap: 8rpx;
}

.sample-dot {
  width: 40rpx;
  height: 40rpx;
  border-radius: 8rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.1);
}
</style>
```

- [ ] **Step 4: 运行测试，验证通过**

```bash
cd F:/swcup2026/miniapp-user && npm test -- sample-preview
```

Expected: PASS，6 tests passed。

- [ ] **Step 5: 提交 ⏸ 待确认**

```bash
git add miniapp-user/src/components/color-picker/sample-preview.vue miniapp-user/test/components/color-picker/sample-preview.spec.ts
git commit -m "feat(color-picker): 抽离 SamplePreview 纯展示组件"
```

---

## Phase 3: PhotoCanvas（取色算法）

### Task 4: 抽离 matchNearestColor 到 PhotoCanvas + 单测

**Files:**
- Create: `miniapp-user/src/components/color-picker/photo-canvas.vue`（先只放 matchNearestColor + 单元可测部分）
- Create: `miniapp-user/test/components/color-picker/photo-canvas.spec.ts`

- [ ] **Step 1: 写失败测试（matchNearestColor 9 用例）**

写入 `miniapp-user/test/components/color-picker/photo-canvas.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { matchNearestColor } from '@/components/color-picker/photo-canvas.vue'

describe('matchNearestColor', () => {
  it('纯黑 (#1A1A1A) → 黑色', () => {
    expect(matchNearestColor('#1A1A1A')).toBe('黑色')
  })

  it('纯白 (#FFFFFF) → 白色', () => {
    expect(matchNearestColor('#FFFFFF')).toBe('白色')
  })

  it('深灰 (#555555) → 深灰', () => {
    expect(matchNearestColor('#555555')).toBe('深灰')
  })

  it('灰 (#888888) → 灰色', () => {
    expect(matchNearestColor('#888888')).toBe('灰色')
  })

  it('浅灰 (#BBBBBB) → 浅灰', () => {
    expect(matchNearestColor('#BBBBBB')).toBe('浅灰')
  })

  it('黄 (#D4A857) → 黄色', () => {
    expect(matchNearestColor('#D4A857')).toBe('黄色')
  })

  it('橘 (#FF8C42) → 橘色', () => {
    expect(matchNearestColor('#FF8C42')).toBe('橘色')
  })

  it('棕 (#8B5A3C) → 棕色', () => {
    expect(matchNearestColor('#8B5A3C')).toBe('棕色')
  })

  it('纯绿 (#00FF00) → 其他', () => {
    expect(matchNearestColor('#00FF00')).toBe('其他')
  })

  it('米色 (#F5E6D3) → 白色（边界，固定即可）', () => {
    // 米色 R=245, G=230, B=211 全 > 230? 不，R=245 > 230 但 G=230 == 230
    // 严格不等 → 不满足白色 → 进入灰判断 abs(r-g)=15, abs(g-b)=19, 不满足灰色
    // 不满足黄/橘/棕 → 其他
    expect(matchNearestColor('#F5E6D3')).toBe('其他')
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
cd F:/swcup2026/miniapp-user && npm test -- photo-canvas
```

Expected: FAIL — module not found。

- [ ] **Step 3: 创建 photo-canvas.vue（先放 matchNearestColor + 注释占位）**

写入 `miniapp-user/src/components/color-picker/photo-canvas.vue`：

```vue
<template>
  <!-- 完整 template 在 Task 5 -->
  <view class="photo-canvas-placeholder" />
</template>

<script setup lang="ts">
/**
 * PhotoCanvas —— 照片展示 + 取色算法
 *
 * 取色逻辑（从原 color-picker.vue 100% 搬迁）：
 * 1. 监听 photoUrl 变化 → 通过 uni.createSelectorQuery 取图像尺寸
 * 2. 用户 tap → 转图像坐标 → 5 采样点 (中心 + 上下左右 8px)
 * 3. canvas.getImageData 取每点 3x3 region 平均 RGB
 * 4. 5 点平均 → hex
 * 5. matchNearestColor(hex) → label
 *
 * cursor 跨照片保留：内部 cursorsByPhoto Map 记录每张照片最后位置
 */
defineProps<{
  photoUrl: string
}>()

defineEmits<{
  (e: 'sample', payload: {
    hex: string
    label: string
    samples: string[]
    touchX: number
    touchY: number
  }): void
  (e: 'image-error', msg: string): void
}>()

/**
 * 根据 HEX 颜色匹配最近的预设颜色标签
 * 9 类：黑色 / 白色 / 深灰 / 灰色 / 浅灰 / 黄色 / 橘色 / 棕色 / 其他
 *
 * 从原 color-picker.vue 完整版搬运（2026-06-26 抽离）
 */
export function matchNearestColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  if (r < 30 && g < 30 && b < 30) return '黑色'
  if (r > 230 && g > 230 && b > 230) return '白色'
  if (Math.abs(r - g) < 15 && Math.abs(g - b) < 15) {
    if (r < 90) return '深灰'
    if (r < 180) return '灰色'
    return '浅灰'
  }

  if (r > 180 && g > 100 && g < 200 && b < 100) return '黄色'
  if (r > 200 && g > 100 && g < 160 && b < 80) return '橘色'
  if (r > 100 && r < 180 && g > 60 && g < 130 && b > 30 && b < 100) return '棕色'
  return '其他'
}
</script>

<style scoped lang="scss">
.photo-canvas-placeholder {
  display: none;
}
</style>
```

- [ ] **Step 4: 运行测试，验证通过**

```bash
cd F:/swcup2026/miniapp-user && npm test -- photo-canvas
```

Expected: PASS，10 tests passed。

- [ ] **Step 5: 提交 ⏸ 待确认**

```bash
git add miniapp-user/src/components/color-picker/photo-canvas.vue miniapp-user/test/components/color-picker/photo-canvas.spec.ts
git commit -m "feat(color-picker): 抽离 PhotoCanvas 含 matchNearestColor 算法"
```

---

### Task 5: 补全 PhotoCanvas 的取色交互逻辑

**Files:**
- Modify: `miniapp-user/src/components/color-picker/photo-canvas.vue`

> **重要**：本任务不写新测试，因为取色算法涉及 uni Canvas runtime（canvas.getImageData + uni.createSelectorQuery），E2E 在微信开发者工具跑（见 Task 12）。组件内部仍按算法原样搬迁，matchNearestColor 已在 Task 4 单测。

- [ ] **Step 1: 替换 photo-canvas.vue 为完整实现**

完整写入 `miniapp-user/src/components/color-picker/photo-canvas.vue`：

```vue
<template>
  <view class="photo-canvas-wrap" @tap="onPhotoTap">
    <image
      v-if="photoUrl"
      class="photo-canvas-img"
      :src="photoUrl"
      mode="aspectFit"
      @load="onImageLoad"
      @error="onImageError"
    />
    <view v-else class="photo-canvas-empty">
      <text>请先选择照片</text>
    </view>

    <view
      v-if="photoUrl && currentCursor"
      class="photo-canvas-cursor"
      :style="{ left: currentCursor.x + 'px', top: currentCursor.y + 'px' }"
    >
      <view class="cursor-h" />
      <view class="cursor-v" />
      <view class="cursor-ring" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = defineProps<{
  photoUrl: string
}>()

const emit = defineEmits<{
  (e: 'sample', payload: {
    hex: string
    label: string
    samples: string[]
    touchX: number
    touchY: number
  }): void
  (e: 'image-error', msg: string): void
}>()

// 图像信息（从 uni.getImageInfo / @load event 取）
const imageInfo = ref({ width: 0, height: 0 })
// 屏幕显示尺寸（uni.createSelectorQuery 取）
const displaySize = ref({ width: 0, height: 0 })
// 图像在容器内的偏移（screen - wrap）
const imageOffset = ref({ x: 0, y: 0 })

// cursor 跨照片保留 Map
const cursorsByPhoto = ref<Map<string, { x: number; y: number }>>(new Map())

// 当前照片的 cursor
const currentCursor = computed(() => cursorsByPhoto.value.get(props.photoUrl) || null)

// photoUrl 变化时重新测图像尺寸 + 还原 cursor
watch(() => props.photoUrl, (newUrl, oldUrl) => {
  // 重置图像信息，让 onImageLoad 重新填充
  imageInfo.value = { width: 0, height: 0 }
  displaySize.value = { width: 0, height: 0 }
  imageOffset.value = { x: 0, y: 0 }
  // cursor 由 computed 自动从 Map 取，无需手动恢复
})

function onImageLoad(e: any) {
  uni.getImageInfo({
    src: props.photoUrl,
    success: (imgInfo) => {
      imageInfo.value = { width: imgInfo.width, height: imgInfo.height }
      measureDisplaySize()
    },
    fail: () => {
      imageInfo.value = { width: e.detail.width, height: e.detail.height }
      measureDisplaySize()
    },
  })
}

function onImageError(e: any) {
  console.error('[PhotoCanvas] 图片加载失败', e)
  emit('image-error', '图片加载失败')
}

function measureDisplaySize() {
  setTimeout(() => {
    const query = uni.createSelectorQuery()
    query.select('.photo-canvas-img').boundingClientRect()
    query.select('.photo-canvas-wrap').boundingClientRect()
    query.exec((res) => {
      if (!res || !res[0] || !res[1]) return
      const wrap = res[1]
      const img = res[0]
      displaySize.value = { width: img.width, height: img.height }
      imageOffset.value = { x: img.left - wrap.left, y: img.top - wrap.top }
    })
  }, 100)
}

function onPhotoTap(e: any) {
  let x: number | undefined, y: number | undefined

  if (e.detail && typeof e.detail.x === 'number') {
    x = e.detail.x
    y = e.detail.y
  } else if (e.touches && e.touches[0]) {
    x = e.touches[0].x
    y = e.touches[0].y
  } else if (e.changedTouches && e.changedTouches[0]) {
    x = e.changedTouches[0].x
    y = e.changedTouches[0].y
  }

  if (typeof x !== 'number' || typeof y !== 'number') return

  pickColorAt(x, y)
}

async function pickColorAt(touchX: number, touchY: number) {
  const off = imageOffset.value
  const disp = displaySize.value
  const img = imageInfo.value

  const xInImage = touchX - off.x
  const yInImage = touchY - off.y

  if (xInImage < 0 || yInImage < 0 || xInImage > disp.width || yInImage > disp.height) {
    return
  }

  // 保存 cursor 到 Map（跨照片保留）
  cursorsByPhoto.value.set(props.photoUrl, { x: touchX, y: touchY })
  // 触发响应式更新
  cursorsByPhoto.value = new Map(cursorsByPhoto.value)

  if (!img.width || !disp.width) return

  const ratioX = img.width / disp.width
  const ratioY = img.height / disp.height
  const centerSrcX = Math.floor(xInImage * ratioX)
  const centerSrcY = Math.floor(yInImage * ratioY)

  const offsets = [
    { dx: 0, dy: 0 },
    { dx: -8, dy: 0 },
    { dx: 8, dy: 0 },
    { dx: 0, dy: -8 },
    { dx: 0, dy: 8 },
  ]
  const samplePoints = offsets.map((o) => ({
    x: centerSrcX + o.dx,
    y: centerSrcY + o.dy,
  }))

  await readColorFromPhoto(samplePoints, touchX, touchY)
}

async function readColorFromPhoto(
  samplePoints: Array<{ x: number; y: number }>,
  touchX: number,
  touchY: number
) {
  const query = uni.createSelectorQuery()
  query.select('#colorCanvas').fields({ node: true }).exec((canvasRes) => {
    if (!canvasRes || !canvasRes[0]) {
      emit('image-error', '取色功能不可用')
      return
    }
    const canvas: any = canvasRes[0].node
    const ctx = canvas.getContext('2d')
    const img = canvas.createImage()
    img.onload = () => {
      try {
        const imgW = Math.max(1, Math.floor(Number(img.width) || 0))
        const imgH = Math.max(1, Math.floor(Number(img.height) || 0))

        canvas.width = imgW
        canvas.height = imgH
        ctx.clearRect(0, 0, imgW, imgH)
        ctx.drawImage(img, 0, 0)

        const region = 3
        const allR: number[] = []
        const allG: number[] = []
        const allB: number[] = []
        const samples: Array<{ hex: string; ratio: number }> = []

        for (const pt of samplePoints) {
          const cx = Math.max(0, Math.min(Math.floor(pt.x), imgW - 1))
          const cy = Math.max(0, Math.min(Math.floor(pt.y), imgH - 1))
          const sx = Math.max(0, Math.min(cx - Math.floor(region / 2), imgW - region))
          const sy = Math.max(0, Math.min(cy - Math.floor(region / 2), imgH - region))

          let data: Uint8ClampedArray
          try {
            data = ctx.getImageData(sx, sy, region, region).data
          } catch (e: any) {
            console.error('[PhotoCanvas] getImageData 失败', sx, sy, region, e?.message)
            continue
          }

          let r = 0, g = 0, b = 0
          const pixels = data.length / 4
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
          }
          r = Math.round(r / pixels)
          g = Math.round(g / pixels)
          b = Math.round(b / pixels)
          allR.push(r); allG.push(g); allB.push(b)

          const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`
          samples.push({ hex, ratio: pixels })
        }

        if (allR.length === 0) {
          emit('image-error', '取色失败：采样点全失败')
          return
        }

        let avgR = 0, avgG = 0, avgB = 0
        for (let i = 0; i < allR.length; i++) {
          avgR += allR[i]
          avgG += allG[i]
          avgB += allB[i]
        }
        avgR = Math.round(avgR / allR.length)
        avgG = Math.round(avgG / allG.length)
        avgB = Math.round(avgB / allB.length)

        const hex = `#${[avgR, avgG, avgB].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`
        const label = matchNearestColor(hex)

        emit('sample', {
          hex,
          label,
          samples: samples.map((s) => s.hex),
          touchX,
          touchY,
        })
      } catch (e: any) {
        console.error('[PhotoCanvas] 异常:', e)
        emit('image-error', `取色失败：${e?.message || '未知'}`)
      }
    }
    img.onerror = (e: any) => {
      console.error('[PhotoCanvas] 图片解码失败', e)
      emit('image-error', '图片解码失败')
    }
    img.src = props.photoUrl
  })
}

// 导出供 Task 4 单测使用
export { matchNearestColor }

function matchNearestColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  if (r < 30 && g < 30 && b < 30) return '黑色'
  if (r > 230 && g > 230 && b > 230) return '白色'
  if (Math.abs(r - g) < 15 && Math.abs(g - b) < 15) {
    if (r < 90) return '深灰'
    if (r < 180) return '灰色'
    return '浅灰'
  }

  if (r > 180 && g > 100 && g < 200 && b < 100) return '黄色'
  if (r > 200 && g > 100 && g < 160 && b < 80) return '橘色'
  if (r > 100 && r < 180 && g > 60 && g < 130 && b > 30 && b < 100) return '棕色'
  return '其他'
}
</script>

<style scoped lang="scss">
.photo-canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 360rpx;
  background: #1A1A1A;
  border-radius: 16rpx;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-canvas-img {
  width: 100%;
  height: 100%;
}

.photo-canvas-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999999;
  font-size: 28rpx;
  padding: 80rpx 32rpx;
}

.photo-canvas-cursor {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 10;
}

.cursor-h {
  position: absolute;
  left: -16rpx;
  top: -1rpx;
  width: 32rpx;
  height: 2rpx;
  background: #FFFFFF;
  box-shadow: 0 0 4rpx rgba(0, 0, 0, 0.8);
}

.cursor-v {
  position: absolute;
  left: -1rpx;
  top: -16rpx;
  width: 2rpx;
  height: 32rpx;
  background: #FFFFFF;
  box-shadow: 0 0 4rpx rgba(0, 0, 0, 0.8);
}

.cursor-ring {
  position: absolute;
  left: -14rpx;
  top: -14rpx;
  width: 28rpx;
  height: 28rpx;
  border: 2rpx solid #FFFFFF;
  border-radius: 50%;
  box-shadow: 0 0 8rpx rgba(0, 0, 0, 0.8), inset 0 0 4rpx rgba(0, 0, 0, 0.3);
}
</style>
```

- [ ] **Step 2: 验证 matchNearestColor 单测仍通过**

```bash
cd F:/swcup2026/miniapp-user && npm test -- photo-canvas
```

Expected: PASS，10 tests passed（matchNearestColor 9 用例 + 1 米色边界）。

- [ ] **Step 3: 类型检查通过**

```bash
cd F:/swcup2026/miniapp-user && npx vue-tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 4: 提交 ⏸ 待确认**

```bash
git add miniapp-user/src/components/color-picker/photo-canvas.vue
git commit -m "feat(color-picker): 补全 PhotoCanvas 取色交互 + cursorsByPhoto 跨照片保留"
```

---

## Phase 4: PartTabs（含覆盖入口）

### Task 6: 创建 PartTabs 组件

**Files:**
- Create: `miniapp-user/src/components/color-picker/part-tabs.vue`
- Create: `miniapp-user/test/components/color-picker/part-tabs.spec.ts`

- [ ] **Step 1: 写失败测试**

写入 `miniapp-user/test/components/color-picker/part-tabs.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PartTabs from '@/components/color-picker/part-tabs.vue'
import { BODY_PARTS } from '@/components/color-picker/color-picker'
import type { PartColorsMap } from '@/components/color-picker/color-picker'

function emptyMap(): PartColorsMap {
  return { back: null, belly: null, head: null, chest: null, tail: null, legs: null, face: null }
}

describe('PartTabs', () => {
  it('默认渲染 7 个部位标签', () => {
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'back',
        partColors: emptyMap(),
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    expect(tabs.length).toBe(7)
    for (const part of BODY_PARTS) {
      expect(wrapper.text()).toContain(part.label)
    }
  })

  it('activePart 标签带 active class', () => {
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'belly',
        partColors: emptyMap(),
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    const activeTab = tabs.find((t) => t.classes().includes('active'))
    expect(activeTab).toBeTruthy()
    expect(activeTab?.text()).toContain('腹部')
  })

  it('已采部位标签带 picked class', () => {
    const colors = emptyMap()
    colors.back = { hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'head',
        partColors: colors,
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    const pickedTab = tabs.find((t) => t.classes().includes('picked'))
    expect(pickedTab).toBeTruthy()
    expect(pickedTab?.text()).toContain('背脊')
  })

  it('未采部位无 picked 标记', () => {
    const colors = emptyMap()
    colors.back = { hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'back',
        partColors: colors,
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    const headTab = tabs.find((t) => t.text().includes('头部'))
    expect(headTab?.classes()).not.toContain('picked')
  })

  it('点击标签 emit update:active-part', async () => {
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'back',
        partColors: emptyMap(),
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    const tailTab = tabs.find((t) => t.text().includes('尾巴'))!
    await tailTab.trigger('click')
    expect(wrapper.emitted('update:active-part')).toBeTruthy()
    expect(wrapper.emitted('update:active-part')![0]).toEqual(['tail'])
  })

  it('已采部位点击时也 emit（覆盖 modal 由容器拦截）', async () => {
    const colors = emptyMap()
    colors.back = { hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }
    const wrapper = mount(PartTabs, {
      props: {
        parts: BODY_PARTS,
        activePart: 'head',
        partColors: colors,
      },
    })
    const tabs = wrapper.findAll('.part-tab')
    const backTab = tabs.find((t) => t.text().includes('背脊'))!
    await backTab.trigger('click')
    expect(wrapper.emitted('update:active-part')).toBeTruthy()
    expect(wrapper.emitted('update:active-part')![0]).toEqual(['back'])
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
cd F:/swcup2026/miniapp-user && npm test -- part-tabs
```

Expected: FAIL — module not found。

- [ ] **Step 3: 创建组件**

写入 `miniapp-user/src/components/color-picker/part-tabs.vue`：

```vue
<template>
  <view class="part-tabs">
    <view
      v-for="part in parts"
      :key="part.key"
      :class="[
        'part-tab',
        { active: part.key === activePart, picked: partColors[part.key] !== null }
      ]"
      @click="onTabClick(part.key)"
    >
      <text class="part-tab-label">{{ part.label }}</text>
      <view
        v-if="partColors[part.key] !== null"
        class="part-tab-swatch"
        :style="{ background: partColors[part.key]!.hex }"
      />
      <view v-if="partColors[part.key] !== null" class="part-tab-check">✓</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { PartKey, PartColorsMap } from './color-picker'

const props = defineProps<{
  parts: ReadonlyArray<{ key: PartKey; label: string }>
  activePart: PartKey
  partColors: PartColorsMap
}>()

const emit = defineEmits<{
  (e: 'update:active-part', v: PartKey): void
}>()

/**
 * 点击标签只 emit 请求，覆盖确认由 ColorPicker 容器拦截
 * （不在 PartTabs 内做 modal，保持组件单一职责）
 */
function onTabClick(key: PartKey) {
  emit('update:active-part', key)
}
</script>

<style scoped lang="scss">
.part-tabs {
  display: flex;
  flex-direction: row;
  gap: 12rpx;
  overflow-x: auto;
  padding: 8rpx 0;
  flex-wrap: nowrap;
}

.part-tab {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.2);
  border-radius: 32rpx;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 26rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8rpx;
  position: relative;
  transition: all 0.2s;
}

.part-tab.active {
  background: #0FBF9F;
  border-color: #0FBF9F;
  color: #FFFFFF;
  font-weight: 700;
}

.part-tab.picked {
  border-color: #0FBF9F;
  background: rgba(15, 191, 159, 0.15);
  color: #0FBF9F;
}

.part-tab-label {
  font-size: 26rpx;
}

.part-tab-swatch {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  border: 2rpx solid #FFFFFF;
}

.part-tab-check {
  position: absolute;
  top: -6rpx;
  right: -6rpx;
  width: 24rpx;
  height: 24rpx;
  background: #0FBF9F;
  border-radius: 50%;
  color: #FFFFFF;
  font-size: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
</style>
```

- [ ] **Step 4: 运行测试，验证通过**

```bash
cd F:/swcup2026/miniapp-user && npm test -- part-tabs
```

Expected: PASS，6 tests passed。

- [ ] **Step 5: 提交 ⏸ 待确认**

```bash
git add miniapp-user/src/components/color-picker/part-tabs.vue miniapp-user/test/components/color-picker/part-tabs.spec.ts
git commit -m "feat(color-picker): 抽离 PartTabs 部位标签组件"
```

---

## Phase 5: ColorPicker 容器

### Task 7: 创建 ColorPicker 容器（不含 step 4）

**Files:**
- Modify: `miniapp-user/src/components/color-picker/color-picker.vue`（完全重写）
- Create: `miniapp-user/test/components/color-picker/color-picker.spec.ts`

- [ ] **Step 1: 写失败测试**

写入 `miniapp-user/test/components/color-picker/color-picker.spec.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorPicker from '@/components/color-picker/color-picker.vue'
import type { PartColorsMap } from '@/components/color-picker/color-picker'

function emptyMap(): PartColorsMap {
  return { back: null, belly: null, head: null, chest: null, tail: null, legs: null, face: null }
}

describe('ColorPicker 容器', () => {
  beforeEach(() => {
    ;(globalThis as any).uni.showModal = vi.fn(({ success }: any) => {
      success({ confirm: true })
    })
  })

  it('show=false 不渲染弹窗', () => {
    const wrapper = mount(ColorPicker, {
      props: {
        show: false,
        photos: [],
        partColors: emptyMap(),
        activePart: 'back',
      },
    })
    expect(wrapper.find('.color-picker-modal').exists()).toBe(false)
  })

  it('show=true 渲染弹窗', () => {
    const wrapper = mount(ColorPicker, {
      props: {
        show: true,
        photos: ['photo1.jpg'],
        partColors: emptyMap(),
        activePart: 'back',
      },
    })
    expect(wrapper.find('.color-picker-modal').exists()).toBe(true)
  })

  it('photos 为空时显示空态', () => {
    const wrapper = mount(ColorPicker, {
      props: {
        show: true,
        photos: [],
        partColors: emptyMap(),
        activePart: 'back',
      },
    })
    expect(wrapper.text()).toContain('第 2 步还没有照片')
  })

  it('minParts=5 时 <5 完成按钮 disabled', () => {
    const colors = emptyMap()
    colors.back = { hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }
    colors.belly = { hex: '#F5E6D3', label: '其他', samples: [], touchX: 0, touchY: 0 }
    const wrapper = mount(ColorPicker, {
      props: {
        show: true,
        photos: ['p1.jpg'],
        partColors: colors,
        activePart: 'back',
        minParts: 5,
      },
    })
    const confirmBtn = wrapper.find('.btn-confirm')
    expect(confirmBtn.classes()).toContain('disabled')
  })

  it('minParts=5 时 >=5 完成按钮激活', () => {
    const colors = emptyMap()
    colors.back = { hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }
    colors.belly = { hex: '#F5E6D3', label: '其他', samples: [], touchX: 0, touchY: 0 }
    colors.head = { hex: '#1A1A1A', label: '黑色', samples: [], touchX: 0, touchY: 0 }
    colors.chest = { hex: '#FF8C42', label: '橘色', samples: [], touchX: 0, touchY: 0 }
    colors.tail = { hex: '#D4A857', label: '黄色', samples: [], touchX: 0, touchY: 0 }
    const wrapper = mount(ColorPicker, {
      props: {
        show: true,
        photos: ['p1.jpg'],
        partColors: colors,
        activePart: 'back',
        minParts: 5,
      },
    })
    const confirmBtn = wrapper.find('.btn-confirm')
    expect(confirmBtn.classes()).not.toContain('disabled')
  })

  it('PhotoCanvas emit sample → ColorPicker emit pick({partKey, color})', async () => {
    const wrapper = mount(ColorPicker, {
      props: {
        show: true,
        photos: ['p1.jpg'],
        partColors: emptyMap(),
        activePart: 'back',
        minParts: 5,
      },
    })
    // 找到 PhotoCanvas 并 emit sample
    const photoCanvas = wrapper.findComponent({ name: 'PhotoCanvas' })
    await photoCanvas.vm.$emit('sample', {
      hex: '#8B5A3C',
      label: '棕色',
      samples: ['#8B5A3C', '#8B5A3C', '#8B5A3C', '#8B5A3C', '#8B5A3C'],
      touchX: 100,
      touchY: 100,
    })
    expect(wrapper.emitted('pick')).toBeTruthy()
    expect(wrapper.emitted('pick')![0]).toEqual([
      {
        partKey: 'back',
        color: {
          hex: '#8B5A3C',
          label: '棕色',
          samples: ['#8B5A3C', '#8B5A3C', '#8B5A3C', '#8B5A3C', '#8B5A3C'],
          touchX: 100,
          touchY: 100,
        },
      },
    ])
  })

  it('点已采部位 → 弹 modal 确认 → 确认后 emit update:active-part', async () => {
    const colors = emptyMap()
    colors.back = { hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }
    const wrapper = mount(ColorPicker, {
      props: {
        show: true,
        photos: ['p1.jpg'],
        partColors: colors,
        activePart: 'head',
        minParts: 5,
      },
    })
    const partTabs = wrapper.findComponent({ name: 'PartTabs' })
    await partTabs.vm.$emit('update:active-part', 'back')
    // modal 被调用 → 确认 → emit update:active-part 给主页
    expect(globalThis.uni.showModal).toHaveBeenCalled()
    expect(wrapper.emitted('update:active-part')).toBeTruthy()
    expect(wrapper.emitted('update:active-part')![0]).toEqual(['back'])
  })

  it('点已采部位 → 弹 modal 取消 → 不 emit update:active-part', async () => {
    ;(globalThis as any).uni.showModal = vi.fn(({ success }: any) => {
      success({ confirm: false })
    })
    const colors = emptyMap()
    colors.back = { hex: '#8B5A3C', label: '棕色', samples: [], touchX: 0, touchY: 0 }
    const wrapper = mount(ColorPicker, {
      props: {
        show: true,
        photos: ['p1.jpg'],
        partColors: colors,
        activePart: 'head',
        minParts: 5,
      },
    })
    const partTabs = wrapper.findComponent({ name: 'PartTabs' })
    await partTabs.vm.$emit('update:active-part', 'back')
    expect(wrapper.emitted('update:active-part')).toBeFalsy()
  })

  it('点未采部位 → 不弹 modal → 直接 emit update:active-part', async () => {
    const wrapper = mount(ColorPicker, {
      props: {
        show: true,
        photos: ['p1.jpg'],
        partColors: emptyMap(),
        activePart: 'head',
        minParts: 5,
      },
    })
    const partTabs = wrapper.findComponent({ name: 'PartTabs' })
    await partTabs.vm.$emit('update:active-part', 'tail')
    expect(globalThis.uni.showModal).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:active-part')).toBeTruthy()
  })

  it('点击完成按钮 → emit confirm + update:show=false', async () => {
    const colors = emptyMap()
    ;['back', 'belly', 'head', 'chest', 'tail'].forEach((k, i) => {
      colors[k as keyof PartColorsMap] = { hex: '#FFF', label: '白色', samples: [], touchX: 0, touchY: 0 }
    })
    const wrapper = mount(ColorPicker, {
      props: {
        show: true,
        photos: ['p1.jpg'],
        partColors: colors,
        activePart: 'tail',
        minParts: 5,
      },
    })
    const confirmBtn = wrapper.find('.btn-confirm')
    await confirmBtn.trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('点击取消按钮 → emit update:show=false + close', async () => {
    const wrapper = mount(ColorPicker, {
      props: {
        show: true,
        photos: ['p1.jpg'],
        partColors: emptyMap(),
        activePart: 'back',
        minParts: 5,
      },
    })
    const cancelBtn = wrapper.find('.btn-cancel')
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('update:show')).toBeTruthy()
    expect(wrapper.emitted('update:show')![0]).toEqual([false])
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
cd F:/swcup2026/miniapp-user && npm test -- color-picker
```

Expected: FAIL — module not found 或 components not found（PartTabs/PhotoCanvas/SamplePreview 已存在但 color-picker.vue 仍是旧 675 行版本）。

- [ ] **Step 3: 重写 color-picker.vue 为容器**

完整写入 `miniapp-user/src/components/color-picker/color-picker.vue`：

```vue
<template>
  <view v-if="visible" class="color-picker-modal" @click="onClose">
    <view class="color-picker-content" @click.stop>
      <view class="color-picker-header">
        <text class="color-picker-title">从照片取色</text>
        <view class="color-picker-close" @click="onClose">
          <text>✕</text>
        </view>
      </view>

      <PartTabs
        v-if="photos.length > 0"
        :parts="BODY_PARTS"
        :active-part="activePart"
        :part-colors="partColors"
        @update:active-part="onPartTabsRequest"
      />

      <view class="color-picker-progress">
        <text class="progress-label">已采部位：</text>
        <text class="progress-count">{{ collectedCount }} / 7</text>
        <text v-if="minParts - collectedCount > 0" class="progress-need">
          (还需 {{ minParts - collectedCount }} 个)
        </text>
      </view>

      <PhotoCanvas
        v-if="photos.length > 0"
        :photo-url="currentPhotoUrl"
        @sample="onPhotoSample"
        @image-error="onImageError"
      />
      <view v-else class="color-picker-tip">
        <text>第 2 步还没有照片，请先返回上传</text>
      </view>

      <view v-if="photos.length > 1" class="color-picker-thumbs">
        <image
          v-for="(p, i) in photos"
          :key="i"
          :class="['photo-thumb', { active: currentPhotoUrl === p }]"
          :src="p"
          mode="aspectFill"
          @click="onSelectPhoto(p)"
        />
      </view>

      <SamplePreview
        :hex="previewHex"
        :label="previewLabel"
        :samples="previewSamples"
      />

      <view class="color-picker-actions">
        <view class="btn-cancel" @click="onClose">
          <text>取消</text>
        </view>
        <view
          :class="['btn-confirm', { disabled: !completed }]"
          @click="onConfirm"
        >
          <text>{{ completed ? '完成' : `完成 (还需 ${minParts - collectedCount} 个)` }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PartTabs from './part-tabs.vue'
import PhotoCanvas from './photo-canvas.vue'
import SamplePreview from './sample-preview.vue'
import { BODY_PARTS, type PartKey, type PartColor, type PartColorsMap } from './color-picker'

const props = withDefaults(
  defineProps<{
    show: boolean
    photos: string[]
    partColors: PartColorsMap
    activePart: PartKey
    minParts?: number
  }>(),
  { minParts: 5 }
)

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'update:active-part', v: PartKey): void
  (e: 'pick', payload: { partKey: PartKey; color: PartColor }): void
  (e: 'confirm'): void
  (e: 'close'): void
}>()

// 内部：visible 由 props.show 同步
const visible = ref(props.show)
watch(() => props.show, (v) => { visible.value = v })

// 内部：当前显示的照片 URL
const currentPhotoUrl = ref('')
watch(
  () => props.show,
  (v) => {
    if (v) {
      currentPhotoUrl.value = props.photos[0] || ''
    }
  },
  { immediate: true }
)

// 已采部位数
const collectedCount = computed(
  () => Object.values(props.partColors).filter((c) => c !== null).length
)

// 完成按钮是否激活
const completed = computed(() => collectedCount.value >= props.minParts)

// 当前 activePart 的预览（直接读 props，无内部态）
const previewHex = computed(() => props.partColors[props.activePart]?.hex || '')
const previewLabel = computed(() => props.partColors[props.activePart]?.label || '')
const previewSamples = computed(() => props.partColors[props.activePart]?.samples || [])

/**
 * PartTabs 点击事件 → 检查覆盖 → 透传或弹 modal
 */
function onPartTabsRequest(newPartKey: PartKey) {
  if (props.partColors[newPartKey] !== null) {
    // 已采过该部位，弹 modal 确认覆盖
    const existing = props.partColors[newPartKey]!
    uni.showModal({
      title: '覆盖已有颜色？',
      content: `${getPartLabel(newPartKey)} 已有颜色 ${existing.hex} (${existing.label})，覆盖后无法撤销。`,
      confirmText: '覆盖',
      cancelText: '取消',
      success: ({ confirm }) => {
        if (confirm) {
          emit('update:active-part', newPartKey)
        }
      },
    })
  } else {
    emit('update:active-part', newPartKey)
  }
}

/**
 * PhotoCanvas 取色完成 → emit pick 给主页
 * 不存内部临时态（§2 决策）
 */
function onPhotoSample(payload: {
  hex: string
  label: string
  samples: string[]
  touchX: number
  touchY: number
}) {
  emit('pick', {
    partKey: props.activePart,
    color: {
      hex: payload.hex,
      label: payload.label,
      samples: payload.samples,
      touchX: payload.touchX,
      touchY: payload.touchY,
    },
  })
}

function onImageError(msg: string) {
  uni.showToast({ title: msg, icon: 'none' })
}

function onSelectPhoto(url: string) {
  currentPhotoUrl.value = url
}

function getPartLabel(key: PartKey): string {
  return BODY_PARTS.find((p) => p.key === key)?.label || key
}

function onConfirm() {
  if (!completed.value) return
  emit('confirm')
}

function onClose() {
  visible.value = false
  emit('update:show', false)
  emit('close')
}
</script>

<style scoped lang="scss">
.color-picker-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.color-picker-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 40rpx 32rpx 32rpx;
  gap: 20rpx;
}

.color-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.color-picker-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: 1rpx;
}

.color-picker-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  color: #FFFFFF;
  font-size: 32rpx;
  font-weight: 600;
}

.color-picker-progress {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 20rpx;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
}

.progress-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 24rpx;
}

.progress-count {
  color: #0FBF9F;
  font-size: 28rpx;
  font-weight: 700;
}

.progress-need {
  color: rgba(255, 255, 255, 0.4);
  font-size: 22rpx;
}

.color-picker-tip {
  color: #999999;
  font-size: 24rpx;
  padding: 80rpx 32rpx;
  text-align: center;
}

.color-picker-thumbs {
  display: flex;
  flex-direction: row;
  gap: 12rpx;
  overflow-x: auto;
  padding: 4rpx 0;
}

.photo-thumb {
  width: 96rpx;
  height: 96rpx;
  border-radius: 12rpx;
  border: 4rpx solid transparent;
  flex-shrink: 0;
  transition: all 0.2s;
}

.photo-thumb.active {
  border-color: #0FBF9F;
  transform: scale(1.05);
}

.color-picker-actions {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  margin-top: 16rpx;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  transition: all 0.15s;
}

.btn-cancel {
  background: #F3F4F6;
  color: #6B7280;
}

.btn-confirm {
  flex: 2;
  background: linear-gradient(135deg, #0FBF9F 0%, #07C160 100%);
  color: #FFFFFF;
  box-shadow: 0 4rpx 12rpx rgba(15, 191, 159, 0.3);
}

.btn-confirm.disabled {
  background: #CCCCCC;
  box-shadow: none;
}

.btn-cancel:active,
.btn-confirm:not(.disabled):active {
  transform: scale(0.96);
}
</style>
```

- [ ] **Step 4: 运行测试，验证通过**

```bash
cd F:/swcup2026/miniapp-user && npm test -- color-picker
```

Expected: PASS，11 tests passed。

- [ ] **Step 5: 类型检查**

```bash
cd F:/swcup2026/miniapp-user && npx vue-tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 6: 提交 ⏸ 待确认**

```bash
git add miniapp-user/src/components/color-picker/color-picker.vue miniapp-user/test/components/color-picker/color-picker.spec.ts
git commit -m "refactor(color-picker): 重写为容器，组合 PartTabs/PhotoCanvas/SamplePreview"
```

---

### Task 8: 删除 _extracted.css（已合并到 color-picker.vue）

**Files:**
- Delete: `miniapp-user/src/components/color-picker/_extracted.css`

> **检查**：先 grep 是否还有别处引用 _extracted.css。

- [ ] **Step 1: 确认无外部引用**

```bash
grep -rn "_extracted.css" F:/swcup2026/miniapp-user/src 2>&1
```

Expected: 仅自身文件被引用或无引用。若有别的引用，停止并报告。

- [ ] **Step 2: 删除文件**

```bash
rm F:/swcup2026/miniapp-user/src/components/color-picker/_extracted.css
```

- [ ] **Step 3: 提交 ⏸ 待确认**

```bash
git add -u miniapp-user/src/components/color-picker/_extracted.css
git commit -m "chore(color-picker): 删除 _extracted.css (样式已合并到各组件)"
```

---

## Phase 6: 主页集成

### Task 9: 改造 report/index.vue — 移除 simpleMode，加 onPickerPick

**Files:**
- Modify: `miniapp-user/src/pages/report/index.vue`

- [ ] **Step 1: 修改 import**

在 `<script setup lang="ts">` 区顶部，找到：

```ts
import { ref, computed } from 'vue'
import { apiUploadFile, apiReportEvent } from '@/services/api'
import ColorPicker from '@/components/color-picker/color-picker.vue'
```

替换为：

```ts
import { ref, computed } from 'vue'
import { apiUploadFile, apiReportEvent } from '@/services/api'
import ColorPicker from '@/components/color-picker/color-picker.vue'
import { BODY_PARTS, type PartColor, type PartKey } from '@/components/color-picker/color-picker'
```

- [ ] **Step 2: 修改常量定义**

找到：

```ts
// === 2026-06-26: 多部位取色器 (取色器 v2) ===
const BODY_PARTS = [
  { key: 'back',  label: '背脊' },
  { key: 'belly', label: '腹部' },
  { key: 'head',  label: '头部' },
  { key: 'chest', label: '胸部' },
  { key: 'tail',  label: '尾巴' },
  { key: 'legs',  label: '四肢' },
  { key: 'face',  label: '面部' },
] as const
type PartColor = { hex: string; label: string; samples: string[]; x: number; y: number }
const partColors = ref<Record<string, PartColor | null>>({})
const activePart = ref<typeof BODY_PARTS[number]['key']>('back')
const simpleMode = ref(false)
const partColorCount = computed(() => Object.values(partColors.value).filter(c => c !== null).length)
const activePartColor = computed(() => partColors.value[activePart.value] || null)
const canConfirmParts = computed(() => partColorCount.value >= 3)
```

替换为：

```ts
// === 2026-06-27: 多部位取色器 v2 ===
import { BODY_PARTS as _BP } from '@/components/color-picker/color-picker'
const MIN_PARTS = 5
const partColors = ref<Record<PartKey, PartColor | null>>({
  back: null, belly: null, head: null, chest: null, tail: null, legs: null, face: null,
})
const activePart = ref<PartKey>('back')
const partColorCount = computed(() => Object.values(partColors.value).filter(c => c !== null).length)
const activePartColor = computed(() => partColors.value[activePart.value] || null)
const canConfirmParts = computed(() => partColorCount.value >= MIN_PARTS)
```

> 注：import 名冲突所以用别名 `_BP`，实际变量名仍是 `BODY_PARTS`（已在 step 1 引入）。

- [ ] **Step 3: 替换 onOpenColorPicker**

找到：

```ts
function onOpenColorPicker() {
  if (photos.value.length === 0) {
    uni.showToast({ title: '请先在第 2 步上传照片', icon: 'none' })
    return
  }
  // 2026-06-26: 多部位取色器 — 重置 partColors
  partColors.value = {}
  activePart.value = 'back'
  showColorPicker.value = true
}
```

替换为：

```ts
function onOpenColorPicker() {
  if (photos.value.length === 0) {
    uni.showToast({ title: '请先在第 2 步上传照片', icon: 'none' })
    return
  }
  // 不再重置 partColors —— 用户关弹窗后再次打开应保留之前的选择
  showColorPicker.value = true
}
```

- [ ] **Step 4: 替换 onPickerConfirm 为 onPickerPick + onPickerConfirm**

找到：

```ts
function onPickerConfirm(payload: { hex: string; label: string; samples: string[]; touchX: number; touchY: number }) {
  // 2026-06-26: 多部位 — 先把当前选点按 activePart 落入 partColors
  partColors.value = {
    ...partColors.value,
    [activePart.value]: {
      hex: payload.hex,
      label: payload.label,
      samples: payload.samples,
      x: payload.touchX,
      y: payload.touchY
    }
  }

  if (simpleMode.value) {
    color.value = payload.label || payload.hex
    uni.showToast({ title: '已选择：' + color.value, icon: 'success' })
    return
  }
  if (!canConfirmParts.value) {
    uni.showToast({ title: '至少选 3 个部位 (当前 ' + partColorCount.value + '/7)', icon: 'none' })
    return
  }
  // 多部位模式：统计最高频 label 作为 color 概览
  const labels = Object.values(partColors.value).filter(Boolean).map(c => (c as PartColor).label)
  const freq: Record<string, number> = {}
  labels.forEach(l => { freq[l] = (freq[l] || 0) + 1 })
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  color.value = top
  uni.showToast({ title: '已选 ' + partColorCount.value + ' 个部位', icon: 'success' })
}
```

替换为：

```ts
/** 子组件 PhotoCanvas 取到一色 → 写入 partColors */
function onPickerPick(payload: { partKey: PartKey; color: PartColor }) {
  partColors.value = {
    ...partColors.value,
    [payload.partKey]: payload.color,
  }
  // 顺便把最高频 label 写到 color（概览色，旧字段兼容）
  updateOverviewColor()
}

/** 用户点完成 → 关闭弹窗 */
function onPickerConfirm() {
  showColorPicker.value = false
  if (partColorCount.value > 0) {
    uni.showToast({ title: '已选 ' + partColorCount.value + ' 个部位', icon: 'success' })
  }
}

/** 子组件 PartTabs 切部位 → 同步 activePart */
function onPickerActivePartChange(newPart: PartKey) {
  activePart.value = newPart
}

/** 根据 partColors 算概览色（最高频 label） */
function updateOverviewColor() {
  const labels = Object.values(partColors.value).filter((c): c is PartColor => c !== null).map((c) => c.label)
  if (labels.length === 0) {
    color.value = ''
    return
  }
  const freq: Record<string, number> = {}
  labels.forEach((l) => { freq[l] = (freq[l] || 0) + 1 })
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  color.value = top
}
```

- [ ] **Step 5: 修改 ColorPicker 使用方式**

找到 template 中的：

```vue
<ColorPicker v-model:show="showColorPicker" :photos="photos" @confirm="onPickerConfirm" />
```

替换为：

```vue
<ColorPicker
  v-model:show="showColorPicker"
  :photos="photos"
  :part-colors="partColors"
  :active-part="activePart"
  :min-parts="5"
  @update:active-part="onPickerActivePartChange"
  @pick="onPickerPick"
  @confirm="onPickerConfirm"
/>
```

- [ ] **Step 6: 修改 body_colors 序列化（用新字段名 x/y 保持兼容）**

找到：

```ts
const bodyColorsPayload = partColorCount.value > 0
  ? Object.entries(partColors.value)
      .filter(([_, v]) => v !== null)
      .map(([part, v]) => ({ part, hex: (v as PartColor).hex, label: (v as PartColor).label }))
  : null
```

替换为：

```ts
const bodyColorsPayload = partColorCount.value > 0
  ? Object.entries(partColors.value)
      .filter(([_, v]) => v !== null)
      .map(([part, v]) => ({ part, hex: (v as PartColor).hex, label: (v as PartColor).label }))
  : null
```

> **不变**：payload 格式 `{ part, hex, label }` 与后端 BodyColorDto 已对齐；新 PartColor 接口的 touchX/touchY/samples 仅前端用，不发后端。

- [ ] **Step 7: 类型检查**

```bash
cd F:/swcup2026/miniapp-user && npx vue-tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 8: 微信开发者工具手动验证**

打开微信开发者工具 → 导入 miniapp-user → step 3 → 点"从照片取色" → 验证：
- 进入 picker，PartTabs 显示 7 个部位
- 切"背脊" tab → 点照片 → 看到色卡写入
- 切"腹部" tab → 点照片 → 第二个色卡
- 切回"背脊" tab → 弹"覆盖已有颜色？"modal
- 采满 5 个 → "完成"按钮激活

- [ ] **Step 9: 提交 ⏸ 待确认**

```bash
git add miniapp-user/src/pages/report/index.vue
git commit -m "refactor(report): 多部位取色 v2 集成，移除 simpleMode，5 部位最小验证"
```

---

## Phase 7: step 4 确认页

### Task 10: 改造 step 4 颜色行：概览色 + 可展开 7 部位

**Files:**
- Modify: `miniapp-user/src/pages/report/index.vue`

- [ ] **Step 1: 修改 step 4 颜色行**

找到：

```vue
<view class="confirm-item">
  <text class="confirm-label">颜色</text>
  <text class="confirm-value">{{ color || '未填写' }}</text>
</view>
```

替换为：

```vue
<view class="confirm-item">
  <text class="confirm-label">颜色</text>
  <view class="confirm-colors">
    <view v-if="partColorCount.value === 0" class="confirm-value">
      <text>{{ color || '未填写' }}</text>
    </view>
    <view v-else class="confirm-colors-overview" @click="toggleColorDetail">
      <view
        v-if="overviewSwatchHex"
        class="confirm-color-swatch"
        :style="{ background: overviewSwatchHex }"
      />
      <text class="confirm-value">{{ color || '其他' }}</text>
      <text class="confirm-colors-toggle">{{ showColorDetail ? '收起 ▾' : '查看 7 部位 ▸' }}</text>
    </view>
    <view v-if="showColorDetail && partColorCount.value > 0" class="confirm-colors-grid">
      <view
        v-for="part in BODY_PARTS"
        :key="part.key"
        class="confirm-color-row"
      >
        <text class="confirm-color-row-label">{{ part.label }}</text>
        <view v-if="partColors[part.key]" class="confirm-color-row-detail">
          <view
            class="confirm-color-row-swatch"
            :style="{ background: partColors[part.key]!.hex }"
          />
          <text class="confirm-color-row-hex">{{ partColors[part.key]!.hex }}</text>
          <text class="confirm-color-row-text">{{ partColors[part.key]!.label }}</text>
        </view>
        <text v-else class="confirm-color-row-empty">未采</text>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 添加 script 状态**

在 `<script setup>` 内、computed 区附近，添加：

```ts
const showColorDetail = ref(false)

function toggleColorDetail() {
  showColorDetail.value = !showColorDetail.value
}

/** 概览色的 hex：取最高频 label 对应的首个 hex */
const overviewSwatchHex = computed(() => {
  const entries = Object.values(partColors.value).filter((c): c is PartColor => c !== null)
  if (entries.length === 0) return ''
  const freq: Record<string, number> = {}
  entries.forEach((c) => { freq[c.label] = (freq[c.label] || 0) + 1 })
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!top) return ''
  return entries.find((c) => c.label === top)?.hex || ''
})
```

- [ ] **Step 3: 添加样式**

在 `<style scoped>` 末尾追加：

```scss
.confirm-colors {
  flex: 1;
  margin-left: 16rpx;
}

.confirm-colors-overview {
  display: flex;
  align-items: center;
  gap: 12rpx;
  justify-content: flex-end;
}

.confirm-color-swatch {
  width: 32rpx;
  height: 32rpx;
  border-radius: 8rpx;
  border: 2rpx solid #E5E7EB;
}

.confirm-colors-toggle {
  font-size: 22rpx;
  color: #0FBF9F;
  margin-left: 8rpx;
}

.confirm-colors-grid {
  margin-top: 16rpx;
  background: #FAFAFA;
  border-radius: 12rpx;
  padding: 16rpx;
}

.confirm-color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #F0F0F0;
}

.confirm-color-row:last-child {
  border-bottom: none;
}

.confirm-color-row-label {
  font-size: 24rpx;
  color: #666666;
  width: 80rpx;
}

.confirm-color-row-detail {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex: 1;
  justify-content: flex-end;
}

.confirm-color-row-swatch {
  width: 24rpx;
  height: 24rpx;
  border-radius: 6rpx;
  border: 1rpx solid #E5E7EB;
}

.confirm-color-row-hex {
  font-size: 22rpx;
  color: #1A1A1A;
  font-family: 'Courier New', monospace;
  font-variant-numeric: tabular-nums;
}

.confirm-color-row-text {
  font-size: 22rpx;
  color: #1A1A1A;
}

.confirm-color-row-empty {
  font-size: 22rpx;
  color: #999999;
}
```

- [ ] **Step 4: 类型检查**

```bash
cd F:/swcup2026/miniapp-user && npx vue-tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 5: 提交 ⏸ 待确认**

```bash
git add miniapp-user/src/pages/report/index.vue
git commit -m "feat(report): step 4 颜色行升级为概览色 + 7 部位展开"
```

---

## Phase 8: E2E + 文档

### Task 11: 添加 E2E 测试脚本

**Files:**
- Create: `e2e-tests/specs/color-picker.spec.js`

> 注：现有 e2e-tests 是 JS 而非 TS，跟随项目约定。

- [ ] **Step 1: 写 E2E 脚本**

写入 `e2e-tests/specs/color-picker.spec.js`：

```js
/**
 * 多部位颜色取色器 E2E
 * 运行: node e2e-tests/specs/color-picker.spec.js
 * 前置: 微信开发者工具已打开 miniapp-user，调试模式
 *
 * 9 个用例 (TC-PICK-001 ~ 009)：
 * - 001 进入 picker
 * - 002 切部位 + 点照片
 * - 003 切第二部位 + 点照片
 * - 004 覆盖 modal
 * - 005 切照片 cursor 保留
 * - 006 5 部位完成激活
 * - 007 4 部位完成 disabled
 * - 008 step 4 展开 7 部位
 * - 009 提交带 body_colors
 */

const { launchApp, tap, screenshot, assert } = require('../helpers/appium')

describe('color-picker 多部位取色 v2', () => {
  it('TC-PICK-001 进入 picker', async () => {
    await launchApp('miniapp-user')
    await tap('text=发现')
    await tap('text=上报')
    await tap('text=下一步') // step 0
    await tap('text=下一步') // step 1 (假设已有照片)
    await tap('text=下一步') // step 2
    await tap('text=从照片取色')
    await assert.textPresent('从照片取色')
    await assert.textPresent('背脊')
    await assert.textPresent('腹部')
  })

  // ... TC-PICK-002 ~ 009 按 spec §9.5 展开
  // 实际实现依赖 e2e-tests/helpers/appium.js 的 tap/screenshot/assert 接口
})
```

> **说明**：本任务是占位骨架。完整 9 用例需要 e2e-tests/helpers/appium.js 的实现支持（项目当前依赖微信开发者工具手动跑 e2e）。**生产建议**：把核心 3 用例（001/002/004）实跑，其余人工验证。

- [ ] **Step 2: 提交 ⏸ 待确认**

```bash
git add e2e-tests/specs/color-picker.spec.js
git commit -m "test(e2e): 多部位取色器 9 用例骨架 (需 appium helper)"
```

---

### Task 12: 更新 TEST-PLAN.md

**Files:**
- Modify: `submission/appendix/TEST-PLAN.md`

- [ ] **Step 1: 在 §9 验收 Checklist 追加新条目**

定位 §9 末尾，追加：

```markdown
### 多部位颜色取色器 v2

- [ ] TC-PICK-001: 进入 picker 显示 7 个部位标签（vitest: color-picker.spec.ts 通过）
- [ ] TC-PICK-002: 切"背脊" + 点照片 → 色卡写入（E2E 微信开发者工具实跑）
- [ ] TC-PICK-003: 切"腹部" + 点照片 → 第二个色卡
- [ ] TC-PICK-004: 点已采部位 → 弹"覆盖？"modal → 取消/确认
- [ ] TC-PICK-005: 切照片再切回 → cursor 位置保留
- [ ] TC-PICK-006: 采满 5 → "完成"激活
- [ ] TC-PICK-007: 采 4 → "完成" disabled
- [ ] TC-PICK-008: step 4 → 概览色 + 展开 7 部位
- [ ] TC-PICK-009: 提交带 5 个 body_colors → 后端 200

### 自动化覆盖

- [ ] PhotoCanvas matchNearestColor 9 用例通过 (vitest)
- [ ] PartTabs 6 用例通过 (vitest)
- [ ] ColorPicker 容器 11 用例通过 (vitest)
- [ ] SamplePreview 6 用例通过 (vitest)
- [ ] 取色算法覆盖率 ≥ 80%
```

- [ ] **Step 2: 提交 ⏸ 待确认**

```bash
git add submission/appendix/TEST-PLAN.md
git commit -m "docs(test-plan): 添加多部位取色器 v2 验收用例 (TC-PICK-001~009)"
```

---

## 自审清单（实施前最后过一遍）

- [ ] Spec §5 5 个组件契约全部有 task 覆盖（Tasks 2-7）
- [ ] Spec §6 数据流无内部态（Task 7 color-picker.vue 已确认）
- [ ] Spec §8 错误处理：image-error 上抛 + 采样失败容错（Task 5 已实现）
- [ ] Spec §9 测试：26 个单元/组件用例 + 9 个 E2E 用例（Tasks 1, 3, 4, 6, 7, 11）
- [ ] Spec §11 simpleMode 完全移除（Task 9 step 4 已删）
- [ ] Spec §12 风险缓解：覆盖 modal + cursor Map + 编译期 PartKey（Tasks 6, 7, 2）
- [ ] 阶段 1-8 共 12 个 task，每个 task 都有 commit ⏸ 待确认标记

---

## 时间预算

| 阶段 | 预计时间 |
|------|---------|
| Phase 1 (测试基建) | 0.5h |
| Phase 2 (类型 + SamplePreview) | 0.5h |
| Phase 3 (PhotoCanvas + 算法) | 1.5h |
| Phase 4 (PartTabs) | 0.5h |
| Phase 5 (ColorPicker 容器) | 1.5h |
| Phase 6 (主页集成) | 1h |
| Phase 7 (step 4) | 0.5h |
| Phase 8 (E2E + 文档) | 0.5h |
| **总计** | **~6.5h** |

预留 0.5 天缓冲（调试 / 修 vue-tsc 类型错误 / 修单测 mock）。

---

> 实施计划版本 v1 · 2026-06-26 · 待用户确认
