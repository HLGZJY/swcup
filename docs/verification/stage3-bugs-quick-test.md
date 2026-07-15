# 阶段三累积 Bug — 快速测试文档(2026-07-06)

> **目的**:让你用 30~45 分钟跑一遍,验证 16 个 bug 是否仍存在 + 阶段三修复是否生效。
> **原则**: 简单、直接、能跑就行;不要求穷举,只看"明显是否修好/是否仍坏"。
> **测试完成后**: 把每个 bug 的"实测"列填上(✅ 通过 / ❌ 未通过 / ⚠ 部分通过),发回给我,我再具体修。

---

## 0. 测试前置(5 分钟)

### 0.1 服务确认

- [1] backend 跑通: 终端跑 `curl http://localhost:3000/v1/animals` 返回 `code:0,total:≥3`
- [1] ai-service 跑通: 终端跑 `curl http://localhost:8000/health` 返回 `{"status":"ok"}`
- [1] 微信开发者工具打开 miniapp-user 与 miniapp-admin 两个项目
- [1] HBuilder 已构建运行 / 微信开发者工具已能预览

### 0.2 测试账号(密码统一 `test1234`)

| 角色  | 账号        | 昵称        | 用途                   |
| ----- | ----------- | ----------- | ---------------------- |
| admin | 13900000088 | 测试管理员  | 审核事件、审批认领     |
| user1 | 13800000020 | 测试-李明   | A1 豆豆主人            |
| user2 | 13800000021 | 测试-王小红 | A3 大黄主人 / 同区发现 |
| user3 | 13800000022 | 测试-张小华 | A4 主人 / 鼻纹匹配     |
| user4 | 13800000023 | 测试-陈建国 | A5 旺财主人            |
| user5 | 13800000024 | 测试-刘秀英 | A9/A10                 |

### 0.3 重置测试数据(可选,要把 DB 拉回干净初始态时)

```bash
cd F:\swcup2026\backend
python prep-test-data.py
```

> 注: 只清空 4 张业务表 (animals / nose_features / claims / rescue_events), users 表不动,6 个 utest 账号一直在。

---

## 1. 5 个必测场景(覆盖 16 个 bug 的大头)

> 场景按"是否修好"测,**不需要 11 个全跑**。每场景 5~10 分钟。

---

### 场景 ① 采集后流程闭环 + 双按钮(实测反馈已修)

**对应 BUG**: BUG-005 self-merge / BUG-007 candidates 含自身 / BUG-002 自动合并 / BUG-001 缺”我要上报”按钮 / BUG-004 事件不新增 / BUG-013 流程不统一 / BUG-015 无法自动标 found

**关键逻辑**(从 2026-07-06 用户实测反推出来,阶段 3 已实施):

```
[用户提交采集表单]
   │
   ▼
[后端 score 跑分 → setImmediate processEvent]
   │
   ├─→ 高分(>=0.88, 重复确认) → result 页显示两个按钮:
   │     - “我要上报” (主) → 提交 sighting 事件 intent='stray_sighting', animal_id=命中动物
   │     - “认领此动物” (次) → 跳转动物详情页
   │
   └─→ 低分(<0.75, 无匹配) → result 页显示一个按钮:
         - “创建档案” → apiCreateAnimal (intent 透传决定 status)
                    → apiReportEvent (intent 透传到事件)
```

**意图 → 状态映射**(用户实测总结):

- `intent='lost'` → animal.status = LOST(走失中,徽章红色) — 用户: “我走失了狗,我标记的”
- `intent='found'` → animal.status = FOUND(发现中,徽章绿色) — 用户: “我发现了狗,我标记的”
- 重复 sighting 时事件 intent = `'stray_sighting'`(路人上报)

**子测试 ①-a 高分重复 + 我要上报**(user1 端):

1. user1 登录 → “采集” 入口 → 拍 `test_data/测试批/A1.jpg` → 走完 5 步表单
2. 第 4 步 “我的意图” 选 **”我走失了狗”**(intent='lost')
3. 提交 → 跳到 result 页 → 看评分结果(应 ≥ 0.88, top1 是 A1 自身)
4. **关键检查**: 底部应出现 **2 个按钮** —— “我要上报”(主,绿色) + “认领此动物”(次,灰色)
5. 点 “**我要上报**” → 看到 “上报中...” → 成功后跳到 A1 详情页
6. 切到 admin → 待审事件 → 应看到 +1 pending(report 类型)
7. 查 DB 验证事件 animal_id 指向 A1

