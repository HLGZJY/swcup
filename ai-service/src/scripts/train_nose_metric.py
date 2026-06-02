"""Train nose print metric learning model with ArcFace loss.

6000 dogs, 4 images each.
Two-stage training: freeze backbone first, then unfreeze for fine-tuning.

Reference: pets-face-recognition

Usage:
    python -m src.scripts.train_nose_metric \
        --data dir_train/dir_train \
        --epochs 50 --batch 32 --lr 0.0001 \
        --embed-dim 512 --output weights/nose_feature.pth
"""

import argparse
import os
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
from tqdm import tqdm

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.losses import SoftmaxBasedMetricLearning, CenterLoss
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
    transforms.RandomCrop((220, 220)),
    transforms.Resize((224, 224)),
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

class NosePrintDataset(Dataset):
    """Nose print dataset organized by dog_id."""

    def __init__(self, data_dir: str, is_train: bool = True, img_size: int = 256):
        self.data_dir = Path(data_dir)
        self.is_train = is_train
        self.img_size = img_size
        self.transform = train_augmentation if is_train else val_augmentation

        # Collect all dog folders
        self.dog_ids = sorted([d.name for d in self.data_dir.iterdir() if d.is_dir()])
        self.dog_id_to_idx = {dog_id: idx for idx, dog_id in enumerate(self.dog_ids)}
        self.idx_to_dog_id = {idx: dog_id for dog_id, idx in self.dog_id_to_idx.items()}

        # Collect all image paths and labels
        self.samples = []
        for dog_dir in self.data_dir.iterdir():
            if not dog_dir.is_dir():
                continue
            dog_idx = self.dog_id_to_idx[dog_dir.name]
            for img_path in dog_dir.glob("*.jpg"):
                self.samples.append((str(img_path), dog_idx))
            for img_path in dog_dir.glob("*.jpeg"):
                self.samples.append((str(img_path), dog_idx))
            for img_path in dog_dir.glob("*.png"):
                self.samples.append((str(img_path), dog_idx))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, dog_idx = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        img_t = self.transform(img)
        return img_t, dog_idx


def split_by_dog_id(dataset: NosePrintDataset, val_ratio: float = 0.2, seed: int = 42):
    """Split dataset by dog_id (all images of same dog go to same split)."""
    random.seed(seed)
    np.random.seed(seed)

    dog_ids = list(dataset.dog_ids)
    random.shuffle(dog_ids)
    split = int(len(dog_ids) * val_ratio)
    val_dog_ids = set(dog_ids[:split])
    train_dog_ids = set(dog_ids[split:])

    train_indices = []
    val_indices = []

    for idx, (_, dog_idx) in enumerate(dataset.samples):
        dog_id = dataset.idx_to_dog_id[dog_idx]
        if dog_id in val_dog_ids:
            val_indices.append(idx)
        else:
            train_indices.append(idx)

    return train_indices, val_indices


# ------------------------------------------------------------------
# Validation
# ------------------------------------------------------------------

def compute_pair_cosine_similarity(model, dataloader, device, dataset: NosePrintDataset):
    """Compute same-dog and different-dog cosine similarity on validation set."""
    model.eval()

    embeddings = []
    labels = []

    with torch.no_grad():
        for imgs, dog_indices in tqdm(dataloader, desc="Extracting embeddings"):
            imgs = imgs.to(device)
            feats = model(imgs)
            embeddings.append(feats.cpu())
            labels.append(dog_indices)

    embeddings = torch.cat(embeddings, dim=0)
    labels = torch.cat(labels, dim=0)
    n = len(embeddings)

    # Pre-group indices by dog_id
    dog_id_to_indices: dict[int, list[int]] = {}
    for idx, dog_id in enumerate(labels.tolist()):
        dog_id_to_indices.setdefault(dog_id, []).append(idx)

    # Same-dog pairs
    same_dog_sims = []
    for dog_id, indices in dog_id_to_indices.items():
        if len(indices) < 2:
            continue
        feats_for_dog = embeddings[indices]
        sims = torch.mm(feats_for_dog, feats_for_dog.T).triu(diagonal=1)
        same_dog_sims.extend(sims[sims != 0].tolist())

    # Different-dog pairs
    diff_dog_sims = []
    n_diff_pairs = min(len(same_dog_sims), 10000)
    all_indices = torch.arange(n)
    attempts = 0
    max_attempts = n_diff_pairs * 3
    while len(diff_dog_sims) < n_diff_pairs and attempts < max_attempts:
        idx_i = torch.randint(0, n, (5000,))
        idx_j = torch.randint(0, n, (5000,))
        for i, j in zip(idx_i.tolist(), idx_j.tolist()):
            if labels[i] != labels[j]:
                diff_dog_sims.append(torch.dot(embeddings[i], embeddings[j]).item())
            if len(diff_dog_sims) >= n_diff_pairs:
                break
        attempts += 1

    same_dog_sim = np.mean(same_dog_sims) if same_dog_sims else 0.0
    diff_dog_sim = np.mean(diff_dog_sims) if diff_dog_sims else 0.0

    return same_dog_sim, diff_dog_sim


