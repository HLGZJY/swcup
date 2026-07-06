# 头像系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善头像系统，微信用户自动拉取微信头像并支持恢复，手机号用户相册上传头像，管理员可重置用户头像

**Architecture:** 后端在 `weixinLogin` 中新增微信 `/sns/userinfo` 头像拉取；新增 `PATCH /v1/users/me/avatar` 处理文件上传和微信头像恢复；新增 `POST /v1/admin/users/:id/avatar/reset` 供管理员重置；前端区分两类用户分别处理上传逻辑

**Tech Stack:** NestJS (后端), uni-app (小程序前端), Multer (文件上传)

---

## 文件变更总览

```
backend/src/
├── auth/auth.service.ts              # 修改：weixinLogin 新增获取微信头像
├── users/users.service.ts           # 修改：新增 resetAvatar 方法
├── users/users.controller.ts        # 修改：新增 PATCH /me/avatar、POST admin/avatar/reset
├── common/multer.config.ts          # 新建：Multer 上传配置
└── uploads/avatars/                 # 新建：头像存储目录

miniapp-user/src/
├── pages/user/index.vue             # 修改：区分微信/手机号用户头像编辑逻辑
└── services/api.js                  # 新增：apiUpdateAvatar、apiResetWechatAvatar

miniapp-admin/src/
├── pages/users/detail/index.vue      # 修改：用户卡片新增「重置头像」按钮
└── services/api.js                  # 新增：apiResetUserAvatar
```

---

## Task 1: 后端 — 修改 weixinLogin 获取微信头像

**文件:** `backend/src/auth/auth.service.ts`

- [ ] **Step 1: 找到 weixinLogin 方法，在获取 openid 后新增获取微信用户信息**

在 `openid = wxData.openid` 之后，添加：

```ts
// 获取微信用户信息（含头像）
let avatarUrl: string | null = null;
try {
  const wxUserInfoRes = await fetch(
    `https://api.weixin.qq.com/sns/userinfo?access_token=${sessionKey}&openid=${openid}`,
    { method: 'GET' }
  );
  const wxUserInfo = await wxUserInfoRes.json() as { headimgurl?: string };
  avatarUrl = wxUserInfo.headimgurl || null;
} catch {
  // 微信头像获取失败不影响登录
}
```

然后在创建或更新 user 对象时加入 `avatar_url: avatarUrl`。

- [ ] **Step 2: 验证编译**

```bash
cd backend && npx tsc --noEmit
```

预期：无编译错误

- [ ] **Step 3: 提交**

```bash
git add backend/src/auth/auth.service.ts
git commit -m "feat(auth): fetch WeChat avatar URL during weixinLogin"
```

---

## Task 2: 后端 — Multer 文件上传配置

**文件:** `backend/src/common/multer.config.ts`（新建）

- [ ] **Step 1: 创建 Multer 上传配置**

```ts
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const avatarDir = join(process.cwd(), 'static', 'uploads', 'avatars');

export const avatarStorage = diskStorage({
  destination: (req, file, cb) => {
    if (!existsSync(avatarDir)) mkdirSync(avatarDir, { recursive: true });
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).user?.user_id || 'unknown';
    const ext = extname(file.originalname) || '.jpg';
    cb(null, `${userId}${ext}`);
  },
});

