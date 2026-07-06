# 后端数据流修复 + 前端表单补全 Spec

> 本 spec 对应任务 F1（前端表单）、F2（前端传参）、B2（后端三维度真实化）
> 修复目标：融合得分 GPS 真实计算、text_match_rate 用用户填的 breed/color/gender 计算、事件记录保存 nose_vector_id

---

## 一、背景与问题

### 现状问题

| 问题 | 位置 | 描述 |
|------|------|------|
| A | events.service.ts:16-32 | create() 没有保存 nose_vector_id，导致 processEvent 无法查鼻纹 |
| B | nose.dto.ts CompareNoseDto | 缺少 breed/color/gender 字段，无法算 text_match_rate |
| C | nose.service.ts:11 | FUSION_WEIGHTS 是旧值（4维度），且 gps/text 用 mock |
| D | collect/index.vue | 只有 3 步，缺少 breed/color/gender 表单，用户无输入 |

### 数据流现状

```
用户：选择物种 → 拍摄鼻纹 → 确认提交
前端：apiNoseCollect → nose_id + species → result.vue
后端：apiNoseCompare(nose_id, species) ← 没有 breed/color/gender
```

---

## 二、目标数据流

```
用户：选择物种 → 拍摄鼻纹 → 填写表单 → 确认提交
前端：apiNoseCollect → nose_id + species
     表单数据（breed/color/gender）通过 URL 参数传递
     result.vue 读取 → apiNoseCompare(nose_id, species, breed, color, gender)
后端：
  - GPS：用 Haversine 公式真实计算（比较动物位置 vs 上报位置）
  - text_match_rate：用 dto.breed/color/gender 匹配 animals 表字段
  - image_similarity：保留（当前 mock），权重归入 text
  - 融合：fusion_score = 0.5 * cosine + 0.3 * gpsScore + 0.2 * textMatch
  - events.create() 保存 nose_vector_id
```

---

## 三、前端改动

### F1：采集页新增表单步骤（collect/index.vue）

**改动概述**：在 Step 1（拍摄鼻纹）和 Step 2（确认提交）之间插入 Step 2（填写信息）。

**Step 顺序（改动后）**：
```
Step 0: 选择物种
Step 1: 拍摄鼻纹
Step 2: 填写信息（新增）
Step 3: 确认提交
```

**新增表单字段**（Step 2）：
- 品种（breed）：文本输入，带 AI 建议预填（暂不实现，预留接口）
- 颜色（color）：文本输入
- 性别（gender）：单选 [未知, 公, 母]

**表单 UI 示意**：
```
┌──────────────────────────────┐
│  填写宠物信息                  │
│                              │
│  品种                          │
│  [输入品种名称（如：柴犬）]     │
│                              │
│  颜色                          │
│  [输入颜色（如：黄白）]         │
│                              │
│  性别                          │
│  ○ 未知  ○ 公  ○ 母            │
└──────────────────────────────┘
```

**数据如何传递到 result.vue**：
```js
// 跳转到 result.vue 时，通过 URL 参数
uni.navigateTo({
  url: `/pages/collect/result?nose_id=${noseId}&species=${selectedSpecies.value}&breed=${breed}&color=${color}&gender=${gender}`
})
```

### F2：result.vue 调用 apiNoseCompare 时带上表单字段

**改动**：onMounted 读取 URL 参数里的 breed/color/gender，传给 apiNoseCompare。

```js
// result.vue onMounted
const pages = getCurrentPages()
const currentPage = pages[pages.length - 1] as any
const { nose_id, species, breed, color, gender } = currentPage.options || {}

const result: any = await apiNoseCompare({
  nose_id: noseId.value,
  species: selectedSpecies.value,
  breed: breed || '',
  color: color || '',
  gender: gender || 'unknown'
})
```

**api.js 无需改动** — `apiNoseCompare` 的 `body.params` 会透传所有字段。

---

## 四、后端改动

### B2-1：CompareNoseDto 增加 breed/color/gender 字段

**文件**：`backend/src/nose/dto/nose.dto.ts`

```typescript
export class CompareNoseDto {
  // ... 已有字段 ...

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  breed?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ enum: ['male', 'female', 'unknown'] })
  @IsString()
  @IsOptional()
  gender?: string;
}
```

### B2-2：nose.service.ts 融合得分三维度真实化

**文件**：`backend/src/nose/nose.service.ts`

**改动 1：FUSION_WEIGHTS 权重**
```typescript
const FUSION_WEIGHTS = { vector: 0.5, gps: 0.3, text: 0.2 };
// 去掉 image，权重重新分配：cosine 50% + GPS 30% + text 20%
```

