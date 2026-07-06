# 模拟机测试 Bug 清单(2026-07-06)

> 来源:[2026-07-06-manual-test-pic-flow.md](2026-07-06-manual-test-pic-flow.md) 中用户现场标注的"补充"内容
> 测试范围:P1 / P2 / P3 / P4 / P5 / P6 / P9 / P11 已跑;**P7 / P8 / P10 未跑**
> 整理时间:2026-07-06
> 总数:**16 个 Bug + 1 个优化项**

---

## 严重度图例

| 级别 | 含义 |
|---|---|
| 🔴 P0 | 核心业务断裂,数据错乱 / 自我引用 / 评分反逻辑 |
| 🟠 P1 | 主流程缺环节(按钮/合并/审核),用户走不通 |
| 🟡 P2 | 体验问题(默认值覆盖/字段异常),功能可走但结果错误 |
| ⚪ P3 | 优化建议(非 bug) |

---

## A. 重复检测 / 合并流程 Bug

### 🟠 BUG-001 缺"又看到这只狗"上报按钮

- **位置**:P2 第 7 步、P6 第 5 步
- **现象**:用户在前端识别到重复后,UI 只给"认领此动物"按钮,**没有"又看到这只狗"按钮**
- **预期**:检测到重复时,应提供 "是这只 / 又看到 / 都不是" 三选项
- **影响**:用户复发现场无法给原档案补充发现记录,只能放弃走"认领"
- **用户原话**: "检测到重复只有认领此动物的按钮,并没有'又看到这只狗'"

### 🟠 BUG-002 同区/同鼻纹检测后未自动合并

- **位置**:P2 / P6
- **现象**:前端文案"确认重复,系统自动合并",实际**未触发任何合并动作**
- **证据**:DB 中 A1 事件 (97f952ea) status=pending, A5 事件 (ef80b56f) status=pending, fusion 都是 1.0 但无人处理
- **影响**:高 fusion 分的事件积压在 admin 待审,前端提示与实际行为不符

### 🟠 BUG-003 report_count 未增长

- **位置**:P2 / P6
- **现象**:A1、A5 详情页 report_count 在重复检测后没有 +1
- **证据**:用户原话 "A5.report_count 增长 没有增长"
- **根因假设**:跟 BUG-002 同一根因 — 自动合并逻辑未触发,事件未关联到目标 animal

### 🟠 BUG-004 事件列表未新增重复事件记录

- **位置**:P2 第 6 步验收点
- **现象**:用户复发现场应该自动生成一条新的 `report` 事件 (is_duplicate=1),实际**事件库总数没变**
- **证据**:用户原话 "事件列表还是只有一条记录"
- **根因假设**:前端只展示"匹配到豆豆",没真的 POST 一条 report 事件;只有 confirm/认领才写事件

### 🔴 BUG-005 重复事件 duplicate_of 与 animal_id 自我引用

- **位置**:DB 中 4 条事件全部命中此 bug
- **现象**:`duplicate_of == animal_id`,即建议"把 A 合并到 A 自己"
- **证据** (来自 P6 数据 dump):
  - `0da25b8f` (A4 萨摩耶 report): duplicate_of=ef71a468 (A4 self)
  - `97f952ea` (A1 金毛 collect): duplicate_of=f9394535 (A1 self)
  - `ef80b56f` (A5 土狮犬 collect): duplicate_of=2ac0157e (A5 self)
- **根因假设**:`collect` 创建档案时,先把动物插入 animals 表,**再用同一个 animal_id 跑鼻纹比对**,比对时 candidates 池里已经包含了这个刚插入的 animal,命中后把 duplicate_of 写成了它自己
- **影响**:自我合并是逻辑错误,可能造成数据混乱 / 死循环

---

## B. 评分算法 Bug

### 🔴 BUG-006 鼻纹评分:采集页 ≠ 审核页(算法不一致)

- **位置**:P4 用户分析
- **现象**:同一只动物的鼻纹,在采集页能匹配到 100%,在审核页 `vector_similarity` 永远是 0
- **证据**:DB 字段:
  - 采集页 (用户实操) 鼻纹得分正常(56%~100%)
  - 审核页 events 表 `vector_similarity` 字段所有样本都是 0 (除了 self-merge 那条 =1)
