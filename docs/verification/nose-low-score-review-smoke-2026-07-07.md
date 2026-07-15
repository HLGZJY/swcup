# 冒烟测试报告 — 低分鼻纹人工审核功能

> 日期: 2026-07-07 20:50 CST
> 项目: 鼻纹智救 (中国软件杯)
> 功能: 用户采集鼻纹相似度 < 0.75 → 入 `pending_nose_records` → Admin 人工审核
> 测试范围: T1 (后端) + T2 (前端)
> 测试者: Claude Code (subagent-driven-development)

---

## 1. 部署 / 启动状态

| 服务 | 端口 | 状态 |
|---|---|---|
| MySQL | 3307 | ✅ 运行中 |
| ai-service (FastAPI) | 8000 | ✅ 运行中 |
| backend (NestJS) | 3000 | ✅ 运行中 (PID 17412,启动后日志 `Nest application successfully started`) |

**冲突排查**: 旧会话遗留 node.exe (PID 23288) 占着端口 3000,杀掉后新 backend 顺利启动。`.env` 仍为 `PORT=3000`(跟主仓库保持一致,worktree 没改 .env)。

---

## 2. DDL 自动同步验证

测试前 step:`typeorm synchronize: true` 应在 backend 启动时自动建表。

**结果**: ✅ 表已存在,字段类型跟 spec 字节级一致。

```sql
DESCRIBE pending_nose_records;
```

| 字段 | 类型 | 可空 | 默认 |
|---|---|---|---|
| record_id | varchar(36) | NO | (PK) |
| vector_id | varchar(36) | NO | |
| collector_id | varchar(36) | NO | |
| fusion_score | decimal(5,4) | YES | NULL |
| vector_similarity | decimal(5,4) | YES | NULL |
| gps_similarity | decimal(5,4) | YES | NULL |
| text_match_rate | decimal(5,4) | YES | NULL |
| status | enum('pending','approved_new','approved_dup','rejected') | NO | pending |
| animal_id | varchar(36) | YES | NULL |
| reviewed_by | varchar(36) | YES | NULL |
| reviewed_at | datetime | YES | NULL |
| location_lat | decimal(10,8) | YES | NULL |
| location_lng | decimal(11,8) | YES | NULL |
| breed/color/gender/species | varchar | YES | NULL |
| nose_photo_url/body_photo_url | varchar(255) | YES | NULL |
| created_at | datetime(6) | NO | CURRENT_TIMESTAMP(6) |

---

## 3. API 端点注册

backend 启动日志显示 5 条新路由全部 `Mapped`:

```
Mapped {/admin/pending-nose-records, GET}                                   (version: 1)
Mapped {/admin/pending-nose-records/:record_id, GET}                        (version: 1)
Mapped {/admin/pending-nose-records/:record_id/approve-as-new, POST}        (version: 1)
Mapped {/admin/pending-nose-records/:record_id/approve-as-duplicate, POST}  (version: 1)
Mapped {/admin/pending-nose-records/:record_id/reject, POST}                (version: 1)
```

类级守卫 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')` 已覆盖所有 5 条路由。

---

## 4. 冒烟测试 10 项 — 全过 ✅

**测试账号**: admin / 13900000088 / test1234

**Seed 数据**: 直接 SQL 注入 3 条 `pending_nose_records`(绕过 AI service,以稳定测后端):

```sql
INSERT INTO pending_nose_records (record_id, vector_id, collector_id, vector_similarity, status, location_lat, location_lng, breed, color, gender, species)
VALUES
  ('smoke-r1','smoke-v1','13800000020',0.45,'pending',39.90420000,116.40740000,'中华田园犬','黄色','male','dog'),
  ('smoke-r2','smoke-v2','13800000021',0.40,'pending',39.90500000,116.40800000,'柴犬','白色','female','dog'),
  ('smoke-r3','smoke-v3','13800000022',0.30,'pending',39.90600000,116.40900000,'柯基','棕色','male','dog');
```

