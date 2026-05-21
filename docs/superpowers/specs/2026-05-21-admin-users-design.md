# 管理端用户管理增强设计

> 日期：2026-05-21
> 状态：草稿

---

## 1. 概述

**目的：** 增强管理端用户管理功能，补齐用户编辑、禁用、活动记录查看能力。

**范围：**
- 用户列表页增强（禁用/启用、操作列）
- 用户详情页（新增）
- 用户编辑 Modal
- 后端补充 4 个 API

---

## 2. 用户列表页增强

### 2.1 页面改动

**路由：** 现有 `miniapp-admin/src/pages/users/index.vue`

**改动点：**

| 改动 | 说明 |
|------|------|
| 新增操作列 | 每行显示「禁用/启用」开关 + 「查看详情」按钮 |
| 角色筛选 | 增加 `role` 下拉筛选：admin/user/org |

### 2.2 禁用逻辑

- 用户 `role` 字段新增 `blocked` 值
- 禁用后用户无法登录（后端登录接口校验 `role !== 'blocked'`）
- 前端列表显示禁用状态行灰色处理

### 2.3 组件改动

- 禁用开关：`uni-switch` 组件
- 详情按钮：文字链接「查看详情 →」

---

## 3. 用户详情页（新增）

### 3.1 页面结构

**路由：** `/pages/users/detail/index?user_id=xxx`

```
┌────────────────────────────────────────┐
│ 顶部：返回箭头 + "用户详情"             │
├────────────────────────────────────────┤
│ 用户基本信息卡片（只读）                 │
│ 头像 / 昵称 / 电话 / 角色 / 注册时间     │
├────────────────────────────────────────┤
│ 操作按钮区                             │
│ [编辑信息]  [禁用/启用]                 │
├────────────────────────────────────────┤
│ Tab切换：上报事件 | 认领记录 | 关联动物   │
│                                        │
│ 列表内容（同现有列表样式）               │
└────────────────────────────────────────┘
```

### 3.2 Tab 内容

| Tab | 数据来源 | 接口 |
|-----|----------|------|
| 上报事件 | 该用户上报的事件列表 | `GET /admin/users/:user_id/events` |
| 认领记录 | 该用户提交的认领申请 | `GET /admin/users/:user_id/claims` |
| 关联动物 | 该用户关联的动物档案 | `GET /admin/users/:user_id/animals` |

### 3.3 样式规范（与现有管理端保持一致）

#### 页面布局
- 页面背景：`#F5F5F5`
- 卡片背景：白色 `#FFFFFF`，圆角 `16rpx`，内边距 `24rpx`
- 卡片间距：`24rpx`
- 页面边距：`24rpx`

#### 颜色规范
| 元素 | 颜色 | 说明 |
|------|------|------|
| 主色 | `#0FBF9F` | 薄荷绿，用于正向操作 |
| 警示色 | `#FF6B6B` | 珊瑚红，用于危险操作/禁用 |
| 辅助色 | `#FF9F00` | 橙色，用于待处理状态 |
| 角色标签 admin | `#FF6B6B` | 珊瑚红底白字 |
| 角色标签 user | `#0FBF9F` | 薄荷绿底白字 |
| 角色标签 blocked | `#999999` | 灰色底白字 |
| 禁用用户行 | `opacity: 0.5` | 全行半透明处理 |

#### 交互细节
| 细节 | 实现 |
|------|------|
| Tab 指示条 | 底部 4rpx 高度，颜色 `#FF6B6B`，圆角 2rpx |
| 列表行 hover | 背景变为 `#F5F5F5`，150ms 过渡 |
| 操作按钮 hover | 透明度 0.8，150ms 过渡 |
| 加载状态 | 骨架屏（Skeleton）与现有页面一致 |
| 禁用开关 | `uni-switch`，关闭时主色背景 |

#### 图标使用
- 用户头像占位：`/static/icons/icon-user.png`
- 编辑图标：`/static/icons/icon-edit.png`
- 返回图标：左侧箭头（系统自带）
- Tab 切换图标使用现有 `audit-event-card` 中已有的图标

#### 字体规范
- 页面标题：32rpx，font-weight 700
- 卡片标题：28rpx，font-weight 600
- 正文：26rpx，font-weight 400
- 标签/徽章：22rpx

---

## 4. 编辑用户 Modal

### 4.1 触发方式

点击「编辑信息」按钮 → 弹出 Modal

### 4.2 可编辑字段

| 字段 | 类型 | 说明 |
|------|------|------|
| nickname | 文本 | 昵称 |
| phone | 手机号 | 电话 |
| role | 下拉选择 | admin/user/org/blocked |

### 4.3 权限约束

- 普通 admin 不能把自己降级为 user
- 把自己禁用会提示「不能禁用自己」

---

## 5. API 设计

### 5.1 获取用户详情

```
GET /api/admin/users/:user_id
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "user_id": "u001",
    "nickname": "李明",
    "phone": "138****0002",
    "role": "user",
    "created_at": "2026-04-05T10:00:00Z"
  }
}
```

### 5.2 获取用户上报事件

```
GET /api/admin/users/:user_id/events?page=1&limit=20
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "total": 5,
    "list": [
      {
        "event_id": "e001",
        "event_type": "report",
        "status": "confirmed",
        "address": "上海市静安区...",
        "occurred_at": "2026-05-10T15:00:00Z",
        "created_at": "2026-05-10T15:30:00Z"
      }
    ]
  }
}
```

### 5.3 获取用户认领记录

```
GET /api/admin/users/:user_id/claims?page=1&limit=20
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "total": 2,
    "list": [
      {
        "claim_id": "c001",
        "animal_id": "a001",
        "status": "approved",
        "notes": "这是我家的狗...",
        "claimed_at": "2026-05-10T14:00:00Z"
      }
    ]
  }
}
```

### 5.4 获取用户关联动物

```
GET /api/admin/users/:user_id/animals?page=1&limit=20
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "total": 3,
    "list": [
      {
        "animal_id": "a001",
        "status": "lost",
        "breed": "金毛",
        "color": "金色",
        "address": "上海市静安区..."
      }
    ]
  }
}
```

### 5.5 更新用户信息

```
PUT /api/admin/users/:user_id
```

**请求：**
```json
{
  "nickname": "李明",
  "phone": "13800138000",
  "role": "user"
}
```

**响应：**
```json
{
  "code": 0,
  "message": "更新成功"
}
```

---

## 6. 前端文件清单

| 文件 | 改动类型 |
|------|----------|
| `miniapp-admin/src/pages/users/index.vue` | 修改 |
| `miniapp-admin/src/pages/users/detail/index.vue` | 新增 |
| `miniapp-admin/src/services/api.js` | 增加 5 个 API 函数 |

---

## 7. 后端文件清单（需老师补充）

| 接口 | 路由 |
|------|------|
| 获取用户详情 | `GET /admin/users/:user_id` |
| 获取用户上报事件 | `GET /admin/users/:user_id/events` |
| 获取用户认领记录 | `GET /admin/users/:user_id/claims` |
| 获取用户关联动物 | `GET /admin/users/:user_id/animals` |
| 更新用户信息 | `PUT /admin/users/:user_id` |

---

## 8. 实施顺序

1. **Phase 1（前端）：** 用户列表页增加操作列 + 禁用开关
2. **Phase 2（后端）：** 补充 4 个活动记录 API + 更新用户 API
3. **Phase 3（前端）：** 用户详情页开发 + Tab 切换
4. **Phase 4（前端）：** 编辑 Modal 开发