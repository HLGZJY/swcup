# E2E 模拟机测试清单(2026-07-06)

> 数据库已重置: **animals=10 / nose_features=8 / users=24** (6 utest 账号 + 旧 seed 残留)
> 测试素材: `F:\swcup2026\test_data\测试批\`(A1-A10.jpg + A9.png + aa1/3/4/5/7/8/9/10.jpg)
> 预录入脚本: `backend/prep-test-data.py` (可重跑,会 TRUNCATE 4 张表后重建)
>
> **测试方式**: 微信开发者工具打开 miniapp-user 与 miniapp-admin, 用 6 个 utest 账号在小程序模拟器里逐场景走一遍, 把 "实测结果" / "证据截图" 列填上。

---

## 0. 测试账号(密码统一 `test1234`)

| 角色 | 账号 | 昵称 | 在测试中的定位 |
|---|---|---|---|
| admin | 13900000088 | 测试管理员 | 审核事件、审批认领、状态流转 |
| user1 | 13800000020 | 测试-李明 | A1 豆豆走失主人 + S2 鼻纹采集 |
| user2 | 13800000021 | 测试-王小红 | A3 大黄走失主人 + S3 同区发现 |
| user3 | 13800000022 | 测试-张小华 | A4 小白捡到者 + S7 A7 鼻纹匹配 |
| user4 | 13800000023 | 测试-陈建国 | A5 旺财走失主人 + S6 A8 认领 |
| user5 | 13800000024 | 测试-刘秀英 | A9 咪咪走失主人 + A10 团子认领 |

> **不要用旧 seed.py 账号**(13900000001 / 13800000002~08 等), `password_hash` 不匹配。

---

## 1. 预录入 10 只动物 + 8 个鼻纹(已自动完成)

| 编号 | 名字 | 种类 | 品种 | 颜色 | 性别 | 年龄 | 健康 | 绝育 | **状态** | 位置 |
|---|---|---|---|---|---|---|---|---|---|---|
| **A1** | 豆豆 | dog | 金毛 | 金色 | male | adult | healthy | ✅ | **lost** | 静安公园 (31.2280, 121.4470) — 走失锚点 |
| **A2** | 豆豆(二次发现) | dog | 金毛 | 金色 | male | adult | healthy | ✅ | **lost** | 静安公园 (31.2285, 121.4475) — 距 A1 **~80m** |
| **A3** | 大黄 | dog | 拉布拉多 | 黄色 | male | adult | injured | ✅ | **lost** | 浦东金桥 (31.2550, 121.5950) — 跨区 |
| **A4** | 小白 | dog | 萨摩耶 | 白色 | male | puppy | healthy | ✅ | **found** | 虹口四川北路 (31.2650, 31.4980) |
| **A5** | 旺财 | dog | 土狗 | 棕色 | female | adult | healthy | ❌ | **lost** | 徐汇衡山路 (31.1950, 121.4350) — 走失锚点 |
| **A6** | 旺财(二次发现) | dog | 土狗 | 棕色 | female | adult | healthy | ❌ | **lost** | 徐汇衡山路 (31.1958, 121.4358) — 距 A5 **~100m** |
| **A7** | 花花 | dog | 边牧 | 黑白 | female | adult | healthy | ✅ | **lost** | 长宁中山公园 (31.2200, 121.4180) |
| **A8** | 黑妞 | dog | 柴犬 | 黑色 | female | adult | healthy | ❌ | **found** | 闵行莘庄 (31.1100, 121.3820) |
| **A9** | 咪咪 | cat | 中华田园猫 | 橘色 | male | adult | healthy | ❌ | **lost** | 静安公园 (31.2280, 121.4470) — **与 A1 同位** |
| **A10** | 团子 | cat | 英短 | 蓝灰色 | female | adult | ill | ✅ | **claimed** | 普陀长寿路 (31.2500, 121.3950) |

鼻纹: A1/A3/A4/A5/A7/A8/A9/A10 各有 1 个 (aa1/3/4/5/7/8/9/10.jpg), 已写入 `nose_features` 且各自 `primary_nose_id` 关联。**A2/A6 没有鼻纹**(因为是同区二次发现,本来就不需要)。

区域策略:
- **同区合并**: A1+A2(80m) 和 A5+A6(100m) 应自动合并
- **跨物种同位置**: A9(猫) 和 A1(狗) 位置完全相同, 系统应不合并
- **跨区**: A3/A4/A7/A8/A10 都不应触发合并

---

## 2. 预录入数据自查(开始测试前 ✅ 一下)

| 项 | 命令 / 操作 | 期望 | 实测 |
|---|---|---|---|
| animals count | `mysql -e "SELECT COUNT(*) FROM animals;"` | 10 | ☐ |
| nose_features count | `mysql -e "SELECT COUNT(*) FROM nose_features;"` | 8 | ☐ |
| users count | `mysql -e "SELECT COUNT(*) FROM users;"` | ≥ 6 | ☐ |
| 6 个 utest 账号可用 | admin 后台 → 用户列表 | 李明 / 王小红 / 张小华 / 陈建国 / 刘秀英 / 测试管理员 | ☐ |
| user1 登录 user 端 | 小程序登录页 13800000020 / test1234 | 进入首页 | ☐ |
| admin 登录 admin 端 | 后台登录页 13900000088 / test1234 | 进入 dashboard | ☐ |
| 首页 9 张卡片 | user1 首页 | 看到 A1-A10 (状态徽章颜色各异) | ☐ |

---

## 3. 10 个场景走查清单

> 格式: **场景 → 步骤 → 预期 → 实测结果**(让你填)

### S1 — 走失上报 (user1 → A1)

| 项 | 内容 |
|---|---|
| 步骤 | user1 拍 A1.jpg 照片 + 上传 → 采集鼻纹(可选, S2 也行)→ 提交走失上报 |
| 预期 | 首页 A1 列表出现, user1 "我的上报" +1, admin 后台事件列表 +1 pending |
| 实测结果 | ☐ pass / ☐ fail — 证据 / 备注: |

### S2 — 鼻纹采集 (user1 → A1)

| 项 | 内容 |
|---|---|
| 步骤 | user1 在我的上报里找 A1 → 进入详情 → "鼻纹比对" → 重新拍鼻纹(用 aa1.jpg) → 等结果 |
| 预期 | 提示"匹配到豆豆(自己)" 高相似度, A1.primary_nose_id 已设置 (本来就有) |
| 实测结果 | ☐ pass / ☐ fail — 证据 / 备注: |

### S3 — 同区发现合并 (user2 在距 A1 ~80m 处)

| 项 | 内容 |
|---|---|
| 步骤 | user2 退出, user2 登录 → 首页 → A2 卡片 → 进入详情 → "鼻纹比对" 上传 aa1.jpg → 选"A2 豆豆(二次发现)"(若有选) → 提交 report 事件; 或直接 `/pages/report/index` 选择 A2 走失上报 |
| 预期 | admin 后台事件列表 +1 pending; admin 审核 → fusion_score≈1.0, 自动合并到 A1, A1.report_count 增长 |
| 实测结果 | ☐ pass / ☐ fail — 证据 / 备注: |

### S4 — 跨区发现 (user2 在 A3 跨区)

| 项 | 内容 |
|---|---|
| 步骤 | user2 进入 A3 详情 → 提交 report 事件 (位置不变, A3 自带主人) |
| 预期 | admin 事件列表 +1 pending (独立事件, 不合并) |
| 实测结果 | ☐ pass / ☐ fail — 证据 / 备注: |

### S5 — 纯发现 (user3 捡到 A4)

| 项 | 内容 |
|---|---|
| 步骤 | user3 登录 → 进入 A4 详情(已 found) → 提交发现事件 |
| 预期 | A4 状态保持 found, user3 我的上报 +1 |
| 实测结果 | ☐ pass / ☐ fail — 证据 / 备注: |

### S6 — 认领申请 (user3 → A7, user4 → A8)

| 项 | 内容 |
|---|---|
| 步骤 | user3 进入 A7 → 申请认领 / user4 进入 A8 → 申请认领 |
| 预期 | admin 认领审批 +2 pending |
| 实测结果 | ☐ pass / ☐ fail — 证据 / 备注: |

### S7 — 鼻纹匹配 (user3 → A7 鼻纹)

| 项 | 内容 |
|---|---|
| 步骤 | user3 进入 A7 详情 → "鼻纹比对" 上传 aa7.jpg → 等结果 |
| 预期 | 匹配到 A7, similarity 高 (>= 0.88) |
| 实测结果 | ☐ pass / ☐ fail — 证据 / 备注: |

### S8 — admin 审批

| 项 | 内容 |
|---|---|
| 步骤 | admin 登录 admin 端 → 待审中心 → 认领审核 → 通过 user3/A7 + 驳回 user4/A8 |
| 预期 | A7.status → claimed, A8.status 保持 found |
| 实测结果 | ☐ pass / ☐ fail — 证据 / 备注: |

### S9 — 跨物种不合并 (user5 → A9 在 A1 同位置)

| 项 | 内容 |
|---|---|
| 步骤 | user5 进入 A9 详情 → 提交 report 事件 (位置就是 A9 自带的静安公园) |
| 预期 | admin 流程跑完, **不**合并到 A1 (物种过滤, 即使 fusion 不高, 也不会把猫合并到狗) |
| 实测结果 | ☐ pass / ☐ fail — 证据 / 备注: |

### S10 — 状态流转 (admin 把 A7 archived)

| 项 | 内容 |
|---|---|
| 步骤 | admin 端 → 动物详情 A7 → 状态改为 archived → 保存 |
| 预期 | A7.status → archived, 首页不再显示 / 灰色 |
| 实测结果 | ☐ pass / ☐ fail — 证据 / 备注: |

---

## 4. 关键功能验证 Checklist

### 4.1 状态覆盖
| 项 | 预期 | 实测 |
|---|---|---|
| A1+A2 同区(~80m) 触发合并 | admin process 后 fusion≈1.0, is_duplicate=1 | ☐ |
| A5+A6 同区(~100m) 触发合并 | 同上 | ☐ |
| A1+A9 跨物种同位 **不**合并 | fusion 较低, 不合并到 A1 | ☐ |
| 跨区(A3/A4/A7/A8/A10)**不**合并 | is_duplicate=0 | ☐ |
| 4 种状态徽章颜色正确 | lost=红 / found=绿 / claimed=橙 / archived=灰 | ☐ |
| 上报次数显示正确 | 已 N 次上报徽章在 A1/A5 上出现 | ☐ |

### 4.2 UI 表现
| 项 | 预期 | 实测 |
|---|---|---|
| 首页搜索栏不被下拉刷新覆盖 | 下拉时搜索栏仍可见 | ☐ |
| 列表/详情页状态徽章正确 | 4 色徽章一致 | ☐ |
| 我的上报/认领列表正确 | 数量与 API 返回一致 | ☐ |
| admin 后台事件/认领/动物列表正确 | pending 计数对得上 | ☐ |

### 4.3 异常场景(可选)
| 项 | 现象 | 实测 |
|---|---|---|
| 上传相同鼻纹 2 次 | 第二次 dedup, similarity≈1.0, 关联到首张 | ☐ |
| GPS NULL 上报 | 后端拒绝 / 提示 (400) | ☐ |
| 上报时宠物信息字段(年龄/健康/绝育)缺失 | 后端允许 unknown, 但前端应给默认值 | ☐ |
| 用旧 seed.py 账号登录 | 提示密码错误(测试账号隔离) | ☐ |

---

## 5. 数据校验辅助脚本(可选)

若想边测边核对后端, 管理员可以在终端跑:

```bash
# 当前动物 + 状态
mysql -u root -prootpassword -h 127.0.0.1 -P 3307 nose_rescue \
  -e "SELECT name, species, status, report_count, location_lat, location_lng FROM animals ORDER BY id;"

