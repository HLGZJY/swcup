import warnings
warnings.filterwarnings('ignore')
import os
from PIL import Image

# Create a simple test image
img = Image.new('RGB', (224, 224), color=(100, 100, 100))
img.save('test_img.jpg', 'JPEG')
print(f'Created test_img.jpg, size: {os.path.getsize("test_img.jpg")} bytes')

# Read and convert to base64
with open('test_img.jpg', 'rb') as f:
    img_b64 = 'data:image/jpeg;base64,' + f.read().hex()
# Actually use base64 encoding
import base64 as b64
with open('test_img.jpg', 'rb') as f:
    img_data = b64.b64encode(f.read()).decode()

image_b64 = 'data:image/jpeg;base64,' + img_data
print(f'Image base64 length: {len(image_b64)}')

import requests
print('\nCalling FastAPI /classify/breed...')
try:
    resp = requests.post(
        'http://localhost:8000/classify/breed',
        json={'image': image_b64},
        timeout=60
    )
    print(f'Status: {resp.status_code}')
    print(f'Body: {resp.text[:300]}')
except Exception as e:
    print(f'Error: {e}')

print('\nCalling FastAPI /extract/feature...')
try:
    resp2 = requests.post(
        'http://localhost:8000/extract/feature',
        json={'image': image_b64},
        timeout=60
    )
    print(f'Status: {resp2.status_code}')
    print(f'Body: {resp2.text[:300]}')
except Exception as e:
    print(f'Error: {e}')