**子测试 ①-b 低分无匹配 + 创建档案**(user3 端,先登出 user1):

1. user3 登录 → “采集” → 拍一张**全新的狗**(随便拍的动物照,不会匹配到任何已有动物)
2. 第 4 步 “我的意图” 选 **”我捡到狗”**(intent='found')
3. 提交 → 跳到 result 页 → 看评分(应 < 0.75, 无匹配)
4. **关键检查**: 底部应出现 **”创建档案”** 按钮(无匹配分支)
5. 点 “**创建档案**” → 创建成功 → 跳到新动物详情页
6. 查 DB:**新 animal.status 应该是 `found`**(不是 lost,因为用户选了”我捡到”)

**子测试 ①-c 低分 + intent='lost'**(user5 端,验证对称):

1. user5 登录 → “采集” → 拍一张新动物照 → 第 4 步 “我的意图” 选 **”我走失了狗”**
2. 走完 → 点 “创建档案”
3. 查 DB:**新 animal.status 应该是 `lost`**(验证 lost 路径)

**验收点**:

| 验证项                                                             | 期望                                             | 实测 |
| ------------------------------------------------------------------ | ------------------------------------------------ | ---- |
| BUG-001: 重复检测后 result 页**有”我要上报”按钮**                  | 底部出现 2 个按钮(我要上报 + 认领此动物)         | 1    |
| BUG-001 修复: 点 “我要上报” 后 admin 待审事件 +1                   | DB 中有新的 report 类型事件,animal_id = 命中动物 | 1    |
| BUG-004: 我要上报触发后,事件库**真新增**一条 rescue_events         | DB 中能 SELECT 到这条新事件                      | 1    |
| BUG-013: 采集/发现/我要上报 共用同一套后端 pipeline                | 同 animal_id, fusion 分数能算出来                | 1    |
| BUG-015: 走”我捡到狗”流程后,animal.status = found                  | DB 中新 animal 的 status='found'                 | 0    |
| BUG-015 对称: 走”我走失了狗”流程后,animal.status = lost            | DB 中新 animal 的 status='lost'                  | 1    |
| BUG-005: admin 端 candidates 列表**不**包含这个动物自身            | 第一项不是 A1 自身                               | 1    |
| BUG-007: 同一只动物,不再出现 duplicate_of == animal_id 自我引用    | DB 中 `duplicate_of != animal_id`                | ☐    |
| BUG-002: 高分 sighting 经 admin 审核后,目标 animal.report_count +1 | A1.report_count 从 N → N+1                       | 1    |

**辅助查 DB**(测完跑一下):

```bash
# 1) 最近的 collect / report 事件 + 自动合并状态
mysql -u root -prootpassword -h 127.0.0.1 -P 3307 nose_rescue \
  -e "SELECT event_type, intent, status, animal_id, duplicate_of, fusion_score, created_at FROM rescue_events ORDER BY created_at DESC LIMIT 10;"

# 2) 最近创建的动物 + 状态(应见 status='found' 和 'lost' 各至少 1 条)
mysql -u root -prootpassword -h 127.0.0.1 -P 3307 nose_rescue \
  -e "SELECT name, status, species, breed, report_count, created_at FROM animals ORDER BY created_at DESC LIMIT 5;"

# 3) A1 当前的 report_count(应随 sighting 增加)
mysql -u root -prootpassword -h 127.0.0.1 -P 3307 nose_rescue \
  -e "SELECT name, report_count FROM animals WHERE name='豆豆';"
```

> 期望:`rescue_events` 表出现 report 类型 + intent='stray_sighting' 的事件;`animals` 表有新 status='found' 的记录;A1.report_count 增长。

---

## 1.5 intent 语义速查(贯穿所有场景)

> **这是用户在 2026-07-06 实测反推出来的核心规则**,所有场景的验收都靠它判定。

### 走失 vs 发现 = 谁标记的

| 状态    | 徽章色 | 谁标记                            | 触发位置                                  |
| ------- | ------ | --------------------------------- | ----------------------------------------- |
| lost    | 红     | **主人** 标记 "我走失了狗"        | 采集页表单选 "我走失了狗" → intent='lost' |
| found   | 绿     | **发现者** 标记 "我发现了狗"      | 采集页表单选 "我捡到狗" → intent='found'  |
| claimed | 橙     | 走失主人申请认领 + admin 审核通过 | animal-detail "申请认领" → claim 流程     |

### intent 字段如何决定 animal.status