- **用户原话**: "采集完全不走审核就能展示到公共区域,发现走审核是驳回还是合并 似乎也没有创建新动物的选项...采集页面应使用同一套分数算法"
- **根因假设**:两套 fusion_score 实现,审核页那条路径没把 `nose_vector_id` 传入比对服务

### 🔴 BUG-007 审核页 candidates 包含事件自身

- **位置**:审核事件详情
- **现象**:审核打开一条事件,看到的 candidates 候选列表里**第一项就是这个事件自己刚创建的动物**
- **证据**:见 BUG-005 全部 self-merge 数据
- **根因假设**:见 BUG-005 根因 — 事件触发流程里 candidates 检索前先把动物入库

### 🔴 BUG-008 文本匹配度算法异常(毫不相关 100%)

- **位置**:审核事件 fusion 分数
- **现象**:不同品种、不同描述的两个动物,文本匹配度给到 1.0
- **证据**:DB 中
  - `57055e50` A3 collect: text_match_rate=1 (对金毛 / 萨摩耶都给了 1)
  - `4678057b` A3 collect: text_match_rate=1 (同上)
- **用户原话**: "文本匹配算法确实是有问题的 毫不相似的将居然是 100%"
- **根因假设**:文本匹配可能用了"字符串相等/长度相等"这种退化判定,或者默认给了 1.0
- **用户建议**: "文本匹配度应该比对 品种、颜色、性别、健康状态、绝育否、以及用户文本"

### 🟠 BUG-009 GPS similarity 跨区应为很低但实际为 null

- **位置**:P3 第 3 验收点
- **现象**:用户预期跨区(16km)GPS similarity 应很低(0~0.2),实际值是 `null`
- **证据**:DB 中 A3 事件 `gps_similarity=0.0000` 但 `null` 也被记录到用户描述(可能前后端展示方式不同)
- **根因假设**:gps_similarity 字段计算时缺少必要参数(GPS 经纬度为 0,0 或距离过大被剔除)

### 🟡 BUG-010 GPS distance 数值离谱(689970m ≈ 689km)

- **位置**:P3 创建 A3 时
- **现象**:distance_m 字段返回 689970,实际跨区仅 16km
- **用户原话**: "鼻纹56% 其余两项为0 最后得分28分 距离689970m 这个可能不准确"
- **根因假设**:经纬度用了错误单位(经度没做 ±)或 Haversine 公式 bug,或 GPS 取自 IP 库兜底

---

## C. 前端表单 Bug

### 🟡 BUG-011 默认值覆盖用户选择

- **位置**:P3 创建 A3 时
- **现象**:用户在前端表单选择"未知/未选择"等空值,提交后被默认值覆盖:
  | 字段 | 用户选择 | DB 实际 |
  |---|---|---|
  | 性别 | 未知 | female(妹妹) |
  | 年龄 | 空 | (空白) |
  | 健康 | 空 | unknown |
  | 绝育 | 未选 | false(未绝育) |
- **根因假设**:后端 DTO 没传字段时,数据库列默认值生效(性别 ENUM 默认 'female',健康 ENUM 默认 'unknown',绝育 TINYINT 默认 0)。前端应让用户必填或显式传"unknown"

### 🟡 BUG-012 位置表单中找不到"虹口"选项

- **位置**:P4 第 2 步
- **现象**:用户填写位置时,location-box 候选项中**没有"虹口"**
- **用户原话**: "位置虹口,这个在表单中并没有该项,是否是位置标识"
- **根因假设**:location-box 数据源是后端预置的 POI 列表,虹口区未录入;用户应该是用 GPS 自动反查地址

---

## D. 业务流程 Bug

### 🟠 BUG-013 "采集"与"发现"流程标准不统一

- **位置**:P4 验收点分析
- **现象**:
  - **采集页**:动物直接出现在首页走失列表,**不走审核**
  - **发现页**:先进 admin 待审中心,审核后合并到失踪动物
- **用户原话**: "正常的逻辑是 该动物的事件进来 携带一些参数(位置 鼻纹 文本),再去和现有的动物的参数进行 相应的分数运算...审核端的作用应该是审核用户的创建是否能展示在公共区域 跟前端的采集页面应使用同一套分数算法"
- **影响**:同一种"上报"动作有两条完全不同的处理路径,产品逻辑混乱

