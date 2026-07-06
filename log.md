# 项目进度日志

> 最后更新：2026-06-02（周一）
> 当前：W5 第一天 — 全链路基本贯通，P0 缺口全部关闭，进入演示冲刺
> 更新：补录 W3末~W5 的 git 提交记录（5/21~6/2），共 86 条提交，P0 缺口全部关闭

---

## 2026-05-21（周四）W3 第三天 — 审核业务流程梳理

### 管理员审核中心业务流程定义

经过系统性梳理，确认了审核中心三个操作的业务含义：

#### 三种操作的业务语义

| 操作 | 业务含义 | 数据变化 |
|------|----------|----------|
| **process** | 对字段缺失的事件做AI识别，填充 species/breed，再由系统重新发起比对 | rescue_events.status → `'identified'`，species/breed 被填充 |
| **confirm** | 管理员认可系统给出的比对候选，确认这个动物已存在于档案中，合并到已有档案 | rescue_events.status → `'duplicated'`，is_duplicate → true |
| **reject** | 比对结果有误或事件无效，驳回后事件结束 | rescue_events.status → `'rejected'` |

#### 事件自动处理规则（上报时触发）

| 融合得分 | 系统行为 | 后续流向 |
|----------|----------|----------|
| ≥ 0.88 | 自动确认重复，自动合并到已有档案 | 无需管理员处理 |
| 0.75 ~ 0.88 | 标记疑似重复 | **管理员审核队列** |
| < 0.75 | 自动新建动物档案 | 无需管理员处理 |

> 到达管理员审核中心的事件 = 融合得分在 0.75~0.88 区间，系统拿不准的案例

#### 张三走失狗的完整场景

1. **用户上报**：张三的狗走失，上传鼻纹照片 + 描述 → 系统自动比对 → 与王五的走失柴犬融合得分 0.81 → 事件 A 进入管理员审核队列（status=`pending`）
2. **管理员李四看到**：事件基本信息 + 比对候选列表（top-N 动物 + 4维度得分 + 融合得分）+ 候选动物档案卡片（照片/品种/状态）
3. **李四决策**：
   - 确认是同一只狗 → 点 **confirm** → 事件标记为重复，合并到王五的动物档案
   - 比对错了 → 点 **reject** → 事件被驳回
   - 物种字段缺失 → 点 **process** → AI重新识别，填充后再进入比对流程

### 审核中心缺口识别

#### 缺口一：管理员看不到比对候选列表

| 管理员在审核中心看到 | 当前系统 | 应该有 |
|---------------------|----------|----------|
| 事件基本信息（描述/位置/时间） | ✅ 有 | ✅ |
| 比对候选列表（top-N + 4维度得分） | ❌ 没有 | ❌ 缺失 |
| 候选动物档案卡片（照片/品种/状态） | ❌ 没有 | ❌ 缺失 |
| 融合得分说明（与哪个动物对比，得分多少） | ❌ 没有 | ❌ 缺失 |
| 操作按钮（confirm/reject/process） | ✅ 有 | ✅ |

**根因**：`GET /admin/events/:event_id` 接口（admin.service.ts:40-44）只返回事件本身，没有返回比对候选数据。

#### 缺口二：confirm 操作没有记录"合并到哪个动物"

```typescript
// admin.service.ts:46-48 — 当前实现
async confirmEvent(event_id: string) {
  await this.eventRepo.update({ event_id }, { status: 'duplicated' as any, is_duplicate: true });
  // ↑ 只打标签，没有记录目标 animal_id
}
```

管理员在审核详情页选中了候选列表中的某只动物，但这个选择没有持久化。

#### 缺口三：审核详情页依赖的数据

| 需要的字段 | 来源 | 当前状态 |
|-----------|------|----------|
| 比对候选列表（top-N animal + 得分） | 后端 `getEventDetail` 返回 | ❌ 未返回 |
| 四维度得分明细 | 后端 `getEventDetail` 返回 | ❌ 未返回 |
| 候选动物档案详情 | 后端 `getEventDetail` 返回 | ❌ 未返回 |
| confirm 时指定 animal_id | 后端 `confirmEvent` 接收参数 | ❌ 不支持 |

### 缺口三新增任务卡

