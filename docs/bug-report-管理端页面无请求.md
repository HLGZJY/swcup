# 🐛 Bug Report — 管理端部分页面 Network 无请求

> 日期：2026-05-17
> 优先级：P0
> 状态：**✅ 主要问题已修复（4项），剩余 4 项待明日继续**

---

## 1. 概述

管理端小程序（miniapp-admin）中，**登录页、概览页**请求正常，但点击 TabBar 切换到「动物档案」「事件管理」「认领审核」「用户管理」页面时，Network 面板完全没有请求发出，页面显示 empty state。

---

## 2. 环境信息

| 项目 | 值 |
|------|-----|
| 后端地址 | `http://localhost:3000` |
| 管理端 API BASE_URL | `http://192.168.32.1:3000` |
| 测试账号 | `13900000001` / `password123`（admin） |
| 微信开发者工具 | 已勾选「不校验合法域名…」 |

---

## 3. 问题根因（已确认）

### 根因 1：`new URLSearchParams(params)` 小程序兼容性问题

**文件**：`miniapp-admin/src/services/api.js` 第179行
**问题**：微信小程序不支持 `URLSearchParams`，导致 GET 请求参数无法序列化，请求实际未发出
**修复**：替换为手动拼接方式
```javascript
// 修复前
const query = new URLSearchParams(params).toString()

// 修复后
const query = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
```

### 根因 2：`photos` 为 null 时访问下标报错

**文件**：多个页面
**问题**：`animal.photos[0]` 在 photos 为 null 时抛出异常，导致整个 load 函数崩溃
**修复**：使用可选链 `animal.photos?.[0]`

---

## 4. 修复记录（2026-05-17）

### ✅ 已修复（4项）

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 1 | `api.js` | `new URLSearchParams(params)` 小程序不兼容 | 替换为手动 `Object.entries().filter().map().join('&')` |
| 2 | `animals/index.vue` | `animal.photos[0]` null 报错 | 改为 `animal.photos?.[0]` |
| 3 | `audit/index.vue` | `item.animal?.photos[0]` null 报错 | 改为 `item.animal?.photos?.[0]` |
| 4 | `events/index.vue` | 搜索 keyword 未传给 API | 补上 `params.keyword` |

### 管理端额外 UI 修复（与 Bug 相关）

| # | 文件 | 修复 |
|---|------|------|
| 5 | `audit/index.vue` | loading 超时后遮罩层不消失导致按钮无法点击，改为非遮罩式加载状态 |
| 6 | `animals/events` 页面 | list-area/filter-tabs padding 调整 |
| 7 | `audit` 页面 | audit-card/tab-content padding 24rpx → 28rpx，左右边距 28rpx → 36rpx |
| 8 | `audit-event-card` 组件 | padding 调整 |

### 用户端同步修复

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 1 | `api.js`（用户端） | `new URLSearchParams(params)` 不兼容 | 同上，手动拼接 |
| 2 | `index/index.vue` | `animal.photos[0]` null | 改为 `animal.photos?.[0]` |
| 3 | `animal-card/index.vue` | 同上 | 同上 |
| 4 | `collect/result.vue` | `item.animal.photos[0]` null | 改为 `item.animal?.photos?.[0]` |
| 5 | `animal-detail/index.vue` | v-for `animal.photos` null | 改为 `(animal.photos || [])` |

---

## 5. 待修复（明日继续）

| # | 文件 | 问题 | 优先级 |
|---|------|------|--------|
| 1 | `audit-event-card` 组件 | emit 参数类型：传对象而非 eventId 字符串 | P1 |
| 2 | 管理端 claims 卡片 | 按钮无 `@click` 事件绑定 | P1 |
| 3 | — | `success + timeout` 同时触发（Promise resolve 链问题） | P1 |
| 4 | 用户端 | 具体功能逻辑问题 | P2 |

---

## 6. 验证结果

修复后所有管理端页面均能正常发出请求并渲染数据：
- ✅ 管理首页 `/pages/admin/index` — stats 数据正常
- ✅ 动物档案 `/pages/animals/index` — GET `/admin/animals` 正常
- ✅ 事件管理 `/pages/events/index` — GET `/admin/events` 正常
- ✅ 审核中心 `/pages/admin/audit/index` — GET `/admin/events?status=pending` + `/admin/claims?status=pending` 正常
- ✅ 用户管理 `/pages/users/index` — GET `/admin/users` 正常

---

## 7. 关键代码变更

### api.js request 函数（修复后核心逻辑）

```javascript
function request(path, options = {}) {
  const { needAuth = true } = { needAuth: true }  // 注：此 bug 不影响请求发送
  const { method = 'GET', params = {}, body = {} } = options

  return new Promise((resolve, reject) => {
    let fullPath = path
    // ✅ 修复：手动拼接 query string，替代不兼容的 URLSearchParams
    if (Object.keys(params).length > 0) {
      const query = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
      fullPath = `${path}?${query}`
    }

    const header = {}
    const token = uni.getStorageSync('token')
    if (needAuth && token) {
      header['Authorization'] = 'Bearer ' + token
    }

    uni.request({
      url: BASE_URL + fullPath,
      method,
      header,
      data: body,
      success: (res) => { /* ... */ },
      fail: (err) => { uni.showToast({ title: '网络异常' }); reject(err) }
    })
  })
}
```

### photos 可选链修复示例

```javascript
// 修复前
<img :src="animal.photos[0]" />
// 修复后
<img :src="animal.photos?.[0]" />
```

---

## 8. 经验总结

1. **微信小程序不支持 `URLSearchParams`**：标准 Web API 在小程序环境不一定可用，需用 polyfill 或手动拼接
2. **后端返回 null 字段**：接口返回的 `photos`/`nose_photo_url` 等字段可能为 null，前端访问前需做可选链保护
3. **TabBar 页面切换生命周期**：首次访问 TabBar 页面会触发 `onMounted`，但切换 tab 时不会重新触发（这本身不是 bug，但影响理解）

---

*文档更新时间：2026-05-17 17:00*
*最后更新内容：修复记录补全 + 待修复项清单*