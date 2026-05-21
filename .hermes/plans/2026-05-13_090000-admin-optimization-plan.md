# 管理端 W3 优化实施计划

> 计划日期：2026-05-13
> 依据：`docs/管理端优化建议.md`
> 状态：草稿

---

## 1. 目标

按照统筹者提出的优化建议，在 W3 阶段完成管理端前端的全部 P1/P2 修复及部分 P3 优化，使管理端达到可提交评审的完成度。

---

## 2. 当前上下文

- **项目**：`miniapp-admin`（UniApp + Vue3 微信小程序）
- **分支**：`feature/miniapp`（基于 `dev` 分支）
- **现状**：5 个页面均已可运行，Mock API 全部就绪，但存在 4 个 P1/P2 代码级 Bug 和 5 个体验/功能优化点
- **约束**：全部数据仍为 Mock，W4 才接入真实后端 API

---

## 3. 修复项汇总

| 优先级 | 问题 | 涉及文件 |
|--------|------|----------|
| P1 | 动物档案搜索 keyword 过滤缺失 | `services/mock.js` |
| P1 | 动物档案分页逻辑错误（覆盖而非累加） | `pages/animals/index.vue` |
| P2 | 首页"今日概况"已完成/处理中硬编码 | `pages/admin/index.vue` + `services/mock.js` |
| P2 | `stat-card` 组件已创建但未使用 | `pages/admin/index.vue` |
| P2 | `audit-event-card` 组件已创建但未使用 | `pages/admin/audit/index.vue` |
| P2 | 审核中心 Tab 切换忽略 URL `type` 参数 | `pages/admin/audit/index.vue` |
| P3 | 用户管理缺少角色筛选 Tab | `pages/users/index.vue` |
| P3 | 审核中心未加入 TabBar | `pages.json` |
| P3 | 动物档案详情仅有弹窗，无独立详情页 | `pages/animals/index.vue`（+新增 `pages/animals/detail/index.vue`） |

---

## 4. 详细实施步骤

### Phase 1：P1 Bug 修复（W3 Day 1）

#### Step 1.1：修复动物搜索 keyword 过滤

**文件**：`miniapp-admin/src/services/mock.js`

在 `mockGetAnimals` 函数中，params.status 过滤之后补充 keyword 过滤：

```js
if (params.keyword) {
  list = list.filter(a =>
    a.breed.includes(params.keyword) ||
    a.color.includes(params.keyword) ||
    a.address.includes(params.keyword)
  )
}
```

**验证**：在动物档案页搜索"柴犬"，列表应只返回柴犬记录。

---

#### Step 1.2：修复动物档案分页逻辑

**文件**：`miniapp-admin/src/pages/animals/index.vue`

1. 在 script 顶部添加分页状态：
   ```js
   const page = ref(1)
   const pageSize = 10
   ```

2. 修改 `loadAnimals` 函数，添加 `append` 参数控制是覆盖还是累加：
   ```js
   async function loadAnimals(append = false) {
     if (loading.value) return
     loading.value = true

     if (!append) {
       page.value = 1
       animals.value = []
     }

     const params: any = { page: page.value, pageSize }
     if (currentStatus.value !== 'all') params.status = currentStatus.value
     if (keyword.value) params.keyword = keyword.value

     const res: any = await mockGetAnimals(params)
     if (res.code === 0) {
       if (append) {
         animals.value.push(...res.data.list)
       } else {
         animals.value = res.data.list
       }
       hasMore.value = res.data.total > animals.value.length
       if (hasMore.value) page.value++
     }
     loading.value = false
   }
   ```

3. 修改 `onLoadMore` 调用：
   ```js
   function onLoadMore() {
     if (!hasMore.value) return
     loadAnimals(true)
   }
   ```

4. Mock 数据补充到 10+ 条（`mock.js` 中 `mockAnimals` 数组扩充至 12 条），确保能触发翻页。

**验证**：滚动加载第二页时，列表应累加而非覆盖，底部显示"没有更多了"在正确位置出现。

---

### Phase 2：P2 交互修复（W3 Day 1-2）

#### Step 2.1：修复首页"今日概况"硬编码

**文件**：
- `miniapp-admin/src/services/mock.js` — `mockStats` 补充字段
- `miniapp-admin/src/pages/admin/index.vue` — 模板替换硬编码值

**修改 mockStats**：
```js
export const mockStats = {
  // ... 原有字段 ...
  todayReports: 5,
  todayResolved: 3,    // 新增
  todayProcessing: 2    // 新增
}
```

