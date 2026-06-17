"""Breed classification endpoint."""

import torch
import torch.nn as nn
import numpy as np
import hashlib
import os
import asyncio
from pathlib import Path
from PIL import Image
from fastapi import APIRouter, FastAPI
from pydantic import BaseModel
from contextlib import asynccontextmanager

from ..models.mobilenet import ResNet50_512d
from ..utils.image import base64_to_image, image_to_tensor

router = APIRouter(prefix="/classify", tags=["classify"])

_breed_model = None
_protos = None

PROJECT_ROOT = Path(__file__).parent.parent.parent
WEIGHTS_DIR = PROJECT_ROOT / "weights"
MODEL_PATH = WEIGHTS_DIR / "breed_classifier_v3.pth"
TRAIN_DIR = PROJECT_ROOT / "oxford_pets_split" / "train"


def _proto_cache_key():
    """Cache key derived from model file + train dir mtime/size. Any change invalidates the cache."""
    parts = [str(MODEL_PATH)]
    if MODEL_PATH.exists():
        st = os.stat(MODEL_PATH)
        parts.append(f"{st.st_size}:{st.st_mtime_ns}")
    if TRAIN_DIR.exists():
        st = os.stat(TRAIN_DIR)
        parts.append(f"train:{st.st_size}:{st.st_mtime_ns}")
    raw = "|".join(parts)
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def _proto_cache_path():
    return WEIGHTS_DIR / f"breed_protos_{_proto_cache_key()}.pt"

_BREED_NAMES = [
    "abyssinian", "american_bulldog", "american_pit_bull_terrier", "basset_hound",
    "beagle", "bengal", "birman", "bombay", "boxer", "british_shorthair",
    "chihuahua", "egyptian_mau", "english_cocker_spaniel", "english_setter",
    "german_shorthaired", "great_pyrenees", "havanese", "japanese_chin",
    "keeshond", "leonberger", "maine_coon", "miniature_pinscher", "newfoundland",
    "persian", "pomeranian", "pug", "ragdoll", "russian_blue", "saint_bernard",
    "samoyed", "scottish_terrier", "shiba_inu", "siamese", "sphynx",
    "staffordshire_bull_terrier", "wheaten_terrier", "yorkshire_terrier",
]

_BREED_CN = {
    "abyssinian": "阿比西尼亚猫", "american_bulldog": "美国 Bulldog",
    "american_pit_bull_terrier": "美国比特斗牛犬", "basset_hound": "巴吉度猎犬",
    "beagle": "比格犬", "bengal": "孟加拉猫", "birman": "伯曼猫",
    "bombay": "孟买猫", "boxer": "拳师犬", "british_shorthair": "英国短毛猫",
    "chihuahua": "吉娃娃", "egyptian_mau": "埃及猫", "english_cocker_spaniel": "英国可卡犬",
    "english_setter": "英国塞特犬", "german_shorthaired": "德国短毛指示犬",
    "great_pyrenees": "大白熊犬", "havanese": "哈瓦那犬", "japanese_chin": "日本 chin 犬",
    "keeshond": "荷兰毛狮犬", "leonberger": "莱昂贝格犬", "maine_coon": "缅因猫",
    "miniature_pinscher": "迷你杜宾犬", "newfoundland": "纽芬兰犬", "persian": "波斯猫",
    "pomeranian": "博美犬", "pug": "巴哥犬", "ragdoll": "布偶猫",
    "russian_blue": "俄罗斯蓝猫", "saint_bernard": "圣伯纳犬", "samoyed": "萨摩耶",
    "scottish_terrier": "苏格兰梗", "shiba_inu": "柴犬", "siamese": "暹罗猫",
    "sphynx": "斯芬克斯猫", "staffordshire_bull_terrier": "斯塔福郡斗牛梗",
    "wheaten_terrier": "软毛麦色梗", "yorkshire_terrier": "约克夏梗",
}