| 任务 | 优先级 | 负责人 | 说明 |
|------|--------|--------|------|
| 后端 `getEventDetail` 增加候选列表 | 🔴 P0 | 老师 | 返回 `candidates[]`（top-N动物+四维度得分+融合得分） |
| 后端 `confirmEvent` 支持指定 animal_id | 🔴 P0 | 老师 | 管理员选择合并目标后记录到事件 |
| 前端审核详情页渲染候选卡片 | 🟡 P1 | 队员 | 等后端接口就位后接入，当前用 Mock 数据先开发 UI |

---

## 当前阶段

| 周次 | 核心目标 | 状态 |
|------|----------|------|
| W1 | 需求冻结 & 架构定稿 | 🟢 完成 |
| W2 | 数据集构建 & 数据库搭建 | 🟢 完成 |
| W3 | 模型训练 & 核心API联调 | 🟡 进行中 |
| W4 | 模型优化 & 全链路贯通 | ⬜ 待开始 |

---

## W1 ~ W3 任务总览

### W1 任务状态（已结束）

| 任务 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| 1.1 需求对齐会 | 🟢 完成 | 全员 | 架构文档已作为事实标准 |
| 1.2 鼻纹技术方案 | 🟢 完成 | 队长 | `docs/架构设计.md` + `ai-service/README.md` |
| 1.3 架构设计 | 🟢 完成 | 队长 | `docs/架构设计.md` |
| 1.4 UI/UX 原型 | 🟢 完成 | 队员 | 超出预期：实际页面全部开发完成 |
| 1.5 前端项目初始化 | 🟢 完成 | 队员 | 两个小程序均完整搭建 |
| 1.6 后端 REST API（NestJS） | 🟢 完成 | 老师 | |
| 1.7 Git 仓库初始化 | 🟢 完成 | 队长 | |

### W2 任务状态（已结束）

| 任务 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| 2.1 鼻纹数据集采集（≥500组） | 🟢 完成 | 队长 | 斯坦福+牛津，acc~94% |
| 2.2 数据清洗+鼻部标注 | 🟡 部分完成 | 队长 | Pets数据已处理，真实鼻纹fine-tune待做 |
| 2.3 数据库建表 | 🟢 完成 | 老师 | MySQL，6张表 |
| 2.4 后端 CRUD API | 🟢 完成 | 老师 | NestJS，admin模块全真实DB |
| 2.5 前端接入真实API | 🟢 完成 | 队员 | 两个端均已切真实后端 |
| 2.6 AI 服务框架 | 🟢 完成 | 队长 | FastAPI框架+权重文件stage1_oxford.pth |
| 2.7 前/后端联调 | 🟡 进行中 | 全员 | 管理端已通，AI接入待完成 |

### W3 任务状态（进行中）

| 任务 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| 3.1 鼻纹AI接入后端 | 🔴 进行中 | 队长/老师 | nose.service调FastAPI /extract/feature |
| 3.2 四维度融合算法 | 🔴 进行中 | 队长 | fusion_score后端实现 |
| 3.3 微信登录 | 🟡 待开始 | 老师 | 文档已产出，代码未实现 |
| 3.4 前端主体功能 | 🟢 完成 | 队员 | 所有页面开发完成 |
| 3.5 前端增强（用户管理/分享/错误处理） | 🟢 完成 | 队员 | |
| 3.6 AI权重加载 | 🟡 进行中 | 队长 | 加载stage1_oxford.pth替代ImageNet |
| 3.7 审核中心比对候选数据（缺口一） | 🔴 进行中 | 老师 | 后端getEventDetail返回candidates[] |
| 3.8 confirm支持指定目标animal_id（缺口二） | 🔴 进行中 | 老师 | 后端confirmEvent接收animal_id参数 |
| 3.9 审核详情页候选卡片UI | 🟡 待开始 | 队员 | 等后端接口就绪后接入 |

---

## 各模块现状

### 前端小程序 — 队员

**状态：✅ 主体功能已完成**

#### 用户端（miniapp-user）

| 页面 | 文件 | 状态 |
|------|------|------|
| 首页 | `pages/index/index.vue` | ✅ 完成 |
| 鼻纹采集引导 | `pages/collect/index.vue` | ✅ 完成 |
| 比对结果页 | `pages/collect/result.vue` | ✅ 完成 |
| 动物详情页 | `pages/animal-detail/index.vue` | ✅ 完成（含微信分享） |
| 认领申请页 | `pages/claim/index.vue` | ✅ 完成 |
| 个人中心 | `pages/user/index.vue` | ✅ 完成 |
| 我的上报 | `pages/my-reports/index.vue` | ✅ 完成 |
| 我的认领 | `pages/my-claims/index.vue` | ✅ 完成 |

