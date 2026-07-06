# BUG-004 重复检测后事件列表未新增记录

**优先级**: 🟠 P1  
**标签**: `bug`, `backend`, `event-insert`  
**发现时间**: 2026-07-06  
**测试场景**: P2

---

## 现象

复发现场时,前端显示"匹配到豆豆"后,用户点"是这只"或"又看到",`rescue_events` 表**没有新增** event_type=report 的事件记录。

## 复现步骤

1. user2 采集 A2.jpg + aa1.jpg → result 页匹配 A1
2. 选"是这只"或类似动作
3. 查询 DB `rescue_events WHERE animal_id = A1.animal_id`

## 预期

DB 多一条 event_type=report 记录(用户复现),事件总数 +1。

## 实际

DB 事件总数没变,只有最初创建 A1 时的那条 collect 事件。

## 证据

P2 验收点: "[0] 事件列表还是只有一条记录"

## 根因假设

当前 `result.vue` "匹配命中"后只显示动物卡片,**没 POST 一条 report 事件**。只有 confirm/认领动作才会触发事件写入。

## 修复建议

同 [BUG-001](BUG-001-missing-saw-again-button.md) 修复一起:加"又看到这只狗"按钮 → 按钮 callback 调 `POST /v1/events`。

## 验收标准

- [ ] 复发现场后,DB rescue_events 表事件总数 +1
- [ ] 新事件 event_type=report,is_duplicate=1,duplicate_of=目标 animal_id

## 关联

- 同 [BUG-001](BUG-001-missing-saw-again-button.md)、[BUG-002](BUG-002-no-auto-merge.md)