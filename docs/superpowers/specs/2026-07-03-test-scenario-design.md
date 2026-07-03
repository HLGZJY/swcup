# E2E 测试场景设计:走失/发现/待认领/事件审核

> 日期:2026-07-03
> 状态:草稿,待用户审核
> 目的:启动测试阶段,通过 10 只动物 + 5 user + 1 admin 的真实场景设计,覆盖核心流程,允许用户逐个对照测试

---

## 1. 概述

### 1.1 背景

进入 E2E 测试阶段,需要重置数据库,使用真实照片和鼻纹数据,模拟真实业务场景。现有 `backend/seed.py` 已包含 10 只动物的占位数据,本 spec 重新设计动物、位置、事件和用户角色,确保 10 个测试场景覆盖核心流程。

### 1.2 测试目标

- **覆盖核心流程:** 走失上报、发现上报、鼻纹采集、事件合并、鼻纹匹配、待认领申请、认领审批、状态流转
- **覆盖所有 4 个状态:** 走失(lost)、发现(found)、待认领(claimed)、已认领/已归档(claimed/archived)
- **覆盖位置区分:** 同区合并、跨区不合并、跨物种同位置不合并
- **覆盖事件类型:** report(发现上报)、collect(鼻纹采集)为主,辅以 medical/rescue

### 1.3 范围

**包含:**
- 5 个 user + 1 admin 账号(全部复用现有账号,无需新建)
- 10 只动物数据(完整字段)
- 10 个测试场景剧本(操作步骤 + 预期效果)
- 数据录入参考 SQL(便于用户直接复制)

**不包含:**
- 自动生成脚本(用户手动录入)
- 新建 user/admin 账号
- 新建模块/页面/API

### 1.4 术语

- **走失上报:** 主人发现自己动物走失后,通过小程序提交走失信息
- **发现上报:** 第三方发现疑似走失动物,提交线索
- **鼻纹采集:** 对动物鼻子拍照,提取特征向量入库
- **鼻纹匹配:** 上传新鼻纹,与库中已有特征对比,找到相似动物
- **事件合并:** 系统自动识别同一动物的多次事件(基于位置+时间+鼻纹),合并到同一动物档案
- **认领申请:** 走失动物主人或第三方对某动物提交认领
- **认领审批:** admin 审核认领申请,通过/驳回

---

## 2. 测试角色矩阵

**所有账号均为新建测试账号(原 seed.py 账号密码不可用,因后端用 bcrypt 校验),密码统一 `test1234`**

| 角色 | 账号 | 昵称 | 在测试中的定位 | 关键场景 |
|---|---|---|---|---|
| **admin** | 13900000088 | 测试管理员 | 事件审核、认领审批、状态流转 | S8, S9, S10 |
| **user1** | 13800000020 | 测试-李明 | 走失主人(A1) + 鼻纹采集者(A1) | S1, S2 |
| **user2** | 13800000021 | 测试-王小红 | 走失主人(A3) + 同区发现者(A2) | S3, S4 |
| **user3** | 13800000022 | 测试-张小华 | 跨区发现者(A4) + 鼻纹采集者(A7) | S5, S6 |
| **user4** | 13800000023 | 测试-陈建国 | 走失主人(A5/A6) + 待认领申请者(A8) | S6, S7 |
| **user5** | 13800000024 | 测试-刘秀英 | 跨物种测试者(A9) + 跨区发现者(A10) | S9, S10 |

> **账号来源:** 已通过 SQL 新建 6 个测试用户(user_id 前缀 `utestadm-` 和 `utestu01~05-`)。原 seed.py 账号(user1-user7、admin、org1/org2)保留不删,但因 password_hash 不匹配,测试中**不要使用**。

---

## 3. 10 只动物设计

### 3.1 总览

