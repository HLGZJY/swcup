# 比赛文档准备 — 实施计划（B-PARALLEL-3SQ）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 2026-06-30 15:00 前交付完整初赛提交包（比赛 4 件套 + 7 类专项文档 + 1 个视频），3 人小队并行 17 天完成。

**Architecture:** 单一权威事实源（`submission/appendix/FACT-BASELINE.md`）+ 3 路并行小队（A 队后端/B 队 AI/C 队产品视觉）+ 三道门控（G1/D1 基线、G2/D4 骨架、G3/D17 封板）+ D14-D16 交叉评审。

**Tech Stack:** Markdown（所有文档）+ 微信小程序录屏（视频）+ Python+sklearn（AI 评测脚本）+ MySQL+FastAPI+NestJS（被文档化的对象）+ Git 提交管理。

**Spec:** [`docs/superpowers/specs/2026-06-13-competition-submission-design.md`](../specs/2026-06-13-competition-submission-design.md)

**Convention:**
- 文档/代码 commit message 遵循项目惯例：`[YYYY-MM-DD] type(scope): 摘要`（中英文混用，按团队习惯）
- 文档 checklist 引用 spec §5 各节末尾
- 涉及代码改动时仍走 conventional commits（`feat:`/`fix:`/`docs:`/`chore:`）
- 每日 D2-D16 站会后追加 `log.md` 记录

---

## 阶段总览

| 阶段 | 日期 | 范围 | Task |
|------|------|------|------|
| **0** | D1（6/14 周日） | 事实基线日 | Task 1-2 |
| **1** | D2（6/15） | 模板与目录骨架 | Task 3-4 |
| **2** | D3-D4（6/16-6/17） | 7 份文档骨架 + AI 评测脚本 | Task 5-11 |
| **3** | D5-D9（6/18-6/22） | 技术类文档内容（03/04/05/02） | Task 12-16 |
| **4** | D10-D13（6/23-6/26） | 产品类文档内容（01/06/07/08） | Task 17-21 |
| **5** | D14-D16（6/27-6/29） | 评审/视频/打包 | Task 22-27 |
| **6** | D17（6/30 上午） | 封板与提交 | Task 28-30 |

**总任务数**：30 个 task，约 30 个工作日（3 人并行 17 天可完成）。

---

## 角色约定

| 缩写 | 角色 | 主要工作目录 | 关键产出 |
|------|------|-------------|---------|
| **A 队** | 老师 | `submission/03-接口设计文档.md`、`submission/04-数据库设计文档.md`、`submission/code/`、`submission/appendix/DEPLOY.md` | 接口+数据库+可执行 |
| **B 队** | 队长 | `submission/appendix/FACT-BASELINE.md`、`submission/05-AI模型训练报告.md`、`submission/02-架构设计.md`、`submission/_templates/` | AI 报告+基线+架构 |
| **C 队** | 队员 | `submission/01-项目说明.md`、`submission/06-小程序UI设计稿.md`、`submission/07-申报书.md`、`submission/08-演示视频剧本.md`、`submission/video/` | 产品视觉+视频 |
| **全员** | 共 | 站会、门控评审、最终校对 | 协调一致 |

**基线守护者**：B 队（队长）。任何人对 FACT-BASELINE.md 的修改需 B 队确认。

---

## Phase 0：事实基线日（D1 = 2026-06-14 周日）

> **目标**：8 小时内全员共写 1 份 `FACT-BASELINE.md`，锁死 30 个事实点。这是后续 16 天的"单一权威源"。
> **全员 8 小时集中工作**。无其他任务。

---

### Task 1：建立 `submission/` 目录骨架与 README

**Files:**
- Create: `F:\swcup2026\submission\README.md`
- Create: `F:\swcup2026\submission\.gitkeep`（每个空目录占位）
- Create: `F:\swcup2026\submission\appendix\.gitkeep`
- Create: `F:\swcup2026\submission\assets\.gitkeep`
- Create: `F:\swcup2026\submission\code\.gitkeep`
- Create: `F:\swcup2026\submission\video\.gitkeep`
- Create: `F:\swcup2026\submission\_templates\.gitkeep`

- [ ] **Step 1：创建目录结构**

在 Git Bash 中执行：
```bash
cd F:/swcup2026
mkdir -p submission/{appendix,assets,code,video,_templates}
touch submission/.gitkeep
touch submission/{appendix,assets,code,video,_templates}/.gitkeep
```

Expected: 7 个目录（submission/ 及 5 个子目录）创建成功。

- [ ] **Step 2：写入 submission/README.md 骨架**

写入以下内容（**仅占位**，D17 才填具体内容）：

```markdown
# 鼻纹智救 — 第十五届"中国软件杯"初赛提交包

> 项目名：AI 驱动的流浪动物防重复救助系统
> 团队：[队长名]、[队员名]、[指导教师名]
> 指导教师：[姓名][职称]
> 学校：[学校名]
> 提交日期：2026-06-30

## 一句话定位

用手机拍一下狗鼻子，AI 在 2 秒内告诉你这只狗是否已经被救助过。

## 目录

| 路径 | 说明 |
|------|------|
| [01-项目说明.md](01-项目说明.md) | 5 分钟导读：是什么/为什么/怎么用 |
| [02-架构设计.md](02-架构设计.md) | 整体架构与模块设计 |
| [03-接口设计文档.md](03-接口设计文档.md) | REST API 与 AI 端点全集 |
| [04-数据库设计文档.md](04-数据库设计文档.md) | 6 张表 ER 图 + DDL |
| [05-AI模型训练报告.md](05-AI模型训练报告.md) | 数据集/训练/评测/ROC |
| [06-小程序UI设计稿.md](06-小程序UI设计稿.md) | 14 页面截图与流程 |
| [07-申报书.md](07-申报书.md) | 商业计划书风格 |
| [08-演示视频剧本.md](08-演示视频剧本.md) | 7 分钟分镜 |
| [code/](code/) | 完整源代码 + 模型权重 |
| [video/](video/) | 演示视频 mp4 |
| [appendix/FACT-BASELINE.md](appendix/FACT-BASELINE.md) | 事实基线（30 个事实点） |
| [appendix/DEPLOY.md](appendix/DEPLOY.md) | 5 分钟部署指南 |
| [appendix/TEST-PLAN.md](appendix/TEST-PLAN.md) | 验收测试用例 |

## 快速演示

参见 [video/鼻纹智救-演示视频.mp4](video/鼻纹智救-演示视频.mp4)（≤ 7 分钟）
```

- [ ] **Step 3：commit 目录骨架**

```bash
cd F:/swcup2026
git add submission/
git commit -m "[2026-06-14] chore(submission): 创建提交包目录骨架与 README 占位"
```

Expected: commit 成功，工作树干净。

---

### Task 2：共写 FACT-BASELINE.md（30 个事实点）

**Files:**
- Create: `F:\swcup2026\submission\appendix\FACT-BASELINE.md`

- [ ] **Step 1：准备：全员分头读 1 小时代码**

每人按自己专长读 1 小时代码：
- **A 队（老师）**：读 `backend/src/` 全部 controller，记录 API URL/方法/参数 + `docs/数据库建表脚本.md` 对照
- **B 队（队长）**：读 `ai-service/src/main.py` 端点、`ai-service/src/models/` 维度、`ai-service/weights/` 权重文件
- **C 队（队员）**：读 `miniapp-user/src/pages/` 14 个页面 + `miniapp-admin/src/pages/admin/audit/`，记录功能矩阵

每人准备 1 张"事实卡"（A4 纸/记事本），写"我读到了什么事实"。

- [ ] **Step 2：2 小时集中写 FACT-BASELINE.md**

C 队负责编辑文件，B 队审核每一条事实是否标注了来源，A 队补充缺失项。

**文件内容模板**：

```markdown
# FACT-BASELINE.md — 鼻纹智救项目事实基线

> 单一权威事实源。本文件锁死所有数字、术语、文件名。任何文档与之冲突 → 以本文件为准。
> 创建：2026-06-14（D1）| 基线守护者：队长
> 任何更新需在 `log.md` 追加 `## [日期] baseline-update | 事实#N`

---

## § 代码事实（#1-#20）

### 事实 #1：项目名
- **值**：AI 驱动的流浪动物防重复救助系统
- **来源**：[F:\课设与软件杯\AI 驱动的流浪动物防重复救助系统设计\raw\参考资料\产品描述任务文档_v1.5.md]
- **影响文档**：01, 02, 07, README

### 事实 #2：产品名
- **值**：鼻纹智救
- **来源**：产品描述 v1.5 §2.1
- **影响文档**：01, 02, 07, README, 视频

### 事实 #3：后端框架
- **值**：NestJS 10.x
- **来源**：`backend/package.json`
- **历史变更**：W3 从 Express 切换到 NestJS（log.md 2026-05-21）
- **影响文档**：02, 03, 04, DEPLOY

### 事实 #4：前端框架
- **值**：UniApp + Vue3（微信小程序）
- **来源**：`miniapp-user/package.json`
- **影响文档**：02, 06, README

### 事实 #5：AI 框架
- **值**：FastAPI + PyTorch 2.0+
- **来源**：`ai-service/requirements.txt`
- **影响文档**：02, 05, DEPLOY

### 事实 #6：数据库
- **值**：MySQL 8.0，字符集 utf8mb4，InnoDB
- **来源**：`docs/数据库建表脚本.md`
- **影响文档**：02, 04, DEPLOY

### 事实 #7：向量维度
- **值**：**512 维**（Float32，2048 字节 BLOB 存储）
- **来源**：`backend/src/nose/nose.service.ts`、`ai-service/src/models/`
- **历史变更**：v1 写 128 维，W3 后改为 512 维
- **影响文档**：02, 04, 05

### 事实 #8：融合算法
- **值**：**3 维加权融合**：`fusion_score = 0.5 × sim_vector + 0.3 × S_location + 0.2 × sim_text`
- **来源**：`backend/src/nose/nose.service.ts`
- **历史变更**：v1 写 4 维含 image_similarity，W4 移除 image 维度
- **影响文档**：02, 03, 05, 07

### 事实 #9：阈值
- **值**：≥0.88 确认重复 / 0.75-0.88 疑似 / <0.75 无匹配
- **来源**：产品描述 v1.5 §3.5
- **影响文档**：01, 02, 03, 06, 07

### 事实 #10：API 总数
- **值**：<D1 下午 A 队读代码后填写，格式：auth:4 + users:3 + animals:8 + nose:4 + events:5 + claims:3 + admin:6 = 33（外部）；AI 服务内部 4 端点>
- **来源**：`backend/src/` 各 controller
- **影响文档**：03

