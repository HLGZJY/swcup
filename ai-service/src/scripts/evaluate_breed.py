"""Evaluate breed classification model on Oxford Pets test set.

Supports both MobileNetV2_128d and ResNet50_512d models.

Usage:
    python -m src.scripts.evaluate_breed \
        --model weights/breed_classifier.pth \
        --data oxford_pets_split/test
"""

import argparse
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
from tqdm import tqdm

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.models.mobilenet import MobileNetV2_128d, ResNet50_512d


class BreedTestDataset(Dataset):
    """Oxford Pets test dataset."""

    def __init__(self, data_dir: str, num_oxford_classes: int = 37, img_size: int = 256):
        self.data_dir = Path(data_dir)
        self.img_size = img_size

        self.transform = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        self.samples = []

        class_dirs = sorted([d for d in self.data_dir.iterdir() if d.is_dir()])
        self.class_names = [d.name for d in class_dirs]
        self.class_to_idx = {name: idx for idx, name in enumerate(self.class_names)}
        self.idx_to_class = {idx: name for name, idx in self.class_to_idx.items()}

        for class_dir in class_dirs:
            label = self.class_to_idx[class_dir.name]
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


def evaluate_mobilenet(model, dataloader, device):
    """Evaluate MobileNetV2 model using class prototypes from embeddings."""
    model.eval()

    all_embeddings = []
    all_labels = []

    with torch.no_grad():
        for imgs, labels in tqdm(dataloader, desc="Extracting embeddings"):
            imgs = imgs.to(device)
            feats = model.features(imgs)
            feats = model.avgpool(feats)
            feats = model.embedding(feats)
            feats = nn.functional.normalize(feats, p=2, dim=1)
            all_embeddings.append(feats.cpu())
            all_labels.append(labels)

    embeddings = torch.cat(all_embeddings, dim=0)
    labels = torch.cat(all_labels, dim=0)

    unique_labels = torch.unique(labels)
    prototypes = {}
    for lbl in unique_labels:
        mask = labels == lbl
        prototypes[lbl.item()] = embeddings[mask].mean(0)

    correct_top1 = 0
    correct_top3 = 0
    total = len(labels)

    for i in range(total):
        sims = torch.tensor([
            torch.dot(embeddings[i], prototypes[l.item()]) for l in unique_labels
        ])
        _, top3_predicted = sims.topk(3)
        predicted = unique_labels[top3_predicted[0]]
        if predicted == labels[i]:
            correct_top1 += 1
        if labels[i] in unique_labels[top3_predicted]:
            correct_top3 += 1

    top1_acc = 100.0 * correct_top1 / total
    top3_acc = 100.0 * correct_top3 / total

    return top1_acc, top3_acc, total


def evaluate_resnet(model, dataloader, device):
    """Evaluate ResNet50 model using class prototypes from embeddings."""
    model.eval()

    all_embeddings = []
    all_labels = []

    # Extract embeddings
    with torch.no_grad():
        for imgs, labels in tqdm(dataloader, desc="Extracting embeddings"):
            imgs = imgs.to(device)
            feats = model(imgs)  # L2-normalized 512-dim embedding
            all_embeddings.append(feats.cpu())
            all_labels.append(labels)

    embeddings = torch.cat(all_embeddings, dim=0)
    labels = torch.cat(all_labels, dim=0)

    # Build class prototypes (mean embedding per class)
    unique_labels = torch.unique(labels)
    prototypes = {}
    for lbl in unique_labels:
        mask = labels == lbl
        prototypes[lbl.item()] = embeddings[mask].mean(0)

    # Evaluate using cosine similarity to prototypes
    correct_top1 = 0
    correct_top3 = 0
    total = len(labels)

    for i in range(total):
        sims = torch.tensor([
            torch.dot(embeddings[i], prototypes[l.item()]) for l in unique_labels
        ])
        _, top3_predicted = sims.topk(3)
        predicted = unique_labels[top3_predicted[0]]
        if predicted == labels[i]:
            correct_top1 += 1
        if labels[i] in unique_labels[top3_predicted]:
            correct_top3 += 1

    top1_acc = 100.0 * correct_top1 / total
    top3_acc = 100.0 * correct_top3 / total

    return top1_acc, top3_acc, total


def main():
    parser = argparse.ArgumentParser(description="Evaluate breed classifier")
    parser.add_argument("--model", type=str, required=True, help="Path to model weights")
    parser.add_argument("--data", type=str, default="oxford_pets_split/test",
                        help="Oxford Pets test directory")
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--batch", type=int, default=64)
    args = parser.parse_args()

    device = torch.device(args.device)
    print(f"Device: {device}")

    # Load model
    print(f"Loading model: {args.model}")
    ckpt = torch.load(args.model, map_location=device)
    embedding_dim = ckpt.get('embedding_dim', 512)
    num_classes = ckpt.get('num_classes', 37)

    # Detect model type by state_dict keys
    state_dict_keys = list(ckpt['state_dict'].keys())
    has_backbone = any('backbone.' in k for k in state_dict_keys)

    if has_backbone:
        # ResNet50 model
        print("Detected ResNet50 model")
        model = ResNet50_512d(embedding_dim=embedding_dim, pretrained=False)
        state_dict = {k: v for k, v in ckpt['state_dict'].items()}
        model.load_state_dict(state_dict, strict=False)
        model = model.to(device)
        model.eval()
        top1_acc, top3_acc, total = evaluate_resnet(model, DataLoader(BreedTestDataset(args.data), batch_size=args.batch, shuffle=False, num_workers=0), device)
    else:
        # MobileNetV2 model
        print("Detected MobileNetV2 model")
        model = MobileNetV2_128d(embedding_dim=embedding_dim, num_classes=num_classes)
        state_dict = {k: v for k, v in ckpt['state_dict'].items() if 'classifier' not in k}
        model.load_state_dict(state_dict, strict=False)
        model = model.to(device)
        model.eval()
        top1_acc, top3_acc, total = evaluate_mobilenet(model, DataLoader(BreedTestDataset(args.data), batch_size=args.batch, shuffle=False, num_workers=0), device)

    print(f"\n=== Results ===")
    print(f"Top-1 Accuracy: {top1_acc:.2f}%")
    print(f"Top-3 Accuracy: {top3_acc:.2f}%")
    print(f"Total images: {total}")


if __name__ == "__main__":
    main()