export const avatarFilter = (req: any, file: Express.Multer.File, cb: Function) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'), false);
  }
  cb(null, true);
};
```

- [ ] **Step 2: 确认编译**

```bash
cd backend && npx tsc --noEmit
```

预期：无编译错误

- [ ] **Step 3: 提交**

```bash
git add backend/src/common/multer.config.ts
git commit -m "feat: add multer config for avatar uploads"
```

---

## Task 3: 后端 — 新增头像上传 API（POST /users/me/avatar）

**文件:** `backend/src/users/users.controller.ts`

- [ ] **Step 1: 修改 import 和控制器**

添加导入：

```ts
import { Post, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { avatarStorage, avatarFilter } from '../common/multer.config';
```

在 `UsersController` 类中添加：

```ts
@Post('me/avatar')
@ApiOperation({ summary: '上传头像' })
@UseInterceptors(AnyFilesInterceptor({ storage: avatarStorage, fileFilter: avatarFilter }))
async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
  if (!file) throw new Error('未选择图片');
  const avatarUrl = `/static/uploads/avatars/${file.filename}`;
  await this.usersService.update(req.user.user_id, { avatar_url: avatarUrl });
  return { avatar_url: avatarUrl };
}
```

- [ ] **Step 2: 确认编译**

```bash
cd backend && npx tsc --noEmit
```

预期：无编译错误（如有 import 错误需补充）

- [ ] **Step 3: 提交**

```bash
git add backend/src/users/users.controller.ts backend/src/common/multer.config.ts
git commit -m "feat(users): add avatar upload endpoint POST /users/me/avatar"
```

---

## Task 4: 后端 — 新增管理员重置头像 API

**文件:** `backend/src/users/users.controller.ts`, `backend/src/users/users.service.ts`

- [ ] **Step 1: 在 UsersController 中新增管理员重置接口**

```ts
@Post('admin/users/:id/avatar/reset')
@ApiOperation({ summary: '管理员重置用户头像' })
async resetUserAvatar(@Param('id') userId: string) {
  await this.usersService.resetAvatar(userId);
  return { message: '头像已重置' };
}
```

- [ ] **Step 2: 在 users.service.ts 中新增 resetAvatar 方法**

```ts
async resetAvatar(user_id: string) {
  await this.userRepo.update({ user_id }, { avatar_url: null });
}
```

- [ ] **Step 3: 确认编译**

```bash
cd backend && npx tsc --noEmit
```

预期：无编译错误

- [ ] **Step 4: 提交**

```bash
git add backend/src/users/users.service.ts backend/src/users/users.controller.ts
git commit -m "feat(admin): add admin avatar reset endpoint"
```

---

## Task 5: 后端 — sanitizeUser 返回 openid

**文件:** `backend/src/auth/auth.service.ts`

- [ ] **Step 1: 修改 sanitizeUser 方法，追加 openid 字段**

```ts
private sanitizeUser(user: User) {
  return {
    user_id: user.user_id,
    nickname: user.nickname,
    phone: user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
    avatar_url: user.avatar_url,
    openid: user.openid,  // 新增：供前端判断用户类型
    role: user.role,
    created_at: user.created_at,
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/auth/auth.service.ts
git commit -m "feat(auth): include openid in sanitizeUser response"
```

---

## Task 6: 前端 miniapp-user — 新增头像上传 API

**文件:** `miniapp-user/src/services/api.js`

- [ ] **Step 1: 新增 apiUpdateAvatar 和 apiResetWechatAvatar**

```js
export function apiUpdateAvatar(filePath) {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: getBaseUrl() + '/v1/users/me/avatar',
      filePath,
      name: 'file',
      header: { Authorization: 'Bearer ' + getToken() },
      success: (res) => {
        const data = JSON.parse(res.data);
        resolve(data);
      },
      fail: reject,
    });
  });
}