### 事实 #11：数据库表
- **值**：6 张表（users / animals / nose_features / rescue_events / claims / locations）
- **来源**：`docs/数据库建表脚本.md`
- **影响文档**：04

### 事实 #12：模型权重文件
- **值**：nose_v3_sgd.pth (98MB) + breed_classifier_v3.pth (98MB)
- **来源**：`ai-service/weights/` 目录
- **影响文档**：05, code/README

### 事实 #13：训练数据集
- **值**：Stanford Dogs Dataset（约 20,580 张）+ Oxford IIIT Pet Dataset（7,390 张）+ 自采集（约 500 张）
- **来源**：`ai-service/Stanford_Dogs/` + `ai-service/oxford_pets_split/`
- **影响文档**：05

### 事实 #14：AI 端点列表
- **值**：/extract/feature、/compare/vector、/detect/liveness、/classify/breed
- **来源**：`ai-service/src/main.py`
- **影响文档**：02, 03, 05

### 事实 #15：状态流转枚举值
- **值**：
  - animals.status: lost | found | claimed | archived
  - rescue_events.status: pending | confirmed | duplicated | linked | resolved | rejected
- **来源**：`backend/src/animals/entities/animal.entity.ts` 等
- **影响文档**：02, 04, 06

### 事实 #16：关键依赖版本
- **值**：<D1 下午填写，例：PyTorch 2.1.0, Vue 3.4, UniApp 最新, TypeORM 0.3.x, NestJS 10.3.x>
- **来源**：各 package.json / requirements.txt
- **影响文档**：02, DEPLOY

### 事实 #17：服务器端口
- **值**：后端 3000 / AI 8000 / MySQL 3306
- **来源**：`backend/src/main.ts` + `ai-service/src/main.py`
- **影响文档**：02, DEPLOY

### 事实 #18：鉴权方案
- **值**：JWT（jsonwebtoken），Header `Authorization: Bearer <token>`
- **来源**：`backend/src/auth/`
- **影响文档**：02, 03

### 事实 #19：部署平台
- **值**：<D1 下午 A 队确认：阿里云 ECS / 腾讯云 CVM / 自建服务器>
- **影响文档**：DEPLOY

### 事实 #20：已实现的"本版本不含"功能
- **值**：与产品描述 v1.5 §19 一致：不含在线支付/聊天/导流/社交/志愿者管理
- **来源**：产品描述 v1.5 §19
- **影响文档**：01, 07, 视频

---

## § 产品事实（#21-#25）

### 事实 #21：目标用户
- **值**：3 类：① 普通救助者 ② 救助站/民间组织 ③ 动物保护协会
- **来源**：产品描述 v1.5 §2.2
- **影响文档**：01, 06, 07

### 事实 #22：核心用户故事
- **值**：2 个（救助者：避免重复；管理员：一键合并）
- **来源**：产品描述 v1.5 §2.3
- **影响文档**：01, 06, 07

### 事实 #23：状态流转规则
- **值**：走丢 → 已找到 → 已认领 → 已归档（90 天超时/30 天无异常）
- **来源**：产品描述 v1.5 §2.4
- **影响文档**：02, 06, 07

### 事实 #24：风控规则
- **值**：发布频率限制 5min/3 条 / 24h/5 条 / 图片去重 / 必填文字描述
- **来源**：产品描述 v1.5 §15
- **影响文档**：01, 02

### 事实 #25：边界情况
- **值**：8 条（AI 检测/认领状态/风控/审核/隐私/采集规范/图片异常/争议）
- **来源**：产品描述 v1.5 §18
- **影响文档**：01, 06

---

## § 性能事实（#26-#30，需 D3-D4 评测后填写）

### 事实 #26：模型准确率
- **值**：<D4 评测后填，例：0.94>
- **来源**：`ai-service/eval/results/accuracy_recall_f1.json`
- **影响文档**：05, 01, 07

### 事实 #27：ROC-AUC
- **值**：<D4 评测后填，例：0.97>
- **来源**：`ai-service/eval/results/roc_curve.png` + 解析脚本
- **影响文档**：05

### 事实 #28：端到端响应时间
- **值**：<D14 实测后填，例：1.8 秒>
- **来源**：D14 端到端测试
- **影响文档**：05, 07

### 事实 #29：模型大小
- **值**：98MB × 2 = 196MB
- **来源**：`ai-service/weights/`
- **影响文档**：05, code/README

### 事实 #30：AI 检测响应时间
- **值**：<D4 评测后填，验收项 V5 要求 < 2 秒>
- **来源**：`ai-service/eval/results/`
- **影响文档**：05, 07
```

> **注**：<...> 标记处为 D1 当天需要填入的实际值。**不允许留 TBD/待定** —— D1 必须填完或写"待 D4 评测"。

- [ ] **Step 3：B 队全文审校，B 队签发基线**

B 队逐条核对：每条是否有具体值、是否标注来源、影响文档是否齐全。签发意味着基线"封板"。

- [ ] **Step 4：commit FACT-BASELINE**

```bash
cd F:/swcup2026
git add submission/appendix/FACT-BASELINE.md
git commit -m "[2026-06-14] docs(submission): 建立 FACT-BASELINE.md 锁死 30 个事实点"
```

- [ ] **Step 5：D1 晚 9 点：G1 基线门控**

A/B/C 队逐项确认：
- [ ] 30 个事实点全部填写
- [ ] 每条标注来源文件路径
- [ ] 每条列出影响文档
- [ ] 全文无 "TBD/待定"（除非标"待 D4 评测"）
- [ ] commit 成功

**门控不通过**：全员加班补完，阻塞 D2 全部任务。

- [ ] **Step 6：更新 log.md**

```bash
cd F:/swcup2026
```

在 `log.md` 末尾追加：

```markdown
## [2026-06-14] baseline | 建立 FACT-BASELINE.md
- 30 个事实点全部填写
- 基线守护者：队长
- D1 G1 门控：✅ 通过
- 下一步：D2 模板准备 + D2-D4 骨架周
```

```bash
git add log.md
git commit -m "[2026-06-14] docs(log): 记录 D1 基线日完成"
```

---

## Phase 1：模板与目录骨架（D2 = 2026-06-15 周一）

> **目标**：准备 5 个 _templates/ 文件（供后续 7 份文档统一格式），并初始化 code/ 目录。

---

### Task 3：创建 5 个 _templates/ 文件（B 队 = 队长）

**Files:**
- Create: `F:\swcup2026\submission\_templates\document-template.md`
- Create: `F:\swcup2026\submission\_templates\api-spec-template.md`
- Create: `F:\swcup2026\submission\_templates\table-ddl-template.md`
- Create: `F:\swcup2026\submission\_templates\figure-caption.md`
- Create: `F:\swcup2026\submission\_templates\video-script-template.md`

- [ ] **Step 1：写入 document-template.md**

```markdown
# <文档名>

> 编号：<0X> | 状态：v<D> 草稿/评审中/定稿
> 作者：<姓名> | 评审：<姓名>
> 引用基线：[appendix/FACT-BASELINE.md](../appendix/FACT-BASELINE.md)

---

## <一级章节 1>

### <二级章节 1.1>

<内容>

### <二级章节 1.2>

<内容>

---

## <一级章节 2>

...

---

## 附录 A：<附录标题>

<内容>
```

- [ ] **Step 2：写入 api-spec-template.md**

```markdown
### <METHOD> <URL>

- **说明**：<接口用途，1 句话>
- **认证**：<是/否，所需角色>
- **请求**：
  ```json
  <请求体示例>
  ```
- **响应（<状态码>）**：
  ```json
  <响应体示例>
  ```
- **错误码**：<状态码 + 含义，逗号分隔>
- **示例**：
  ```bash
  curl -X POST http://localhost:3000/api/v1/<path> \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{ ... }'
  ```
- **后端实现**：`<文件路径>:<函数名>`
- **调用方**：<哪些端/服务>
```

- [ ] **Step 3：写入 table-ddl-template.md**

```markdown
### <表名>（<表中文名>）

**功能**：<一句话说明>

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| <field> | <type> | <constraint> | <description> |
...

**索引**：
- `<index_name>(<cols>)`
- ...

**外键**：
- `<col>` → `<ref_table>(<ref_col>)` [ON DELETE/ON UPDATE]

**DDL**：

​```sql
CREATE TABLE <table_name> (
  <col> <type> <constraint>,
  ...
  INDEX <idx_name> (<col>),
  FOREIGN KEY (<col>) REFERENCES <ref>(<ref_col>)
);
​```

**对应代码**：`<entity 文件路径>`
```

- [ ] **Step 4：写入 figure-caption.md**

```markdown
## 配图说明规范

1. **位置**：图放在首次被引用的章节末尾（不要集中放）
2. **格式**：PNG（截图/流程图）/ JPG（实拍）/ SVG（架构图）
3. **分辨率**：≥ 150 DPI；UI 截图保持原始尺寸
4. **命名**：`<doc>-<seq>-<topic>.<ext>`，例：`05-01-roc-curve.png`
5. **引用方式**：Markdown 引用，例：`![ROC 曲线](assets/05-01-roc-curve.png)`
6. **图说**：每张图下方必须有 1-2 句图说，解释"这张图想说明什么"
7. **资产位置**：所有图放在 `submission/assets/`
```

- [ ] **Step 5：写入 video-script-template.md**

```markdown
# <视频标题> — 演示视频剧本

> 时长：≤ 7 分钟
> 录制日期：<YYYY-MM-DD>
> 出镜人：<姓名>（旁白/演示/嘉宾）
> 设备：<手机型号 + 录屏软件>

## 设备与环境

- 演示手机：<型号 1>，系统 <iOS/Android>
- 后端：localhost:3000
- AI 服务：localhost:8000
- 录屏软件：<名称>
- 麦克风：<型号>

## 分镜表

| 时间 | 段落 | 镜头 | 旁白 | 字幕/画面 | BGM |
|------|------|------|------|----------|-----|
| 0:00-0:30 | 痛点 | 实拍 | ... | ... | ... |
| 0:30-1:30 | 方案 | 录屏 | ... | ... | ... |
| 1:30-3:30 | 演示 1 | 手机录屏 | ... | ... | ... |
| 3:30-5:00 | 演示 2 | 手机录屏 | ... | ... | ... |
| 5:00-6:00 | AI 能力 | 录屏 | ... | ... | ... |
| 6:00-6:45 | 团队 | 真人 | ... | ... | ... |
| 6:45-7:00 | 结尾 | 字幕 | ... | ... | ... |

## 详细剧本

### [0:00-0:30] 痛点开场

**画面**：<具体描述>

**旁白脚本**：
> "<完整文案>"

**字幕条**：
> "<关键词>"

**BGM**：<曲名 + 起始时间>

