"""MobileNetV2 model for 128-dim feature extraction."""

import torch
import torch.nn as nn
import numpy as np
from torchvision import models


class MobileNetV2_128d(nn.Module):
    """
    MobileNetV2 backbone + 128-dim output head.
    Outputs L2-normalized 128-dim feature vector.
    """

    def __init__(self, embedding_dim: int = 128):
        super().__init__()
        backbone = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
        # Remove the original classifier
        self.features = backbone.features
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))

        # 128-dim embedding head
        self.embedding = nn.Sequential(
            nn.Flatten(),
            nn.Linear(1280, embedding_dim),
        )
        self._embedding_dim = embedding_dim

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.avgpool(x)
        x = self.embedding(x)
        # L2 normalize
        x = nn.functional.normalize(x, p=2, dim=1)
        return x

    @property
    def embedding_dim(self) -> int:
        return self._embedding_dim


def load_model(weights_path: str | None = None, embedding_dim: int = 128) -> MobileNetV2_128d:
    """
    Load model, optionally from saved weights.
    Uses pretrained ImageNet weights if no weights_path provided.
    """
    model = MobileNetV2_128d(embedding_dim=embedding_dim)

    if weights_path:
        state_dict = torch.load(weights_path, map_location='cpu')
        model.load_state_dict(state_dict)

    model.eval()
    return model


def extract_feature(model: MobileNetV2_128d, img_tensor: torch.Tensor) -> np.ndarray:
    """
    Extract 128-dim feature vector from an image tensor.
    Input: img_tensor shape (B, 3, 224, 224)
    Output: numpy array shape (128,)
    """
    with torch.no_grad():
        feat = model(img_tensor)
    return feat.cpu().numpy().flatten()
