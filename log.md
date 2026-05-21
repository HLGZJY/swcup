# 项目进度日志

> 最后更新：2026-05-21 09:30（周四）
> 当前：W3 第三天 — 前端增强 + AI服务接入并行的中段
> 代码核查后更新：管理端用户管理增强完成、用户端分享功能完成

---

## 2026-05-20（周三）W3 启动 — 代码核查结果

### 各模块代码现状（只读核查，非修改）

#### 后端（NestJS）— 老师
| 模块 | 代码真实情况 | 备注 |
|------|-------------|------|
| admin.service.ts | ✅ 全是真实DB查询 | 统计/事件/认领/用户，非Mock |
| events.service.ts | ✅ create/findAll 真实写DB | 事件创建已通 |
| admin.controller.ts | ✅ 完整 REST 路由 | JWT+Roles双验证 |
| auth.controller.ts | ✅ 手机号+密码登录注册 | ❌ 微信登录缺失 |
| **nose.service.ts** | ❌ **仍为Mock** | collect()注释写明 `// Mock AI response`，compare() 同上 |
| 四维度融合计算 | ❌ **完全缺失** | 只有架构文档，代码无实现 |
| 后端→AI服务调用 | ❌ **完全缺失** | 没有调 FastAPI 的 HTTP 请求代码 |

#### AI 服务（FastAPI）— 队长
| 文件 | 现状 | 备注 |
|------|------|------|
| `src/api/extract.py` | ✅ 框架完整 | base64→512维向量 |
| `src/api/detect.py` | ✅ 有框架 | 活体检测 |
| `src/api/compare.py` | ✅ 有框架 | 向量比对 |
| `weights/stage1_oxford.pth` | ✅ 权重文件已存在 | 牛津数据集训练 |
| 模型加载 | ⚠️ `load_model(weights_path=None)` | **未加载权重，用ImageNet预训练** |
| 真实鼻纹 fine-tune | ⬜ 待完成 | 待队友传文件 |

#### 前端（用户端+管理端）— 队员
| 现状 | 说明 |
|------|------|
| ✅ 已切真实后端 | BASE_URL = `http://192.168.32.1:3000` |
| ✅ URLSearchParams 兼容 | 已替换为手动拼接 |
| ✅ photos 可选链 | 已修复 null 崩溃 |
| ✅ 鼻纹接口已定义 | collect/compare 公开接口，`needAuth: false` |
| ✅ 管理端全接口定义 | JWT+admin role，完整对接 |
| ❌ 仍有待修Bug | audit-event-card参数/claims按钮/Promise链/用户端逻辑 |

---

### W3 进入门槛确认（代码核查结论）

| 门控项 | 状态 | 说明 |
|--------|------|------|
| 数据集采集 | ✅ | 斯坦福+牛津，acc~94% |
| 数据库建表 | ✅ | 6张表，MySQL |
| 后端骨架+CRUD | ✅ | NestJS，admin模块真实DB |
| 前端真实API对接 | ✅ | 两个端均已切真实后端 |
| **鼻纹AI服务接入后端** | ❌ | nose.service 仍Mock，无HTTP调用AI代码 |
| **微信登录** | ❌ | 只有文档，无代码 |
| **四维度融合算法** | ❌ | 只有架构文档，代码空白 |

### W3 核心待办（P0 阻塞）

```
🔴 P0（阻断 W3 演示）：
  1. nose.service.ts 接入 AI 服务 — 后端调 FastAPI /extract/feature
  2. 四维度融合计算逻辑 — 后端实现 fusion_score = 0.40×余弦 + 0.20×GPS + 0.20×pHash + 0.20×文本
  3. nose.service collect() 真实存储 512维向量到 MySQL

🟡 P1（功能完整度）：
  4. 微信登录 POST /auth/weixin — 接口文档已产出，代码未实现
  5. 前端剩余 Bug 修复（audit-event-card参数/claims按钮/Promise链）
  6. AI 模型加载 stage1_oxford.pth 权重文件

🟢 完成后可演示：
  - 鼻纹采集 → AI提取向量 → 存DB
  - 鼻纹比对 → AI提取向量 → 四维融合 → 返回排序结果
```

---

## 当前阶段

