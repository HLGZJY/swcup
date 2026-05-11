# W2 进度追踪 — AI 服务（feature/ai-model）

> 更新时间：2026-05-11
> 负责人：AI模型开发专家（队长）

---

## 阶段目标（W2：5.11–5.17）

- [x] 创建 FastAPI 项目骨架
- [x] 完成 `/health`、`/extract/feature`、`/detect/liveness`、`/compare` 四个 API 端点
- [ ] 安装依赖 + 本地启动验证（依赖 PyTorch 下载，受网络限制）
- [ ] W3 前完成训练脚本 `scripts/train_stage1.py`
- [ ] W3 前完成评测脚本 `scripts/evaluate.py`

---

## 已完成工作

### 1. 项目骨架创建

**目录结构：**
```
ai-service/
├── src/
│   ├── main.py              # FastAPI 入口
│   ├── api/
│   │   ├── detect.py        # POST /detect/liveness
│   │   ├── extract.py       # POST /extract/feature
│   │   └── compare.py       # POST /compare
│   ├── models/
│   │   └── mobilenet.py     # MobileNetV2_128d 模型
│   ├── utils/
│   │   ├── image.py         # 图片预处理 + 质量检测
│   │   └── vector.py        # 余弦相似度
│   ├── scripts/            # 训练脚本（待实现）
│   ├── tests/
│   │   └── test_api.py      # API 测试脚本
│   └── weights/            # 权重目录（待训练）
├── requirements.txt
└── Dockerfile
```

**commit：** `53ad5ad [250511] feat-ai | AI服务骨架：FastAPI + MobileNetV2 + 3个API端点`

### 2. API 端点实现

| 端点 | 方法 | 输入 | 输出 | 状态 |
|------|------|------|------|------|
| `/health` | GET | - | `{status: "ok"}` | ✅ |
| `/detect/liveness` | POST | `{image: base64}` | `{quality, score}` | ✅ |
| `/extract/feature` | POST | `{image: base64}` | `{vector: [128], shape: [128]}` | ✅ |
| `/compare` | POST | `{vector_a: [128], vector_b: [128]}` | `{similarity, distance}` | ✅ |

### 3. 架构设计文档更新

- 修正 3.3 节 AI 服务端点清单，统一为实际实现路径
- 明确融合打分在后端 Node.js 计算，AI 服务只负责 `vector` 输出

---

## 待完成任务

### 依赖安装（阻塞项）

PyTorch 约 80MB，下载超时，需在有网络的环境手动安装：
```bash
cd /mnt/f/swcup2026/ai-service
uv venv .venv
uv pip install -r requirements.txt
```

### 启动验证

```bash
cd /mnt/f/swcup2026/ai-service
source .venv/bin/activate
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

curl 测试：
```bash
curl -X GET http://localhost:8000/health
curl -X POST http://localhost:8000/detect/liveness \
  -H "Content-Type: application/json" \
  -d '{"image": "<base64图片>"}'
```

---

## 技术决策记录

1. **模型结构**：直接用 MobileNetV2 预训练权重（ImageNet），不自己训练检测网络，简化 W2 工作量
2. **向量维度**：128 维（ArcFace 输出层），L2 归一化
3. **活体检测**：简化为图片质量检测（模糊度 + 亮度），不引入复杂活体检测模型
4. **向量存储**：MySQL BLOB(512) = 128×4 字节，由后端负责存储，AI 服务只管提取

---

## 下一步（W3：5.18–5.24）

- [ ] 数据集采集（目标 ≥500 组）
  - Oxford Pets 公开数据集
  - images.cv Dog Nose 数据集
  - 自采集图片
- [ ] `scripts/train_stage1.py` — 阶段一训练（冻结 backbone，只训练 128 维 fc 层）
- [ ] `scripts/train_stage2.py` — 阶段二训练（解冻最后 2 个卷积块 + ArcFace Loss）
- [ ] `scripts/evaluate.py` — Top-1 Accuracy / ROC AUC 评测
- [ ] 训练输出权重到 `weights/stage1.pth` 和 `weights/mobilenet_v2_128d.pth`