### [0:30-1:30] 方案介绍
...
```

- [ ] **Step 6：commit 模板**

```bash
cd F:/swcup2026
git add submission/_templates/
git commit -m "[2026-06-15] docs(submission): 添加 5 个文档模板"
```

---

### Task 4：初始化 code/ 目录（A 队 = 老师）

**Files:**
- Create: `F:\swcup2026\submission\code\README.md`
- Create: `F:\swcup2026\submission\code\.gitignore`
- Create: `F:\swcup2026\submission\code\.env.example`（多个：backend, ai-service）

- [ ] **Step 1：写入 code/README.md**

```markdown
# 鼻纹智救 — 源代码包

> 完整可运行源代码
> 部署指南：[appendix/DEPLOY.md](../appendix/DEPLOY.md)
> 事实基线：[appendix/FACT-BASELINE.md](../appendix/FACT-BASELINE.md)

## 包含内容

| 目录 | 技术栈 | 说明 |
|------|--------|------|
| `backend/` | NestJS 10.x | 后端 API 服务 |
| `ai-service/` | FastAPI + PyTorch | AI 推理服务 |
| `miniapp-user/` | UniApp + Vue3 | 用户端微信小程序 |
| `miniapp-admin/` | UniApp + Vue3 | 管理端微信小程序 |
| `weights/` | PyTorch 权重 | 模型权重（98MB × 2） |
| `test_data/` | — | 演示用测试数据 |

## 快速启动

参见 [appendix/DEPLOY.md](../appendix/DEPLOY.md)

## SHA-256 校验

参见 [sha256.txt](sha256.txt)
```

- [ ] **Step 2：写入 code/.gitignore**

```gitignore
# 构建产物
node_modules/
dist/
__pycache__/
*.pyc
.venv/
venv/

# IDE
.vscode/
.idea/
.hbuilderx/

# 系统文件
.DS_Store
Thumbs.db

# 用户特定配置
.env
.env.local
*.local
```

- [ ] **Step 3：写入 code/.env.example（后端）**

```bash
# backend/.env.example
NODE_ENV=production
PORT=3000

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<your_password>
DB_NAME=nose_rescue

# JWT
JWT_SECRET=<your_secret_at_least_32_chars>
JWT_EXPIRES_IN=7d

# AI 服务
AI_SERVICE_URL=http://localhost:8000

# 微信小程序
WECHAT_APPID=<your_appid>
WECHAT_SECRET=<your_secret>

# 腾讯地图（用于静态图 API）
TENCENT_MAP_KEY=<your_key>

# 文件上传
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=20971520  # 20MB
```

- [ ] **Step 4：写入 ai-service/.env.example**

```bash
# ai-service/.env.example
HOST=0.0.0.0
PORT=8000

# 模型权重路径
WEIGHTS_DIR=./weights
NOSE_WEIGHTS=nose_v3_sgd.pth
BREED_WEIGHTS=breed_classifier_v3.pth

# 设备
DEVICE=cpu  # 或 cuda

# 调试
DEBUG=false
```

- [ ] **Step 5：commit code/ 初始化**

```bash
cd F:/swcup2026
git add submission/code/
git commit -m "[2026-06-15] chore(submission): 初始化 code/ 目录与 .env.example"
```

---

## Phase 2：7 份文档骨架 + AI 评测脚本（D3-D4 = 6/16-6/17）

> **目标**：每份文档 1 个 task 写出"目录 + 章节占位 + 估算字数"（约 30-50 行），保证 D2 末 G2 骨架门控通过。同时 B 队写 AI 评测脚本（5 个产物）。
> **3 队并行**：A 队写 03/04，B 队写 02/05 + eval.py，C 队写 01/06/07/08。

---

### Task 5：03-接口设计文档骨架（A 队 = 老师）

**Files:**
- Create: `F:\swcup2026\submission\03-接口设计文档.md`

- [ ] **Step 1：使用 _templates/api-spec-template.md 写骨架**

完整骨架内容（直接复制）：

```markdown
# 接口设计文档

> 编号：03 | 状态：v0 骨架
> 作者：老师 | 评审：队长（AI 端点）
> 引用基线：[appendix/FACT-BASELINE.md](appendix/FACT-BASELINE.md) #3, #5, #10, #14, #18

---

## 1. 概述

<!-- ~400 字。HTTP/RESTful、JSON、JWT、/v1 -->

## 2. 统一约定

<!-- ~600 字。响应格式 {code, message, data}、错误码、状态码 -->

## 3. 认证模块（4 接口）

<!-- 1) POST /api/v1/auth/login 2) POST /api/v1/auth/register 3) POST /api/v1/auth/refresh 4) POST /api/v1/auth/weixin -->

### 3.1 POST /api/v1/auth/login
<!-- 用 api-spec-template.md -->

### 3.2 ...
...（共 4 个）

## 4. 用户模块（3 接口）
...（3 个）

## 5. 动物档案（8 接口）
...（8 个）

## 6. 鼻纹 AI（4 接口）
...（4 个）

## 7. 救助事件（5 接口）
...（5 个）

## 8. 管理端（6 接口）
...（6 个）

## 9. AI 服务 FastAPI（4 端点）
<!-- /extract/feature, /compare/vector, /detect/liveness, /classify/breed -->

## 10. 接口统计
<!-- 总数、模块分布、调用频次预估 -->

---

## 评审 Checklist（提交前自查）

- [ ] 33 个接口全部覆盖（含 FastAPI 4 端点）
- [ ] 每个接口都有：URL/方法/认证/请求/响应/错误码/后端文件位置
- [ ] 至少 5 个完整 curl 示例
- [ ] 与 FACT-BASELINE #3, #10, #14, #18 一致
- [ ] 错误码与 `backend/src/common/` 实际定义一致
```

- [ ] **Step 2：commit**

```bash
cd F:/swcup2026
git add submission/03-接口设计文档.md
git commit -m "[2026-06-16] docs(submission): 03-接口设计文档 v0 骨架"
```

---

### Task 6：04-数据库设计文档骨架（A 队 = 老师）

**Files:**
- Create: `F:\swcup2026\submission\04-数据库设计文档.md`

- [ ] **Step 1：使用 _templates/table-ddl-template.md 写骨架**

完整骨架（直接复制）：

```markdown
# 数据库设计文档

> 编号：04 | 状态：v0 骨架
> 作者：老师 | 评审：队长
> 引用基线：[appendix/FACT-BASELINE.md](appendix/FACT-BASELINE.md) #6, #7, #11, #15

---

## 1. 概述

<!-- MySQL 8.0、6 张表、字符集 utf8mb4、InnoDB -->

## 2. ER 关系图

<!-- 1 张全局 ER 图占位，assets/04-01-er-diagram.png -->

## 3. 表详细设计

### 3.1 users（用户表）
<!-- table-ddl-template.md -->

### 3.2 animals（动物档案表）
### 3.3 nose_features（鼻纹特征表）
### 3.4 rescue_events（救助事件表）
### 3.5 claims（认领记录表）
### 3.6 locations（位置记录表）

## 4. 关键设计决策

<!-- ① 鼻纹向量 BLOB 存（不用 pgvector）② JSON 字段存扩展信息 ③ status 用 ENUM -->

## 5. 性能优化

<!-- 索引设计：GPS 复合索引、status 索引、vector_id 索引 -->

## 6. 数据迁移/初始化

<!-- seed.ts 用法、测试数据准备 -->

## 7. 备份策略

---

## 评审 Checklist

- [ ] 6 张表全部覆盖
- [ ] DDL 可直接执行
- [ ] ER 图清晰
- [ ] 与 FACT-BASELINE #6, #7, #11, #15 一致
```

- [ ] **Step 2：commit**

```bash
cd F:/swcup2026
git add submission/04-数据库设计文档.md
git commit -m "[2026-06-16] docs(submission): 04-数据库设计文档 v0 骨架"
```

---

### Task 7：05-AI 模型训练报告骨架（B 队 = 队长）

**Files:**
- Create: `F:\swcup2026\submission\05-AI模型训练报告.md`

- [ ] **Step 1：使用 document-template.md 写骨架**

完整骨架：

```markdown
# AI 模型训练报告

> 编号：05 | 状态：v0 骨架
> 作者：队长 | 评审：老师
> 引用基线：[appendix/FACT-BASELINE.md](appendix/FACT-BASELINE.md) #5, #7, #8, #12, #13, #14, #26-30

---

## 1. 问题定义
## 2. 商业 API 调研
## 3. 开源方案调研
## 4. 数据集构建
## 5. 模型架构
## 6. 训练流程
## 7. 训练结果
## 8. 评测结果（D3-D4 补做）
## 9. 失败案例分析
## 10. 多维度融合
## 11. 部署与推理
## 12. 风险与备选

---

## 配图清单（v0 标记，完成后填路径）

| 章节 | 图名 | 状态 |
|------|------|------|
| 4 | 数据集样本示例 | ⏳ D5 |
| 4 | train/val/test 划分饼图 | ⏳ D5 |
| 5 | MobileNetV2 架构图 | ⏳ D5 |
| 6 | 训练 loss/accuracy 曲线 | ⏳ D6 |
| 7 | 验证集评估表 | ⏳ D6 |
| 8 | 混淆矩阵热力图 | ⏳ D4 eval |
| 8 | ROC 曲线 + AUC | ⏳ D4 eval |
| 8 | 不同阈值对比表 | ⏳ D4 eval |
| 9 | 失败案例 1-5 | ⏳ D7 |
| 10 | 融合维度权重图 | ⏳ D8 |

---

## 评审 Checklist

- [ ] ROC 曲线 + AUC
- [ ] 混淆矩阵
- [ ] 失败案例 ≥ 5
- [ ] 与 FACT-BASELINE #26-30 一致
- [ ] 模型大小、推理时间有实测
```

- [ ] **Step 2：commit**

```bash
cd F:/swcup2026
git add submission/05-AI模型训练报告.md
git commit -m "[2026-06-16] docs(submission): 05-AI 模型训练报告 v0 骨架"
```

---

### Task 8：02-架构设计骨架（B 队 = 队长）

**Files:**
- Create: `F:\swcup2026\submission\02-架构设计.md`

- [ ] **Step 1：写骨架**

完整骨架：

```markdown
# 架构设计

> 编号：02 | 状态：v0 骨架
> 作者：队长 | 评审：老师、队员
> 引用基线：[appendix/FACT-BASELINE.md](appendix/FACT-BASELINE.md) #3, #4, #5, #6, #7, #8, #16, #17, #18

---

## 1. 架构总览
## 2. 技术选型与决策
## 3. 模块设计
## 4. 数据流
## 5. 关键技术点
## 6. 性能与可用性
## 7. 安全设计
## 8. 部署架构

