# AI 推理服务 — 鼻纹智救

> 负责：队长（AI模型 + 推理服务）
> 目录：`/mnt/f/swcup2026/ai-service/`

---

## 一、它是什么

AI 服务是一个**独立的 FastAPI 进程**，只做一件事：**把狗鼻子照片变成一串数字（128维向量）**。

- 它不处理业务逻辑（那是后端的事）
- 它不直接服务前端（只有后端 Node.js 能调它）
- 前端所有请求 → 后端 → 后端决定是否转发给 AI

---

## 二、技术栈

| 项目 | 技术 |
|------|------|
| 框架 | FastAPI + Uvicorn |
| 语言 | Python 3.10+ |
| AI框架 | PyTorch 2.x |
| 模型 | MobileNetV2（迁移学习，ImageNet预训练） |
| 图片处理 | PIL + OpenCV |
| 向量存储 | 纯 Python 列表，存储到 MySQL BLOB |

---

## 三、目录结构

```
ai-service/
├── src/
│   ├── api/
│   │   ├── detect.py       # 活体检测端点
│   │   ├── extract.py      # 特征提取端点
│   │   └── compare.py       # 向量比对端点
│   ├── models/
│   │   └── mobilenet.py     # MobileNetV2 模型加载与推理
│   ├── utils/
│   │   ├── image.py         # 图片预处理（缩放/归一化/PIL→Tensor）
│   │   ├── vector.py        # 向量计算（余弦相似度）
│   │   └── liveness.py     # 活体检测判断逻辑
│   └── main.py              # FastAPI 入口，路由注册
├── weights/                  # 模型权重（训练后放入）
│   └── mobilenet_v2_128d.pth
├── scripts/                  # 训练脚本（本地运行，不在服务中）
│   ├── train_stage1.py       # 阶段一：冻结backbone训练
│   ├── train_stage2.py       # 阶段二：解冻微调
│   ├── evaluate.py           # 评测脚本
│   └── augment.py            # 数据增强
├── tests/
│   └── test_api.py           # API 测试
├── requirements.txt
├── Dockerfile
└── README.md
```

---

## 四、API 端点清单

### 4.1 活体检测

```
POST /detect/liveness
```

**用途**：判断上传的照片是"真实狗鼻子"还是"照片/视频欺骗"。

**请求**：
```json
{
  "image": "base64字符串（JPEG/PNG，不超过10MB）"
}
```

**响应**：
```json
{
  "pass": true,
  "reason": "活体"
}
```

或
```json
{
  "pass": false,
  "reason": "检测到屏幕反光（疑似照片欺骗）"
}
```

**判断逻辑**：
- 检测人脸/狗脸是否存在
- 检测是否为照片边缘（直线/高对比度边缘）
- 检测屏幕反光特征（可选，放到W4）

> 注：W3 baseline 阶段可简化为"图片质量检测"（模糊度/亮度），活体检测放到W4做完整版。

---

### 4.2 特征提取（核心）

```
POST /extract/feature
```

**用途**：输入狗鼻子照片，输出128维特征向量。

**请求**：
```json
{
  "image": "base64字符串（JPEG/PNG）"
}
```

**响应**：
```json
{
  "vector": [0.12, -0.34, 0.58, -0.07, 0.89, ...],
  "confidence": 0.92
}
```

- `vector`：128维 float 列表，范围约 [-1, 1]
- `confidence`：照片质量分，0-1，越高说明鼻部区域越清晰
- 如果 confidence < 0.5，前端应提示用户重新拍摄

---

### 4.3 向量比对（可选）

```
POST /compare/vector
```

**用途**：计算两个向量的余弦相似度。（后端也可以自己算，这个端点可选）

**请求**：
```json
{
  "vector_a": [0.12, -0.34, ...],
  "vector_b": [0.11, -0.30, ...]
}
```

**响应**：
```json
{
  "similarity": 0.956
}
```

---

## 五、服务启动

### 5.1 本地运行

```bash
cd /mnt/f/swcup2026/ai-service
pip install -r requirements.txt

# 首次运行需要权重文件（训练后放入）
# weights/mobilenet_v2_128d.pth

uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5.2 测试

```bash
# 健康检查
curl http://localhost:8000/health

# 测试特征提取（需要一张狗鼻子照片转base64）
curl -X POST http://localhost:8000/extract/feature \
  -H "Content-Type: application/json" \
  -d '{"image": "/9j/4AAQSkZJRgABAQAASABIA..."}'
```

---

## 六、训练流程

> 训练在本地机器上跑，不需要在服务器上跑。跑完后把权重文件 `mobilenet_v2_128d.pth` 放到 `weights/` 目录。

### 6.1 数据集准备

| 来源 | 数量 | 说明 |
|------|------|------|
| 自采集 | ≥200组 | 实地拍摄，包含不同品种/角度/光照 |
| 开源数据集 | 补充至≥500组 | Oxford Pets + images.cv Dog Nose |

**标注格式**（每张图对应一个 `.json`）：
```json
{
  "image_path": "data/processed/dog001.jpg",
  "nose_bbox": [x1, y1, x2, y2],
  "keypoints": {
    "nose_tip": [cx, cy],
    "nose_left": [lx, ly],
    "nose_right": [rx, ry]
  },
  "label": "dog_001",
  "note": "正面照，光照良好"
}
```

### 6.2 数据增强

每张图增强12张：
- 水平翻转
- 旋转（-15° ~ +15°）
- 亮度调整（0.8x ~ 1.2x）
- 对比度调整
- 随机裁剪（鼻部区域放大）

### 6.3 阶段一训练（特征空间学习）

```python
# 伪代码 scripts/train_stage1.py
# 冻结 MobileNetV2 backbone，仅训练128维输出层

