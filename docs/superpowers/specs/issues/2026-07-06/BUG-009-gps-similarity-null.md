# BUG-009 GPS similarity 跨区应为很低但实为 null

**优先级**: 🟡 P2  
**标签**: `bug`, `backend`, `gps`, `scoring`  
**发现时间**: 2026-07-06  
**测试场景**: P3

---

## 现象

跨区(16km)上报事件,GPS similarity 应低于 0.2,实际值是 `null`(或被序列化丢失)。

## 复现步骤

1. user2 在浦东金桥 (31.2550, 121.5950) 采集 A3.jpg + aa3.jpg
2. 后端跑融合,看 candidates 中**静安区**动物的 gps_similarity

## 预期

- 静安区(31.2280, 121.4470)与浦东金桥直线距离约 16km
- gps_similarity 应 < 0.2

## 实际

DB 中 `gps_similarity` 字段为 `0.0000` 或 `null`,前端展示为 `null`。

## 证据

P3 验收: "跨区 (距 A1 约 16km), GPS similarity 应该很低 补充:实际值为 null 并不是很低"

## 根因假设

`fusion.service.ts` 中 gps_similarity 计算:
- Haversine 距离过大时直接置 null
- 或前端 TypeScript 类型 `number | null`,渲染时未处理 null 情况

## 修复建议

```typescript
// fusion.service.ts
function calculateGpsSimilarity(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const distance = haversine(lat1, lng1, lat2, lng2); // 米
  if (distance > 50000) return 0;  // > 50km 给 0,不要 null
  if (distance < 100) return 1;
  return Math.max(0, 1 - distance / 50000);
}
```

前端 `AnimalCard.vue`:
```vue
<view class="score">GPS: {{ matched.gps_similarity ?? 0 | toPercent }}</view>
```

## 验收标准

- [ ] 跨区事件 gps_similarity 字段**永远**有数值(0~1)
- [ ] 前端展示不会出现"null"
- [ ] 单元测试:`calculateGpsSimilarity` 边界

## 关联

- 与 [BUG-010](BUG-010-gps-distance-wrong.md) 一起,GPS 计算相关