# 项目进度日志

> 最后更新：2026-05-17 17:00（周日）
> 当前：W2 → W3 过渡，完成管理端/用户端数据渲染 Bug 修复
> 重大进展：前后端联调基础问题（URLSearchParams/photos/边距）全部清零

---

## 2026-05-17（周日）Bug 修复记录

### 管理端修复
1. **animals/index.vue** — `animal.photos[0]` → `animal.photos?.[0]`（photos 为 null 时报错）
2. **audit/index.vue** — `item.animal?.photos[0]` → `item.animal?.photos?.[0]`
3. **events/index.vue** — 搜索 keyword 未传给 API，已补上 `params.keyword`
4. **audit/index.vue** — loading 超时后遮罩层不消失导致按钮无法点击，改为非遮罩式加载状态
5. **边距调整** — animals/events 页面 list-area/filter-tabs；audit 页面 audit-card/tab-content；audit-event-card 组件，padding 24rpx → 28rpx，左右边距 28rpx → 36rpx

### 用户端修复
1. **api.js** — `new URLSearchParams(params)` 小程序兼容性问题，替换为手动 `Object.entries().filter().map().join('&')`
2. **index/index.vue** — `animal.photos[0]` → `animal.photos?.[0]`
3. **animal-card/index.vue** — 同上
4. **collect/result.vue** — `item.animal.photos[0]` → `item.animal?.photos?.[0]`
5. **animal-detail/index.vue** — v-for `animal.photos` → `(animal.photos || [])`

### 待修复（明天继续）
- 管理端：audit-event-card emit 参数类型（传对象而非 eventId 字符串）
- 管理端：claims 卡片按钮无 @click 事件绑定
- 管理端：success + timeout 同时触发（Promise resolve 链问题）
- 用户端：具体功能逻辑问题

---

## 当前阶段

| 周次 | 核心目标 | 状态 |
|------|----------|------|
| W1 | 需求冻结 & 架构定稿 | 🟢 完成（延迟1天） |
| W2 | 数据集构建 & 数据库搭建 | 🔴 进行中 |
| W3 | 模型训练 & 核心API联调 | ⬜ 待开始 |

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
| 2.1 鼻纹数据集采集（≥500组） | 🟢 已完成 | 队长 | 斯坦福 + 牛津猫狗数据集，AI训练 acc~94%，待训练真实鼻纹 |
| 2.2 数据清洗+鼻部标注 | ⬜ 待开始 | 队长 | 需手动改造数据库后启动 |
| 2.3 数据库建表 | 🟢 完成 | 老师 | DBeaver可视化，6张表已就绪 |
| 2.4 后端用户+动物 API | 🟢 完成 | 老师 | NestJS，23接口全通 |
| 2.5 前端接入真实API | 🟢 完成 | 队员 | URLSearchParams/photos/边距等联调基础问题已清零 |
| 2.6 AI 服务跑通 & 迁移 | 🟢 完成 | 队长 | 服务已验证，文档已产出 |
| 2.7 前/后端联调测试 | ⬜ 待启动 | 全员 | 今日目标：数据库+后端+前端全链路跑通 |
| 2.8 微信登录接口 | ⬜ 待通知 | 老师 | POST /auth/weixin，接收微信code换openid |

---

## 各模块进展

### AI 服务（miniapp-user）— 队长

**状态：✅ 推理服务已验证，训练脚本已就绪（理论验证）**

| 文件 | 说明 |
|------|------|
| `src/main.py` | FastAPI 入口，路由注册，37行 |
| `src/api/extract.py` | 特征提取端点（512维向量） |
| `src/api/detect.py` | 活体检测端点 |
| `src/api/compare.py` | 向量比对端点 |
| `src/models/mobilenet.py` | MobileNetV2 模型加载，65行，默认 embedding_dim=512，已更新 |
| `src/utils/image.py` | 图片预处理 |
| `src/utils/vector.py` | 向量计算（余弦相似度） |
| `src/scripts/train_stage1.py` | 阶段一训练脚本（冻结backbone，训512维头，233行） |
| `docs/队友操作指南.md` | ✅ 完整操作文档（供队员迁移到其他电脑） |
| `requirements.txt` | Python 依赖 |
| `.venv/` | ✅ Python 虚拟环境已创建（pip已装好） |
| `weights/.gitkeep` | 权重目录（训练后放入） |

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

### 后端（Node.js）— 老师

**状态：⬜ 尚未开始**

- `backend/` 目录只有 `.gitkeep`，无代码
- **需要老师尽快确认后端骨架进度**

---

## 前端进展

### 用户端小程序（miniapp-user）

