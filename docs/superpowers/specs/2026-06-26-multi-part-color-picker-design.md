# 多部位颜色特征采集器 — 设计

> 日期：2026-06-26 (承接昨日中断会话)
> 状态：待用户 review
> 范围：miniapp-user 取色器 (ColorPicker 子组件 + 主页 step 3 / step 4)
> 不在范围：后端 (BodyColorDto 已支持)、AI 服务 (鼻纹/品种特征)、admin 端

---

## 1. 目标

把当前 "5 采样点平均成 1 色" 的单点取色器，升级为"按动物身体部位采多种独立颜色"的多部位颜色特征采集器。

**业务动机**：鼻纹识别 + 寻宠场景下，"这只动物长啥样"的结构化描述能显著提高文本匹配分数。当前子组件平均成 1 色 = 错位实现；真正需要的是「背脊棕色 / 腹部白色 / 头部黑色」这种 3~7 部位的颜色拼贴。

**核心约束**：
- 截止 2026-07-20 15:00（剩 24 天）
- 不能破坏现有 96.2% API 集成通过率
- 不能改后端（BodyColorDto 已就绪）

---

## 2. 背景

### 2.1 当前现状（落盘代码）

| 文件 | 状态 | 行为 |
|------|------|------|
| `miniapp-user/src/components/color-picker/color-picker.vue` (675 行) | 已落盘 | 单点取色 → 5 采样点平均 → 1 hex + 1 label |
| `miniapp-user/src/pages/report/index.vue` (1336 行) | 已修改 | 含 BODY_PARTS / partColors / activePart / simpleMode / canConfirmParts；已对接 body_colors |
| `backend/src/animals/dto/create-animal.dto.ts` | 不动 | BodyColorDto { part, hex, label }，part 限定 7 个 key |
| `backend/src/events/entities/event.entity.ts` | 不动 | body_colors JSON 列已存在 |

### 2.2 错位根因

上次会话抽取 ColorPicker 子组件时**功能等价搬运**：把主页"单色 + 5 采样平均"原样搬入，没动行为。用户真实业务语义是"多部位颜色描述"，但子组件按"单色平均"交付。

---

## 3. 关键决策 (5 段用户对话结果)

| # | 决策 | 选项 |
|---|------|------|
| 1 | 每部位采几个色？ | **A. 每部位 1 色**（保持现有 BodyColorDto 结构）|
| 2 | 要不要保留 simpleMode？ | **A. 完全去掉**（只能多部位采集）|
| 3 | 部位选择器放在哪？ | **A. picker 顶部一行部位标签**（横滑/单行）|
| 4 | step 4 怎么展示多部位颜色？ | **C. 概览色 + 可展开"查看 7 个部位"** |
| 5 | 提交时最少几个部位？ | **C. 至少 5 个**（少于 5 顶部红色提示）|

补充决策（§3 修订）：
- **覆盖二次确认**：用户点已采部位 → 弹 modal 确认是否覆盖
- **cursor 跨照片保留**：PhotoCanvas 内部 `cursorsByPhoto` Map，切回原照片还原十字光标

---

## 4. 架构

### 4.1 目录结构

```
miniapp-user/src/components/color-picker/
├── color-picker.vue       # 容器 (~280 行)
├── part-tabs.vue          # 部位横滑标签 (~150 行)
├── photo-canvas.vue       # 照片 + 取色算法 (~400 行)
├── sample-preview.vue     # HEX / label / 5 采样点预览 (~120 行)
├── color-picker.css       # 共享样式 (新增)
├── color-picker.ts        # 共享类型 (PartKey / PartColor / BODY_PARTS)
└── _extracted.css         # 兼容旧调用 (保留)
```

### 4.2 子组件边界

| 组件 | 关心什么 | 不关心什么 |
|------|---------|-----------|
| ColorPicker | 4 个组件组合 + partColors 临时态 | 取色算法细节、Canvas 操作 |
| PartTabs | 部位列表渲染 + 已选色卡预览 | 颜色怎么采到的 |
| PhotoCanvas | Canvas + getImageData + matchNearestColor + cursorsByPhoto | 部位是哪个、有几个已选 |
| SamplePreview | HEX + 5 个色卡点展示 | 颜色来源、部位归属 |

### 4.3 不动的部分

