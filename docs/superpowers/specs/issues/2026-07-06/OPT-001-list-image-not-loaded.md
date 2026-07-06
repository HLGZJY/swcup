# OPT-001 "我的上报"列表卡片图片不显示

**优先级**: ⚪ P3  
**标签**: `enhancement`, `frontend`, `image`  
**发现时间**: 2026-07-06  
**测试场景**: P1

---

## 现象

user1 进入"我的上报"列表,每张动物卡片显示的是占位静态图,**不加载实际动物照片**。

## 复现步骤

1. user1 登录 → "我的" → "我的上报"
2. 查看列表里的动物卡片

## 预期

每张卡片显示 `animal.photos[0]` 的实际图片。

## 实际

卡片显示默认占位图。

## 证据

P1 用户原话: "我的上报列表对应动物图片没有预览加载出来,显示的是一个图片的静态图,不算 bug,仅作可优化选项"

## 修复建议

### 前端 `miniapp-user/src/pages/my-reports/index.vue`

```vue
<view class="report-card" v-for="item in list" :key="item.event_id">
  <image
    class="thumb"
    :src="item.animal?.photos?.[0] || '/static/placeholder.png'"
    mode="aspectFill"
    @error="onImgError(item)"
  />
  <view class="meta">
    <text>{{ item.animal?.name || '未命名' }}</text>
    <text>{{ item.event_type }} · {{ item.created_at }}</text>
  </view>
</view>

<script>
function onImgError(item) {
  // 兜底:使用鼻子照片或占位图
  if (item.nose_photo_url && item._imgFallback !== true) {
    item._imgFallback = true;
    item.animal.photos = [item.nose_photo_url];
  }
}
</script>
```

### 后端确认

确认 `GET /v1/events/my` 返回的列表里 `animal.photos` 字段是数组(不是字符串):
```json
{
  "events": [
    {
      "event_id": "...",
      "animal": {
        "animal_id": "...",
        "name": "豆豆",
        "photos": ["/static/uploads/animals/A1.jpg"],
        ...
      }
    }
  ]
}
```

## 验收标准

- [ ] "我的上报"列表显示真实动物照片
- [ ] 加载失败时优雅降级(占位图或鼻纹照)
- [ ] 图片懒加载(避免一次请求 20+ 张)

## 关联

- 同类型可能影响"我的认领"列表、"发现"tab 等