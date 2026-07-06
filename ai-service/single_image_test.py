"""
单图测试脚本：输入一张图片，输出512维向量。
用于验证整个推理pipeline是否通顺。
"""

import sys
import os
from pathlib import Path

# 确保 src 在路径里
sys.path.insert(0, str(Path(__file__).parent))

from PIL import Image
import torch
import numpy as np

from src.models.mobilenet import load_model
from src.utils.image import image_to_tensor


def main():
    if len(sys.argv) < 2:
        print("用法: python single_image_test.py <图片路径>")
        print("示例: python single_image_test.py ./test_dog.jpg")
        sys.exit(1)

    img_path = sys.argv[1]
    if not os.path.exists(img_path):
        print(f"错误: 文件不存在: {img_path}")
        sys.exit(1)

    print(f"正在加载模型 (MobileNetV2 + 512d 输出层)...")
    model = load_model(weights_path=None, embedding_dim=512)
    print("模型加载成功")

    print(f"\n正在处理图片: {img_path}")
    img = Image.open(img_path).convert("RGB")
    print(f"图片尺寸: {img.size}")

    tensor = image_to_tensor(img).unsqueeze(0)  # (1, 3, 224, 224)
    print(f"输入tensor shape: {tensor.shape}")

    print("\n正在进行特征提取...")
    with torch.no_grad():
        vector = model(tensor)

    vec = vector.cpu().numpy().flatten()
    print(f"输出向量维度: {vec.shape}")
    print(f"向量L2范数: {np.linalg.norm(vec):.6f} (应为~1.0，因已L2归一化)")
    print(f"\n向量前10维: {[f'{v:.4f}' for v in vec[:10]]}")

    # 保存向量到文件
    out_path = os.path.splitext(img_path)[0] + "_vector.npy"
    np.save(out_path, vec)
    print(f"\n向量已保存到: {out_path}")

    print("\n✅ 特征提取完成!")


if __name__ == "__main__":
    main()
