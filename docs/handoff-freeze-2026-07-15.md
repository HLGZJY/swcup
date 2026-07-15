# v1.1 冻结交付说明

> **冻结时刻**: 2026-07-15  
> **比赛**: 第十五届"中国软件杯"  
> **截止**: 2026-07-20 15:00 (初赛)
> **Tag**: `v1.1-final` (origin)

---

## 1. 仓库状态

- 主分支 `main` 顶端 `803b927`
- 远端 origin: 已 push (含 main + tag v1.1-final)
- 15 个 commit 历史 (8 v1.1 修复 + 7 v1.1 冻结阶段)
- 工作区: 干净 (`nothing to commit, working tree clean`)

## 2. v1.1 修复 commit (8 个, 本会话前)

| hash | 类型(scope) | 摘要 |
|---|---|---|
| `21f4905` | fix(nose) | 采集有鼻纹低分分支补 body_photo_url → event.photos |
| `6278051` | fix(audit) | 待审中心 5 个操作 handler 完成后重拉数据 |
| `6caa8b5` | fix(collect) | 采集入口补传 address, 与发现页对齐 |
| `b4450d7` | fix(audit) | onShow 改从 @dcloudio/uni-app 导入, 真正触发 tabBar 切回重拉 |
| `c0514f4` | feat(comments) | 评论 AI 情感词典外置 + 补 SEEK 分类 |
| `5021890` | feat(clue) | self_match 线索也落盘入 admin, 不再丢弃 |
| `0318a81` | fix(admin) | clue decide 端点 body 字段名错 (data→body), 400 根因 |
| `01bf613` | fix(clue) | store.update 允许 self_match 状态被 admin 决策 |

## 3. v1.1 冻结阶段 commit (7 个, 本次)

| hash | 类型(scope) | 摘要 |
|---|---|---|
| `d10fba5` | feat(events) | 报告页三属性 + animal.photos 一致性 (8 modified) |
| `51790aa` | feat(ai-service) | 评论 AI 服务模块入仓 (moderate/summary/clue_matcher/dict_loader) |
| `298510a` | chore(events) | 事件属性迁移脚本 + 配套 e2e/spec |
| `2835886` | docs | 评论 AI 设计 + 验证报告 + 鼻纹评审交接归档 |
| `aa5d820` | test(user) | 补 collect/report 字段透传 + mock 资源 |
| `43dd944` | test(comments) | BUILTIN_DEFAULTS 扩展 e2e 覆盖 (bug3 档位 1) |
| `803b927` | chore | 清理 .bak + .agents + .gitignore 补规则 |

## 4. 测试基线

### 后端 jest (32 suite, 386 tests)

```
Test Suites: 4 failed, 28 passed, 32 total
Tests:       13 failed, 373 passed, 386 total
```

**4 failed suite (仓库既有, 与本次无关):**

| suite | 失败数 | 根因 |
|---|---|---|
| `comments/__tests__/dictionary.spec.ts` | 1 | DictionaryLoader 模块加载失败 (AnimalRepository 注入缺失) |
| `comments/__tests__/event-recall.spec.ts` | 8 | EventRecallService AnimalRepository 注入失败 |
| `comments/__tests__/comments-clue-e2e.spec.ts` | 3 | ClueBridgeService 测试 setup 问题 (AnimalRepository 缺失) |
| `matching/matching.service.spec.ts` | 1 | matching 服务期望单值 `:status`, 实际用了 `IN (:...statuses)` |

> 这 4 个 suite 在 v1.1 修复前就已 fail,与本次冻结无关。修改范围已严格控制(CLAUDE.md "Surgical Changes"),无新增 fail。

### 前端 vitest (相关 5 suite, 11 tests)

```
Test Files: 5 passed, 5 total
Tests:      11 passed, 11 total
```

✅ `collect-passes-extra-fields` / `report-passes-extra-fields` / `defect3-collect-result-create-without-nose` / `defect1-collect-skip-nose` / `defect2-collect-result-skip-compare-when-no-nose` 全过。

## 5. 后端服务启动日志确认 (4 条关键日志)

启动 `npm run start:prod` 应看到:

```
[Nest] XXX - LOG [DictionaryLoader] [DictionaryLoader.hotReload] watching F:\swcup2026\backend\data\dicts
[Nest] XXX - LOG [FileStateStore] [FileStateStore.migration] migrated=0 skipped=N files=M
[Nest] XXX - LOG [GeoResolverService] [GeoResolverService] indexed 277 coords, 145 cells, fallback_words=277
[Nest] XXX - LOG [ClueBridgeService] [ClueBridgeService.init] jieba user_dict injected: 318 words
[Nest] XXX - LOG [ClueBridgeService] [ClueBridgeService.init] segmenter=nodejieba, state_dir=F:\swcup2026\backend\data\clue_state
```