- `miniapp-user/src/pages/report/index.vue`：完全不动
- `backend/src/**`：完全不动
- `_extracted.css`：保留兼容层

---

## 5. 组件契约

### 5.1 共享类型 (`color-picker.ts`)

```ts
export type PartKey = 'back' | 'belly' | 'head' | 'chest' | 'tail' | 'legs' | 'face'

export interface PartColor {
  hex: string          // 平均 HEX
  label: string        // matchNearestColor 结果
  samples: string[]    // 5 个采样点 HEX
  touchX: number       // 屏幕坐标
  touchY: number
}

export const BODY_PARTS: ReadonlyArray<{ key: PartKey; label: string }> = [
  { key: 'back',  label: '背脊' },
  { key: 'belly', label: '腹部' },
  { key: 'head',  label: '头部' },
  { key: 'chest', label: '胸部' },
  { key: 'tail',  label: '尾巴' },
  { key: 'legs',  label: '四肢' },
  { key: 'face',  label: '面部' },
] as const
```

主页现有 `type PartColor` 和 `BODY_PARTS` 改为 import 自此文件。

### 5.2 `color-picker.vue`（容器）

```ts
defineProps<{
  show: boolean                                    // v-model:show
  photos: string[]                                 // 主页 photos.value
  partColors: Record<PartKey, PartColor | null>    // 主页 partColors.value
  activePart: PartKey                              // v-model:active-part
  minParts?: number                                // 默认 5
}>()

defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'update:active-part', v: PartKey): void
  (e: 'pick', payload: { partKey: PartKey; color: PartColor }): void
  (e: 'confirm'): void
  (e: 'close'): void
}>()
```

**预览数据流**：SamplePreview 接收 `props.partColors[props.activePart]`（computed）作为 hex/label/samples。无内部 pickerHex/pickerSamples 临时态。

**事件流**：
- ColorPicker 容器接收 PhotoCanvas `sample` 事件 → 立即 `emit('pick', { partKey: props.activePart, color: payload })` 给主页（不存内部态）
- ColorPicker 容器接收 PartTabs `update:active-part` 请求（含目标 partKey）→ 检查覆盖 → 直接透传或弹 modal 后透传
- "完成"按钮 → `emit('confirm')`，由主页决定 `show=false`
- "取消"按钮 → `emit('update:show', false)` + `emit('close')`

### 5.3 `part-tabs.vue`

```ts
defineProps<{
  parts: Array<{ key: PartKey; label: string }>   // 默认从 color-picker.ts 导入 BODY_PARTS
  activePart: PartKey
  partColors: Record<PartKey, PartColor | null>
}>()

defineEmits<{
  (e: 'update:active-part', v: PartKey): void
}>()
```

**视觉规则**：
- 当前 activePart：主色边框 + 实心填充（white text on green）
- 已采部位：主色边框 + 浅色背景 + 14px 色卡圆点 + ✓ 角标
- 未采部位：灰色边框 + 半透明白字
- 7 个标签横滑容器：overflow-x: auto; flex-wrap: nowrap

**覆盖二次确认位置**：PartTabs **只负责 emit `update:active-part` 请求**（含目标 partKey）。ColorPicker 容器在事件回调中检查 `props.partColors[newPartKey]`：
- 若为 null：直接 `emit('update:active-part', newPartKey)` 给主页
- 若非 null：弹 `uni.showModal` 「将覆盖 [部位 label] 的现有颜色 [hex] [label]？」，用户选"覆盖"才 emit；选"取消"则不切部位

### 5.4 `photo-canvas.vue`

```ts
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
```

**关键状态**（组件内部）：
- `cursorsByPhoto: Map<string, {x, y} | null>` —— 跨照片保留 cursor
- watch `photoUrl`：切换时保存旧 cursor 到 Map，加载新图后从 Map 还原

### 5.5 `sample-preview.vue`（纯展示，无 emit）

```ts
defineProps<{
  hex: string          // 空 → 显示 '#------'
  label: string        // 空 → 显示 "点击照片选位置"
  samples: string[]    // 空 → 不渲染采样点区块
}>()
```

---

## 6. 数据流与状态所有权

### 6.1 状态所有权表