### 🟠 BUG-014 审核端无"创建新动物"选项

- **位置**:admin 事件审核
- **现象**:审核员面对"没匹配到任何动物"的事件,只能驳回,**不能为该事件创建新档案**
- **用户原话**: "似乎也没有创建新动物的选项"
- **根因假设**:admin process 接口只接 `action: confirm|merge|reject`,没接 `create_new`

### 🟠 BUG-015 "采集" 自动标 lost,无法自动标 found

- **位置**:P4 验收点
- **现象**:期望 A4 创建后 status=found(因为走的是"捡到"路径),实际**创建后仍是 lost**
- **根因假设**:同 BUG-013 — 采集流程没区分 report_type;只有发现页才允许选 found

---

## E. 优化建议(非 Bug)

### ⚪ OPT-001 "我的上报" 列表卡片图片预览不显示

- **位置**:P1 验收点
- **现象**:user1 进入"我的上报"列表,动物卡片显示的是占位静态图,**不加载实际动物照片**
- **用户评价**: "不算 bug,仅作可优化选项"
- **建议**:列表 component 检查 `photos[0]` 字段并 bind :src

---

## F. 数据证据 dump(便于后续修复对照)

> 以下 5 条事件是 P6 验收时从 `rescue_events` 表查到的原始记录,核心字段摘抄:

```
# A4 collect→report 自动合并(P4 走发现页流程)
event_id: 0da25b8f-d722-44a6-bc64-3a6a041760ad
animal_id: ef71a468-a0ad-4903-8833-dc9c880b341f  (A4 萨摩耶)
event_type: report
is_duplicate: 1
duplicate_of: ef71a468-a0ad-4903-8833-dc9c880b341f  ← SELF-MERGE BUG
fusion_score: 0.9000
vector_similarity: 0  ← BUG-006
gps_similarity: 1
text_match_rate: 0.6667
status: duplicated  ← 这条反而处理了 (因为走发现页)

# A1 collect (P1)
event_id: 97f952ea
animal_id: f9394535  (A1 金毛 self)
duplicate_of: f9394535  ← SELF-MERGE
status: pending  ← BUG-002 未自动合并
vector_similarity: 1
fusion_score: 1

# A5 collect (P5)
event_id: ef80b56f
animal_id: 2ac0157e  (A5 土狮犬 self)
duplicate_of: 2ac0157e  ← SELF-MERGE
status: pending  ← BUG-002
vector_similarity: 1
fusion_score: 1
```

---

## G. 修复优先级建议

| 优先级 | Bug | 工作量估判 |
|---|---|---|
| **P0** | BUG-005 self-merge | 数据库+服务:collect 流程先把 event 写 rescue_events,再异步跑融合,避免 candidates 池里出现自身 |
| **P0** | BUG-006 / BUG-008 评分算法 | 复用采集页的 fusion_service.ts,统一鼻纹向量查询入口 |
| **P0** | BUG-007 candidates 含自身 | 同 BUG-005 修复 |
| **P1** | BUG-002 / BUG-003 自动合并 | event 写完后,async 触发 processEvent,融合分 ≥ 阈值直接 update event.animal_id + duplicate_of |
| **P1** | BUG-001 / BUG-013 / BUG-015 UI 流程 | 前端 collect/result 页加按钮,后端 DTO 区分 report_type |
| **P1** | BUG-014 admin 创建新动物 | admin process 接口加 action=create_new |
| **P2** | BUG-009 / BUG-010 GPS | 检查 Haversine 实现 + 输入校验 |
| **P2** | BUG-011 表单默认值 | DTO 加 required,前端默认 unknown 时显式传 |
| **P2** | BUG-012 位置 POI | location-box 接腾讯/高德 POI 兜底 |
| **P3** | OPT-001 列表图片 | component 改 :src 绑定 |

---

## H. 下一步

- [ ] 用户确认优先级
- [ ] 把这份清单 import 到 GitHub Issues(或继续放本地 spec/)
- [ ] 修复 P0 项,补单元测试
- [ ] 跑 P7/P8/P10 (未覆盖的场景) 看是否还有遗漏 bug
- [ ] 重跑完整 11 步流程验收