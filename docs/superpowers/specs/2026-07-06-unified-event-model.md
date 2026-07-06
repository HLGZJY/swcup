# 统一事件模型 — 采集/发现流程整合架构

> **状态**:📐 已记录,待评审,**不动代码**
> **编写时间**:2026-07-06
> **对应分析**:[2026-07-06-bugs-collected.md](2026-07-06-bugs-collected.md) + [issues/2026-07-06/](issues/2026-07-06/)
> **触发问题**:用户对 16 bug 联合分析后,提出"采集/发现应该是同一动作的不同证据丰富度,而不是两个不同入口"

---

## 0. TL;DR

把"采集 / 发现 / 又看到 / 认领"4 个动作,**全部归并为同一个原子动作**:

> **"上报一次救助事件"** — 用户提交一次观察,无论他是主人还是路人,无论他有没有鼻纹。

- 数据模型不增表,只在 `Animal` + `RescueEvent` 上加一个 `intent` 字段语义
- UI 入口从 2 个(采集/发现)合并为 1 个表单骨架,3 个不同的"语境入口"
- 后端 `POST /v1/events` 走同一条 pipeline,只多一个 `intent` 入参
- **向后兼容**:现有流程不破坏,新场景自动可用

---

## 1. 背景与问题陈述

### 1.1 用户的核心观察

用户在测试 P4 后,做了 4 个场景的真实描述(原文):

> **A** 我家狗走失了,但没拍鼻纹,只有全身照 + 丢失位置
>
> **B** 我之前拍过这只狗的全身 + 鼻纹,但还没上报走失
>
> **C** 我路上看到一只流浪狗,不敢靠近,只有全身照 + 位置
>
> **D** 我路上看到一只流浪狗,温顺可以拍鼻纹

这 4 个场景对系统的本质需求是同一件事——**"我要给你这个动物留一条观察记录"**。区别只在 2 个维度:

| 维度 | 取值 |
|------|------|
| **意图(intent)** | `lost`(主人报失) / `found`(主人捡回) / `stray_sighting`(路人上报) |
| **证据(evidence)** | rich(有鼻纹) / poor(无鼻纹) |

### 1.2 当前代码把这两维硬编码到了 UI 层

| UI 入口 | 后端入口 | 现在的硬约束 |
|---------|----------|-------------|
| 采集页 `/pages/collect` | `NoseService.collect()` | **强制要求 `nose_photo`,否则 400** — 场景 A 直接被拒 |
| 发现页 `/pages/find` | `EventsService.create()` | OK,但要走审核 |
| 动物详情页 `/pages/result` | 只有"认领此动物"按钮 | **场景 C/D 的"又看到这只"补不到动物时间轴** |
| admin 审核页 | `PUT /events/:id/process` | **只接受 `reject`/`confirm(animal_id)`,无 `create_new`** |

也就是说:**A 场景无鼻纹走不通** + **C/D 场景"又看到"无处落档** + **admin 端"无匹配候选"时无法创建新动物**——3 个症状来自同一根因:**后端把"上报一次观察"拆成了"建档 / 找主人 / 认领"3 套独立流程,数据 Schema 跟随 UI 分裂**。

### 1.3 16 个 bug 与本架构的关系

详见 §10 "Bug 解构对照表"。简而言之:

- **P0 已修**(BUG-005/006/007/008)— 这是评分算法的修复,与本架构正交
- **本架构主吞**:BUG-001/004/013/014/015(5 个流程类 P1)
- **本架构副影响**:BUG-002/003(已修后端,本架构让它们持续运转)
- **本架构不吞**:BUG-009/010/011/012/OPT-001(独立 P2/P3,与流程分类无关)

---

## 2. 目标 / 非目标

### 2.1 目标

1. **场景 A-D 全覆盖**:无鼻纹的走失上报 / 路人无鼻纹上报 / 路人有鼻纹上报,均走通
2. **"又看到这只"成为标准能力**:任何动物详情页都能追加一条观察事件,不限于审核页
3. **admin 端动作闭合**:`reject / confirm / merge / create_new` 4 个动作任意选取
4. **状态语义显式**:`found` 不再靠入口默认,`lost` 不再靠入口默认,完全由数据本身决定
5. **零回归**:现有 5 个动物的流程不破,已有 issue 已修的不破

### 2.2 非目标

