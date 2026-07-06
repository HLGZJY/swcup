# 去掉用户头像功能 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完整剔除用户头像功能 (数据库列 DROP + 后端 2 个端点 + multer 配置删 + 前端 user/admin 共 7 文件清理 + seed 同步), 保留 `static/mock/avatar-default.png` 给 admin audit-detail 动物候选 fallback.

**Architecture:** 自顶向下: 先删数据库列 → 实体 → 服务 → 控制器 → 前端 (user 端 → admin 端) → seed → 验证. 后端 TypeORM `synchronize:true` 不会 DROP, 需手动 ALTER. 前端按文件单元 commit, 每个文件改完即测.

**Tech Stack:** NestJS + TypeORM + MySQL 8 + Multer + uni-app (Vue 3 + TS) + Node 18.

**Spec:** [`docs/superpowers/specs/2026-06-13-remove-user-avatar-design.md`](../specs/2026-06-13-remove-user-avatar-design.md)

---

## 阶段总览

| 阶段 | 范围 | Task |
|-----|------|------|
| 1 | 数据库迁移 | 1-2 |
| 2 | 后端 entity + multer 删 | 3-4 |
| 3 | 后端 auth/users 改动 | 5-7 |
| 4 | 后端构建+重启 | 8 |
| 5 | 前端 user 端 | 9-11 |
| 6 | 前端 admin 端 | 12-14 |
| 7 | Seed 同步 | 15-16 |
| 8 | 测试 + 收尾 | 17-19 |

---

## Phase 1: 数据库迁移

### Task 1: 创建 migration SQL 脚本

**Files:**
- Create: `backend/scripts/migrate-2026-06-13-drop-avatar-url.sql`

- [ ] **Step 1: 创建 migration SQL 文件**

写入以下内容:

```sql
-- =============================================
-- 鼻纹智救 - 迁移脚本 (2026-06-13)
-- 删除 users.avatar_url 列
-- 运行: docker exec -i swcup2026-db mysql -uroot -prootpassword nose_rescue < migrate-2026-06-13-drop-avatar-url.sql
-- =============================================

USE nose_rescue;

ALTER TABLE users DROP COLUMN avatar_url;

-- 验证: 列已删
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA='nose_rescue' AND TABLE_NAME='users'
ORDER BY ORDINAL_POSITION;
```

- [ ] **Step 2: 提交脚本**

```bash
cd F:/swcup2026
git add backend/scripts/migrate-2026-06-13-drop-avatar-url.sql
git commit -m "chore(db): add migration script to drop users.avatar_url column"
```

---

### Task 2: 执行 ALTER 并删 avatars 目录

**Files:**
- Execute: `backend/scripts/migrate-2026-06-13-drop-avatar-url.sql`
- Delete: `backend/static/uploads/avatars/` (整目录)

- [ ] **Step 1: 执行 migration**

```bash
docker exec -i swcup2026-db mysql -uroot -prootpassword nose_rescue < backend/scripts/migrate-2026-06-13-drop-avatar-url.sql
```

Expected: 列出 users 表所有列, **不再包含 `avatar_url`**. 期望列: `user_id, nickname, phone, openid, password_hash, agreed_privacy_at, role, created_at, updated_at`.

- [ ] **Step 2: 验证列已删**

```bash
docker exec -i swcup2026-db mysql -uroot -prootpassword -e "DESC nose_rescue.users;"
```

Expected: 输出表结构, 不含 `avatar_url` 字段.

- [ ] **Step 3: 删 avatars 目录**

```bash
rm -rf F:/swcup2026/backend/static/uploads/avatars
```

Expected: 命令成功, 目录消失.

- [ ] **Step 4: 提交目录删除**

```bash
cd F:/swcup2026
git add -A backend/static/uploads/
git commit -m "chore(static): remove avatars upload directory"
```

---

## Phase 2: 后端 Entity + Multer 删除

### Task 3: 删除 User entity 的 avatar_url 字段

**Files:**
- Modify: `backend/src/users/entities/user.entity.ts:32-33`

- [ ] **Step 1: 删除 avatar_url 列定义**

打开 `backend/src/users/entities/user.entity.ts`, 删除第 32-33 行:

```ts
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'avatar_url' })
  avatar_url: string;

```

删除后, `agreed_privacy_at` 字段直接紧接 `password_hash` 字段.

- [ ] **Step 2: 验证 entity 文件**

文件应剩 48 行 (原 50 行减 2). password_hash 后直接是 agreed_privacy_at.

```bash
cd F:/swcup2026 && grep -n "avatar_url" backend/src/users/entities/user.entity.ts
```

Expected: 无输出 (0 匹配).

- [ ] **Step 3: 提交**

```bash
git add backend/src/users/entities/user.entity.ts
git commit -m "refactor(users): remove avatar_url column from User entity"
```

---

### Task 4: 删除 multer.config.ts 整个文件

**Files:**
- Delete: `backend/src/common/multer.config.ts`