#### 管理端（miniapp-admin）

| 页面 | 文件 | 状态 |
|------|------|------|
| 管理首页 | `pages/admin/index.vue` | ✅ 完成 |
| 审核中心 | `pages/admin/audit/index.vue` | ✅ 完成（列表） |
| 审核详情 | `pages/admin/audit/detail.vue` | ✅ 完成（只读详情页） |
| 动物档案管理 | `pages/animals/index.vue` | ✅ 完成 |
| 事件管理 | `pages/events/index.vue` | ✅ 完成 |
| 用户管理 | `pages/users/index.vue` | ✅ 完成 |
| 用户详情 | `pages/users/detail/index.vue` | ✅ 完成 |

#### 前端已完成的增强

| 增强项 | 状态 |
|--------|------|
| 全局分享配置（App.vue + page-share.js） | ✅ 完成 |
| 动物详情页微信分享（聊天+朋友圈） | ✅ 完成 |
| 分享菜单启用（uni.showShareMenu） | ✅ 完成 |
| 管理端用户列表（禁用/启用switch + 详情按钮） | ✅ 完成 |
| 用户详情页（Tab切换：基本信息/操作记录） | ✅ 完成 |
| 用户编辑弹窗（角色切换：普通用户/管理员/机构） | ✅ 完成 |
| 管理端错误处理（空catch统一toast+console.error） | ✅ 完成 |
| 用户端错误处理（空catch统一toast+console.error） | ✅ 完成 |
| pages.json路由注册（users/detail） | ✅ 完成 |

### 后端（NestJS）— 老师

**状态：✅ 骨架完整，CRUD真实DB**

| 模块 | 现状 |
|------|------|
| admin.service.ts | ✅ 真实DB查询 |
| events.service.ts | ✅ 真实DB |
| admin.controller.ts | ✅ 完整路由，JWT+Roles验证 |
| auth.controller.ts | ✅ 手机号登录；❌ 微信登录未实现 |
| nose.service.ts | ❌ 仍为Mock |
| 四维度融合计算 | ❌ 未实现 |
| 后端→AI服务调用 | ❌ 未实现 |
| getEventDetail | ❌ 未返回比对候选列表 |
| confirmEvent | ❌ 未支持指定animal_id |

### AI 服务（FastAPI）— 队长

**状态：✅ 框架完整，权重文件已就绪**

| 文件/资源 | 现状 |
|-----------|------|
| FastAPI 入口 | ✅ |
| /extract/feature（512维向量） | ✅ 框架完整 |
| /detect/liveness（活体检测） | ✅ 框架完整 |
| /compare（向量比对） | ✅ 框架完整 |
| weights/stage1_oxford.pth | ✅ 牛津数据集权重已存在 |
| 模型加载 | ⚠️ `load_model(weights_path=None)` — 未加载权重，用ImageNet预训练 |

### 各角色当前任务

| 角色 | 当前任务 | 状态 |
|------|----------|------|
| 队长 | nose.service调FastAPI + 四维融合算法 | 🔴 进行中 |
| 队长 | 加载stage1_oxford.pth权重 | 🟡 进行中 |
| 老师 | getEventDetail增加candidates[] | 🔴 进行中 |
| 老师 | confirmEvent支持animal_id | 🔴 进行中 |
| 老师 | 微信登录实现 | 🟡 待开始 |
| 队员 | 审核详情页候选卡片（等后端接口） | 🟡 待开始 |

---

## 当前最大阻塞（优先级排序）

### 🔴 P0（阻断审核中心核心流程）

1. **后端 `getEventDetail` 未返回比对候选**
   - 管理员在审核详情页看不到候选动物 + 得分
   - 无法做判断 → 审核流程实质上不可用
   - 需要返回：`candidates[]`（animal_id + species + breed + color + photos + 四维得分 + fusion_score）

2. **后端 `confirmEvent` 不支持指定目标**
   - 管理员选中了某个候选动物，但 confirm 操作没有传 animal_id
   - 即使前端改了，也写不进去
   - 需要：接收 `animal_id` 参数，写入 `rescue_events.animal_id`

### 🟡 P1（功能完整度）