1. ❌ 不重新设计事件表 Schema(只加字段语义)
2. ❌ 不重写评审/审核 UI(阶段 3 才动)
3. ❌ 不引入事件总线/消息队列(还在单机部署期)
4. ❌ 不解决 P2 类零碎问题(BUG-009/010/011/012)
5. ❌ 不清理 `event_type='collect'|'report'` 字段(阶段 4 才动)

---

## 3. 核心抽象 — 2 个数据原语 + 1 个新字段

### 3.1 Animal(档案)— 几乎不动

| 字段 | 现状 | 调整 | 原因 |
|------|------|------|------|
| `animal_id` | UUID | 不变 | 主键 |
| `status` | `AnimalStatus`,默认 `LOST` | **默认值改 `null`**,创建时由调用方显式指定 | 当前 `默认 LOST` 是隐式猜测,导致 BUG-015 |
| `primary_nose_id` | nullable | 不变 | 场景 A/C 无鼻纹时保持 NULL,允许建档 |
| `body_colors / photos / breed / color / gender / ...` | 不变 | 不变 | — |

**调整后语义**:`status` 不再是 entity 默认值,而是创建时必填字段(由 `intent` 推导或由调用方显式覆盖)。

### 3.2 RescueEvent(事件)— 加 1 个字段

| 字段 | 现状 | 调整 | 原因 |
|------|------|------|------|
| `event_id` | UUID | 不变 | — |
| `event_type` | `report` / `collect` 二元 | **保留兼容,但语义转为内部转发依据**:`'profile_build'` 类事件代表"创建时同步写入 Animal" | 当前 `event_type` 表达的是动作分类,与本架构的 `intent` 重叠 |
| **`intent`** | — | **新增**:`'lost' \| 'found' \| 'stray_sighting' \| 'profile_build' \| 'unknown'` | 唯一字段意图,所有 UI / admin 决策依此 |
| `nose_vector_id` | nullable | 不变 | 已是 nullable |
| `nose_photo_url` | nullable | 不变 | — |
| `species / breed / color / gender / location_* / ...` | 不变 | 不变 | — |
| `animal_id` | nullable(merged 后填) | 不变 | — |
| `scores / candidates / status` | 不变 | 不变 | — |

**意图字段定义**:

| intent 枚举 | 谁产生 | 典型场景 |
|-----------|--------|---------|
| `lost` | 主人主动报失 | 场景 A、B |
| `found` | 主人主动登记"已找回 / 我捡到这只" | 场景 P4(P4 测试意图) |
| `stray_sighting` | 路人上报 | 场景 C、D |
| `profile_build` | 系统内部使用,标记"创建时同步生成的绑定事件" | 等价当前 `event_type='collect'` |
| `unknown` | 老数据 fallback | 迁移期兼容 |

### 3.3 时间轴抽象 — 不增表

**Animal 的时间轴 = 该 animal 所有 `animal_id=X` 的事件倒序列表**。

- 不引入 `timeline` 表
- 不引入 `sighting` 表
- 直接 `rescue_events.animal_id` + `occurred_at DESC`
- 展示层为每条事件卡片渲染 `谁 + 在哪 + 何时 + 看到了什么`

---

## 4. 4 场景 × 统一后的行为

| 场景 | UI 入口 | intent | nose | 后端动作序列 | 最终态 |
|------|---------|--------|------|-----------|--------|
| **A** 走失无鼻 | 录入档案页 | `lost` | ❌ | (1) `POST /v1/events` 带 `intent='lost'` + body photo + GPS(2) animal_id? 没有 → 自动同时 `POST /animals` 建档 | 1 Animal (status=lost) + 1 Event (intent=lost, animal_id=新 animal) |
| **B** 走失有鼻 | 录入档案页 | `lost` | ✅ | 同 A 但额外 step `POST /v1/nose/collect` | 1 Animal + 1 Event + 1 NoseFeature |
| **C** 捡到无鼻 | 上报一只页 | `stray_sighting` | ❌ | `POST /v1/events` 带 `intent='stray_sighting'` 仅传 body + GPS | 1 Event (animal_id=null, status=pending) → admin 决定 create_new 或 merge |
| **D** 捡到有鼻 | 上报一只页 | `stray_sighting` | ✅ | 同 C + 鼻纹存储 | 1 Event 同上,但 processEvent 高分会自动 merge |

### 4.1 共同 pipeline(后端)

不论 intent 是什么,事件一旦写入,以下逻辑统一:

