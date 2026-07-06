# 附录 TEST-PLAN — 鼻纹智救 验收测试用例

> **目的**：在大赛评委验收时，提供可执行的验证清单。
> **测试类型**：单元测试 + 集成测试 + 端到端测试 + AI 模型评测 + 用户验收
> **覆盖率目标**：≥ 80%（业务逻辑层）
> **文档版本**：v1.0（2026-06-13）

---

## 0. 测试矩阵总览

| 测试类别 | 用例数 | 执行方式 | 通过标准 |
|---------|--------|---------|---------|
| 单元测试 | ~30 | `npm test` / `pytest` | 全部通过 |
| API 集成测试 | 20 | `curl` / Postman | 全部通过 |
| AI 模型评测 | 5 | `evaluate_*.py` | 指标达预期 |
| 端到端业务 | 10 | 真实小程序操作 | 全部通过 |
| 性能压测 | 3 | `wrk` / `ab` | P95 < 1s |
| 安全测试 | 5 | 手工 + 工具 | 无高危漏洞 |
| **合计** | **~73** | - | **100% 通过** |

---

## 1. AI 模型评测（5 用例）⭐ 核心

### TC-AI-001：鼻纹同犬相似度

**目的**：验证模型对同一只狗的不同照片能提取相似向量。

**步骤**：
```bash
cd ai-service
python -m src.scripts.evaluate_nose \
  --model weights/nose_v3_sgd.pth \
  --data dir_train/dir_train
```

**预期**：
- 同犬相似度均值 `same_dog_sim > 0.80`
- 输出格式：`Epoch [Eval]: same_dog_sim=0.85xx`

### TC-AI-002：鼻纹异犬相似度

**目的**：验证模型对不同狗的照片能区分。

**预期**：
- 异犬相似度均值 `diff_dog_sim < 0.50`

### TC-AI-003：Recall@1

**目的**：验证 Top-1 检索准确率。

**预期**：
- `recall@1 ≥ 90%`

### TC-AI-004：品种分类 Top-1

**步骤**：
```bash
python -m src.scripts.evaluate_breed \
  --model weights/breed_classifier_v3.pth \
  --data oxford_pets_split/test
```

**预期**：
- Oxford Pets 子集 Top-1 ≥ 85%
- Top-3 ≥ 95%

### TC-AI-005：清晰度检测

**步骤**：
```bash
curl -X POST http://localhost:8000/v1/nose/detect \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"<clear_image>\"}"
```

**预期**：
- 清晰图：`blur_score > 50, 30 < brightness < 220`
- 模糊图：`blur_score < 50`
- 过暗图：`brightness < 30`

---

## 2. API 集成测试（20 用例）

### TC-API-001 ~ 006：Auth 模块

| 用例 | 请求 | 预期响应 |
|------|------|---------|
| 001 注册 | POST /v1/auth/register | 201 + user_id |
| 002 登录（正确密码）| POST /v1/auth/login | 200 + token |
| 003 登录（错误密码）| POST /v1/auth/login | 401 |
| 004 发送验证码 | POST /v1/auth/send-code | 200 |
| 005 验证码登录 | POST /v1/auth/login {code: "888888"} | 200 |
| 006 重置密码 | POST /v1/auth/reset-password | 200 |

### TC-API-007 ~ 008：Users 模块

| 用例 | 请求 | 预期响应 |
|------|------|---------|
| 007 获取我的资料 | GET /v1/users/me (with token) | 200 + user |
| 008 修改我的资料 | PATCH /v1/users/me | 200 |

### TC-API-009 ~ 014：Animals 模块

| 用例 | 请求 | 预期响应 |
|------|------|---------|
| 009 列表（公开）| GET /v1/animals | 200 + animals[] |
| 010 详情 | GET /v1/animals/:id | 200 + animal |
| 011 创建（admin）| POST /v1/animals (admin) | 201 |
| 012 创建（普通用户）| POST /v1/animals | 403 |
| 013 编辑 | PUT /v1/animals/:id | 200 |
| 014 删除 | DELETE /v1/animals/:id | 204 |

### TC-API-015 ~ 017：Nose 模块

| 用例 | 请求 | 预期响应 |
|------|------|---------|
| 015 鼻纹采集 | POST /v1/nose/events/collect | 200 + next_action |
| 016 鼻纹比对 | POST /v1/nose/compare | 200 + cosine_sim |
| 017 品种识别 | POST /v1/nose/classify | 200 + top3 |

