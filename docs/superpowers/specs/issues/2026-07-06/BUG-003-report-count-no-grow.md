# BUG-003 report_count 不增长

**优先级**: 🟠 P1  
**标签**: `bug`, `backend`, `report-count`  
**发现时间**: 2026-07-06  
**测试场景**: P2, P6

---

## 现象

复发现场后,A1 / A5 等目标动物的 `report_count` 字段**没有增长**。

## 复现步骤

1. A1 当前 `report_count = 1`(创建时初始化)
2. user2 采集 A2.jpg + aa1.jpg(同 A1 鼻纹)
3. 后端匹配命中 A1
4. 查询 A1 详情

## 预期

A1.report_count = 2

## 实际

A1.report_count = 1(没增长)

## 证据

P6 验收点: "[0] A5.report_count 增长 没有增长"

## 根因假设

同 [BUG-002](BUG-002-no-auto-merge.md):因为没有自动合并,所以 `report_count++` 这步没触发。

或者在 `processEvent` 时,只更新了 `rescue_events` 表,**没有** UPDATE `animals.report_count`。

## 修复建议

```typescript
// backend/src/admin/events.service.ts processEvent() 成功后
async incrementReportCount(animalId: string) {
  await this.animalRepo.increment({ animal_id: animalId }, 'report_count', 1);
}
```

或 在 `confirmEvent` 时:
```typescript
async confirmEvent(eventId: string, body: { animal_id: string }) {
  await this.eventRepo.update(eventId, { status: 'confirmed', animal_id: body.animal_id });
  await this.animalRepo.increment({ animal_id: body.animal_id }, 'report_count', 1);
  return { ok: true };
}
```

## 验收标准

- [ ] 复发现场后,目标 animal.report_count +1
- [ ] 单元测试:`confirmEvent` 触发 `report_count` 自增

## 关联

- 子 bug of [BUG-002](BUG-002-no-auto-merge.md)