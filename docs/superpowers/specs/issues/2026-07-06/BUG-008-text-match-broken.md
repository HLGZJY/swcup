# BUG-008 文本匹配度算法异常(毫不相关 = 100%)

**优先级**: 🔴 P0  
**标签**: `bug`, `algorithm`, `text-match`  
**发现时间**: 2026-07-06  
**测试场景**: P3, P4

---

## 现象

不同品种、不同描述的两个动物,文本匹配度给到 **1.0**。完全无关的字段也被判定为"完全匹配"。

## 复现步骤

1. 采集 A3.jpg + aa3.jpg 创建拉布拉多档案
2. admin 端事件审核 → 打开该 collect 事件
3. 查看 candidates 中**金毛**(A1,完全不同品种)的 text_match_rate

## 预期

- text_match_rate 应按字段加权打分(品种/颜色/性别/健康/绝育/描述文本)
- 拉布拉多 vs 金毛,品种不匹配,该字段应扣分

## 实际

```
event_id 57055e50:
  candidate(A1 金毛):
    text_match_rate: 1.0    ← 应低于 1.0
    vector_similarity: 0
    gps_similarity: 0
    fusion_score: 0.514

  candidate(A4 萨摩耶):
    text_match_rate: 1.0    ← 应低于 1.0
    vector_similarity: 0.5419
```

事件 `4678057b` 同问题。

## 用户原话

> "文本匹配度应该比对 品种、颜色、性别、健康状态、绝育否、以及用户文本"
> "文本匹配算法确实是有问题的 毫不相似的将居然是 100%"

## 根因假设

当前 text_match 算法可能:
- 退化判定:`description.length === other.description.length` → 1.0
- 默认给 1.0(没传 description)
- 没有字段级加权

## 修复建议

```typescript
// fusion.service.ts calculateTextMatch()
function calculateTextMatch(event: EventRecord, candidate: AnimalRecord): number {
  const fields = [
    { key: 'species', weight: 0.05 },
    { key: 'breed', weight: 0.25 },
    { key: 'color', weight: 0.20 },
    { key: 'gender', weight: 0.10 },
    { key: 'health_status', weight: 0.10 },
    { key: 'sterilized', weight: 0.05 },
    { key: 'description', weight: 0.25 },
  ];
  
  let score = 0;
  for (const { key, weight } of fields) {
    if (matchField(event[key], candidate[key])) {
      score += weight;
    }
  }
  return score;
}

function matchField(a: any, b: any): boolean {
  if (!a || !b) return false;  // 空值不算匹配
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return a === b;
}
```

## 验收标准

- [ ] 拉布拉多 vs 金毛 → text_match_rate ≤ 0.5(因品种不一致)
- [ ] 完全相同档案(自己)→ text_match_rate = 1.0
- [ ] 单元测试:每个字段不匹配都扣相应权重
- [ ] 重跑 P3,P3-A3 事件 candidates 中 text_match_rate 不再全部 1.0

## 关联

- 独立算法 bug,与 BUG-005/006/007 根因不同
- 影响 fusion_score 的可信度