**修改 admin/index.vue 模板**（第 54、59 行）：
```html
<!-- 原 -->
<text class="today-num">3</text>
<text class="today-num">2</text>

<!-- 改为 -->
<text class="today-num">{{ stats.todayResolved }}</text>
<text class="today-num">{{ stats.todayProcessing }}</text>
```

---

#### Step 2.2：集成 `stat-card` 组件到管理首页

**文件**：`miniapp-admin/src/pages/admin/index.vue`

将第 13-41 行的手写统计卡片 UI 替换为 6 个 `<stat-card>` 组件调用。

现有组件 props：`value`（数值）、`label`（标签）、`color`（左侧边框颜色）、`trend`（可选，趋势值）

```vue
<view class="stat-row">
  <stat-card :value="stats.totalAnimals" label="动物总数" color="#0FBF9F" />
  <stat-card :value="stats.lostAnimals" label="走失中" color="#FF6B6B" />
  <stat-card :value="stats.foundAnimals" label="发现中" color="#0FBF9F" />
</view>
<view class="stat-row">
  <stat-card :value="stats.claimedAnimals" label="待认领" color="#FF9F00" />
  <stat-card :value="stats.pendingEvents" label="待审核事件" color="#FF6B6B" />
  <stat-card :value="stats.pendingClaims" label="待审核认领" color="#FF9F00" />
</view>
```

同时删除旧的 `.stat-row`、`.stat-item` 样式（由 stat-card 组件自带样式替代）。

**验证**：管理首页统计区外观与之前一致，但代码量大幅减少，且 stat-card 的 trend、格式化功能后续可直接启用。

---

#### Step 2.3：集成 `audit-event-card` 到审核中心

**文件**：`miniapp-admin/src/pages/admin/audit/index.vue`

将事件审核 Tab（第 28-58 行）内联卡片替换为组件调用：

```vue
<audit-event-card
  v-for="item in events"
  :key="item.event_id"
  :event="item"
  @confirm="onConfirmEvent(item.event_id)"
  @reject="onRejectEvent(item.event_id)"
/>
```

**验证**：事件审核 Tab 卡片外观和交互与之前一致，确认/驳回按钮功能正常。

---

#### Step 2.4：修复审核中心 Tab 按 URL 参数初始化

**文件**：`miniapp-admin/src/pages/admin/audit/index.vue`

在 `onMounted` 开头添加 URL 参数读取逻辑：

```js
onMounted(async () => {
  // 读取 URL 参数初始化 Tab
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = (currentPage as any).options || {}
  if (options.type === 'claims') {
    currentTab.value = 'claims'
  }

  // 后续加载逻辑不变...
})
```

**验证**：从管理首页点击"待审核认领"跳转后，Tab 应默认停在"认领审核"而非"事件审核"。

---

### Phase 3：P3 优化（W3 Day 2-3）

#### Step 3.1：用户管理添加角色筛选 Tab

**文件**：`miniapp-admin/src/pages/users/index.vue`

在搜索框下方添加角色筛选 tabs（参考 animals/index.vue 第 12-21 行）：

```vue
<view class="filter-tabs">
  <view
    v-for="tab in roleTabs"
    :key="tab.value"
    :class="['filter-tab', { active: currentRole === tab.value }]"
    @click="onFilterRole(tab.value)"
  >
    <text>{{ tab.label }}</text>
  </view>
</view>
```

script 部分添加：
```js
const roleTabs = [
  { label: '全部', value: 'all' },
  { label: '普通用户', value: 'user' },
  { label: '管理员', value: 'admin' },
  { label: '机构', value: 'org' }
]
const currentRole = ref('all')
const users = ref<any[]>([])

// 修改 loadUsers 支持 role 参数，并在 mock.js 中补充过滤逻辑
```

**mock.js** 中 `mockGetUsers` 补充 role 过滤：
```js
if (params.role) {
  list = list.filter(u => u.role === params.role)
}
```

**验证**：用户管理页切换角色 Tab，应正确筛选对应角色的用户。

---

#### Step 3.2：将审核中心加入 TabBar

**文件**：`miniapp-admin/src/pages.json`

在 TabBar list 中新增审核入口（建议作为第二个 Tab，替换或紧跟首页之后）：

```json
{
  "pagePath": "pages/admin/audit/index",
  "text": "审核",
  "iconPath": "static/tab-audit.png",
  "selectedIconPath": "static/tab-audit-active.png"
}
```

**需准备图标**：`static/tab-audit.png` 和 `static/tab-audit-active.png`（81×81px，与其他 TabBar 图标同尺寸）。

**验证**：微信开发者工具中 TabBar 应显示 5 个入口，切换到审核 Tab 正常显示审核中心。