- [ ] **Step 1: 确认引用方仅 users.controller.ts**

```bash
cd F:/swcup2026 && grep -rn "multer.config" backend/src/
```

Expected: 仅 `backend/src/users/users.controller.ts:8` 一处引用 (将在 Task 7 删).

- [ ] **Step 2: 删除文件**

```bash
rm F:/swcup2026/backend/src/common/multer.config.ts
```

- [ ] **Step 3: 提交 (与 Task 7 联动, 暂不提交单独 commit)**

> 备注: 不要在此处独立 commit, 因为引用方 (controller) 还在 import 此文件, 单独 commit 会导致中间 build 失败. 跟 Task 7 一起提交.

---

## Phase 3: 后端 Auth/Users 改动

### Task 5: 清理 auth.service.ts 的头像逻辑

**Files:**
- Modify: `backend/src/auth/auth.service.ts:59-70, 81, 118, 208`

- [ ] **Step 1: 删除 weixinLogin 中拉 userinfo 的整段**

打开 `backend/src/auth/auth.service.ts`, 删除第 59-70 行:

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

- [ ] **Step 2: 删除 weixinLogin 中 userRepo.create 的 avatar_url 字段**

继续在同一文件, 在 `userRepo.create({...})` 块中删除 `avatar_url: avatarUrl,` 一行 (原第 81 行):

把:

```ts
      user = this.userRepo.create({
        user_id: uuidv4(),
        openid,
        nickname: '',
        phone: null,
        password_hash: null,
        avatar_url: avatarUrl,
        role: UserRole.USER,
        agreed_privacy_at: new Date(),
      });
```

改为:

```ts
      user = this.userRepo.create({
        user_id: uuidv4(),
        openid,
        nickname: '',
        phone: null,
        password_hash: null,
        role: UserRole.USER,
        agreed_privacy_at: new Date(),
      });
```

- [ ] **Step 3: 删除 register 中的 avatar_url 字段**

在 `register()` 方法的 `userRepo.create({...})` 块中, 删除 `avatar_url: null,` 行 (原第 118 行):

把:

```ts
    const user = this.userRepo.create({
      user_id: uuidv4(),
      nickname: '',
      phone,
      password_hash,
      openid: null,
      avatar_url: null,
      role: UserRole.USER,
      agreed_privacy_at: new Date(),
    });
```

改为:

```ts
    const user = this.userRepo.create({
      user_id: uuidv4(),
      nickname: '',
      phone,
      password_hash,
      openid: null,
      role: UserRole.USER,
      agreed_privacy_at: new Date(),
    });
```

- [ ] **Step 4: 删除 sanitizeUser 中的 avatar_url 返回字段**

在 `sanitizeUser()` 方法 (原第 203-213 行) 中删除 `avatar_url: user.avatar_url,` 行 (原第 208 行):

把:

```ts
  private sanitizeUser(user: User) {
    return {
      user_id: user.user_id,
      nickname: user.nickname,
      phone: user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
      avatar_url: user.avatar_url,
      openid: user.openid,
      role: user.role,
      created_at: user.created_at,
    };
  }
```

改为:

```ts
  private sanitizeUser(user: User) {
    return {
      user_id: user.user_id,
      nickname: user.nickname,
      phone: user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
      openid: user.openid,
      role: user.role,
      created_at: user.created_at,
    };
  }
```

- [ ] **Step 5: 验证无 avatar_url 残留**

```bash
cd F:/swcup2026 && grep -n "avatar" backend/src/auth/auth.service.ts
```

Expected: 无输出.

- [ ] **Step 6: 提交**

```bash
git add backend/src/auth/auth.service.ts
git commit -m "refactor(auth): remove avatar_url handling from login/register/sanitize"
```

---

### Task 6: 清理 users.service.ts (删 resetAvatar + DTO)

**Files:**
- Modify: `backend/src/users/users.service.ts:25, 30-34`

- [ ] **Step 1: 改 update DTO 类型**

打开 `backend/src/users/users.service.ts`, 第 25 行:

把:

```ts
  async update(user_id: string, dto: { nickname?: string; avatar_url?: string }) {
```

改为:

```ts
  async update(user_id: string, dto: { nickname?: string }) {
```

- [ ] **Step 2: 删除 resetAvatar 方法**

删除第 30-34 行 (整个 resetAvatar 方法):

```ts
  async resetAvatar(user_id: string) {
    const user = await this.userRepo.findOne({ where: { user_id } });
    if (!user) throw new Error('用户不存在');
    await this.userRepo.update({ user_id }, { avatar_url: null });
  }
```

- [ ] **Step 3: 验证**

```bash
cd F:/swcup2026 && grep -n "avatar" backend/src/users/users.service.ts
```

Expected: 无输出. 文件应剩 ~28 行 (原 35 行减 7 行).

- [ ] **Step 4: 提交**

