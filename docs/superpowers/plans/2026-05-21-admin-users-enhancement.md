# 管理端用户管理增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强管理端用户管理功能，补齐用户编辑、禁用、活动记录查看能力

**Architecture:** 前端新增用户详情页 + 编辑 Modal，后端新增 4 个活动记录 API + 1 个更新用户 API。前端列表页增加操作列和禁用开关。

**Tech Stack:** NestJS (后端) + UniApp/Vue3 (前端)

---

## File Structure

| 文件 | 改动类型 | 职责 |
|------|----------|------|
| `miniapp-admin/src/pages/users/index.vue` | 修改 | 用户列表页增强：操作列 + 禁用开关 + 角色筛选 |
| `miniapp-admin/src/pages/users/detail/index.vue` | 新增 | 用户详情页：基本信息卡片 + Tab切换 |
| `miniapp-admin/src/services/api.js` | 修改 | 新增 5 个 API 函数 |
| `backend/src/admin/admin.controller.ts` | 修改 | 新增 5 个路由 |
| `backend/src/admin/admin.service.ts` | 修改 | 新增 4 个活动记录方法 + 1 个更新用户方法 |
| `backend/src/admin/dto/` | 新增 | DTO 类 |

---

## Task 1: 前端 - 用户列表页增强（操作列 + 禁用开关）

**Files:**
- Modify: `miniapp-admin/src/pages/users/index.vue`

- [ ] **Step 1: 读取现有用户列表页代码**

路径：`miniapp-admin/src/pages/users/index.vue`

- [ ] **Step 2: 添加操作列和禁用开关**

在用户列表每行添加：
- 操作列：禁用/启用 `uni-switch` 开关
- 详情按钮：文字链接「查看详情 →」
- 角色筛选：`role` 下拉选项 admin/user/org/blocked

```vue
<!-- 操作列示例 -->
<view class="operation-cell">
  <uni-switch :checked="row.role === 'blocked'" @change="onToggleBlock(row)" />
  <text class="detail-link" @click="goToDetail(row.user_id)">查看详情 →</text>
</view>
```

- [ ] **Step 3: 添加禁用切换方法**

```javascript
const onToggleBlock = async (user) => {
  const newRole = user.role === 'blocked' ? 'user' : 'blocked'
  await apiUpdateUser(user.user_id, { role: newRole })
  loadUsers()
}
```

- [ ] **Step 4: 添加跳转详情方法**

```javascript
const goToDetail = (userId) => {
  uni.navigateTo({ url: `/pages/users/detail/index?user_id=${userId}` })
}
```

- [ ] **Step 5: 提交**

```bash
git add miniapp-admin/src/pages/users/index.vue
git commit -m "feat(admin): 用户列表页增加操作列和禁用开关"
```

---

## Task 2: 前端 - API 服务新增 5 个函数

**Files:**
- Modify: `miniapp-admin/src/services/api.js`

- [ ] **Step 1: 读取现有 api.js**

路径：`miniapp-admin/src/services/api.js`

- [ ] **Step 2: 新增 5 个 API 函数**

```javascript
// 获取用户详情
export const apiGetUserDetail = (userId) => {
  return request.get(`/admin/users/${userId}`)
}

// 获取用户上报事件
export const apiGetUserEvents = (userId, params) => {
  return request.get(`/admin/users/${userId}/events`, params)
}

// 获取用户认领记录
export const apiGetUserClaims = (userId, params) => {
  return request.get(`/admin/users/${userId}/claims`, params)
}

// 获取用户关联动物
export const apiGetUserAnimals = (userId, params) => {
  return request.get(`/admin/users/${userId}/animals`, params)
}

// 更新用户信息
export const apiUpdateUser = (userId, data) => {
  return request.put(`/admin/users/${userId}`, data)
}
```

- [ ] **Step 3: 提交**

```bash
git add miniapp-admin/src/services/api.js
git commit -m "feat(admin): 新增用户详情/事件/认领/动物/更新API函数"
```

---

## Task 3: 后端 - AdminController 新增 5 个路由

**Files:**
- Modify: `backend/src/admin/admin.controller.ts`

- [ ] **Step 1: 读取现有 admin.controller.ts**

路径：`backend/src/admin/admin.controller.ts`

- [ ] **Step 2: 新增 5 个路由方法**

