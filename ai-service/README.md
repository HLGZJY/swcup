# 鼻纹智救 - AI 推理服务

claude --resume fb372a46-081b-4bdc-9fd4-04e2ee4d1214
claude --resume fb372a46-081b-4bdc-9fd4-04e2ee4d1214

## 项目结构

```
ai-service/
├── src/
│   ├── main.py              # FastAPI 入口
│   ├── api/
│   │   ├── detect.py        # POST /detect/liveness — 活体检测
│   │   ├── extract.py       # POST /extract/feature — 512维向量提取
│   │   └── compare.py       # POST /compare/vector — 向量比对
│   ├── models/
│   │   └── mobilenet.py     # MobileNetV2 + 512d 输出层
│   ├── utils/
│   │   ├── image.py         # 图片预处理/质量评估
│   │   └── vector.py        # 余弦相似度/L2距离
│   └── scripts/
│       └── train_stage1.py  # 阶段一训练脚本
├── weights/                 # 训练权重目录
├── requirements.txt
└── test_api.py             # API 测试脚本
```

## 环境搭建

Python 3.11 + pip:

```bash
# 安装依赖
pip install -r requirements.txt

# 测试 API
python test_api.py
```

## 启动服务

```bash
# 开发模式
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# 生产模式
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

## API 端点

| 端点               | 方法 | 说明                     |
| ------------------ | ---- | ------------------------ |
| `/health`          | GET  | 健康检查                 |
| `/detect/liveness` | POST | 活体检测（图片质量评估） |
| `/extract/feature` | POST | 提取 512 维向量          |
| `/compare/vector`  | POST | 两向量相似度计算         |

### 请求示例

```bash
# 健康检查
curl -X GET http://localhost:8000/health

# 提取特征（base64 图片）
curl -X POST http://localhost:8000/extract/feature \
  -H "Content-Type: application/json" \
  -d '{"image": "base64字符串..."}'

# 活体检测
curl -X POST http://localhost:8000/detect/liveness \
  -H "Content-Type: application/json" \
  -d '{"image": "base64字符串..."}'

# 向量比对
curl -X POST http://localhost:8000/compare/vector \
  -H "Content-Type: application/json" \
  -d '{"vector_a": [0.1, ...], "vector_b": [0.2, ...]}'
```

## 训练

```bash
# 阶段一：冻结 backbone，训练 512d 输出层（快速 baseline）
python -m src.scripts.train_stage1 \
  --data /path/to/dataset \
  --epochs 10 \
  --batch 32 \
  --output weights/stage1.pth
```

数据集格式：每个类别一个文件夹，文件夹名为类别名，内部放图片文件。

## 技术栈

- **推理框架**: PyTorch 2.2 + TorchVision 0.17
- **Web 框架**: FastAPI 0.109 + Uvicorn
- **模型**: MobileNetV2（ImageNet 预训练权重）+ 512 维输出层
- **图片处理**: Pillow + OpenCV
