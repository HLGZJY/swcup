"""使用 nose_v3_sgd.pth 权重测试两张图片的相似度"""

import torch
from torchvision import transforms
from PIL import Image
from src.models.mobilenet import MobileNetV2_128d


def load_nose_model(weights_path: str = "weights/nose_v3_sgd.pth"):
    """加载鼻纹特征模型"""
    # weights_only=False 因为 checkpoint 包含 numpy 数据
    ckpt = torch.load(weights_path, map_location="cpu", weights_only=False)
    embedding_dim = ckpt.get("embedding_dim", 512)
    num_classes = ckpt.get("num_classes", 6000)

    model = MobileNetV2_128d(embedding_dim=embedding_dim, num_classes=num_classes)
    # 过滤掉 classifier 相关的权重
    state_dict = {k: v for k, v in ckpt["state_dict"].items() if "classifier" not in k}
    model.load_state_dict(state_dict, strict=False)
    model.eval()
    return model


def extract_feature(model, img_path: str, img_size: int = 256):
    """提取单张图片的特征向量"""
    transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    img = Image.open(img_path).convert("RGB")
    img_t = transform(img).unsqueeze(0)
    with torch.no_grad():
        feat = model(img_t).squeeze()
    return feat


def compute_similarity(feat1, feat2):
    """计算两个特征向量的余弦相似度"""
    return torch.nn.functional.cosine_similarity(
        feat1.unsqueeze(0), feat2.unsqueeze(0)
    ).item()


# ============ 使用示例 ============
if __name__ == "__main__":
    # 1. 加载模型
    model = load_nose_model("weights/nose_v3_sgd.pth")
    print("模型加载成功")

    # 2. 提取两张图片的特征
    img1 = "dir_train/dir_train/0/0_--1WCesjS6CGTNbuCcv8NwAAACMAARAD-0.jpg"
    img2 = "dir_train/dir_train/0/0_x1FVNAVSRniPE0kHchH0IAAAACMAARAD-0.jpg"  # 同一只狗的另一张图

    feat1 = extract_feature(model, img1)
    feat2 = extract_feature(model, img2)

    # 3. 计算相似度
    sim = compute_similarity(feat1, feat2)
    print(f"图片1: {img1}")
    print(f"图片2: {img2}")
    print(f"相似度: {sim:.4f}")

    # ============ 不同图片测试 ============
    print("\n--- 不同狗测试 ---")
    img3 = "dir_train/dir_train/1/1_-27kQ7i7TMOodSpjIF219QAAACMAARAD-0.jpg"  # 另一只狗
    feat3 = extract_feature(model, img3)
    sim_diff = compute_similarity(feat1, feat3)
    print(f"图片1 vs 图片3 相似度: {sim_diff:.4f}")