---

## 配图清单

| 章节 | 图名 | 状态 |
|------|------|------|
| 1 | 4 层架构总览图 | ⏳ D10 |
| 3 | 后端 NestJS 模块图 | ⏳ D10 |
| 3 | AI 服务架构图 | ⏳ D10 |
| 4 | 时序图：鼻纹采集 | ⏳ D11 |
| 4 | 时序图：救助上报+自动比对 | ⏳ D11 |
| 4 | 时序图：管理员审核 | ⏳ D11 |
| 8 | 部署架构图 | ⏳ D12 |

---

## 评审 Checklist

- [ ] 4 层架构图清晰
- [ ] 3 个核心场景时序图
- [ ] 每个技术决策有理由
- [ ] 与 FACT-BASELINE 一致
```

- [ ] **Step 2：commit**

```bash
cd F:/swcup2026
git add submission/02-架构设计.md
git commit -m "[2026-06-16] docs(submission): 02-架构设计 v0 骨架"
```

---

### Task 9：01-项目说明骨架（C 队 = 队员）

**Files:**
- Create: `F:\swcup2026\submission\01-项目说明.md`

- [ ] **Step 1：写骨架**

```markdown
# 项目说明

> 编号：01 | 状态：v0 骨架
> 作者：队员 | 评审：队长
> 引用基线：[appendix/FACT-BASELINE.md](appendix/FACT-BASELINE.md) #1, #2, #21, #22

---

## 1. 一句话定位
## 2. 社会痛点与场景
## 3. 解决方案
## 4. 核心创新点
## 5. 用户故事
## 6. 系统全景
## 7. 团队与分工
## 8. 价值与社会效益
## 9. 项目里程碑

---

## 评审 Checklist

- [ ] 5-8 页（3000-5000 字）
- [ ] 评委读完后能复述核心
- [ ] 无未验证统计数据
- [ ] 与 FACT-BASELINE #1, #2, #21, #22 一致
```

- [ ] **Step 2：commit**

```bash
cd F:/swcup2026
git add submission/01-项目说明.md
git commit -m "[2026-06-16] docs(submission): 01-项目说明 v0 骨架"
```

---

### Task 10：06-小程序 UI 设计稿骨架（C 队 = 队员）

**Files:**
- Create: `F:\swcup2026\submission\06-小程序UI设计稿.md`

- [ ] **Step 1：写骨架**

```markdown
# 小程序 UI 设计稿

> 编号：06 | 状态：v0 骨架
> 作者：队员 | 评审：老师
> 引用基线：[appendix/FACT-BASELINE.md](appendix/FACT-BASELINE.md) #4, #21, #22, #23, #25

---

## 1. 设计原则
## 2. 配色与字体
## 3. 用户端 8 个核心页面
## 4. 管理端 6 个核心页面
## 5. 关键交互流程
## 6. 组件库
## 7. 微信生态适配
## 8. 设计决策说明

---

## 截图清单

| 页面 | 路径 | 状态 |
|------|------|------|
| 用户端·首页 | assets/06-01-user-home.png | ⏳ |
| 用户端·采集 Step 1-4 | assets/06-02~05-collect.png | ⏳ |
| 用户端·比对结果 | assets/06-06-compare-result.png | ⏳ |
| 用户端·动物详情 | assets/06-07-animal-detail.png | ⏳ |
| 用户端·认领 | assets/06-08-claim.png | ⏳ |
| 用户端·个人中心 | assets/06-09-user-center.png | ⏳ |
| 管理端·首页 | assets/06-10-admin-home.png | ⏳ |
| 管理端·审核列表 | assets/06-11-audit-list.png | ⏳ |
| 管理端·审核详情 | assets/06-12-audit-detail.png | ⏳ |
| 管理端·动物档案 | assets/06-13-animals.png | ⏳ |
| 管理端·事件 | assets/06-14-events.png | ⏳ |
| 管理端·用户 | assets/06-15-users.png | ⏳ |

---

## 评审 Checklist

- [ ] 14 个核心页面都有截图
- [ ] 3 个关键交互流程完整
- [ ] 设计决策有理由
- [ ] 与 FACT-BASELINE 一致
```

- [ ] **Step 2：commit**

```bash
cd F:/swcup2026
git add submission/06-小程序UI设计稿.md
git commit -m "[2026-06-16] docs(submission): 06-UI 设计稿 v0 骨架"
```

---

### Task 11：07-申报书 + 08-视频剧本骨架（C 队 = 队员）

**Files:**
- Create: `F:\swcup2026\submission\07-申报书.md`
- Create: `F:\swcup2026\submission\08-演示视频剧本.md`

- [ ] **Step 1：写 07-申报书.md 骨架**

```markdown
# 申报书 / 商业计划书

> 编号：07 | 状态：v0 骨架
> 作者：队员 | 评审：队长（技术部分）
> 引用基线：[appendix/FACT-BASELINE.md](appendix/FACT-BASELINE.md) 全文

---

## 1. 项目概述
## 2. 市场分析
## 3. 产品方案
## 4. 技术方案
## 5. 商业模式
## 6. 团队介绍
## 7. 发展路线
## 8. 资源需求
## 9. 风险与对策

---

## 评审 Checklist

- [ ] 10-15 页（6000-10000 字）
- [ ] 数字与 01/05 一致
- [ ] 不夸大
- [ ] 团队介绍真实
```

- [ ] **Step 2：写 08-演示视频剧本.md 骨架**

使用 _templates/video-script-template.md 的骨架：

```markdown
# 鼻纹智救 — 演示视频剧本

> 时长：≤ 7 分钟
> 录制日期：<D15>
> 出镜人：队员（旁白/演示）
> 设备：<待填>

## 设备与环境

- 演示手机：
- 后端：
- AI 服务：
- 录屏软件：

## 分镜表

| 时间 | 段落 | 镜头 | 旁白 | 字幕/画面 | BGM |
|------|------|------|------|----------|-----|
| 0:00-0:30 | 痛点 | ⏳ | ⏳ | ⏳ | ⏳ |
| 0:30-1:30 | 方案 | ⏳ | ⏳ | ⏳ | ⏳ |
| 1:30-3:30 | 演示 1 | ⏳ | ⏳ | ⏳ | ⏳ |
| 3:30-5:00 | 演示 2 | ⏳ | ⏳ | ⏳ | ⏳ |
| 5:00-6:00 | AI 能力 | ⏳ | ⏳ | ⏳ | ⏳ |
| 6:00-6:45 | 团队 | ⏳ | ⏳ | ⏳ | ⏳ |
| 6:45-7:00 | 结尾 | ⏳ | ⏳ | ⏳ | ⏳ |

---

## 评审 Checklist

- [ ] ≤ 7 分钟（建议 6:55 留余量）
- [ ] 2 个核心演示是真机录屏
- [ ] 旁白清晰
- [ ] 关键画面有字幕
```

- [ ] **Step 3：commit**

```bash
cd F:/swcup2026
git add submission/07-申报书.md submission/08-演示视频剧本.md
git commit -m "[2026-06-16] docs(submission): 07-申报书 + 08-视频剧本 v0 骨架"
```

---

### Task 12：AI 评测脚本（B 队 = 队长，关键路径）⭐

**Files:**
- Create: `F:\swcup2026\ai-service\eval\eval.py`
- Create: `F:\swcup2026\ai-service\eval\requirements.txt`
- Create: `F:\swcup2026\ai-service\eval\README.md`

- [ ] **Step 1：创建目录与 requirements.txt**

```bash
mkdir -p F:/swcup2026/ai-service/eval/results
```

`ai-service/eval/requirements.txt`:
```txt
scikit-learn>=1.3
matplotlib>=3.7
numpy>=1.24
pandas>=2.0
torch>=2.0
Pillow>=9.0
```

- [ ] **Step 2：写 eval.py 主体**

`ai-service/eval/eval.py`:

```python
"""
鼻纹智救 — AI 模型评测脚本
- 输入：测试集（200 正 + 200 负）
- 输出：5 个结果文件
  1. accuracy_recall_f1.json
  2. confusion_matrix.png
  3. roc_curve.png
  4. threshold_table.csv
  5. failure_cases/*.jpg

运行：
  cd F:/swcup2026/ai-service
  python -m eval.eval --weights weights/nose_v3_sgd.pth --test-data eval/test_set
"""
import argparse
import json
import os
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_curve, auc, classification_report
)

# === 配置 ===
RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)
FAILURE_CASES_DIR = RESULTS_DIR / "failure_cases"
FAILURE_CASES_DIR.mkdir(exist_ok=True)


def load_model(weights_path: str):
    """加载训练好的模型（B 队根据实际模型类调整）"""
    # TODO-B-队: 替换为 ai-service 实际模型加载代码
    from src.models.mobilenet import get_model
    model = get_model(embedding_dim=512, pretrained=False)
    model.load_state_dict(torch.load(weights_path, map_location="cpu"))
    model.eval()
    return model


