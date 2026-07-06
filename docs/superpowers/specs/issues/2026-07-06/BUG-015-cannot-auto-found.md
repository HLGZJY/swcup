# BUG-015 "采集"流程无法自动标 found

**优先级**: 🟠 P1  
**标签**: `bug`, `backend`, `frontend`, `status`  
**发现时间**: 2026-07-06  
**测试场景**: P4

---

## 现象

用户走"捡到"路径(采集时填写"发现")创建动物档案,期望 status 自动为 `found`,实际**仍是 `lost`**。

## 复现步骤

1. user3 登录 → 采集 → 选萨摩耶 / 白色
2. 上传 A4.jpg + aa4.jpg,位置虹口
3. 备注:"路边徘徊,穿红色背心,疑似走失"
4. 提交

## 预期

A4 档案创建后 `status = found`(因为是"捡到"场景)。

## 实际

A4.status = lost,与走失上报完全一致。

## 根因假设

`CreateAnimalV2Dto` 没有 `report_type` 或 `intent` 字段,数据库默认 `status = 'lost'`。

## 修复建议

### 后端 DTO

```typescript
// animals.dto.ts
export class CreateAnimalV2Dto {
  // ... existing fields ...
  
  @IsOptional()
  @IsIn(['lost', 'found'])
  report_type?: 'lost' | 'found';
}
```

### Service

```typescript
async createAnimalV2(dto: CreateAnimalV2Dto, userId: string) {
  const status = dto.report_type === 'found' ? 'found' : 'lost';
  return this.insertAnimal({ ...dto, status });
}
```

### 前端 `collect/index.vue`

在步骤 4(metadata)加单选:
- [ ] 我家宠物走失了(report_type=lost)
- [ ] 我捡到一只动物(report_type=found)

传给后端。

## 验收标准

- [ ] 选"捡到"创建的动物 status=found
- [ ] 首页"发现"tab 能看到该动物
- [ ] 选"走失"创建的动物 status=lost(维持现状)
- [ ] 单元测试:`report_type` 字段映射

## 关联

- 子 bug of [BUG-013](BUG-013-collect-vs-find-flow.md)