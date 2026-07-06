# BUG-012 位置表单无"虹口"选项

**优先级**: 🟡 P2  
**标签**: `bug`, `frontend`, `location`, `poi`  
**发现时间**: 2026-07-06  
**测试场景**: P4

---

## 现象

采集页 location-box 候选项中没有"虹口",用户无法在表单里直接选"虹口"作为位置。

## 复现步骤

1. 采集页 → 步骤 3(位置)
2. 点开 location-box 下拉
3. 搜索"虹口"

## 预期

下拉里出现"虹口区"或具体 POI(如"虹口四川北路")。

## 实际

下拉里没"虹口"相关选项。

## 证据

P4 用户原话: "位置虹口,这个在表单中并没有该项,是否是位置标识"

## 根因假设

location-box 数据源:
- 后端预置的 POI 列表,虹口区未录入
- 或接腾讯/高德地图 API,但调用失败兜底为空

## 修复建议

### 方案 A:补全 POI 数据

在 `backend/src/locations/poi.seed.ts` 里加:
```typescript
{ name: '虹口四川北路', lat: 31.2650, lng: 121.4980, district: '虹口区' },
{ name: '虹口龙之梦', lat: 31.2723, lng: 121.4997, district: '虹口区' },
// ... 虹口区主要 POI
```

### 方案 B:接腾讯地图 WebService API

```typescript
async getPoiSuggestions(keyword: string, location?: { lat: number, lng: number }) {
  const url = `https://apis.map.qq.com/ws/place/v1/suggestion?keyword=${keyword}&key=${TENCENT_MAP_KEY}`;
  // ...
}
```

### 方案 C:只显示当前 GPS 反查的地址(推荐)

- 用户允许浏览器定位 → 自动 reverse geocoding → 拿到"虹口区四川北路 1888 号"
- location-box 显示这个地址,允许手动微调文字但经纬度不再变

## 验收标准

- [ ] 搜索"虹口"能返回 ≥ 3 个 POI
- [ ] 搜索"四川北路"能找到具体地址
- [ ] 用户能从中选一个作为采集地点

## 关联

- 同前端地图组件一起改