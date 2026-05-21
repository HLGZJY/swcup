# 管理端事件审核详情页设计

> 日期：2026-05-21
> 状态：设计完成，等待后端接口就绪

---

## 1. 背景与目标

### 1.1 问题

当前审核中心的事件卡片只显示融合得分，没有显示"这个事件在跟哪个已有动物对比、两者的相似度明细"。管理员无法判断是否是真正的重复，只能凭一个数字猜测。

### 1.2 目标

在事件审核详情页中，展示：
1. 事件基本信息（描述/位置/时间/照片）
2. **比对候选列表** — 系统自动找出的 top-N 匹配动物，每个含四维度得分和融合总分
3. 候选动物档案卡片 — 照片、品种、状态等
4. 操作区 — confirm（需选择合并目标）/ reject / process

---

## 2. 业务背景（已知信息）

### 2.1 事件来源

用户上报事件时，系统自动执行鼻纹比对：

| 融合得分 | 系统行为 |
|----------|----------|
| ≥ 0.88 | 自动确认重复，自动合并到已有动物档案 |
| 0.75 ~ 0.88 | 进入管理员审核队列（状态 `pending`） |
| < 0.75 | 自动创建新的动物档案 |

进入审核中心的事件，都是系统在疑似区间拿不准的案例。

### 2.2 融合得分公式

```
fusion_score = 0.40×sim_vector + 0.20×S_location + 0.20×sim_image + 0.20×sim_text
```

- `sim_vector`：鼻纹特征向量相似度
- `S_location`：GPS 位置接近程度
- `sim_image`：照片图像相似度
- `sim_text`：文本描述匹配度

### 2.3 三个操作的业务含义

| 操作 | 业务含义 |
|------|----------|
| **confirm** | 管理员认可比对结果，确认事件对应的动物是候选列表中的某个已有动物，将事件合并到该动物档案 |
| **reject** | 比对结果有误，或事件本身无效（照片造假、不是流浪动物等），事件结束流程 |
| **process** | 鼻纹照片质量差导致比对失败，触发 AI 识别填充 species/breed，填充后重新进入审核流程 |

---

## 3. 页面布局

```
┌─────────────────────────────────┐
│  ← 返回        事件审核详情      │
├─────────────────────────────────┤
│  [事件类型标签] [状态标签]        │  ← 事件头
│  描述文字...                      │
│  📍 地址  🕐 时间                  │
│  [照片缩略图1] [照片缩略图2]       │
├─────────────────────────────────┤
│  AI 比对结果                      │  ← 四维度说明
│  向量相似度  40%  ████████░░ 0.72 │
│  位置接近度  20%  ██████░░░░ 0.55 │
│  图像相似度  20%  ███████░░░ 0.68 │
│  文本匹配度  20%  ████░░░░░░ 0.41 │
│  ────────────────────────────    │
│  融合得分        ██████████ 0.64 │
├─────────────────────────────────┤
│  比对候选（3个）                  │  ← 候选列表
│  ┌─────────────────────────────┐  │
│  │ [照片] 品种: 柴犬           │  │
│  │        状态: 走失中        │  │
│  │        融合: 0.81 ✓ 推荐   │  │
│  │        [选择]              │  │
│  └─────────────────────────────┘  │
│  ┌─────────────────────────────┐  │
│  │ [照片] 品种: 田园犬          │  │
│  │        状态: 已认领          │  │
│  │        融合: 0.52           │  │
│  │        [选择]              │  │
│  └─────────────────────────────┘  │
├─────────────────────────────────┤
│  [驳回]        [确认合并]         │  ← 操作区
└─────────────────────────────────┘
```

---

## 4. 数据结构

### 4.1 后端接口（待实现）

**GET /admin/events/:event_id**

响应需新增 `candidates` 字段：

```typescript
{
  event_id: string,
  event_type: string,
  status: string,
  description: string,
  address: string,
  location_lat: number,
  location_lng: number,
  occurred_at: string,
  photos: string[],
  fusion_score: number,        // 总融合得分
  vector_similarity: number,   // 向量相似度（新增）
  gps_similarity: number,      // GPS相似度（新增）
  image_similarity: number,    // 图像相似度（新增）
  text_match_rate: number,    // 文本匹配度（新增）
  candidates: [               // 比对候选列表（新增）
    {
      animal_id: string,
      breed: string,
      color: string,
      gender: string,
      status: string,
      photos: string[],
      address: string,
      fusion_score: number,
      vector_similarity: number,
      gps_similarity: number,
      image_similarity: number,
      text_match_rate: number,
      is_recommended: boolean  // 是否为最高分推荐
    }
  ]
}
```

### 4.2 confirm 接口改动（待实现）

**PUT /admin/events/:event_id/confirm**

请求体：
```typescript
{
  animal_id: string  // 合并目标动物ID（管理员选择的候选）
}
```

当前只打标签 `status='duplicated', is_duplicate=true`，没有关联 animal_id。

---

## 5. 前端交互逻辑

### 5.1 候选选择

- 列表按融合得分从高到低排序
- 最高分的候选自动标记为"推荐"，管理员优先参考
- 管理员点"选择"按钮选中某个候选（高亮态），选中后 confirm 按钮变为可点击
- 只能选中一个候选

### 5.2 confirm 流程

1. 管理员先选择候选动物（radio 单选）
2. 点"确认合并" → 弹出确认框，列出"合并到：[动物品种]，[地址]"
3. 用户确认 → `PUT /admin/events/:event_id/confirm { animal_id: xxx }`
4. 成功后 toast 提示，事件从列表移除

### 5.3 reject 流程

1. 点"驳回" → 弹出确认框
2. 用户确认 → `PUT /admin/events/:event_id/reject`
3. 成功后 toast 提示，事件从列表移除

### 5.4 process 流程

1. 点"AI识别" → 弹出确认框
2. 用户确认 → `POST /admin/events/:event_id/process`
3. 成功后 toast 提示，提示"AI识别中，请稍后刷新查看结果"

### 5.5 无候选时的展示

如果 `candidates` 为空（process 前未产生比对结果），显示：
- 文字提示："AI识别后即可查看比对候选"
- process 按钮置顶显示

---

## 6. 页面文件

| 文件 | 改动类型 | 职责 |
|------|----------|------|
| `pages/admin/audit-detail/index.vue` | 新建 | 事件审核详情页（包含候选列表） |
| `pages.json` | 修改 | 注册 audit-detail 路由 |
| `services/api.js` | 修改 | `apiGetAdminAuditDetail` 支持 candidates（等后端接口就绪） |

**路由：** `/pages/admin/audit-detail/index?event_id=xxx`

---

## 7. 实现顺序

1. 后端先完成 `getEventDetail` 补充 candidates
2. 后端先完成 `confirmEvent` 支持 animal_id 参数
3. 前端新建审核详情页结构（先用 mock 数据验证 UI）
4. 前端接入真实接口

---

## 8. 缺口记录（需后端先完成）

| 缺口 | 负责方 | 状态 |
|------|--------|------|
| `getEventDetail` 返回 `candidates[]` + 四维度分项 | 后端 | ❌ 待实现 |
| `confirmEvent` 支持 `animal_id` 参数 | 后端 | ❌ 待实现 |
| 前端审核详情页渲染候选卡片 | 前端 | ❌ 待开发 |
| 审核中心列表 → 跳转详情页 | 前端 | ❌ 待开发 |