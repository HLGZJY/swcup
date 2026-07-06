# 前端 Mock 数据说明

> 本文档记录 `miniapp-user` 和 `miniapp-admin` 中 Mock 数据的结构、覆盖范围和接口契约。
> 开发阶段使用 Mock 数据，联调时替换为真实后端 API（接口路径保持一致）。

---

## 1. 数据文件位置

```
miniapp-user/src/services/mock.js     # 用户端 Mock
miniapp-admin/src/services/mock.js   # 管理端 Mock
```

---

## 2. Mock 数据结构

### 2.1 Animal（动物档案）

```typescript
interface Animal {
  animal_id: string          // UUID, 例: 'a001'
  status: 'lost' | 'found' | 'claimed' | 'archived'
  species: 'dog' | 'cat' | 'other'
  breed: string              // 品种, 例: '中华田园犬'
  color?: string             // 毛色, 例: '黄白相间'
  gender?: 'male' | 'female' | 'unknown'
  age_estimate?: 'puppy' | 'adult' | 'senior'
  health_status?: 'healthy' | 'injured' | 'ill' | 'unknown'
  sterilized?: boolean
  first_seen_at: string      // ISO 8601
  last_seen_at: string       // ISO 8601
  location_lat: number       // WGS84 纬度
  location_lng: number       // WGS84 经度
  address?: string           // 地址描述
  notes?: string             // 备注
  tags?: string[]            // 标签
  primary_nose_id?: string   // 关联鼻纹向量ID
  created_at: string          // ISO 8601
  photos?: string[]          // 照片URL数组
}
```

### 2.2 Event（救助事件）

```typescript
interface Event {
  event_id: string
  animal_id: string | null  // null = 新建档案
  event_type: 'report' | 'rescue' | 'medical' | 'adopt' | 'transfer' | 'release'
  reporter_id: string
  station_id?: string
  occurred_at: string         // ISO 8601
  location_lat: number
  location_lng: number
  address?: string
  photos?: string[]
  nose_photo_url?: string
  description?: string
  action_taken?: string
  is_duplicate: boolean
  duplicate_of?: string
  fusion_score?: number       // 四维度融合得分 0~1
  status: 'pending' | 'confirmed' | 'duplicated' | 'resolved' | 'rejected'
  created_at: string
}
```

### 2.3 Claim（认领记录）

```typescript
interface Claim {
  claim_id: string
  animal_id: string
  event_id: string
  user_id: string
  notes?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}
```

### 2.4 CompareResult（比对结果）

```typescript
interface CompareResult {
  total: number
  results: MatchItem[]
  threshold_confirmed: number  // 0.88
  threshold_suspected: number // 0.75
}

interface MatchItem {
  animal_id: string
  fusion_score: number        // 四维度融合得分 0~1
  vector_similarity: number   // 鼻纹向量相似度 0~1
  gps_distance_m: number      // GPS距离（米）
  image_similarity: number   // 图像相似度 0~1
  text_match_rate: number     // 文本匹配度 0~1
  animal: Animal              // 关联的动物档案
}
```

### 2.5 User（用户）

```typescript
interface User {
  user_id: string
  nickname: string
  phone?: string
  avatar_url?: string
  role: 'user' | 'admin' | 'organization'
  created_at: string
}
```

---

## 3. 接口清单

### 3.1 用户端（miniapp-user）

