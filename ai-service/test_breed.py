"""Quick test to verify breed endpoint works."""
import sys
sys.path.insert(0, '.')

# Test import
from src.api import breed
print('breed routes:', [r.path for r in breed.router.routes])

# Test model loading
breed._load_breed_model()
print('breed model loaded OK')
print('protos shape:', breed._protos.shape if hasattr(breed._protos, 'shape') else 'N/A')