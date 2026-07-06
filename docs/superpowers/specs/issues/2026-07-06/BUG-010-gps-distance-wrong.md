# BUG-010 GPS distance 数值离谱(689970m,实际仅跨区 16km)

**优先级**: 🟡 P2  
**标签**: `bug`, `backend`, `gps`, `haversine`  
**发现时间**: 2026-07-06  
**测试场景**: P3

---

## 现象

Haversine 距离计算结果严重偏离实际值,跨区 16km 算出 689970m(689km)。

## 复现步骤

1. user2 在浦东金桥 (31.2550, 121.5950) 采集
2. 后端跑融合,返回 distance_m

## 预期

距离 ≈ 16000m(16km)

## 实际

distance_m = 689970(689km)

## 证据

P3 用户原话: "鼻纹56% 其余两项为0 最后得分28分 距离689970m 这个可能不准确"

## 根因假设

可能的 bug:
1. 经纬度用了错误单位(经度没做 ±)
2. Haversine 公式里 cos 用了度数而非弧度
3. 公式里 lat2-lng2 写反了
4. 数据本身错了(经度 121.5950 应该是 121.45)

## 修复建议

### 推荐公式(标准 Haversine)

```typescript
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // 地球半径 米
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

### 单元测试

```typescript
describe('haversine', () => {
  it('静安公园 → 浦东金桥 ≈ 16km', () => {
    const d = haversine(31.2280, 121.4470, 31.2550, 121.5950);
    expect(d).toBeGreaterThan(14000);
    expect(d).toBeLessThan(18000);
  });
  it('同一点 = 0', () => {
    expect(haversine(31.228, 121.447, 31.228, 121.447)).toBeCloseTo(0);
  });
  it('A1(31.2280,121.4470) → A2(31.2285,121.4475) ≈ 80m', () => {
    expect(haversine(31.2280, 121.4470, 31.2285, 121.4475)).toBeGreaterThan(50);
    expect(haversine(31.2280, 121.4470, 31.2285, 121.4475)).toBeLessThan(150);
  });
});
```

## 验收标准

- [ ] 静安公园 → 浦东金桥 distance 在 14-18km
- [ ] A1 → A2(80m 内) distance 在 50-150m
- [ ] 单点 distance = 0
- [ ] 单元测试覆盖至少 5 个距离场景

## 关联

- 同 [BUG-009](BUG-009-gps-similarity-null.md)