"""
Stage 1 Training: Freeze backbone, train only the 128-dim embedding head.
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


def build_model(num_classes: int = None, embedding_dim: int = 128, pretrained: bool = True):
    """Build MobileNetV2 + 128-dim head."""
    model = MobileNetV2_128d(embedding_dim=embedding_dim, num_classes=num_classes)

    if pretrained:
        # Already loaded from torchvision weights in __init__
        pass

    # Freeze backbone (all feature layers)
    for param in model.features.parameters():
        param.requires_grad = False

    # The embedding head is trainable by default
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
        features = model(imgs)  # (B, 128)
        logits = model.classifier(features)  # (B, num_classes)
        loss = criterion(logits, labels)

        loss.backward()
        optimizer.step()

        total_loss += loss.item() * imgs.size(0)
        _, predicted = features.max(1)
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
            _, predicted = features.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)

    return total_loss / total, 100. * correct / total


def main():
    parser = argparse.ArgumentParser(description="Stage 1: Train 128-dim embedding head")
    parser.add_argument("--data", type=str, default=None, help="Path to dataset folder")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--embed-dim", type=int, default=128)
    parser.add_argument("--output", type=str, default="weights/stage1.pth")
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    device = torch.device(args.device)
    print(f"Using device: {device}")

    # Create dataset
    if args.data:
        train_ds = NosePrintDataset(args.data)
        print(f"Loaded {len(train_ds)} images from {args.data}")
    else:
        # Dummy dataset for pipeline testing
        train_ds = DummyDataset(num_classes=50, samples_per_class=10)
        print(f"No --data provided, using dummy dataset: {len(train_ds)} images")

    # Temporarily add classes attribute for proxy classifier
    train_ds.classes = list(range(len(train_ds.class_names))) if hasattr(train_ds, 'class_names') else list(range(50))

    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True, num_workers=0, pin_memory=True)

    # Build model
    num_classes = len(train_ds.classes)
    model = build_model(num_classes=num_classes, embedding_dim=args.embed_dim)
    model = model.to(device)
    print(f"Model built: embedding_dim={args.embed_dim}, num_classes={num_classes}")

    # Criterion and optimizer (only head parameters are trainable)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=args.lr)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)

    best_acc = 0.0
    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device, epoch)
        val_loss, val_acc = evaluate(model, train_loader, criterion, device, epoch)
        scheduler.step()

        print(f"Epoch {epoch}: train_loss={train_loss:.4f}, train_acc={train_acc:.2f}%, "
              f"val_loss={val_loss:.4f}, val_acc={val_acc:.2f}%")

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), args.output)
            print(f"  -> Saved best model to {args.output}")

    print(f"\nTraining complete. Best val acc: {best_acc:.2f}%")


if __name__ == "__main__":
    main()
