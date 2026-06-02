import numpy as np
from src.utils.vector import cosine_similarity, l2_distance

# Test: same vector should have cosine similarity = 1.0
a = np.array([0.5] * 512, dtype=np.float32)
b = np.array([0.5] * 512, dtype=np.float32)
print(f"Identical vectors: cosine={cosine_similarity(a,b):.4f}, l2={l2_distance(a,b):.4f}")

# Test: decode/encode test
def test_decode_encode():
    vec = np.random.randn(512).astype(np.float32)
    encoded = vec2hex(vec)
    decoded = hex2vec(encoded)
    print(f"Decode/encode test: max diff = {np.max(np.abs(vec-decoded)):.6f}")

def vec2hex(vec):
    normalized = np.maximum(0, np.minimum(1, (vec + 1) / 2))
    byte = np.round(normalized * 255).astype(np.uint8)
    return ''.join(byte.tobytes().hex())

def hex2vec(hex_str):
    arr = np.frombuffer(bytes.fromhex(hex_str), dtype=np.uint8)
    return arr / 255.0 * 2 - 1

test_decode_encode()

# Simulate what backend does: encode feature vector
# The feature vectors are stored as hex strings, then decoded for comparison
print("\nSimulating backend compare logic:")
source = np.random.randn(512).astype(np.float32)
# Simulate encoding (what collect does)
enc = vec2hex(source)
dec = hex2vec(enc)
print(f"Source vec norm: {np.linalg.norm(source):.4f}")
print(f"Decoded vec norm: {np.linalg.norm(dec):.4f}")

# Two identical real vectors
v1 = np.random.randn(512).astype(np.float32)
v1_norm = v1 / np.linalg.norm(v1)
v2 = v1_norm + np.random.randn(512).astype(np.float32) * 0.01
v2_norm = v2 / np.linalg.norm(v2)
print(f"\nNear-identical vectors cosine sim: {cosine_similarity(v1_norm, v2_norm):.4f}")