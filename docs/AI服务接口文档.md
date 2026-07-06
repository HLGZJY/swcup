# AI 服务接口文档 — 鼻纹智救

> 整理人：统筹协调者
> 日期：2026-05-13
> 状态：待补充（AI 模型训练未完成）
> 说明：本文档由后端 Node.js 在内部调用 AI 服务（FastAPI），小程序不能直连。

---

## 一、概述

AI 推理服务由 FastAPI + PyTorch 实现，部署在内网，仅后端 Node.js 可调用。

**调用链路：**
```
小程序 → Node.js 后端 → FastAPI AI 服务（内网）
```

小程序**不能**直接请求 AI 服务端口，必须通过后端代调。

---

## 二、服务地址

| 环境 | 地址 |
|------|------|
| 开发环境 | `http://localhost:8000` |
| 生产环境 | （待补充） |

---

## 三、认证方式

（待补充 — 等队长明确是否需要 API Key 或内部网络白名单）

---

## 四、端点清单

### 4.1 活体检测（简化版：图片质量检测）

> 用 Laplacian 模糊度和亮度判断图片是否可用（不是真正的活体检测，但够用）

- **端点**：`POST /api/detect/liveness`
- **请求**：
  ```json
  {
    "image": "base64字符串（不带 data:image 前缀）"
  }
  ```
- **响应**：
  ```json
  {
    "passed": true,
    "confidence": 0.92
  }
  ```
  | 字段 | 类型 | 说明 |
  |------|------|------|
  | `passed` | boolean | 是否通过活体检测 |
  | `confidence` | number | 置信度 0~1 |

> ⚠️ **待补充**：具体模型实现、阈值设定

---

### 4.2 特征提取

> 从鼻纹照片中提取 512 维特征向量（已训练模型权重：`weights/stage1_oxford.pth`）

- **端点**：`POST /api/extract/feature`
- **请求**：
  ```json
  {
    "image": "base64字符串（可不带 data:image 前缀）"
  }
  ```
- **响应**：
  ```json
  {
    "vector": [0.123, -0.456, ...],
    "embedding_dim": 512
  }
  ```
  | 字段 | 类型 | 说明 |
  |------|------|------|
  | `vector` | array[number] | 512维 Float 数组，L2归一化后（范数=1.0） |
  | `embedding_dim` | number | 向量维度（固定512） |

**模型权重加载方式：** `src/api/extract.py` 第21行，修改 `weights_path` 参数即可切换不同阶段产出的模型。

```python
# 当前（阶段一 Oxford Pets，37类预训练）
_model = load_model(weights_path="weights/stage1_oxford.pth", embedding_dim=512)

# 阶段二狗鼻纹训练完成后
_model = load_model(weights_path="weights/stage2_dognose.pth", embedding_dim=512)

# 阶段三 Stanford Dogs 训练完成后（最终模型）
_model = load_model(weights_path="weights/stage3_stanford.pth", embedding_dim=512)
```

---

### 4.3 向量比对（可选）

> 两张鼻纹的特征向量相似度计算（余弦相似度）
>
> 注：此端点为可选，如果后端直接用 Python 计算向量相似度，可以不暴露此端点。

- **端点**：`POST /api/compare/vector`
- **请求**：
  ```json
  {
    "vector_a": [0.123, -0.456, ...],
    "vector_b": [0.234, -0.345, ...]
  }
  ```
- **响应**：
  ```json
  {
    "similarity": 0.95
  }
  ```

---

## 五、后端 Node.js 调用示例

> ⚠️ 等模型就绪后补充具体调用代码。

```javascript
// 示例（待模型就绪后补全）
const axios = require('axios');

async function extractFeature(base64Image) {
  const response = await axios.post('http://localhost:8000/api/extract/feature', {
    image: base64Image
  });
  return response.data;
}

async function detectLiveness(base64Image) {
  const response = await axios.post('http://localhost:8000/api/detect/liveness', {
    image: base64Image
  });
  return response.data;
}
```

---

## 六、注意事项

1. AI 服务仅后端内网可访问，不暴露公网
2. 向量存储：512维 float32 = 2048字节，存入 `nose_features.feature_vector`（LONGBLOB）
3. 模型版本：每次提取时记录 `model_version` 字段，方便后续模型升级后的数据追溯
4. 活体检测未通过时，`/api/nose/collect` 应返回 `liveness_passed: false`，前端提示用户重拍

---

## 七、已确认事项

- [x] AI 服务部署方式：直接用 Python + uvicorn 运行（无需 Docker）
- [x] FastAPI 启动命令：`uvicorn src.main:app --host 0.0.0.0 --port 8000`
- [x] 特征向量返回格式：float 数组 JSON
- [x] 向量比对：在 Node.js 后端用余弦相似度计算（不在 FastAPI 算）
- [x] 模型文件路径：`weights/stage*.pth`，通过 `src/api/extract.py` 第21行加载
- [x] 模型权重兼容性：训练产出的权重文件含 `classifier` 层，API加载时自动过滤（`strict=False`）
