"""
Stage 1 Training: Freeze backbone, train only the 512-dim embedding head.
This gives us a baseline model quickly.
"""

import os
import sys
import time
import argparse
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms, models
from PIL import Image
import numpy as np
from tqdm import tqdm

# Add ai-service root to path (parent of src/)
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from src.models.mobilenet import MobileNetV2_128d


class NosePrintDataset(Dataset):
    """
    Dataset for nose print images organized in folders:
        data_dir/
            dog_001/
                img1.jpg
                img2.jpg
            dog_002/
                img1.jpg
            ...

    Returns (image_tensor, label_index)
    """

    def __init__(self, data_dir: str, img_size: int = 224):
        self.data_dir = Path(data_dir)
        self.img_size = img_size

        # Scan all class folders
        self.class_names = sorted([d.name for d in self.data_dir.iterdir() if d.is_dir()])
        self.class_to_idx = {name: idx for idx, name in enumerate(self.class_names)}
        self.idx_to_class = {idx: name for name, idx in self.class_to_idx.items()}

        # Collect all image paths and labels
        self.samples = []
        for class_dir in self.data_dir.iterdir():
            if not class_dir.is_dir():
                continue
            label = self.class_to_idx[class_dir.name]
            for img_path in class_dir.glob("*"):
                if img_path.suffix.lower() in [".jpg", ".jpeg", ".png", ".bmp"]:
                    self.samples.append((str(img_path), label))

        # ImageNet normalization
        self.transform = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        img_t = self.transform(img)
        return img_t, label


class DummyDataset(Dataset):
    """Dummy dataset that generates random images for testing the pipeline."""

    def __init__(self, num_classes: int = 50, samples_per_class: int = 10, img_size: int = 224):
        self.num_classes = num_classes
        self.samples_per_class = samples_per_class
        self.img_size = img_size
        self.total = num_classes * samples_per_class
        self.transform = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    def __len__(self):
        return self.total

    def __getitem__(self, idx):
        class_idx = idx // self.samples_per_class
        # Generate random "dog nose" image (in reality just random noise)
        img = Image.fromarray(np.random.randint(0, 255, (self.img_size, self.img_size, 3), dtype=np.uint8))
        return self.transform(img), class_idx


def build_model(num_classes: int = None, embedding_dim: int = 512, pretrained: bool = True, freeze_backbone: bool = True):
    """Build MobileNetV2 + 512-dim head.

    Args:
        num_classes: 输出类别数（None则只有embedding层，无分类头）
        embedding_dim: embedding 向量维度
        pretrained: 是否用 ImageNet 预训练权重
        freeze_backbone: 是否冻结 backbone（阶段一冻结，阶段二解冻）
    """
    model = MobileNetV2_128d(embedding_dim=embedding_dim, num_classes=num_classes)

    if freeze_backbone:
        for param in model.features.parameters():
            param.requires_grad = False

    return model


def train_epoch(model, dataloader, criterion, optimizer, device, epoch: int):
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    pbar = tqdm(dataloader, desc=f"Epoch {epoch} [Train]")
    for imgs, labels in pbar:
        imgs = imgs.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        features = model(imgs)  # (B, 512)
        logits = model.classifier(features)  # (B, num_classes)
        loss = criterion(logits, labels)

        loss.backward()
        optimizer.step()

        total_loss += loss.item() * imgs.size(0)
        _, predicted = logits.max(1)
        correct += predicted.eq(labels).sum().item()
        total += labels.size(0)

        pbar.set_postfix({"loss": f"{loss.item():.4f}", "acc": f"{100.*correct/total:.2f}%"})

    return total_loss / total, 100. * correct / total


def evaluate(model, dataloader, criterion, device, epoch: int):
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0

    with torch.no_grad():
        pbar = tqdm(dataloader, desc=f"Epoch {epoch} [Eval]")
        for imgs, labels in pbar:
            imgs = imgs.to(device)
            labels = labels.to(device)
            features = model(imgs)
            logits = model.classifier(features)
            loss = criterion(logits, labels)
            total_loss += loss.item() * imgs.size(0)
            _, predicted = logits.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)

    return total_loss / total, 100. * correct / total