| 触发流程                         | 后端 intent 字段   | animal.status                                     |
| -------------------------------- | ------------------ | ------------------------------------------------- |
| 采集页 → 创建档案(低分)          | 用户表单值         | `intent='lost' → LOST` / `intent='found' → FOUND` |
| 采集页 → 我要上报(高分 sighting) | `'stray_sighting'` | 不创建动物,事件关联到命中的 animal                |
| 详情页 → 我又看到这只            | `'stray_sighting'` | 不创建动物,事件关联到该 animal                    |
| 详情页 → 申请认领                | — (走 claims 表)   | 仍 LOST/FOUND,等 admin 通过转 claimed             |
| admin → 创建新动物               | 由 event 派生      | `lost/found` 透传,`stray_sighting` 默认 LOST      |

### 事件类型区分

| event_type | 含义                          | 出现在哪里                                              |
| ---------- | ----------------------------- | ------------------------------------------------------- |
| collect    | 用户走完采集流程创建动物/事件 | 采集页 → 创建档案                                       |
| report     | 用户上报一次发现记录          | 详情页"我又看到" / result 页"我要上报" / 独立 report 页 |
| claim      | 用户申请认领                  | 详情页"申请认领"(走 claims 表)                          |

### 验证原则

凡是 status / event_type / intent 任一项"看起来不对",先用这张表反推,再回去看代码。

---

### 场景 ② 评分算法一致性

**对应 BUG**: BUG-006 鼻纹评分不一致 / BUG-008 文本匹配度异常

**步骤**(user1 端):

1. user1 → 我的上报 → A1 详情 → 点"鼻纹比对" → 拍 `test_data/测试批/aa1.jpg` → 等结果
2. 看 fusion_score / vector_similarity / text_match_rate 三个字段
3. 切到 admin → 同一只动物的待审事件 → 看分数字段

**验收点**:

| 验证项                                                            | 期望                                   | 实测 |
| ----------------------------------------------------------------- | -------------------------------------- | ---- |
| BUG-006: 采集页和审核页**鼻纹分数一致**(不再 vector_similarity=0) | 两边 vector_similarity 都 > 0          | ☐    |
| BUG-006: fusion_score 用同一套算法                                | 两边 fusion_score 数值接近(允许 ±0.05) | ☐    |
| BUG-008: 文本匹配对"不同品种/不同描述"返回 1.0 是 bug             | 不同品种的 fusion 文本分 < 0.5         | ☐    |

**辅助查 DB**:

```bash
mysql -u root -prootpassword -h 127.0.0.1 -P 3307 nose_rescue \
  -e "SELECT event_id, vector_similarity, text_match_rate, gps_similarity, fusion_score FROM rescue_events ORDER BY created_at DESC LIMIT 10;"
```

> 期望 `vector_similarity` 不全为 0;`text_match_rate` 不是千篇一律的 1.0。

---

### 场景 ③ 动物详情页"我又看到这只狗"按钮(独立路径) 鼻纹并不是可选的，是完全和发现共用的同一个流程

**对应 BUG**: BUG-001(详情页按钮 — 与场景 ① result 页按钮是两条入口) / BUG-013 流程统一 / BUG-004 事件不新增

**步骤**(user2 端,先登出 user1):

1. user2 登录 → 首页 → 点 A1 卡片 → 进入动物详情
2. **看页面**: 详情页底部应该有 "**我又看到这只**"(次, 灰色) + "**申请认领**"(主, 红色) 两个并排按钮
3. 点 "**我又看到这只**" → 跳到 report 页 → 填全身照 + 鼻纹(可选)+ 位置 → 提交
4. 切到 admin → 待审事件 → 应该 +1 pending
5. 切回 user2 → 我的上报 → A1 的时间轴(或详情页"已 N 次上报")应该 +1

**验收点**:

| 验证项                                                             | 期望                            | 实测 |
| ------------------------------------------------------------------ | ------------------------------- | ---- |
| BUG-001: 详情页底部有 "我又看到这只" + "申请认领" 两个按钮         | 底部并排,都可点                 | 1    |
| BUG-004: 点 "我又看到这只" 后,事件库**真新增**一条 rescue_events   | admin 端 +1 pending             | 1    |
| BUG-013: 详情页 sighting 与 result 页 "我要上报" 走同一套 pipeline | 两次都生成 report 事件          | 1    |
| 时间轴更新: sighting 事件被审核后, A1 时间轴多一条记录             | 时间轴出现新增的 sighting entry | 0    |

---

### 场景 ④ admin 审核端动作闭合(create_new)

