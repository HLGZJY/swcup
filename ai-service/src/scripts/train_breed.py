"""Train breed classification model with ArcFace loss.

Oxford Pets (37 classes) + Stanford Dogs (120 classes) joint training.
Two-stage training: freeze backbone first, then unfreeze for fine-tuning.

Reference: pets-face-recognition (https://github.com/n00b87t/pets-face-recognition)

Usage:
    python -m src.scripts.train_breed \
        --data-oxford oxford_pets_split/train \
        --data-stanford Stanford_Dogs \
        --epochs 20 --batch 32 --lr 0.0001 \
        --embed-dim 512 --num-classes 157 \
        --output weights/breed_classifier.pth
"""

import argparse
import os
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, ConcatDataset
from torchvision import transforms, models
from PIL import Image
from tqdm import tqdm

import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.losses import SoftmaxBasedMetricLearning
from src.models.mobilenet import ResNet50_512d


# ------------------------------------------------------------------
# Data Augmentation (from pets-face-recognition)
# ------------------------------------------------------------------

def resize_with_padding(img, target_size=(256, 256)):
    """Resize image keeping aspect ratio, pad with zeros."""
    w, h = img.size
    target_w, target_h = target_size
    scale = min(target_w / w, target_h / h)
    new_w, new_h = int(w * scale), int(h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    new_img = Image.new("RGB", (target_w, target_h), (0, 0, 0))
    paste_x = (target_w - new_w) // 2
    paste_y = (target_h - new_h) // 2
    new_img.paste(img, (paste_x, paste_y))
    return new_img


train_augmentation = transforms.Compose([
    transforms.Lambda(lambda img: resize_with_padding(img, (256, 256))),
    transforms.RandomCrop((252, 252)),
    transforms.Resize((256, 256)),
    transforms.RandomRotation(5),
    transforms.RandomAdjustSharpness(0, 0.1),
    transforms.RandomAutocontrast(0.3),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

val_augmentation = transforms.Compose([
    transforms.Lambda(lambda img: resize_with_padding(img, (256, 256))),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


# ------------------------------------------------------------------
# Dataset
# ------------------------------------------------------------------

class BreedDataset(Dataset):
    """Oxford Pets or Stanford Dogs dataset."""

    def __init__(
        self,
        root_dir: str,
        is_train: bool = True,
        img_size: int = 256,
    ):
        self.root_dir = Path(root_dir)
        self.is_train = is_train
        self.img_size = img_size
        self.transform = train_augmentation if is_train else val_augmentation

        self.samples = []
        self.class_names = []

        class_dirs = sorted([d for d in self.root_dir.iterdir() if d.is_dir()])
        self.class_names = [d.name for d in class_dirs]
        class_to_idx = {name: idx for idx, name in enumerate(self.class_names)}

        for class_dir in class_dirs:
            label = class_to_idx[class_dir.name]
            for img_path in class_dir.glob("*.jpg"):
                self.samples.append((str(img_path), label))
            for img_path in class_dir.glob("*.jpeg"):
                self.samples.append((str(img_path), label))
            for img_path in class_dir.glob("*.png"):
                self.samples.append((str(img_path), label))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        img_t = self.transform(img)
        return img_t, label


class CombinedBreedDataset(Dataset):
    """Oxford Pets + Stanford Dogs combined dataset."""

    def __init__(
        self,
        oxford_dir: str,
        stanford_dir: str,
        num_oxford_classes: int,
        is_train: bool = True,
        img_size: int = 256,
    ):
        self.oxford = BreedDataset(oxford_dir, is_train=is_train, img_size=img_size)
        self.stanford = BreedDataset(stanford_dir, is_train=is_train, img_size=img_size)

        self.samples = self.oxford.samples + [
            (path, label + num_oxford_classes) for path, label in self.stanford.samples
        ]
        self.class_names = self.oxford.class_names + self.stanford.class_names
        self.transform = self.oxford.transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        img_t = self.transform(img)
        return img_t, label


def stratified_split(samples: list, labels: list, val_ratio: float = 0.2, seed: int = 42):
    """Split dataset by class, ensuring each class has samples in both train and val."""
    random.seed(seed)
    np.random.seed(seed)

    unique_labels = list(set(labels))
    train_indices = []
    val_indices = []

    for label in unique_labels:
        label_indices = [i for i, l in enumerate(labels) if l == label]
        random.shuffle(label_indices)
        split = int(len(label_indices) * val_ratio)
        val_indices.extend(label_indices[:split])
        train_indices.extend(label_indices[split:])

    return train_indices, val_indices


# ------------------------------------------------------------------
# Training
# ------------------------------------------------------------------

def train_epoch(model, dataloader, optimizer, device, epoch: int, metric_model):
    metric_model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    pbar = tqdm(dataloader, desc=f"Epoch {epoch} [Train]")
    for imgs, labels in pbar:
        imgs = imgs.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()

        result = metric_model(imgs, labels)
        loss = result["loss"]

        loss.backward()
        optimizer.step()

        total_loss += loss.item() * imgs.size(0)
        logits = result["logits"]
        _, predicted = logits.max(1)
        correct += predicted.eq(labels).sum().item()
        total += labels.size(0)

        pbar.set_postfix({"loss": f"{loss.item():.4f}", "acc": f"{100.*correct/total:.2f}%"})

    return total_loss / total, 100.0 * correct / total


def evaluate(model, dataloader, device, epoch: int, metric_model):
    """Evaluate with Top-1 and Top-3 accuracy."""
    metric_model.eval()
    total_loss = 0.0
    correct_top1 = 0
    correct_top3 = 0
    total = 0

    all_probs = []

    with torch.no_grad():
        pbar = tqdm(dataloader, desc=f"Epoch {epoch} [Eval]")
        for imgs, labels in pbar:
            imgs = imgs.to(device)
            labels = labels.to(device)

            result = metric_model(imgs, labels)
            loss = result["loss"]
            logits = result["logits"]

            total_loss += loss.item() * imgs.size(0)
            total += labels.size(0)

            probs = torch.softmax(logits, dim=1)
            all_probs.append(probs.cpu())

            _, predicted = logits.max(1)
            correct_top1 += predicted.eq(labels).sum().item()

            _, top3_predicted = probs.topk(3, dim=1)
            for i, label in enumerate(labels):
                if label in top3_predicted[i]:
                    correct_top3 += 1

    all_probs = torch.cat(all_probs, dim=0)
    top1_acc = 100.0 * correct_top1 / total
    top3_acc = 100.0 * correct_top3 / total

    return total_loss / total, top1_acc, top3_acc


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Train breed classifier with ArcFace loss")
    parser.add_argument("--data-oxford", type=str, default="oxford_pets_split/train",
                        help="Oxford Pets train directory")
    parser.add_argument("--data-stanford", type=str, default="Stanford_Dogs",
                        help="Stanford Dogs root directory")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--lr", type=float, default=0.0001)
    parser.add_argument("--embed-dim", type=int, default=512)
    parser.add_argument("--num-classes", type=int, default=157,
                        help="Total classes: 37 Oxford + 120 Stanford = 157")
    parser.add_argument("--output", type=str, default="weights/breed_classifier.pth")
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--resume", type=str, default=None)
    parser.add_argument("--no-freeze-backbone", action="store_true",
                        help="Unfreeze backbone from start")
    parser.add_argument("--val-ratio", type=float, default=0.2)
    parser.add_argument("--arc-s", type=float, default=64.0, help="ArcFace scale")
    parser.add_argument("--arc-m", type=float, default=0.5, help="ArcFace margin")
    parser.add_argument("--unlock-after", type=int, default=10,
                        help="Unlock backbone after N epochs (two-stage training)")
    parser.add_argument("--weight-decay", type=float, default=1e-4,
                        help="Weight decay for margin parameters")
    parser.add_argument("--focal-gamma", type=float, default=0.0,
                        help="Focal loss gamma (0 = standard CE)")
    parser.add_argument("--train-limit", type=int, default=None,
                        help="Limit training samples (for quick testing)")
    parser.add_argument("--val-limit", type=int, default=None,
                        help="Limit validation samples (for quick testing)")
    args = parser.parse_args()

    device = torch.device(args.device)
    print(f"Device: {device}")

    # Count classes
    oxford_classes = sorted([d.name for d in Path(args.data_oxford).iterdir() if d.is_dir()])
    num_oxford = len(oxford_classes)
    print(f"Oxford Pets: {num_oxford} classes")

    stanford_classes = sorted([d.name for d in Path(args.data_stanford).iterdir() if d.is_dir()])
    num_stanford = len(stanford_classes)
    print(f"Stanford Dogs: {num_stanford} classes")

    num_classes = num_oxford + num_stanford
    print(f"Total classes: {num_classes}")

    # Build dataset
    print("Building dataset...")
    full_dataset = CombinedBreedDataset(
        oxford_dir=args.data_oxford,
        stanford_dir=args.data_stanford,
        num_oxford_classes=num_oxford,
        is_train=True,
    )

    labels = [label for _, label in full_dataset.samples]
    train_indices, val_indices = stratified_split(full_dataset.samples, labels, args.val_ratio)

    train_dataset = torch.utils.data.Subset(full_dataset, train_indices)
    val_dataset = torch.utils.data.Subset(full_dataset, val_indices)

    if args.train_limit is not None and args.train_limit < len(train_dataset):
        train_dataset = torch.utils.data.Subset(train_dataset, range(args.train_limit))

    if args.val_limit is not None and args.val_limit < len(val_dataset):
        val_dataset = torch.utils.data.Subset(val_dataset, range(args.val_limit))

    print(f"Train: {len(train_dataset)} images, Val: {len(val_dataset)} images")

    train_loader = DataLoader(train_dataset, batch_size=args.batch, shuffle=True, num_workers=0, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch, shuffle=False, num_workers=0, pin_memory=True)

    # Build model
    print("Building ResNet50 model...")
    model = ResNet50_512d(embedding_dim=args.embed_dim)
    metric_model = SoftmaxBasedMetricLearning(
        model=model,
        num_class=num_classes,
        embedding_size=args.embed_dim,
        s=args.arc_s,
        m=args.arc_m,
        is_focal=(args.focal_gamma > 0),
    )
    metric_model = metric_model.to(device)

    if args.resume:
        print(f"Loading checkpoint: {args.resume}")
        ckpt = torch.load(args.resume, map_location=device)
        model.load_state_dict(ckpt["state_dict"], strict=False)
        print(f"  Resumed from best_acc={ckpt.get('best_acc', 0):.2f}%")

    # Two-stage training: freeze backbone first
    freeze_backbone = not args.no_freeze_backbone
    if freeze_backbone:
        for param in model.backbone.parameters():
            param.requires_grad = False
        print("Backbone frozen (stage 1)")

    metric_model = metric_model.to(device)

    # Optimizer with separate LR (from pets-face-recognition)
    # backbone params: lower lr, fc/embedding: higher lr, margin: lr + weight_decay
    params1 = [p for i, p in model.named_parameters() if "fc" not in i]
    params2 = [p for i, p in model.named_parameters() if "fc" in i]
    params3 = list(metric_model.add_margin.parameters())

    optimizer = optim.AdamW([
        {"params": params1, "lr": args.lr / 2 if freeze_backbone else args.lr * 0.1},
        {"params": params2, "lr": args.lr},
        {"params": params3, "lr": args.lr, "weight_decay": args.weight_decay},
    ], lr=args.lr)

    scheduler = optim.lr_scheduler.MultiStepLR(
        optimizer, milestones=[35, 45], gamma=0.1
    )

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)

    best_top1 = 0.0
    best_top3 = 0.0

    for epoch in range(1, args.epochs + 1):
        # Stage 2: unlock backbone
        if epoch == args.unlock_after and freeze_backbone:
            for param in model.backbone.parameters():
                param.requires_grad = True
            print(f"\n[Epoch {epoch}] Backbone unlocked (stage 2)")

            # Split backbone params: non-fc vs fc (fc gets higher lr)
            backbone_non_fc = [p for i, p in model.named_parameters() if "backbone." in i and "fc" not in i]
            backbone_fc = [p for i, p in model.named_parameters() if "backbone." in i and "fc" in i]

            optimizer = optim.AdamW([
                {"params": backbone_non_fc, "lr": args.lr * 0.01},
                {"params": backbone_fc, "lr": args.lr * 0.1},
                {"params": params3, "lr": args.lr * 0.1, "weight_decay": args.weight_decay},
            ])
            scheduler = optim.lr_scheduler.MultiStepLR(
                optimizer, milestones=[35, 45], gamma=0.1
            )
            print("  Optimizer reset with lower learning rates")

        train_loss, train_acc = train_epoch(
            model, train_loader, optimizer, device, epoch, metric_model
        )
        val_loss, top1_acc, top3_acc = evaluate(
            model, val_loader, device, epoch, metric_model
        )

        print(f"Epoch {epoch}: train_loss={train_loss:.4f}, train_acc={train_acc:.2f}%, "
              f"val_loss={val_loss:.4f}, val_top1={top1_acc:.2f}%, val_top3={top3_acc:.2f}%")

        scheduler.step()

        if top1_acc > best_top1:
            best_top1 = top1_acc
            best_top3 = top3_acc
            ckpt = {
                "state_dict": model.state_dict(),
                "embedding_dim": args.embed_dim,
                "num_classes": num_classes,
                "best_acc": best_top1,
                "best_top3": best_top3,
                "margin_s": args.arc_s,
                "margin_m": args.arc_m,
            }
            torch.save(ckpt, args.output)
            print(f"  -> Saved best model to {args.output}")

    print(f"\nTraining complete. Best val top1={best_top1:.2f}%, top3={best_top3:.2f}%")


if __name__ == "__main__":
    main()