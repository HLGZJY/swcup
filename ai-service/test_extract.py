import warnings
warnings.filterwarnings('ignore')
import requests, base64, io
from PIL import Image

# Create test image
img = Image.new('RGB', (224, 224), color=(100, 100, 100))
buf = io.BytesIO()
img.save(buf, 'JPEG')
b = base64.b64encode(buf.getvalue()).decode()
image_b64 = 'data:image/jpeg;base64,' + b

print('Testing /extract/feature...')
r = requests.post('http://localhost:8000/extract/feature', json={'image': image_b64}, timeout=30)
print(f'Status: {r.status_code}')
print(f'Body: {r.text[:500]}')