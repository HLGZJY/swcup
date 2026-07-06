# BUG-005 重复事件 duplicate_of 与 animal_id 自我引用

**优先级**: 🔴 P0  
**标签**: `bug`, `backend`, `fusion`, `data-corruption`  
**发现时间**: 2026-07-06  
**测试场景**: P1, P4, P5(影响所有 collect 流程)

---

## 现象

`rescue_events` 表中事件的 `duplicate_of` 字段值 **等于** 该事件自身的 `animal_id`,即系统建议"把 A 合并到 A 自己"。

## 复现步骤

1. 全新注册 user1 → 登录
2. miniapp-user → 采集 → 物种 dog
3. 上传全身照 A1.jpg + 鼻纹 aa1.jpg
4. 选位置"静安公园"
5. 填品种/颜色/性别/年龄/健康/绝育 → 提交
6. 创建档案完成
7. 进 admin 后台 → 事件审核 → 看刚才那条事件
8. **观察**: `duplicate_of == animal_id` (建议合并到自己)

## 预期

`duplicate_of` 应该指向**另一个**已存在的动物(可能是真正重复的旧档案),不应等于自身 animal_id。

## 实际

DB 4 条事件全部命中:

| event_id | animal_id | duplicate_of | 是否 self |
|---|---|---|---|
| `0da25b8f-d722-44a6-bc64-3a6a041760ad` | `ef71a468...`(A4 萨摩耶) | `ef71a468...`(A4 自身) | ✅ self |
| `97f952ea-e851-49be-8a48-52639e20c4a3` | `f9394535...`(A1 金毛) | `f9394535...`(A1 自身) | ✅ self |
| `ef80b56f-9e31-4172-82cd-2fcc56cb5afe` | `2ac0157e...`(A5 土狮犬) | `2ac0157e...`(A5 自身) | ✅ self |

## 证据 dump

```sql
SELECT event_id, animal_id, event_type, is_duplicate, duplicate_of, fusion_score, status
FROM rescue_events WHERE created_at > '2026-07-06';
```

```
0da25b8f | ef71a468 | report   | 1 | ef71a468 | 0.9000 | duplicated
97f952ea | f9394535 | collect  | 1 | f9394535 | 1.0000 | pending
ef80b56f | 2ac0157e | collect  | 1 | 2ac0157e | 1.0000 | pending
```

## 根因假设(基于代码静态分析)

`collect` / `find` 服务流程里:
1. 用户提交 → **先** `INSERT INTO animals (...) VALUES (...)` → 拿到新 `animal_id`
2. **再**用此 animal_id 触发鼻纹比对服务(`/v1/nose/collect` 内部)
3. 比对服务的 candidates 池**不排除**刚插入的 animal
4. 向量检索命中自身 → `duplicate_of` 写为自身
5. 同根因导致 [BUG-006]、[BUG-007]

## 修复建议

**方案 A(推荐,改流程)**:
- 先 INSERT `rescue_events` (status=pending,animal_id=NULL)
- 异步任务跑融合 → 命中真重复时 UPDATE `animal_id` + `duplicate_of`
- candidates 池里**只有已存在的动物**,不会自我引用

**方案 B(快改,加排除条件)**:
- 融合服务 candidates 查询 SQL 加 `WHERE animal_id != NEW_ANIMAL_ID`
- 仍可能有"自身在候选池里被返回"的边角 case

**方案 C(数据修复)**:
- 跑一遍脚本,把 `duplicate_of == animal_id` 的事件 UPDATE 成 NULL
- 但不能解决"为什么会出现"的根本问题

## 验收标准

- [ ] 重跑 P1/P4/P5,DB 中 `duplicate_of` 字段**不再**等于自身 `animal_id`
- [ ] 单元测试:`collect` 流程 candidates 池排除自身
- [ ] E2E: 全新动物档案创建后,fusion_score ≤ 阈值时 `duplicate_of=NULL`

## 关联

- 根因同 [BUG-006](BUG-006-nose-score-inconsistent.md)、[BUG-007](BUG-007-candidates-includes-self.md)
- 阻塞 [BUG-002](BUG-002-no-auto-merge.md) 的修复验证