# HANDOFF — 鼻纹智救 下次会话开场白

> **目的**：让任意一次新会话能 30 秒内回到当前进度。
> **使用方式**：在新会话第一句原样发送 §「下次开场白」段。
> **本文件不参与正式提交**，仅供断点续传。

---

## 项目背景

- **项目名**：鼻纹智救（防重复救助的 AI 流浪动物识别系统）
- **赛事**：中国软件杯 A 组（2026-06-30 D-Day）
- **今天**：2026-06-17（距 D-Day 还 13 天）
- **工作目录**：`F:\swcup2026`
- **当前分支**：`feature/ai-model`

## 已完成（截至 2026-06-17）

| # | 项 | 状态 |
|---|----|------|
| ✅ | 后端业务逻辑层单测 172/172 | `backend/src/**` Jest |
| ✅ | AI 服务单测 49/49 | `ai-service/src/tests/**` pytest |
| ✅ | 业务逻辑层覆盖率 ≥ 80% | 后端 89.85~100%，AI 服务 99% |
| ✅ | `submission/code/` 完整源码打包 197MB | 含 backend / ai-service / miniapp-user / miniapp-admin |
| ✅ | 架构/训练图 9 张 PNG | `submission/assets/{architecture,training}/` |
| ✅ | `02-架构设计.md` `05-AI模型训练报告.md` 图引用 | 文字图混排 |
| ✅ | `appendix/TEST-REPORT.md` 全部 § 更新 | AI 服务章节、TODO-1 完成、Checklist 同步 |

## 等待中（下次接力清单）

| 优先级 | 任务 | 阻塞 / 依赖 | 备注 |
|--------|------|-------------|------|
| P0 | 性能压测 P95 实测数据 | 需启动 backend+ai-service 真实压测 | locust 已就绪，环境就绪 |
| P0 | AI 评测 4 个数（待用户带回） | 用户在另一台电脑跑 `evaluate_*.py` | 同犬/异犬相似度、Recall@1、Top-1 |
| P1 | 录制 7 分钟演示视频 | 06-18 起，剧本见 `08-演示视频剧本.md` | 06-27 截屏字幕，06-29 终版 |
| P1 | 补前端 UI 真实截图 | 启动 miniapp-user / miniapp-admin 截图 | 替换 `assets/` 占位图 |
| P2 | E2E 真机回归 10 用例 | 微信开发者工具实跑 | D-Day 前完成 |
| P2 | TEST-REPORT §二/§三/§四/§五 实测回填 | 上述 P0/P1 完成后 | 最终验收用 |
| P3 | 最终验收 Checklist 打勾 | 全部 § 实测后 | 见 `submission/appendix/TEST-PLAN.md §9` |

## 用户偏好（请遵守）

1. **不要 git commit 除非明确指示** —— "Only create commits when requested by the user"
2. **临时脚本用完即删**（如 `pack_code.py` `render_assets.py`）
3. **不要修改"原有代码"含义**，可加 # pragma / 注释 / 文档；不要重写业务逻辑
4. **临时文件加 .gitignore**（如 `submission/code/` `submission/video/` 体积大）
5. **提交消息用中文** + Angular 格式
6. **架构/时序图默认 PNG 嵌入**（matplotlib 优先，避免 cairosvg 等重依赖）
7. **多任务并行**：用 TaskCreate 拆分、独立 IO 用并行工具调用

## 关键决策记录

| 决策 | 原因 |
|------|------|
| 单元测试模型加载用 `# pragma: no cover` | 启动期代码依赖 .pth 权重，集成测试覆盖更合理 |
| AI 评测分两台电脑：训练机跑评测、提交机写报告 | 用户在另一台电脑有 ai-server 环境 |
| 性能压测用 locust 而非 wrk | locust 跨平台、有 Python 脚本化、JSON 输出好解析 |
| `submission/code/` 不入 git（197MB） | git 仓应保持轻量，打包产物一次性交付 |
| 业务逻辑覆盖率目标 ≥ 80%，实际 89.85~100% | 行业基线，留缓冲 |
| Bug6 兜底：孤儿鼻纹表 + animal 回填 | 主链路未达阈值时也能召回 |
| 文本匹配严格相等（防 female⊂male 子串误匹配）| Bug2026-06-13 回归测试覆盖 |

## 环境/账号备忘

| 项 | 值 |
|----|----|
| MySQL 实际端口 | **3306** |
| `backend/.env` 中 `DB_PORT` | **3307**（不一致，运行时需用环境变量覆盖：`DB_PORT=3306 npm start`）|
| MySQL 账号 | `root` / `rootpassword` |
| ai-service 权重 | `weights/breed_classifier_v3.pth` + `weights/nose_v3_sgd.pth` |
| breed 原型缓存 | `weights/breed_protos_*.pt`（按模型+训练集 mtime 哈希）|
| pytest 关键依赖 | `httpx<0.28`（starlette 0.35 兼容要求）|

## 下次开场白（直接复制粘贴到新会话）

```
继续鼻纹智救。先读 F:\swcup2026\submission\HANDOFF.md 了解上次进度，
再读 submission/appendix/TEST-PLAN.md §9 验收 Checklist 确认今天目标。

当前分支 feature/ai-model，今日日期 2026-06-17。
优先做 P0 性能压测实测。
```

## 文件位置速查

| 用途 | 路径 |
|------|------|
| 验收测试用例 | `submission/appendix/TEST-PLAN.md` |
| 单元测试报告 | `submission/appendix/TEST-REPORT.md` |
| 部署指南 | `submission/appendix/DEPLOY.md`（如有）|
| 架构图 | `submission/assets/architecture/4-layer-arch.png` |
| 训练曲线 | `submission/assets/training/{train,val}-*.png` |
| 源码打包 | `submission/code/`（197MB，gitignored）|
| 提交模板 | `submission/_templates/` |
| 后端单测 | `backend/src/**/*.spec.ts` |
| AI 单测 | `ai-service/src/tests/*.py` |
| 训练日志 | `ai-service/weights/log.json`（解析曲线用）|