| 编号 | 名字 | 种类 | 状态 | 位置区域 | 区域策略 | 主要场景 |
|---|---|---|---|---|---|---|
| A1 | 豆豆 | 狗 | lost | 静安公园(121.4470, 31.2280) | 同区锚点 | S1, S2 |
| A2 | 豆豆(二次发现) | 狗 | lost(独立档案) | 静安公园(121.4475, 31.2285) | **同 A1(~80m)** | S3 |
| A3 | 大黄 | 狗 | lost | 浦东金桥(121.5950, 31.2550) | 跨区 | S4 |
| A4 | 小白 | 狗 | found | 虹口四川北路(121.4980, 31.2650) | 跨区 | S5 |
| A5 | 旺财 | 狗 | lost | 徐汇衡山路(121.4350, 31.1950) | 同区锚点 | S6 |
| A6 | 旺财(二次发现) | 狗 | lost(独立档案) | 徐汇衡山路(121.4358, 31.1958) | **同 A5(~100m)** | S6 |
| A7 | 花花 | 狗 | lost | 长宁中山公园(121.4180, 31.2200) | 跨区 | S7 |
| A8 | 黑妞 | 狗 | found | 闵行莘庄(121.3820, 31.1100) | 跨区 | S8 |
| A9 | 咪咪 | 猫 | lost | 静安公园(121.4470, 31.2280) | **同 A1 坐标(跨物种)** | S9 |
| A10 | 团子 | 猫 | claimed | 普陀长寿路(121.3950, 31.2500) | 跨区 | S10 |

### 3.2 区域策略说明

- **同区合并组(2 组):** A1+A2、A5+A6。位置距离 <100m,GPS 相似度高,系统应自动合并事件
- **跨物种同位置组(1 组):** A9 与 A1 坐标完全相同,但种类不同(cat vs dog),系统应**不合并**(物种过滤)
- **跨区组(其余 7 只):** 分散在静安、徐汇、浦东、虹口、长宁、闵行、普陀,验证不触发合并

### 3.3 每只动物的完整字段

> **录入提示:** 用户提供真实照片和鼻纹后,替换 `/static/uploads/animals/` 和 `/static/uploads/nose/` 下的占位文件名。`/static/uploads/animals/001-photo-1.jpg` 等是占位路径,实际替换为用户提供照片。

#### A1 - 豆豆(锚点 1)
```
animal_id:  <uuid>
species:     dog
breed:       金毛
color:       金色
gender:      male
age:         adult
health:      healthy
sterilized:  true
status:      lost
location:    lat=31.2280, lng=121.4470
address:     上海市静安区南京西路 1788 号(静安公园)
notes:       佩戴蓝色项圈,尾巴尖有白毛,亲人
tags:        ["走失", "佩戴项圈", "亲人"]
photos:      [/static/uploads/animals/a1-1.jpg, /static/uploads/animals/a1-2.jpg]
size:        large
coat_length: long
ear_type:    floppy
tail_type:   long
关联 user1:  user1 的狗,走失
```

#### A2 - 豆豆二次发现(同 A1 区)
```
animal_id:  <uuid>  ← 录入时是独立档案,事件合并后会被并入 A1
species:     dog
breed:       金毛
color:       金色
gender:      male
...其余同 A1
location:    lat=31.2285, lng=121.4475(距 A1 约 80m)
关联事件:    user2 提交 report 事件,系统应自动关联(合并)到 A1
```

#### A3 - 大黄
```
animal_id:  <uuid>
species:     dog
breed:       拉布拉多
color:       黄色
gender:      male
age:         adult
health:      injured
sterilized:  true
status:      lost
location:    lat=31.2550, lng=121.5950
address:     上海市浦东新区金桥路 200 号
notes:       右后腿受伤,行走缓慢,急需救助
tags:        ["走失", "受伤", "急需救助"]
photos:      [/static/uploads/animals/a3-1.jpg]
关联 user2:  user2 的狗,走失
```