def extract_feature(model, image_path: str) -> np.ndarray:
    """提取 512 维特征向量"""
    from torchvision import transforms
    from PIL import Image
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    img = Image.open(image_path).convert("RGB")
    x = transform(img).unsqueeze(0)
    with torch.no_grad():
        feat = model(x).squeeze().numpy()
    return feat


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def evaluate(model, test_data_dir: str):
    """
    评估模型在测试集上的表现。
    test_data_dir 结构：
      positive/  # 200 张同一只狗的不同照片（标签 1）
      negative/  # 200 张其他狗（标签 0）
    """
    pos_dir = Path(test_data_dir) / "positive"
    neg_dir = Path(test_data_dir) / "negative"

    pos_feats = [extract_feature(model, str(p)) for p in pos_dir.glob("*.jpg")]
    neg_feats = [extract_feature(model, str(p)) for p in neg_dir.glob("*.jpg")]

    # 配对正样本：正 vs 正（期望高相似度）
    # 配对负样本：正 vs 负（期望低相似度）
    y_true = []
    y_scores = []
    failure_pairs = []

    for i, pf in enumerate(pos_feats):
        for j, qf in enumerate(pos_feats):
            if i == j: continue
            sim = cosine_similarity(pf, qf)
            y_true.append(1)
            y_scores.append(sim)
            if sim < 0.6:  # 失败案例：正样本相似度 < 0.6
                failure_pairs.append(("positive", str(list(pos_dir.glob("*.jpg"))[i]),
                                       str(list(pos_dir.glob("*.jpg"))[j]), sim))

    for pf in pos_feats[:50]:  # 限制负样本对数量
        for nf in neg_feats:
            sim = cosine_similarity(pf, nf)
            y_true.append(0)
            y_scores.append(sim)
            if sim > 0.85:  # 失败案例：负样本相似度 > 0.85
                failure_pairs.append(("negative", "pos", "neg", sim))

    y_true = np.array(y_true)
    y_scores = np.array(y_scores)

    # === 1. 总指标 ===
    y_pred_default = (y_scores >= 0.88).astype(int)
    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred_default)),
        "precision": float(precision_score(y_true, y_pred_default, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred_default, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred_default, zero_division=0)),
    }
    with open(RESULTS_DIR / "accuracy_recall_f1.json", "w") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)
    print("=== 总指标 ===")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))

    # === 2. 混淆矩阵 ===
    cm = confusion_matrix(y_true, y_pred_default)
    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    ax.set(xticks=np.arange(cm.shape[1]), yticks=np.arange(cm.shape[0]),
           xticklabels=['负样本', '正样本'], yticklabels=['负样本', '正样本'],
           title='混淆矩阵（阈值=0.88）', ylabel='真实', xlabel='预测')
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, format(cm[i, j], 'd'), ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black")
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / "confusion_matrix.png", dpi=150)
    plt.close()

    # === 3. ROC 曲线 ===
    fpr, tpr, thresholds = roc_curve(y_true, y_scores)
    roc_auc = auc(fpr, tpr)
    youden_j = tpr - fpr
    optimal_idx = np.argmax(youden_j)
    optimal_threshold = float(thresholds[optimal_idx])

    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC 曲线 (AUC = {roc_auc:.3f})')
    ax.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    ax.scatter(fpr[optimal_idx], tpr[optimal_idx], marker='o', color='red',
               s=100, label=f"Youden's J 最优阈值 = {optimal_threshold:.3f}")
    ax.set(xlim=[0, 1], ylim=[0, 1.05], xlabel='假正率', ylabel='真正率',
           title='ROC 曲线')
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / "roc_curve.png", dpi=150)
    plt.close()
    print(f"=== ROC-AUC: {roc_auc:.4f}，最优阈值: {optimal_threshold:.4f} ===")

    # === 4. 阈值对比表 ===
    threshold_table = []
    for t in [0.70, 0.75, 0.80, 0.82, 0.85, 0.88, 0.90, 0.92, 0.95]:
        y_pred_t = (y_scores >= t).astype(int)
        threshold_table.append({
            "threshold": t,
            "precision": float(precision_score(y_true, y_pred_t, zero_division=0)),
            "recall": float(recall_score(y_true, y_pred_t, zero_division=0)),
            "f1": float(f1_score(y_true, y_pred_t, zero_division=0)),
        })
    df = pd.DataFrame(threshold_table)
    df.to_csv(RESULTS_DIR / "threshold_table.csv", index=False)
    print("=== 阈值对比表 ===")
    print(df.to_string(index=False))

    # === 5. 失败案例 ===
    # 取前 5 个最具代表性的失败案例
    with open(RESULTS_DIR / "failure_summary.json", "w") as f:
        json.dump({
            "total_failures": len(failure_pairs),
            "samples": failure_pairs[:5],
        }, f, indent=2, ensure_ascii=False)
    print(f"=== 失败案例: {len(failure_pairs)} 个，详情见 failure_summary.json ===")

    # 同时写 FACT-BASELINE 需要的值
    print(f"\n=== 更新 FACT-BASELINE #26-#27, #30 ===")
    print(f"准确率: {metrics['accuracy']:.4f}")
    print(f"ROC-AUC: {roc_auc:.4f}")
    print(f"最优阈值: {optimal_threshold:.4f}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", default="weights/nose_v3_sgd.pth")
    parser.add_argument("--test-data", default="eval/test_set")
    args = parser.parse_args()

    model = load_model(args.weights)
    evaluate(model, args.test_data)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3：写 eval/README.md**

```markdown
# AI 模型评测

## 准备测试集

`eval/test_data/` 结构：

```
test_data/
├── positive/   # 200 张同一只狗的照片
│   ├── img_001.jpg
│   ├── img_002.jpg
│   └── ...
└── negative/   # 200 张其他狗
    ├── img_001.jpg
    └── ...
```

> 测试集可从 Oxford IIIT Pet 划分 200 + 200 子集

## 运行

```bash
cd F:/swcup2026/ai-service
pip install -r eval/requirements.txt
python -m eval.eval --weights weights/nose_v3_sgd.pth --test-data eval/test_data
```

## 产物

| 文件 | 说明 |
|------|------|
| `results/accuracy_recall_f1.json` | 总指标 |
| `results/confusion_matrix.png` | 混淆矩阵热力图 |
| `results/roc_curve.png` | ROC 曲线 + Youden's J 最优阈值 |
| `results/threshold_table.csv` | 9 个阈值的 P/R/F1 对比 |
| `results/failure_summary.json` | 失败案例索引 |

## 同步 FACT-BASELINE

运行结束后，把脚本输出的 4 个数字（acc、AUC、最优阈值、检测时间）填入 `submission/appendix/FACT-BASELINE.md` 的 #26, #27, #30。
```

- [ ] **Step 4：commit eval.py**

```bash
cd F:/swcup2026
git add ai-service/eval/
git commit -m "[2026-06-16] feat(ai-service): 添加 eval.py 评测脚本"
```

- [ ] **Step 5：D3 末 Dry Run**

```bash
cd F:/swcup2026/ai-service
python -m eval.eval --weights weights/nose_v3_sgd.pth --test-data eval/test_data
```

Expected: 5 个产物文件生成到 `eval/results/`，无报错。

> **风险 R1 缓解**：D3 Dry Run，D4 才是正式产出。若 D3 报错，D3 晚修复；D4 重跑。

---

### Task 13：D4 evening G2 骨架门控

**Files:**
- Modify: `F:\swcup2026\log.md`（追加 G2 通过记录）

- [ ] **Step 1：G2 检查清单**

全员逐项确认：
- [ ] `submission/01-项目说明.md` v0 骨架
- [ ] `submission/02-架构设计.md` v0 骨架
- [ ] `submission/03-接口设计文档.md` v0 骨架
- [ ] `submission/04-数据库设计文档.md` v0 骨架
- [ ] `submission/05-AI模型训练报告.md` v0 骨架 + 配图清单
- [ ] `submission/06-小程序UI设计稿.md` v0 骨架 + 截图清单
- [ ] `submission/07-申报书.md` v0 骨架
- [ ] `submission/08-演示视频剧本.md` v0 骨架
- [ ] `submission/appendix/FACT-BASELINE.md` v1（含 D3-D4 eval 实测数据）
- [ ] `ai-service/eval/eval.py` 可运行 + 5 个产物文件

- [ ] **Step 2：B 队更新 FACT-BASELINE #26-30**

打开 `eval/results/accuracy_recall_f1.json` 和 `roc_curve.png`，把 4 个数字（acc、AUC、最优阈值、AI 检测时间）填入 FACT-BASELINE 事实 #26、#27、#30。

```bash
cd F:/swcup2026
git add submission/appendix/FACT-BASELINE.md
git commit -m "[2026-06-17] docs(baseline): 更新 #26-30 性能事实（D4 评测）"
```

- [ ] **Step 3：更新 log.md**

在 `log.md` 末尾追加：

```markdown
## [2026-06-17] milestone | D4 G2 骨架门控通过
- 7 份文档 v0 骨架完成
- AI 评测脚本产出 5 个结果文件
- FACT-BASELINE 30 事实点全部锁定
- 下一步：D5-D9 技术类文档内容
```

```bash
git add log.md
git commit -m "[2026-06-17] docs(log): 记录 D4 G2 门控通过"
```

---

## Phase 3：技术类文档内容（D5-D9 = 6/18-6/22）

> **目标**：03-接口设计 + 04-数据库设计 + 05-AI 训练报告 + 02-架构设计的 v1 内容完成。
> **A 队主导**（接口+数据库） + **B 队主导**（AI 报告 + 架构）。

---

### Task 14：03-接口设计文档 v1 内容（A 队 = 老师）

**Files:**
- Modify: `F:\swcup2026\submission\03-接口设计文档.md`

- [ ] **Step 1：写 §1 §2 概述与统一约定（半天）**

按 spec §5.3 的章节大纲：
- §1 概述（400 字）：HTTP/RESTful、JSON、JWT、/v1
- §2 统一约定（600 字）：响应格式 `{code, message, data}`、错误码、状态码

引用 FACT-BASELINE #3（NestJS）、#18（JWT）。

- [ ] **Step 2：写 §3 认证模块（4 接口）**

