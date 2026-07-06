# 去掉用户头像功能 — 设计

> 日期：2026-06-13
> 状态：已确认 (用户 5 段全部同意)
> 范围：数据库 + 后端 + 前端 (user 端 + admin 端)
> 不在范围: animal 候选照片的 fallback 占位图 (audit-detail 页继续使用 `static/mock/avatar-default.png`)

---

## 1. 目标

完整剔除用户头像功能. 范围覆盖:

- 数据库列 `users.avatar_url` DROP
- 后端 2 个上传/重置接口删除
- 后端实体、服务、multer 配置清理
- 后端微信授权登录不再拉取 userinfo (headimgurl)
- 前端 user 端: 个人中心头像 UI/API 调用清理
- 前端 admin 端: 用户列表/详情头像 UI/API 调用清理
- seed.sql / seed.py 同步更新

**保留:** `static/mock/avatar-default.{png,svg}` (admin `audit-detail/index.vue` 动物候选照片 fallback 仍用)

---

## 2. 数据库改动

### 2.1 DROP COLUMN

`backend/scripts/migrate-2026-06-13-drop-avatar-url.sql` (新增文件):

```sql
USE nose_rescue;
ALTER TABLE users DROP COLUMN avatar_url;
```

执行方式 (跟现有 seed.sql 风格一致):

```bash
docker exec -i swcup2026-db mysql -uroot -prootpassword nose_rescue < backend/scripts/migrate-2026-06-13-drop-avatar-url.sql
```

> 备注: TypeORM `synchronize:true` 只会 ADD 不会 DROP, 所以走手工 ALTER.

### 2.2 静态资源清理

- `backend/static/uploads/avatars/` 目录 (2 个历史文件) — 整个目录删除
- `miniapp-user/src/static/mock/avatar-default.png` / `.svg` — **保留**
- `miniapp-admin/src/static/mock/avatar-default.png` / `.svg` — **保留**

---

## 3. 后端改动 (5 个文件)

### 3.1 `users/entities/user.entity.ts`

删除:

```ts
@Column({ type: 'varchar', length: 255, nullable: true, name: 'avatar_url' })
avatar_url: string;
```

### 3.2 `auth/auth.service.ts`

- 删除 `wxLogin` 函数中拉取 `userinfo` 的整段代码 (`fetch userinfo` + `headimgurl` 提取)
- 删除 `wxLogin` 中 `let avatarUrl: string | null = null;` 声明 + `userRepo.create({ avatar_url: avatarUrl, ... })` 中的 avatar_url 字段
- 删除 `buildMeResponse` 中 `avatar_url: user.avatar_url` 返回字段
- 删除 `phoneRegister` 中 `avatar_url: null` 字段
- 微信 `access_token` 仍然要拿 (用于后续接口), 仅仅不再 fetch userinfo

### 3.3 `users/users.service.ts`

- `update(user_id, dto)` 方法: 删除 `avatar_url` 字段 (DTO 类型不需再声明)
- 整个 `resetAvatar(user_id)` 方法删除

### 3.4 `users/users.controller.ts`

- 整个 `POST /v1/users/me/avatar` (上传头像) 端点删除 (含 FileInterceptor)
- 整个 `POST /v1/users/admin/users/:id/avatar/reset` (管理员重置头像) 端点删除
- 整个 `multer` 相关 import 删除
- `updateMe` DTO 类型不需 `avatar_url` 字段

### 3.5 `common/multer.config.ts`

整个文件删除 (它只为 2 个 avatar 端点服务).

---

## 4. 前端 user 端改动 (4 个文件)

### 4.1 `miniapp-user/src/pages/user/index.vue`

- 删除 `<view class="user-avatar-wrap">` 整个块 (display image + edit button + 恢复微信头像 button)
- 删除 `onEditAvatar` / `onResetWechatAvatar` / `onAvatarError` 三个函数
- 删除 `user` ref 中 `avatar_url: ''` 字段
- 删除 `user.value.avatar_url = '/static/mock/avatar-default.png'` 兜底赋值
- 删除 `.user-avatar` / `.avatar-edit` / `.avatar-reset-btn` 样式

### 4.2 `miniapp-user/src/services/api.js`

