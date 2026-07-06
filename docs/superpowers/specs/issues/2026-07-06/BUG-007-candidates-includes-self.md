# BUG-007 审核页 candidates 包含事件自身

**优先级**: 🔴 P0  
**标签**: `bug`, `backend`, `fusion`, `data-corruption`  
**发现时间**: 2026-07-06  
**测试场景**: P4, P5(所有走 collect 创建新动物的流程)

---

## 现象

admin 端打开一条 collect 类型事件,看到 candidates 候选列表,**第一项就是这个事件自己刚创建的动物**。

## 复现步骤

1. 全新注册 user1,采集 A1.jpg + aa1.jpg 创建新动物
2. admin 端事件审核 → 打开该 collect 事件 → 查看 candidates 列表
3. **观察**: candidates[0] 是当前事件自身的 animal_id

## 预期

candidates 应只包含**已存在的其它动物**,不包含事件自己创建的 animal。

## 实际

每条 collect 事件 candidates[0] 都是 self(参见 BUG-005 证据表)。

## 根因假设

同 [BUG-005](BUG-005-self-merge.md):collect 流程先 INSERT animals 再跑融合,candidates 池包含新插入的 animal。

## 修复建议

参见 BUG-005 **方案 A**:调整流程顺序,先 INSERT event 再异步融合,candidates 查询 SQL 加 `WHERE animal_id != ?`。

## 验收标准

- [ ] 重跑 P1/P5,所有 collect 事件 candidates[0] 都是**其它**动物
- [ ] 单元测试:candidates 查询排除自身

## 关联

- 是 [BUG-005](BUG-005-self-merge.md) 的子症状
- 根因同 [BUG-006](BUG-006-nose-score-inconsistent.md)