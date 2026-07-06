# 2026-07-06 模拟机测试 Bug 索引

> **来源**:`../2026-07-06-bugs-collected.md`(总览)
> **测试报告**:`../2026-07-06-manual-test-pic-flow.md`
> **生成时间**:2026-07-06
> **总数**:16 个 Bug + 1 个优化项

---

## 🔴 P0 — 数据/算法错乱(4)

| Issue | 标题 | 关联 |
|---|---|---|
| [BUG-005](BUG-005-self-merge.md) | 重复事件 `duplicate_of == animal_id` 自我引用 | root cause |
| [BUG-006](BUG-006-nose-score-inconsistent.md) | 鼻纹评分采集页 ≠ 审核页 | root cause |
| [BUG-007](BUG-007-candidates-includes-self.md) | 审核页 candidates 包含事件自身 | BUG-005 子问题 |
| [BUG-008](BUG-008-text-match-broken.md) | 文本匹配度异常(毫不相关 = 100%) | 独立 |

## 🟠 P1 — 主流程断裂(7)

| Issue | 标题 | 关联 |
|---|---|---|
| [BUG-001](BUG-001-missing-saw-again-button.md) | 缺"又看到这只狗"上报按钮 | UI |
| [BUG-002](BUG-002-no-auto-merge.md) | 同区同鼻纹未自动合并 | 后端 |
| [BUG-003](BUG-003-report-count-no-grow.md) | report_count 不增长 | BUG-002 子 |
| [BUG-004](BUG-004-event-not-inserted.md) | 重复事件未新增记录 | BUG-002 子 |
| [BUG-013](BUG-013-collect-vs-find-flow.md) | 采集 vs 发现流程标准不统一 | 架构 |
| [BUG-014](BUG-014-admin-no-create-new.md) | 审核端缺"创建新动物"选项 | 后端 |
| [BUG-015](BUG-015-cannot-auto-found.md) | 采集流程无法自动标 found | BUG-013 子 |

## 🟡 P2 — 体验问题(5)

| Issue | 标题 | 关联 |
|---|---|---|
| [BUG-009](BUG-009-gps-similarity-null.md) | GPS similarity 跨区应为很低但实为 null | 后端 |
| [BUG-010](BUG-010-gps-distance-wrong.md) | GPS distance 689970m(应 ~16km) | 后端 |
| [BUG-011](BUG-011-form-default-overrides.md) | 默认值覆盖用户选择 | 前端+后端 |
| [BUG-012](BUG-012-location-no-hongkou.md) | 位置表单无"虹口"选项 | 前端 |
| (合并到 BUG-013) | — | — |

> 注:B 区原本列了 BUG-006/007/008/009/010 共 5 个,其中 006/007/008 升 P0,009/010 留 P2。统计上是 5+5+2+3=15 bug + 1 OPT = 16。

## ⚪ P3 — 优化(1)

| Issue | 标题 |
|---|---|
| [OPT-001](OPT-001-list-image-not-loaded.md) | "我的上报"列表卡片图片不显示 |

---

## 修复优先级(开发排期建议)

### 第 1 批(P0 根因,合并修复)

| ID | 工作量 | 说明 |
|---|---|---|
| BUG-005 | 2-3h | collect 流程改为先写 event,再异步融合 |
| BUG-006 | 1-2h | 抽取 fusion_service.ts,审核页复用 |
| BUG-007 | 0.5h | 同 005 |
| BUG-008 | 1h | 重写 text_match,字段独立加权 |

### 第 2 批(P1 流程补齐)

| ID | 工作量 | 说明 |
|---|---|---|
| BUG-002/003/004 | 4-6h | event 写完异步 processEvent,分阈值自动合并 |
| BUG-001 | 0.5h | result 页加按钮 |
| BUG-013/015 | 2h | 统一 collect/find 流程入口 |
| BUG-014 | 1h | admin process 接口加 action=create_new |

### 第 3 批(P2 体验)

| ID | 工作量 |
|---|---|
| BUG-009/010 | 1h(GPS) |
| BUG-011 | 1h(默认值) |
| BUG-012 | 0.5h(POI) |
| OPT-001 | 0.5h(图片) |

---

## 验收方式

每修一个 bug,在对应 issue 里:
1. 勾选 [x] 复现步骤已不能再触发
2. 补单元测试 / E2E 用例链接
3. 把 PR 链接挂在 issue 底部
4. 由测试者(模拟机)复跑该场景确认通过

---

## 关联文档

- [总览 Bug 报告](../2026-07-06-bugs-collected.md)
- [测试报告(用户原版)](../2026-07-06-manual-test-pic-flow.md)
- [E2E 清单](../2026-07-06-manual-test-checklist.md)