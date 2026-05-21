"""
测试 stage1_oxford.pth 权重文件能否正常加载并推理。
用法: python test_weight_load.py
"""
import torch
import numpy as np
from PIL import Image

# 1. 测试模型加载
print("=" * 50)
print("测试1: 模型加载")
print("=" * 50)
from src.models.mobilenet import load_model
model = load_model(weights_path='weights/stage1_oxford.pth', embedding_dim=512)
print("✅ 模型加载成功")

# 2. 测试推理
print("\n" + "=" * 50)
print("测试2: 推理（随机图片）")
print("=" * 50)
from src.utils.image import transform, base64_to_image, image_to_tensor
img = Image.fromarray(np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8))
tensor = transform(img).unsqueeze(0)
print(f"输入shape: {tensor.shape}")

from src.models.mobilenet import extract_feature
vec = extract_feature(model, tensor)
print(f"输出shape: {vec.shape}")
print(f"向量前5个值: {vec[:5].tolist()}")
print(f"L2范数: {np.linalg.norm(vec):.6f} (应为1.0)")
print("✅ 推理正常")

# 3. 测试 base64 解析
print("\n" + "=" * 50)
print("测试3: base64图片解析")
print("=" * 50)
import base64, io
img_bytes = io.BytesIO()
Image.fromarray(np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)).save(img_bytes, format='JPEG')
b64 = base64.b64encode(img_bytes.getvalue()).decode()
img2 = base64_to_image(b64)
print(f"base64解码图片size: {img2.size}")
tensor2 = transform(img2).unsqueeze(0)
vec2 = extract_feature(model, tensor2)
print(f"推理结果 shape: {vec2.shape}, L2范数: {np.linalg.norm(vec2):.6f}")
print("✅ base64解析正常")

# 4. 测试 API 路由逻辑（不启动服务器）
print("\n" + "=" * 50)
print("测试4: API端点逻辑模拟")
print("=" * 50)
class FakeRequest:
    image = b64

class ExtractResponse:
    def __init__(self, vector, embedding_dim):
        self.vector = vector
        self.embedding_dim = embedding_dim

# 模拟 extract_feature_endpoint 的逻辑
img = base64_to_image(FakeRequest.image)
tensor = image_to_tensor(img).unsqueeze(0)
vector = extract_feature(model, tensor)
response = ExtractResponse(vector=vector.tolist(), embedding_dim=512)
print(f"返回vector长度: {len(response.vector)}")
print(f"返回embedding_dim: {response.embedding_dim}")
print("✅ API逻辑正常")

print("\n" + "=" * 50)
print("🎉 所有测试通过！模型可以正常使用！")
print("=" * 50)
