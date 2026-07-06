"""Softmax-based metric learning wrapper for breed classification."""

import torch
import torch.nn as nn

from .arcface import ArcMarginProduct
from .focal_loss import FocalLoss


class SoftmaxBasedMetricLearning(nn.Module):
    """Wrapper combining backbone + ArcFace margin + Focal loss.

    From pets-face-recognition reference project.
    """

    def __init__(
        self,
        model: nn.Module,
        num_class: int,
        embedding_size: int = 512,
        s: float = 64.0,
        m: float = 0.5,
        is_focal: bool = True,
        arc_margin: bool = True,
        easy_margin: bool = False,
    ):
        super().__init__()
        if arc_margin:
            self.add_margin = ArcMarginProduct(
                embedding_size, num_class, s=s, m=m, easy_margin=easy_margin
            )
        else:
            from .arcface import AddMarginProduct

            self.add_margin = AddMarginProduct(embedding_size, num_class, s=s, m=m)

        if is_focal:
            self.focal_loss = FocalLoss(num_class=num_class, gamma=0)
        else:
            self.focal_loss = nn.CrossEntropyLoss()

        self.module = model
        self.softmax = nn.Softmax(dim=1)

    def forward(self, img: torch.Tensor, label=None, **__):
        if isinstance(img, (list, tuple)):
            tensor = torch.cat([self.module(i) for i in img], dim=0)
        else:
            tensor = self.module(img)

        if label is None:
            return tensor

        logits = self.add_margin(tensor, label)
        loss = self.focal_loss(logits, label)
        return {"loss": loss, "emb": tensor, "logits": logits}