3. 微信登录 `POST /auth/weixin` 只有文档，代码未实现 — 老师
4. 审核详情页候选卡片UI — 队员（等后端接口）
5. AI 模型加载 `stage1_oxford.pth` 权重 — 队长

### 🟢 完成后可演示

- 鼻纹采集 → AI提取向量 → 存DB
- 鼻纹比对 → 四维融合 → 返回排序结果
- 管理员审核 → 看到候选 → confirm/reject/process 完整闭环

---

## W3 质量门控（进入演示必须达成）

| 门控项 | 状态 | 负责人 |
|--------|------|--------|
| 后端 getEventDetail 含候选列表 | 🔴 进行中 | 老师 |
| 后端 confirmEvent 支持 animal_id | 🔴 进行中 | 老师 |
| 前端审核详情页渲染候选卡片 | 🟡 待开始 | 队员 |
| nose.service 调 FastAPI | 🔴 进行中 | 队长/老师 |
| 四维度融合算法 | 🔴 进行中 | 队长 |
| AI 权重加载 stage1_oxford.pth | 🟡 进行中 | 队长 |
| 前端全页面无阻塞Bug | 🟢 完成 | 队员 |
| 微信登录 | 🟡 待开始 | 老师 |

---

## 文档清单

| 文档 | 状态 | 用途 |
|------|------|------|
| `log.md` | ✅ 持续更新 | 项目整体进度 |
| `wiki/overview.md` | ✅ 需同步更新 | 项目顶层概述 |
| `docs/架构设计.md` | ✅ 完成 | 系统架构 |
| `docs/后端接口文档-给老师.md` | ✅ 完成 | 23个接口契约 |
| `docs/后端管理端副作用说明.md` | ✅ 完成 | 8个操作的副作用 |
| `docs/AI服务接口文档.md` | ✅ 完成 | FastAPI端点定义 |
| `docs/微信登录接口文档.md` | ✅ 完成 | 微信登录接口规范 |
| `docs/前端开发指南.md` | ✅ 完成 | 前端规范 |
| `docs/前端Mock数据说明.md` | ✅ 完成 | Mock API说明 |
| `docs/数据库建表脚本.md` | ✅ 完成 | 6张表DDL |
| `docs/后端开发进度.md` | ✅ 完成 | 后端现状记录 |
| `docs/前端联调任务书.md` | ✅ 完成 | 联调任务分配 |
| `docs/bug-report-管理端页面无请求.md` | ✅ 完成 | Bug记录 |

---
## 2026-05-24 ~ 2026-05-31 W4 — 全链路贯通 & P0 缺口关闭

> 以下条目从 git 提交记录整理，5/21 之后共有 86 条提交，按模块聚合。

### 🟢 缺口一关闭：getEventDetail 返回四维得分 + 候选列表

| 文件 | 变更 |
|------|------|
| ackend/src/events/entities/event.entity.ts | 新增 usion_score、ector_similarity、gps_similarity、image_similarity、	ext_match_rate（decimal(5,4)）、candidates（JSON）字段 |
| ackend/src/admin/admin.service.ts | getEventDetail 展开四维得分，candidates[] 含 animal 档案卡片信息 |
| ackend/src/nose/nose.service.ts | compare 方法返回 	op-5 candidates + is_recommended 标记 |

### 🟢 缺口二关闭：confirmEvent 支持指定 nimal_id

| 文件 | 变更 |
|------|------|
| ackend/src/admin/admin.service.ts | confirmEvent(event_id, animal_id?) — 有 nimal_id 时同时写入 event.animal_id 和 event.is_duplicate=true |
| ackend/src/nose/nose.service.ts | collect 方法同步保存 
ose_vector_id + 
ose_photo_url 到事件 |
| 前端 pi.js | piConfirmEvent(animal_id) 支持传入目标动物 ID |

### 🟢 融合算法真实化（Mock → 真实计算）

| 维度 | 原实现 | 现实现 |
|------|--------|--------|
| GPS相似度 | Mock | **Haversine 公式**：haversineDistance + gpsScore(distanceM) |
| 文本匹配 | Mock | **关键词交集**：	extMatch(dto, animal) — breed/color/gender 交集比 |
| 向量相似度 | Mock | 调 FastAPI /compare/vector，cosine similarity |
| 融合权重 | {vector:0.5, gps:0.3, text:0.2} | 同左，**image_similarity 维度暂时移除** |
| 调用链 | 
ose.service.collect → indSimilarAnimals → compareVectors → FastAPI | ✅ 全链路真实 |