#### A4 - 小白
```
animal_id:  <uuid>
species:     dog
breed:       萨摩耶
color:       白色
gender:      male
age:         young
health:      healthy
sterilized:  true
status:      found
location:    lat=31.2650, lng=121.4980
address:     上海市虹口区四川北路 1888 号
notes:       路边徘徊,穿红色背心,疑似走失
tags:        ["捡到", "待认领"]
photos:      [/static/uploads/animals/a4-1.jpg]
关联 user3:  user3 捡到并 submit report,状态=found
```

#### A5 - 旺财(锚点 2)
```
animal_id:  <uuid>
species:     dog
breed:       土狗
color:       棕色
gender:      female
age:         adult
health:      healthy
sterilized:  false
status:      lost
location:    lat=31.1950, lng=121.4350
address:     上海市徐汇区衡山路 999 号
notes:       左耳有缺口,温顺,旁边有狗粮
tags:        ["走失", "温顺"]
photos:      [/static/uploads/animals/a5-1.jpg]
关联 user4:  user4 的狗,走失
```

#### A6 - 旺财二次发现(同 A5 区)
```
animal_id:  <uuid>  ← 录入时是独立档案,事件合并后会被并入 A5
species:     dog
...其余同 A5
location:    lat=31.1958, lng=121.4358(距 A5 约 100m)
关联事件:    第三方发现并 submit report,系统应自动关联(合并)到 A5
```

#### A7 - 花花
```
animal_id:  <uuid>
species:     dog
breed:       边牧
color:       黑白
gender:      female
age:         adult
health:      healthy
sterilized:  true
status:      lost
location:    lat=31.2200, lng=121.4180
address:     上海市长宁区中山公园
notes:       走失 3 天,已联系主人认领(预填为 lost,实际通过 S7 转 claimed)
tags:        ["走失", "已联系"]
photos:      [/static/uploads/animals/a7-1.jpg]
关联 user3:  user3 捡到,user4 申请认领
鼻纹:        /static/uploads/nose/a7-nose.jpg
```

#### A8 - 黑妞
```
animal_id:  <uuid>
species:     dog
breed:       柴犬
color:       黑色
gender:      female
age:         adult
health:      healthy
sterilized:  false
status:      found
location:    lat=31.1100, lng=121.3820
address:     上海市闵行区莘庄镇莘建路 88 号
notes:       棕色围脖,警觉,不让人靠近,需专业救助
tags:        ["捡到", "警觉", "需救助"]
photos:      [/static/uploads/animals/a8-1.jpg]
关联 user4:  user4 申请认领,但实际主人不匹配,被驳回
```

#### A9 - 咪咪(跨物种同位置)
```
animal_id:  <uuid>
species:     cat       ← 关键:与 A1 同位置但种类不同
breed:       中华田园猫
color:       橘色
gender:      male
age:         adult
health:      healthy
sterilized:  false
status:      lost
location:    lat=31.2280, lng=121.4470  ← 与 A1 完全相同
address:     上海市静安区南京西路 1788 号(同一地址)
notes:       橘色狸花,胖胖的,佩戴粉色项圈
tags:        ["走失", "佩戴项圈"]
photos:      [/static/uploads/animals/a9-1.jpg]
关联 user5:  user5 提交 report
预期:        系统不合并到 A1(物种过滤)
```

#### A10 - 团子(已认领)
```
animal_id:  <uuid>
species:     cat
breed:       英短
color:       蓝灰色
gender:      female
age:         adult
health:      ill
sterilized:  true
status:      claimed   ← 已是待认领状态
location:    lat=31.2500, lng=121.3950
address:     上海市普陀区长寿路 200 号
notes:       英短蓝猫,眼睛有分泌物,需治疗
tags:        ["走失", "生病"]
photos:      [/static/uploads/animals/a10-1.jpg]
关联 user5:  user5 申请认领
```

---

## 4. 鼻纹数据设计