| 状态 | 拥有者 | 流向 |
|------|--------|------|
| `show` | 主页 | v-model:show ↔ ColorPicker |
| `activePart` | 主页 | v-model:active-part ↔ PartTabs |
| `partColors` | 主页 | ↓ ColorPicker → PartTabs / SamplePreview |
| `photos` | 主页 | ↓ ColorPicker → PhotoCanvas |
| `photoUrl` (当前显示照片) | ColorPicker 内部 | ↕ PhotoCanvas |
| `partColorCount` / `canConfirmParts` | 主页 computed | (派生，不存) |

### 6.2 时序图（采 1 个部位）

```
主页 step 3                  ColorPicker           PartTabs          PhotoCanvas        主页 partColors
   │                              │                   │                   │                     │
   │─ showColorPicker=true ──────>│                   │                   │                     │
   │                              │─ watch show=true  │                   │                     │
   │                              │─ photoUrl=photos[0]                   │                     │
   │                              │<─── 点"背脊" ──│                   │                     │
   │<─ update:active-part ───────│                   │                   │                     │
   │─ activePart='back' ────────>│                   │ (active 高亮)    │                     │
   │                              │<──── 点照片 X,Y ─────────────────────│                     │
   │                              │<─── 'sample' {hex,label,samples,...} ─│                    │
   │                              │─ emit pick({partKey, color})         │                     │
   │<─ pick ────────────────────│                   │                   │                     │
   │─ partColors['back']=color ───────────────────────────────────────────────────────────────>│
   │                              │<─── props.partColors['back'] 有值 ────────────────────────│
   │                              │─ SamplePreview 显示 hex + 5 色卡     │                     │
   │                              │<─── PartTabs 重渲染，背脊 ✓+色卡 ────│                     │
   │                              │                   │                   │                     │
   │                              │<─── 用户点"完成" ────────── (≥ minParts)                   │
   │<─ confirm() ────────────────│                   │                   │                     │
   │─ showColorPicker=false ────>│                   │                   │                     │
```

### 6.3 关键不变量

```ts
// 主页强约束（编译期保证）
partColors: Record<PartKey, PartColor | null>  // 7 个键，null 表未采
activePart: PartKey                            // 7 个 PartKey 之一
// ColorPicker/PartTabs 收到的 keys 永远来自 BODY_PARTS 常量
```

---

## 7. UI 布局

参考 mockup：`.superpowers/brainstorm/700-1782486820/content/picker-mockup.html`

垂直分层：
1. 顶部：标题 + ✕
2. PartTabs（横滑 7 个部位标签）
3. 进度提示："已采部位 X/7（还需 Y 个）"
4. 照片区（含十字光标）
5. 照片缩略图行（可切照片）
6. SamplePreview（色卡 + HEX + label）
7. 采样点预览（5 个色卡点）
8. 底部按钮：「取消」+「完成」

step 4 确认页（不在 ColorPicker 范围）：
- 颜色一行：概览色（最高频 label + 主 hex）
- 点击展开 → 7 部位网格：每行 = 部位名 + 色卡 + hex + label

---

## 8. 边界场景与错误处理

### 8.1 PhotoCanvas 取色层

| 场景 | 用户感知 | 实现 |
|------|---------|------|
| 图片加载失败 | toast: "图片加载失败" | `img.onerror` → emit `image-error` |
| Canvas getImageData SecurityError | console.error | 现有 try/catch 每采样点；0/N 成功时 toast "采样点全失败" |
| 5 采样点部分失败（3/5） | 取色继续 | 平均有效点；不阻塞 |
| 点击坐标超出图像 | 静默忽略 | xInImage/yInImage 边界检查 |
| photoUrl 切换时 imageInfo 未就绪 | 旧图位置错位 | watch photoUrl 清 imageInfo；点击前 `if (!img.width) return` |

### 8.2 ColorPicker 容器

| 场景 | 用户感知 | 实现 |
|------|---------|------|
| 用户点已采部位 | 弹覆盖确认 modal | update:active-part 回调里检查目标部位已有色 → 弹 modal「覆盖 / 取消」|
| < minParts 点完成 | 按钮 disabled（灰） | `completed` computed 控制 `.btn-confirm.disabled` |
| 主页传 0 张照片 | 显示空态 | photos.length === 0 时不渲染 PhotoCanvas |
| 主页 partColors 缺 key | 正常显示 | 不变；Object.values filter null |

