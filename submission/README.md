# 鼻纹智救 — 第十五届"中国软件杯"初赛提交包

> **项目名**：AI 驱动的流浪动物防重复救助系统
> **产品名**：鼻纹智救
> **团队**：[队长]、[队员]、[指导教师]
> **指导教师**：[姓名][职称]
> **学校**：[学校名]
> **截止日期**：2026-07-20 15:00（官方提交通道开通 2026-06-22 15:00）
> **类别**：第十五届"中国软件杯"大学生软件设计大赛 A 组
> **文档版本**：v1.1（2026-06-19，Docker 化 + 评分项映射版）

---

## 一句话定位

用手机拍一下狗鼻子，AI 在 2 秒内告诉你这只狗是否已经被救助过。

---

## 快速启动（评审 5 分钟通路）

> ⚠️ `docker-compose.yml` 在 `submission/code/` 目录，必须先 cd 进去

```bash
cd code/                                    # ← 必须这一步
cp .env.example .env                       # 1. 准备环境变量
# 编辑 .env，至少修改 JWT_SECRET 与 MYSQL_ROOT_PASSWORD

# 2. 准备模型权重（首次，需 ~197 MB）
mkdir -p ai-service/weights
# 将 nose_v3_sgd.pth / breed_classifier_v3.pth / breed_protos_*.pt 放入

# 3. 一键启动
docker compose up -d --build               # 首构 ~90s，后续秒级
docker compose ps                          # 应 3 服务 Up (healthy)

# 4. 验证
curl http://localhost:3000/api-docs-json   # 后端 Swagger
curl http://localhost:8000/health          # AI 服务
```

详细见 [appendix/DEPLOY.md](appendix/DEPLOY.md) 与 [code/README-DOCKER.md](code/README-DOCKER.md)。

---

## 提交清单（官方 4 项）

按官方 `_templates/提交.md` 要求，初赛需上传 4 个压缩包（每项 ≤ 1 GB）：

| # | 项目 | 命名约定 | 本目录对应 | 状态 |
|---|------|---------|-----------|------|
| 1 | 作品安装/可执行文件 | 见官网红框 | `code/docker-compose.yml` + `code/README-DOCKER.md` | ✅ |
| 2 | 作品源码 | 见官网红框 | `code/`（不含训练数据集） | ✅ |
| 3 | PPT / 演示视频 / 文档 | 见官网红框 | `video/` + 本目录全部 md | ✅ |
| 4 | 报名表 / 学生证 | 见官网红框 | 队长线下提交 | ⏳ 待盖章 |

> 如某项因特殊原因无法提交，按官方规则 §6 需上传说明文档，见 [`缺项说明.md`](缺项说明.md)。

---

## 目录索引

| 路径 | 说明 | 评审权重 |
|------|------|---------|
| [01-项目说明.md](01-项目说明.md) | 5-8 页：产品定位 / 痛点 / 解决方案 | ⭐⭐ |
| [02-架构设计.md](02-架构设计.md) | 10-15 页：4 层架构 + 模块 + 时序图 | ⭐⭐⭐ |
| [03-接口设计文档.md](03-接口设计文档.md) | 15-25 页：~40 REST + 4 AI 端点 | ⭐⭐⭐ |
| [04-数据库设计文档.md](04-数据库设计文档.md) | 8-12 页：5 张表 ER + DDL | ⭐⭐ |
| [**05-AI模型训练报告.md**](05-AI模型训练报告.md) | 15-25 页：数据集 / 训练 / ROC / 失败案例 | ⭐⭐⭐⭐ |
| [06-小程序UI设计稿.md](06-小程序UI设计稿.md) | 14+ 页面截图 + 关键流程 | ⭐⭐ |
| [07-申报书.md](07-申报书.md) | 10-15 页：商业计划书风格 | ⭐ |
| [08-演示视频剧本.md](08-演示视频剧本.md) | 7 分钟分镜 | ⭐⭐ |
| [code/](code/) | 完整源代码 + 模型权重 + Dockerfile | ⭐⭐⭐⭐ |
| [video/](video/) | 演示视频 mp4 | ⭐⭐ |
| [appendix/FACT-BASELINE.md](appendix/FACT-BASELINE.md) | **事实基线**（30 个事实点，**单一权威源**） | — |
| [appendix/DEPLOY.md](appendix/DEPLOY.md) | 5 分钟部署指南 | ⭐⭐⭐ |
| [appendix/TEST-PLAN.md](appendix/TEST-PLAN.md) | 验收测试用例（5 类 × 多 TC） | ⭐⭐ |
| [appendix/TEST-REPORT.md](appendix/TEST-REPORT.md) | 单元/API/性能/安全执行报告 | ⭐⭐⭐ |

---

## 赛题评分项映射（A 组 — AI 方向）

参考 A 组（AI / 大模型方向）赛题常见评分维度，本包对应文档如下：

| 评分维度（典型权重） | 占比 | 本包对应内容 |
|---------------------|------|------------|
| **1. 技术创新性** | 30% | 02-架构设计（融合算法 §3.2）<br>05-AI模型训练报告 §3（ArcFace + 多模态融合） |
| **2. 工程完整度** | 25% | 03-接口设计文档（40+ 端点）<br>04-数据库设计文档（5 表 ER + DDL）<br>code/（完整可编译） |
| **3. AI 模型质量** | 20% | 05-AI模型训练报告 §6（评测指标）<br>appendix/TEST-REPORT.md §二（AI 单测） |
| **4. 用户体验** | 15% | 06-小程序UI设计稿（16+12 页）<br>08-演示视频剧本（7 分镜）<br>video/（演示视频） |
| **5. 商业 / 社会价值** | 10% | 07-申报书（市场分析）<br>01-项目说明 §二（行业数据） |

> 上表为常见权重映射，本团队对实际权重判断负责，具体以官方赛题页为准。

---

## 评审优先级（建议评委按序阅读）

1. **05-AI模型训练报告**（A 组核心，30+ 页训练过程 + 评测）
2. **video/鼻纹智救-演示视频.mp4**（≤ 7 分钟，看完即懂产品）
3. **02-架构设计** + **03-接口设计文档**（技术创新 + 工程落地）
4. **appendix/DEPLOY.md**（5 分钟跑通验证）
5. **01-项目说明** + **07-申报书**（背景 + 商业价值）
6. **appendix/TEST-REPORT.md**（测试执行数据）

---

## 引用规范

任何文档中出现的数字、接口名、技术栈名、文件名，都以 [appendix/FACT-BASELINE.md](appendix/FACT-BASELINE.md) 为准。

如发现冲突，请**先更新基线，再改文档**（不要反过来）。

---

## 联系方式

- 项目主页：`F:\swcup2026\submission\`（本地）
- 演示视频：`F:\swcup2026\submission\video\`
- 部署指南：`F:\swcup2026\submission\appendix\DEPLOY.md`