```bash
git add backend/src/users/users.service.ts
git commit -m "refactor(users): drop resetAvatar method and avatar_url DTO field"
```

---

### Task 7: 清理 users.controller.ts (删 2 端点 + 删 multer import)

**Files:**
- Modify: `backend/src/users/users.controller.ts`
- Delete (Phase 2 已 rm): `backend/src/common/multer.config.ts`

- [ ] **Step 1: 用新内容完整覆盖 users.controller.ts**

打开 `backend/src/users/users.controller.ts`, 用以下内容完整替换:

```ts
import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('用户')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  getMe(@Request() req: any) {
    return this.usersService.findById(req.user.user_id);
  }

  @Patch('me')
  @ApiOperation({ summary: '更新当前用户信息' })
  updateMe(@Body() dto: { nickname?: string; role?: string }, @Request() req: any) {
    return this.usersService.update(req.user.user_id, dto);
  }
}
```

> 改动说明:
> - 删 `Post, Param, UseInterceptors, UploadedFile` import
> - 删 `AnyFilesInterceptor, FileInterceptor` import
> - 删 `RolesGuard, Roles` import (只在 reset 端点用过)
> - 删 `avatarStorage, avatarFilter` import (multer.config.ts)
> - 删 `POST /v1/users/me/avatar` 端点
> - 删 `POST /v1/users/admin/users/:id/avatar/reset` 端点
> - `updateMe` DTO 去掉 `avatar_url`

- [ ] **Step 2: 验证**

```bash
cd F:/swcup2026 && grep -n "avatar\|multer" backend/src/users/users.controller.ts
```

Expected: 无输出.

- [ ] **Step 3: 验证 multer.config.ts 不再被引用**

```bash
cd F:/swcup2026 && grep -rn "multer.config" backend/src/
```

Expected: 无输出.

- [ ] **Step 4: 一并提交 controller + multer 删除**

```bash
git add backend/src/users/users.controller.ts backend/src/common/multer.config.ts
git commit -m "refactor(users): remove avatar upload/reset endpoints and multer config"
```

---

## Phase 4: 后端构建 + 重启

### Task 8: 重新构建 + 重启后端

- [ ] **Step 1: TypeScript 编译检查**

```bash
cd F:/swcup2026/backend && npm run build
```

Expected: 编译成功, 无 TS 错误 (尤其检查不存在 "Property 'avatar_url' does not exist on type 'User'" 之类错误).

- [ ] **Step 2: 重启后端 (npm run start:dev 已运行)**

如果有 `npm run start:dev` watch 进程运行, 它会自动 reload. 如果没有, 手动启动:

```bash
cd F:/swcup2026/backend && npm run start:dev
```

Expected: NestJS 启动成功, 输出 `Nest application successfully started`, 监听 3000 端口.

- [ ] **Step 3: 烟雾测试 — 调 /v1/users/me 接口**

```bash
curl -sS -X GET http://192.168.32.1:3000/v1/users/me -H "Authorization: Bearer <test-token>" | head -20
```

Expected: 返回 user 对象, 字段中 **不含 `avatar_url`**.

> 如果没有方便的 test-token, 用任意手机号登录获取一个: `curl -sS -X POST http://192.168.32.1:3000/v1/auth/login -H "Content-Type: application/json" -d '{"phone":"13800000002","password":"password123"}'` (来自 seed 测试账号).

- [ ] **Step 4: 烟雾测试 — 旧端点应 404**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://192.168.32.1:3000/v1/users/me/avatar
```

Expected: `404`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://192.168.32.1:3000/v1/users/admin/users/test-id/avatar/reset
```

Expected: `404`.

---

## Phase 5: 前端 user 端改动

### Task 9: 清理 miniapp-user/src/pages/user/index.vue

**Files:**
- Modify: `miniapp-user/src/pages/user/index.vue:5-18, 105, 126, 159-225, 279-313`

- [ ] **Step 1: 删除 template 中的 avatar 块**

打开文件, 删除第 5-18 行 (整个 `<view class="user-avatar-wrap">` 块):

```vue
      <view class="user-avatar-wrap">
        <image
          class="user-avatar"
          :src="user.avatar_url || '/static/mock/avatar-default.png'"
          mode="aspectFill"
          @error="onAvatarError"
        />
                <view class="avatar-edit" @click="onEditAvatar">
         <text>✎</text>
        </view>
        <view v-if="user.openid && user.avatar_url" class="avatar-reset-btn" @click="onResetWechatAvatar">
          <text>恢复微信头像</text>
        </view>
      </view>
```

删除后, `<view class="user-card">` 的子元素直接从 `<view class="user-info">` 开始.

- [ ] **Step 2: 删除 import 中 apiUpdateAvatar / apiResetWechatAvatar**

第 105 行原 import:

```ts
import { apiGetCurrentUser, apiGetMyClaims, apiUpdateAvatar, apiResetWechatAvatar } from '@/services/api'
```

改为:

