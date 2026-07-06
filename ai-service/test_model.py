import warnings
warnings.filterwarnings('ignore')

import torch, sys
sys.path.insert(0, '.')

from src.models.mobilenet import MobileNetV2_128d

print("1. Creating model...")
model = MobileNetV2_128d(embedding_dim=512, num_classes=157)
print("   classifier weight shape:", model.classifier.weight.shape)

print("2. Loading checkpoint...")
ckpt = torch.load('weights/breed_classifier_v3.pth', map_location='cpu', weights_only=True)
print("   checkpoint keys:", list(ckpt.keys()))

print("3. Filtering state_dict (removing classifier keys)...")
sd = {k: v for k, v in ckpt['state_dict'].items() if 'classifier' not in k}
print("   filtered keys count:", len(sd))

print("4. Loading into model...")
result = model.load_state_dict(sd, strict=False)
print("   load result:", result)

print("5. Model classifier weight shape after load:", model.classifier.weight.shape)
print("   model.eval() OK")

# Now test inference
print("6. Testing inference...")
from src.utils.image import base64_to_image, image_to_tensor
import numpy as np

# Create a dummy image
from PIL import Image
img = Image.new('RGB', (224, 224), color=(100, 100, 100))
tensor = image_to_tensor(img).unsqueeze(0)
print("   dummy image tensor shape:", tensor.shape)

import torch.nn as nn
with torch.no_grad():
    feats = model.features(tensor)
    feats = model.avgpool(feats)
    feats = model.embedding(feats)
    feats = nn.functional.normalize(feats, p=2, dim=1)
    print("   feature shape:", feats.shape)
    print("   feature norm:", feats.norm().item())

print("\nAll OK!")