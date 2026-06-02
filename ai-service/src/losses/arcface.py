"""ArcFace loss implementations for metric learning.

Reference: https://github.com/ronghuaiyang/arcface-pytorch/blob/master/models/metrics.py
"""

import math

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.nn import Parameter


class ArcMarginProduct(nn.Module):
    """Large margin arc distance: s * cos(theta + m)

    Args:
        in_features: size of each input sample
        out_features: size of each output sample (num classes)
        s: norm of input feature
        m: margin (arc margin in radians)
        easy_margin: if True, use cos(theta + m) only when cos(theta) > 0
    """

    def __init__(
        self,
        in_features: int,
        out_features: int,
        s: float = 30.0,
        m: float = 0.50,
        easy_margin: bool = False,
    ):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.s = s
        self.m = m
        self.weight = Parameter(torch.FloatTensor(out_features, in_features))
        nn.init.xavier_uniform_(self.weight)

        self.easy_margin = easy_margin
        self.cos_m = math.cos(m)
        self.sin_m = math.sin(m)
        self.th = math.cos(math.pi - m)
        self.mm = math.sin(math.pi - m) * m

    def forward(self, input: torch.Tensor, label: torch.Tensor) -> torch.Tensor:
        # cos(theta) & sin(theta)
        cosine = F.linear(F.normalize(input), F.normalize(self.weight))
        sine = torch.sqrt(1.0 - torch.pow(cosine, 2).clamp(0, 1))
        # cos(theta + m) = cos(theta)cos(m) - sin(theta)sin(m)
        phi = cosine * self.cos_m - sine * self.sin_m

        if self.easy_margin:
            phi = torch.where(cosine > 0, phi, cosine)
        else:
            phi = torch.where(cosine > self.th, phi, cosine - self.mm)

        # one-hot label mask
        one_hot = torch.zeros_like(cosine)
        one_hot.scatter_(1, label.view(-1, 1).long(), 1)
        output = (one_hot * phi) + ((1.0 - one_hot) * cosine)
        output *= self.s
        return output