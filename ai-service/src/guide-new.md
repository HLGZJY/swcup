# AI-Service 训练指南（Windows）

> RTX 4060 / ResNet50 / 50 epochs / 32-50 batch / 25000 张图片
> 命令行写在一行，用空格隔开

---

## 一、数据集

| 模型         | 路径                                          | 类别       | 图片数 |
| ------------ | --------------------------------------------- | ---------- | ------ |
| 品种分类模型 | `oxford_pets_split/train/` + `Stanford_Dogs/` | 37+120=157 | ~25000 |
| 鼻纹特征模型 | `dir_train/dir_train/{dog_id}/`               | 6000 只狗  | ~24000 |

---

## 二、品种分类模型训练（ResNet50 + ArcFace）

### 2.1 训练

```bash
cd F:\swcup2026\ai-service
python -m src.scripts.train_breed --data-oxford oxford_pets_split/train --data-stanford Stanford_Dogs --epochs 50 --batch 32 --lr 0.0001 --embed-dim 512 --num-classes 157 --output weights/breed_classifier.pth --device cuda
```

> **模型：从 MobileNetV2 迁移到 ResNet50**
>
> - 参数量：3.5M → 25M（特征提取能力更强）
> - 学习率：0.001 → 0.0001
> - 两阶段训练：先冻结 backbone 训练 margin，再 unlock 微调

**快速验证（1分钟内完成）：**

```bash
python -m src.scripts.train_breed --data-oxford oxford_pets_split/train --data-stanford Stanford_Dogs --epochs 2 --batch 1 --lr 0.0001 --embed-dim 512 --num-classes 157 --output weights/breed_classifier.pth --device cuda --train-limit 100 --val-limit 200 --unlock-after 2
```

**断点续训：**

```bash
python -m src.scripts.train_breed --data-oxford oxford_pets_split/train --data-stanford Stanford_Dogs --epochs 50 --batch 32 --lr 0.0001 --embed-dim 512 --num-classes 157 --output weights/breed_classifier.pth --device cuda --resume weights/breed_classifier.pth
```

### 2.2 评测

```bash
python -m src.scripts.evaluate_breed --model weights/breed_classifier.pth --data oxford_pets_split/test --device cuda
```

> 评测脚本自动识别 MobileNetV2 和 ResNet50 模型，无需指定模型类型。

目标：Top-1 ≥ 85%，Top-3 ≥ 95%

### 2.3 两阶段训练说明

训练分为两个阶段：

| 阶段 | Epochs | Backbone | 训练内容 |
|------|--------|----------|----------|
| Stage 1 | 1-10 | 冻结 | 只训练 fc 层 + margin head |
| Stage 2 | 11-50 | 解冻 | 全模型微调 |

**Stage 1**（冻结阶段）train_acc 会很低甚至为 0%，这是正常的，因为只有随机初始化的 margin head 在学习。
**Stage 2**（解冻后）验证准确率才会开始提升。

### 2.4 核心参数选择

RTX 4060（8GB 专用显存）推荐配置：

| 场景     | Epochs | Batch | LR     | 说明         |
| -------- | ------ | ----- | ------ | ------------ |
| 快速验证 | 1-5    | 8     | 0.0001 | 确认流程正常 |
| 标准训练 | 50     | 32    | 0.0001 | 平衡速度和效果 |
| 最佳效果 | 50+    | 50    | 0.0001 | 更长训练，更稳定 |

---

## 三、鼻纹特征模型训练（ResNet50 + ArcFace）

### 3.1 训练

```bash
cd F:\swcup2026\ai-service
python -m src.scripts.train_nose_metric --data dir_train/dir_train --epochs 50 --batch 32 --lr 0.0001 --embed-dim 512 --output weights/nose_feature.pth --device cuda
```

> **模型：同样从 MobileNetV2 迁移到 ResNet50**
>
> - 两阶段训练：先冻结 backbone 训练 margin，再 unlock 微调
> - 与品种分类模型共用相同的优化策略

### 3.2 评测

```bash
python -m src.scripts.evaluate_nose --model weights/nose_feature.pth --data dir_train/dir_train --device cuda
```

> 评测脚本自动识别 MobileNetV2 和 ResNet50 模型，无需指定模型类型。

目标：同狗相似度 > 0.80，不同狗相似度 < 0.50，Recall@1 ≥ 90%

---

## 四、其他参数说明

| 参数            | 说明                         | breed 默认值 | nose 默认值    |
| --------------- | ---------------------------- | ------------ | -------------- |
| `--epochs`      | 训练轮数                     | 50           | 50             |
| `--batch`       | 批大小                       | 32           | 32             |
| `--lr`          | 学习率                       | 0.0001       | 0.0001         |
| `--embed-dim`   | Embedding 维度               | 512          | 512            |
| `--num-classes` | 总类别数                     | 157          | 6000           |
| `--val-ratio`   | 验证集比例（按类划分）       | 0.2          | 0.2            |
| `--arc-s`       | ArcFace scale                | 64.0         | 64.0           |
| `--arc-m`       | ArcFace margin               | 0.5          | 0.5            |
| `--unlock-after`| 解冻 backbone 的 epoch       | 10           | 20             |
| `--train-limit`  | 限制训练样本数（快速验证）    | None         | None           |
| `--val-limit`    | 限制验证样本数（快速验证）    | None         | None           |
| `--device`       | 设备                         | cuda/cpu     | cuda/cpu       |

---

## 五、环境依赖

```bash
pip install torch==2.2.0 torchvision==0.17.0 tqdm scikit-learn pillow numpy
```

---

## 六、产物

| 文件                           | 说明             |
| ------------------------------ | ---------------- |
| `weights/breed_classifier.pth` | 品种分类模型权重（ResNet50） |
| `weights/nose_feature.pth`     | 鼻纹特征模型权重 |

---

## 七、过拟合问题说明（2026-05-26 更新）

### 旧版本问题（MobileNetV2）

之前使用 MobileNetV2 时出现过拟合：
- train_acc 95%+, val_acc 最高 55-65%
- 原因：模型容量不足 + 学习率过高 + 缺少正则化

### 新版本改进（ResNet50）

| 改进项         | 旧版        | 新版              |
| -------------- | ----------- | ----------------- |
| 模型           | MobileNetV2 | ResNet50          |
| 参数量         | 3.5M        | 25M               |
| 学习率         | 0.001       | 0.0001            |
| 优化器         | Adam        | AdamW + weight_decay |
| 学习率策略     | CosineAnnealing | MultiStepLR    |
| 数据增强       | 基础        | resize_with_padding + RandomCrop |

---

## 八、常见问题

**训练时 train_acc 一直是 0 正常吗？**

正常。Stage 1（默认前 10 轮）冻结 backbone，只训练 margin head，acc 会很低。切换到 Stage 2 后 acc 会开始提升。

**为什么不使用 --no-freeze-backbone？**

新版本使用两阶段训练（--unlock-after=10），比直接不冻结效果更好。Stage 1 先让 margin head 学到基本的类间间隔，再微调 backbone。

**Oxford Pets 和 Stanford Dogs 狗种重叠会有影响吗？**

不会。同一张图在不同数据集中会被归为不同类别，ArcFace 会学到统一特征，评测时只输出 Oxford Pets 的 37 类。

**没有 GPU 能训练吗？**

可以，但极慢。推荐使用 GPU。

**RTX 4060 会爆显存吗？**

不会。ResNet50 + batch=32 显存占用约 4-5GB，batch=50 约 6-7GB，8GB 专用显存完全够用。