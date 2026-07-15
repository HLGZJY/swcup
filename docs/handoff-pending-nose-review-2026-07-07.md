# 交接文档：低分鼻纹人工审核功能

> 交接时间：2026-07-07
> 项目：鼻纹智救 / 中国软件杯
> 交接人：Hermes Agent (Nous Research)
> 接收人：接手开发人员

---

## 一、需求背景

**目标**：用户采集鼻纹时，若比对分数低于阈值（向量相似度 < 0.75），不允许用户直接新建动物记录，而是生成一条「待审核记录」交给 Admin 人工判断。

**正确业务流程**：

`
用户采集鼻纹
    计算向量相似度
    < 0.75（低分）
    生成 PendingNoseRecord（status=pending），返回 next_action=under_review
    用户端提示"正在审核中"
    Admin 端列表查看
    Admin 操作：确认为新动物 / 确认为已有动物 / 拒绝
    审核通过后：创建或关联 Animal，记录归档
`

---

## 二、已完成部分

### 2.1 已新增文件

#### backend/src/nose/entities/pending-nose-record.entity.ts
新的数据库实体，存储低分待审核鼻纹记录。

关键字段：
- record_id（主键，UUID）
- vector_id（关联的鼻纹向量 ID）
- collector_id（采集用户 ID）
- fusion_score（融合分数，collect 阶段为 null，compare 阶段补全）
- vector_similarity（向量相似度，collect 阶段记录）
- gps_similarity（GPS 相似度，compare 阶段补全）
- text_match_rate（文本匹配度，compare 阶段补全）
- status（pending / approved_new / approved_dup / rejected）
- animal_id（审核通过后关联的动物 ID）
- species/breed/color/gender/location_lat/lng（采集时填写的动物信息和坐标）

#### backend/src/nose/nose.module.ts
已修改：新增 PendingNoseRecord 到 TypeOrmModule.forFeature，导出 NoseService。

---

### 2.2 已修改文件

#### backend/src/nose/nose.service.ts
**改动位置**：collect() 方法的 Step 6 块（原 return ask_user_create 处）

**改动逻辑**：
- 向量相似度 < 0.75（或 bestMatch === null）
  → 创建 PendingNoseRecord（status=pending）
  → 返回 next_action=under_review
- 向量相似度 >= 0.75
  → 原有逻辑不变（return next_action=ask_user_create）

**关键阈值**：LOW_SCORE_THRESHOLD = 0.75（硬编码在 Step 6 内）

**前端影响**：前端收到 next_action=under_review 时需展示「审核中」状态，不展示新建动物按钮。

**injector 改动**：
- 新增 import: PendingNoseRecord
- constructor 新增：InjectRepository(PendingNoseRecord) private readonly pendingRepo

---

#### backend/src/admin/admin.service.ts
已新增 4 个方法：

| 方法 | 说明 |
|------|------|
| getPendingNoseRecords(query) | 分页查询待审核列表，支持按 status 过滤 |
| getPendingNoseRecordDetail(record_id) | 查询单条详情 |
| approvePendingNoseAsNew(record_id, admin_id, dto) | 审核通过，新建 Animal（status=found） |
| approvePendingNoseAsDuplicate(record_id, animal_id, admin_id) | 审核通过，关联已有 Animal（lost→found） |
| rejectPendingNoseRecord(record_id, admin_id) | 审核拒绝 |

**approve-as-new 逻辑**：创建 Animal（status=found），关联 primary_nose_id=record.vector_id，更新 PendingNoseRecord（status=approved_new）。

**approve-as-duplicate 逻辑**：若目标 Animal status=lost，改为 found；更新 PendingNoseRecord（status=approved_dup）。

**注意**：这 4 个方法已写好逻辑，但 AdminController 中尚未绑定路由。

---

## 三、待完成部分

### 3.1 Admin Controller 路由绑定（backend/src/admin/admin.controller.ts）

新增以下 5 个路由：

`	ypescript
// GET /admin/pending-nose-records
// Query: ?status=pending&page=1&limit=20
// 返回: { total: number, list: PendingNoseRecord[] }
@Get('pending-nose-records')
async getPendingNoseRecords(@Query() query) {
  return this.adminService.getPendingNoseRecords(query);
}

// GET /admin/pending-nose-records/:record_id
@Get('pending-nose-records/:record_id')
async getPendingNoseRecordDetail(@Param('record_id') record_id: string) {
  return this.adminService.getPendingNoseRecordDetail(record_id);
}

// POST /admin/pending-nose-records/:record_id/approve-as-new
// Body: { species?: string, breed?: string, color?: string, gender?: string, address?: string, photos?: string[] }
@Post('pending-nose-records/:record_id/approve-as-new')
async approveAsNew(@Param('record_id') record_id: string, @Body() dto: any, @Request() req) {
  const admin_id = req.user?.user_id || 'system';
  return this.adminService.approvePendingNoseAsNew(record_id, admin_id, dto);
}

// POST /admin/pending-nose-records/:record_id/approve-as-duplicate
// Body: { animal_id: string }
@Post('pending-nose-records/:record_id/approve-as-duplicate')
async approveAsDuplicate(@Param('record_id') record_id: string, @Body() body: { animal_id: string }, @Request() req) {
  const admin_id = req.user?.user_id || 'system';
  return this.adminService.approvePendingNoseAsDuplicate(record_id, body.animal_id, admin_id);
}

// POST /admin/pending-nose-records/:record_id/reject
@Post('pending-nose-records/:record_id/reject')
async reject(@Param('record_id') record_id: string, @Request() req) {
  const admin_id = req.user?.user_id || 'system';
  return this.adminService.rejectPendingNoseRecord(record_id, admin_id);
}
`