```typescript
@Get('users/:user_id')
async getUserDetail(@Param('user_id') userId: string) {
  return this.adminService.getUserDetail(userId)
}

@Get('users/:user_id/events')
async getUserEvents(@Param('user_id') userId: string, @Query() query: { page?: number; limit?: number }) {
  return this.adminService.getUserEvents(userId, query)
}

@Get('users/:user_id/claims')
async getUserClaims(@Param('user_id') userId: string, @Query() query: { page?: number; limit?: number }) {
  return this.adminService.getUserClaims(userId, query)
}

@Get('users/:user_id/animals')
async getUserAnimals(@Param('user_id') userId: string, @Query() query: { page?: number; limit?: number }) {
  return this.adminService.getUserAnimals(userId, query)
}

@Put('users/:user_id')
async updateUser(@Param('user_id') userId: string, @Body() body: { nickname?: string; phone?: string; role?: string }) {
  return this.adminService.updateUser(userId, body)
}
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/admin/admin.controller.ts
git commit -m "feat(admin): 新增用户详情/事件/认领/动物/更新路由"
```

---

## Task 4: 后端 - AdminService 新增 5 个方法

**Files:**
- Modify: `backend/src/admin/admin.service.ts`

- [ ] **Step 1: 读取现有 admin.service.ts`

路径：`backend/src/admin/admin.service.ts`

- [ ] **Step 2: 新增 getUserDetail 方法**

```typescript
async getUserDetail(userId: string) {
  const user = await this.userRepo.findOne({ where: { user_id: userId } })
  if (!user) throw new Error('User not found')
  return {
    user_id: user.user_id,
    nickname: user.nickname,
    phone: user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
    role: user.role,
    created_at: user.created_at,
  }
}
```

- [ ] **Step 3: 新增 getUserEvents 方法**

```typescript
async getUserEvents(userId: string, query: { page?: number; limit?: number }) {
  const { page = 1, limit = 20 } = query
  const qb = this.eventRepo.createQueryBuilder('e').where('e.reporter_id = :userId', { userId })
  const [list, total] = await qb.orderBy('e.created_at', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount()
  return { total, list: list.map(e => ({
    event_id: e.event_id,
    event_type: e.event_type,
    status: e.status,
    address: e.address,
    occurred_at: e.occurred_at,
    created_at: e.created_at,
  }))}
}
```

- [ ] **Step 4: 新增 getUserClaims 方法**

```typescript
async getUserClaims(userId: string, query: { page?: number; limit?: number }) {
  const { page = 1, limit = 20 } = query
  const qb = this.claimRepo.createQueryBuilder('c').where('c.claimer_id = :userId', { userId })
  const [list, total] = await qb.orderBy('c.created_at', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount()
  return { total, list: list.map(c => ({
    claim_id: c.claim_id,
    animal_id: c.animal_id,
    status: c.status,
    notes: c.notes,
    claimed_at: c.created_at,
  }))}
}
```

- [ ] **Step 5: 新增 getUserAnimals 方法**

```typescript
async getUserAnimals(userId: string, query: { page?: number; limit?: number }) {
  const { page = 1, limit = 20 } = query
  const qb = this.animalRepo.createQueryBuilder('a').where('a.owner_id = :userId', { userId })
  const [list, total] = await qb.orderBy('a.created_at', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount()
  return { total, list: list.map(a => ({
    animal_id: a.animal_id,
    status: a.status,
    breed: a.breed,
    color: a.color,
    address: a.address,
  }))}
}
```

- [ ] **Step 6: 新增 updateUser 方法**

```typescript
async updateUser(userId: string, data: { nickname?: string; phone?: string; role?: string }) {
  const updateData: any = {}
  if (data.nickname) updateData.nickname = data.nickname
  if (data.phone) updateData.phone = data.phone
  if (data.role) updateData.role = data.role
  await this.userRepo.update({ user_id: userId }, updateData)
  return { message: '更新成功' }
}
```

- [ ] **Step 7: 提交**

```bash
git add backend/src/admin/admin.service.ts
git commit -m "feat(admin): 新增用户详情/事件/认领/动物/更新服务方法"
```

---

## Task 5: 前端 - 新建用户详情页

**Files:**
- Create: `miniapp-admin/src/pages/users/detail/index.vue`

- [ ] **Step 1: 创建用户详情页**

路径：`miniapp-admin/src/pages/users/detail/index.vue`

```vue
<template>
  <view class="user-detail-page">
    <!-- 顶部返回 -->
    <view class="nav-bar">
      <uni-icons type="left" size="20" @click="goBack" />
      <text class="nav-title">用户详情</text>
    </view>

    <!-- 用户基本信息卡片 -->
    <view class="info-card">
      <view class="user-avatar">
        <image src="/static/icons/icon-user.png" mode="aspectFill" />
      </view>
      <view class="user-info">
        <view class="nickname">{{ userInfo.nickname }}</view>
        <view class="phone">{{ userInfo.phone }}</view>
        <view class="role-tag" :class="'role-' + userInfo.role">{{ userInfo.role }}</view>
      </view>
    </view>

    <!-- 操作按钮区 -->
    <view class="action-bar">
      <button class="btn-edit" @click="showEditModal = true">编辑信息</button>
      <button class="btn-block" :class="{ 'btn-unblock': userInfo.role === 'blocked' }" @click="toggleBlock">
        {{ userInfo.role === 'blocked' ? '启用' : '禁用' }}
      </button>
    </view>

    <!-- Tab切换 -->
    <view class="tab-bar">
      <view v-for="tab in tabs" :key="tab.key" class="tab-item" :class="{ active: currentTab === tab.key }" @click="switchTab(tab.key)">
        {{ tab.label }}
      </view>
      <view class="tab-indicator" :style="{ left: indicatorLeft }"></view>
    </view>

    <!-- Tab内容 -->
    <scroll-view class="tab-content" scroll-y @scrolltolower="loadMore">
      <view v-for="item in currentList" :key="item.id" class="list-item">
        <!-- 根据不同Tab渲染不同内容 -->
      </view>
      <view v-if="loading" class="loading">加载中...</view>
      <view v-if="!hasMore && currentList.length > 0" class="no-more">没有更多了</view>
    </scroll-view>

    <!-- 编辑Modal -->
    <uni-popup v-if="showEditModal" type="center" @close="showEditModal = false">
      <view class="edit-modal">
        <view class="modal-title">编辑用户信息</view>
        <view class="form-item">
          <text>昵称</text>
          <input v-model="editForm.nickname" placeholder="请输入昵称" />
        </view>
        <view class="form-item">
          <text>电话</text>
          <input v-model="editForm.phone" placeholder="请输入电话" />
        </view>
        <view class="form-item">
          <text>角色</text>
          <picker :value="roleIndex" :range="roleOptions" @change="onRoleChange">
            <view class="picker-value">{{ editForm.role }}</view>
          </picker>
        </view>
        <view class="modal-actions">
          <button @click="showEditModal = false">取消</button>
          <button type="primary" @click="submitEdit">保存</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>
```

- [ ] **Step 2: 实现 onLoad 加载用户详情**

```javascript
onLoad(options) {
  this.userId = options.user_id
  this.loadUserDetail()
  this.loadEvents()
}
```

- [ ] **Step 3: 实现 Tab 切换和列表加载逻辑**

```javascript
const switchTab = (key) => {
  this.currentTab = key
  this.currentList = []
  this.page = 1
  if (key === 'events') this.loadEvents()
  else if (key === 'claims') this.loadClaims()
  else if (key === 'animals') this.loadAnimals()
}
```

- [ ] **Step 4: 实现编辑提交**

```javascript
const submitEdit = async () => {
  await apiUpdateUser(this.userId, this.editForm)
  this.showEditModal = false
  this.loadUserDetail()
}
```

- [ ] **Step 5: 提交**

```bash
git add miniapp-admin/src/pages/users/detail/index.vue
git commit -m "feat(admin): 新增用户详情页"
```

---

## Task 6: 前端 - 编辑 Modal 和禁用逻辑完善

**Files:**
- Modify: `miniapp-admin/src/pages/users/detail/index.vue`

- [ ] **Step 1: 完善禁用/启用逻辑**

```javascript
const toggleBlock = async () => {
  if (this.userInfo.role === 'blocked') {
    await apiUpdateUser(this.userId, { role: 'user' })
  } else {
    if (this.userInfo.isCurrentUser) {
      uni.showToast({ title: '不能禁用自己', icon: 'none' })
      return
    }
    await apiUpdateUser(this.userId, { role: 'blocked' })
  }
  this.loadUserDetail()
}
```

- [ ] **Step 2: 提交**

```bash
git add miniapp-admin/src/pages/users/detail/index.vue
git commit -m "feat(admin): 完善编辑Modal和禁用逻辑"
```

---

## 实施顺序

1. **Phase 1（Task 1-2）：** 用户列表页增强 + API函数
2. **Phase 2（Task 3-4）：** 后端 5 个 API
3. **Phase 3（Task 5）：** 用户详情页
4. **Phase 4（Task 6）：** 编辑 Modal 完善