| 函数名 | 对应后端 API | 参数 | 返回 | 延迟 |
|--------|-------------|------|------|------|
| `mockLogin(params)` | POST /api/auth/login | `{avatar, nickname, phone}` | `{token, user}` | 600ms |
| `mockNoseCollect(params)` | POST /api/nose/collect | `{nose_photo, species}` | `{vector_id, confidence_score, liveness_passed}` | 800ms |
| `mockNoseCompare(params)` | POST /api/nose/compare | `{vector_id, species}` | `CompareResult` | 1500ms |
| `mockGetAnimals(params)` | GET /api/animals | `{species?, status?}` | `{total, list: Animal[]}` | 500ms |
| `mockGetAnimalDetail(id)` | GET /api/animals/:id | `animalId` | `Animal` | 300ms |
| `mockReportEvent(params)` | POST /api/events | `Event` | `{event_id, is_duplicate, fusion_score, status}` | 1000ms |
| `mockSubmitClaim(params)` | POST /api/claims | `Claim` | `{claim_id, status}` | 800ms |
| `mockGetClaims()` | GET /api/claims | - | `Claim[]` | 400ms |
| `mockGetCurrentUser()` | GET /api/user/me | - | `User` | 300ms |

### 3.2 管理端（miniapp-admin）

| 函数名 | 对应后端 API | 参数 | 返回 | 延迟 |
|--------|-------------|------|------|------|
| `mockGetStats()` | GET /api/admin/stats | - | 统计数据对象 | 500ms |
| `mockGetAdminEvents(params)` | GET /api/admin/events | `{status?, type?}` | `{total, list: Event[]}` | 500ms |
| `mockGetAdminClaims(params)` | GET /api/admin/claims | `{status?}` | `{total, list: Claim[]}` | 500ms |
| `mockConfirmEvent(id)` | POST /api/admin/events/:id/confirm | `eventId` | `{success}` | 300ms |
| `mockRejectEvent(id)` | POST /api/admin/events/:id/reject | `eventId` | `{success}` | 300ms |
| `mockApproveClaim(id)` | POST /api/admin/claims/:id/approve | `claimId` | `{success}` | 300ms |
| `mockRejectClaim(id)` | POST /api/admin/claims/:id/reject | `claimId` | `{success}` | 300ms |
| `mockGetAnimals(params)` | GET /api/animals | `{species?, status?}` | `{total, list: Animal[]}` | 500ms |
| `mockUpdateAnimal(id, data)` | PUT /api/animals/:id | `animalId, Animal` | `{success}` | 500ms |
| `mockGetUsers()` | GET /api/admin/users | - | `User[]` | 500ms |

---

## 4. GPS 维度得分计算（Mock 与真实保持一致）

```javascript
// S_location = max(0, 1 - (distance_m - 500) / 1000)
// ≤500m → 1.0, 1000m → 0.5, ≥1500m → 0

function calcLocationScore(distanceM) {
  if (distanceM <= 500) return 1.0
  if (distanceM >= 1500) return 0
  return Math.max(0, 1 - (distanceM - 500) / 1000)
}
```

**Mock 比对结果中的距离值（用于验证）**：

| 排名 | animal_id | GPS距离 | S_location | fusion_score |
|------|-----------|---------|-----------|--------------|
| 1 | a001 | 320m | 1.0 | 0.91 |
| 2 | a002 | 1250m | 0.25 | 0.71 |
| 3 | a003 | 2100m | 0 | 0.63 |

---

## 5. 与真实后端 API 的差异

Mock 与真实后端的**接口路径完全一致**，差异仅在于：

| 差异项 | Mock | 真实后端 |
|--------|------|---------|
| 认证方式 | 假的 JWT token | 真实 JWT token |
| 鼻纹比对 | 返回预设数据 | 调用 AI 服务计算 |
| 地理位置 | 使用预设 lat/lng | 使用真实 GPS |
| 数据量 | 5条动物档案 | 真实数据库 |
| 错误处理 | 简化版 | 完整的错误码 |

**切换方式**：开发完成 `services/mock.js` 中的接口函数后，直接将 `uni.request` 的 URL 替换为真实后端地址即可，不需要改调用方。

---

## 6. 维护规则

- 新增 Mock 数据时，在此文档对应章节追加
- 修改数据结构时，同步更新接口文档和 TypeScript 类型
- Mock 数据仅用于开发/演示，**不要**提交到生产代码注释中