每只动物(除 A1/A5 因为 A2/A6 是同一只)关联 1-3 个鼻纹样本。**鼻纹照片由用户提供**。

| 编号 | 鼻纹照片 | 录入位置 | 采集人 |
|---|---|---|---|
| A1 | /static/uploads/nose/a1-nose.jpg | S2 user1 采集 | user1 |
| A3 | /static/uploads/nose/a3-nose.jpg | 预录入(已有鼻纹) | user2 |
| A4 | /static/uploads/nose/a4-nose.jpg | 预录入 | user3 |
| A5 | /static/uploads/nose/a5-nose.jpg | 预录入 | user4 |
| A7 | /static/uploads/nose/a7-nose.jpg | 预录入 | user3 |
| A8 | /static/uploads/nose/a8-nose.jpg | 预录入 | user4 |
| A9 | /static/uploads/nose/a9-nose.jpg | 预录入 | user5 |
| A10 | /static/uploads/nose/a10-nose.jpg | 预录入 | user5 |

> 鼻纹特征向量由后端 `matching` 模块自动生成,不需要手动构造 128 维向量。

---

## 5. 数据录入参考 SQL

> **重置数据库:** 在录入前执行 `TRUNCATE` 清理 5 张表(参考 `backend/seed.py` 第 44-47 行)
> **本节为参考,用户可选择:**
> - 方案 A:复制 SQL 到 MySQL 客户端执行
> - 方案 B:通过 admin 后台"新增动物"页面录入
> - 方案 C:改编 `backend/seed.py` 然后 `python seed.py` 跑一遍

### 5.1 清理表(必做)

```sql
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE nose_features;
TRUNCATE TABLE claims;
TRUNCATE TABLE rescue_events;
TRUNCATE TABLE animals;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;
```

### 5.2 录入用户(复用现有,可跳过)

参考 `backend/seed.py` 第 52-74 行,保留 admin/user1-user5 即可。

### 5.3 录入动物(参考示例,A1 一条)

```sql
INSERT INTO animals (
  animal_id, status, species, breed, color, gender,
  age_estimate, health_status, sterilized,
  first_seen_at, last_seen_at,
  location_lat, location_lng, address, notes, tags, photos,
  size, coat_length, ear_type, tail_type,
  created_at, updated_at
) VALUES (
  'a1xxxx-xxxx-xxxx', 'lost', 'dog', '金毛', '金色', 'male',
  'adult', 'healthy', true,
  '2026-07-01 10:00:00', '2026-07-03 09:00:00',
  31.2280, 121.4470,
  '上海市静安区南京西路 1788 号(静安公园)',
  '佩戴蓝色项圈,尾巴尖有白毛,亲人',
  '["走失", "佩戴项圈", "亲人"]',
  '["/static/uploads/animals/a1-1.jpg", "/static/uploads/animals/a1-2.jpg"]',
  'large', 'long', 'floppy', 'long',
  NOW(), NOW()
);
```

> 其它 9 只动物参照此模板,字段值见 §3.3。

### 5.4 录入鼻纹(参考示例)

```sql
INSERT INTO nose_features (
  vector_id, animal_id, feature_vector, vector_dimension,
  nose_photo_url, landmark_data, confidence_score, is_primary,
  collection_angle, model_version, liveness_check_passed, created_at
) VALUES (
  'v1xxxx-xxxx', 'a1xxxx-xxxx',  -- vector 128 维留空,后端自动提取
  128,
  '/static/uploads/nose/a1-nose.jpg',
  '{"landmarks": [], "bbox": [100, 100, 200, 200]}',
  0.95, true, 'front', 'v1.0.0', true, NOW()
);
```

> `feature_vector` 字段类型是 BLOB,需要后端 `POST /api/nose/extract` 自动生成。**录入时先留空或 0 长度,后端采集鼻纹时会自动填充**。

### 5.5 预录入事件(让数据库有初始数据)