### 8.3 主页

| 场景 | 用户感知 | 实现 |
|------|---------|------|
| 提交时 < 5 部位 | step 4 "颜色"行红字 "至少选 5 个部位" | canConfirmParts 控制 disabled |
| partColors 全空 | 正常提交（无 color / 无 body_colors）| 后端 DTO 都 optional |
| 后端 body_colors 校验失败 | toast "提交失败：部位非法" | 现有 apiReportEvent return e.code |
| 物理返回键 | picker 关闭，partColors 保留 | uni 默认行为 |

### 8.4 设计取舍

| 取舍 | 选择 | 理由 |
|------|------|------|
| 5 采样点 vs 1 | 保留 5 | 已落地，算法稳定 |
| matchNearestColor 9 类 | v1 不扩 | 覆盖 ~95% |
| 部位重命名 | v1 不开 | 后端 7 固定 key 强约束 |
| i18n | v1 不开 | 当前 zh-CN |

---

## 9. 测试策略

### 9.1 覆盖目标

| 模块 | 类型 | 目标覆盖率 |
|------|------|-----------|
| PhotoCanvas | 单元 | ≥ 80% |
| PartTabs | 单元 | ≥ 70% |
| ColorPicker | 组件 | ≥ 60% |
| 主页 partColors 数据流 | E2E | 关键路径 |

### 9.2 PhotoCanvas 单元测试

```
matchNearestColor('纯黑' #1A1A1A) → '黑色'
matchNearestColor('纯白' #FFFFFF) → '白色'
matchNearestColor('深灰' #555555) → '深灰'
matchNearestColor('灰' #888888) → '灰色'
matchNearestColor('浅灰' #BBBBBB) → '浅灰'
matchNearestColor('黄' #D4A857) → '黄色'
matchNearestColor('橘' #FF8C42) → '橘色'
matchNearestColor('棕' #8B5A3C) → '棕色'
matchNearestColor('纯绿' #00FF00) → '其他'

5/5 采样点成功 → emit sample
3/5 采样点成功 → 平均后 emit
0/5 采样点成功 → emit image-error
photoUrl 变化 → 内部 imageInfo 重置
cursor 跨照片保留（Map 切换还原）
屏幕坐标转图像坐标 ratioX/ratioY 正确
```

### 9.3 PartTabs 单元测试

```
默认渲染 7 个标签
activePart 高亮
partColors[key] 存在 → 显示 ✓ + 色卡
partColors[key] 为 null → 无 ✓
点击 → emit update:active-part
已采部位点击 → 弹覆盖确认 modal
```

### 9.4 ColorPicker 组件测试

```
show=true 渲染，show=false 不渲染
minParts=5 时 <5 disabled，≥5 激活
收到 sample → emit pick
完成按钮满足条件 → emit confirm
切换照片 cursor 跨照片保留
```

### 9.5 E2E 关键路径（`e2e-tests/`）

```
TC-PICK-001: step 3 → "从照片取色" → 进入 picker
TC-PICK-002: 切部位 → 点照片 → 看到色卡写入
TC-PICK-003: 切另一部位 → 点照片 → 第二个色卡
TC-PICK-004: 点已采部位 → 弹覆盖确认 → 取消/确认分支
TC-PICK-005: 切照片再切回 → cursor 位置保留
TC-PICK-006: 采满 5 → 完成按钮激活
TC-PICK-007: 采 4 → 完成按钮 disabled
TC-PICK-008: step 4 → 概览色 + 7 部位展开
TC-PICK-009: 提交带 5 个 body_colors → 后端正确接收
```

### 9.6 不测范围

| 不测 | 理由 |
|------|------|
| Canvas getImageData 真机行为 | 微信小程序 runtime；E2E 跑 |
| 微信开发者工具 tap 事件 | uni-app runtime；E2E 跑 |
| 物理返回键 | uni-app runtime；开发者工具手动验证 |

### 9.7 时间预算

- 单元测试：~2 小时
- 组件测试：~1 小时
- E2E 9 用例：~3 小时
- 总计：约 1 个工作日

---

## 10. 不在范围 (v1)

- matchNearestColor 扩标签（米色 / 奶油色 / 斑纹等）
- 部位重命名 / 自定义部位
- 多语言 i18n
- 部位优先级排序（核心部位优先采）
- AI 自动识别部位（用户手动指定）