```
[1] POST /v1/events body={intent, photos[], nose_photo?, location, ...}
        ↓
[2] EventsService.create()
        - 写 RescueEvent row, status=pending
        - 如果 intent='lost' 或 intent='found',且 dto 没传 animal_id
            → 自动 AnimalsService.create() 建档 + event.animal_id 关联
        - setImmediate(EventsService.processEvent)
        ↓
[3] EventsService.processEvent(event_id)
        - 幂等检查(fusion_score 非空则跳过)
        - 如果 nose_vector_id → NoseService.compare() 取 candidates
        - 否则 MatchingService.findSimilarLostAnimalsForReport() 取 candidates
        - 自合并过滤(topCandidate.animal_id != event.animal_id)
        - 评分 / 候选池 / 入库
        ↓
[4] admin 端审核
        - 三选一:
            a. confirm: 直接绑现 animal
            b. create_new: 复制 event 字段建 Animal + 绑 event
            c. reject: 删 event(或 status=rejected)
```

---

## 5. 数据模型调整清单

### 5.1 DTO 调整(向后兼容)

| 文件 | 字段 | 类型 | 默认 | 验证 |
|------|------|------|------|------|
| `CreateAnimalDto` | `intent?: string` | `@IsOptional() @IsIn(['lost','found','unknown'])` | 不传视为 'lost' | 兼容老调用 |
| `CreateEventDto` | `intent?: string` | 同上 | 不传视为 'unknown'(老 report 行为) | 兼容老调用 |
| `CreateEventDto` | `nose_vector_id?` | 已是可选 | 不变 | 已兼容 |
| `nose.service.collect()` | nose_photo 软化 | **不再 400** | 没传则跳过向量化 | 见 §6.1 |

### 5.2 数据库 migration(为零迁移成本)

**不加 `intent` 列,只把 `event_type` 重定义**:
- 老数据 `event_type='report'` → 标记 `intent='unknown'`(行为不变)
- 新数据走 `event_type='profile_build'` 或 `'stray_sighting'` 等,**等价当前两元**
- 这样**不用做 migration**,老查询继续工作

### 5.3 entity 调整

| 文件 | 字段 | 调整 | 备注 |
|------|------|------|------|
| `animal.entity.ts` | `status: AnimalStatus` 默认值 | 改为 `@Column({ ... default: null })` 或保持 LOST 但创建路径显式覆盖 | 详见 §7.1 |
| `event.entity.ts` | — | 无变化(新字段 `intent` 不入库,只走 DTO 层) | 详见 §7.1 |

> **决策备忘**:`intent` 是否需要持久化到 DB?
> - 选项 A:不持久化,从 `event_type` 推出来 — **简单,推荐**
> - 选项 B:加 `intent` 列 — **清晰但需要 migration**
> 本架构默认 **选项 A**:`intent` 是 DTO/业务层概念,DB 仍保留 `event_type`。

---

## 6. 后端调整规范

### 6.1 软化鼻纹门槛(`nose.service.ts:164-167`)

```typescript
// 现状:强制要求
if (!dto.nose_photo) {
  throw new BadRequestException('缺少鼻纹照片');
}

// 调整:软化
const hasNose = !!dto.nose_photo;
if (!hasNose) {
  // 不抛错,跳过向量化;后续 step 不跑"鼻纹比对",
  // 走纯文本+GPS+时间匹配(MatchingService.findSimilarLostAnimalsForReport 路径)
  return {
    vector_id: null,
    confidence_score: null,
    liveness_passed: false,
    is_duplicate: false,
    matched_animal_id: null,
    similarity: null,
    next_action: 'ask_user_confirm', // 前端根据 intent 显示不同按钮
  };
}
```

### 6.2 AnimalsService.create() 不再隐式默认 `status=LOST`

```typescript
// 现状:`animals.service.ts:103`
status: AnimalStatus.LOST,

// 调整:
const statusFromDto = dto.intent === 'found' ? AnimalStatus.FOUND : AnimalStatus.LOST;
status: statusFromDto,
```

### 6.3 EventsService.create() 接收 `intent` 并影响 status / 自动建档

```typescript
// 现状:不关心 intent,任何事件都靠"先有 animal_id,后写 event"

// 调整:扫描 dto.intent
//   intent in ['lost','found']:
//     - dto.animal_id 缺失时自动 AnimalsService.create()
//     - 关联 event.animal_id
//   intent in ['stray_sighting','unknown']:
//     - 仅写 Event,animal_id=NULL,等审核
```