**AdminModule 依赖**：确认 NoseModule 已 exports NoseService，或在 AdminModule 中 imports NoseModule。

---

### 3.2 前端改动（用户端 MiniApp）

**文件**：miniapp-user/src 相关页面

在鼻纹采集结果页识别 next_action === 'under_review'：

`javascript
if (result.next_action === 'under_review') {
  // 展示"鼻纹质量偏低，已提交人工审核，请等待 Admin 确认"
  // 不展示"新建动物档案"按钮
} else if (result.next_action === 'ask_user_create') {
  // 原有逻辑
}
`

---

### 3.3 Admin 前端页面（可选）

新增审核列表页面，调用上述 5 个 API。

---

### 3.4 数据库迁移

**SQL DDL**：

`sql
CREATE TABLE pending_nose_records (
  record_id         VARCHAR(36) PRIMARY KEY,
  vector_id         VARCHAR(36) NOT NULL,
  collector_id      VARCHAR(36) NOT NULL,
  fusion_score      DECIMAL(5,4) NULL,
  vector_similarity DECIMAL(5,4) NULL,
  gps_similarity    DECIMAL(5,4) NULL,
  text_match_rate   DECIMAL(5,4) NULL,
  status            ENUM('pending','approved_new','approved_dup','rejected') DEFAULT 'pending',
  animal_id         VARCHAR(36) NULL,
  reviewed_by       VARCHAR(36) NULL,
  reviewed_at       DATETIME NULL,
  location_lat      DECIMAL(10,8) NULL,
  location_lng      DECIMAL(11,8) NULL,
  breed             VARCHAR(50) NULL,
  color             VARCHAR(50) NULL,
  gender            VARCHAR(20) NULL,
  species           VARCHAR(50) NULL,
  nose_photo_url    VARCHAR(255) NULL,
  body_photo_url    VARCHAR(255) NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
`

若 TypeORM synchronize=true，直接启动后端即可自动建表。

---

## 四、技术决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 阈值 | 硬编码 0.75 | 后续可移至 process.env.NOSE_LOW_SCORE_THRESHOLD |
| 分数字段 | collect 阶段记录 vector_similarity，compare 阶段补全 fusion_score | 采集时无 GPS/文本 |
| 审核操作 | 事务包裹 approve-as-new | 确保原子性 |
| 状态变更 | approve-as-duplicate 时 lost→found | 与现有事件处理逻辑一致 |

---

## 五、已知风险点

1. nose.service.ts 使用了 as any 断言绕过类型检查，建议后续补全泛型
2. 阈值 0.75 未经实测验证，建议测试阶段用真实数据做 ROC 曲线选最优值
3. 前端 under_review UI 尚未实现

---

## 六、文件清单

`
已完成修改（3个）:
  backend/src/nose/nose.service.ts          Step6拦截逻辑已注入
  backend/src/nose/nose.module.ts           PendingNoseRecord import已添加
  backend/src/admin/admin.service.ts         4个审核方法已添加

已完成新增（1个）:
  backend/src/nose/entities/pending-nose-record.entity.ts  新增

待完成（3个）:
  backend/src/admin/admin.controller.ts       新增5个路由
  backend/src/admin/admin.module.ts          import NoseModule检查
  miniapp-user/src/.../result.vue             前端under_review UI
`

---

## 七、快速验证步骤

1. 启动后端：cd backend && npm run start:dev
2. 发送低分采集请求（向量相似度必然 < 0.75）：
   curl -X POST http://localhost:3000/nose/collect -H "Content-Type: application/json" -d "{\"image_base64\":\"<placeholder>\",\"user_id\":\"u1\",\"species\":\"dog\"}"
   期望返回：next_action: "under_review"
3. 检查数据库：SELECT * FROM pending_nose_records WHERE status='pending' LIMIT 1
4. 调用 Admin API：
   curl http://localhost:3000/admin/pending-nose-records
   curl -X POST http://localhost:3000/admin/pending-nose-records/<record_id>/approve-as-new -H "Content-Type: application/json" -d "{\"species\":\"dog\",\"breed\":\"中华田园犬\"}"
5. 验证：pending_nose_records.status 应为 approved_new，animals 表有新记录