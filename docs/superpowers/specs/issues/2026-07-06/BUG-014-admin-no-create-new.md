# BUG-014 审核端缺"创建新动物"选项

**优先级**: 🟠 P1  
**标签**: `bug`, `backend`, `admin`, `process-event`  
**发现时间**: 2026-07-06  
**测试场景**: P11a 事件审核

---

## 现象

admin 在审核端打开一条"无匹配候选"的事件,只能"驳回",**不能**为该事件创建新动物档案。

## 复现步骤

1. admin 登录 → 待审中心 → 事件 tab
2. 打开一条 candidates 全部 fusion_score < 0.5 的事件
3. 查看操作按钮

## 预期

至少 3 个 action:
- **驳回(reject)**:删除该事件
- **确认合并(confirm)**:关联到某个现有 animal
- **创建新动物(create_new)**:为该事件创建一个新 animal 档案

## 实际

只有"驳回"和"确认"两个按钮。

## 用户原话

> "似乎也没有创建新动物的选项-审核端决定(这只动物也只有位置和文本这两个参数)"

## 根因假设

`PUT /v1/admin/events/{id}/confirm` 接口只接 `body.animal_id`(已存在),没接 `action: 'create_new'`。

## 修复建议

### 后端 `admin.controller.ts`

```typescript
@Put('events/:event_id/process')
async processEvent(
  @Param('event_id') eventId: string,
  @Body() body: { action: 'reject' | 'confirm' | 'create_new', animal_id?: string },
) {
  if (body.action === 'create_new') {
    return this.eventsService.createAnimalFromEvent(eventId);
  }
  if (body.action === 'confirm') {
    return this.eventsService.confirmEvent(eventId, body.animal_id);
  }
  return this.eventsService.rejectEvent(eventId);
}
```

### 后端 `events.service.ts`

```typescript
async createAnimalFromEvent(eventId: string) {
  const event = await this.findEvent(eventId);
  const newAnimal = await this.animalService.createAnimal({
    species: event.species,
    breed: event.breed,
    color: event.color,
    gender: event.gender,
    age_estimate: 'unknown',
    health_status: event.health_status || 'unknown',
    sterilized: false,
    location_lat: event.location_lat,
    location_lng: event.location_lng,
    address: event.address,
    description: event.description,
    photos: event.photos,
    nose_vector_id: event.nose_vector_id,
  }, event.reporter_id);
  
  await this.eventRepo.update(eventId, {
    status: 'confirmed',
    animal_id: newAnimal.animal_id,
  });
  await this.animalRepo.increment({ animal_id: newAnimal.animal_id }, 'report_count', 1);
  return { animal_id: newAnimal.animal_id };
}
```

### 前端

事件审核 modal 加"创建新动物"按钮(仅当 candidates 为空或最高分 < 阈值时显示)。

## 验收标准

- [ ] admin 审核事件时可点"创建新动物"
- [ ] 新动物档案数据从事件字段拷贝
- [ ] 新 animal.report_count = 1
- [ ] 事件 status 变为 `confirmed`
- [ ] 单元测试:`createAnimalFromEvent` 路径

## 关联

- 同 [BUG-013](BUG-013-collect-vs-find-flow.md) 的产品决策相关