"""MobileNetV2 and ResNet50 models for 512-dim feature extraction."""

import torch
import torch.nn as nn
import numpy as np
from torchvision import models


class MobileNetV2_128d(nn.Module):
    """
    MobileNetV2 backbone + 512-dim output head.
    Outputs L2-normalized 512-dim feature vector.
    """

    def __init__(self, embedding_dim: int = 512, num_classes: int = None):
        super().__init__()
        backbone = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
        # Remove the original classifier
        self.features = backbone.features
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))

        # 512-dim embedding head with dropout for regularization
        self.embedding = nn.Sequential(
            nn.Flatten(),
            nn.Linear(1280, embedding_dim),
            nn.Dropout(0.5),
        )
        # Classification head (512 -> num_classes), trained with cross-entropy
        self.classifier = nn.Linear(embedding_dim, num_classes) if num_classes else None
        self._embedding_dim = embedding_dim
        self._num_classes = num_classes

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


def load_model(weights_path: str | None = None, embedding_dim: int = 512) -> MobileNetV2_128d:
    """
    Load model, optionally from saved weights.
    Uses pretrained ImageNet weights if no weights_path provided.
    """
    model = MobileNetV2_128d(embedding_dim=embedding_dim)

    if weights_path:
        state_dict = torch.load(weights_path, map_location='cpu')
        # Filter out classifier keys if present (they won't match anyway when num_classes=None)
        state_dict = {k: v for k, v in state_dict.items() if not k.startswith('classifier')}
        model.load_state_dict(state_dict, strict=False)

    model.eval()
    return model


def extract_feature(model: MobileNetV2_128d, img_tensor: torch.Tensor) -> np.ndarray:
    """
    Extract 512-dim feature vector from an image tensor.
    Input: img_tensor shape (B, 3, 224, 224)
    Output: numpy array shape (512,)
    """
    with torch.no_grad():
        feat = model(img_tensor)
    return feat.cpu().numpy().flatten()


class ResNet50_512d(nn.Module):
    """ResNet50 backbone + 512-dim output head, from pets-face-recognition."""

    def __init__(self, embedding_dim: int = 512, num_classes: int = None, pretrained: bool = True):
        super().__init__()
        if pretrained:
            backbone = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
        else:
            backbone = models.resnet50(weights=None)
        # Replace final fc layer with embedding
        backbone.fc = nn.Linear(2048, embedding_dim)
        self.backbone = backbone
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.dropout = nn.Dropout(0.5)
        self._embedding_dim = embedding_dim
        self._num_classes = num_classes

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.backbone.conv1(x)
        x = self.backbone.bn1(x)
        x = self.backbone.relu(x)
        x = self.backbone.maxpool(x)
        x = self.backbone.layer1(x)
        x = self.backbone.layer2(x)
        x = self.backbone.layer3(x)
        x = self.backbone.layer4(x)
        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = self.dropout(x)
        x = self.backbone.fc(x)
        x = nn.functional.normalize(x, p=2, dim=1)
        return x

    @property
    def embedding_dim(self) -> int:
        return self._embedding_dim