可以预录 3-5 条"已确认"事件作为基线:

```sql
-- A1 的初始走失事件(由 user1 提交,但这里以 admin 代录入)
INSERT INTO rescue_events (
  event_id, animal_id, event_type, reporter_id,
  occurred_at, location_lat, location_lng, address,
  description, is_duplicate, status, created_at
) VALUES (
  'e1xxxx-xxxx', 'a1xxxx-xxxx', 'report', '<user1 的 user_id>',
  '2026-07-01 10:00:00', 31.2280, 121.4470,
  '上海市静安区南京西路 1788 号(静安公园)',
  '我家金毛豆豆 7/1 上午从家里走失,佩戴蓝色项圈',
  false, 'confirmed', NOW()
);
```

> **预录入 vs 实时录入:** 建议先录入动物档案和 1 条基线事件(每个 status 各 1 条),然后**通过小程序实时触发**剩下的事件,这样能真实测试用户操作流程。

---

## 6. 10 个测试场景剧本

每个场景格式:**前置 → 操作步骤 → 预期结果**。

### S1 - 走失上报(主人,丢失后上报)

**前置:** user1 登录小程序,首页可见
**操作:**
1. user1 点击首页"采集"按钮,进入 `/pages/collect/index`
2. 拍摄/上传 A1 豆豆的照片(2 张)
3. 拍摄 A1 鼻纹照片
4. 填写描述:"金毛,佩戴蓝色项圈,尾巴尖有白毛"
5. 选择位置:静安公园(31.2280, 121.4470)
6. 提交

**预期结果:**
- user1 个人页"我的上报"列表新增 1 条
- 首页"全部" tab 可见豆豆(状态:走失中,红条)
- 鼻纹特征已上传(`/api/nose/extract` 返回 200,特征入库)
- admin 后台"事件列表"出现 1 条 `pending` 状态事件,类型=report

### S2 - 鼻纹采集(主人给自家走失狗采鼻纹)

**前置:** A1 档案已存在,user1 登录
**操作:**
1. user1 进入"我的上报" → 找到豆豆卡片
2. 点击"鼻纹比对"按钮
3. 上传 A1 鼻纹照(用户提供)
4. 等待比对结果

**预期结果:**
- 返回"无匹配结果"或"匹配到豆豆(自己)"(高相似度)
- 鼻纹记录新增到 `nose_features` 表,`animal_id` 关联 A1
- A1 的 `primary_nose_id` 字段被设置

### S3 - 同区发现触发事件合并(核心:位置+GPS 相似度)

**前置:** A1 已存在,user1 退出,user2 登录
**操作:**
1. user2 进入首页"发现上报"页(`/pages/report/index`)
2. 上传 A1 的照片(同只狗,user2 视角)
3. 描述:"在静安公园又看到一只金毛,跟 user1 描述的豆豆很像"
4. 位置:静安公园(31.2285, 121.4475,距 A1 约 80m)
5. 提交

**预期结果:**
- user2 个人页"我的上报"新增 1 条
- **系统自动合并**:A1 的事件数 +1,新事件 `status=duplicated`,`duplicate_of=<A1 animal_id>`,`fusion_score > 0.8`
- 首页"全部" tab 豆豆卡片显示"已 2 次上报"标记
- admin 后台"事件合并"页应能看到这次合并记录

### S4 - 跨区发现(主人)

**前置:** A3 预录入为 lost 状态,user2 登录
**操作:**
1. user2 进入"我的上报" → 找到大黄(自己的狗,走失中)
2. 大黄卡片显示位置"浦东金桥"
3. (模拟)大黄被人在虹口捡到,user2 提交一次"新发现"报告
4. 描述:"在虹口看到大黄,右后腿受伤"
5. 位置:虹口(31.2650, 121.4980,距 A3 位置 >5km)

