# AI 服务接入方案

## 当前状态：可用的真实 AI 服务（阶段一模型）

`POST /nose/compare` 已切换为真实 AI 服务（阶段一 Oxford Pets 预训练权重）。

模型文件：`weights/stage1_oxford.pth`（512维向量输出，L2归一化）

### 为什么这样做

- AI 服务尚未部署，无法连接
- 前端需要可用的接口完成调试
- 业务逻辑（认领流程）可正常流转

### Mock 返回值

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "similarity": 91.5,
    "match": true,
    "matched_animal_id": "a001",
    "message": "鼻纹匹配成功，相似度 91.5%，建议进行认领"
  }
}
```

## AI 服务就绪后

### 需要修改的文件

1. `src/nose/nose.service.ts` — `compareNose()` 方法
2. `docs/AI服务接口文档.md` — 有具体的对接协议

### 对接步骤

1. 读取 `docs/AI服务接口文档.md` 确认接口规范
2. 将 `compareNose()` 中的 mock 逻辑替换为真实 HTTP 调用
3. 关键字段映射：`similarity` → AI 返回的相似度分数
4. 认领阈值 85% 保持不变

### 注意事项

- AI 服务地址和密钥需配置到 `.env`（参考 `docs/AI服务接口文档.md` 第 4 节）
- 考虑 AI 服务超时（建议 10s），加 `try-catch` 降级 mock
- 建议 AI 服务单独部署，前端不直接访问