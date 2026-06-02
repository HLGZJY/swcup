import warnings
warnings.filterwarnings('ignore')
import sys
sys.path.insert(0, '.')

from src.utils.image import base64_to_image, image_to_tensor
from PIL import Image
import io, base64

# Test base64_to_image with the test image we created
with open('test_img.jpg', 'rb') as f:
    img_data = f.read()
img_b64 = 'data:image/jpeg;base64,' + base64.b64encode(img_data).decode()
print(f'Image base64 length: {len(img_b64)}')

print('Testing base64_to_image...')
img = base64_to_image(img_b64)
print(f'Decoded image: {img.size}, mode: {img.mode}')

print('Testing image_to_tensor...')
tensor = image_to_tensor(img).unsqueeze(0)
print(f'Tensor shape: {tensor.shape}')

print('Testing model inference...')
from src.models.mobilenet import ResNet50_512d
import torch
model = ResNet50_512d(embedding_dim=512, pretrained=False)
state_dict = torch.load('weights/nose_v3_sgd.pth', map_location='cpu', weights_only=False)
if isinstance(state_dict, dict) and 'state_dict' in state_dict:
    state_dict = state_dict['state_dict']
model.load_state_dict(state_dict, strict=False)
model.eval()

with torch.no_grad():
    vec = model(tensor)
print(f'Output shape: {vec.shape}')
print('OK!')