import warnings
warnings.filterwarnings('ignore')
import sys
sys.path.insert(0, '.')

from src.models.mobilenet import ResNet50_512d
import torch
from PIL import Image
from src.utils.image import image_to_tensor

print("1. Loading nose model...")
model = ResNet50_512d(embedding_dim=512, pretrained=False)
state_dict = torch.load('weights/nose_v3_sgd.pth', map_location='cpu', weights_only=False)
if isinstance(state_dict, dict) and 'state_dict' in state_dict:
    state_dict = state_dict['state_dict']
model.load_state_dict(state_dict, strict=False)
model.eval()
print("   Loaded OK")

print("2. Creating test image...")
img = Image.new('RGB', (224, 224), color=(100, 100, 100))
tensor = image_to_tensor(img).unsqueeze(0)
print(f"   tensor shape: {tensor.shape}")

print("3. Running inference...")
with torch.no_grad():
    vec = model(tensor)
print(f"   output shape: {vec.shape}")
print("   OK!")