import warnings
warnings.filterwarnings('ignore')

import os
from fastapi.testclient import TestClient
import sys
sys.path.insert(0, '.')

from src.main import app

client = TestClient(app)

print(f"CWD: {os.getcwd()}")
print(f" weights exists: {os.path.exists('weights/nose_v3_sgd.pth')}")
print(f" breeds exists: {os.path.exists('weights/breed_classifier_v3.pth')}")

# Test /extract/feature
import base64, io
from PIL import Image
img = Image.new('RGB', (224, 224), color=(100, 100, 100))
buf = io.BytesIO()
img.save(buf, 'JPEG')
b = base64.b64encode(buf.getvalue()).decode()
image_b64 = 'data:image/jpeg;base64,' + b

print("\nTest /extract/feature...")
resp = client.post('/extract/feature', json={'image': image_b64})
print(f"Status: {resp.status_code}")
print(f"Body: {resp.text[:300]}")

print("\nTest /classify/breed...")
resp2 = client.post('/classify/breed', json={'image': image_b64})
print(f"Status: {resp2.status_code}")
print(f"Body: {resp2.text[:300]}")