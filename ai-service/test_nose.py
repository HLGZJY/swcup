import warnings
warnings.filterwarnings('ignore')

import torch
from src.models.mobilenet import ResNet50_512d

# Test nose model loading
print("1. Loading nose model...")
model_nose = ResNet50_512d(embedding_dim=512, pretrained=False)
state_dict = torch.load("weights/nose_v3_sgd.pth", map_location="cpu", weights_only=False)
if isinstance(state_dict, dict) and "state_dict" in state_dict:
    state_dict = state_dict["state_dict"]
result = model_nose.load_state_dict(state_dict, strict=False)
print("   load result missing_keys:", len(result.missing_keys))
print("   load result unexpected_keys:", len(result.unexpected_keys))

# Test inference
from src.utils.image import image_to_tensor
from PIL import Image
import numpy as np

img = Image.new('RGB', (224, 224), color=(100, 100, 100))
tensor = image_to_tensor(img).unsqueeze(0)
with torch.no_grad():
    vec = model_nose(tensor)
print("2. Nose inference OK, vector shape:", vec.shape, "norm:", vec.norm().item())

# Test breed model loading
print("3. Loading breed model...")
model_breed = ResNet50_512d(embedding_dim=512, pretrained=False)
state_dict2 = torch.load("weights/breed_classifier_v3.pth", map_location="cpu", weights_only=True)
if isinstance(state_dict2, dict) and "state_dict" in state_dict2:
    state_dict2 = state_dict2["state_dict"]
result2 = model_breed.load_state_dict(state_dict2, strict=False)
print("   load result missing_keys:", len(result2.missing_keys))
print("   load result unexpected_keys:", len(result2.unexpected_keys))
with torch.no_grad():
    vec2 = model_breed(tensor)
print("4. Breed inference OK, vector shape:", vec2.shape, "norm:", vec2.norm().item())

print("\nAll OK!")