### 🟢 Plan B 新动物上报流程（前端无匹配时用户自主建档）

**背景**：当 usion_score < 0.75 系统认为无匹配，但用户实际可能是新动物。允许用户主动选择创建档案。

| 组件 | 变更 |
|------|------|
| NestJS versioning | 启用 API prefix /v1，修复重复路由遮挡 |
| POST /v1/animals | 用户端创建档案端点（仅需登录，无需 admin 角色） |
| POST /v2/animals | 对应用户端 Plan B 端点 |
| events.create | 支持关联已有 nimal_id（Plan B 合并到已有档案） |
| 
ose.service.compare | 无匹配时返回 
ext_action: ask_user_create |
| 用户端 result.vue | **Plan B 三分支 UI**（match_found / ask_user_create / ask_claim）+ **双按钮确认** |

### 🟢 体图 AI 品种自动分类（新增 Step 1）

用户采集流程重构为四个步骤：

`
Step 1: 拍摄全身照 → AI 自动识别品种（POST /v1/nose/classify）
Step 2: 鼻纹采集
Step 3: 填写 breed / color / gender（AI 结果预填，用户可改）
Step 4: 确认提交
`

| 组件 | 变更 |
|------|------|
| AI service /classify/breed | 使用 reed_classifier_v3.pth（98MB），返回 breed + confidence + top3 |
| 后端 
ose.service.classify | 调用 FastAPI /classify/breed，品种中英映射 37 类 |
| 用户端 collect.vue | 新增 Step 1（体图）+ Step 3（填表单），步骤序号重排 |
| 前端 pi.js | 新增 piClassifyBreed API |

### 🟢 地图能力（腾讯地图静态图 + 导航）

| 组件 | 变更 |
|------|------|
| 管理端动物详情 | 显示腾讯地图静态图（WebView 内嵌） |
| 用户端 | 地图预览图 320rpx，右上角按钮触发 uni.openLocation 导航 |
| 权限配置 | manifest.json 添加 
equiredPrivateInfos: ['location'] |

### 🟢 管理端审核详情页（真实 API）

| 页面 | 变更 |
|------|------|
| pages/admin/audit/detail.vue | 接入 piGetEventDetail 真实接口，显示四维得分 + 候选动物卡片 |
| pi.js | piConfirmEvent(event_id, animal_id) 支持传入合并目标 |
| 操作按钮 | confirm → piConfirmEvent（含 animal_id）；process → piProcessEvent |

### 🟡 管理端用户列表增强

- **分页**：page + limit 参数，支持 onLoadMore 滚动加载
- **搜索**：keyword 参数传递到 /admin/users
- **筛选**：
ole 参数支持角色过滤

### 🟡 管理端样式修复

- 列表页内边距统一（.list-area 统一 padding）
- scroll-view 添加 ox-sizing: border-box 防止溢出
- 审核事件卡片样式修复（暗色 → 浅色主题）
- 用户详情页 JSON.parse 容错（storage 非字符串检查）
- openLocation 经纬度 Number() 类型转换

### 🟡 登录页重新设计

- 重新设计登录页：柔和光效渐变背景
- 移除 uni.share（小程序不可用），引导用户使用右上角菜单

### 📄 文档新增

| 文档 | 内容 |
|------|------|
| docs/审核中心业务流程与缺口.md | 审核中心三个操作语义 + 缺口分析 |
| docs/补充管理端事件模块功能边界设计Spec.md | 事件模块功能边界 |
| docs/管理端事件审核详情页设计Spec.md | candidates 候选列表 + 四维得分规范 |
| docs/体图AI品种分类规范.md | 体图分类接口规范 |
| docs/体图AI品种分类实现计划.md | 体图分类实现计划 |
| docs/地图预览设计规范.md | 地图预览 UI 规范 |
| docs/地图预览实现计划.md | 地图预览实现计划 |
| docs/后端管理端审核中心设计Spec.md | 审核中心后端接口规范 |
| docs/融合得分真实数据流修复规范.md | 融合得分真实化规范 |

---

## 2026-06-01 ~ 2026-06-02 W5 — 全链路联调 & 融合策略定稿

### 🔴 四维融合算法实现完成

