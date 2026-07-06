# 头像系统设计方案

## 目标

完善头像系统，区分微信用户与手机号用户的头像来源与设置方式：
- 微信用户使用微信头像（自动拉取），也可自选，支持恢复微信头像
- 手机号用户自选本地照片作为头像

---

## 1. 用户类型判断

**判断方式**：通过 `openid` 字段判断，有值 = 微信登录用户，null = 手机号用户

无需新增字段，沿用现有 `User.openid` 字段判断。

---

## 2. 微信登录用户头像流程

### 登录时

1. 微信小程序通过 `wx.login()` 获取 code
2. 后端调用微信 `jscode2session` 获取 openid
3. **新增**：后端调用微信 `/sns/userinfo` 接口获取用户微信头像 URL
4. `avatar_url = 微信头像URL`，存入数据库
5. 后续换微信头像后，用户端自动同步（URL 不变则显示不变，需要用户手动"恢复微信头像"才会重新拉取）

### 编辑头像时

- 调用 `uni.chooseAvatar()` 让用户选择微信头像或其他图片
- 上传到后端存储，返回新 URL 并更新 `avatar_url`
- **新增**：若原为微信头像用户，显示「恢复微信头像」按钮（点击后重新从微信拉取 URL）

### 恢复微信头像

- 前端调用后端 `PATCH /v1/users/me/avatar` 并带参数 `reset_wechat_avatar=true`
- 后端重新调用微信 `/sns/userinfo` 获取最新头像 URL 并更新

---

## 3. 手机号用户头像流程

### 注册时

- `avatar_url = null`，前端显示默认头像（`/static/mock/avatar-default.png`）

### 编辑头像时

- 调用 `uni.chooseImage()` 让用户从相册选择照片
- 前端将图片 base64 上传到后端 `PATCH /v1/users/me/avatar`
- 后端存储到本地文件存储（如 `uploads/avatars/{user_id}.jpg`），返回 URL
- 更新 `avatar_url`

---

## 4. 后端改动

### User 实体（不变）

```ts
openid: string | null   // 有值 = 微信用户
avatar_url: string | null
```

### 新增 / 修改 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `PATCH` | `/v1/users/me/avatar` | 上传新头像；微信用户可传 `reset_wechat_avatar=true` 恢复微信头像 |
| `GET` | `/v1/users/me` | 返回用户信息含 `avatar_url` |
| `POST` | `/v1/admin/users/:id/avatar/reset` | 管理员重置指定用户头像 |

### 微信 userinfo 获取（auth.service.ts 修改）

```ts
// weixinLogin 中新增：
const wxUserInfo = await fetch(
  `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}`
);
// 取出 wxUserInfo.headimgurl 存入 avatar_url
```

---

## 5. 前端改动

### miniapp-user

**文件**：`src/pages/user/index.vue`

- `onEditAvatar()` 逻辑：
  - 微信用户（`user.openid` 有值）：显示 `uni.chooseAvatar()`，上传后更新；额外显示「恢复微信头像」按钮
  - 手机号用户：使用 `uni.chooseImage()` 从相册选图，上传到后端
- 微信用户头像修改后：显示「恢复微信头像」按钮，点击调用恢复接口

**API**：`src/services/api.js` 新增：
- `apiUpdateAvatar(file)` — 上传头像
- `apiResetWechatAvatar()` — 恢复微信头像

### miniapp-admin

**文件**：`src/pages/users/detail.vue`

- 用户详情页显示头像
- 新增「重置头像」按钮，调用管理员重置接口

---

## 6. 文件存储策略

- 微信头像 URL：直接存微信 CDN URL，不下载到本地
- 手机号用户上传的头像：存到 `backend/static/uploads/avatars/{user_id}.jpg`
- 文件名用 `user_id` 作为唯一标识，覆盖上传

---

## 7. 边界情况

| 情况 | 处理 |
|------|------|
| 微信头像 URL 已失效 | 用户手动点「恢复微信头像」重新拉取 |
| 用户从未设置过头像 | 显示默认头像 |
| 管理员重置用户头像 | 将 `avatar_url` 设为 `null`，用户看到默认头像 |
| 上传非图片格式 | 后端校验 MIME 类型，拒绝非图片请求 |