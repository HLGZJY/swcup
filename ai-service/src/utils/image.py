"""
图片预处理工具
将 base64 / PIL Image / 文件路径 → 标准化 Tensor
"""
import base64
import io
from PIL import Image
import torch
import torchvision.transforms as T


# ImageNet 标准化参数
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

transform = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
])


def load_image_from_base64(image_base64: str) -> Image.Image:
    """从 base64 字符串加载 PIL Image"""
    # 去掉 data:image/...;base64, 前缀（如果有）
    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]
    image_bytes = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return image


def load_image_from_path(path: str) -> Image.Image:
    """从文件路径加载 PIL Image"""
    return Image.open(path).convert("RGB")


def pil_to_tensor(image: Image.Image) -> torch.Tensor:
    """PIL Image → 标准化 Tensor (1, 3, 224, 224)"""
    return transform(image).unsqueeze(0)


def check_image_quality(image: Image.Image) -> tuple[str, float]:
    """
    简化版图片质量检测：模糊度 + 亮度
    返回 (quality: str, score: float 0~1)
    """
    import cv2
    import numpy as np

    # 转 CV 格式
    cv_img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    # 1. 模糊度（Laplacian 方差）
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    # 方差越大越清晰，阈值 100 主观设定
    blur_score = min(laplacian_var / 100.0, 1.0)

    # 2. 亮度（不在过暗/过曝范围）
    mean_brightness = gray.mean() / 255.0
    brightness_score = 1.0 - abs(mean_brightness - 0.5) * 2

    # 综合得分
    score = 0.5 * blur_score + 0.5 * brightness_score

    if score >= 0.6:
        quality = "ok"
    elif score >= 0.3:
        quality = "low"
    else:
        quality = "poor"

    return quality, float(score)