### TC-API-018 ~ 020：Events + Claims

| 用例 | 请求 | 预期响应 |
|------|------|---------|
| 018 创建事件 | POST /v1/nose/events/report | 201 |
| 019 我的事件 | GET /v1/nose/events/my | 200 |
| 020 申请认领 | POST /v1/claims | 201 |

---

## 3. 端到端业务测试（10 用例）⭐ 核心

### TC-E2E-001：完整采集流程

**步骤**：
1. 打开用户端小程序 → 首页
2. 点击"鼻纹采集"
3. 系统调 wx.getLocation 拿 GPS
4. 系统实时调 /v1/nose/detect 显示清晰度
5. 点击拍照
6. 系统调 /v1/nose/extract 拿向量
7. 系统调 /v1/nose/events/collect 算融合
8. 显示结果页（含 next_action）

**预期**：
- 全流程 ≤ 5 秒（含 Loading）
- 结果页显示融合分 ≥ 0.88 或 0.75-0.88 或 < 0.75

### TC-E2E-002：完整上报流程

**步骤**：
1. 打开用户端 → "发现上报"
2. 填 7 字段（品种/颜色/体型/耳型/尾型/性别/GPS）
3. 提交
4. 系统返回 next_action
5. 用户选择"是这只"或"不是这只"
6. 跳转到对应详情页

**预期**：
- 提交响应 ≤ 2 秒
- 匹配结果显示在弹窗中

### TC-E2E-003：完整认领流程

**步骤**：
1. 用户在动物详情页点击"申请认领"
2. 填写 5 个字段（姓名/身份证/居住城市/详细地址/养宠经验）
3. 提交申请
4. 管理员在管理端看到"待审核"
5. 审核通过
6. Animal.status 变为 claimed
7. Claim.status 变为 approved

**预期**：
- 状态变化在 ≤ 1 秒内反映到两端

### TC-E2E-004：管理员审核（自动建档）

**步骤**：
1. 用户提交"目击上报"事件（无鼻纹）
2. 管理员在审核详情页看到事件
3. 管理员点击"通过"（未关联档案）
4. 系统自动创建 Animal 档案
5. 事件.animal_id 自动关联到新建档案

**预期**：
- 验证：SELECT * FROM animal WHERE created_at = event.confirmed_at 应有 1 条新记录

### TC-E2E-005：JWT 鉴权

**步骤**：
1. 不带 token 调用 GET /v1/users/me
2. 期望 401 Unauthorized
3. 带过期 token 调用
4. 期望 401 + "token expired"
5. 带 admin token 调用普通用户接口
6. 期望 200（admin 可访问所有接口）

### TC-E2E-006：响应格式统一

**步骤**：
1. 任意成功请求
2. 期望响应形如：`{"code":0,"message":"success","data":...}`
3. 任意失败请求
4. 期望响应形如：`{"code":4xx/5xx,"message":"...","data":null}`

### TC-E2E-007：跨域 CORS

**步骤**：
1. 从 `https://admin.example.com` 调用 API
2. 期望 OPTIONS 预检通过
3. 实际 GET /v1/animals
4. 期望正常返回

### TC-E2E-008：图片上传

**步骤**：
1. POST /v1/upload (multipart/form-data)
2. 期望返回 URL
3. GET 该 URL
4. 期望返回图片

### TC-E2E-009：分页

**步骤**：
1. GET /v1/animals?page=1&limit=10
2. 期望返回 10 条 + total 字段
3. GET /v1/animals?page=2&limit=10
4. 期望返回下 10 条

### TC-E2E-010：错误恢复

**步骤**：
1. 后端服务停止
2. 前端调用 API
3. 期望前端显示"网络异常"+ "重试"按钮
4. 后端服务恢复
5. 前端点击"重试"
6. 期望恢复正常

---

## 4. 性能测试（3 用例）

### TC-PERF-001：单端点 P95 响应

**工具**：`wrk` 或 `ab`

```bash
# 100 并发，持续 30 秒
wrk -t10 -c100 -d30s http://localhost:3000/v1/animals
```

**预期**：
- P50 < 50ms
- P95 < 200ms
- P99 < 500ms

### TC-PERF-002：AI 推理 P95

