# FACT-BASELINE.md — 鼻纹智救项目事实基线

> **单一权威事实源（Single Source of Truth）**。本文件锁死所有数字、术语、文件名。任何文档与之冲突 → **以本文件为准**。
> 创建：2026-06-14（D1）| 最后修订：2026-06-13 | 基线守护者：队长（B 队）
> 任何更新需在 `log.md` 追加 `## [日期] baseline-update | 事实#N` 记录。

## 维护规则

1. **遇到数字冲突**：先看本文件 → 文档与本文件不一致 → 改文档（不是改基线）。
2. **发现基线缺失或错误**：由 B 队修订 → 同步全团队 → 走 commit `docs(baseline): 更新 #N`。
3. **行号引用规范**：`<文件路径>:<行号或行号区间>`，例如 `backend/src/nose/nose.service.ts:13`。
4. **影响文档**：列出本事实被哪些文档引用，方便反向追踪。

---

## §A 代码事实（#1-#20，2026-06-13 实测）

### 事实 #1：项目名
- **值**：AI 驱动的流浪动物防重复救助系统
- **来源**：产品描述任务文档 v1.7 §1
- **影响文档**：01, 07, README

### 事实 #2：产品名
- **值**：鼻纹智救
- **来源**：产品描述任务文档 v1.7 §2.1；README.md:1
- **影响文档**：01, 02, 07, README, 视频

### 事实 #3：后端框架
- **值**：**NestJS 11.x**（注意：不是 README 写的 Express，也不是 spec 写的 10.x）
- **来源**：`backend/package.json:23` `@nestjs/common: ^11.0.1`
- **历史变更**：W3 从 Express 切换到 NestJS（2026-05-21）
- **影响文档**：02, 03, 04, DEPLOY

### 事实 #4：前端框架
- **值**：UniApp + Vue3（微信小程序）
- **来源**：`README.md:26-27`；`miniapp-user/package.json`
- **影响文档**：02, 06, README

### 事实 #5：AI 框架
- **值**：FastAPI 0.109.0 + PyTorch 2.2.0 + torchvision 0.17.0
- **来源**：`ai-service/requirements.txt:1-4`
- **影响文档**：02, 05, DEPLOY

### 事实 #6：数据库
- **值**：MySQL 8.0，字符集 utf8mb4，InnoDB 引擎
- **来源**：`backend/src/app.module.ts:37-47`（TypeORM MySQL 配置）；docker-compose 镜像 mysql:8.0
- **影响文档**：02, 04, DEPLOY

### 事实 #7：向量维度与存储格式
- **值**：**512 维 Float32 特征向量**，实际以 **HEX 字符串**（1024 个 hex 字符）存储在 `nose_features.feature_vector` 字段（DB 类型为 `text`）
- **来源**：
  - 编码：`backend/src/nose/nose.service.ts:60-67` `encodeVector`
  - 解码：`backend/src/nose/nose.service.ts:69-77` `decodeVector`
  - 模型：`ai-service/src/models/mobilenet.py:74-109` `ResNet50_512d` 类
  - 字段类型：`backend/src/nose/entities/nose-feature.entity.ts:23-25` `@Column({ type: 'text', name: 'feature_vector' })`
- **历史变更**：v1 文档曾写 128 维，2026-05-25 改为 512 维
- **影响文档**：02, 04, 05, DEPLOY

### 事实 #8：融合算法（collect/compare 流程）
- **值**：**3 维加权融合** `fusion = 0.5 × vector_similarity + 0.3 × gps_similarity + 0.2 × text_match_rate`
- **来源**：`backend/src/nose/nose.service.ts:13` `const FUSION_WEIGHTS = { vector: 0.5, gps: 0.3, text: 0.2 }`；第 364 行 `rawFusion = item.cosine_similarity * FUSION_WEIGHTS.vector + gpsSim * FUSION_WEIGHTS.gps + textSim * FUSION_WEIGHTS.text`
- **影响文档**：02, 03, 05, 07
- **已知不一致（已记录为代码 bug）**：`gpsScore` 函数定义（`nose.service.ts:26-28`）使用分母 1000，但 `compare()` 方法中（`nose.service.ts:348`）使用分母 4500，**实际生效的是 4500 公式**

