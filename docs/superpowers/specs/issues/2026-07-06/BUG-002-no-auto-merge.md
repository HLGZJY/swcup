# BUG-002 同区/同鼻纹检测后未自动合并

**优先级**: 🟠 P1  
**标签**: `bug`, `backend`, `fusion`, `auto-merge`  
**发现时间**: 2026-07-06  
**测试场景**: P2, P6

---

## 现象

后端检测到融合分 fusion_score ≥ 阈值(实测 1.0)的事件,**没有自动触发合并动作**,事件 status 一直停留在 `pending`。

## 复现步骤

1. user2 采集 A2.jpg + aa1.jpg(同 A1 鼻纹,距离 80m)
2. 提交,result 页提示"匹配到豆豆"
3. 选"是这只"
4. admin 端事件审核 → 打开该事件

## 预期

- `fusion_score = 1.0` ≥ 阈值(如 0.9)时,**自动**:
  - `rescue_events.status = 'duplicated'`
  - `rescue_events.duplicate_of` 指向目标 animal
  - `animals.report_count` 增长
- admin 只需"确认"操作(可批量)

## 实际

事件 status 一直 `pending`,admin 待审中心积压:
```
97f952ea (A1)  fusion=1.0000  status=pending
ef80b56f (A5)  fusion=1.0000  status=pending
```

## 用户原话

> "前端虽然说是确认重复,系统自动合并,但是并没有进行自动合并"

## 根因假设

`collect` 流程在创建事件后,**没触发**自动融合:
- `/v2/animals` 接口 → INSERT animals + INSERT rescue_events(动物) → return
- 后续**没有异步任务**去跑 `processEvent()`
- 融合完全依赖 admin 在审核页手动点 process

## 修复建议

### 方案 A:在 `/v2/animals` 创建后,async 触发融合

```typescript
// backend/src/animals/animals.service.ts createAnimal()
async createAnimalV2(dto: CreateAnimalV2Dto, userId: string) {
  const animal = await this.insertAnimal(dto);
  // 异步跑融合,不阻塞响应
  setImmediate(() => {
    this.eventsService.processNewAnimalEvent(animal.animal_id, dto, userId);
  });
  return animal;
}
```

### 方案 B:加 cron / queue,定期扫 status=pending 的事件

- 简单但有延迟

## 验收标准

- [ ] 创建动物后,事件 status 在 5s 内变为 `duplicated`(融合分高时)
- [ ] fusion_score < 阈值时,事件 status 保持 `pending`
- [ ] admin 待审中心列表里,高融合分事件数量大幅减少
- [ ] 单元测试:`createAnimalV2` 后 `processNewAnimalEvent` 被调用

## 关联

- 同 [BUG-003](BUG-003-report-count-no-grow.md)、[BUG-004](BUG-004-event-not-inserted.md) 共同构成
- 依赖 [BUG-005](BUG-005-self-merge.md) 修复(避免 self-merge)