| 页面 | 文件 | 状态 |
|------|------|------|
| 首页 | `pages/index/index.vue` | ✅ 完成（含搜索/筛选/下拉刷新/加载更多) |
| 鼻纹采集引导 | `pages/collect/index.vue` | ✅ 完成 |
| 比对结果页 | `pages/collect/result.vue` | ✅ 完成 |
| 动物详情页 | `pages/animal-detail/index.vue` | ✅ 完成 |
| 认领申请页 | `pages/claim/index.vue` | ✅ 完成 |
| 个人中心 | `pages/user/index.vue` | ✅ 完成 |
| TabBar | pages.json | ✅ 完成 |
| Mock 数据服务 | `services/mock.js` | ✅ 8个API模拟函数 |
| 占位图资源 | `static/mock/` | ✅ avatar/dog/cat/map |

### 管理端小程序（miniapp-admin）

| 页面 | 文件 | 状态 |
|------|------|------|
| 管理首页 | `pages/admin/index.vue` | ✅ 完成 |
| 审核中心 | `pages/admin/audit/index.vue` | ✅ 完成 |
| 动物档案管理 | `pages/animals/index.vue` | ✅ 完成 |
| 事件管理 | `pages/events/index.vue` | ✅ 完成 |
| 用户管理 | `pages/users/index.vue` | ✅ 完成 |
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

|| 任务 | 状态 | 产出 |
|------|------|------|
| AI 服务跑通 | ✅ 完成 | 推理服务 + 队友操作指南 |
| AI 服务 README | ✅ 完成 | `ai-service/README.md` |
| AI 阶段一训练脚本 | ✅ 完成 | `src/scripts/train_stage1.py` |
| AI 训练（斯坦福+牛津） | ✅ 完成 | acc~94%，待训练真实鼻纹数据 |
| 当前工作 | 🟡 进行中 | 手动验证：单图测试 → API测试 → dummy训练 |
| W2 数据集构建 | ✅ 已完成 | 斯坦福+牛津猫狗数据集 |
| W3 模型训练 | ⬜ 待开始 | 需等数据集就绪 |

### 队员（前端）

| 任务 | 状态 | 产出 |
|------|------|------|
| 页面开发 | ✅ 完成 | 全部页面 |
| 当前工作 | 🟡 进行中 | 从Mock切换到真实后端API |

### 老师（后端）

| 任务 | 状态 |
|------|------|
| 后端骨架 | ⬜ 未开始（最大阻塞点） |
| 数据库建表 | ⬜ 未开始 |
| 核心 API | ⬜ 未开始 |

---

## W2 门控检查

进入 W3 前必须达成：
- [ ] 数据集标注 ≥ 500 组（队长）
- [ ] 后端 API 可调通（老师）

---

## 文档清单

| 文档 | 路径 | 状态 |
|------|------|------|
| 项目协作规范 | `CLAUDE.md` | ✅ 完成 |
| README | `README.md` | ✅ 完成 |
| 架构设计 | `docs/架构设计.md` | ✅ 完成 |
| 前端开发指南 | `docs/前端开发指南.md` | ✅ 完成 |
| AI 服务开发指南 | `ai-service/README.md` | ✅ 完成 |
| AI 服务队友操作指南 | `ai-service/docs/队友操作指南.md` | ✅ 完成 |
| 用户端小程序 | `miniapp-user/` | ✅ 完成 |
| 管理端小程序 | `miniapp-admin/` | ✅ 完成 |
| 数据库建表脚本 | — | ⬜ 待老师 |
| 后端 API 文档 | — | ⬜ 待老师 |
| 管理端优化建议 | `docs/管理端优化建议.md` | ✅ 完成（8条建议，含P1 Bug修复） |
| 后端接口文档（给老师） | `docs/后端接口文档-给老师.md` | ✅ 完成（2026-05-13） |
| 前端对接后端指南 | `docs/前端对接后端指南.md` | ✅ 完成（2026-05-13） |
| 前端编写后端接口文档-任务要求 | `docs/前端编写后端接口文档-任务要求.md` | ✅ 完成（2026-05-13） |
| 数据库建表脚本 | `docs/数据库建表脚本.md` | ✅ 完成（2026-05-13） |
| 后端启动配置指南 | `docs/后端启动配置指南.md` | ✅ 完成（2026-05-13，NestJS版） |
| AI服务接口文档 | `docs/AI服务接口文档.md` | ✅ 完成（框架已就，待模型） |
| 技术方案文档 | `docs/技术方案.md` | ⬜ 待输出 |

---

## 当前最大阻塞

~~老师的后端（backend/）~~ → 已完成。

**Bug报告：管理端部分页面无请求** → ✅ **已修复**
- 文档：`docs/bug-report-管理端页面无请求.md`
- 修复内容：URLSearchParams 替换为手动拼接；photos 可选链修复；边距调大
- 待续：audit-event-card 参数类型、claims 按钮绑定、success+timeout 同时触发