### 事实 #8b：融合算法（report 流程，与 collect 不同！）
- **值**：**3 维加权融合** `fusion = 0.5 × gps_similarity + 0.3 × text_match_rate + 0.2 × time_score`
- **来源**：`backend/src/matching/matching.service.ts:32-36` `FUSION_WEIGHTS = { gps: 0.5, text: 0.3, time: 0.2 }`
- **影响文档**：02, 05
- **说明**：report 流程没有鼻纹向量，改用 GPS 主导（0.5）+ 文本（0.3）+ 时间（0.2）

### 事实 #9：阈值
- **值**：≥0.88 确认重复 / 0.75-0.88 疑似 / <0.75 无匹配
- **来源**：`backend/src/nose/nose.service.ts:276-277` `threshold_confirmed = 0.88; threshold_suspected = 0.75`
- **影响文档**：01, 02, 03, 06, 07

### 事实 #10：API 总数与模块分布
- **值**：**~40 个 REST 端点**（NestJS）+ **4 个 AI 内部端点**（FastAPI）
  - auth: 6（login/register/weixin/send-code/bind-phone/reset-password）
  - users: 2（GET me / PATCH me）
  - animals: 6（GET list/GET detail/POST v1 admin/POST v2 user/PUT/DELETE）
  - nose: 3（collect/compare/classify）— 全部 `@Public`
  - events: 3（POST/GET my/GET list admin）
  - claims: 2（POST/GET my）
  - upload: 1（POST /upload）
  - admin: 19（stats + events list/detail/confirm/reject/process + claims list/detail/approve/reject + animals CRUD + users CRUD）
  - **AI（FastAPI 内部）**: 4（/extract/feature, /compare/vector, /detect/liveness, /classify/breed）
- **来源**：
  - `backend/src/auth/auth.controller.ts:11-53`（6 endpoints）
  - `backend/src/users/users.controller.ts:13-23`（2 endpoints）
  - `backend/src/animals/animals.controller.ts:18-68`（6 endpoints, 含 v1+v2 双 POST）
  - `backend/src/nose/nose.controller.ts:15-34`（3 endpoints）
  - `backend/src/events/events.controller.ts:16-34`（3 endpoints）
  - `backend/src/claims/claims.controller.ts:14-24`（2 endpoints）
  - `backend/src/upload/upload.controller.ts:10-16`（1 endpoint）
  - `backend/src/admin/admin.controller.ts:23-147`（19 endpoints）
  - `ai-service/src/main.py:33-37`（4 AI endpoints）
- **影响文档**：03, 02

### 事实 #11：数据库表数
- **值**：**5 张表**（users / animals / nose_features / rescue_events / claims）
- **重要更正**：原 spec 写的"6 张表（含 locations）"是错的，**locations 不是独立表**，`location_lat`/`location_lng` 字段直接嵌入在 `animals` 和 `rescue_events` 表
- **来源**：`backend/src/app.module.ts:44` `entities: [User, Animal, NoseFeature, RescueEvent, Claim]`
- **影响文档**：04

### 事实 #12：模型权重文件
- **值**：
  - `nose_v3_sgd.pth`（98,552,066 字节 ≈ 98MB，2026-05-30 生成）— 鼻纹特征提取
  - `breed_classifier_v3.pth`（98,554,466 字节 ≈ 98MB，2026-05-28 生成）— 品种分类
  - `breed_protos_*.pt`（约 320KB）— 品种分类原型缓存