# 当前事件 + 合并状态
mysql -u root -prootpassword -h 127.0.0.1 -P 3307 nose_rescue \
  -e "SELECT event_type, status, is_duplicate, duplicate_of, fusion_score, location_lat, location_lng FROM rescue_events ORDER BY created_at DESC LIMIT 20;"

# 当前认领申请
mysql -u root -prootpassword -h 127.0.0.1 -P 3307 nose_rescue \
  -e "SELECT c.claim_id, c.status, u.phone, a.name FROM claims c JOIN animals a ON c.animal_id=a.animal_id JOIN users u ON c.user_id=u.user_id ORDER BY c.created_at DESC;"

# 重置数据(慎用!会清掉 4 张表)
mysql -u root -prootpassword -h 127.0.0.1 -P 3307 nose_rescue \
  -e "SET FOREIGN_KEY_CHECKS=0; TRUNCATE TABLE nose_features; TRUNCATE TABLE claims; TRUNCATE TABLE rescue_events; TRUNCATE TABLE animals; SET FOREIGN_KEY_CHECKS=1;"
# 然后: cd backend && python prep-test-data.py
```

---

## 6. 测试完成后填这两个数

- **总场景通过**: _____ / 10
- **Checklist 通过**: _____ / 14 (4.1=5 + 4.2=4 + 4.3 选做)

---

## 7. 复位(整轮测试完想从头跑)

```bash
cd F:\swcup2026\backend
python prep-test-data.py
```

会:
1. TRUNCATE 4 张表 (animals / nose_features / claims / rescue_events)
2. 重新采集 8 个鼻纹并记录 UUID 到 `.prep_cache.json`
3. 插入 10 只动物, primary_nose_id 关联上一步的 8 个鼻纹 (A2/A6 无鼻纹)

> 注: `users` 表 **不会清**, 6 个 utest 账号一直在, 重跑可以直接复用。