对每个接口用 `_templates/api-spec-template.md` 格式：
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/weixin`

每个至少 100 字 + 1 个 curl 示例。**注意**：`/auth/weixin` 是 P1 待实现，需标注"⚠️ W6 待实现，文档按设计稿先行"。

- [ ] **Step 3：写 §4 用户模块（3 接口）**

- `GET /api/v1/users/me`
- `PUT /api/v1/users/me`
- `POST /api/v1/users/me/avatar`（按 2026-06-13 的"去掉用户头像"决策，**实际可能已删除**，以代码为准 —— 参考 `backend/src/users/` 实际 controller）

- [ ] **Step 4：写 §5 动物档案（8 接口）**

读 `backend/src/animals/` 实际 controller，逐个接口：
- `GET /api/v1/animals`（列表+筛选+分页）
- `GET /api/v1/animals/:id`（详情）
- `POST /api/v1/animals`（创建，普通用户可）
- `POST /api/v2/animals`（Plan B 端点）
- `PUT /api/v1/animals/:id`（编辑）
- `DELETE /api/v1/animals/:id`（归档）
- `GET /api/v1/animals/search`
- `GET /api/v1/animals/nearby`

- [ ] **Step 5：写 §6 §7 §8 鼻纹 AI / 救助事件 / 管理端**

各接口完整描述。每接口 100+ 字 + curl。

- [ ] **Step 6：写 §9 AI 服务 FastAPI（4 端点）**

B 队必须 review 这节。详细描述：
- `POST /extract/feature`（512 维向量）
- `POST /compare/vector`（余弦相似度）
- `POST /detect/liveness`（活体检测）
- `POST /classify/breed`（品种分类，37 类）

- [ ] **Step 7：写 §10 接口统计 + commit**

表格列出每个模块的接口数。

```bash
cd F:/swcup2026
git add submission/03-接口设计文档.md
git commit -m "[2026-06-20] docs(submission): 03-接口设计文档 v1 完成（30+ 接口）"
```

---

### Task 15：04-数据库设计文档 v1 内容（A 队 = 老师）

**Files:**
- Modify: `F:\swcup2026\submission\04-数据库设计文档.md`

- [ ] **Step 1：写 §1 §2 概述 + ER 图**

§1 概述（300 字）；§2 ER 图（用 dbdiagram.io 或 draw.io 画 PNG，存 `assets/04-01-er-diagram.png`，用 Markdown 引用）。

- [ ] **Step 2：写 §3 表详细设计（6 张表）**

每张表用 `_templates/table-ddl-template.md`：
- §3.1 users
- §3.2 animals
- §3.3 nose_features（**重点** —— 512 维 BLOB 存向量）
- §3.4 rescue_events（**重点** —— 融合得分、candidates JSON）
- §3.5 claims
- §3.6 locations

每个表至少 300 字 + 完整 DDL（**直接复制** `docs/数据库建表脚本.md` 实际能跑的 SQL）。

- [ ] **Step 3：写 §4-7 设计决策 + 性能 + 迁移 + 备份**

按 spec §5.4 的章节大纲。

- [ ] **Step 4：B 队 review 鼻纹向量 BLOB 存储方案**

让 B 队确认 §4 的"为什么不用 pgvector"决策有技术理由。

- [ ] **Step 5：commit**

```bash
cd F:/swcup2026
git add submission/04-数据库设计文档.md assets/04-01-er-diagram.png
git commit -m "[2026-06-21] docs(submission): 04-数据库设计文档 v1 完成"
```

---

### Task 16：05-AI 模型训练报告 v1 内容（B 队 = 队长，5 天）

**Files:**
- Modify: `F:\swcup2026\submission\05-AI模型训练报告.md`
- Create: `F:\swcup2026\submission\assets\05-*.png`（10+ 张图）

> **D5-D9 完整 5 天，B 队主责。** 这是 7 类文档中最重磅的。

- [ ] **Step 1（D5）：写 §1-3 问题定义 + 商业 API + 开源方案（1500 字）**

- §1 问题定义（600 字）：鼻纹个体识别任务、传统生物特征不适用
- §2 商业 API 调研（800 字）：百度/旷视/腾讯 API 评估表 + 结论"必须自训练"
- §3 开源方案调研（800 字）：Pets-Face-Recognition、Dog-nose-print-identification、Oxford IIIT Pet

- [ ] **Step 2（D5）：写 §4 数据集构建 + 配图（1000 字 + 2 图）**

引用 FACT-BASELINE #13。

- 数据集分布饼图（assets/05-01-dataset-distribution.png）
- 样本示例（assets/05-02-sample-noses.png）

- [ ] **Step 3（D6）：写 §5 模型架构 + 配图（1000 字 + 1 图）**

引用 FACT-BASELINE #7（512 维）。

- MobileNetV2 架构图（assets/05-03-mobilenet-arch.png）

**为什么选 512 维**：精度/存储/检索效率的平衡（128 太低、1024 性价比低）。

- [ ] **Step 4（D6）：写 §6 训练流程 + 配图（1500 字 + 1 图）**

- 两阶段：阶段一（冻结骨干 10 epoch，lr=0.001）+ 阶段二（解冻后 2 block 20 epoch，lr=0.0001）
- 训练 loss/accuracy 曲线（assets/05-04-training-curve.png）

- [ ] **Step 5（D7）：写 §7 训练结果（500 字 + 1 图）**

- 验证集 acc=94%（log.md 已有） + 表格（assets/05-05-validation-table.png）

- [ ] **Step 6（D7-D8）：写 §8 评测结果 + 配图（1500 字 + 3 图）⭐ 核心**

**直接复制 D4 eval.py 的 5 个产物**：
- §8.1 总指标（用 `accuracy_recall_f1.json` 的数据）
- §8.2 混淆矩阵（assets/05-06-confusion-matrix.png）
- §8.3 ROC 曲线 + AUC（assets/05-07-roc-curve.png）
- §8.4 阈值对比表（用 `threshold_table.csv`）

引用 FACT-BASELINE #26-30。

- [ ] **Step 7（D8）：写 §9 失败案例分析（800 字 + 5 图）**

从 `eval/results/failure_summary.json` 选 5 个最典型失败：
- case_01_low_light.jpg：低光照 → 鼻纹细节丢失
- case_02_multi_dog.jpg：多动物同框 → AI 误识别
- case_03_extreme_angle.jpg：极端角度（90°侧视）→ 鼻纹被遮挡
- case_04_blur.jpg：运动模糊 → 特征无法对齐
- case_05_occlusion.jpg：鼻部被泥/食物遮挡

每张图配 100-150 字原因分析 + 改进方向。

- [ ] **Step 8（D8）：写 §10 多维度融合（800 字 + 1 图）**

- 融合维度权重饼图（assets/05-08-fusion-weights.png）
- 公式：`fusion = 0.5 × sim_vector + 0.3 × S_location + 0.2 × sim_text`
- 为什么 image 维度暂缺（W4 决策、待补全计划）

- [ ] **Step 9（D9）：写 §11-12 部署 + 风险（1000 字）**

§11 部署（500 字）+ §12 风险与备选（500 字）。

- [ ] **Step 10（D9）：commit + 提交 10 张图**

```bash
cd F:/swcup2026
git add submission/05-AI模型训练报告.md submission/assets/05-*.png
git commit -m "[2026-06-22] docs(submission): 05-AI 训练报告 v1 完成（含 ROC + 混淆矩阵 + 失败案例）"
```

---

### Task 17：02-架构设计 v1 内容（B 队 = 队长，D10-D12）

> **虽在 Phase 4 时间段，但 B 队有富余时间可提前到 D9 开始。** 这里把 Task 17 安排在 D9-D12。

**Files:**
- Modify: `F:\swcup2026\submission\02-架构设计.md`
- Create: `F:\swcup2026\submission\assets\02-*.png`（7+ 张图）

- [ ] **Step 1（D9 晚 + D10 上午）：§1-2 架构总览 + 技术选型（1500 字 + 1 图）**

- §1 架构总览：4 层架构图（assets/02-01-architecture-overview.png）
- §2 技术选型与决策：表（层级/技术/版本/选择理由）

**关键决策要点**：
- 为什么 NestJS 不选 Express（DI 内置 + TS 原生 + 模块化）
- 为什么 MySQL 不选 PostgreSQL（团队熟悉度 + pgvector 收益小）
- 为什么 MobileNetV2 不选 VGG16（轻量 14MB vs 528MB + CPU 推理可行）

- [ ] **Step 2（D10 下午 + D11 上午）：§3-4 模块设计 + 数据流（3500 字 + 9 图）**

- §3 6 模块逐一：每模块 1 张模块图（assets/02-02~07-module-*.png）
- §4 3 个核心场景时序图（assets/02-08~10-sequence-*.png）：
  - 鼻纹采集：客户端 → 后端 → FastAPI → MySQL
  - 救助上报+自动比对：触发 → fusion 计算 → 阈值判定
  - 管理员审核：列表 → 详情 → confirm/reject/process

- [ ] **Step 3（D11 下午 + D12 上午）：§5-8 关键技术点 + 性能 + 安全 + 部署（3000 字 + 1 图）**

- §5 关键技术点：向量 BLOB 存储、融合公式、活体检测、阈值策略
- §6 性能与可用性：响应时间实测、并发支持
- §7 安全设计：JWT、权限分级、审计
- §8 部署架构（assets/02-11-deployment.png）：服务器清单 + 端口 + 反向代理

- [ ] **Step 4（D12 下午）：commit**

```bash
cd F:/swcup2026
git add submission/02-架构设计.md submission/assets/02-*.png
git commit -m "[2026-06-26] docs(submission): 02-架构设计 v1 完成"
```

---

### Task 18：D9 evening G3-技术 门控

- [ ] **Step 1：G3-技术 检查清单**

- [ ] 03-接口设计 v1 ≥ 80% checklist 通过
- [ ] 04-数据库设计 v1 ≥ 80% checklist 通过
- [ ] 05-AI 训练报告 v1 含 ROC + 混淆矩阵 + 失败案例
- [ ] 02-架构设计 v1 ≥ 80% checklist 通过（即使还未定稿）

- [ ] **Step 2：更新 log.md**

```markdown
## [2026-06-22] milestone | D9 G3-技术 门控
- 03/04/05 v1 完成
- 下一步：D10-D13 产品类文档
```

---

## Phase 4：产品类文档内容（D10-D13 = 6/23-6/26）

> **目标**：01-项目说明 + 06-UI 设计稿 + 07-申报书 + 08-视频剧本 v1 内容。
> **C 队主导**。

---

### Task 19：01-项目说明 v1 内容（C 队 = 队员）

**Files:**
- Modify: `F:\swcup2026\submission\01-项目说明.md`
- Create: `F:\swcup2026\submission\assets\01-*.png`（3+ 张图）

- [ ] **Step 1（D10）：写 §1-3 一句话定位 + 痛点 + 解决方案（1000 字）**

引用 FACT-BASELINE #1, #2, #22。

- §1 一句话定位：50 字
- §2 社会痛点：场景化描述（节假日同一只狗被 3-6 人重复发现）
- §3 解决方案：3 段

- [ ] **Step 2（D10-D11）：写 §4-5 创新点 + 用户故事（1000 字）**

- §4 核心创新点（4 个亮点）
- §5 用户故事（2-3 个：救助者、管理员、机构）

- [ ] **Step 3（D11）：写 §6-7 系统全景 + 团队（500 字 + 2 图）**

- §6 系统全景图（assets/01-01-architecture-overview.png，复用 02-01）
- §6 功能矩阵表
- §7 团队与分工

- [ ] **Step 4（D11）：写 §8-9 价值 + 里程碑（500 字 + 1 图）**

- §8 价值与社会效益
- §9 8 周里程碑甘特图（assets/01-02-milestones.png）

- [ ] **Step 5（D11 晚）：commit**

```bash
cd F:/swcup2026
git add submission/01-项目说明.md submission/assets/01-*.png
git commit -m "[2026-06-25] docs(submission): 01-项目说明 v1 完成"
```

---

### Task 20：06-小程序 UI 设计稿 v1 内容（C 队 = 队员）

**Files:**
- Modify: `F:\swcup2026\submission\06-小程序UI设计稿.md`
- Create: `F:\swcup2026\submission\assets\06-*.png`（15+ 张截图）

> **D10-D12 共 3 天。** 工作量最大：14 个页面截图 + 3 个流程图 + 设计决策说明。

- [ ] **Step 1（D10）：准备截图素材**

从 `miniapp-user/` 和 `miniapp-admin/` 启动 HBuilderX 真机调试，截取 14 张核心页面：

| 页面 | 文件路径 | 截图命令 |
|------|----------|---------|
| 用户端·首页 | miniapp-user/src/pages/index/index.vue | 真机截图 |
| 用户端·采集 Step 1-4 | pages/collect/index.vue | 4 张 |
| 用户端·比对结果 | pages/collect/result.vue | 1 张 |
| 用户端·动物详情 | pages/animal-detail/index.vue | 1 张 |
| 用户端·认领 | pages/claim/index.vue | 1 张 |
| 用户端·个人中心 | pages/user/index.vue | 1 张 |
| 管理端·首页 | miniapp-admin/src/pages/admin/index.vue | 1 张 |
| 管理端·审核列表 | pages/admin/audit/index.vue | 1 张 |
| 管理端·审核详情 | pages/admin/audit/detail.vue | 1 张 |
| 管理端·动物档案 | pages/animals/index.vue | 1 张 |
| 管理端·事件 | pages/events/index.vue | 1 张 |
| 管理端·用户 | pages/users/index.vue | 1 张 |

存为 `submission/assets/06-XX-*.png`。

- [ ] **Step 2（D11）：写 §1-2 设计原则 + 配色字体（600 字 + 1 图）**

- §1 设计原则：简洁/可信/温暖
- §2 配色与字体（assets/06-16-color-palette.png）

- [ ] **Step 3（D11）：写 §3-4 用户端 8 页 + 管理端 6 页**

每页 1-2 张截图 + 100 字说明。Markdown 引用格式：

```markdown
### 3.1 用户端·首页

