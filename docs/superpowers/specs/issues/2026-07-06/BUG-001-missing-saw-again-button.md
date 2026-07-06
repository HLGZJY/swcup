# BUG-001 缺"又看到这只狗"上报按钮

**优先级**: 🟠 P1  
**标签**: `bug`, `frontend`, `collect`, `ux`  
**发现时间**: 2026-07-06  
**测试场景**: P2, P6

---

## 现象

用户在 user 端采集页面,当鼻纹比对检测到与已有动物重复时,UI 只给一个"认领此动物"按钮,**没有"又看到这只狗"按钮**。

## 复现步骤

1. user2 登录,采集页上传 A2.jpg + aa1.jpg(故意复用 A1 的鼻纹)
2. 位置选静安公园西侧(距 A1 约 80m)
3. 提交 → result 页提示"匹配到豆豆"
4. **观察**:result 页只有一个"认领此动物"按钮

## 预期

result 页应提供 3 个选项:
- **是这只**:进入 A1 详情,允许补充信息
- **又看到这只狗**:直接给 A1 增加一条"复发现场"上报事件
- **都不是**:允许创建新动物档案

## 实际

只有"认领此动物"按钮,用户复发现场无法给原档案补充发现记录。

## 用户原话

> "检测到重复只有认领此动物的按钮,并没有'又看到这只狗'按钮"
> "应该增加这次的发现记录到那只动物对应的记录下面"

## 根因假设

`pages/collect/result.vue`(或类似)result 组件:
- 没写"又看到"按钮的 UI
- 后端可能也没这个 action 的 endpoint,或者只支持"认领"

## 修复建议

### 前端(`miniapp-user/src/pages/collect/result.vue`)

```vue
<view v-if="matched">
  <view>匹配到:{{ matched.name }}(相似度 {{ matched.score }}%)</view>
  <button @click="onConfirmMatch">是这只</button>
  <button @click="onSightedAgain">又看到这只狗</button>
  <button @click="onNotMatch">都不是</button>
</view>

<script>
async function onSightedAgain() {
  await api.post('/v1/events', {
    animal_id: matched.animal_id,
    event_type: 'report',
    location_lat: form.lat,
    location_lng: form.lng,
    description: form.description,
    is_duplicate: 1,
    duplicate_of: matched.animal_id,
  });
  uni.showToast({ title: '已上报发现' });
  uni.navigateBack({ delta: 2 });
}
</script>
```

### 后端

确认 `POST /v1/events` 接受 `event_type=report` 且不强制走"创建新动物"流程。

## 验收标准

- [ ] result 页匹配命中时显示 3 个按钮
- [ ] 点"又看到这只狗"后:
  - DB `rescue_events` +1 (event_type=report, animal_id=已存在的)
  - 目标 animal.report_count +1
  - 用户看到 toast "已上报发现"
- [ ] 单元测试:result.vue 3 个按钮的 callback 路径

## 关联

- 同 [BUG-002](BUG-002-no-auto-merge.md)、[BUG-003](BUG-003-report-count-no-grow.md)、[BUG-004](BUG-004-event-not-inserted.md) 共同构成"复发现场流程缺失"