**预期结果:**
- 新事件入库,`status=pending`,`animal_id` **不**关联到 A3(距离太远,不会自动合并)
- admin 后台"事件列表"出现 1 条独立 pending 事件
- admin 人工审核后可手动关联到 A3

### S5 - 纯发现(第三方捡到)

**前置:** user3 登录
**操作:**
1. user3 进入"发现上报"
2. 上传 A4 小白照片
3. 描述:"路边捡到一只萨摩耶,穿红色背心,疑似走失"
4. 位置:虹口四川北路(31.2650, 121.4980)
5. 提交

**预期结果:**
- A4 状态保持 `found`
- user3 个人页"我的上报"新增 1 条
- 首页"待认领" tab 出现小白卡片
- admin 后台"事件列表"出现 1 条 `pending` 事件

### S6 - 待认领 + 主人认领申请(同区合并 + 跨区认领)

**前置:** A5/A6(同区合并)、A7/A8(跨区)预录入,user3 登录
**操作:**
1. user3 在首页看到 A7 花花(已走失 3 天,已联系主人),点击进入详情
2. 详情页点击"认领申请"
3. 填写认领理由,提交
4. 切换到 user4(user4 申请认领 A8 黑妞)
5. user4 在 A8 详情页提交认领申请
6. 切换到 user4,user4 同时也是 A5 旺财的主人,A6 由第三方提交(系统已自动合并)

**预期结果:**
- `claims` 表新增 2 条:
  - user3 申请 A7,status=pending
  - user4 申请 A8,status=pending
- admin 后台"认领审批"页出现 2 条待审批
- A5/A6 已合并为同一动物,旺财的事件数 ≥ 2

### S7 - 鼻纹匹配成功

**前置:** A7 花花已存在,user3 登录
**操作:**
1. user3 在首页/详情页点击"鼻纹比对"
2. 上传 A7 鼻纹照(用户提供)
3. 等待后端匹配

**预期结果:**
- 返回"匹配到 A7(花花),相似度 0.92+"
- 如果相似度 > 0.85,自动关联到 A7;否则提示"无匹配"
- admin 后台"鼻纹匹配记录"新增 1 条

### S8 - admin 审批认领(通过/驳回)

**前置:** S6 已提交 2 条 pending 认领,admin 登录
**操作:**
1. admin 进入"认领审批"页
2. 审批 user3 申请 A7:填写审核意见"已与主人电话确认,通过",点击通过
3. 审批 user4 申请 A8:填写"围脖颜色不匹配,主人已说明是棕色,这只描述不符,驳回",点击驳回

**预期结果:**
- A7 状态从 `lost` → `claimed`(待认领)
- A8 状态保持 `found`
- user3 个人页"我的认领"显示"已通过"
- user4 个人页"我的认领"显示"已驳回" + 驳回原因
- admin 操作日志记录 2 条审批

### S9 - 跨物种同位置不合并(关键验证:物种过滤)

**前置:** A1 狗已存在,user5 登录
**操作:**
1. user5 进入"发现上报"
2. 上传 A9 咪咪(猫)照片
3. 描述:"静安公园发现橘色猫,佩戴粉色项圈"
4. 位置:静安公园(31.2280, 121.4470,**与 A1 完全相同**)
5. 提交

**预期结果:**
- **关键验证:** A9 不合并到 A1(物种过滤)
- `rescue_events` 新增 1 条独立事件,`animal_id` 关联 A9,**不**是 A1
- 首页"全部" tab 同时显示豆豆(狗)和咪咪(猫)两张卡片
- admin 后台"事件列表"出现 1 条 `pending` 事件,与 A1 无关

### S10 - admin 状态流转(走失→待认领→已认领)

**前置:** S8 已将 A7 转 claimed,admin 登录
**操作:**
1. admin 进入 A7 详情页
2. 点击"标记为已认领",填写"主人已亲自接回"
3. (可选)点击"归档"