### 6.4 admin.process 端动作闭合(阶段 2 涉及)

```typescript
// 现状:PUT /events/:id/process body 只接 { animal_id?: string }
// 调整:body 接 { action: 'reject'|'confirm'|'merge'|'create_new', animal_id?: string }

// 'create_new' 路径:
async createAnimalFromEvent(eventId: string) {
  const event = await this.findEvent(eventId);
  const newAnimal = await this.animalService.create({
    species: event.species,
    breed: event.breed,
    color: event.color,
    gender: event.gender,
    location_lat: event.location_lat,
    location_lng: event.location_lng,
    address: event.address,
    photos: event.photos,
    nose_vector_id: event.nose_vector_id,
    intent: 'lost_or_found',  // 由 event 推导
  } as any, event.reporter_id);
  await this.eventRepo.update(eventId, {
    status: EventStatus.CONFIRMED,
    animal_id: newAnimal.animal_id,
  });
  return { animal_id: newAnimal.animal_id };
}
```

---

## 7. UI 调整规范(阶段 3 涉及,先记录边界)

### 7.1 入口收敛

| 原入口 | 调整 |
|--------|------|
| `/pages/collect` 录入页 | 保留,但在步骤 4(metadata)加 `intent: lost/found` 单选 |
| `/pages/find` 发现页 | 默认 `intent=stray_sighting`,表单与录入页共用骨架 |
| `/pages/result` 详情页 | 改"认领此动物"按钮为**两个按钮**:"我又看到这只" + "这是我的狗(申请认领)" |
| `/pages/collect/timeline` 时间轴页(新增) | `GET /v1/animals/:id/timeline` 渲染 |

### 7.2 时间轴渲染(展示层,不存数据)

```vue
<template>
  <div v-for="evt in animal.timeline" :key="evt.event_id">
    <Avatar :user="evt.reporter.avatar" />
    <div>{{ evt.reporter.nickname }} 在 {{ evt.address }} 看到了这只狗</div>
    <Photo :urls="evt.photos" />
    <time>{{ formatRelative(evt.occurred_at) }}</time>
  </div>
</template>
```

数据就是 `rescue_events.animal_id=X ORDER BY occurred_at DESC`。

---

## 8. 迁移路线 — 4 个阶段,每阶段独立可上

### 阶段 1 — 后端最小化(预计 1~2h,**向后兼容**)

| 改动点 | 文件 | 行为 |
|--------|------|------|
| `nose_photo` 软化 | `nose.service.ts:164` | 不传则跳过向量化,不抛错 |
| DTO 加 intent | `CreateAnimalDto`, `CreateEventDto` | 可选字段,默认 `'lost'` / `'unknown'` |
| AnimalsService.status 显式 | `animals.service.ts:103` | 由 `dto.intent` 决定 |
| EventsService 接收 intent | `events.service.ts:48` | `intent in ['lost','found']` 且 animal_id 缺失时自动建档 |

**验收**:
- 现有 5 个动物流程不破
- 场景 A、B、C、D 均能通过 API 走通(不依赖前端修改)
- 跑 `npm test`(现有 189 个用例 0 回归)

### 阶段 2 — admin 端动作闭合(预计 2h)

| 改动点 | 文件 |
|--------|------|
| `PUT /events/:id/process` 接 action 枚举 | `admin.controller.ts` |
| `createAnimalFromEvent` 实现 | `events.service.ts` 新方法 |
| admin 审核 modal 加 "创建新动物" 按钮 | admin 前端 |

**验收**:
- admin 拿到 candidates=空 或 fusion<阈值 的事件,可点 `create_new`
- 创建后该事件 status=confirmed,animal_id 指向新建 animal

### 阶段 3 — 前端统一表单(预计 6~8h,要做 UX 评审)

| 改动点 | 前端文件 |
|--------|---------|
| 采集页步骤 4 加 intent 单选 | `miniapp-user/pages/collect/index.vue` |
| 发现页与采集页共用表单骨架 | 抽公共组件 |
| 动物详情页"我又看到这只"按钮 | `pages/result/detail.vue` |
| 时间轴组件 | 新增 `pages/timeline/index.vue` |
| 我的上报卡片:增加"关联到动物"的入口 | `pages/my-reports/index.vue` |

**验收**(前端走回归):
- 完整 11 步流程跑通,P1-P11 全绿

### 阶段 4 — Schema 清理(预计 3h,**长期**)