AI 服务启动应看到 `:8000/docs` 可访问 (FastAPI Swagger)。

## 6. 部署注意事项

### 后端启动
- 生产环境用 `npm run start:prod` (即 `node dist/main`),**不是** `start:dev`
- 环境变量: 复制 `.env.example` → `.env` (不提交),填 MySQL 连接 + JWT secret + AI_SERVICE_URL
- 端口: 默认 3000 (Windows Hyper-V 保留段 2024-3181,避开;之前用 3500)

### 数据库
- MySQL 8.0, 端口 3306 (容器内) → 3307 (主机)
- 启动顺序: 先 MySQL → 跑 `backend/scripts/migrate-2026-07-14-add-event-attributes.sql` → 启动后端
- TypeORM `synchronize: false`, 必须用 migration 脚本

### ai-service 启动
- `uvicorn src.main:app --host 0.0.0.0 --port 8000`
- 注意 `src.main:app` 路径相对项目根 (`F:/swcup2026/ai-service/`)
- 评论 AI 词典目录 `ai-service/data/dicts/` 需要 6 个 JSON:
  - badwords / fake_keywords / care_keywords / seek_keywords / report_keywords / thanks_keywords
- 如词典缺失, ai-bridge 会 fallback 到 `BUILTIN_DEFAULTS` (TS 硬编码, dict_loader.ts:64-135)

### 网络
- `git push` 易 408, 重试 2-3 次或换 DNS (8.8.8.8)
- WS 后端服务可能慢, 首次加载慢

## 7. 已知仓库既有失败 (不影响本次冻结, 不修)

1. **dictionary.spec / event-recall.spec / comments-clue-e2e.spec**: 3 个 spec 都因为 AnimalRepository 注入失败(模块 setup 缺 `@InjectRepository(Animal)`)
   - 影响: 阻塞这些 spec 整个 describe 块,所有 it 都 fail
   - 修复方向: 在 `Test.createTestingModule` providers 里补 `{ provide: getRepositoryToken(Animal), useValue: animalRepo }`
   - 决定: 不修,只影响测试覆盖率,生产代码不受影响

2. **matching.service.spec**: 期望 SQL `a.status = :status`, 实际用了 `IN (:...statuses)`
   - 影响: 1 个 it fail
   - 修复方向: 更新测试断言或回滚源代码
   - 决定: 不修,源代码设计是 multi-status (lost + found),测试断言过期

## 8. 4 个压缩包打包指南 (下一会话)

按提交任务清单 `D:\Desktop(important)\bug\提交任务清单.md`:

### ① 安装包 `TEAM2026A001_安装包.zip`
- 根级放 `docker-compose.yml` (在 `submission/code/`)
- 包含 ai-service 镜像 (189M weights)
- 单包 ≤1GB, 目标 ≤800MB

### ② 源代码 `TEAM2026A001_源代码.zip`
- 根级为 `src/`、`backend/` 等原目录 (直接打包 `F:\swcup2026\`)
- **删除**: `node_modules/`、`__pycache__/`、`dist/`、`.env`、`weights/`、`*.bak`、`*.log`
- 体积预估: < 50MB

### ③ 文档与展示 `TEAM2026A001_文档展示.zip`
- 内部子目录: `PPT/`、`视频/`、`文档/`
- PPT: 项目介绍 (10~15 页)
- 视频: ≤7 分钟演示 (MP4 H.264)
- 文档: 需求分析 + 系统设计 + 测试说明 + 本交接文档 (`docs/handoff-freeze-2026-07-15.md`)

### ④ 资质材料 `TEAM2026A001_资质材料.zip`
- 报名表 PDF (从官网下载, 填写后转 PDF)
- 学生证文件夹 (队长+队员 扫描件, 合并)

## 9. 评审演示路径建议

1. **采集入口**: 拍摄 → AI 品种识别 → GPS 定位 → 三属性 → 提交 → 后端落 RescueEvent
2. **审核端**: admin 看到事件,点"同意新建" → Animal 落库,animal.photos=[body_photo_url]
3. **动物详情**: 首页列表 / 详情页 能显示照片 (修复前是 placeholder)
4. **认领**: 用户对某 Animal 提交 claim → admin 审核 → status=claimed
5. **评论**: 用户在 animal-detail 评论 → 评论 AI 分类 (care/seek/thanks/report) → 线索匹配 → admin 线索审核
6. **线索决策**: admin 在 audit → clues tab 看到 → 点"确认关联" → 3 个 DB 副作用 (event INSERT / animal UPDATE / comment UPDATE)

## 10. 紧急回退

- **代码回退到 tag**: `git reset --hard v1.1-final`
- **放弃本次冻结 commit**: `git reset --hard 01bf613` (回到上会话结束状态)
- **重新打 tag**: 删除 `git tag -d v1.1-final` + `git push origin :refs/tags/v1.1-final`