**预期结果:**
- A7 状态从 `claimed` → `archived`(或自定义流转,看实际实现)
- 首页"全部" tab 不再显示 A7(或灰显)
- 状态变更记录写入日志

---

## 7. 预期效果对照总表

> **此表是用户对照测试的核心:** 每行一个场景,操作完成后逐项打勾

| 场景 | 数据状态变化 | user 端可见 | admin 后台可见 |
|---|---|---|---|
| S1 走失上报 | A1 状态=lost,事件 1 条 | 首页红条卡片,user1 我的上报 +1 | 事件列表 pending +1 |
| S2 鼻纹采集 | A1 primary_nose_id 设置 | 鼻纹比对页"匹配到豆豆" | 鼻纹特征 +1 |
| S3 同区合并 | A1 事件数 = 2,新事件 duplicated | 豆豆卡片"已 2 次上报" | 事件合并页 +1 合并记录 |
| S4 跨区发现 | A3 事件 +1,不合并 | user2 我的上报 +1 | 事件列表 +1 pending(独立) |
| S5 纯发现 | A4 状态=found | 待认领 tab 出现小白 | 事件列表 +1 pending |
| S6 待认领+申请 | claims +2,都是 pending | user3/user4 我的认领 +1 | 认领审批 +2 pending |
| S7 鼻纹匹配 | nose_features +1 | 鼻纹比对页"匹配到花花" | 鼻纹匹配记录 +1 |
| S8 admin 审批 | A7→claimed, A8 不变 | user3 通过,user4 驳回 | 操作日志 +2 |
| S9 跨物种不合并 | A9 独立,事件不关联 A1 | 首页同时显示 A1 和 A9 | 事件列表 +1,无合并 |
| S10 状态流转 | A7→archived | 首页不显示或灰显 | 状态变更日志 +1 |

---

## 8. 关键验证点 Checklist

测试完成后,逐项验证:

### 8.1 状态覆盖
- [ ] 走失(lost)状态有 5 只
- [ ] 发现(found)状态有 2 只
- [ ] 待认领(claimed)状态有 2 只
- [ ] 已认领(archived)状态有 1 只

### 8.2 事件类型覆盖
- [ ] report 事件 6-8 条
- [ ] collect 鼻纹采集 4-5 条
- [ ] medical/rescue 0-1 条(可选)

### 8.3 位置策略
- [ ] A1+A2 同区触发自动合并
- [ ] A5+A6 同区触发自动合并
- [ ] A1+A9 跨物种同位置**不**合并
- [ ] 其它 7 只跨区**不**合并

### 8.4 业务流程
- [ ] 走失上报 → admin 看到 pending → 主人上传鼻纹 → 鼻纹匹配
- [ ] 发现上报 → 系统自动合并(或保持独立)
- [ ] 待认领申请 → admin 审批 → 状态流转
- [ ] 跨物种不合并(物种过滤生效)

### 8.5 UI 表现
- [ ] 搜索栏不被下拉刷新覆盖(S1 修复后)
- [ ] 列表/详情页状态徽章正确显示
- [ ] 我的上报/认领列表正确展示用户操作历史
- [ ] admin 后台事件/认领/动物列表正确展示

---

## 9. 关键文件参考

- `backend/seed.py` — 数据库填充参考(可改编)
- `backend/src/animals/entities/animal.entity.ts` — animal 字段定义
- `backend/src/events/entities/event.entity.ts` — event 字段定义
- `miniapp-user/src/pages/collect/index` — 鼻纹采集入口
- `miniapp-user/src/pages/report/index` — 发现上报入口
- `miniapp-admin/src/pages/events` — admin 事件审核
- `miniapp-admin/src/pages/claims` — admin 认领审批

---

## 10. 下一步

- 用户审核本 spec
- 通过后:用户按 §3-§5 录入数据,按 §6 场景逐个测试,按 §7 对照
- 测试中发现的问题:用 systematic-debugging 流程修复
