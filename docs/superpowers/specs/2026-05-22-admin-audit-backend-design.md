# 管理端事件审核详情 — 后端接口设计

> 日期：2026-05-22
> 状态：设计完成，等待实现

---

## 1. 背景与目标

前端正审核详情页（`audit-detail`）已完成，使用 mock 数据。现需后端补充数据接口，使前端能接入真实数据。

目标：
1. `GET /admin/events/:event_id` 返回四维度得分 + 比对候选列表
2. `PUT /admin/events/:event_id/confirm` 支持传入 `animal_id` 合并目标
3. `POST /admin/events/:event_id/process` 实际触发鼻纹比对并存储结果

---

## 2. 数据库改动

### 2.1 RescueEvent entity 新增字段

在 `rescue_events` 表新增 4 个四维度得分列 + 1 个 candidates JSON 列：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `vector_similarity` | `decimal(5,4)` | 鼻纹向量相似度 |
| `gps_similarity` | `decimal(5,4)` | GPS 位置接近度 |
| `image_similarity` | `decimal(5,4)` | 照片图像相似度 |
| `text_match_rate` | `decimal(5,4)` | 文本描述匹配度 |
| `candidates` | `json` | 比对候选列表（AnimalCandidate[]） |

### 2.2 candidates JSON 结构

```typescript
interface AnimalCandidate {
  animal_id: string;
  breed: string;
  color: string;
  gender: string;
  status: string;
  photos: string[];
  address: string;
  fusion_score: number;
  vector_similarity: number;
  gps_similarity: number;
  image_similarity: number;
  text_match_rate: number;
  is_recommended: boolean;  // 最高分为推荐
}
```

---

## 3. 接口设计

### 3.1 GET /admin/events/:event_id

**改动：** 扩展响应结构，返回四维度得分 + candidates 列表。

**响应：**

```typescript
{
  event_id: string;
  event_type: string;
  status: string;
  description: string;
  address: string;
  location_lat: number;
  location_lng: number;
  occurred_at: string;
  photos: string[];
  fusion_score: number;           // 总融合得分
  vector_similarity: number;       // 向量相似度（新增）
  gps_similarity: number;          // GPS相似度（新增）
  image_similarity: number;        // 图像相似度（新增）
  text_match_rate: number;         // 文本匹配度（新增）
  candidates: AnimalCandidate[];    // 比对候选列表（新增）
  reporter_id: string;
  created_at: string;
}
```

**响应说明：**
- `candidates` 为空时（`null` 或 `[]`），表示还未执行 AI 比对
- `fusion_score` 为空时表示未比对
- 候选按 `fusion_score` 降序排列，`is_recommended: true` 的为最高分

---

### 3.2 PUT /admin/events/:event_id/confirm

**改动：** 接受请求体 `{ animal_id: string }`，将事件与指定动物关联。

**请求体：**
```typescript
{
  animal_id: string;  // 合并目标动物ID（必填）
}
```

**行为：**
1. 校验 animal_id 对应的动物存在
2. 更新 event：
   - `animal_id` = 传入的 animal_id
   - `status` = `duplicated`
   - `is_duplicate` = `true`
3. 返回更新后的事件

**错误：**
- `animal_id` 不存在 → 400 "动物不存在"
- `event_id` 不存在 → 404 "事件不存在"

---

### 3.3 POST /admin/events/:event_id/process

**改动：** 实际调用鼻纹比对服务，存储四维度得分和候选列表。

**行为：**
1. 根据事件的 `nose_photo_url` 调用 `noseService.compare()`
2. 将返回的比对结果（top-N 候选）存入 event 的四维度字段 + `candidates` JSON 列
3. 更新事件状态为 `pending`（如果原来是 `processing`）
4. 返回比对结果摘要

**noseService.compare 入参改造：**
- 当前只支持 `vector_id` 比对
- 需扩展支持直接传 `nose_photo_url` 进行比对（内部调用 AI 图像识别 + 向量提取）

**响应：**
```typescript
{
  event_id: string;
  status: 'pending';
  fusion_score: number;     // 最高候选的融合得分
  candidates_count: number; // 候选数量
  message: string;
}
```

**错误：**
- 事件无 `nose_photo_url` → 400 "缺少鼻纹照片"
- 比对失败 → 500 "AI比对失败，请稍后重试"

---

## 4. 融合得分公式

```
fusion_score = 0.40×sim_vector + 0.20×S_location + 0.20×sim_image + 0.20×sim_text
```

| 维度 | 权重 | 说明 |
|------|------|------|
| `sim_vector` | 40% | 鼻纹特征向量相似度 |
| `S_location` | 20% | GPS 位置接近程度 |
| `sim_image` | 20% | 照片图像相似度 |
| `sim_text` | 20% | 文本描述匹配度 |

---

## 5. 业务规则

| 融合得分 | 系统行为 |
|----------|----------|
| ≥ 0.88 | 自动确认，自动合并 |
| 0.75 ~ 0.88 | 进入审核队列（`pending`），需管理员确认/驳回/process |
| < 0.75 | 自动创建新动物档案 |

进入审核中心的事件都是系统在 0.75-0.88 疑似区间的案例。

---

## 6. 文件改动

| 文件 | 改动类型 | 职责 |
|------|----------|------|
| `backend/src/events/entities/event.entity.ts` | 修改 | 新增 4 个四维度字段 + candidates JSON 列 |
| `backend/src/admin/admin.service.ts` | 修改 | `getEventDetail` 拼装 candidates；`confirmEvent` 支持 animal_id |
| `backend/src/admin/admin.controller.ts` | 修改 | `confirmEvent` 接受 body |
| `backend/src/events/events.service.ts` | 修改 | `processEvent` 实际调用鼻纹比对 |
| `backend/src/nose/nose.service.ts` | 修改 | `compare` 支持 nose_photo_url 入参 |
| `backend/src/nose/dto/nose.dto.ts` | 修改 | `CompareNoseDto` 新增 nose_photo_url 字段 |

---

## 7. 缺口记录

| 缺口 | 负责方 | 状态 |
|------|--------|------|
| events 表加字段（migration） | 后端 | ❌ |
| noseService.compare 支持 nose_photo_url | 后端 | ❌ |
| processEvent 实际调用比对并存储 | 后端 | ❌ |
| getEventDetail 返回四维度+candidates | 后端 | ❌ |
| confirmEvent 支持 animal_id | 后端 | ❌ |
| 前端接入真实接口 | 前端 | ⏸️ 等后端 |
