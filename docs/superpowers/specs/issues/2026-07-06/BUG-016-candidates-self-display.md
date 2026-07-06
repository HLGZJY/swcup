# BUG-016 候选池仍把自己列为 fusion=1.0 的 top match (UI/展示层)

**优先级**: 🟡 P2
**标签**: `bug`, `frontend`, `admin`, `display`, `regression`
**发现时间**: 2026-07-06(模拟机第 1 轮复测)
**测试场景**: P1 录入第 1 只动物 → admin 匹配
**状态**: BUG-005 修复**已落地**(`is_duplicate` 不会再写自身),本 issue 记录**残留的展示问题**

---

## 现象

数据库只有 1 只动物、admin 点击该动物对应事件的"匹配"按钮后:

- ✅ `event.is_duplicate = false`(BUG-005 修复成果)
- ✅ `event.duplicate_of = NULL`(无 self-merge)
- ❌ 但 admin 候选池页**仍显示**:`top match = animal-1, fusion = 1.0`

审核员会误以为"算法把自己算进去了",继续点确认就会触发实际自合并。这是**误导性展示**,虽然后端已防住,但 UI 让人误判。

事件一旦达到 2 只动物后,该问题在用户体验层面消失(候选池有真实非自身目标)。

## 复现步骤

1. 清空 `animals` / `rescue_events` / `claims` / `nose_features`(`users` 保留)
2. user2 采集一只动物 → 创建 `animal-1` + `rescue_events[animal_id=animal-1, candidates=[{animal-1, fusion=1.0}]]`
3. admin 端打开该事件详情
4. 观察"候选匹配"区块头部推荐

## 预期

候选池为空(或仅含自身)时:
- UI 显示"无可疑合并目标,请人工创建新动物档案"
- 或干脆把 `candidates[0].animal_id == event.animal_id` 的项**前端过滤掉**,再渲染顶部
- **不**显示 `fusion=1.0` 的伪推荐

## 实际

UI 直接展示 `candidates[0]` 为推荐,带 `fusion=1.0` 的"完美匹配",与"是它自己"事实冲突。

## 用户实测原话

> "我录入了第一只动物,后admin端出现一条待审核记录 点击匹配 还是会把自己计算进去。但是再录入第二只 第三只,之后都是正常的了。所以这个bug修改勉强算通过了。"

## 根因(展示层)

`processEvent` 修复后,**入数据库的 `candidates` 数组仍包含自身**(因为我们的合并过滤只影响 `topCandidate` / `is_duplicate`,不动候选人数组 — 这是为了保留"全库最相似"的可解释性)。

admin 前端读取时直接用 `candidates[0]` 当推荐结果,**没有**走:
- `event.is_duplicate`(后端已置 false,可以信任)
- 或前端先过滤 `candidates.filter(c => c.animal_id !== event.animal_id)`

## 修复建议

### 方案 A(前端过滤,推荐)

```typescript
// admin/src/views/EventReview.vue 或类似组件
const realCandidates = computed(() =>
  event.candidates?.filter(c => c.animal_id && c.animal_id !== event.animal_id) ?? []
);
const topMatch = computed(() => realCandidates.value[0] ?? null);
```

模板:
```vue
<div v-if="topMatch">推荐合并到 {{ topMatch.animal_id }} (fusion {{ topMatch.fusion_score }})</div>
<div v-else class="empty">无可疑合并目标 — 可创建新动物档案</div>
```

### 方案 B(后端在 candidates 入库前剔除自身)

`events.service.ts` 里 `updatePayload.candidates = candidates.filter(c => c.animal_id !== event.animal_id)`。

⚠️ 副作用:`candidates` 失去"全库最相似"的可解释性,且 `topCandidate.fusion_score` 与 `candidates[0].fusion_score` 会不一致,review 难以回溯。

**选 A**,只动展示,不改数据。

## 验收标准

- [ ] 仅 1 只动物的 collect 事件,admin 候选池页**不**显示 top match
- [ ] 显示"无可疑合并目标"或类似空态
- [ ] 多动物场景行为不变(top match 仍指向其他真实目标)
- [ ] 视觉回归无破坏(空态样式 OK)

## 关联

- 后续 [BUG-005/007](BUG-005-self-merge.md) 修复**没有**触发本次 UI 残留
- 一旦修 [BUG-014](BUG-014-admin-no-create-new.md) 把"创建新动物"按钮补上,本 UI 残留就有了正确的下一步入口,影响进一步降低
