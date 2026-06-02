# 管理端 API 路径版本化修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复管理端前端所有 API 调用路径，加上 `/v1` 前缀以匹配后端 versioning

**Architecture:** 后端启用了 URI versioning (`/v1/...`)，前端所有 API 调用需要统一加前缀

**Tech Stack:** UniApp (Vue3) + NestJS + TypeScript

---

## 修改范围

| 文件 | 修改内容 |
|------|---------|
| `miniapp-admin/src/services/api.js` | 所有 `/admin/...` → `/v1/admin/...`，`/users/...` → `/v1/users/...` |
| `miniapp-admin/src/pages/login/login.vue` | `/auth/login` → `/v1/auth/login` |

---

## 任务清单

### Task 1: 修复 api.js 所有路由路径

**文件:** `miniapp-admin/src/services/api.js`

- [ ] **Step 1: 改 BASE_URL 为带版本前缀**

```javascript
// 改前
const BASE_URL = 'http://192.168.32.1:3000'

// 改后
const BASE_URL = 'http://192.168.32.1:3000/v1'
```

- [ ] **Step 2: 验证所有 request 调用**

所有 `request('/admin/...')` → `request('/admin/...')`（路径不变，因为 BASE_URL 已含 `/v1`）
所有 `request('/users/...')` → 同上

检查点：确认 api.js 中没有直接写死 `/auth/` 开头的路径（登录是硬编码不在 api.js 里）

---

### Task 2: 修复 login.vue 登录路径

**文件:** `miniapp-admin/src/pages/login/login.vue:77`

- [ ] **Step 1: 把硬编码路径改为 /v1 前缀**

```javascript
// 改前
url: 'http://192.168.32.1:3000/auth/login',

// 改后
url: 'http://192.168.32.1:3000/v1/auth/login',
```

---

## 验证

修复后测试：

1. 构建管理端：`cd miniapp-admin && npm run build`
2. 登录管理端，确认不再 404
3. 进入管理首页，确认数据正常加载

## 影响范围

修改后管理端所有 API 调用均生效，用户端（`miniapp-user`）API 路径不受影响。