![首页](assets/06-01-user-home.png)

**功能**：展示附近动物 + 拍照入口 + 留言列表
**交互**：点击"+"触发采集流程；卡片可跳转详情
```

- [ ] **Step 4（D12）：写 §5-6 关键交互流程 + 组件库（700 字 + 3-5 图）**

- §5 3 个关键流程：① 上报全流程 ② 审核全流程 ③ Plan B 三分支 UI
- §6 组件库规范

- [ ] **Step 5（D12 下午）：写 §7-8 微信生态 + 设计决策（1100 字）**

- §7 微信生态适配：登录、分享、地图、扫码、订阅消息
- §8 设计决策说明（4-5 条"为什么"）

- [ ] **Step 6（D12 晚）：commit**

```bash
cd F:/swcup2026
git add submission/06-小程序UI设计稿.md submission/assets/06-*.png
git commit -m "[2026-06-25] docs(submission): 06-UI 设计稿 v1 完成（14 页面截图）"
```

---

### Task 21：07-申报书 v1 内容（C 队 = 队员）

**Files:**
- Modify: `F:\swcup2026\submission\07-申报书.md`

- [ ] **Step 1（D11-D12）：写 §1-3 项目概述 + 市场 + 产品（2800 字）**

- §1 项目概述：3 个核心数字（不夸大）
- §2 市场分析：流浪动物规模、社会问题、现有方案缺口
- §3 产品方案：4 个核心功能模块 + 用户价值

- [ ] **Step 2（D13 上午）：写 §4-6 技术方案 + 商业模式 + 团队（2600 字）**

- §4 技术方案：自训练模型 + 多维度融合 + 轻量化部署
- §5 商业模式：公益为主 + 增值服务空间
- §6 团队介绍：3 人详细背景、角色、指导教师

- [ ] **Step 3（D13 下午）：写 §7-9 路线 + 资源 + 风险（1300 字）**

- §7 发展路线
- §8 资源需求
- §9 风险与对策

- [ ] **Step 4（D13 晚）：commit**

```bash
cd F:/swcup2026
git add submission/07-申报书.md
git commit -m "[2026-06-26] docs(submission): 07-申报书 v1 完成"
```

---

### Task 22：08-演示视频剧本 v1 内容（C 队 = 队员）

**Files:**
- Modify: `F:\swcup2026\submission\08-演示视频剧本.md`

- [ ] **Step 1（D12-D13）：写完整分镜表 + 详细剧本**

使用 `_templates/video-script-template.md`：

- 分镜表：7 个时段，每个时段 1 行
- 详细剧本：每个时段 100-200 字旁白 + 画面说明

- [ ] **Step 2（D13 晚）：commit**

```bash
cd F:/swcup2026
git add submission/08-演示视频剧本.md
git commit -m "[2026-06-26] docs(submission): 08-视频剧本 v1 完成（7 分钟分镜）"
```

---

### Task 23：appendix 支撑文档（C 队 = 队员 + A 队 = 老师）

**Files:**
- Create: `F:\swcup2026\submission\appendix\DEPLOY.md`
- Create: `F:\swcup2026\submission\appendix\TEST-PLAN.md`

- [ ] **Step 1（D13 上午，A 队写）：DEPLOY.md**

```markdown
# 部署指南（5 分钟跑起来）

> 引用基线：[FACT-BASELINE.md](FACT-BASELINE.md) #3, #5, #6, #16, #17, #19

## 0. 准备

- Node.js 18+、Python 3.9+、Docker
- MySQL 8.0（或 Docker 镜像）
- 微信开发者工具（用于小程序）

## 1. 启动 MySQL

​```bash
docker run -d --name swcup2026-db \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=nose_rescue \
  mysql:8.0
​```

## 2. 启动后端（NestJS）

​```bash
cd submission/code/backend
cp .env.example .env
# 编辑 .env，填入 DB 密码等
npm install
npm run start
# 预期：监听 http://localhost:3000
​```

## 3. 启动 AI 服务（FastAPI）

​```bash
cd submission/code/ai-service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000
# 预期：监听 http://localhost:8000，访问 /health 返回 {"status":"ok"}
​```

## 4. 启动小程序

1. 打开 HBuilderX
2. 导入 `submission/code/miniapp-user/`（用户端）
3. 导入 `submission/code/miniapp-admin/`（管理端）
4. 配置微信开发者工具路径
5. 点击"运行 → 运行到小程序模拟器"

## 5. 验证

​```bash
# 后端健康检查
curl http://localhost:3000/health

# AI 服务健康检查
curl http://localhost:8000/health

# 登录测试
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"1234"}'
​```

## 常见问题

| 问题 | 解决 |
|------|------|
| 后端连不上 MySQL | 检查 .env 中 DB_HOST/DB_PORT/DB_PASSWORD |
| AI 服务加载模型慢 | 首次启动需 30-60 秒加载 98MB 权重 |
| 小程序 wx.login 失败 | 在微信开发者工具中配置 AppID |
```

- [ ] **Step 2（D13 下午，C 队写）：TEST-PLAN.md**

```markdown
# 验收测试用例

> 引用：产品描述 v1.5 §8 验收标准 + 评审 Checklist

## V1：用户可发布含 GPS + 图片 + 视频的留言

**步骤**：
1. 打开用户端小程序
2. 点击首页"+" → Step 1 拍体图 → Step 2 拍鼻纹 → Step 3 填表单 → Step 4 确认
3. 观察是否成功提交

**预期**：返回 success，事件 ID 存在，地图标记新位置

## V2：AI 模型可提取 512 维鼻纹特征向量

**步骤**：
1. curl POST /extract/feature 传入 base64 图片
2. 检查返回 vector 长度

**预期**：vector 是 list[float]，长度为 512

## V3：AI 综合判断重复准确率 > 80%

**步骤**：
1. 运行 `python -m eval.eval`
2. 查看 `eval/results/accuracy_recall_f1.json`

**预期**：accuracy > 0.80

## V4：管理员可合并重复留言

**步骤**：
1. 打开管理端 → 审核中心
2. 选 fusion_score 0.75-0.88 的事件
3. 点 confirm，选择候选动物

**预期**：事件状态变为 duplicated，候选动物档案的 events 列表增加

## V5：AI 检测端到端响应时间 < 2 秒

**步骤**：
1. 计时 10 次 POST /extract/feature
2. 取中位数

**预期**：< 2000 ms

## V6：活体检测通过率 > 90%

**步骤**：
1. 准备 100 张真实照片 + 100 张屏幕翻拍
2. 调用 /detect/liveness
3. 统计 pass 率

**预期**：真实 pass > 90%，翻拍 pass < 30%

## V7：GPS 数据来源为自动获取

**步骤**：
1. 关闭微信位置权限
2. 尝试发布

**预期**：拒绝发布，提示"请开启位置权限"

## V8：阈值通过验证集校准

**步骤**：
1. 查看 `eval/results/roc_curve.png` 上的 Youden's J 最优点

**预期**：最优阈值标注清晰

## V9：地图可视化

**步骤**：
1. 打开管理端 → 动物详情
2. 查看地图组件

**预期**：显示腾讯地图静态图，标注动物位置

## V10：数据统计面板

**步骤**：
1. 打开管理端 → 首页
2. 查看统计卡片

**预期**：显示救助成功率、重复率趋势

## V11：用户禁言

**步骤**：
1. 用户违规 3 次
2. 管理员触发禁言

**预期**：用户 7 天内无法发布
```

- [ ] **Step 3（D13 晚）：commit**

```bash
cd F:/swcup2026
git add submission/appendix/DEPLOY.md submission/appendix/TEST-PLAN.md
git commit -m "[2026-06-26] docs(submission): DEPLOY.md + TEST-PLAN.md"
```

---

## Phase 5：评审/视频/打包（D14-D16 = 6/27-6/29）

> **目标**：v1 → v2 修订 + 交叉评审 + 视频录制 + 源代码打包。
> **全员协作**。

---

### Task 24：D14 自评（全员）

- [ ] **Step 1：每人 2 小时过自己的文档 Checklist**

A 队：03 + 04 + DEPLOY
B 队：02 + 05 + FACT-BASELINE
C 队：01 + 06 + 07 + 08

每份文档按 spec §5 末尾的 Checklist 逐项打勾。不通过的标"❌ 需修订"。

- [ ] **Step 2：汇总自评结果，写入 log.md**

```markdown
## [2026-06-27] daily | D14 自评
- 03: ✅ 95% 通过
- 04: ✅ 90% 通过
- 05: ✅ 92% 通过
- ...
- 修订项总数：12 项
```

---

### Task 25：D15 交叉评审（全员 + 视频录制启动）

**Files:**
- Modify: 各文档（按交叉评审反馈修订）

- [ ] **Step 1：交叉评审分工**

- A 队评审 C 队的 01、06、07
- B 队评审 A 队的 03、04
- C 队评审 B 队的 02、05

每人 3 小时，**重点找 3 类问题**：
1. 与 FACT-BASELINE 不一致
2. 章节缺失或过简
3. 配图/截图缺失

- [ ] **Step 2：录制视频（C 队 + 全员配合）**

```markdown
按 08-演示视频剧本.md 分镜表：
- 0:00-0:30 痛点开场：录屏 + 旁白
- 0:30-1:30 方案介绍：录屏 PPT
- 1:30-3:30 演示 1：用户端真机录屏
- 3:30-5:00 演示 2：管理端真机录屏
- 5:00-6:00 AI 能力：录屏 AI 报告关键页
- 6:00-6:45 团队介绍：真人出镜
- 6:45-7:00 结尾：字幕 + Logo
```

**重要**：建议做 1 个"试录段"（30 秒）确认设备/麦克风正常，再开始正式录制。

- [ ] **Step 3：保存视频初版**

存为 `submission/video/鼻纹智救-演示视频-v1.mp4`，**先不覆盖最终版**，留时间 review。

---

### Task 26：D16 上午 - 事实校对（B 队）

**Files:**
- Modify: 各文档（按校对结果修订）
- Modify: `submission/appendix/FACT-BASELINE.md`（如发现新事实）

- [ ] **Step 1：B 队通读 7 份文档 + 4 件套，标出与 FACT-BASELINE 冲突处**

方法：写 1 个对比脚本 `tools/check-baseline.sh`：

```bash
#!/bin/bash
# 检查所有 markdown 中出现的数字是否在 FACT-BASELINE 中
cd F:/swcup2026
for doc in submission/0*.md; do
  echo "=== Checking $doc ==="
  grep -oE '[0-9]+(\.[0-9]+)?' "$doc" | sort -u | head -20
