"""
向量计算工具
余弦相似度：两个 128 维向量 → 相似度分数
"""
import numpy as np


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """计算余弦相似度，输入/输出均为 Python list"""
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def cosine_distance(vec_a: list[float], vec_b: list[float]) -> float:
    """余弦距离 = 1 - 余弦相似度"""
    return 1.0 - cosine_similarity(vec_a, vec_b)