| 改动点 |
|--------|
| `event.entity.ts` 加 `intent` 列(或保留 event_type 二分,做语义映射) |
| `event_type` 字段 deprecated,文档说明推荐改用 intent |
| admin / user 端有 `event_type='collect'` 历史数据的兼容查询 |

**验收**:
- 半年后老 client 全部升级到新接口
- 老数据一次性迁移完成

---

## 9. 风险与权衡

### 9.1 我做的取舍

| 权衡 | 选项 A(本架构采) | 选项 B(未采) | 取舍原因 |
|------|----------|----------|---------|
| `intent` 是否持久化 | 不持久化,从 event_type 推 | 加列 | A 零 migration,但语义混在新代码里 |
| `status` 默认 | 改为 null | 保持 LOST,创建路径覆盖 | A 让"missing status" 成为异常便于排查 |
| admin create_new | 在 events.service 里实现 | 单独 service | 暂时简化,后续如复杂再分 |
| 时间轴数据来源 | 实时查 events 表 | 新增 timeline 表 | A 简单直接,查询已能 COUNT(*) |

### 9.2 不做的事(明确剔除)

- ❌ 不重新设计 admin 后台架构(只加按钮)
- ❌ 不引入 RBAC / 复杂的 owner 鉴权(留给后续 issue)
- ❌ 不预先引入消息队列(阶段 1~2 用 setImmediate 已够)
- ❌ 不改 entities 字段(用现有 nullable 字段)
- ❌ 不破坏现有任何接口的请求/响应 schema

### 9.3 已知边界条件

- **场景 A**(无鼻纹走失)当前评分只能走纯文本+GPS,**精度低**,需要 admin 介入决策 — 这是合理代价
- **场景 C + D 共享路径**:路人上报时如果分数高(同鼻纹+同区),会自动 merge;分数低时 admin 介入
- **owner vs bystander 区别**:本架构不强调这个区分,但 Claims 表已存在,后续可加 role / verification

---

## 10. Bug 解构对照表

| Bug 编号 | 现象 | 在本架构下的归位 | 解决阶段 |
|---------|------|----------------|---------|
| BUG-001 缺"又看到这只狗"按钮 | result 页只能认领 | 时间轴抽象让"上报一次发现"成为通用能力 | 阶段 3 |
| BUG-002 未自动合并 | create 后没人调 processEvent | **已修**(setImmediate + 幂等) | — |
| BUG-003 report_count 不增长 | 事件未关联 | **已修**(同上,COUNT 自动) | — |
| BUG-004 事件不新增 | 用户前端缺 POST /events 路径 | 阶段 1 后端已通,前端阶段 3 补按钮 | 阶段 3 |
| BUG-005 self-merge | candidates 含自身 | **已修**(自合并过滤) | — |
| BUG-006 vector_similarity=0 | 字段路径错 | **已修** | — |
| BUG-007 candidates 含自身 | 同 BUG-005 | **已修** | — |
| BUG-008 文本匹配 100% | 子串匹配 + 中性值 | **已修**(textMatch 独立加权 + 中性值 0) | — |
| BUG-009 GPS similarity null | 跨区应为低非 null | (P2,不在本架构范围) | — |
| BUG-010 GPS distance 错误 | Haversine 计算 | (P2,独立修) | — |
| BUG-011 默认值覆盖 | 表单"未知"被默认值吞 | (P2,DTO 显式语义,非本架构核心) | — |
| BUG-012 POI 无虹口 | location-box 数据源 | (P3) | — |
| BUG-013 流程不统一 | 采集 / 发现本质同一动作 | **本架构直接吞** | 阶段 1 后端 + 阶段 3 前端 |
| BUG-014 admin 无 create_new | 审核端动作集合不闭合 | 阶段 2 | 阶段 2 |
| BUG-015 无法自动标 found | DTO 无 intent | 阶段 1 显式 status | 阶段 1 |
| BUG-016 candidates 自展示 | UI 残留 | 后端 candidates 不变(本架构不动),UI filter 阶段 3 顺手做 | 阶段 3 |
| OPT-001 列表图不显示 | :src 未绑 | (P3,独立) | — |

**总结**:
- 5 个 P0 **已修**(BUG-002/003/005/006/007/008)
- 本架构目标:5 个 P1(001/004/013/014/015)+ 1 个 P2(016)-展示侧,**全部进本架构处理**
- 不在本架构范围:BUG-009/010/011/012 + OPT-001 共 5 个零碎 P2/P3,独立处理