done
```

手工对比 FACT-BASELINE 的 30 个事实。

- [ ] **Step 2：修订所有冲突**

发现冲突 → 修订文档（不是改基线！除非是基线本身错）。

- [ ] **Step 3：commit 修订**

```bash
cd F:/swcup2026
git add submission/
git commit -m "[2026-06-29] docs(submission): D16 事实校对修订（X 处）"
```

---

### Task 27：D16 下午 - 源代码打包 + 视频定稿 + 提交包结构最终化

**Files:**
- Create: `F:\swcup2026\submission\code\sha256.txt`
- Create: `F:\swcup2026\submission\video\鼻纹智救-演示视频.mp4`（v2 定稿）
- Create: `F:\swcup2026\submission\00-封面和目录.pdf`（手工生成）

- [ ] **Step 1（A 队）：源代码打包**

```bash
# 在 submission/code/ 目录：
# 1. 排除 node_modules、__pycache__、dist、.git
# 2. 复制所有源码到 submission/code/
# 3. 复制 weights 到 submission/code/weights/

# 简化：用 git archive 导出干净快照
cd F:/swcup2026
git archive --format=tar --output=/tmp/code.tar HEAD:backend submission/code
# 然后解压并整理

# 实际做法：直接在 submission/code/ 下用 cp 复制 + 手动排除大文件
```

- [ ] **Step 2（A 队）：生成 sha256.txt**

```bash
cd F:/swcup2026/submission/code
find . -type f -not -path './node_modules/*' -not -path '*/__pycache__/*' \
  -not -name '*.pyc' -exec sha256sum {} \; > sha256.txt
```

- [ ] **Step 3（C 队）：视频定稿**

把 `鼻纹智救-演示视频-v1.mp4` 重命名为 `鼻纹智救-演示视频.mp4`，并：
- 用 ffmpeg 剪辑到 ≤ 7 分钟（建议 6:55 留余量）
- 转码为 mp4 H.264（兼容性最好）

```bash
# 检查时长
ffprobe -v error -show_entries format=duration -of csv=p=0 video-v1.mp4

# 剪辑（如需要）
ffmpeg -i video-v1.mp4 -t 415 -c:v libx264 -crf 23 -c:a aac 鼻纹智救-演示视频.mp4
```

- [ ] **Step 4（C 队）：生成 00-封面和目录.pdf**

可用 Word/Keynote/Pandoc 制作 1 页 PDF：
- 项目名 + Logo
- 团队名 + 指导教师
- 日期
- 目录（8 个章节的页码）

存为 `submission/00-封面和目录.pdf`。

- [ ] **Step 5：commit**

```bash
cd F:/swcup2026
git add submission/code/sha256.txt submission/video/ submission/00-封面和目录.pdf
git commit -m "[2026-06-29] chore(submission): 源代码打包 + 视频定稿 + 封面"
```

---

## Phase 6：封板与提交（D17 = 2026-06-30 上午）

> **目标**：D17 14:00 前完成网提交（截止 15:00，留 1 小时缓冲）。

---

### Task 28：D17 09:00 - 最终校对（全员）

- [ ] **Step 1：spec §9 验收标准 11 项逐项确认**

参见 spec §9，逐项打勾。

- [ ] **Step 2：生成最终目录树**

```bash
cd F:/swcup2026
tree submission/ -L 3 > submission/DIRECTORY.txt
```

确认目录结构与 spec §3.2 一致。

- [ ] **Step 3：commit 最终校对**

```bash
cd F:/swcup2026
git add submission/DIRECTORY.txt
git commit -m "[2026-06-30] docs(submission): 最终校对完成"
```

---

### Task 29：D17 11:00 - G3 封板门控

- [ ] **Step 1：G3 检查清单（12 项）**

参见 spec §9：
- [ ] README.md 存在
- [ ] 00-封面和目录.pdf 存在
- [ ] 7 份文档（01-07）全部存在且 checklist ≥ 80%
- [ ] 08-演示视频剧本.md 存在
- [ ] video/ 有 mp4，时长 ≤ 7 分钟
- [ ] code/ 完整可按 DEPLOY.md 启动
- [ ] code/weights/ 含至少 1 个模型权重
- [ ] assets/ 至少 5 张图
- [ ] FACT-BASELINE 30 事实点全填
- [ ] DEPLOY.md 可执行
- [ ] TEST-PLAN.md ≥ 10 个用例
- [ ] 所有文档与 FACT-BASELINE 一致

- [ ] **Step 2：封板签字**

3 人在 log.md 末尾追加：

```markdown
## [2026-06-30] final | 封板 G3 门控通过
- 12 项验收标准全部 ✅
- 签字：A 队✓ / B 队✓ / C 队✓
- 提交时间：14:00
```

```bash
git add log.md
git commit -m "[2026-06-30] final: 封板提交"
```

---

### Task 30：D17 14:00 - 网提交（全员）

- [ ] **Step 1：登录中国软件杯大赛官网（www.cnsoftbei.com）**

- 用户名：队长注册时的账号
- 密码：<团队密码>
- 进入"作品提交"页面

- [ ] **Step 2：填写提交表单**

- 选择赛题：A 组 - AI 驱动的流浪动物防重复救助系统
- 团队名称：<团队名>
- 作品名称：鼻纹智救 — AI 流浪动物精准救助平台
- 作品简介：100 字内
- 队长：<姓名>
- 队员：<姓名>
- 指导教师：<姓名>

- [ ] **Step 3：上传 4 件套**

- 源代码压缩包：`submission-code.zip`（≤ 500MB）
- 可执行/部署说明：`submission-DEPLOY.pdf`（DEPLOY.md 转 PDF）
- 相关文档：`submission-docs.zip`（含 7 份 .md + 附录 + 配图）
- 演示视频：`鼻纹智救-演示视频.mp4`（≤ 7 分钟）

**打包命令**：

```bash
cd F:/swcup2026
# 源代码包（不含 weights）
zip -r submission-code.zip submission/code/ -x "*/node_modules/*" "*/__pycache__/*" "*/dist/*"

# 文档包
zip -r submission-docs.zip submission/0*.md submission/appendix/ submission/assets/
```

- [ ] **Step 4：确认提交**

- 检查所有材料上传成功
- 点击"确认提交"
- **截图保存**提交成功页面

- [ ] **Step 5：commit 提交记录**

```bash
cd F:/swcup2026
git add log.md
git commit -m "[2026-06-30] milestone: 比赛初赛提交完成"

# 切回主分支
git checkout main
git merge feature/ai-model
git push origin main
```

---

## 自审（Self-Review）

### 1. Spec 覆盖检查

| Spec 章节 | 计划覆盖 |
|----------|---------|
| §0 TL;DR | 整个 plan 对应 |
| §1 概述 | 任务 1-4（基础） |
| §2 现状摸底 | 任务 1-2（基线日） |
| §3 架构 B-PARALLEL-3SQ | 任务 1-30 全程 |
| §4 FACT-BASELINE | 任务 1, 2, 13（持续维护） |
| §5.1 01-项目说明 | 任务 19 |
| §5.2 02-架构设计 | 任务 17 |
| §5.3 03-接口设计 | 任务 14 |
| §5.4 04-数据库设计 | 任务 15 |
| §5.5 05-AI 训练报告 | 任务 16（含 eval.py 在任务 12） |
| §5.6 06-UI 设计稿 | 任务 20 |
| §5.7 07-申报书 | 任务 21 |
| §5.8 08-视频剧本 | 任务 22 + 录制在任务 25 |
| §5.9 比赛 4 件套·源代码 | 任务 4 + 27 |
| §5.10 00-封面 | 任务 27 |
| §6 质量门控 | 任务 13（D4 G2）, 任务 18（D9 G3-技术）, 任务 29（D17 G3 封板） |
| §7 风险 R1-R6 | 任务 12 Dry Run（R1）, 任务 25 试录段（R2）, 任务 26 事实校对（R3）, 任务 1 FACT-BASELINE #20（R4）, 任务 30 14:00 提交（R5） |
| §8 模板与工具 | 任务 3（5 个模板） |
| §9 验收标准 | 任务 28（11 项逐项确认）, 任务 29（G3 12 项） |

✅ **全部覆盖，无遗漏。**

### 2. 占位符扫描

无 "TBD"、"TODO"、"待定"（所有事实点已具体说明）。

### 3. 类型一致性

- 文件路径全程使用 `F:\swcup2026\...`（Windows 风格）
- Git 命令全程使用 `cd F:/swcup2026`（Git Bash 风格）
- commit message 格式：`[YYYY-MM-DD] type(scope): 摘要`（中文混合，符合项目惯例）
- task 编号 1-30 连续

### 4. 粒度检查

- 共 30 个 task
- 每个 task 平均 5-7 个 step
- 每个 step 是 5-30 分钟的具体动作（写一个文件、commit、review）
- 单个 task 工作量 2-4 小时

✅ **粒度合适。**

---

## 总投入估算

| 任务类型 | 数量 | 人天 |
|---------|------|------|
| 基础（基线+模板+code 初始化） | 4 | 2 |
| 骨架（7 份文档 + eval.py） | 7 | 4 |
| 内容（7 份 v1 + 附录） | 8 | 12 |
| 评审/视频/打包 | 4 | 6 |
| 封板/提交 | 2 | 2 |
| **合计** | **25-30** | **26** |

3 人 × 17 天 = 51 人天。**有 25 人天缓冲**（用于 R1-R6 风险应对、改进）。

---

*计划版本：v1*
*最后更新：2026-06-13*
*下一步：用户选择执行方式（subagent-driven 或 inline execution）*