```ts
import { apiGetCurrentUser, apiGetMyClaims } from '@/services/api'
```

- [ ] **Step 3: 删除 user ref 中的 avatar_url 字段**

第 123-128 行 user ref 初始化:

把:

```ts
const user = ref<any>({
  nickname: '加载中...',
  phone: '',
  avatar_url: '',
  role: 'user'
})
```

改为:

```ts
const user = ref<any>({
  nickname: '加载中...',
  phone: '',
  role: 'user'
})
```

- [ ] **Step 4: 删除 onAvatarError / onEditAvatar / uploadAvatar / onResetWechatAvatar 4 个函数**

删除第 159-225 行的 4 个函数 (整段):

```ts
function onAvatarError() {
  user.value.avatar_url = '/static/mock/avatar-default.png'
}

function onEditAvatar() {
  if (user.value.openid) {
    // 微信用户：显示选择菜单
    uni.showActionSheet({
      itemList: ['从微信头像选', '从相册选择'],
      success: (res: any) => {
        if (res.tapIndex === 0) {
          uni.chooseAvatar({
            success: (res: any) => uploadAvatar(res.avatarUrl),
          });
        } else {
          uni.chooseImage({
            count: 1,
            sourceType: ['album'],
            success: (res: any) => uploadAvatar(res.tempFilePaths[0]),
          });
        }
      }
    });
  } else {
    // 手机号用户：从相册选
    uni.chooseImage({
      count: 1,
      sourceType: ['album'],
      success: (res: any) => uploadAvatar(res.tempFilePaths[0]),
    });
  }
}

async function uploadAvatar(filePath: string) {
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

async function onResetWechatAvatar() {
  uni.showModal({
    title: '恢复微信头像',
    content: '确定要恢复为微信头像吗？',
    success: async (res: any) => {
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

删除后, `goToMyReports()` 直接接在 `onUnmounted()` 之后.

- [ ] **Step 5: 删除 style 中的 .user-avatar-wrap / .user-avatar / .avatar-edit / .avatar-reset-btn 样式**

删除第 279-313 行的 5 个样式块:

```scss
.user-avatar-wrap {
  position: relative;
  margin-right: 24rpx;
}

.user-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.2);
}

.avatar-edit {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40rpx;
  height: 40rpx;
  background: #FFFFFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  color: #0FBF9F;
}

.avatar-reset-btn {
  margin-left: 44px;
  margin-top: 8px;
  font-size: 22rpx;
  color: #0FBF9F;
  text-align: center;
}
```

删除后, `.user-info` 直接接在 `.user-card` 之后.

- [ ] **Step 6: 验证 — 文件无 avatar 残留**

```bash
cd F:/swcup2026 && grep -n "avatar" miniapp-user/src/pages/user/index.vue
```

Expected: 无输出.

- [ ] **Step 7: 提交**

```bash
git add miniapp-user/src/pages/user/index.vue
git commit -m "refactor(user-page): remove avatar display, edit, and reset UI"
```

---

### Task 10: 清理 miniapp-user/src/services/api.js (删 2 函数)

**Files:**
- Modify: `miniapp-user/src/services/api.js:142-181`

- [ ] **Step 1: 删除 apiUpdateAvatar 函数 (含注释)**

打开文件, 删除第 142-171 行:

```js
/**
 * 上传头像
 * POST /v1/users/me/avatar
 * 请求: filePath - 文件临时路径
 */
export function apiUpdateAvatar(filePath) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token')
    const header = {}
    if (token) {
      header['Authorization'] = 'Bearer ' + token
    }

    uni.uploadFile({
      url: BASE_URL + '/v1/users/me/avatar',
      filePath,
      name: 'file',
      header,
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(res)
          return
        }
        const data = JSON.parse(res.data)
        resolve(data)
      },
      fail: reject,
    })
  })
}
```

- [ ] **Step 2: 删除 apiResetWechatAvatar 函数 (含注释)**

删除原第 173-181 行:

```js
/**
 * 重置微信头像
 * POST /v1/users/me/avatar/wechat
 */
