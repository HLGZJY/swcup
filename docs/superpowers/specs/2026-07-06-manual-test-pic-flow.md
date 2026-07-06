# 用 18 张图片覆盖全流程指引

> **数据库状态**(2026-07-06 重置后): animals=0 / nose_features=0 / claims=0 / rescue_events=0 / users=0
> 测试方式: 微信开发者工具打开 miniapp-user + mini-admin,**从空白起步**,自助注册 6 个账号,然后用 18 张图片走遍所有核心流程。
> 测试素材目录: `F:\swcup2026\test_data\测试批\`

---

## 0. 18 张图片一览

| 类别 | 文件 | 内容 | 用途 |
|---|---|---|---|
| 全身/动物照 (10) | `A1.jpg` | 金毛 / 静安公园 | A1 豆豆的标本照 |
| 全身/动物照 (10) | `A2.jpg` | 金毛(二次发现) | A2 豆豆,同 A1 ~80m |
| 全身/动物照 (10) | `A3.jpg` | 拉布拉多 / 浦东 | A3 大黄,跨区 |
| 全身/动物照 (10) | `A4.jpg` | 萨摩耶 / 虹口 | A4 小白,捡到 |
| 全身/动物照 (10) | `A5.jpg` | 土狗 / 徐汇 | A5 旺财 |
| 全身/动物照 (10) | `A6.jpg` | 土狗(二次发现) | A6 旺财,同 A5 ~100m |
| 全身/动物照 (10) | `A7.jpg` | 边牧 / 长宁 | A7 花花 |
| 全身/动物照 (10) | `A8.jpg` | 柴犬 / 闵行 | A8 黑妞 |
| 全身/动物照 (10) | `A9.png` | 中华田园猫 / 静安公园 | A9 咪咪,**与 A1 同位但物种不同** |
| 全身/动物照 (10) | `A10.jpg` | 英短 / 普陀 | A10 团子,**claimed 状态**(无需 owner 走失) |
| 鼻纹 (8) | `aa1.jpg` | 金毛鼻 | A1 比对 |
| 鼻纹 (8) | `aa3.jpg` | 拉布拉多鼻 | A3 比对 |
| 鼻纹 (8) | `aa4.jpg` | 萨摩耶鼻 | A4 比对 |
| 鼻纹 (8) | `aa5.jpg` | 土狗鼻 | A5 比对 |
| 鼻纹 (8) | `aa7.jpg` | 边牧鼻 | A7 比对 |
| 鼻纹 (8) | `aa8.jpg` | 柴犬鼻 | A8 比对 |
| 鼻纹 (8) | `aa9.jpg` | 中华田园猫鼻 | A9 比对 |
| 鼻纹 (8) | `aa10.jpg` | 英短鼻 | A10 比对 |

> A2/A6 没配鼻纹(因为本就是同区二次发现,系统应该靠 GPS+鼻纹自动匹配)。

---

## 1. 第一步: 注册 6 个账号

数据库是空的,**必须先注册**。两种方式:

### 方式 A: 走小程序 user 端
打开 miniapp-user → 登录页 → "注册账号" → 填写手机号 + 密码 + 昵称:

| 角色 | 手机号 | 密码 | 昵称 |
|---|---|---|---|
| user1 | 13800000001 | test1234 | 测试-李明 |
| user2 | 13800000002 | test1234 | 测试-王小红 |
| user3 | 13800000003 | test1234 | 测试-张小华 |
| user4 | 13800000004 | test1234 | 测试-陈建国 |
| user5 | 13800000005 | test1234 | 测试-刘秀英 |
| admin | 13900000088 | test1234 | 测试管理员(注册后**修改 role='admin'**) |

### 方式 B: admin 端注册
admin 端 → 用户管理 → 新增用户(填上表 6 个账号)。

> ⚠️ admin 注册后默认 role=user。需要在 admin 端用户管理列表里,把 13900000088 改成 admin 角色,不然无法登录 mini-admin。

---

## 2. 第二步: 用 18 张图片走流程

### 流程地图(全 11 个)

```
P0  注册 5 user + 1 admin 账号
 ↓
