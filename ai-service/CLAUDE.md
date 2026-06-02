# AI Service 项目背景

## 项目目标

为宠物身份识别系统训练两个模型：
1. **品种分类模型**：Oxford Pets (37类) + Stanford Dogs (120类) = 157 类
2. **鼻纹特征模型**：6000 只狗的鼻纹特征提取，用于 1:N 身份识别

## 项目结构

```
ai-service/
├── src/
│   ├── models/mobilenet.py      # ResNet50 模型定义
│   ├── losses/                   # ArcFace、 Focal Loss 等
│   ├── scripts/
│   │   ├── train_breed.py       # 品种分类训练
│   │   ├── train_nose_metric.py  # 鼻纹特征训练
│   │   └── evaluate_*.py        # 评测脚本
│   ├── api/                      # API 服务
│   └── guide-new.md             # 训练详细指南
├── weights/                      # 模型权重输出目录
└── 参考项目/                      # 参考代码
```

---

# 训练参数经验

## 核心参数选择依据

### Batch Size
- 与显存相关，与数据集大小关系不大
- RTX 4060 (8GB): batch=32 约 4-5GB，batch=50 约 6-7GB
- batch 过大：梯度估计不准、泛化下降
- batch 过小：梯度噪声大、GPU 利用率低

### Learning Rate
- 核心参数，与模型容量成反比
- ResNet50 (25M 参数)：lr=0.0001
- MobileNetV2 (3.5M 参数)：lr=0.001
- 大模型必须用小 LR，否则破坏预训练权重

### Epochs
- 决定总迭代次数 = epochs × (数据集大小 / batch)
- batch=32, 50 epochs ≈ 31,250 次迭代
- MultiStepLR 在 70%、90% epochs 时降学习率

### 两阶段训练
| 阶段 | Backbone | LR | 说明 |
|------|----------|-----|------|
| Stage 1 (默认前10轮) | 冻结 | 正常 LR | 只训练 fc + margin head |
| Stage 2 (11-50轮) | 解冻 | 降低 10-100 倍 | 全模型微调 |

**注意**：Stage 1 的 train_acc 很低甚至 0% 是正常的，因为 ArcFace 的 margin 机制会压低 logits。验证 loss 和 val_top1 是更可靠的指标。

---

# 训练命令模板

## 快速验证（1分钟内）
```bash
python -m src.scripts.train_breed \
  --data-oxford oxford_pets_split/train \
  --data-stanford Stanford_Dogs \
  --epochs 2 --batch 1 --lr 0.0001 \
  --embed-dim 512 --num-classes 157 \
  --output weights/breed_classifier.pth \
  --device cuda --train-limit 100 --val-limit 200 --unlock-after 2
```

## 正式训练（品种分类）
```bash
python -m src.scripts.train_breed \
  --data-oxford oxford_pets_split/train \
  --data-stanford Stanford_Dogs \
  --epochs 50 --batch 32 --lr 0.0001 \
  --embed-dim 512 --num-classes 157 \
  --output weights/breed_classifier.pth --device cuda
```

## 断点续训
```bash
python -m src.scripts.train_breed \
  --data-oxford oxford_pets_split/train \
  --data-stanford Stanford_Dogs \
  --epochs 50 --batch 32 --lr 0.0001 \
  --embed-dim 512 --num-classes 157 \
  --output weights/breed_classifier.pth \
  --device cuda --resume weights/breed_classifier.pth
```

## 鼻纹特征训练
```bash
python -m src.scripts.train_nose_metric \
  --data dir_train/dir_train \
  --epochs 50 --batch 32 --lr 0.0001 \
  --embed-dim 512 \
  --output weights/nose_feature.pth --device cuda
```

---

# 常见问题处理

## loss 不下降 / val_top1 一直是 0%
可能原因：
1. 数据标签错误
2. 学习率不合适，试试降低到 0.00005
3. batch 太大，梯度噪声太小，收敛到局部最优
4. 继续训练 Stage 2（解冻后特征会变好）

## 显存不足 (CUDA OOM)
- 减小 batch：--batch 32 → --batch 16
- 或关闭混合精度（代码未实现，当前为 fp32）

## 解冻时报错 "some parameters appear in more than one parameter group"
- 已修复：用 `named_parameters` 过滤避免参数重叠
- 原因：`backbone.parameters()` 包含 fc 参数，与 `backbone.fc.parameters()` 重复

## train_acc 和 val_acc 差距大（过拟合）
- 可能是数据集问题（标签错误、数据泄露）
- 减小学习率
- 增加 dropout（当前 model 里已有 0.5）
- 增加 weight_decay（当前 1e-4）

## 训练正常但 val_top1 上不去
- 继续训练，特征学习需要时间
- 观察 val_loss 是否在下降，下降就说明在学习
- ArcFace 的 train_acc 显示可能不准确（margin 压低 logits）

---

# 性能目标

| 模型 | 指标 | 目标值 |
|------|------|--------|
| 品种分类 | Top-1 | ≥ 85% |
| 品种分类 | Top-3 | ≥ 95% |
| 鼻纹特征 | 同狗相似度 | > 0.80 |
| 鼻纹特征 | 不同狗相似度 | < 0.50 |
| 鼻纹特征 | Recall@1 | ≥ 90% |

---

# 已知的坑

1. **train_acc 显示 0%**：ArcFace 的 margin 机制是正常的，不是 bug
2. **解冻时参数重叠**：必须用 `named_parameters` 过滤
3. **断点续训从 epoch=0 开始**：checkpoint 必须保存 epoch 字段
4. **Oxford/Stanford 合并训练**：同一张狗的照片在两个数据集中类别不同，评测时只输出 Oxford 的 37 类