| 周次 | 核心目标 | 状态 |
|------|----------|------|
| W1 | 需求冻结 & 架构定稿 | 🟢 完成 |
| W2 | 数据集构建 & 数据库搭建 | 🟢 完成 |
| W3 | 模型训练 & 核心API联调 | 🟡 进行中 |

---

## 2026-05-21（周四）W3 第三天 — 前端增强完成

### 本日完成（前端 — 队员）

#### 管理端用户管理增强
| 任务 | 状态 | 产出 |
|------|------|------|
| 用户列表操作列 | ✅ 完成 | 禁用/启用 switch + 查看详情按钮 |
| 用户详情页 | ✅ 完成 | Tab切换（基本信息/操作记录），头像+昵称+手机+角色+注册时间 |
| 编辑弹窗 | ✅ 完成 | 角色切换（普通用户/管理员/机构），确认取消按钮 |
| 路由注册 | ✅ 完成 | `pages.json` 新增 `pages/users/detail/index` |

#### 用户端微信分享
| 任务 | 状态 | 产出 |
|------|------|------|
| 全局分享配置 | ✅ 完成 | `App.vue` + `utils/page-share.js` |
| 动物详情页分享 | ✅ 完成 | `animal-detail/index.vue` 自定义分享（聊天+朋友圈） |
| 分享提示优化 | ✅ 完成 | `onShare()` 改为 toast 提示「请点击右上角···分享」 |
| 分享菜单启用 | ✅ 完成 | `uni.showShareMenu` 在 `onMounted` 中调用 |

#### Bug 修复
| Bug | 修复方式 |
|-----|---------|
| pages.json 缺少 users/detail 路由 | 新增路由配置 |
| search-icon 尺寸异常 | `.search-icon { font-size }` → `width/height: 32rpx` |
| definePageConfig 不存在 | 改用 Options API（双 script 块） |
| animal-detail 编译错误 | 补 lang="ts"、补函数闭合括号 |
| uni.share 不存在 | 改用原生分享菜单提示 |

#### 用户端反馈优化（计划中，未实施）
- 空 catch 统一 toast 提示
- onShare 回调反馈（微信 8.0.4+）
- 鼻纹采集页帮助提示

#### 管理端反馈优化（计划中，未实施）
- 空 catch 统一错误处理（`uni.showToast` 展示失败原因）
- 加载状态优化（`uni.showLoading` + `uni.hideLoading`）

---

## W1 任务状态（已结束）

| 任务 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| 1.1 需求对齐会 | 🟢 完成 | 全员 | 架构文档已作为事实标准 |
| 1.2 鼻纹技术方案 | 🟢 完成 | 队长 | `docs/架构设计.md` + `ai-service/README.md` |
| 1.3 架构设计 | 🟢 完成 | 队长 | `docs/架构设计.md` |
| 1.4 UI/UX 原型 | 🟢 完成 | 队员 | 超出预期：实际页面全部开发完成 |
| 1.5 前端项目初始化 | 🟢 完成 | 队员 | 两个小程序均完整搭建 |
| 1.6 后端 REST API（NestJS） | 🟢 完成 | 老师 |
| 1.7 Git 仓库初始化 | 🟢 完成 | 队长 |
| docs/后端开发进度.md | 🟢 完成 | 老师 |
| docs/AI接入方案.md | 🟢 完成 | 老师 |

---

## W2 任务状态

| 任务 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| 2.1 鼻纹数据集采集（≥500组） | 🟢 完成 | 队长 | 斯坦福+牛津，acc~94% |
| 2.2 数据清洗+鼻部标注 | ⬜ 待开始 | 队长 | 待真实鼻纹数据 |
| 2.3 数据库建表 | 🟢 完成 | 老师 | MySQL，6张表 |
| 2.4 后端 CRUD API | 🟢 完成 | 老师 | NestJS，admin模块全真实DB |
| 2.5 前端接入真实API | 🟢 完成 | 队员 | 两个端均已切真实后端 |
| 2.6 AI 服务框架 | 🟢 完成 | 队长 | FastAPI框架+权重文件stage1_oxford.pth |
| 2.7 前/后端联调 | 🟡 进行中 | 全员 | 管理端已通，剩余前端Bug+AI接入 |

---

## W3 任务状态（进行中）

