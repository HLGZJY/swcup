# 管理端动物档案 CRUD 设计

> 日期：2026-06-08
> 状态：草稿（待用户 review）

---

## 1. 概述

**目的：** 为管理端补齐动物档案的新增、编辑、软删（归档）能力。当前仅有只读列表+详情，无法写入。

**范围（最小可用）：**
- 列表页加"+"新建按钮和"显示归档"开关
- 详情页加"编辑"和"归档"按钮，支持内嵌编辑模式
- 新增 `<AnimalForm>` 组件（只读/编辑/新建三模式复用）
- 后端给 `findAll` 加一个 `include_archived` query 参数（默认隐藏已归档）

**不在范围（YAGNI）：**
- 批量操作、CSV 导出、硬删
- 照片管理、GPS 编辑、主鼻纹替换
- 字段级实时校验（仅表单级）
- 测试基建（仅手测 checklist）
- 用户端 `miniapp-user` 任何改动
- `api.js` 改动（4 个 admin animal 函数已存在）

---

## 2. 现状摸底

| 层 | 现状 | 备注 |
|---|---|---|
| 后端 `admin.controller.ts:82-109` | ✅ 完整 CRUD 5 个端点 | GET 列表/详情、POST、PUT、DELETE |
| `services/api.js` | ✅ 4 个 admin animal 函数已封装 | `apiGetAdminAnimals` / `apiCreateAnimal` / `apiUpdateAnimal` / `apiDeleteAnimal` |
| `pages/animals/index.vue` | ⚠️ 列表+搜索+筛选已有 | 缺"+"按钮、缺"显示归档"开关 |
| `pages/animals/detail/index.vue` | ⚠️ 详情只读已有 | 缺"编辑"、"归档"按钮、内嵌编辑模式 |
| `pages/animals/components/` | ❌ 不存在 | 需新增 |

**结论：后端 + api 零改动。前端主要是补 UI。**

---

## 3. 架构

### 3.1 文件结构

```
miniapp-admin/src/pages/animals/
├── index.vue                       # 改：加"+"按钮、"显示归档"开关
├── detail/
│   └── index.vue                   # 改：加 mode 切换、编辑/归档按钮
└── components/
    └── AnimalForm.vue              # 新增：通用动物表单组件
```

### 3.2 组件契约

**`<AnimalForm>` props**

```ts
{
  mode: 'read' | 'edit' | 'new',     // 决定 input 还是只读 text
  initialValue?: Partial<Animal>,    // 编辑/新建初值
  submitting?: boolean              // 提交按钮 disabled
}
```

**`<AnimalForm>` emits**

```ts
'cancel'   () => void                // 取消编辑
'submit'   (data: AnimalFormData) => void   // 提交
'delete'   () => void                // 软删（仅 read/edit 模式显示）
```

### 3.3 字段与控件映射

`<AnimalForm>` 内部负责所有字段渲染。不可编辑字段（`animal_id`、`primary_nose_id`、`photos`、`location_*`、`first/last_seen_at`、`created_at`、`updated_at`）**不展示**。

| 字段 | 控件 | 校验 |
|---|---|---|
| status | picker（4 选 1：lost/found/claimed/archived） | 必选 |
| species | picker（cat/dog/other） | 必选 |
| breed | input | ≤50 字 |
| color | input | ≤50 字 |
| gender | picker（male/female/unknown） | 必选 |
| age_estimate | picker（puppy/adult/senior） | 可空 |
| health_status | picker（healthy/injured/ill/unknown） | 必选 |
| sterilized | switch | boolean |
| address | input | ≤255 字 |
| notes | textarea | 任意 |

---

## 4. 数据流与模式切换

### 4.1 模式切换机制

`detail/index.vue` 通过 query 参数决定模式：

- `?animal_id=xxx` → 默认只读
- `?animal_id=xxx` + 点"编辑"按钮 → 切到 edit
- `?mode=new` → 新建模式（无 animal_id）

### 4.2 状态机

```
[列表页] ──点击行──→ [详情页 read]
                       │ 点"编辑"
                       ↓
                  [详情页 edit]
                       │ 点"取消"
                       ↓
                  [详情页 read]  (回滚 editingSnapshot)
                       │ 点"保存"
                       ↓
                  PUT /admin/animals/:id
                       │ 200
                       ↓
                  [详情页 read]  (用返回数据刷新)

[列表页] ──点"+"──→ [详情页 new]
                       │ 点"取消"
                       ↓
                  [列表页]
                       │ 点"创建"
                       ↓
                  POST /admin/animals
                       │ 200
                       ↓
                  navigateTo detail?animal_id={新 ID}
```

### 4.3 列表页"+"

浮动按钮（FAB），右下角 fixed 定位：

```vue
<view class="fab-add" @click="onCreateNew">+</view>
```

点击 → `uni.navigateTo({ url: '/pages/animals/detail/index?mode=new' })`

### 4.4 列表页"显示归档"开关

状态筛选 tab 行末尾加一个 switch：

```vue
<view class="archive-toggle">
  <switch :checked="showArchived" @change="onToggleArchive" />
  <text>显示归档</text>
</view>
```

**实现：** 调用 `apiGetAdminAnimals` 时传 `include_archived=true/false`。
- 关闭（默认）：后端 `WHERE status != 'archived'`
- 开启：后端不加此过滤