**对应 BUG**: BUG-014 审核端无 create_new

**步骤**(admin 端):

1. admin 登录 → 待审中心 → 找一条 candidates 都为空 / fusion 很低的 pending 事件(推荐用场景 ① 留下的低分"创建档案"事件,或场景 ② 留下的无匹配 sighting)
2. 看事件详情 / 审核弹窗: 应该有 **"创建新动物"** 按钮(以及 confirm/merge/reject)
3. 点"创建新动物" → 确认 → 看是否从 event 字段创建一个 Animal + 关联 event.animal_id

测试记录：现在的情况是用户在前面采集，注意是采集有鼻纹那个，只要分数低于阈值就会直接生成一条新的记录在列表中，无需经过admin端，admin虽然也有这个事件但是点击确认重复似乎也没有任何作用了，不会影响到已有的动物状态。这可能跟自动审核那里冲突了，自动审核那么这个事件就不应该出现在admin的审核列表，但是我们需要它出现，而且得等admin端去审核是重复还是新的动物，新的动物就统一新增就会通过这条审核；如果是重复那么就更新状态，原本是丢失状态那么现在就应该更新为发现中了

其次就是：更新时间线 ，并给上报丢失的人发送通知 。所以总结admin端的功能就是审核动物的新增 和 重复-更新状态+发送通知

此外我还发现我要认领，用户填写之后在首页那只动物并没有变为认领中，等管理员端审核通过后才显示在认领中，认领流程感觉很奇怪，认领是有两个来源的1.是失主找回触发的认领 2.没有失主的动物被认领 认领难道不是有一个寄存的过程吗？还是说我看到这只狗我认领了我就把它接走了，这个认领作为一个备注的作用？
**验收点**:

| 验证项                                                                                                                      | 期望                                     | 实测 |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---- |
| BUG-014: 审核端出现"创建新动物"按钮                                                                                         | 按钮可见                                 | 0    |
| 创建后该事件 status=confirmed, animal_id 指向新 Animal                                                                      | DB 中 status='confirmed', animal_id 非空 | ☐    |
| 新 Animal 字段从 event 复制(species/breed/color/photos/location)                                                            | DB 中字段一致                            | ☐    |
| 新 Animal 的 status 取自 event intent(intent='lost' → LOST, intent='found' → FOUND, intent='stray_sighting' → 仍 LOST 默认) | DB 中新 animal 的 status 与 intent 匹配  | ☐    |

**辅助查 DB**:

```bash
mysql -u root -prootpassword -h 127.0.0.1 -P 3307 nose_rescue \
  -e "SELECT event_id, status, animal_id FROM rescue_events WHERE status='confirmed' ORDER BY updated_at DESC LIMIT 5;"
mysql -u root -prootpassword -h 127.0.0.1 -P 3307 nose_rescue \
  -e "SELECT name, status, species, breed, address FROM animals ORDER BY created_at DESC LIMIT 3;"
```

---

### 场景 ⑤ 体验/零碎 Bug 抽查

**对应 BUG**: BUG-009 GPS similarity null / BUG-010 GPS 距离离谱 / BUG-011 默认值覆盖 / BUG-012 位置 POI / OPT-001 列表图

**步骤**(user3 端):

1. user3 登录 → 进入 A4 详情(虹口四川北路 31.2650, 121.4980),注意地址显示
2. 在地址栏 / location-box 输入"虹口",看候选项里有没有
3. 进入"我的上报"列表,看动物卡片缩略图是否加载(还是占位静态图)

**新建一只跨区动物**(user2 走 P3 路径): 4. user2 → 采集 → 位置选**浦东金桥**(31.2550, 121.5950)→ 距离 A1 静安寺约 16km 5. 提交后,看 DB 中的 distance_m / gps_similarity 字段

**验收点**:

| 验证项                                                 | 期望                                          | 实测 |
| ------------------------------------------------------ | --------------------------------------------- | ---- |
| BUG-012: location-box 候选项**有"虹口"**               | 输入"虹口"出选项                              | ☐    |
| BUG-010: 跨区 16km, distance_m 应在 14000~18000 范围   | DB 中 distance_m 不再是 689970                | ☐    |
| BUG-009: 跨区 gps_similarity 应是低值(0~0.2),不是 null | DB 中 gps_similarity 非 null                  | ☐    |
| BUG-011: 表单留空,DB 中默认值**不**覆盖用户显式"未知"  | 用户选"未知",DB 显示 "unknown" 不是 female 等 | ☐    |
| OPT-001: 我的上报列表卡片**显示真实照片**(不是占位)    | 缩略图渲染                                    | ☐    |