- **来源**：`F:\swcup2026\ai-service\weights\` 目录；模型加载代码 `ai-service/src/api/extract.py:26`、`ai-service/src/api/breed.py:174`
- **重要更正**：README.md 第 30 行写"MobileNetV2 迁移学习"，**实际部署的是 ResNet50_512d**（不是 MobileNetV2）
- **影响文档**：05, code/README, 02

### 事实 #13：训练数据集
- **值**：
  - **Oxford IIIT Pet Dataset**（37 类，约 7,390 张，猫狗混合）— 品种分类训练 + 鼻纹特征预训练
  - **Stanford Dogs Dataset**（约 20,580 张，120 类犬种）— 鼻纹特征微调
  - **自采集数据**（约 500+ 张）— 真实场景微调
- **来源**：
  - `ai-service/oxford_pets_split/`（训练/验证划分已就绪）
  - `ai-service/Stanford_Dogs/`
  - `ai-service/dir_train/`（自采集）
- **影响文档**：05

### 事实 #14：AI 端点列表（FastAPI 内部）
- **值**：
  - `POST /extract/feature`（512 维向量提取，输入 base64 图片）
  - `POST /compare/vector`（余弦相似度 + L2 距离）
  - `POST /detect/liveness`（活体/清晰度检测：blur ≥ 50 + brightness [30, 220]）
  - `POST /classify/breed`（37 品种分类 + top-3 + 中文名）
- **来源**：
  - `ai-service/src/api/extract.py:57-72`
  - `ai-service/src/api/compare.py:22-36`
  - `ai-service/src/api/detect.py:23-67`（BLUR_THRESHOLD=50, BRIGHTNESS_MIN=30, BRIGHTNESS_MAX=220）
  - `ai-service/src/api/breed.py:222-258`（_BREED_NAMES 长度 37）
- **影响文档**：02, 03, 05

### 事实 #15：状态流转枚举值
- **值**：
  - `User.role`：`user` / `admin` / `org`
  - `Animal.status`：`lost` / `found` / `claimed` / `archived`（**孤儿鼻纹特殊值**：`orphan`）
  - `RescueEvent.status`：`pending` / `confirmed` / `duplicated` / `linked` / `resolved` / `rejected` / `processing`
  - `Claim.status`：`pending` / `approved` / `rejected` / `cancelled`
  - `NoseFeature.collection_angle`：`front` / `left` / `right` / `top`
  - `RescueEvent.event_type`：`collect` / `report` / `rescue` / `medical` / `adopt` / `transfer` / `release`
- **来源**：
  - `backend/src/users/entities/user.entity.ts:9-13` `UserRole`
  - `backend/src/animals/entities/animal.entity.ts:11-66` 多 enum
  - `backend/src/events/entities/event.entity.ts:13-31` `EventType`, `EventStatus`
  - `backend/src/claims/entities/claim.entity.ts:13-18` `ClaimStatus`
  - `backend/src/nose/entities/nose-feature.entity.ts:44-50` `collection_angle` enum
- **影响文档**：02, 04, 06

### 事实 #16：关键依赖版本
- **值**：
  - 后端：`@nestjs/* 11.0.1`、`typeorm 0.3.29`、`mysql2 3.22.3`、`bcryptjs 3.0.3`、`uuid 14.0.0`
  - AI：`fastapi 0.109.0`、`torch 2.2.0`、`torchvision 0.17.0`、`opencv-python 4.9.0.80`、`numpy 1.26.3`、`scikit-learn 1.4.0`
  - 前端：UniApp 最新 + Vue 3.x
- **来源**：`backend/package.json:22-44`、`ai-service/requirements.txt:1-9`
- **影响文档**：02, DEPLOY

### 事实 #17：服务器端口
- **值**：后端 `3000` / AI 服务 `8000` / MySQL `3306`
- **来源**：
  - `backend/src/main.ts:12` `const PORT = configService.get<number>('PORT') || 3000`
  - `ai-service/src/main.py` 启动脚本 `uvicorn src.main:app --port 8000`（DEPLOY.md 推荐）
  - MySQL 标准端口
- **影响文档**：02, DEPLOY

### 事实 #18：鉴权方案
- **值**：JWT（`@nestjs/jwt 11.x`）+ bcryptjs 密码哈希（10 rounds）；请求头 `Authorization: Bearer <token>`
- **来源**：
  - `backend/src/auth/auth.service.ts:31` `this.jwtService.sign({ user_id: user.user_id, role: user.role })`
  - `backend/src/auth/auth.service.ts:9` `const BCRYPT_ROUNDS = 10`
  - `backend/src/common/guards/jwt-auth.guard.ts:7-26` `JwtAuthGuard`
- **影响文档**：02, 03, 07

### 事实 #19：部署平台
- **值**：本地 docker-compose（MySQL）+ Node.js 18+（后端）+ Python 3.9+（AI）
- **来源**：`ai-service/Dockerfile`、`backend/package.json`
- **影响文档**：DEPLOY

### 事实 #20：已实现的"本版本不含"功能
- **值**：与产品描述 v1.7 §19 一致：不含在线支付/聊天/导流/社交/志愿者管理；**用户头像已移除**（2026-06-13 决策，`users/entities/user.entity.ts` 已无 `avatar_url` 字段）
- **影响文档**：01, 07, 视频

---

## §B 产品事实（#21-#25）

### 事实 #21：目标用户
- **值**：3 类：① 普通救助者（拍照查重） ② 救助站/民间组织（管理档案） ③ 动物保护协会（数据统计）
- **来源**：产品描述任务文档 v1.7 §2.2
- **影响文档**：01, 06, 07

### 事实 #22：核心用户故事
- **值**：2 个核心
  - 故事 A（救助者）：拍到一只流浪狗 → 拍鼻纹 → 系统 2 秒内告知是否已被救助 → 引导认领或新建档案
  - 故事 B（管理员）：用户上传 10 条新事件 → 看到候选匹配卡片 → 一键确认/驳回/合并
- **来源**：产品描述 v1.7 §2.3
- **影响文档**：01, 06, 07

### 事实 #23：状态流转规则
- **值**：
  - 动物：`lost` → `found` → `claimed` → `archived`（30 天无异常）
  - 事件：`pending`（AI 匹配中） → `confirmed`（人工确认唯一） / `duplicated`（合并到已有动物） / `rejected`（驳回） / `linked`（关联孤儿鼻纹） / `resolved`（已解决） / `processing`（处理中）
  - 认领：`pending` → `approved`（动物自动转 `claimed`） / `rejected` / `cancelled`
- **来源**：`admin.service.ts:194-205` `approveClaim` 业务逻辑、`admin.service.ts:116-165` `confirmEvent` 状态机
- **影响文档**：02, 06, 07

### 事实 #24：风控规则
- **值**：
  - 必填：鼻纹照片、GPS 坐标（禁止 0,0）、文字描述
  - 限频：发布频率限制（产品描述 v1.7 §15）
  - 隐私：脱敏手机号（`132****5678` 格式，`auth.service.ts:192`）
  - 必读隐私协议：`User.agreed_privacy_at` 必须非空（`auth.service.ts:69, 74`）
- **来源**：`backend/src/auth/auth.service.ts:188-197` `sanitizeUser`、`backend/src/nose/nose.service.ts:169-171` 坐标校验
- **影响文档**：01, 02, 07

### 事实 #25：边界情况（8 条）
- **值**：
  1. AI 重复误判 → 阈值 ≥ 0.88 才确认
  2. 认领争议 → 管理员介入
  3. 隐私保护 → 手机号脱敏
  4. 采集不规范 → 活体检测 + GPS 必填
  5. 孤儿鼻纹（采过但未建档）→ 5 种 `next_action` 区分
  6. 多个动物同框 → 仅识别主目标
  7. 极端角度（90° 侧视）→ AI 拒识
  8. 验证码过期 → 5 分钟有效（`auth.service.ts:122`）
- **来源**：产品描述 v1.7 §18 + 实测代码
- **影响文档**：01, 06

---

## §C 性能事实（#26-#30）

> **说明**：以下事实点需在 D14 端到端测试 + D4 评测后填入实际值。本节目前保留占位，由 B 队（队长）在测试完成后更新。

### 事实 #26：模型准确率
- **值**：**待评测后填**（log.md 历史记录提到 94%，但未经验证集实测）
- **影响文档**：05, 01, 07
- **更新要求**：跑 `ai-service/eval/eval.py` 后填入 `accuracy_recall_f1.json` 实际值

### 事实 #27：ROC-AUC
- **值**：**待评测后填**
- **影响文档**：05
- **更新要求**：跑评测后读 `roc_curve.png` 标注的 AUC 值

### 事实 #28：端到端响应时间
- **值**：**待 D14 实测后填**（验收项 V5 要求 AI 检测 < 2 秒）
- **影响文档**：05, 07

### 事实 #29：模型总大小
- **值**：98MB × 2 = 196MB
- **来源**：`F:\swcup2026\ai-service\weights\` 目录
- **影响文档**：05, code/README

### 事实 #30：AI 检测响应时间
- **值**：**待 D4 评测后填**
- **验收要求**：< 2 秒（产品描述 v1.7 §V5）
- **影响文档**：05, 07

---

## §D 已知代码 bug / 不一致（必须显式记录）

| # | 位置 | 问题 | 影响 | 处置 |
|---|------|------|------|------|
| **B1** | `nose.service.ts:27` vs `nose.service.ts:348` | GPS 距离评分公式分母不一致（1000 vs 4500） | compare 实际生效 4500，collect 实际生效 1000，但 collect 也走 4500 公式时是 bug 还是有意？需追溯设计 | 记录为已知不一致，文档中**统一以 4500 为准**（compare 是主链路） |
| **B2** | `breed.py:144` `for i in range(157)` | 实际只有 37 类，range(157) 是冗余循环 | 实际不影响功能（`mask = all_labels == i` 无样本时跳过） | 记录为已知瑕疵，文档中以 37 类为准 |
| **B3** | `mobilenet.py` 类名 `MobileNetV2_128d` | 类名暗示 128 维但实际 `embedding_dim=512` 输出 512 维 | 误导阅读者 | 文档统一说"512 维 ResNet50 部署" |
| **B4** | README.md 第 13 行 `backend/  # Node.js 后端` | 实际是 NestJS（TypeScript）不是 Node.js Express | 旧文档漂移 | 文档统一说 NestJS 11.x |

---

## §E 历史变更日志

| 日期 | 变更 | 事实# |
|------|------|------|
| 2026-05-21 | 后端从 Express 切换到 NestJS | #3 |
| 2026-05-25 | 向量维度从 128 改为 512 | #7 |
| 2026-06-02 | log.md 最后更新（W5 结束） | — |
| 2026-06-13 | 移除 User.avatar_url 字段 | #20 |
| 2026-06-13 | 移除 `image_similarity` 加权（report 流改用 3 维 gps+text+time） | #8b |
| 2026-06-13 | 修复 textMatch 严格相等匹配 Bug | — |
| 2026-06-13 | 修复 AnimalsService.create Bug6：建档时回填孤儿 NoseFeature.animal_id | — |
| 2026-06-13 | 建立本 FACT-BASELINE.md | 全部 |

---

## 验收检查

- [x] 30 个事实点全部填写
- [x] 每条标注来源文件路径
- [x] 每条列出影响文档
- [x] 全文无 "TBD/待定"（性能事实 #26-#30 显式标注"待评测"）
- [x] 已知代码 bug 已显式记录

**基线守护者签字**：队长 ✓ | **D1 日期**：2026-06-14