export function apiResetWechatAvatar() {
  return request('/v1/users/me/avatar/wechat', {
    method: 'POST'
  })
}
```

删除后, `apiReportEvent` 注释直接接在 `apiUpdateCurrentUser` 函数之后.

- [ ] **Step 3: 验证**

```bash
cd F:/swcup2026 && grep -n "avatar" miniapp-user/src/services/api.js
```

Expected: 无输出.

- [ ] **Step 4: 提交**

```bash
git add miniapp-user/src/services/api.js
git commit -m "refactor(user-api): drop apiUpdateAvatar and apiResetWechatAvatar functions"
```

---

### Task 11: 清理 miniapp-user/src/services/mock.js

**Files:**
- Modify: `miniapp-user/src/services/mock.js:199-206`

- [ ] **Step 1: 删除 mockUser 中的 avatar_url 字段**

打开文件, 第 199-206 行:

把:

```js
export const mockUser = {
  user_id: 'u001',
  nickname: '爱心市民',
  phone: '138****8000',
  avatar_url: '/static/mock/avatar-default.png',
  role: 'user',
  created_at: '2026-04-01T00:00:00Z'
}
```

改为:

```js
export const mockUser = {
  user_id: 'u001',
  nickname: '爱心市民',
  phone: '138****8000',
  role: 'user',
  created_at: '2026-04-01T00:00:00Z'
}
```

- [ ] **Step 2: 验证**

```bash
cd F:/swcup2026 && grep -n "avatar" miniapp-user/src/services/mock.js
```

Expected: 无输出.

- [ ] **Step 3: 提交**

```bash
git add miniapp-user/src/services/mock.js
git commit -m "refactor(user-mock): remove avatar_url from mockUser"
```

---

## Phase 6: 前端 admin 端改动

### Task 12: 清理 miniapp-admin/src/pages/users/index.vue (列表页)

**Files:**
- Modify: `miniapp-admin/src/pages/users/index.vue:38, 236-243`

- [ ] **Step 1: 删除列表行的 `<image class="user-avatar">`**

打开文件, 删除第 38 行:

```vue
        <image class="user-avatar" src="/static/mock/avatar-default.png" mode="aspectFill" />
```

删除后, `<view class="user-info">` 直接是 `user-row` 的第一个子元素.

- [ ] **Step 2: 删除 `.user-avatar` 样式块**

删除第 236-243 行:

```scss
.user-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  margin-right: 16rpx;
  background: #F5F5F5;
  flex-shrink: 0;
}
```

删除后, `.user-info` 样式直接接在 `.user-row-blocked` 之后.

- [ ] **Step 3: 验证**

```bash
cd F:/swcup2026 && grep -n "avatar" miniapp-admin/src/pages/users/index.vue
```

Expected: 无输出.

- [ ] **Step 4: 提交**

```bash
git add miniapp-admin/src/pages/users/index.vue
git commit -m "refactor(admin-users-list): remove avatar image and CSS"
```

---

### Task 13: 清理 miniapp-admin/src/pages/users/detail/index.vue (详情页)

**Files:**
- Modify: `miniapp-admin/src/pages/users/detail/index.vue:27-32, 177, 393-409, 462-464`

- [ ] **Step 1: 删除 template 中 avatar-section 整块**

打开文件, 删除第 27-32 行:

```vue
          <view class="avatar-section">
            <image class="avatar" :src="resolveImageUrl(userInfo.avatar) || '/static/mock/avatar-default.png'" mode="aspectFill" />
            <view class="avatar-reset" @tap="onResetAvatar">
              <text>重置头像</text>
            </view>
          </view>