def compute_recall_at_k(model, dataloader, device, dataset: NosePrintDataset, k: int = 1):
    """Compute Recall@K: for each image, find most similar image, check if same dog."""
    model.eval()

    embeddings = []
    labels = []

    with torch.no_grad():
        for imgs, dog_indices in tqdm(dataloader, desc=f"Computing Recall@{k}"):
            imgs = imgs.to(device)
            feats = model(imgs)
            embeddings.append(feats.cpu())
            labels.append(dog_indices)

    embeddings = torch.cat(embeddings, dim=0)
    labels = torch.cat(labels, dim=0)

    n = len(embeddings)
    correct = 0

    for i in range(n):
        sims = torch.cosine_similarity(embeddings[i].unsqueeze(0), embeddings, dim=1)
        sims[i] = -1

        _, topk_indices = sims.topk(k, dim=0)

        for idx in topk_indices:
            if labels[idx] == labels[i]:
                correct += 1
                break

    recall = correct / n
    return recall * 100


# ------------------------------------------------------------------
# Training
# ------------------------------------------------------------------

def train_epoch(model, dataloader, optimizer, device, epoch: int, metric_model,
                center_loss=None, center_loss_weight=0.0, center_momentum=0.9):
    metric_model.train()
    total_loss = 0.0
    total = 0

    pbar = tqdm(dataloader, desc=f"Epoch {epoch} [Train]")
    for imgs, dog_indices in pbar:
        imgs = imgs.to(device)
        dog_indices = dog_indices.to(device)

        optimizer.zero_grad()

        result = metric_model(imgs, dog_indices)
        loss = result["loss"]

        if center_loss is not None and center_loss_weight > 0:
            embeddings = result["emb"]
            c_loss = center_loss(embeddings, dog_indices)
            loss = loss + center_loss_weight * c_loss

            with torch.no_grad():
                centers_batch = center_loss.centers[dog_indices]
                diff = embeddings - centers_batch
                updated_centers = center_momentum * centers_batch + (1 - center_momentum) * (centers_batch - diff)
                center_loss.centers[dog_indices] = updated_centers

        loss.backward()
        optimizer.step()

        total_loss += loss.item() * imgs.size(0)
        total += imgs.size(0)

        pbar.set_postfix({"loss": f"{loss.item():.4f}"})

    return total_loss / total


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Train nose metric model with ArcFace loss")
    parser.add_argument("--data", type=str, default="dir_train/dir_train",
                        help="Nose print data root directory")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--lr", type=float, default=0.01,
                        help="Base learning rate (SGD, 参考pets-face-recognition)")
    parser.add_argument("--embed-dim", type=int, default=512)
    parser.add_argument("--num-classes", type=int, default=6000,
                        help="Number of dogs (6000)")
    parser.add_argument("--output", type=str, default="weights/nose_feature.pth")
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--resume", type=str, default=None)
    parser.add_argument("--no-freeze-backbone", action="store_true")
    parser.add_argument("--val-ratio", type=float, default=0.2)
    parser.add_argument("--arc-s", type=float, default=30.0,
                        help="ArcFace scale (降到30，原64过大使相似度集中在0.9+)")
    parser.add_argument("--arc-m", type=float, default=0.5, help="ArcFace margin")
    parser.add_argument("--unlock-after", type=int, default=10,
                        help="Unlock backbone after N epochs (提前到10)")
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--val-batch", type=int, default=64)
    parser.add_argument("--train-limit", type=int, default=None,
                        help="Limit training samples (for quick testing)")
    parser.add_argument("--val-limit", type=int, default=None,
                        help="Limit validation samples (for quick testing)")
    parser.add_argument("--center-loss-weight", type=float, default=0.0,
                        help="Weight for center loss (0=disabled, 原0.1)")
    parser.add_argument("--center-lr", type=float, default=0.5,
                        help="Learning rate for center updates")
    parser.add_argument("--momentum", type=float, default=0.9,
                        help="SGD momentum (参考pets-face-recognition用0.9)")
    args = parser.parse_args()

    device = torch.device(args.device)
    print(f"Device: {device}")

    # Build dataset
    print("Building dataset...")
    full_dataset = NosePrintDataset(args.data, is_train=True)

    num_classes = len(full_dataset.dog_ids)
    print(f"Total dogs: {num_classes}, images: {len(full_dataset)}")

    # Split by dog_id
    train_indices, val_indices = split_by_dog_id(full_dataset, args.val_ratio)
    train_dataset = torch.utils.data.Subset(full_dataset, train_indices)
    val_dataset = torch.utils.data.Subset(full_dataset, val_indices)

    if args.train_limit is not None and args.train_limit < len(train_dataset):
        train_dataset = torch.utils.data.Subset(train_dataset, range(args.train_limit))

    if args.val_limit is not None and args.val_limit < len(val_dataset):
        val_dataset = torch.utils.data.Subset(val_dataset, range(args.val_limit))

    print(f"Train: {len(train_dataset)} images, Val: {len(val_dataset)} images")

    train_loader = DataLoader(train_dataset, batch_size=args.batch, shuffle=True, num_workers=0, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=args.val_batch, shuffle=False, num_workers=0, pin_memory=True)

    # Build model
    print("Building ResNet50 model...")
    model = ResNet50_512d(embedding_dim=args.embed_dim)
    metric_model = SoftmaxBasedMetricLearning(
        model=model,
        num_class=num_classes,
        embedding_size=args.embed_dim,
        s=args.arc_s,
        m=args.arc_m,
        is_focal=True,
    )

    # Center loss for compact class embeddings
    center_loss = None
    if args.center_loss_weight > 0:
        print(f"Center loss enabled (weight={args.center_loss_weight})")
        center_loss = CenterLoss(
            num_classes=num_classes,
            embedding_dim=args.embed_dim,
            center_lr=args.center_lr,
        ).to(device)

    if args.resume:
        print(f"Loading checkpoint: {args.resume}")
        ckpt = torch.load(args.resume, map_location=device)
        model.load_state_dict(ckpt["state_dict"], strict=False)
        print(f"  Resumed from best_cos_sim={ckpt.get('best_cos_sim', 0):.4f}")

    # Two-stage training
    freeze_backbone = not args.no_freeze_backbone
    if freeze_backbone:
        for param in model.backbone.parameters():
            param.requires_grad = False
        print("Backbone frozen (stage 1)")

    metric_model = metric_model.to(device)

    # Optimizer with separate LR (参考pets-face-recognition使用SGD)
    # Stage 1: backbone冻结，只训练fc和margin head
    params1 = [p for i, p in model.named_parameters() if "backbone." in i]
    params2 = [p for i, p in model.named_parameters() if "backbone." not in i]
    params3 = list(metric_model.add_margin.parameters())
    params4 = [] if center_loss is None else list(center_loss.parameters())

    optimizer = optim.SGD([
        {"params": params1, "lr": args.lr / 2 if freeze_backbone else args.lr * 0.01},
        {"params": params2, "lr": args.lr},
        {"params": params3, "lr": args.lr, "weight_decay": args.weight_decay},
        {"params": params4, "lr": args.center_lr},
    ], lr=args.lr, momentum=args.momentum)

    scheduler = optim.lr_scheduler.MultiStepLR(
        optimizer, milestones=[int(args.epochs * 0.7), int(args.epochs * 0.9)], gamma=0.1
    )

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)

    best_cos_sim = 0.0

    for epoch in range(1, args.epochs + 1):
        # Stage 2: unlock backbone
        if epoch == args.unlock_after and freeze_backbone:
            for param in model.backbone.parameters():
                param.requires_grad = True
            print(f"\n[Epoch {epoch}] Backbone unlocked (stage 2)")

            backbone_non_fc = [p for i, p in model.named_parameters() if "backbone." in i and "fc" not in i]
            backbone_fc = [p for i, p in model.named_parameters() if "backbone." in i and "fc" in i]
            params4 = [] if center_loss is None else list(center_loss.parameters())
            optimizer = optim.SGD([
                {"params": backbone_non_fc, "lr": args.lr * 0.01},
                {"params": backbone_fc, "lr": args.lr * 0.1},
                {"params": params3, "lr": args.lr * 0.1, "weight_decay": args.weight_decay},
                {"params": params4, "lr": args.center_lr},
            ], lr=args.lr, momentum=args.momentum)
            scheduler = optim.lr_scheduler.MultiStepLR(
                optimizer, milestones=[int(args.epochs * 0.7), int(args.epochs * 0.9)], gamma=0.1
            )
            print("  Optimizer reset with lower learning rates")

        train_loss = train_epoch(
            model, train_loader, optimizer, device, epoch, metric_model,
            center_loss=center_loss, center_loss_weight=args.center_loss_weight,
        )

        # Validation
        same_dog_sim, diff_dog_sim = compute_pair_cosine_similarity(
            model, val_loader, device, val_dataset
        )
        recall_at_1 = compute_recall_at_k(model, val_loader, device, val_dataset, k=1)

        scheduler.step()

        print(f"Epoch {epoch}: train_loss={train_loss:.4f}, "
              f"same_dog_sim={same_dog_sim:.4f}, diff_dog_sim={diff_dog_sim:.4f}, "
              f"recall@1={recall_at_1:.2f}%")

        # Save best model
        if same_dog_sim > best_cos_sim:
            best_cos_sim = same_dog_sim
            ckpt = {
                "state_dict": model.state_dict(),
                "embedding_dim": args.embed_dim,
                "num_classes": num_classes,
                "best_cos_sim": best_cos_sim,
                "margin_s": args.arc_s,
                "margin_m": args.arc_m,
            }
            torch.save(ckpt, args.output)
            print(f"  -> Saved best model to {args.output}")

    print(f"\nTraining complete. Best same_dog_sim={best_cos_sim:.4f}")


if __name__ == "__main__":
    main()