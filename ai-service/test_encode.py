import numpy as np
from src.utils.vector import cosine_similarity

def vec2hex(vec):
    normalized = np.maximum(0, np.minimum(1, (vec + 1) / 2))
    byte = np.round(normalized * 255).astype(np.uint8)
    return byte.tobytes().hex()

def hex2vec(hex_str):
    arr = np.frombuffer(bytes.fromhex(hex_str), dtype=np.uint8)
    return arr / 255.0 * 2 - 1

# Test 1: normalized vectors (what model outputs)
v = np.random.randn(512).astype(np.float32)
v_norm = v / np.linalg.norm(v)  # L2 normalized to ~1.0
print(f"Original vector norm: {np.linalg.norm(v_norm):.4f}")

enc = vec2hex(v_norm)
dec = hex2vec(enc)
print(f"Decoded vector norm: {np.linalg.norm(dec):.4f}")
print(f"Cosine sim after encode/decode: {cosine_similarity(v_norm, dec):.4f}")

# Test 2: encode -> decode same vector
enc2 = vec2hex(v_norm)
dec2 = hex2vec(enc2)
print(f"\nSame vector encode->decode cosine: {cosine_similarity(v_norm, dec2):.4f}")

# Test 3: real model output (need actual test)
print("\n--- Testing with real model output ---")
import warnings
warnings.filterwarnings('ignore')
import torch
from src.models.mobilenet import ResNet50_512d
from src.utils.image import image_to_tensor, base64_to_image
from PIL import Image

model = ResNet50_512d(embedding_dim=512, pretrained=False)
ckpt = torch.load('weights/nose_v3_sgd.pth', map_location='cpu', weights_only=False)
if isinstance(ckpt, dict) and 'state_dict' in ckpt:
    ckpt = ckpt['state_dict']
model.load_state_dict(ckpt, strict=False)
model.eval()

# Extract feature from same image twice
img1 = Image.open('test_img.jpg').convert('RGB')
img2 = Image.open('test_img.jpg').convert('RGB')
t1 = image_to_tensor(img1).unsqueeze(0)
t2 = image_to_tensor(img2).unsqueeze(0)

with torch.no_grad():
    v1 = model(t1).squeeze().numpy()
    v2 = model(t2).squeeze().numpy()

print(f"v1 norm: {np.linalg.norm(v1):.4f}, v2 norm: {np.linalg.norm(v2):.4f}")
print(f"Raw cosine sim (same image): {cosine_similarity(v1, v2):.4f}")

enc_v1 = vec2hex(v1)
enc_v2 = vec2hex(v2)
print(f"Hex lengths: v1={len(enc_v1)}, v2={len(enc_v2)}")

dec_v1 = hex2vec(enc_v1)
dec_v2 = hex2vec(enc_v2)
print(f"Decoded v1 norm: {np.linalg.norm(dec_v1):.4f}")
print(f"Decoded v2 norm: {np.linalg.norm(dec_v2):.4f}")
print(f"Cosine sim after encode/decode: {cosine_similarity(dec_v1, dec_v2):.4f}")