| 任务 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| 3.1 鼻纹AI接入后端 | 🔴 进行中 | 队长/老师 | nose.service调FastAPI /extract/feature |
| 3.2 四维度融合算法 | 🔴 进行中 | 队长 | fusion_score后端实现 |
| 3.3 微信登录 | 🟡 待开始 | 老师 | 文档已产出，代码未实现 |
| 3.4 前端Bug收尾 | 🟢 完成 | 队员 | admin-users增强+用户端分享功能 |
| 3.5 AI权重加载 | 🟡 进行中 | 队长 | 加载stage1_oxford.pth替代ImageNet |
| 3.6 管理端错误处理优化 | 🟢 完成 | 队员 | 空catch统一toast提示+console.error |
| 3.7 用户端错误处理优化 | 🟢 完成 | 队员 | 空catch统一toast提示+console.error |

---

## 2026-05-17 待办遗留（明日 W3 首日）

### 前端（队员）
- [ ] audit-event-card emit 参数类型（传对象而非 eventId 字符串）— P1
- [ ] 管理端 claims 卡片按钮无 @click 事件绑定 — P1
- [ ] Promise resolve 链：`success + timeout` 同时触发问题 — P1
- [ ] 用户端具体功能逻辑问题 — P2

### AI（队长）
- [ ] 单图推理验证（`python single_image_test.py`）
- [ ] API 服务验证（`python test_api.py`）
- [ ] Dummy 数据训练验证（`python src/scripts/train_stage1.py --epochs 2 --batch 8`）
- [ ] 真实鼻纹数据采集方案设计

### 后端（老师）
- [ ] 微信登录接口 `POST /auth/weixin` 实现（开放接口文档已产出）

---

## 各模块进展

### AI 服务（FastAPI）— 队长

**状态：✅ 框架完整，权重文件已就绪**

| 文件 | 说明 |
|------|------|
| `src/main.py` | FastAPI 入口，37行 |
| `src/api/extract.py` | 特征提取端点（512维向量） |
| `src/api/detect.py` | 活体检测端点 |
| `src/api/compare.py` | 向量比对端点 |
| `src/models/mobilenet.py` | MobileNetV2，embedding_dim=512 |
| `weights/stage1_oxford.pth` | ✅ **权重文件已存在**（牛津数据集） |
| ⚠️ 模型加载 | `load_model(weights_path=None)` — **未加载权重，用ImageNet预训练** |

**当前阻塞：**
- `extract.py` 第21行 `load_model(weights_path=None)` — 需要改为加载 `weights/stage1_oxford.pth`
- 后端 `nose.service.ts` 完全没有调 FastAPI 的 HTTP 代码

**训练流程（当前阶段一）：**
- **阶段一**：冻结MobileNetV2 backbone，只训练512维embedding head（快速baseline）
- **后续阶段二**：解锁部分backbone层，用ArcFace/Triplet Loss微调（高精度，待实现）

**手动验证步骤（队长待执行）：**
```bash
cd ai-service
# 1. 先验证单图推理（不依赖真实数据集）
python single_image_test.py <任意图片路径>

# 2. 验证API服务
python test_api.py

# 3. 用dummy数据验证训练流程（不需真实数据集）
python src/scripts/train_stage1.py --epochs 2 --batch 8
```

**迁移说明**：队友操作指南已写好，可直接在其他电脑上 `git clone` 后 `pip install -r requirements.txt` 即可运行。

---

### 前端小程序 — 队员

**状态：✅ 全部页面完成，当前接入真实API中**

| 项目 | 页面数 | Mock | 状态 |
|------|--------|------|------|
| 用户端 miniapp-user | 6个页面 | ✅ | 正在接真实API |
| 管理端 miniapp-admin | 5个页面 | ✅ | 正在接真实API |

详情见下方「前端进展」章节。

---

### 后端（Node.js/NestJS）— 老师

**状态：✅ 骨架完整，已进入联调阶段**

| 模块 | 代码状态 | 说明 |
|------|----------|------|
| admin.service.ts | ✅ 真实DB | 统计/事件/认领/用户全真 |
| events.service.ts | ✅ 真实DB | create已通，processEvent触发AI |
| admin.controller.ts | ✅ 完整路由 | JWT+Roles双验证 |
| auth.controller.ts | ✅ 手机号登录 | ❌ 微信登录未实现 |
| nose.service.ts | ❌ **仍为Mock** | collect/compare都是假数据 |
| 后端→AI服务调用 | ❌ 空白 | 无HTTP请求到FastAPI代码 |