**改动 2：Haversine GPS 真实计算**
```typescript
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // 地球半径（米）
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function gpsScore(distanceM: number): number {
  return Math.max(0, Math.min(1, 1 - (distanceM - 500) / 1000))
}
```

**改动 3：text_match_rate 真实计算**
```typescript
function textMatch(dto: CompareNoseDto, animal: any): number {
  const kw1 = [dto.breed, dto.color, dto.gender].filter(Boolean)
  const kw2 = [animal.breed, animal.color, animal.gender].filter(Boolean)
  if (!kw1.length && !kw2.length) return 1
  if (!kw1.length || !kw2.length) return 0
  const intersection = kw1.filter(k => kw2.some(v => v && k && (k.includes(v) || v.includes(k))))
  return parseFloat((intersection.length / Math.max(kw1.length, kw2.length)).toFixed(4))
}
```

**改动 4：compare() 方法中替换 mock**
```typescript
// 在 compare() 方法中，把原来：
//   gps_distance_m = 320 + Math.random() * 800
//   image_similarity = 0.80 + Math.random() * 0.15
//   text_match_rate = 0.70 + Math.random() * 0.20
// 替换为：

// GPS 距离真实计算
const animalLat = animal.location_lat || 0
const animalLng = animal.location_lng || 0
const gps_distance_m = haversineDistance(
  dto.location_lat || 0, dto.location_lng || 0,
  animalLat, animalLng
)
const gpsScoreVal = gpsScore(gps_distance_m)

// text_match_rate
const textMatchVal = textMatch(dto, animal)

// fusion_score 去掉 image_similarity
const fusion_score = parseFloat((
  FUSION_WEIGHTS.vector * vector_similarity +
  FUSION_WEIGHTS.gps * gpsScoreVal +
  FUSION_WEIGHTS.text * textMatchVal
).toFixed(4))
```

### B2-3：events.service.ts create() 保存 nose_vector_id

**文件**：`backend/src/events/events.service.ts`

```typescript
async create(dto: CreateEventDto, user_id: string) {
  const event_id = uuidv4()
  const event = this.eventRepo.create({
    event_id,
    reporter_id: user_id,
    event_type: dto.event_type as EventType || EventType.REPORT,
    location_lat: Number(dto.location_lat),
    location_lng: Number(dto.location_lng),
    address: dto.address || undefined,
    description: dto.description || undefined,
    photos: dto.photos || undefined,
    occurred_at: new Date(),
    status: EventStatus.PENDING,
    animal_id: dto.animal_id || undefined,
    // ← 新增（Problem A 修复）：
    nose_vector_id: dto.nose_vector_id || undefined,
    nose_photo_url: dto.nose_photo_url || undefined,
  } as Partial<RescueEvent>)
  await this.eventRepo.save(event)
  return { event_id, is_duplicate: false, fusion_score: null, status: 'pending' }
}
```

**同时**：CreateEventDto 里已有 `nose_vector_id`（确认存在），无需修改 DTO。

### B2-4：admin getEventDetail 返回格式改为嵌套 scores

**文件**：`backend/src/admin/admin.service.ts`

**现状**：
```json
{ "fusion_score": 0.81, "vector_similarity": 0.91, "gps_similarity": 0.85, "text_match_rate": 0.67 }
```

**目标**：
```json
{
  "fusion_score": 0.81,
  "candidates": [{
    "animal_id": "yyy",
    "scores": {
      "cosine_similarity": 0.91,
      "gps_score": 0.85,
      "text_match_rate": 0.67
    }
  }]
}
```

改动 `getEventDetail` 里的 candidates 拼装逻辑。

---

## 五、依赖关系

```
F1（采集页新增表单）
  ↓ URL 参数传递
F2（result.vue 传 breed/color/gender）
  ↓ apiNoseCompare(params)
B2-1（CompareNoseDto 加字段）
B2-2（nose.service.ts 真实计算）
  ↓
B2-3（events.service.ts 保存 nose_vector_id）
B2-4（admin getEventDetail 格式调整）
```

**执行顺序**：F1 → F2 → B2-1 → B2-2 → B2-3 → B2-4（前端任务不依赖后端，后端任务间有先后）

---

## 六、验收标准

1. **GPS 真实化**：同一坐标点的动物，gps_distance_m = 0，gpsScore = 1.0
2. **text_match_rate 真实化**：dto.breed = '柴犬'，animal.breed = '柴犬' → text_match_rate = 1.0
3. **前端表单传参**：result.vue 读取 URL 参数 breed/color/gender，调用 apiNoseCompare 时带这三个字段
4. **事件记录有 nose_vector_id**：创建事件后查库，事件.nose_vector_id 不为空
5. **admin getEventDetail**：返回 `{ scores: { cosine_similarity, gps_score, text_match_rate } }` 嵌套结构