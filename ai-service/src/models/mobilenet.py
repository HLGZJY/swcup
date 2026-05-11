"""
MobileNetV2 特征提取模型
输出 128 维向量（阶段一训练后冻结 backbone，只训练输出层）
"""
import torch
import torch.nn as nn
import torchvision.models.mobilenet_v2 as mobilenet_v2


class MobileNetV2_128d(nn.Module):
    """
    MobileNetV2 迁移学习：冻结 backbone，输出 128 维向量
    """

    def __init__(self, pretrained: bool = True):
        super().__init__()
        # 加载预训练权重
        weights = mobilenet_v2.Weights.DEFAULT if pretrained else None
        base_model = mobilenet_v2(weights=weights)

        # 去掉最后的分类层，留下 feature extractor
        self.features = base_model.features

        # Adaptive AvgPool → 128维输出
        self.embed_dim = 128
        self.pool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(in_features=1280, out_features=self.embed_dim, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.pool(x)
        x = torch.flatten(x, 1)
        x = self.fc(x)
        # L2 归一化（度量学习常用）
        x = nn.functional.normalize(x, p=2, dim=1)
        return x

    def load_weights(self, path: str):
        """加载训练好的权重"""
        state_dict = torch.load(path, map_location="cpu")
        self.load_state_dict(state_dict)
        self.eval()


def get_model(pretrained: bool = True) -> MobileNetV2_128d:
    return MobileNetV2_128d(pretrained=pretrained)
