"""批量测试鼻纹模型相似度"""

import torch
from torchvision import transforms
from PIL import Image
from src.models.mobilenet import MobileNetV2_128d
from pathlib import Path
import numpy as np


def load_model(weights_path: str = "weights/nose_v3_sgd.pth"):
    ckpt = torch.load(weights_path, map_location="cpu", weights_only=False)
    embedding_dim = ckpt.get("embedding_dim", 512)
    num_classes = ckpt.get("num_classes", 6000)

    model = MobileNetV2_128d(embedding_dim=embedding_dim, num_classes=num_classes)
    state_dict = {k: v for k, v in ckpt["state_dict"].items() if "classifier" not in k}
    model.load_state_dict(state_dict, strict=False)
    model.eval()
    return model


def extract_feature(model, img_path: str, transform):
    img = Image.open(img_path).convert("RGB")
    img_t = transform(img).unsqueeze(0)
    with torch.no_grad():
        feat = model(img_t).squeeze()
    return feat


def cosine_similarity(feat1, feat2):
    return torch.nn.functional.cosine_similarity(
        feat1.unsqueeze(0), feat2.unsqueeze(0)
    ).item()


def get_images_by_dog(data_dir: str, dog_ids: list):
    """获取每个狗的多张图片"""
    result = {}
    for dog_id in dog_ids:
        dog_dir = Path(data_dir) / str(dog_id)
        if dog_dir.exists():
            images = list(dog_dir.glob("*.jpg")) + list(dog_dir.glob("*.jpeg")) + list(dog_dir.glob("*.png"))
            result[dog_id] = [str(p) for p in images[:5]]  # 最多5张
    return result


# 主程序
if __name__ == "__main__":
    model = load_model()
    print("模型加载成功\n")

    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    data_dir = "dir_train/dir_train"
    dog_ids = [0, 1, 2, 3, 4, 5]

    # 获取每个狗的图片
    dog_images = get_images_by_dog(data_dir, dog_ids)

    print("=== 同狗测试（同一只狗的不同图片）===")
    same_dog_sims = []
    for dog_id, images in dog_images.items():
        if len(images) < 2:
            continue
        print(f"\n狗{dog_id}: {len(images)} 张图片")
        for i in range(len(images)):
            for j in range(i + 1, len(images)):
                feat1 = extract_feature(model, images[i], transform)
                feat2 = extract_feature(model, images[j], transform)
                sim = cosine_similarity(feat1, feat2)
                same_dog_sims.append(sim)
                print(f"  图片{i+1} vs 图片{j+1}: {sim:.4f}")

    print(f"\n同狗平均相似度: {np.mean(same_dog_sims):.4f} (std: {np.std(same_dog_sims):.4f})")

    print("\n" + "=" * 50)
    print("=== 不同狗测试（不同狗的图片两两比对）===")
    diff_dog_sims = []
    dogs = list(dog_images.keys())
    for i in range(len(dogs)):
        for j in range(i + 1, len(dogs)):
            dog_i, dog_j = dogs[i], dogs[j]
            # 取每只狗的第一张图比对
            if dog_images[dog_i] and dog_images[dog_j]:
                feat_i = extract_feature(model, dog_images[dog_i][0], transform)
                feat_j = extract_feature(model, dog_images[dog_j][0], transform)
                sim = cosine_similarity(feat_i, feat_j)
                diff_dog_sims.append(sim)
                print(f"狗{dog_i} vs 狗{dog_j}: {sim:.4f}")

    print(f"\n不同狗平均相似度: {np.mean(diff_dog_sims):.4f} (std: {np.std(diff_dog_sims):.4f})")