```bash
wrk -t10 -c50 -d30s -s post_ai.lua http://localhost:8000/v1/nose/extract
```

**预期**：
- P95 < 500ms（CPU 推理）
- P95 < 100ms（GPU 推理）

### TC-PERF-003：并发采集压测

**模拟**：50 个用户同时采集

```bash
# 伪代码：用 locust
locust -f locustfile.py --users 50 --spawn-rate 10 -t 60s
```

**预期**：
- 端到端 P95 < 2s
- 错误率 < 1%

---

## 5. 安全测试（5 用例）

### TC-SEC-001：SQL 注入

**步骤**：
```bash
curl "http://localhost:3000/v1/animals?id=1' OR '1'='1"
```

**预期**：
- 不返回额外数据
- 日志记录可疑请求

### TC-SEC-002：XSS 防护

**步骤**：
```bash
# 提交含 <script> 的字段
curl -X POST http://localhost:3000/v1/auth/register \
  -d '{"nickname":"<script>alert(1)</script>"}'
```

**预期**：
- 数据存储原样（不渲染）
- 前端显示时已转义

### TC-SEC-003：JWT 伪造

**步骤**：
```bash
# 用伪造的 token 调用
curl -H "Authorization: Bearer fake.token.here" \
  http://localhost:3000/v1/users/me
```

**预期**：
- 返回 401 Unauthorized

### TC-SEC-004：密码强度

**步骤**：
- 注册时使用弱密码如 "123456"

**预期**：
- 后端校验失败，返回 400 "密码强度不足"

### TC-SEC-005：手机号脱敏

**步骤**：
- 登录后调用 GET /v1/users/me

**预期**：
- 响应中 phone 字段形如 `138****5678`

---

## 6. 兼容性测试

### TC-COMPAT-001：小程序多端

| 平台 | 验证项 |
|------|--------|
| 微信小程序 | iOS + Android 真机 |
| 支付宝小程序（可选）| 真机 |
| H5（可选）| Chrome / Safari |

### TC-COMPAT-002：浏览器（管理端 Web）

| 浏览器 | 版本 |
|--------|------|
| Chrome | ≥ 100 |
| Edge | ≥ 100 |
| Safari | ≥ 14 |
| Firefox | ≥ 90 |

### TC-COMPAT-003：API 多客户端

| 客户端 | 验证 |
|--------|------|
| curl | ✅ |
| Postman | ✅ |
| Python requests | ✅ |
| JS axios | ✅ |

---

## 7. 回归测试（提交前必跑）

按以下顺序执行，确保所有改动未破坏现有功能：

```bash
# 1. 后端单元测试
cd backend && npm test

# 2. 后端 lint
npm run lint

# 3. AI 服务单元测试（如有）
cd ../ai-service && pytest

# 4. AI 评测（关键指标）
python -m src.scripts.evaluate_nose --model weights/nose_v3_sgd.pth --data dir_train/dir_train
python -m src.scripts.evaluate_breed --model weights/breed_classifier_v3.pth --data oxford_pets_split/test

# 5. 端到端冒烟测试（10 用例 TC-E2E-*）

# 6. 性能压测（3 用例 TC-PERF-*）
```

**通过标准**：
- 单元测试 100% 通过
- AI 评测指标达预期（同犬 > 0.80，异犬 < 0.50，Recall@1 ≥ 90%）
- E2E 全部通过
- P95 响应 < 1s

---

## 8. 测试数据准备

### 8.1 测试账号

| 角色 | 手机号 | 密码 | 用途 |
|------|--------|------|------|
| admin | 13800000001 | admin123 | 管理端登录 |
| org | 13800000002 | org123 | 救助站账号 |
| user | 13800000003 | user123 | 普通用户 |
| user2 | 13800000004 | user123 | 测试重复救助 |

执行 `cd backend && npm run seed` 自动创建。

### 8.2 测试动物档案

| ID | 品种 | 状态 | GPS |
|----|------|------|-----|
| ANM-2026-0001 | 柴犬 | lost | (116.40, 39.90) |
| ANM-2026-0002 | 金毛 | found | (116.41, 39.91) |
| ANM-2026-0003 | 田园犬 | claimed | (116.39, 39.92) |

### 8.3 测试图片

每只档案准备 3-4 张鼻纹图（路径：`backend/uploads/test/`）。