---

## 2. 反馈模板(测完直接复制填)

> 复制下面的 Markdown,把 ☐ 改成 ✅ pass / ❌ fail / ⚠ partial,然后发回给我即可。

````markdown
## 测试反馈 (日期:\_\_\_\_)

### 服务状态

- backend: ☐ 正常 / ☐ 异常(报错:\_\_\_\_)
- ai-service: ☐ 正常 / ☐ 异常
- DB: ☐ 重置 / ☐ 未重置

### 16 个 bug 实测结果

| Bug                          | 等级  | 实测 | 备注 |
| ---------------------------- | ----- | ---- | ---- |
| BUG-001 缺"又看到这只狗"按钮 | 🟠 P1 | ☐    |      |
| BUG-002 未自动合并           | 🟠 P1 | ☐    |      |
| BUG-003 report_count 未增长  | 🟠 P1 | ☐    |      |
| BUG-004 事件不新增           | 🟠 P1 | ☐    |      |
| BUG-005 self-merge           | 🔴 P0 | ☐    |      |
| BUG-006 评分算法不一致       | 🔴 P0 | ☐    |      |
| BUG-007 candidates 含自身    | 🔴 P0 | ☐    |      |
| BUG-008 文本匹配 100%        | 🔴 P0 | ☐    |      |
| BUG-009 GPS similarity null  | 🟠 P1 | ☐    |      |
| BUG-010 GPS 距离离谱         | 🟡 P2 | ☐    |      |
| BUG-011 默认值覆盖           | 🟡 P2 | ☐    |      |
| BUG-012 位置找不到虹口       | 🟡 P2 | ☐    |      |
| BUG-013 采集/发现流程不统一  | 🟠 P1 | ☐    |      |
| BUG-014 admin 无 create_new  | 🟠 P1 | ☐    |      |
| BUG-015 无法自动标 found     | 🟠 P1 | ☐    |      |
| OPT-001 列表图不显示         | ⚪ P3 | ☐    |      |

### 测试中遇到的新问题(可选)

- [新发现的问题写在这里]

### DB dump 关键 3 行(场景 ① 测完)

```sql
rescue_events 最新 3 行 event_id/animal_id/duplicate_of/status/fusion_score:
1. ...
2. ...
3. ...
```
````

```

---

## 3. 30 分钟测试路线图(给时间紧的人)

如果你只想挑最核心的,按这个顺序跑(40 分钟,因场景 ① 拆 3 个子测试):

1. **5 分钟**: 服务确认 + 跑 `prep-test-data.py` 重置
2. **12 分钟**: 场景 ① 全跑(高分 sighting + 低分 lost 创建 + 低分 found 创建) — 这是用户实测反推的核心闭环
3. **8 分钟**: 场景 ②(评分算法一致性,验证 4 个 P0)
4. **8 分钟**: 场景 ③ + ④(详情页 sighting 按钮 + admin create_new)
5. **5 分钟**: 场景 ⑤ 抽查(location-box 虹口 + GPS distance)
6. **2 分钟**: 填反馈模板发回

> 重点关注: **BUG-005 / 006 / 007 / 008 这 4 个 P0** 是否仍坏,**intent → status 的语义**是否走通(场景 ① 子测试 ①-b/①-c)。

---

## 4. 测试参考资源

| 文件 | 用途 |
|---|---|
| `docs/superpowers/specs/2026-07-06-bugs-collected.md` | 16 个 bug 完整描述 + 证据 dump |
| `docs/superpowers/specs/2026-07-06-manual-test-checklist.md` | 完整 10 场景 S1-S10 清单(本测试是其精简版) |
| `docs/superpowers/specs/2026-07-06-unified-event-model.md` | 阶段三架构 spec(intent → status 派生的源头) |
| `miniapp-user/src/pages/collect/result.vue` | 场景 ① 跑的主页面(2026-07-06 改:加"我要上报"按钮 + intent 透传) |
| `miniapp-user/src/pages/collect/index.vue` | 采集表单(2026-07-06 改:intent 透传到 result 页) |
| `backend/prep-test-data.py` | 重置数据脚本 |
| `test_data/测试批/` | A1-A10.jpg + aa1/3/4/5/7/8/9/10.jpg 测试素材 |

---

> **下一步**: 测完发回反馈表,我根据实测结果决定修复顺序(优先 P0 → P1 → P2)。
```
