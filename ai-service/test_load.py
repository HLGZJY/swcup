import warnings
warnings.filterwarnings('ignore')

import sys
sys.path.insert(0, '.')

from src.api.breed import _load_breed_model, _breed_model, _protos

print("Loading breed model...")
_load_breed_model()
print("Model loaded:", _breed_model is not None)
print("Protos shape:", _protos.shape if _protos is not None else "None")
print("Classifier weight shape:", _breed_model.classifier.weight.shape if _breed_model else "N/A")