P1  user1 采集 A1 (走失上报 + 建档)         ← A1.jpg, aa1.jpg
P2  user2 在 A1 同区(~80m) 采集 A2 触发合并 ← A2.jpg, aa1.jpg
P3  user2 在 A3 跨区采集 — 独立事件          ← A3.jpg, aa3.jpg
P4  user3 捡到 A4 (found)                   ← A4.jpg, aa4.jpg
P5  user4 采集 A5 (走失)                    ← A5.jpg, aa5.jpg
P6  user4 在 A5 同区(~100m) 采集 A6 触发合并 ← A6.jpg, aa5.jpg
P7  user3 采集 A7 (走失)                    ← A7.jpg, aa7.jpg
P8  user4 捡到 A8 (found)                   ← A8.jpg, aa8.jpg
P9  user5 采集 A9 (走失,与 A1 同位跨物种)   ← A9.png, aa9.jpg
P10 user5 采集 A10 (走失 → claimed)         ← A10.jpg, aa10.jpg
P11 admin 端: 审核事件 / 认领审批 / 状态流转
```

---

### P1 — user1 走失上报(创建 A1 豆豆)

**操作位置**: mini-app user 端
**用图**: `A1.jpg` (全身) + `aa1.jpg` (鼻纹)
**模拟机位置(GPS)**: 静安公园 31.2280, 121.4470(填在 location-box 里)

1. user1 登录(13800000001/test1234)
2. 首页 → 点 **"采集"** 按钮 → 进入 `/pages/collect/index`
3. 步骤 1: 选 **dog** (犬)
4. 步骤 2: 拍照 → 全身照选 `A1.jpg`,鼻纹照选 `aa1.jpg`
5. 步骤 3: 点击 location-box → 选 **静安公园** (经纬度会自动写入,确认是 31.2280, 121.4470)
6. 步骤 4: 填品种 "金毛" / 颜色 "金色" / 性别 "公" / 年龄 "成年" / 健康 "健康" / 绝育 "是" / 备注 "佩戴蓝色项圈,尾巴尖有白毛,亲人"
7. 提交 → 进入 `/pages/collect/result`
8. 结果页应显示 **"未在数据库中匹配到动物"** + **"创建档案"** 按钮
9. 点 **"创建档案"** → 弹出确认框 → 确认
   - 后端会:
     - `POST /v2/animals` 创建档案(返回 animal_id)
     - 自动写一条 `report` 事件(status=pending)
     - 把这次的鼻纹设为该动物的 primary_nose

**验收点** (看主页和 admin 端):
- [ ] 首页能看到豆豆卡片(状态徽章:走失中-红色)
- [ ] user1 "我的上报" +1 条
- [ ] admin 后台 → 事件列表 → 出现 1 条 pending(类型=report)

---

### P2 — 同区发现 A2(user2, ~80m, 触发合并)

**用图**: `A2.jpg` + `aa1.jpg` (**故意复用 A1 的鼻纹图** — 模拟"又看到同一只狗")
**模拟机位置**: 静安公园**西侧**31.2285, 121.4475(距 A1 约 80 米)

1. 退出 user1,user2 登录(13800000002/test1234)
2. 首页 → 点 **"采集"** → species=dog / 全身照=A2.jpg / 鼻纹=aa1.jpg
3. location → **静安公园西侧**(31.2285, 121.4475)
4. 品种金毛 / 颜色金色 / ...(同 A1,因为就是同一只)
5. 提交 → result 页

> 关键: 这次应该**直接命中 A1** (因为鼻纹相同 + GPS 只有 80m)
> 预期: result 页弹出 "匹配到豆豆(相似度 ~100%)"

6. 在 result 页选 "匹配到这只" → 进入 A1 详情
7. 详情页 → 提交一次"又看到这只狗"事件(若有此按钮)

**验收点**:
- [ ] A1 详情页 report_count 增长
- [ ] admin 后台 → 事件列表 → 新增 1 条带 `is_duplicate=1, duplicate_of=A1`
- [ ] admin 端 → 该事件详情 → processEvent → fusion_score ≈ 1.0

---

### P3 — 跨区独立事件 A3(user2)

**用图**: `A3.jpg` + `aa3.jpg`
**位置**: 浦东金桥 31.2550, 121.5950

1. user2 仍在登录态
2. 采集 → 全身=A3.jpg / 鼻纹=aa3.jpg / 位置=浦东金桥
3. 品种 "拉布拉多" / 颜色 "黄色" / 备注 "右后腿受伤,行走缓慢,急需救助"
4. result 页提示**未匹配** → 创建档案

**验收点**:
- [ ] A3 档案独立创建(不被合并到 A1)
- [ ] admin 端 → 该事件 status=pending, is_duplicate=0
- [ ] 跨区 (距 A1 约 16km), GPS similarity 应该很低

---

### P4 — 捡到 A4(user3)

**用图**: `A4.jpg` + `aa4.jpg`
**位置**: 虹口四川北路 31.2650, 121.4980
**备注**: "路边徘徊,穿红色背心,疑似走失"

1. user3 登录 (13800000003/test1234)
2. 采集 → dog / 萨摩耶 / 白色 / 位置虹口
3. result 未匹配 → 创建档案 → report_type 自动标 found

**验收点**:
- [ ] A4 创建后 status=found (而不是 lost)
- [ ] 首页筛选 "发现" tab 能看到 A4

---

### P5 — 走失 A5(user4, dog → 后续会被 P6 合并)

**用图**: `A5.jpg` + `aa5.jpg`
**位置**: 徐汇衡山路 31.1950, 121.4350
**备注**: "左耳有缺口,温顺,旁边有狗粮"

1. user4 登录 (13800000004/test1234)
2. 采集 → dog / 土狗 / 棕色 / 母 / 位置徐汇
3. 创建档案 → 走失上报

**验收点**:
- [ ] A5 status=lost, A5 卡片显示

---

### P6 — 同区发现 A6(user4, ~100m, 触发 A5+A6 合并)

**用图**: `A6.jpg` + `aa5.jpg` (**故意复用 A5 的鼻纹**)
**位置**: 徐汇衡山路**东侧**31.1958, 121.4358

1. user4 仍在登录态
2. 采集 → 全身=A6.jpg / 鼻纹=aa5.jpg / 位置徐汇东侧
3. 品种土狗 / 棕色 / 母 (同 A5)
4. result → **直接匹配到 A5** (同种+同鼻纹+仅 100m)
5. 点"是这只" → A5 详情 → 上报"又看到"事件

**验收点**:
- [ ] A5.report_count 增长
- [ ] admin 端 → 该事件 is_duplicate=1, duplicate_of=A5
- [ ] 验证 A1+A2(80m) 和 A5+A6(100m) **两组合并都触发**

---

### P7 — 走失 A7(user3)

**用图**: `A7.jpg` + `aa7.jpg`
**位置**: 长宁中山公园 31.2200, 121.4180

1. user3 登录 → 采集 / 边牧 / 黑白 / 母 / 长宁
2. 创建档案

---

### P8 — 捡到 A8(user4)

**用图**: `A8.jpg` + `aa8.jpg`
**位置**: 闵行莘庄 31.1100, 121.3820

1. user4 登录 → 采集 → 柴犬 / 黑色 / 母
2. 备注: "棕色围脖,警觉,不让人靠近,需专业救助"
3. 创建档案(found)

---

### P9 — 跨物种 A9(user5, 与 A1 同位不同物种)

**用图**: `A9.png` + `aa9.jpg`
**位置**: 静安公园 **31.2280, 121.4470**(**故意和 A1 完全相同**)
**物种**: **cat** (不是 dog!)

1. user5 登录 (13800000005/test1234)
2. 采集 → **cat** / 中华田园猫 / 橘色 / 公 / 静安公园
3. result → 未匹配 → 创建档案
4. 备注: "橘色狸花,胖胖的,佩戴粉色项圈"

**验收点**:
- [ ] A9 独立创建(不被合并到 A1 — 物种过滤!)
- [ ] admin 处理该事件: candidates 排序里 A1 不应该高居榜首
- [ ] 猫 vs 狗,即使 GPS 一样、鼻纹不像,系统**应拒绝合并**

---

### P10 — A10 走失上报,直接走认领(user5)

**用图**: `A10.jpg` + `aa10.jpg`
**位置**: 普陀长寿路 31.2500, 121.3950

1. user5 仍在登录 → 采集 → cat / 英短 / 蓝灰色 / 母
2. 健康 ill, 备注 "英短蓝猫,眼睛有分泌物,需治疗"
3. 创建档案 → 上报完成后状态变为 lost
4. 再点进 A10 详情 → "申请认领" → 填理由 → 提交认领 claim

**验收点**:
- [ ] A10 status: lost → claimed (走完整 owner 流程)
- [ ] user5 "我的认领" +1 (claimed 自己宠物,有点冗余,但测通了 API)

---

### P11 — admin 端全审核

打开 mini-admin → 用 13900000088/test1234 登录:

#### P11a — 事件审核
1. 待审中心 → 事件 tab
2. 应看到至少 **9 条 pending**(P1/P3/P4/P5/P7/P8/P9/P10 + P2/P6 合并事件)
3. 逐个点开 → "process" → 看 fusion_score / candidates
4. P2/P6 两条,确认 fusion ≈ 1.0 → "合并" → 选目标动物
5. P3/P4/P7/P8/P9/P10 走正常 confirm 流程

#### P11b — 认领审批
1. 待审中心 → 认领 tab
2. 应看到 1 条 (P10 的 user5/A10) → 通过

#### P11c — 状态流转
1. admin 端 → 动物管理 → 进 A7 → 改状态为 **archived** → 保存
2. 回首页 → A7 卡片应灰显

#### P11d — dashboard 统计
1. admin 首页 → 看板数字应正常 (totalAnimals≈10, lost, found, claimed 各有)

---

## 3. 跨流程交叉验收(用 18 张图覆盖 5 类核心业务)

下面这些验收点不专门走流程,而是在跑流程过程中"顺手看"。

### 业务 1: 物种过滤(防止误合并)

| 验证 | 怎么验 | 期望 |
|---|---|---|
| 猫 vs 狗 同位置不同物种 | admin 处理 P9 (A9 猫, 静安公园)事件 | is_duplicate=0, 不合并到 A1(狗) |

### 业务 2: 同区同种触发合并

| 验证 | 怎么验 | 期望 |
|---|---|---|
| A1+A2(80m) 合并 | P2 完成后看 A1.report_count + fusion | fusion≈1.0, is_duplicate=1 |
| A5+A6(100m) 合并 | P6 完成后看 A5.report_count + fusion | fusion≈1.0, is_duplicate=1 |

### 业务 3: 跨区不合并

| 验证 | 怎么验 | 期望 |
|---|---|---|
| A3 浦东 不并 A1 静安 | P3 完成后 admin 看 A3 事件 | is_duplicate=0 |
| A4 虹口 不并 任何 | P4 完成后 admin 看 A4 事件 | is_duplicate=0 |
| A7 长宁 / A8 闵行 / A10 普陀 类似 | P7/P8/P10 完成后 | is_duplicate=0 |

### 业务 4: 鼻纹匹配(独立于位置)

| 验证 | 怎么验 | 期望 |
|---|---|---|
| 同种同鼻纹但不同位 | admin 给某动物鼻纹重新比对 | 系统应优先按 species+鼻纹相似度返回 top1 |

> 用 aax.jpg 重复上传做此验证(去重)

### 业务 5: 完整状态流

| 验证 | 怎么验 | 期望 |
|---|---|---|
| lost → found | P4 触发 | A4 直接落 found |
| lost → claimed | P10 触发 | A10 owner 自己认领变 claimed |
| claimed → archived | P11c 触发 | A7 → 灰显不展示 |

---

## 4. 异常 / 边界用例

下面这些**主要靠同张图二次使用**或**故意传错**触发,验证系统鲁棒性:

| 用例 | 怎么试 | 期望 |
|---|---|---|
| 同一张 aa1.jpg 上传 2 次(P1 后再来一次) | user1 选 nose=aa1.jpg 再采集 | result 应**直接命中 A1**, similarity ≈ 1.0 |
| 鼻纹相同时使用 A5 的鼻纹给 A7 配 | admin 端强行把 aa5 关联 A7 | 相似度可能高,但物种/品种不同,系统应不合并 |
| 故意 GPS 写 0,0 | 采集时拨测, location=0,0 | 系统应拒绝 (400 "请提供有效的位置信息") |
| 故意不上传鼻纹,只创建档案 | apiCreateAnimal 单独调用 | 应允许,status 仍可 lost |
| 主人(user1)对别人家狗走失(A3)申请认领 | user1 进 A3 详情 → 认领 | 应走 pending,等 admin 审批 |

---

## 5. 验收截图清单(给团队 / 比赛裁判看)

跑完上述流程后,**至少截 14 张图**作为证据:

| # | 应该看到 |
|---|---|
| 1 | admin → 用户列表,6 个 utest* 账号 |
| 2 | user1 首页:有 A1(走失红条)+ A2 卡(也许消失了看是否已合并)+ 其它 |
| 3 | user1 → 我的上报: 至少 P1/P2 两条 |
| 4 | user4 → 我的上报: P5/P6 两条 |
| 5 | admin 事件列表 PENDING tab 计数 ≥ 4 |
| 6 | admin 处理 P1 后: fusion_score / merge_candidate 截图 |
| 7 | admin 处理 P2 后: is_duplicate=1, duplicate_of=A1 截图 |
| 8 | admin 处理 P6 后: is_duplicate=1, duplicate_of=A5 截图 |
| 9 | admin 处理 P9 后: candidates 不含 A1(物种过滤) |
| 10 | admin 认领审批 tab: P10 1 条 pending |
| 11 | admin 通过 P10 后,user5 "我的认领" status=approved |
| 12 | admin 动物列表 A7=archived,A10=claimed,A4=found,其它=lost |
| 13 | admin dashboard stats: totalAnimals=10 |
| 14 | 首页筛选 → 4 色徽章齐全 |

---

## 6. 复位(整轮跑完想重头来)

```bash
# 删除所有数据(含 5 个 utest 账号)
mysql -u root -prootpassword -h 127.0.0.1 -P 3307 nose_rescue -e "
SET FOREIGN_KEY_CHECKS=0;
TRUNCATE TABLE nose_features;
TRUNCATE TABLE claims;
TRUNCATE TABLE rescue_events;
TRUNCATE TABLE animals;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS=1;"

# 然后回去重走第 1 步注册, 后续完全按本文档
```

> 注:`users` 表也清了,因为注册流程是核心业务流程之一 (测试注册 + 登录 + 角色 + 密码加密 都要走通)。