def main():
    parser = argparse.ArgumentParser(description="Stage 1: Train embedding head with MobileNetV2 backbone")
    parser.add_argument("--data", type=str, default=None, help="Path to dataset folder")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--embed-dim", type=int, default=512)
    parser.add_argument("--output", type=str, default="weights/stage1.pth")
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--resume", type=str, default=None, help="加载已有权重文件继续训练（自动读取embedding_dim和num_classes）")
    parser.add_argument("--no-freeze-backbone", action="store_true", help="不解冻backbone（阶段二用）")
    args = parser.parse_args()

    device = torch.device(args.device)
    print(f"Using device: {device}")

    # Create dataset
    if args.data:
        train_ds = NosePrintDataset(args.data)
        print(f"Loaded {len(train_ds)} images from {args.data}")
    else:
        train_ds = DummyDataset(num_classes=50, samples_per_class=10)
        print(f"No --data provided, using dummy dataset: {len(train_ds)} images")

    train_ds.classes = list(range(len(train_ds.class_names))) if hasattr(train_ds, 'class_names') else list(range(50))

    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True, num_workers=0, pin_memory=True)

    # Build model
    num_classes = len(train_ds.classes)
    freeze_backbone = not args.no_freeze_backbone

    if args.resume:
        # 断点续训：从已有权重加载，embedding_dim 和 num_classes 从 checkpoint 读取
        print(f"Loading checkpoint: {args.resume}")
        checkpoint = torch.load(args.resume, map_location=device)
        saved_state_dict = checkpoint['state_dict']
        saved_embed_dim = checkpoint.get('embedding_dim', args.embed_dim)
        saved_num_classes = checkpoint.get('num_classes')

        # 构建模型（用 checkpoint 里的 embedding_dim，用新数据集的 num_classes）
        model = build_model(num_classes=num_classes, embedding_dim=saved_embed_dim, freeze_backbone=freeze_backbone)

        # 加载权重前，删除 checkpoint 里的 classifier 权重（因为 num_classes 不同，形状必然不匹配）
        # strict=False 只忽略"键不存在"的情况，对形状不匹配的同名键仍会报错，所以要手动剔除
        filtered_state_dict = {k: v for k, v in saved_state_dict.items() if 'classifier' not in k}
        model.load_state_dict(filtered_state_dict, strict=False)
        print(f"  Loaded: embedding_dim={saved_embed_dim}, new num_classes={num_classes}")

        # 如果类别数变了（换数据集），替换分类头
        if saved_num_classes != num_classes:
            print(f"  WARNING: num_classes changed {saved_num_classes} -> {num_classes}, classifier head reinitialized")
            model.classifier = nn.Linear(model.embedding_dim, num_classes).to(device)

        best_acc = checkpoint.get('best_acc', 0.0)
        print(f"  Resuming from best_acc={best_acc:.2f}%")
    else:
        model = build_model(num_classes=num_classes, embedding_dim=args.embed_dim, freeze_backbone=freeze_backbone)
        best_acc = 0.0

    model = model.to(device)
    print(f"Model: embedding_dim={model.embedding_dim}, num_classes={num_classes}, backbone_frozen={freeze_backbone}")

    # Criterion and optimizer
    criterion = nn.CrossEntropyLoss()
    trainable_params = filter(lambda p: p.requires_grad, model.parameters())
    optimizer = optim.Adam(trainable_params, lr=args.lr)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device, epoch)
        val_loss, val_acc = evaluate(model, train_loader, criterion, device, epoch)
        scheduler.step()

        print(f"Epoch {epoch}: train_loss={train_loss:.4f}, train_acc={train_acc:.2f}%, "
              f"val_loss={val_loss:.4f}, val_acc={val_acc:.2f}%")

        if val_acc > best_acc:
            best_acc = val_acc
            checkpoint = {
                'state_dict': model.state_dict(),
                'embedding_dim': model.embedding_dim,
                'num_classes': num_classes,
                'best_acc': best_acc,
            }
            torch.save(checkpoint, args.output)
            print(f"  -> Saved best model to {args.output}")

    print(f"\nTraining complete. Best val acc: {best_acc:.2f}%")


if __name__ == "__main__":
    main()
