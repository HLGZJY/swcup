# 流浪动物发现上报流程 设计文档

## Context

当前系统只有「鼻纹采集」一个用户入口，但真实场景中用户可能是：
- 丢了狗，有全身照 + 鼻纹照 → 想通过鼻纹找自己的狗
- 发现了流浪狗，只有照片 → 想发布信息等主人认领
- 丢了狗，只有描述 → 想发寻宠启事

现有系统无法覆盖后两种场景，且位置信息可以为 0（未强制获取 GPS），存在数据质量问题。

## 目标

新增独立的「发现」入口，让用户可以上报流浪动物信息。该信息需管理员审核通过后才展示在列表中。

---

## 一、用户角色与权限

| 角色 | 可操作 | 可见 |
|------|--------|------|
| 游客 | 浏览公开动物列表 | status=found/lost/claimed 且审核通过的档案 |
| 普通用户 | 发现页上报、上传照片、提交事件 | 同上 + 我的上报记录 |
| 管理员 | 审核事件（确认/驳回） | 所有事件、所有动物 |

---

## 二、新增页面：发现页（Report）

### 2.1 路由

- 路径：`pages/report/index`
- 底部 Tab 不变（首页 / 发现页 / 我的）

### 2.2 页面结构

```
发现页
├── Step 1：选择物种（狗/猫/其他）
├── Step 2：拍摄照片（1-3张，必填）
│          └─ 提示：至少上传一张能看清外形的照片
├── Step 3：获取 GPS 位置（必填）
│          ├─ 自动获取当前 GPS
│          └─ 失败时：提示手动选择位置（地图选点）
├── Step 4：填写描述（非必填）
│          └─ placeholder："简单描述一下这只动物的情况..."
└── Step 5：确认提交
             ├─ 显示摘要信息
             └─ 提交后 → pending 状态 → 提示"等待审核"
```

### 2.3 位置获取逻辑

```
onMounted:
  uni.getLocation({ type: 'gcj02' })
  → 成功：保存 lat/lng，显示地址
  → 失败：
       showToast('定位失败，请手动选择位置')
       显示「手动选择」按钮 → 打开地图选点
       地图选点 → 保存 lat/lng，显示地址

提交前校验：
  if (lat === null || lng === null):
    showToast('请先获取位置信息')
    return
```

> 注意：禁止使用 (0, 0) 作为默认值提交。

### 2.4 提交后行为

- 调用 `POST /v1/events` 创建事件，status = `PENDING`
- 页面显示「提交成功，等待审核」提示
- 用户可前往「我的上报」查看记录和状态

---

## 三、后端接口

### 3.1 新增上报接口（复用现有）

**`POST /v1/events`** — 创建事件（上报流浪动物）

请求体：
```json
{
  "event_type": "report",
  "species": "dog",
  "breed": "柴犬",
  "color": "黄白",
  "gender": "male",
  "location_lat": 39.9042,
  "location_lng": 116.4074,
  "address": "北京市朝阳区xxx",
  "description": "在小区发现，比较亲人",
  "photos": ["/static/uploads/xxx.jpg"]
}
```

响应：
```json
{
  "code": 0,
  "message": "提交成功，请等待审核",
  "data": {
    "event_id": "uuid-xxx",
    "status": "pending"
  }
}
```

**字段约束：**
- `photos`：由前端上传后传入 URL 列表（非 Base64）
- `location_lat/lng`：必填，不能为 0 或 null
- `event_type`：固定为 `report`（上报类型）

### 3.2 位置校验

后端 `CreateEventDto` 添加 `location_lat` 和 `location_lng` 的校验：
- 必填
- 不能为 0（当经纬度为 0 时视为无效数据）

---

## 四、审核流程（沿用现有）

### 4.1 管理员操作

路径：`miniapp-admin/src/pages/admin/audit/index`

- 待审核事件列表，status = `pending`
- 管理员点击「确认」→ 事件状态改为 `CONFIRMED` → 动物档案出现在用户端列表
- 管理员点击「驳回」→ 事件状态改为 `REJECTED` → 不展示

### 4.2 事件 → 动物档案的转换（自动）

审核通过时，管理员点击「确认」：

1. 事件状态改为 `CONFIRMED`
2. 系统**自动创建** `Animal` 档案，字段映射：

| Event 字段 | Animal 字段 | 说明 |
|-----------|------------|------|
| `species` | `species` | 必填 |
| `breed` | `breed` | 可选 |
| `color` | `color` | 可选 |
| `gender` | `gender` | 可选 |
| `photos` | `photos` | 上报的图片 |
| `location_lat/lng` | `location_lat/lng` | 发现地点 |
| `address` | `address` | 地址文字 |
| `description` | `notes` | 描述 |
| `event_id` | — | 关联到事件 |

3. 新建 Animal 的 `status` = `FOUND`（发现中）
4. 事件 `animal_id` 字段写入新建的 Animal ID
5. 若事件已有 `nose_vector_id`，将 Animal 的 `primary_nose_id` 关联到该向量

> 自动创建Animal的逻辑在后端 `events.service.ts` 的 `confirm()` 方法中实现。

---

## 五、已有流程的调整

### 5.1 鼻纹采集流程（保持不变）

路径：`pages/collect/index`

- 继续作为「鼻纹建档 + AI 比对」入口
- **位置校验修复**：提交前校验 GPS，若获取失败则提示手动选择，禁止用 (0,0) 默认

### 5.2 首页 Tab 结构

```
底部 Tab 栏：
├── 首页（动物列表）
├── 发现（新增入口 → pages/report/index）
└── 我的
```

> 发现页暂不加入 TabBadge 展示数量，与「我的上报」列表联动即可。

---

## 六、数据模型

### 6.1 RescueEvent（事件表）

字段已在 `event.entity.ts` 中定义，沿用。

关键字段：
- `event_type` = `report`（上报）
- `status` = `PENDING`（待审核）→ `CONFIRMED`（已通过）/ `REJECTED`（已驳回）
- `photos`：JSON 数组，存储上传后的 URL
- `location_lat/lng`：Decimal，存储 GPS 坐标

### 6.2 Animal（动物档案表）

审核通过后若需要创建动物档案，使用已有字段。

---

## 七、文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `miniapp-user/src/pages/report/index.vue` | 新建 | 发现页（流浪上报入口） |
| `miniapp-user/src/pages.json` | 修改 | 注册 report 路由 |
| `miniapp-user/src/services/api.js` | 修改 | 新增 `apiReportEvent` 函数（已在） |
| `backend/src/events/dto/create-event.dto.ts` | 修改 | 添加位置校验 |
| `backend/src/nose/nose.service.ts` | 修改 | 采集流程位置校验 |
| `miniapp-user/src/pages/collect/index.vue` | 修改 | 采集流程位置校验 |

---

## 八、验证方法

1. 打开发现页，若 GPS 获取失败应出现「手动选择」按钮
2. 不获取位置直接提交，应提示「请先获取位置信息」
3. 提交后事件 status = `pending`，出现在「我的上报」列表
4. 管理员审核通过后，事件不再出现在待审核列表
5. 若审核通过后系统自动创建 Animal 档案，该动物应出现在用户端首页列表