for epoch in range(10):
    # 仅更新输出层权重
    loss = cross_entropy(logits, labels)
    optimizer.step()
    
    # 早停：验证集准确率连续5次无提升则停止
    if val_acc_no_improvement > 5:
        break
```

**产出**：`weights/stage1.pth`

### 6.4 阶段二训练（细粒度微调）

```python
# 伪代码 scripts/train_stage2.py
# 解冻最后2个卷积块，低学习率微调

for param in mobilenet.block_12.parameters():
    param.requires_grad = True
for param in mobilenet.block_13.parameters():
    param.requires_grad = True

for epoch in range(30):
    # 学习率是第一阶段的1/10
    loss = triplet_loss(anchor, positive, negative)
    optimizer.step()
```

**产出**：`weights/mobilenet_v2_128d.pth`（最终权重）

### 6.5 评测

```python
# 伪代码 scripts/evaluate.py
# 用验证集（200组正样本+200组负样本）评测

top1_acc = compute_top1_accuracy(features, labels)
top5_acc = compute_top5_accuracy(features, labels)
recall = compute_recall(features, labels)
f1 = compute_f1(features, labels)
roc = compute_roc_curve(features, labels)

# 输出 ROC 曲线，找最优阈值（Youden's J Index）
best_threshold = find_optimal_threshold(roc)
```

**质量门控**：
- Baseline（阶段一结束）：Accuracy ≥ 70%
- 最终版（阶段二结束）：Accuracy ≥ 85%

---

## 七、与后端的集成

### 7.1 后端调用 AI 服务的方式

后端 Node.js 通过 HTTP 调用，不暴露公网：

```javascript
// 后端（Node.js）调用示例
const response = await fetch('http://localhost:8000/extract/feature', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: base64Image })
});
const { vector, confidence } = await response.json();
```

### 7.2 融合比分的计算位置

```
融合分计算：在后端 Node.js 中完成，不在 AI 服务中

fusion_score = 0.40 × sim_vector
              + 0.20 × S_location
              + 0.20 × sim_image
              + 0.20 × sim_text

AI服务只负责：sim_vector（向量相似度）
其他三个维度：后端自己算或调用其他模块
```

### 7.3 部署架构

```
                    ┌─────────────────┐
  前端小程序          │   Node.js 后端    │
  (微信) ─────── HTTP ──→ (Express)      │
                    │                 │
                    │  调用AI服务      │
                    └───────┬─────────┘
                            │ HTTP（内网）
                            ▼
                    ┌─────────────────┐
                    │  FastAPI AI服务   │
                    │  (uvicorn :8000)  │
                    │  MobileNetV2推理  │
                    └─────────────────┘
```

---

## 八、当前状态

| 项目 | 状态 | 说明 |
|------|------|------|
| 项目骨架 | ⬜ 待创建 | 需初始化目录结构 |
| 模型训练 | ⬜ 待开始 | W2数据集+W3训练 |
| 活体检测端点 | ⬜ 待开发 | W3实现基础版 |
| 特征提取端点 | ⬜ 待开发 | W3核心功能 |
| 权重文件 | ⬜ 无 | 训练后产出 |
| 服务部署 | ⬜ 待做 | W3完成 |

---

## 九、W2-W3 任务分解

### W2（5.11–5.17）

| 序号 | 任务 | 产出 |
|------|------|------|
| 2.1 | 数据集采集（≥500组） | 原始图片 |
| 2.2 | 鼻部关键点标注 | .json标注文件 |
| 2.3 | 数据清洗 | 清洗后数据集 |
| 2.4 | 数据增强脚本 | 12x增强图 |

### W3（5.18–5.24）

| 序号 | 任务 | 产出 |
|------|------|------|
| 3.1 | 项目骨架初始化 | FastAPI空服务，可运行 |
| 3.2 | 阶段一训练 | stage1权重，Accuracy≥70% |
| 3.3 | 阶段二训练 | 最终权重，Accuracy≥85% |
| 3.4 | 特征提取API | curl测试通过 |
| 3.5 | 活体检测API | curl测试通过 |
| 3.6 | 评测报告 | ROC曲线+最优阈值 |

---

## 十、参考开源项目

| 项目 | 地址 | 用途 |
|------|------|------|
| Pets-Face-Recognition | github.com/MarQuisCheshire/Pets-Face-Recognition | 学习关键点检测网络结构，Apache 2.0 |
| Dog-nose-print-identification | github.com/pratikmore33/Dog-nose-print-identification | 参考VGG16迁移学习训练思路 |
| images.cv Dog Nose Dataset | images.cv/dataset/dog-nose | 开源鼻纹数据集，361张 |

> 以上项目仅作技术参考，不直接复用模型权重（数据集不完全匹配）。
