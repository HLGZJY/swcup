# 鼻纹特征模型 nose_v3_sgd.pth 使用指南

## 模型信息

| 项目 | 值 |
|------|-----|
| 权重文件 | `weights/nose_v3_sgd.pth` |
| 特征维度 | 512 维 |
| 基础模型 | **ResNet50** |
| 特征类型 | L2 归一化余弦相似度向量 |

---

## 快速使用

### 1. 加载模型

```python
import torch
from src.models.mobilenet import ResNet50_512d

ckpt = torch.load("weights/nose_v3_sgd.pth", map_location="cpu", weights_only=False)

model = ResNet50_512d(embedding_dim=512, pretrained=False)
model.load_state_dict(ckpt["state_dict"], strict=False)
model.eval()
```

### 2. 提取图片特征

```python
from torchvision import transforms
from PIL import Image

transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

def extract_feature(model, img_path: str):
    img = Image.open(img_path).convert("RGB")
    img_t = transform(img).unsqueeze(0)
    with torch.no_grad():
        feat = model(img_t).squeeze()
    return feat.numpy()
```

### 3. 计算相似度

```python
import numpy as np

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# 比对两张图
feat1 = extract_feature(model, "图片路径1")
feat2 = extract_feature(model, "图片路径2")
sim = cosine_similarity(feat1, feat2)
print(f"相似度: {sim:.4f}")
```

---

## 性能指标（ResNet50 实测）

| 指标 | 实测值 | 说明 |
|------|--------|------|
| 同一只狗相似度 | **0.8189** (std: 0.12) | 同狗图片对相似度高 |
| 不同狗相似度 | **0.5228** (std: 0.09) | 不同狗区分良好 |
| Recall@1 | 79.72% | 1:N 识别准确率 |
| 同一张图一致性 | 1.0 | 完全确定，无随机性 |

### 测试详情（6只狗，各4张图）

| 狗 ID | 同狗平均相似度 | 范围 |
|-------|---------------|------|
| 狗0 | ~0.88 | 0.83~0.97 |
| 狗1 | ~0.88 | 0.82~0.96 |
| 狗2 | ~0.90 | 0.84~0.92 |
| 狗3 | ~0.82 | 0.69~0.93 |
| 狗4 | ~0.67 | 0.51~0.90 |
| 狗5 | ~0.79 | 0.71~0.93 |
| **总体** | **0.82** | 0.51~0.97 |

---

## 相似度阈值建议

| 相似度范围 | 判断 | 建议操作 |
|-----------|------|----------|
| > **0.85** | 同一只狗 | 直接认领 |
| 0.65 ~ 0.85 | 可能是同一只狗 | 需人工复核 |
| < **0.65** | 不同狗 | 认为是新狗 |

> ResNet50 不同狗相似度约 0.52，阈值设为 **0.85** 可区分大部分情况。

---

## API 调用示例

### 特征提取 API

```
POST /v1/extract
Content-Type: application/json

{
  "photo_base64": "base64编码的图片..."
}
```

返回：
```json
{
  "vector": [0.123, -0.456, ...],  // 512维特征向量
  "vector_id": "uuid"
}
```

### 向量比对 API

```
POST /v1/compare/vector
Content-Type: application/json

{
  "vector_a": [0.123, ...],  // 特征向量A
  "vector_b": [0.456, ...]   // 特征向量B
}
```

返回：
```json
{
  "cosine_similarity": 0.8114,
  "l2_distance": 0.6123
}
```

---

## 数据库存储建议

建议存储 `vector_id` + `nose_id` + `vector` (512维)，用于 1:N 比对：

```sql
CREATE TABLE nose_features (
  id SERIAL PRIMARY KEY,
  nose_id VARCHAR(64) NOT NULL,        -- 鼻纹ID
  dog_id VARCHAR(64),                  -- 对应狗的ID
  vector BYTEA NOT NULL,                -- 512维特征向量 (binary)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_nose_dog ON nose_features(dog_id);
```

---

## 1:N 识别流程

```
1. 用户上传鼻纹照片
2. 调用 /v1/extract 提取特征向量
3. 在数据库中搜索相似度 > 0.85 的已知向量
4. 返回匹配结果或提示"未找到匹配，为新狗"
```

---

## 注意事项

1. **图片要求**：鼻纹区域清晰，光照均匀，避免过曝或过暗
2. **模型输入**：256x256 RGB 图片，ImageNet 归一化
3. **权重加载**：使用 `strict=False` 加载完整 state_dict
4. **阈值调试**：建议先用一批已知样本测试，再调整阈值