---

#### Step 3.3：开发动物档案详情页

**新增文件**：`miniapp-admin/src/pages/animals/detail/index.vue`

点击动物卡片时 `uni.navigateTo` 跳转至详情页，URL 参数传递 `animal_id`：

```js
// animals/index.vue showAnimalDetail 函数改为：
function showAnimalDetail(animal: any) {
  uni.navigateTo({ url: `/pages/animals/detail/index?animal_id=${animal.animal_id}` })
}
```

详情页内容（从 `mockGetAnimals` 获取完整数据）：
- 动物照片（多张轮播）
- 基本信息：品种、颜色、性别、年龄、健康状态、是否绝育
- 状态标签（走失/发现/待认领）
- 位置信息（地址 + 地图缩略图，点击调用 `uni.openLocation`）
- 鼻纹特征 ID
- 首次/最后出现时间
- 备注和标签
- 操作按钮（修改状态、编辑档案）

**pages.json 新增路由**：
```json
{
  "path": "pages/animals/detail/index",
  "style": {
    "navigationBarTitleText": "动物档案详情",
    "navigationBarBackgroundColor": "#FFFFFF"
  }
}
```

**验证**：点击动物卡片应跳转至独立详情页，页面可上下滚动，所有字段正确显示。

---

## 5. 文件变更清单

| 文件 | 操作 | 变更内容 |
|------|------|---------|
| `miniapp-admin/src/services/mock.js` | 修改 | 补充 keyword 过滤、role 过滤、todayResolved/todayProcessing 字段、mockAnimals 扩充至 12 条 |
| `miniapp-admin/src/pages/admin/index.vue` | 修改 | 替换 stat-row 为 stat-card 组件调用，修复今日概况硬编码 |
| `miniapp-admin/src/pages/admin/audit/index.vue` | 修改 | 集成 audit-event-card，添加 URL 参数初始化 Tab |
| `miniapp-admin/src/pages/animals/index.vue` | 修改 | 修复分页逻辑（page+append），showAnimalDetail 改为 navigateTo |
| `miniapp-admin/src/pages/users/index.vue` | 修改 | 添加角色筛选 tabs，修改 loadUsers 支持 role 参数 |
| `miniapp-admin/src/pages/animals/detail/index.vue` | 新增 | 动物档案详情页 |
| `miniapp-admin/src/pages.json` | 修改 | 新增 detail 路由，TabBar 新增审核入口 |
| `miniapp-admin/static/tab-audit.png` | 新增 | TabBar 审核图标（普通态） |
| `miniapp-admin/static/tab-audit-active.png` | 新增 | TabBar 审核图标（选中态） |
| `docs/前端W2开发计划.md` | 更新 | 记录 W3 计划 |

---

## 6. 测试验证清单

| 优先级 | 验证项 | 操作 |
|--------|--------|------|
| P1 | 动物搜索"柴犬"只返回柴犬 | 动物档案页搜索框输入"柴犬" |
| P1 | 分页累加而非覆盖 | 滚动触发 onLoadMore，检查列表项是否累加 |
| P2 | 首页今日概况显示动态数据 | 检查 stats.todayResolved 和 todayProcessing 是否正确读取 |
| P2 | stat-card 正确渲染 | 首页统计区样式和功能与之前一致 |
| P2 | audit-event-card 正确渲染 | 审核中心事件 Tab 卡片样式和交互正常 |
| P2 | URL 参数初始化 Tab | 从首页点击"待审核认领"，验证 Tab 停在"认领审核" |
| P3 | 用户角色筛选 | 切换"管理员"Tab 只显示 admin 角色用户 |
| P3 | TabBar 显示 5 个入口 | TabBar 正确显示审核入口 |
| P3 | 动物详情页跳转 | 点击动物卡片跳转详情页，所有字段正确显示 |

---

## 7. 风险与开放问题

| 问题 | 影响 | 应对 |
|------|------|------|
| TabBar 图标需要设计师提供 | 无图标则审核入口无法上线 | 优先使用 Emoji 或临时占位图标，W3 期间替换 |
| `audit-claim-card` 组件仍未创建 | 认领审核卡片使用内联代码，代码量偏多 | W4 或后续迭代再抽取，当前先用内联实现 |
| 详情页需要 `mockGetAnimalDetail` 接口 | mock.js 中尚未定义 | 复用 `mockGetAnimals` 按 ID 过滤实现 |
| 分页需要后端支持 page 参数 | 真实 API 需后端实现分页 | Mock 层先按 page 过滤数组切片模拟，联调时后端提供真实分页 |