> **后端微改：** `AnimalsService.findAll(query)` 加一个 query 参数 `include_archived`，默认 `false`；为 `true` 时跳过 `status != 'archived'` 过滤。代码量 ~3 行。

---

## 5. 错误处理与 UX 反馈

### 5.1 错误分类

| 错误类型 | 触发场景 | UI 表现 |
|---|---|---|
| 网络错误 | 后端不可达、超时 | modal "网络异常，请检查网络后重试" |
| 401/403 | token 过期/无权限 | api.js 拦截器已处理（跳登录/无权限） |
| 4xx 校验 | 必填为空、字段非法 | modal 显示后端 `message` 数组 |
| 5xx | DB 异常、代码 bug | modal "服务器异常，请稍后重试" |
| 软删冲突 | animal 已被改（409） | 重新拉取详情，提示"档案已被修改，请刷新" |

### 5.2 表单级校验

提交前 helper：

```ts
function validateForm(data): { ok: boolean; errors: string[] }
```

- `ok=false` → 阻止提交，modal 显示 errors 数组
- `ok=true` → 调用 API

**不做字段级实时校验**（只表单级 + 后端 message）。

### 5.3 Loading 态

- 列表/详情加载：现有 `loading` ref + 顶部 spinner
- 提交中：表单内"创建/保存"按钮 `disabled`，显示"提交中..."
- 软删确认中：弹窗"确认归档"按钮 `disabled`

### 5.4 软删确认弹窗

用 `uni.showModal`（uni-app 全局 API，非组件）：

```ts
function onArchiveClick() {
  uni.showModal({
    title: '归档动物档案',
    content: `确认将「${animal.value.breed || '该动物'}」归档吗？归档后默认不在列表显示，可在归档筛选中查看。`,
    cancelText: '取消',
    confirmText: '确认归档',
    success: (res) => { if (res.confirm) doArchive() }
  })
}
```

要点：
- 措辞清楚（"归档"而非"删除"，打消顾虑）
- 提到"可在归档筛选中查看"

### 5.5 编辑模式回滚

进入 edit 模式时，本地缓存 `editingSnapshot`。点"取消"或失败时：
- 取消 → snapshot 写回
- 失败 → 保留表单输入（用户改的不丢）

### 5.6 边界场景

| 场景 | 行为 |
|---|---|
| 搜索后点新建 | 新建成功后回列表，由用户自行刷新/翻页 |
| 新建时 GPS 留空 | 后端已支持（之前修过 DTO），animal 的 location 可空 |
| 归档后编辑归档动物 | 允许；保存时若没改 status，保持 archived |
| 重复点"保存" | 提交中 disable 按钮防重复 |

---

## 6. 后端微改

`backend/src/animals/animals.service.ts` 的 `findAll` 加 query 参数：

```ts
async findAll(query: { ..., include_archived?: boolean | string }) {
  const qb = this.repo.createQueryBuilder('a')
  const includeArchived = query.include_archived === true || query.include_archived === 'true'
  if (!includeArchived) {
    qb.andWhere('a.status != :archived', { archived: 'archived' })
  }
  // ... 其余逻辑
}
```

预计 ~3-5 行改动。`admin.controller.ts` 的 `findAll` 透传 query 即可，已是 `@Query() query: any`。

---

## 7. 测试策略

项目无单测基建（miniapp 端无 vitest/jest 配置）。本 spec **不加测试基建**。

**手测 Checklist：**

**A. 列表页**
- [ ] 空列表：显示"暂无动物档案"
- [ ] 4 个状态 tab + "显示归档"开关
- [ ] 点"+"：跳 `detail?mode=new`
- [ ] "显示归档"关闭：archived 不出现
- [ ] "显示归档"开启：archived 出现
- [ ] 搜索：列表刷新
- [ ] 滚动到底：加载下一页

**B. 新建模式**
- [ ] 进入：表单字段为空，无"归档"按钮
- [ ] 必填留空点"创建"：弹错误，不调 API
- [ ] 填齐必填点"创建"：成功后跳 detail?animal_id={新 ID}
- [ ] 取消：返回列表，无新数据

**C. 编辑模式**
- [ ] 点"编辑"：字段切换为可输入
- [ ] 改字段点"取消"：回到只读，字段恢复
- [ ] 改字段点"保存"：PUT 200，字段为新值
- [ ] breed 超过 50 字：提交时弹错误

**D. 软删**
- [ ] 点"归档"：弹确认
- [ ] 确认：状态变"归档"，列表"全部"不显示、"归档"tab 显示
- [ ] 归档后编辑：可改，保存后状态保持

**E. 错误处理**
- [ ] 后端关闭：弹"网络异常"
- [ ] 后端 4xx：弹后端 message
- [ ] 后端 5xx：弹"服务器异常"

---

## 8. 风险与开放问题

| 项 | 风险 | 缓解 |
|---|---|---|
| 后端 `include_archived` 参数未被前端现有调用使用 | 可能影响其他管理端调用 | 搜索全代码确认无其他依赖；如有用，文档化 |
| 软删依赖 status='archived' 枚举值 | 若有人手动改 status | 后端不做防护，依赖管理规范 |
| `<AnimalForm>` 复用范围 | 未来用户/事件也想用 | 组件 props 用 `Partial<Animal>` 抽象，本次不抽象到通用层 |
| 内嵌编辑详情页变长 | 代码 ~400 行 | 抽组件后，detail 页面只剩 ~200 行，可接受 |