---

## 11. 开放问题(待用户决策)

| 编号 | 问题 | 影响阶段 | 推荐决策 |
|------|------|---------|---------|
| Q1 | 场景 A(无鼻纹走失)创建后,系统**默认 status** 应该是什么?丢失精度 vs 数据完整性 | 阶段 1 | 默认 `lost`,主人 / admin 可改 |
| Q2 | `intent` 是否需要持久化到 DB? | 阶段 4 | 选 A:不持久化,从 `event_type` 推 |
| Q3 | "我又看到这只" 按钮 / 详情页"上报一次发现",是否要求已登录用户? | 阶段 3 | 强制登录(免骚扰,避免匿名刷) |
| Q4 | admin 创建新动物时,是否强制要求 reporter_id 真实存在? | 阶段 2 | 沿用 event.reporter_id,不重复要求 |
| Q5 | 同一 animal 被多 owner 同时申请认领时,优先级? | 后续 | 留给 Claims 模块 |
| Q6 | 阶段 1 实施时,是先全量上,还是保留老 `event_type` 行为一段时间? | 阶段 1 | 全量上(向后兼容,无新代码) |

---

## 12. 验收标准(每阶段独立)

### 阶段 1
- [ ] `nose_photo` 缺失不抛 400,而是返回 `next_action='ask_user_confirm'`
- [ ] `intent` 缺省时 `CreateAnimalDto.status=lost`,`intent='found'` 时 `status=found`
- [ ] `POST /v1/events` body 加 `intent` 字段被 EventsService 接收,老调用方不需要改
- [ ] `intent in ['lost','found']` 且 animal_id 缺失时,后端自动建档并关联事件
- [ ] `npm test` 仍 189/189,无回归

### 阶段 2
- [ ] admin `PUT /events/:id/process` body 接 action 枚举
- [ ] action='create_new' 时,从 event 字段创建 Animal + 关联 event.animal_id + event.status=confirmed
- [ ] action='confirm'/'merge'/'reject' 行为不变

### 阶段 3
- [ ] P1-P11 全绿
- [ ] 场景 A 端到端在 user 端走通(无鼻纹走失建档)
- [ ] 任意动物详情页可点"我又看到这只"生成一条事件
- [ ] 时间轴视图渲染多 reporter + 多次 observed

### 阶段 4
- [ ] 老 `event_type='collect'/'report'` 数据无丢失
- [ ] admin / user 端 `intent` 字段可见、可筛选

---

## 13. 实施前后顺序的建议

**用户决策原则**:每阶段独立评审,每阶段独立可上,且向后兼容。所以可以:

- 现在不动代码,让团队评审本文档 1~2 天
- 阶段 1 先做(2h,无破坏)
- 阶段 2 等 1 上线后做(2h,无破坏)
- 阶段 3 让前端团队评估工作量后做
- 阶段 4 半年后再考虑

**不建议**的路径:
- 直接跳到阶段 3 前端统一 → 后端语义没对齐前动手会反复
- 跳过阶段 1 直接做阶段 2 → admin create_new 拿到的 event 没有 intent 字段,创建后 status 默认 lost 会再触发 BUG-015

---

## 14. 关联文档

- **测试报告** [2026-07-06-manual-test-pic-flow.md](2026-07-06-manual-test-pic-flow.md)
- **Bug 总结** [2026-07-06-bugs-collected.md](2026-07-06-bugs-collected.md)
- **16 个 issue 索引** [issues/2026-07-06/README.md](issues/2026-07-06/README.md)
- **根因联合分析**(对话内文档,尚未存档): 三个根因——流程分叉 / AI 评分管线分叉 / 写入-处理断链
- **E2E 测试清单** [2026-07-06-manual-test-checklist.md](2026-07-06-manual-test-checklist.md)

---

## 15. 改 changelog

| 时间 | 版本 | 备注 |
|------|------|------|
| 2026-07-06 | v0.1 初稿 | 由"16 bug 联合分析 + 4 场景回放"驱动产出 |
| — | v0.2 | (待)团队评审意见合并 |
| — | v1.0 | (待)阶段 1 实施后冻结 |

---

> **本文档目的**:不在今天、明天、这周动手。这是一份**契约**——团队评审后,阶段 1 是无破坏可上,后面每阶段独立推进。任何对 16 bug 的修复方案,应先对本文档 §10 表"在本架构下的归位"做对照,再决定动手范围。