| # | 步骤 | 期望 | 实测 | 结果 |
|---|------|------|------|------|
| 1 | POST /v1/auth/login (admin) | JWT 长度 > 100 | 213 chars | ✅ |
| 2 | seed r1/r2/r3 | 3 rows | 完成 | ✅ |
| 3 | GET /v1/admin/pending-nose-records?status=pending&limit=5 | total=3, list 包含 r1/r2/r3 | total=3, ids=[r1,r2,r3] | ✅ |
| 4 | GET /v1/admin/pending-nose-records/smoke-r1 | 返回 record 详情 | record_id=smoke-r1, status=pending, breed="中华田园犬" | ✅ |
| 5a | POST /v1/admin/pending-nose-records/smoke-r1/approve-as-new (body: species/breed/color/gender/address) | code:0, 返回 animal_id, status:approved_new | animal_id=d30a88a6..., status=approved_new | ✅ |
| 5b | POST /v1/admin/pending-nose-records/smoke-r2/approve-as-duplicate (body: animal_id = 5a 新建动物) | code:0, status:approved_dup, animal_id 同上 | 完全一致 | ✅ |
| 5c | POST /v1/admin/pending-nose-records/smoke-r3/reject | code:0, status:rejected | 完全一致 | ✅ |
| 6 | DB 校验 | r1=approved_new+r2=approved_dup+r3=rejected, animal.status=found, primary_nose_id=smoke-v1 | 完全一致 | ✅ |
| 7 | 重复审批 r1 → 应 400 | HTTP 400 + 状态消息 | **HTTP 400** + `"record 当前状态为 approved_new, 不可重复审批"` | ✅ |
| 8 | GET 不存在 record → 应 404 | HTTP 404 | **HTTP 404** + `"PendingNoseRecord not found"` | ✅ |
| 9 | 老接口回归 (GET /v1/admin/animals) | 仍可用 | code:0, total:3 | ✅ |
| 10 | 无 JWT → 应 401 | HTTP 401 | **HTTP 401** + `"未登录"` | ✅ |
| 11 | user1 JWT 调 admin 接口 → 应 403 (RolesGuard) | HTTP 403 | **HTTP 403** + `"Forbidden resource"` | ✅ |

---

## 5. 关键行为观察

### 5a 事务边界确认(approve-as-new)
- 创建 Animal + 更新 PendingNoseRecord 必须在同一事务
- 验证:`smoke-r1` 的 `vector_id=smoke-v1`,新建 Animal 的 `primary_nose_id=smoke-v1` ✅
- `reviewed_by` = admin 登录用户的 `user_id` (278e1d88-9e72...) 透传成功 ✅

### 5b approve-as-duplicate 状态机
- `approve-as-duplicate` 后 Animal.status 变化:本测试动物已是 `found` (被 5a 建成 found),无 lost→found 转换可观察,但实现逻辑里 `if animal.status === 'lost'` 才更新,符合需求。

### 5c 状态机守卫
- 3 个 mutation 方法都有 `if (record.status !== 'pending') throw BadRequestException` 检查
- 测试 7 已验证二次审批被拒

### 5d Auth + Role 守卫
- 测试 10 验证 JwtAuthGuard(无 token → 401)
- 测试 11 验证 RolesGuard:user1 (13800000002, role=user) JWT 调 `/v1/admin/pending-nose-records` → **HTTP 403** `"Forbidden resource"`

---

## 6. 未覆盖项(后续)

1. **AI service 实际触发**: T1 改动是 `LOW_SCORE_THRESHOLD = 0.75`,但 AI service 实际能给出的 cosine 值范围未测(可能随机或 1.0 左右)。建议用真实图片跑一遍,确认 < 0.75 的判定确实会触发。
2. **Admin Web UI**: 仅 5 条 API 后端完成,Web 管理端 / 小程序管理端的"待审核列表"页面尚未实现(T2 只做了用户端 under_review 拦截)。
3. **MiniApp user `api.js` BASE_URL 仍是 3000**:worktree 与主仓库一致(本报告 §1 提到的 `PORT=3000`)。前端 真机调试需确保服务端口对齐,不在本次 PR 范围。

## 7. 后续 commit (`7bbb9eb`)

合并前补的最后一刀:
- `admin.service.ts` line 409-410 的 `?? 0` 静默 null→0 改为抛 `BadRequestException`(缺失坐标数据完整性问题)
- 3 文件加 trailing newline (`pending-nose-record.entity.ts`, `admin.service.spec.ts`, `nose.service.spec.ts`)
- 237/237 jest 测试仍然全过

---

## 7. 验收建议

建议项目合并 `fix/stage3-bugs` 到 `main` 之前,补以下一项:
- [ ] Admin Web UI 调用 5 条新接口,实际点击"通过为新动物" 看 UI 流程
- [ ] MiniApp 模拟器实际触发低分采集,看到"鼻纹审核中" 弹窗

技术债跟踪:
- T1 commit `0561705` (feature) + `ca3498c` (entity 注册修复)
- T2 commit `824d298` (用户端 UI)
- 都在 `fix/stage3-bugs` 分支