- 
ose.service.ts 已有完整融合计算逻辑：向量 + GPS + 文本（权重 0.5/0.3/0.2）
- image_similarity 维度已暂时移除（活体检测数据暂时不用）
- 
ose_v3_sgd.pth 作为主模型权重（替代 ImageNet 预训练）

### 🟡 当前状态

| 模块 | 状态 | 备注 |
|------|------|------|
| AI 服务（FastAPI） | ✅ 就绪 | /extract/feature 加载 
ose_v3_sgd.pth，/compare/vector、/classify/breed 全部可用 |
| 后端鼻纹融合 | ✅ 就绪 | Haversine GPS + 文本匹配 + 向量比对，三维融合 |
| 审核中心后端 | ✅ 就绪 | getEventDetail 返回 candidates[]，confirmEvent 支持 nimal_id |
| 用户端采集流程 | ✅ 就绪 | Step 1 体图分类 + Step 2 鼻纹 + Step 3 表单 + Step 4 确认 |
| Plan B 流程 | ✅ 就绪 | 无匹配时用户可自主创建档案 |
| 管理端审核详情 | ✅ 就绪 | 接入真实 API，显示四维得分 + 候选卡片 |
| 微信登录 | ⬜ 待开始 | 老师负责 |
| 四维补全（图片相似度） | ⬜ 可选 | 当前 image_similarity 维度未使用 |
| 演示视频 + PPT | ⬜ 待开始 | 队员负责 |
| 技术/需求文档定稿 | ⬜ 待开始 | 全员 |

---

## 当前阶段

| 周次 | 核心目标 | 状态 |
|------|----------|------|
| W1 | 需求冻结 & 架构定稿 | 🟢 完成 |
| W2 | 数据集构建 & 数据库搭建 | 🟢 完成 |
| W3 | 模型训练 & 核心API联调 | 🟢 完成 |
| W4 | 模型优化 & 全链路贯通 | 🟢 完成 |
| W5 | 全链路联调 & 融合策略定稿 | 🟡 进行中 |
| W6 | 系统完善 & 文档定稿 | ⬜ 待开始 |
| W7 | 提交材料准备 & 代码冻结 | ⬜ 待开始 |
| W8 | 正式提交 & 查漏补缺 | ⬜ 待开始 |

---

## 当前最大阻塞（优先级排序）

### 🔴 P0（已全部关闭 ✅）

| 任务 | 状态 | 完成时间 |
|------|------|----------|
| getEventDetail 返回 candidates[] | ✅ 完成 | W4（5/31前） |
| confirmEvent 支持 animal_id | ✅ 完成 | W4（5/31前） |
| nose.service 调 FastAPI 真实比对 | ✅ 完成 | W4（5/31前） |
| 四维度融合算法 | ✅ 完成（三维，image维度暂缺） | W4（5/31前） |

### 🟡 P1（功能完整度）

| 任务 | 状态 | 负责人 |
|------|------|--------|
| 微信登录 POST /auth/weixin 实现 | ⬜ 待开始 | 老师 |
| 审核详情页候选卡片 UI（完整渲染） | 🟡 框架就绪，等真实数据验证 | 队员 |
| AI 权重确认（确认 
ose_v3_sgd.pth 精度） | 🟡 待验证 | 队长 |
| image_similarity 维度（图片相似度） | 🟡 暂缺 | 队长（可选） |

### 🟢 P2（演示材料）

| 任务 | 状态 | 负责人 |
|------|------|--------|
| 演示视频 | ⬜ 待开始 | 队员 |
| PPT 制作 | ⬜ 待开始 | 队员 |
| 架构设计文档同步更新 | ⬜ 待开始 | 队长 |
| 后端接口文档同步更新 | ⬜ 待开始 | 老师 |
| README / wiki 同步更新 | ⬜ 待开始 | 全员 |
| 技术报告（AI模型部分） | ⬜ 待开始 | 队长 |

### 完成以下项后可进入演示

- 鼻纹采集（Step 1-4）→ AI 提向量 → 存 DB
- 比对结果页（三分支 UI）→ 四维融合 → 排序结果
- 管理员审核 → 看到候选动物 + 四维得分 → confirm/reject/process 完整闭环
- 腾讯地图导航验证

---

## W5 质量门控