def _build_prototypes(model):  # pragma: no cover
    """Build class prototypes from training data."""
    global _protos

    project_root = Path(__file__).parent.parent.parent
    train_dir = project_root / "oxford_pets_split" / "train"

    # Try cache first to skip the 5175-image forward pass (~2 min on CPU)
    cache_path = _proto_cache_path()
    if cache_path.exists():
        try:
            _protos = torch.load(cache_path, map_location="cpu", weights_only=True)
            print(f"[breed] Prototypes loaded from cache: {cache_path.name} (skipped {sum(1 for _ in train_dir.rglob('*.jpg')) if train_dir.exists() else 0} image forward passes)")
            return
        except Exception as e:
            print(f"[breed] Cache load failed ({e}), rebuilding")

    if not train_dir.exists():
        print(f"[breed] Training data not found at {train_dir}, using classifier weight as fallback")
        _protos = nn.functional.normalize(model.backbone.fc.weight.detach(), p=2, dim=1)
        return

    from torchvision import transforms
    from torch.utils.data import Dataset, DataLoader

    class TrainDS(Dataset):
        def __init__(self, root):
            self.samples = []
            self.transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])
            class_dirs = sorted([d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d))])
            self.class_names = class_dirs
            self.c2i = {n: i for i, n in enumerate(class_dirs)}
            for cd in class_dirs:
                cd_path = os.path.join(root, cd)
                for fp in os.listdir(cd_path):
                    if fp.lower().endswith(('.jpg', '.jpeg', '.png')):
                        self.samples.append((os.path.join(cd_path, fp), self.c2i[cd]))

        def __len__(self):
            return len(self.samples)

        def __getitem__(self, idx):
            fp, label = self.samples[idx]
            img = Image.open(fp).convert("RGB")
            return self.transform(img), label

    try:
        ds = TrainDS(str(train_dir))
        if len(ds) == 0:
            raise FileNotFoundError("No images found")

        loader = DataLoader(ds, batch_size=32, shuffle=False, num_workers=0)
        all_feats, all_labels = [], []

        with torch.no_grad():
            for imgs, labels in loader:
                # ResNet50_512d forward: directly call model()
                feats = model(imgs)
                feats = nn.functional.normalize(feats, p=2, dim=1)
                all_feats.append(feats)
                all_labels.append(labels)

        all_feats = torch.cat(all_feats, 0)
        all_labels = torch.cat(all_labels, 0)

        protos = []
        for i in range(157):
            mask = all_labels == i
            if mask.any():
                protos.append(all_feats[mask].mean(0))
            else:
                protos.append(torch.zeros(512))
        _protos = torch.stack([nn.functional.normalize(p, p=2, dim=0) for p in protos])
        print(f"[breed] Built prototypes from {len(ds)} training images")

        # Persist cache for next startup
        try:
            WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
            torch.save(_protos, cache_path)
            print(f"[breed] Prototypes cached to {cache_path.name}")
        except Exception as e:
            print(f"[breed] Cache write failed (non-fatal): {e}")
    except Exception as e:
        print(f"[breed] Prototype building failed ({e}), using backbone.fc weight as fallback")
        _protos = nn.functional.normalize(model.backbone.fc.weight.detach(), p=2, dim=1)


def _load_breed_model():  # pragma: no cover
    """Load breed model + build prototypes (blocking)."""
    global _breed_model, _protos
    if _breed_model is not None:
        return

    model = ResNet50_512d(embedding_dim=512, pretrained=False)

    weights_path = "weights/breed_classifier_v3.pth"
    ckpt = torch.load(weights_path, map_location="cpu", weights_only=True)

    if isinstance(ckpt, dict) and "state_dict" in ckpt:
        state_dict = ckpt["state_dict"]
    else:
        state_dict = ckpt

    model.load_state_dict(state_dict, strict=False)
    model.eval()
    _breed_model = model

    _build_prototypes(model)


def get_breed_model():
    return _breed_model


def get_protos():
    return _protos


@asynccontextmanager
async def lifespan(app: FastAPI):  # pragma: no cover
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _load_breed_model)
    print("[breed] Breed model loaded OK")
    yield


class BreedRequest(BaseModel):
    image: str


class BreedResult(BaseModel):
    breed: str
    breed_cn: str
    confidence: float


class BreedResponse(BaseModel):
    breed: str
    breed_cn: str
    breed_id: int
    confidence: float
    top3: list[BreedResult]


@router.post("/breed", response_model=BreedResponse)
async def classify_breed(body: BreedRequest):
    """
    Classify animal breed from a body photo.
    Returns top-3 predictions with Chinese names.
    Uses ResNet50_512d + prototype matching.
    """
    img = base64_to_image(body.image)
    tensor = image_to_tensor(img).unsqueeze(0)

    model = get_breed_model()
    protos = get_protos()

    with torch.no_grad():
        feats = model(tensor)
        feats = nn.functional.normalize(feats, p=2, dim=1)

        sims = torch.mm(feats, protos.T).squeeze(0)
        top3_vals, top3_idx = torch.topk(sims, 3)
        confs = torch.softmax(top3_vals, dim=0)

        top3_results = []
        for conf, idx in zip(confs.tolist(), top3_idx.tolist()):
            breed = _BREED_NAMES[idx] if idx < len(_BREED_NAMES) else f"class_{idx}"
            top3_results.append(BreedResult(
                breed=breed,
                breed_cn=_BREED_CN.get(breed, breed),
                confidence=round(conf, 4),
            ))

        return BreedResponse(
            breed=top3_results[0].breed,
            breed_cn=top3_results[0].breed_cn,
            breed_id=int(top3_idx[0].item()),
            confidence=top3_results[0].confidence,
            top3=top3_results,
        )