> 原始记录：后端骨架 → ✅ 已完成。

---

## 前端进展

### 用户端小程序（miniapp-user）

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
| TabBar | pages.json | ✅ 完成 |
| 全局分享配置 | `App.vue` + `utils/page-share.js` | ✅ 完成（新增） |
| Mock 数据服务 | `services/mock.js` | ✅ 8个API模拟函数 |

### 管理端小程序（miniapp-admin）

| 页面 | 文件 | 状态 |
|------|------|------|
| 管理首页 | `pages/admin/index.vue` | ✅ 完成 |
| 审核中心 | `pages/admin/audit/index.vue` | ✅ 完成 |
| 动物档案管理 | `pages/animals/index.vue` | ✅ 完成 |
| 事件管理 | `pages/events/index.vue` | ✅ 完成 |
| 用户管理 | `pages/users/index.vue` | ✅ 完成（含操作列） |
| 用户详情 | `pages/users/detail/index.vue` | ✅ 完成（新增） |
| TabBar | pages.json | ✅ 完成 |
| Mock 数据服务 | `services/mock.js` | ✅ 完成 |

### 技术亮点

- **主色调**：#0FBF9F（青绿色渐变）
- **组件化**：Vue3 Composition API (`<script setup>`)
- **Mock 服务**：8个API模拟，500-1500ms延迟仿真
- **无后端依赖**：前端完全独立，可直接演示
- **临时目录**：`miniapp-user-tmp/`（早期探索，可忽略）

---

## 各角色当前任务

### 队长（AI模型）

| 任务 | 状态 | 产出 |
|------|------|------|
| AI 服务框架 | ✅ 完成 | FastAPI 推理服务 |
| 权重文件 | ✅ 已就绪 | `weights/stage1_oxford.pth` |
| 当前工作 | 🔴 进行中 | 接入后端：调FastAPI + 四维融合算法 |
| 待完成 | 🟡 待开始 | 加载权重文件替换ImageNet预训练 |

### 队员（前端）

| 任务 | 状态 |
|------|------|
| 页面开发 | ✅ 完成 |
| 真实API对接 | ✅ 完成 |
| 管理端用户管理增强 | ✅ 完成 |
| 用户端微信分享 | ✅ 完成 |
| 管理端错误处理优化 | 🟡 待开始 |
| 用户端反馈提示完善 | 🟡 待开始 |

### 老师（后端）

| 任务 | 状态 |
|------|------|
| NestJS骨架 | ✅ 完成 |
| 数据库建表 | ✅ 完成 |
| admin CRUD | ✅ 完成 |
| 待完成 | 🔴 接入AI服务 + 🟡 微信登录 |

---

## W3 门控检查（进入演示必须达成）

| 门控项 | 状态 | 负责人 |
|--------|------|--------|
| 后端 nose.service 调 AI | 🔴 进行中 | 队长/老师 |
| 四维度融合算法 | 🔴 进行中 | 队长 |
| 前端增强（管理用户/用户分享） | 🟢 完成 | 队员 |
| 前端反馈优化（错误处理/提示） | 🟡 待开始 | 队员 |
| 微信登录 | 🟡 待开始 | 老师 |
| AI权重加载 | 🟡 进行中 | 队长 |

---

## 当前最大阻塞

~~后端骨架~~ → ✅ 已完成。最大阻塞已转移至 AI 服务接入。

**🔴 核心阻断：后端 nose.service 尚未接入 AI 服务**
- `nose.service.ts` 的 `collect()` 和 `compare()` 仍为 Mock 数据
- 后端没有任何调 FastAPI (`http://127.0.0.1:8000`) 的 HTTP 请求代码
- 四维度融合计算逻辑只存在于架构文档，代码完全空白

**次级阻塞：**
- 微信登录 `POST /auth/weixin` 只有文档无代码 — 老师
- 前端剩余 Bug（audit-event-card参数/claims按钮/Promise链）— 队员
- AI 模型未加载 `stage1_oxford.pth` 权重 — 队长