---

## 9. 验收 Checklist（D-Day）

提交当天（2026-06-30）按此清单逐项打勾：

- [ ] 后端服务启动（< 30 秒）
- [ ] AI 服务启动（< 30 秒）
- [ ] MySQL 连接正常
- [ ] Swagger UI 可访问（`/api-docs`）
- [ ] Swagger UI 可访问（`/docs`）
- [ ] 登录接口返回 token
- [ ] 鼻纹提取返回 512 维向量
- [ ] 完整采集流程跑通
- [ ] 完整上报流程跑通
- [ ] 完整认领流程跑通
- [ ] 单元测试通过
- [ ] AI 评测指标达预期
- [ ] P95 响应 < 1s
- [ ] 9 份文档 + 2 份附录完整
- [ ] 演示视频 mp4 可播放
- [ ] 提交包大小合理（< 500 MB）

### 多部位颜色取色器 v2

- [ ] TC-PICK-001: 进入 picker 显示 7 个部位标签（vitest: color-picker.spec.ts 通过）
- [ ] TC-PICK-002: 切"背脊" + 点照片 → 色卡写入（E2E 微信开发者工具实跑）
- [ ] TC-PICK-003: 切"腹部" + 点照片 → 第二个色卡
- [ ] TC-PICK-004: 点已采部位 → 弹"覆盖？"modal → 取消/确认
- [ ] TC-PICK-005: 切照片再切回 → cursor 位置保留
- [ ] TC-PICK-006: 采满 5 → "完成"激活
- [ ] TC-PICK-007: 采 4 → "完成" disabled
- [ ] TC-PICK-008: step 4 → 概览色 + 展开 7 部位
- [ ] TC-PICK-009: 提交带 5 个 body_colors → 后端 200

### 自动化覆盖

- [ ] PhotoCanvas matchNearestColor 10 用例通过 (vitest)
- [ ] PartTabs 6 用例通过 (vitest)
- [ ] ColorPicker 容器 11 用例通过 (vitest)
- [ ] SamplePreview 6 用例通过 (vitest)
- [ ] 取色算法覆盖率 ≥ 80%

---

## 10. 已知问题与风险

| ID | 问题 | 影响 | 缓解 |
|----|------|------|------|
| RISK-01 | Bug1 GPS 公式除数不一致 | 同 GPS 距离得不同分 | 短期统一为 1000；长期提取常量 |
| RISK-02 | 测试覆盖率 < 80% | 验收可能扣分 | 提交前补齐核心 service 测试 |
| RISK-03 | 演示视频未拍 | 必交材料缺失 | D-7 完成录制 |
| RISK-04 | 端到端真实数据不足 | 评测指标虚高/虚低 | 上线后真实数据回流 |

---

## 附录 A：测试工具清单

| 工具 | 用途 | 版本 |
|------|------|------|
| Jest | 后端单元测试 | 29.x |
| supertest | HTTP 测试 | 6.x |
| pytest | AI 服务单元测试 | 8.x |
| Locust | 性能压测 | 2.x |
| wrk | HTTP 压测 | - |
| Postman | API 调试 | - |
| curl | 命令行 HTTP | - |
| OWASP ZAP | 安全扫描（可选）| - |

---

## 附录 B：测试报告模板

测试完成后，填写以下报告：

```
测试报告 - 鼻纹智救
==================
测试日期：2026-06-30
测试人员：[姓名]

一、单元测试
  - 后端：X/Y 通过 (Z% 覆盖)
  - AI 服务：X/Y 通过

二、AI 评测
  - 同犬相似度：0.XX (目标 > 0.80)  ✓/✗
  - 异犬相似度：0.XX (目标 < 0.50)  ✓/✗
  - Recall@1：XX% (目标 ≥ 90%)    ✓/✗
  - Top-1 品种：XX% (目标 ≥ 85%)  ✓/✗

三、API 集成
  - 20/20 通过 ✓

四、端到端
  - 10/10 通过 ✓

五、性能
  - P50：XX ms
  - P95：XX ms (目标 < 1s)  ✓/✗

六、安全
  - 5/5 通过 ✓

七、结论
  - 总通过率：X/Y (XX%)
  - 验收结论：通过/不通过
```

---

**测试计划结束。所有用例可直接执行，验收 Checklist 可在大赛提交当天逐项打勾。**