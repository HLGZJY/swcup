"""Evaluate nose print metric learning model.

Supports both MobileNetV2_128d and ResNet50_512d models.

Metrics:
- Same-dog cosine similarity (target: > 0.80)
- Different-dog cosine similarity (target: < 0.50)
- Recall@1 (target: >= 90%)

Usage:
    python -m src.scripts.evaluate_nose \
        --model weights/nose_feature.pth \
        --data dir_train/dir_train
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


class NoseTestDataset(Dataset):
    """Nose print test dataset."""

    def __init__(self, data_dir: str, img_size: int = 256):
        self.data_dir = Path(data_dir)
        self.img_size = img_size

        self.transform = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        self.dog_ids = sorted([d.name for d in self.data_dir.iterdir() if d.is_dir()])
        self.dog_id_to_idx = {dog_id: idx for idx, dog_id in enumerate(self.dog_ids)}
        self.idx_to_dog_id = {idx: dog_id for dog_id, idx in self.dog_id_to_idx.items()}

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


def extract_embeddings_mobilenet(model, dataloader, device):
    """Extract embeddings from MobileNetV2 model."""
    model.eval()
    embeddings = []
    labels = []

    with torch.no_grad():
        for imgs, dog_indices in tqdm(dataloader, desc="Extracting embeddings"):
            imgs = imgs.to(device)
            feats = model.features(imgs)
            feats = model.avgpool(feats)
            feats = model.embedding(feats)
            feats = nn.functional.normalize(feats, p=2, dim=1)
            embeddings.append(feats.cpu())
            labels.append(dog_indices)

    embeddings = torch.cat(embeddings, dim=0)
    labels = torch.cat(labels, dim=0)
    return embeddings, labels


def extract_embeddings_resnet(model, dataloader, device):
    """Extract embeddings from ResNet50 model."""
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
    return embeddings, labels


def evaluate_metrics(embeddings, labels):
    """Compute same-dog sim, different-dog sim, and Recall@K."""
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
    n_diff_pairs = min(len(same_dog_sims), 20000)
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

    same_dog_sim_mean = np.mean(same_dog_sims) if same_dog_sims else 0.0
    same_dog_sim_std = np.std(same_dog_sims) if same_dog_sims else 0.0
    diff_dog_sim_mean = np.mean(diff_dog_sims) if diff_dog_sims else 0.0
    diff_dog_sim_std = np.std(diff_dog_sims) if diff_dog_sims else 0.0

    # Recall@1
    correct = 0
    for i in range(n):
        sims = torch.mm(embeddings[i].unsqueeze(0), embeddings.T).squeeze(0)
        sims[i] = -1

        _, top_idx = sims.max(dim=0)

        if labels[top_idx] == labels[i]:
            correct += 1

    recall_at_1 = 100.0 * correct / n

    return {
        "same_dog_cosine_similarity_mean": same_dog_sim_mean,
        "same_dog_cosine_similarity_std": same_dog_sim_std,
        "different_dog_cosine_similarity_mean": diff_dog_sim_mean,
        "different_dog_cosine_similarity_std": diff_dog_sim_std,
        "recall_at_1": recall_at_1,
        "n_same_pairs": len(same_dog_sims),
        "n_diff_pairs": len(diff_dog_sims),
        "n_images": n,
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate nose metric model")
    parser.add_argument("--model", type=str, required=True, help="Path to model weights")
    parser.add_argument("--data", type=str, default="dir_train/dir_train",
                        help="Nose print data directory")
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--batch", type=int, default=64)
    args = parser.parse_args()

    device = torch.device(args.device)
    print(f"Device: {device}")

    # Load model
    print(f"Loading model: {args.model}")
    ckpt = torch.load(args.model, map_location=device)
    embedding_dim = ckpt.get('embedding_dim', 512)
    num_classes = ckpt.get('num_classes', 6000)

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
    else:
        # MobileNetV2 model
        print("Detected MobileNetV2 model")
        model = MobileNetV2_128d(embedding_dim=embedding_dim, num_classes=num_classes)
        state_dict = {k: v for k, v in ckpt['state_dict'].items() if 'classifier' not in k}
        model.load_state_dict(state_dict, strict=False)
        model = model.to(device)
        model.eval()

    print(f"  embedding_dim={embedding_dim}, num_classes={num_classes}")
    print(f"  margin_s={ckpt.get('margin_s', 'N/A')}, margin_m={ckpt.get('margin_m', 'N/A')}")

    # Build dataset
    test_dataset = NoseTestDataset(args.data)
    print(f"Test dataset: {len(test_dataset)} images, {len(test_dataset.dog_ids)} dogs")

    test_loader = DataLoader(test_dataset, batch_size=args.batch, shuffle=False, num_workers=0, pin_memory=True)

    # Extract embeddings
    if has_backbone:
        embeddings, labels = extract_embeddings_resnet(model, test_loader, device)
    else:
        embeddings, labels = extract_embeddings_mobilenet(model, test_loader, device)

    # Compute metrics
    metrics = evaluate_metrics(embeddings, labels)

    print(f"\n=== Results ===")
    print(f"Same-dog cosine similarity:    {metrics['same_dog_cosine_similarity_mean']:.4f} (std: {metrics['same_dog_cosine_similarity_std']:.4f})")
    print(f"Different-dog cosine similarity: {metrics['different_dog_cosine_similarity_mean']:.4f} (std: {metrics['different_dog_cosine_similarity_std']:.4f})")
    print(f"Recall@1:                      {metrics['recall_at_1']:.2f}%")
    print(f"Images evaluated: {metrics['n_images']}, same pairs: {metrics['n_same_pairs']}, diff pairs: {metrics['n_diff_pairs']}")

    # Check targets
    print(f"\n=== Target Check ===")
    same_ok = "PASS" if metrics['same_dog_cosine_similarity_mean'] > 0.80 else "FAIL"
    diff_ok = "PASS" if metrics['different_dog_cosine_similarity_mean'] < 0.50 else "FAIL"
    recall_ok = "PASS" if metrics['recall_at_1'] >= 90 else "FAIL"
    print(f"Same-dog sim > 0.80: {same_ok}")
    print(f"Diff-dog sim < 0.50: {diff_ok}")
    print(f"Recall@1 >= 90%: {recall_ok}")


if __name__ == "__main__":
    main()