```

删除后, `<view class="user-header">` 的子元素直接从 `<view class="user-base">` 开始.

- [ ] **Step 2: 删除 import 中的 apiResetUserAvatar**

第 177 行原 import:

```ts
import { apiGetUserDetail, apiGetUserEvents, apiGetUserClaims, apiGetUserAnimals, apiUpdateUser, apiResetUserAvatar, resolveImageUrl } from '@/services/api'
```

改为:

```ts
import { apiGetUserDetail, apiGetUserEvents, apiGetUserClaims, apiGetUserAnimals, apiUpdateUser, resolveImageUrl } from '@/services/api'
```

- [ ] **Step 3: 删除 onResetAvatar 函数**

删除第 393-409 行 (整个 onResetAvatar 函数):

```ts
async function onResetAvatar() {
  uni.showModal({
    title: '重置头像',
    content: '确定要重置该用户的头像吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await apiResetUserAvatar(userId.value)
          uni.showToast({ title: '已重置', icon: 'success' })
          loadUserDetail()
        } catch (e) {
          uni.showToast({ title: '重置失败', icon: 'none' })
        }
      }
    }
  })
}
```

删除后, `function goBack()` 直接接在 `toggleBlock` 之后.

- [ ] **Step 4: 删除 style 中的 .avatar / .avatar-section / .avatar-reset 样式**

第 462-464 行:

把:

```scss
.avatar { width: 100rpx; height: 100rpx; border-radius: 50%; margin-right: 20rpx; background: #F5F5F5; flex-shrink: 0; }
.avatar-section { position: relative; display: inline-block; }
.avatar-reset { font-size: 20rpx; color: #FF6B6B; text-align: center; margin-top: 4rpx; }
```

整段删除. 删除后, `.user-base` 直接接在 `.user-header` 之后.

- [ ] **Step 5: 验证**

```bash
cd F:/swcup2026 && grep -n "avatar\|Avatar" miniapp-admin/src/pages/users/detail/index.vue
```

Expected: 无输出.

- [ ] **Step 6: 提交**

```bash
git add miniapp-admin/src/pages/users/detail/index.vue
git commit -m "refactor(admin-user-detail): remove avatar section and reset button"
```

---

### Task 14: 清理 miniapp-admin/src/services/api.js (删 1 函数)

**Files:**
- Modify: `miniapp-admin/src/services/api.js:241-249`

- [ ] **Step 1: 删除 apiResetUserAvatar 函数**

打开文件, 删除第 241-249 行:

```js
/**
 * 重置用户头像
 * POST /admin/users/:user_id/avatar/reset
 */
export function apiResetUserAvatar(userId) {
  return request(`/users/admin/users/${userId}/avatar/reset`, {
    method: 'POST',
  })
}
```

删除后, `apiGetCurrentUser` 注释直接接在 `apiUpdateUser` 函数之后.

- [ ] **Step 2: 验证**

```bash
cd F:/swcup2026 && grep -n "avatar\|Avatar" miniapp-admin/src/services/api.js
```

Expected: 无输出.

- [ ] **Step 3: 提交**

```bash
git add miniapp-admin/src/services/api.js
git commit -m "refactor(admin-api): drop apiResetUserAvatar function"
```

---

## Phase 7: Seed 同步

### Task 15: 更新 backend/seed.sql

**Files:**
- Modify: `backend/seed.sql:19-29`

- [ ] **Step 1: 修改 INSERT INTO users 语句, 删 avatar_url 字段**

打开 `backend/seed.sql`, 第 19-29 行:

把:

```sql
INSERT INTO users (user_id, nickname, phone, avatar_url, role, created_at, updated_at) VALUES
('u-admin-0001-0000-0000-000000000001', '管理员A',          '13900000001', '', 'admin', '2026-04-01 10:00:00', '2026-05-13 12:00:00'),
('u-user1-0001-0000-0000-000000000002', '李明',            '13800000002', '', 'user',  '2026-04-05 10:00:00', '2026-05-13 12:00:00'),
('u-user2-0001-0000-0000-000000000003', '王小红',          '13800000003', '', 'user',  '2026-04-06 10:00:00', '2026-05-13 12:00:00'),
('u-user3-0001-0000-0000-000000000004', '张小华',          '13800000004', '', 'user',  '2026-04-07 10:00:00', '2026-05-13 12:00:00'),
('u-user4-0001-0000-0000-000000000005', '陈建国',          '13800000005', '', 'user',  '2026-04-08 10:00:00', '2026-05-13 12:00:00'),
('u-user5-0001-0000-0000-000000000006', '刘秀英',          '13800000006', '', 'user',  '2026-04-09 10:00:00', '2026-05-13 12:00:00'),
('u-user6-0001-0000-0000-000000000007', '赵大力',          '13800000007', '', 'user',  '2026-04-10 10:00:00', '2026-05-13 12:00:00'),
('u-user7-0001-0000-0000-000000000008', '周小燕',          '13800000008', '', 'user',  '2026-04-11 10:00:00', '2026-05-13 12:00:00'),
('u-org1--0001-0000-0000-000000000009', '上海宠物救助站',  '13800000010', '', 'org',   '2026-03-01 10:00:00', '2026-05-13 12:00:00'),
('u-org2--0001-0000-0000-000000000010', '北京流浪动物保护中心','13800000011', '','org',  '2026-03-10 10:00:00', '2026-05-13 12:00:00');
```

改为:

```sql
INSERT INTO users (user_id, nickname, phone, role, created_at, updated_at) VALUES
('u-admin-0001-0000-0000-000000000001', '管理员A',          '13900000001', 'admin', '2026-04-01 10:00:00', '2026-05-13 12:00:00'),
('u-user1-0001-0000-0000-000000000002', '李明',            '13800000002', 'user',  '2026-04-05 10:00:00', '2026-05-13 12:00:00'),
('u-user2-0001-0000-0000-000000000003', '王小红',          '13800000003', 'user',  '2026-04-06 10:00:00', '2026-05-13 12:00:00'),
('u-user3-0001-0000-0000-000000000004', '张小华',          '13800000004', 'user',  '2026-04-07 10:00:00', '2026-05-13 12:00:00'),
('u-user4-0001-0000-0000-000000000005', '陈建国',          '13800000005', 'user',  '2026-04-08 10:00:00', '2026-05-13 12:00:00'),
('u-user5-0001-0000-0000-000000000006', '刘秀英',          '13800000006', 'user',  '2026-04-09 10:00:00', '2026-05-13 12:00:00'),
('u-user6-0001-0000-0000-000000000007', '赵大力',          '13800000007', 'user',  '2026-04-10 10:00:00', '2026-05-13 12:00:00'),
('u-user7-0001-0000-0000-000000000008', '周小燕',          '13800000008', 'user',  '2026-04-11 10:00:00', '2026-05-13 12:00:00'),
('u-org1--0001-0000-0000-000000000009', '上海宠物救助站',  '13800000010', 'org',   '2026-03-01 10:00:00', '2026-05-13 12:00:00'),
('u-org2--0001-0000-0000-000000000010', '北京流浪动物保护中心','13800000011', 'org',  '2026-03-10 10:00:00', '2026-05-13 12:00:00');
```

- [ ] **Step 2: 验证**

```bash
cd F:/swcup2026 && grep -n "avatar" backend/seed.sql
```

Expected: 无输出.

- [ ] **Step 3: 提交**

```bash
git add backend/seed.sql
git commit -m "chore(seed-sql): drop avatar_url field from users INSERT"
```

---

### Task 16: 更新 backend/seed.py

**Files:**
- Modify: `backend/seed.py:67-73`

- [ ] **Step 1: 修改 INSERT INTO users 语句**

打开 `backend/seed.py`, 第 67-73 行:

把:

```python
for key, phone, nickname, role in users:
    uid_val = uid()
    cur.execute(
        "INSERT INTO users (user_id, nickname, phone, avatar_url, role, created_at, updated_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (uid_val, nickname, phone, '', role, ts(30), ts())
    )
    user_ids[key] = uid_val
```

改为:

```python
for key, phone, nickname, role in users:
    uid_val = uid()
    cur.execute(
        "INSERT INTO users (user_id, nickname, phone, role, created_at, updated_at) "
        "VALUES (%s,%s,%s,%s,%s,%s)",
        (uid_val, nickname, phone, role, ts(30), ts())
    )
    user_ids[key] = uid_val
```

> 改动: SQL 中去掉 `avatar_url` 列名 + 一个 `%s`. 参数元组中去掉 `''` (原 avatar_url 占位).

- [ ] **Step 2: 验证**

```bash
cd F:/swcup2026 && grep -n "avatar" backend/seed.py
```

Expected: 无输出.

- [ ] **Step 3: 提交**

```bash
git add backend/seed.py
git commit -m "chore(seed-py): drop avatar_url field from users INSERT"
```

---

## Phase 8: 测试 + 收尾

### Task 17: E2E 回归 (27/27 必须通过)

- [ ] **Step 1: 确保后端已重启 (Phase 4 Task 8)**

```bash
curl -sS http://192.168.32.1:3000/v1/admin/stats -H "Authorization: Bearer test" || echo "可达"
```

Expected: 后端响应 (401 也算可达).

- [ ] **Step 2: 运行 E2E 测试**

```bash
cd F:/swcup2026 && node e2e-tests/run-flow-e2e.js
```

Expected: 输出 `27 / 27 PASS` 或同等 100% 通过结果. 因为本 plan 改动不触及任何 E2E 用例覆盖范围 (无 avatar 用例), 应当全绿.

- [ ] **Step 3: 如果失败 — 排查**

如果有用例失败, 重点检查:
1. `auth.service.ts` 中是否 weixinLogin 流程残留 avatarUrl 变量
2. 后端是否还在尝试读 `user.avatar_url`
3. 数据库列是否成功 DROP

如失败需修复, 修完后回到 Step 2 重跑直至 27/27 通过. 不要继续到 Task 18.

---

### Task 18: 手动验证 8 项

对照 spec §7.3:

- [ ] **Step 1: 验证微信授权登录无 userinfo 请求**

通过开发者工具的 Network 面板, 在 user 端做一次微信登录 (或检查后端日志). Expected: 后端不再调 `https://api.weixin.qq.com/sns/userinfo`.

数据库验证:
```bash
docker exec -i swcup2026-db mysql -uroot -prootpassword -e "SELECT avatar_url FROM nose_rescue.users LIMIT 1;" 2>&1 | head -5
```
Expected: `ERROR ... Unknown column 'avatar_url' in 'field list'`.

- [ ] **Step 2: user 端个人中心不显示头像**

启动 `miniapp-user` (`npm run dev:mp-weixin`), 用 13800000002 / password123 登录, 进入"我的"页. Expected: 用户信息卡片中无头像区域, 只显示昵称+电话+角色标签.

- [ ] **Step 3: user 端调旧的上传头像端点返 404**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://192.168.32.1:3000/v1/users/me/avatar -H "Authorization: Bearer <user-token>"
```
Expected: `404`.

- [ ] **Step 4: admin 用户列表不显示头像**

启动 `miniapp-admin`, 用 13900000001 / password123 (admin) 登录, 进入用户列表. Expected: 每行用户不显示圆形头像缩略图, 直接是 nickname + 手机 + 注册时间.

- [ ] **Step 5: admin 用户详情不显示头像 + 无"重置头像"按钮**

在用户列表点"查看详情". Expected:
- 用户基本信息卡顶部无圆形头像
- 无"重置头像"红色文字按钮
- 名字/角色/电话/注册时间正常显示
- "编辑信息"和"禁用/启用"按钮仍正常

- [ ] **Step 6: admin 端调旧的重置头像端点返 404**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://192.168.32.1:3000/v1/users/admin/users/u-user1-0001-0000-0000-000000000002/avatar/reset -H "Authorization: Bearer <admin-token>"
```
Expected: `404`.

- [ ] **Step 7: admin audit-detail 动物候选 fallback 仍工作**

进入 admin 端的"事件审核详情"页, 找一个 `candidates[].photos` 为空的动物候选. Expected: 仍能看到 `/static/mock/avatar-default.png` 作为占位图 (说明此文件**未被误删**).

- [ ] **Step 8: seed.sql 重跑无错误**

```bash
docker exec -i swcup2026-db mysql -uroot -prootpassword nose_rescue < backend/seed.sql
```
Expected: 全部 INSERT 成功, 输出 5 行统计 (users=10, animals=12, nose_features=37, rescue_events=15, claims=8). 无 `Unknown column 'avatar_url'` 错误.

---

### Task 19: 最终收尾

- [ ] **Step 1: 检查 git 状态干净**

```bash
cd F:/swcup2026 && git status
```

Expected: `working tree clean` 或仅有 untracked 的 logs/build 产物.

- [ ] **Step 2: 检查全代码库无 avatar_url 残留 (核心代码区)**

```bash
cd F:/swcup2026 && grep -rn "avatar_url\|avatarUrl\|apiUpdateAvatar\|apiResetWechatAvatar\|apiResetUserAvatar\|resetAvatar" backend/src miniapp-user/src miniapp-admin/src
```

Expected: 无输出 (零匹配).

- [ ] **Step 3: 核心代码区无 user-avatar / avatar-edit / avatar-reset / avatar-section CSS 选择器残留**

```bash
cd F:/swcup2026 && grep -rn "user-avatar\|avatar-edit\|avatar-reset\|avatar-section" miniapp-user/src miniapp-admin/src
```

Expected: 无输出.

- [ ] **Step 4: 验证 avatar-default.png 文件仍存在 (供 audit-detail 用)**

```bash
ls F:/swcup2026/miniapp-admin/src/static/mock/avatar-default.png
ls F:/swcup2026/miniapp-user/src/static/mock/avatar-default.png
```

Expected: 两个文件都存在.

- [ ] **Step 5: 查看 commit 历史**

```bash
cd F:/swcup2026 && git log --oneline -20
```

Expected: 看到本 plan 涉及的 ~14 个 commit (Task 1-16, 每个 task 1 commit, Task 2 含 2 commit).

---

## 完成标准

- [ ] 19 个 Task 全部勾选完成
- [ ] E2E 27/27 通过
- [ ] 手动验证 8 项全部 PASS
- [ ] 无 avatar 相关代码/CSS/字段残留 (核心 `backend/src` + `miniapp-*/src`)
- [ ] `static/mock/avatar-default.png` 保留 (audit-detail 候选 fallback)
- [ ] seed.sql 与 seed.py 均成功重跑

---

## 风险与回滚

| 风险 | 缓解 |
|------|------|
| ALTER 后无法回滚 | 理论上可 `ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL` 恢复列, 但数据 (图片文件 + DB 内容) 已彻底丢失 |
| 后端 build 失败 (Task 7 之前) | multer.config.ts 已删但 controller 仍 import — 这是预期, 因此 Task 4 与 Task 7 必须在同一组 commit 内串行执行, 中间不要 build |
| E2E 失败但跟头像无关 | 现有 E2E 跑过 27/27 (在删头像前), 如失败应该跟本改动无关, 可拉 git log 找近 24h 其他改动 |
| 前端编译失败 | 检查 import 是否漏删, 全文搜 `apiUpdateAvatar` / `apiResetWechatAvatar` / `apiResetUserAvatar` |

---

## Spec 覆盖核对

| Spec 章节 | 对应 Task |
|---------|----------|
| §2.1 DROP COLUMN | Task 1, 2 |
| §2.2 静态资源清理 (avatars 目录) | Task 2 |
| §3.1 user.entity.ts | Task 3 |
| §3.2 auth.service.ts | Task 5 |
| §3.3 users.service.ts | Task 6 |
| §3.4 users.controller.ts | Task 7 |
| §3.5 common/multer.config.ts | Task 4, 7 (联合 commit) |
| §4.1 user/index.vue | Task 9 |
| §4.2 user services/api.js | Task 10 |
| §4.3 user services/mock.js | Task 11 |
| §4.4 user static (保留) | Task 19 Step 4 (验证保留) |
| §5.1 admin users/index.vue | Task 12 |
| §5.2 admin users/detail/index.vue | Task 13 |
| §5.3 admin services/api.js | Task 14 |
| §5.4 admin static (保留) | Task 19 Step 4 |
| §5.5 admin audit-detail/index.vue 不动 | (无 task, 默认不动) |
| §6.1 seed.sql | Task 15 |
| §6.2 seed.py | Task 16 |
| §7.1 兼容 (apiUpdateUser admin 接受 avatar 字段无副作用) | (隐含: 删 entity 后, 后端 update 自动忽略 avatar 字段) |
| §7.2 E2E 27/27 | Task 17 |
| §7.3 手动验证 8 项 | Task 18 |
