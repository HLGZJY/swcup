# BUG-006 鼻纹评分:采集页 ≠ 审核页(算法不一致)

**优先级**: 🔴 P0  
**标签**: `bug`, `algorithm`, `fusion`, `consistency`  
**发现时间**: 2026-07-06  
**测试场景**: P3, P4

---

## 现象

同一只动物的同一张鼻纹:
- 在 user 端"采集"页面能匹配到 ~56%~100% 的相似度
- 在 admin 端"事件审核"页面 fusion_score 里 `vector_similarity` 字段**永远是 0**(除非 self-merge)

## 复现步骤

1. user 端采集 A3.jpg + aa3.jpg,创建档案 → 评分面板显示鼻纹 56%
2. admin 端事件审核 → 打开该 collect 事件
3. 查看 `vector_similarity` 字段

## 预期

`vector_similarity` 应反映真实向量相似度,与采集页算法一致。

## 实际

DB 中多条事件 `vector_similarity = 0`:
```
57055e50 | text_match_rate=1, vector_similarity=0, fusion=0.514
4678057b | text_match_rate=1, vector_similarity=0, fusion=0.4806
```

只有 self-merge 的几条 vector_similarity=1(因为 candidates 含自身,直接命中)。

## 用户原话

> "采集完全不走审核就能展示到公共区域,发现走审核是驳回还是合并 似乎也没有创建新动物的选项... 采集页面应使用同一套分数算法"

## 根因假设

两套 fusion_score 实现:
1. **采集页(`/v1/nose/collect`)**:走的是 `fusion.service.ts` 的 `getSimilarity()` 路径,**正常调用向量检索服务**(port 8000 FastAPI)
2. **审核页(`/v1/admin/events/{id}/process`)**:走的是 `events.service.ts` 的 `processEvent()` 路径,可能**没把 `nose_vector_id` 传给向量检索服务**,导致 vector_similarity 默认给 0

代码层面需要在 `process-event.dto.ts` 和 `events.service.ts` 里:
- 确认 `nose_vector_id` 是否被序列化进 candidates 查询参数
- 确认 fusion 公式里 `vector_similarity` 权重不为 0

## 修复建议

```typescript
// backend/src/admin/events.service.ts processEvent()
async processEvent(eventId: string) {
  const event = await this.findEvent(eventId);
  if (!event.nose_vector_id) {
    throw new BadRequestException('事件未关联鼻纹向量,无法计算 vector_similarity');
  }
  // 调用与 /v1/nose/collect 完全相同的融合服务
  const fusion = await this.fusionService.calculate({
    nose_vector_id: event.nose_vector_id,
    location_lat: event.location_lat,
    location_lng: event.location_lng,
    description: event.description,
    species: event.species,
    breed: event.breed,
    color: event.color,
    gender: event.gender,
  });
  // 更新 candidates 与 fusion_score
  await this.eventRepo.update(eventId, {
    candidates: fusion.candidates,
    vector_similarity: fusion.vector_similarity,
    gps_similarity: fusion.gps_similarity,
    text_match_rate: fusion.text_match_rate,
    image_similarity: fusion.image_similarity,
    fusion_score: fusion.fusion_score,
  });
}
```

## 验收标准

- [ ] 同一鼻纹,采集页和审核页 `vector_similarity` 完全一致(±0.001)
- [ ] 单元测试:`processEvent()` 与 `noseCollect()` 共享 fusion 算法
- [ ] 重跑 P1-P6,所有事件 vector_similarity > 0(只要有鼻纹)

## 关联

- 根因同 [BUG-005](BUG-005-self-merge.md)、[BUG-007](BUG-007-candidates-includes-self.md)
- 阻塞 [BUG-013](BUG-013-collect-vs-find-flow.md) 的修复