---

## 11. 实现大纲

### 11.1 文件改动清单

**新增**（5 个文件）：

```
miniapp-user/src/components/color-picker/color-picker.ts          # 共享类型 ~30 行
miniapp-user/src/components/color-picker/part-tabs.vue            # ~150 行
miniapp-user/src/components/color-picker/photo-canvas.vue         # ~400 行
miniapp-user/src/components/color-picker/sample-preview.vue       # ~120 行
miniapp-user/src/components/color-picker/color-picker.css         # ~80 行
```

**修改**（1 个文件）：

```
miniapp-user/src/components/color-picker/color-picker.vue        # 675 → ~280 行（重写为容器）
```

**修改**（1 个文件，script 改动）：

```
miniapp-user/src/pages/report/index.vue                          # type PartColor / BODY_PARTS import 切换 + 新增 onPickerPick + 移除 simpleMode 分支
```

详见 §11.2。

**新增**（测试文件）：

```
miniapp-user/test/components/color-picker/photo-canvas.spec.ts
miniapp-user/test/components/color-picker/part-tabs.spec.ts
miniapp-user/test/components/color-picker/color-picker.spec.ts
e2e-tests/specs/color-picker.spec.ts                             # TC-PICK-001 ~ 009
```

### 11.2 修改边界（关键）

- `miniapp-user/src/pages/report/index.vue`：
  - 移除：`simpleMode` ref、`onPickerConfirm` 内 `if (simpleMode.value) { ... return }` 分支、`color.value = payload.label` 单色兜底分支
  - 保留：`partColors`、`activePart`、`canConfirmParts`、`partColorCount`、`activePartColor`、`BODY_PARTS`/`PartColor` 类型（改为 import 自 `color-picker.ts`）
  - 新增：`minParts = 5` 常量；`onPickerPick(payload)` 处理 `pick` 事件（写入 `partColors[payload.partKey] = payload.color`）；step 4 概览色 + 7 部位展开 UI
  - onNext body_colors payload：不变（已对齐 BodyColorDto）
- `backend/**`：完全不动
- 取色算法 (5 采样点 + region=3 + matchNearestColor)：逻辑原样搬迁，参数不变

---

## 12. 风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| 微信小程序 Canvas getImageData 在某些图片格式失败 | 中 | 已有 try/catch；image-error 事件上抛 |
| 用户误触照片立刻写入（无确认） | 中 | 已采部位二次确认 modal（§3 修订）；新部位"采了能改"够自然 |
| 24 天截止 + 演示视频/UI 截图 P0 任务 | 高 | 测试 ~1 天；实现 ~2 天；并行做视频截图 |
| 切照片时 cursor 还原错位 | 低 | cursorsByPhoto Map + touchX/Y 屏幕坐标，逻辑封闭 |
| PartKey 类型泄漏到主页代码 | 低 | 共享 color-picker.ts 编译期约束 |

---

## 13. 实施顺序建议

1. 抽 `color-picker.ts` 共享类型（不动现有 UI）
2. 抽 `sample-preview.vue`（最纯展示，独立可测）
3. 抽 `part-tabs.vue`（含覆盖确认 modal 入口）
4. 抽 `photo-canvas.vue`（取色算法搬迁 + cursorsByPhoto）
5. 重写 `color-picker.vue` 为容器（替换 675 行）
6. 主页 `<script>` 改 import，不动逻辑
7. 单元测试（PhotoCanvas 优先）
8. E2E 测试（开发工具实跑）
9. 更新 `appendix/TEST-PLAN.md` 加 TC-PICK-001~009

---

## 14. 关联文档

- `submission/HANDOFF.md` —— 项目总进度
- `submission/appendix/TEST-PLAN.md §9` —— 验收 Checklist
- `backend/src/animals/dto/create-animal.dto.ts` —— BodyColorDto
- `backend/src/events/entities/event.entity.ts` —— body_colors 列
- `miniapp-user/src/components/color-picker/color-picker.vue` —— 当前 675 行实现
- `miniapp-user/src/pages/report/index.vue` —— step 3 / step 4 业务逻辑

---

> 设计版本 v1 · 2026-06-26 · 待用户 review