- 删除 `apiUpdateAvatar(filePath)` 函数
- 删除 `apiResetWechatAvatar()` 函数
- 顶部注释 `POST /v1/users/me/avatar` 等删

### 4.3 `miniapp-user/src/services/mock.js`

- mock user 对象中 `avatar_url: '/static/mock/avatar-default.png'` 字段删

### 4.4 静态资源

- `static/mock/avatar-default.png` / `.svg` — **保留** (供 admin animal fallback)

---

## 5. 前端 admin 端改动 (3 个文件)

### 5.1 `miniapp-admin/src/pages/users/index.vue` (列表页)

- 删除 list 行开头的 `<image class="user-avatar" src="/static/mock/avatar-default.png" .../>`
- 删除 `.user-avatar` 样式块

### 5.2 `miniapp-admin/src/pages/users/detail/index.vue` (详情页)

- 删除 `<view class="avatar-section">...</view>` 整块 (含重置头像 button)
- 删除 `onResetAvatar` 函数 (含 showModal 确认弹窗)
- 删除 `.avatar` / `.avatar-section` / `.avatar-reset` 样式

### 5.3 `miniapp-admin/src/services/api.js`

- 删除 `apiResetUserAvatar(userId)` 函数
- 顶部注释 `POST /admin/users/:user_id/avatar/reset` 删

### 5.4 静态资源

- `static/mock/avatar-default.png` / `.svg` — **保留** (animal 候选 fallback)

### 5.5 `miniapp-admin/src/pages/admin/audit-detail/index.vue`

- **不动** (animal candidate 照片 fallback 用的就是 `avatar-default.png`, 不属用户头像范畴)

---

## 6. Seed 改动 (2 个文件)

### 6.1 `backend/seed.sql`

- users INSERT 语句中 `avatar_url` 字段删除

### 6.2 `backend/seed.py`

- 同步删除

---

## 7. 兼容 + 测试

### 7.1 向后兼容

- 已有的 `apiUpdateUser(admin)` 接口仍接受 `avatar` 字段 (前端的 DTO 类型), 但后端不读不写 (无副作用)
- 历史 user 表中如果还存在 `avatar_url` 列, 迁移脚本会 DROP 干净

### 7.2 E2E 回归

`node e2e-tests/run-flow-e2e.js` 必须仍 27/27 通过 (无 avatar 相关用例, 不影响).

### 7.3 手动验证清单 (8 项)

| # | 验证项 | 预期 |
|---|------|------|
| 1 | 微信授权登录 | 不再请求 userinfo; DB 查 `SELECT avatar_url FROM users` 报列不存在 |
| 2 | user 端个人中心 | 不显示头像 |
| 3 | user 端调用 `POST /v1/users/me/avatar` | 404 |
| 4 | admin 用户列表 | 不显示头像 |
| 5 | admin 用户详情 | 不显示头像 + 无"重置头像"按钮 |
| 6 | admin 详情页调 `POST /v1/users/admin/users/:id/avatar/reset` | 404 |
| 7 | admin audit-detail 动物候选 fallback | 仍显示 `avatar-default.png` |
| 8 | seed.sql 重跑 | 不含 `avatar_url` |

---

## 8. 风险

| 风险 | 等级 | 缓解 |
|------|------|------|
| 历史头像数据丢失 | 低 | 用户明确接受 |
| 微信登录链路改动 | 中 | access_token 仍正常获取, 仅去掉 userinfo 一次 HTTP 调用, 不影响后续接口 |
| audit-detail animal fallback 误删 | 低 | 用户明确"只去用户头像", animal fallback 保留; 文件不删, 仅代码不改 |
| DDL 不可逆 | 中 | 备份原始 schema 截图; 迁移脚本独立文件, 易于回滚 (理论上能 `ADD COLUMN` 回去, 数据没丢只是目录删了) |
| 前端组件遗留空 class | 低 | 同步删 CSS 块, 避免 dead style |

---

## 9. 实施顺序 (后续 writing-plans 会拆更细)

1. 数据库迁移脚本落地 + 执行 ALTER
2. 后端 5 文件改动 + 重启
3. 前端 user 端 4 文件改动 + 编译
4. 前端 admin 端 3 文件改动 + 编译
5. seed 双文件同步
6. E2E 27/27 回归
7. 手动验证 8 项
