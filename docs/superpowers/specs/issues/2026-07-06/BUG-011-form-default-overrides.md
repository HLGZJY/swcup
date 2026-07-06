# BUG-011 默认值覆盖用户选择(性别/健康/绝育)

**优先级**: 🟡 P2  
**标签**: `bug`, `frontend`, `backend`, `dto`, `defaults`  
**发现时间**: 2026-07-06  
**测试场景**: P3

---

## 现象

用户在前端表单选择"未知/未选择"等空值,提交后被数据库默认值覆盖。

## 复现步骤

1. 采集页 → 步骤 4(metadata)
2. 选择:
   - 性别:未知
   - 年龄:空
   - 健康:空
   - 绝育:未选
3. 提交 → 进 admin 端看该动物

## 预期

DB 中字段应保留用户提交的"未知/空"语义。

## 实际

| 字段 | 用户选择 | DB 实际 |
|---|---|---|
| 性别 | 未知 | female(妹妹) |
| 年龄 | 空 | (空白) ✅ |
| 健康 | 空 | unknown |
| 绝育 | 未选 | false(未绝育) |

## 证据

P3 用户原话: "性别-未知 年龄、健康、是否绝育-均未选择 实际展示数据:性别-妹妹 年龄-空白 健康-未知 是否绝育-未绝育"

## 根因假设

`CreateAnimalV2Dto` 对 nullable 字段处理:
- 前端传 `gender: 'unknown'` 或不传 → 后端 DTO 验证通过 → TypeORM 字段 nullable 但**数据库列默认值** `DEFAULT 'female'` 生效
- `sterilized` 是 TINYINT,默认值 0(false),所以未选 = 未绝育
- `health_status` ENUM 默认 `'unknown'`

## 修复建议

### 后端(`animals.entity.ts`)

```typescript
@Entity('animals')
export class Animal {
  @Column({ type: 'enum', enum: ['male', 'female', 'unknown'], default: 'unknown', nullable: true })
  gender: string | null;
  
  @Column({ type: 'enum', enum: ['healthy', 'injured', 'ill', 'unknown'], default: 'unknown', nullable: true })
  health_status: string | null;
  
  @Column({ type: 'tinyint', default: null, nullable: true })
  sterilized: number | null;
}
```

### 前端(`collect/index.vue`)

确保所有选项都显式传值,**不要省略**字段:
```javascript
const payload = {
  species: form.species,
  breed: form.breed,
  color: form.color,
  gender: form.gender ?? 'unknown',         // 显式 unknown
  age_estimate: form.age_estimate || null,  // null 而不是省略
  health_status: form.health_status ?? 'unknown',
  sterilized: form.sterilized ?? null,      // null 而不是 false
  // ...
};
```

## 验收标准

- [ ] 用户选"未知",DB 显示 `gender='unknown'`(不再变 female)
- [ ] 用户不选绝育,DB 显示 `sterilized=NULL`(不再变 0)
- [ ] 用户不选健康,DB 显示 `health_status='unknown'`(可以)
- [ ] 单元测试:DTO 字段 nullable 行为

## 关联

- 同前端表单改造一起改
- 也涉及 [BUG-013](BUG-013-collect-vs-find-flow.md) 的 collect 流程 DTO