export function apiResetWechatAvatar() {
  return request({
    url: '/v1/users/me/avatar/wechat',
    method: 'POST',
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add miniapp-user/src/services/api.js
git commit -m "feat(api): add avatar upload and wechat reset APIs"
```

---

## Task 7: 前端 miniapp-user — 修改用户页头像编辑逻辑

**文件:** `miniapp-user/src/pages/user/index.vue`

- [ ] **Step 1: 修改 onEditAvatar 函数，区分用户来源**

替换现有的 `onEditAvatar` 为：

```js
function onEditAvatar() {
  if (user.value.openid) {
    // 微信用户：显示选择菜单
    uni.showActionSheet({
      itemList: ['从微信头像选', '从相册选择'],
      success: (res) => {
        if (res.tapIndex === 0) {
          uni.chooseAvatar({
            success: (res) => uploadAvatar(res.avatarUrl),
          });
        } else {
          uni.chooseImage({
            count: 1,
            sourceType: ['album'],
            success: (res) => uploadAvatar(res.tempFilePaths[0]),
          });
        }
      }
    });
  } else {
    // 手机号用户：从相册选
    uni.chooseImage({
      count: 1,
      sourceType: ['album'],
      success: (res) => uploadAvatar(res.tempFilePaths[0]),
    });
  }
}

async function uploadAvatar(filePath) {
  uni.showLoading({ title: '上传中...' });
  try {
    const res = await apiUpdateAvatar(filePath);
    uni.hideLoading();
    if (res.code === 0) {
      user.value.avatar_url = res.data.avatar_url;
      uni.$emit('page:refresh-user');
    } else {
      uni.showToast({ title: res.message || '上传失败', icon: 'none' });
    }
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: '上传失败', icon: 'none' });
  }
}
```

- [ ] **Step 2: 微信用户新增「恢复微信头像」按钮**

在 `.avatar-edit` 下方添加：

```vue
<view v-if="user.openid && user.avatar_url" class="avatar-reset-btn" @click="onResetWechatAvatar">
  <text>恢复微信头像</text>
</view>
```

样式：

```scss
.avatar-reset-btn {
  margin-left: 44px;
  margin-top: 8px;
  font-size: 22rpx;
  color: #0FBF9F;
  text-align: center;
}
```

`onResetWechatAvatar` 函数：

```js
async function onResetWechatAvatar() {
  uni.showModal({
    title: '恢复微信头像',
    content: '确定要恢复为微信头像吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiResetWechatAvatar();
          uni.showToast({ title: '已恢复', icon: 'success' });
          refreshUserData();
        } catch (e) {
          uni.showToast({ title: '恢复失败，请重新登录', icon: 'none' });
        }
      }
    }
  });
}
```

- [ ] **Step 3: 确认编译**

```bash
cd miniapp-user && npm run dev:mp-weixin 2>&1 | tail -10
```

预期：`Build complete` 无报错

- [ ] **Step 4: 提交**

```bash
git add miniapp-user/src/pages/user/index.vue
git commit -m "feat(user): differentiate avatar edit for wechat vs phone users"
```

---

## Task 8: 前端 miniapp-admin — 新增管理员重置头像 API

**文件:** `miniapp-admin/src/services/api.js`

- [ ] **Step 1: 新增 apiResetUserAvatar**

```js
export function apiResetUserAvatar(userId) {
  return request({
    url: `/v1/users/admin/users/${userId}/avatar/reset`,
    method: 'POST',
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add miniapp-admin/src/services/api.js
git commit -m "feat(api): add admin avatar reset API"
```

---

## Task 9: 前端 miniapp-admin — 用户详情页新增重置头像按钮

**文件:** `miniapp-admin/src/pages/users/detail/index.vue`

- [ ] **Step 1: 在 user-header 区域添加重置按钮**

将 `.avatar` 外层包裹 `.avatar-section`，并添加重置按钮：

```vue
<view class="avatar-section">
  <image class="avatar" :src="userInfo.avatar || '/static/mock/avatar-default.png'" mode="aspectFill" />
  <view class="avatar-reset" @tap="onResetAvatar">
    <text>重置头像</text>
  </view>
</view>
```

- [ ] **Step 2: 新增 onResetAvatar 函数**

从 api.js 引入 `apiResetUserAvatar`，添加：

```js
async function onResetAvatar() {
  uni.showModal({
    title: '重置头像',
    content: '确定要重置该用户的头像吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiResetUserAvatar(userId.value);
          uni.showToast({ title: '已重置', icon: 'success' });
          loadUserDetail();
        } catch (e) {
          uni.showToast({ title: '重置失败', icon: 'none' });
        }
      }
    }
  });
}
```

- [ ] **Step 3: 添加样式**

```scss
.avatar-section {
  position: relative;
  display: inline-block;
}
.avatar-reset {
  font-size: 20rpx;
  color: #FF6B6B;
  text-align: center;
  margin-top: 4rpx;
}
```

- [ ] **Step 4: 确认编译**

```bash
cd miniapp-admin && npm run dev:mp-weixin 2>&1 | tail -10
```

预期：`Build complete` 无报错

- [ ] **Step 5: 提交**

```bash
git add miniapp-admin/src/pages/users/detail/index.vue
git commit -m "feat(admin): add reset avatar button in user detail"
```

---

## 验证步骤

所有任务完成后，执行以下验证：

1. **微信用户登录后头像自动拉取**：
   使用微信测试账号登录新用户，观察 `avatar_url` 是否为微信头像 URL（`https://thirdwx.qlogo.cn/...`）

2. **手机号用户上传头像**：
   手机号用户编辑头像，选择相册照片，确认上传后 `avatar_url` 变为 `/static/uploads/avatars/{user_id}.jpg`

3. **管理员重置**：
   管理端进入用户详情，点击「重置头像」，确认用户头像变为默认

4. **恢复微信头像按钮**：
   微信用户修改过头像后，用户页显示「恢复微信头像」按钮