| 门控项 | 状态 | 负责人 |
|--------|------|--------|
| 后端 getEventDetail 含候选列表 | ✅ 完成 | 老师 |
| 后端 confirmEvent 支持 animal_id | ✅ 完成 | 老师 |
| 前端审核详情页接真实 API | ✅ 完成 | 队员 |
| nose.service 调 FastAPI | ✅ 完成 | 队长/老师 |
| 三维融合算法（向量+GPS+文本） | ✅ 完成 | 队长 |
| AI /extract/feature 加载 
ose_v3_sgd.pth | ✅ 完成 | 队长 |
| AI /classify/breed 品种分类 | ✅ 完成 | 队长 |
| 前端全页面无阻塞 Bug | ✅ 完成 | 队员 |
| Plan B 用户自主建档流程 | ✅ 完成 | 队员/老师 |
| 微信登录 | ⬜ 待开始 | 老师 |
| 全链路端到端演示（手机真机测试） | ⬜ 待开始 | 全员 |

---

## 各模块现状（更新至 W5）

### AI 服务（FastAPI）— 队长 ✅ 就绪

| 端点 | 状态 | 权重文件 |
|------|------|----------|
| POST /extract/feature | ✅ | 
ose_v3_sgd.pth（98MB，已加载） |
| POST /compare/vector | ✅ | — |
| POST /detect/liveness | ✅ | — |
| POST /classify/breed | ✅ | reed_classifier_v3.pth（98MB） |

### 后端（NestJS）— 老师 ✅ 基本就绪

| 模块 | 现状 |
|------|------|
| admin.service.ts（getEventDetail / confirmEvent / rejectEvent / processEvent） | ✅ 含 candidates + 四维得分 |
| events.service.ts | ✅ 真实 DB |
| admin.controller.ts | ✅ JWT+Roles 验证 |
| nose.service.ts | ✅ 调 FastAPI，真实融合（Haversine + 文本） |
| auth.controller.ts（手机号登录） | ✅ 正常 |
| auth.controller.ts（微信登录） | ⬜ 未实现 |
| NestJS API versioning | ✅ /v1 prefix 启用 |

### 前端小程序 — 队员 ✅ 主体完成

| 页面 | 状态 |
|------|------|
| 用户端：Step 1 体图分类 → Step 2 鼻纹 → Step 3 表单 → Step 4 确认 | ✅ |
| 用户端：比对结果页（Plan B 三分支 UI + 双按钮） | ✅ |
| 用户端：腾讯地图静态图 + openLocation 导航 | ✅ |
| 用户端：动物详情页微信分享 | ✅ |
| 管理端：审核中心列表 + 详情页（真实 API + 四维得分） | ✅ |
| 管理端：用户列表（分页+搜索+筛选） | ✅ |
| 管理端：事件列表 → 详情页（点击跳转） | ✅ |
| 两个端：统一错误处理（空 catch toast） | ✅ |

---

## 文档清单（更新至 W5）

| 文档 | 状态 | 用途 |
|------|------|------|
| log.md | ✅ 持续更新 | 项目整体进度 |
| docs/架构设计.md | ⚠️ 需同步更新 | 系统架构（需补充 W4~W5 变更） |
| docs/后端接口文档-给老师.md | ⚠️ 需同步更新 | 需补充 Plan B 端点 |
| docs/AI服务接口文档.md | ⚠️ 需同步更新 | 需补充 classify/breed 端点 |
| docs/审核中心业务流程与缺口.md | ✅ 新增 | 缺口分析 |
| docs/后端管理端审核中心设计Spec.md | ✅ 新增 | 审核中心后端规范 |
| docs/管理端事件审核详情页设计Spec.md | ✅ 新增 | 审核详情页规范 |
| docs/体图AI品种分类规范.md | ✅ 新增 | 体图分类接口规范 |
| docs/体图AI品种分类实现计划.md | ✅ 新增 | 体图分类实现计划 |
| docs/地图预览设计规范.md | ✅ 新增 | 地图预览 UI 规范 |
| docs/地图预览实现计划.md | ✅ 新增 | 地图预览实现计划 |
| docs/融合得分真实数据流修复规范.md | ✅ 新增 | 融合得分真实化规范 |
| docs/补充管理端事件模块功能边界设计Spec.md | ✅ 新增 | 事件模块功能边界 |

---

## 截止日期

**2026年6月30日 15:00**（初赛提交）—— 剩余约 **28 天**
