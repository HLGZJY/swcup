import warnings
warnings.filterwarnings('ignore')
import torch

# Check nose model
ckpt = torch.load('weights/nose_v3_sgd.pth', map_location='cpu')
sd = ckpt['state_dict'] if 'state_dict' in ckpt else ckpt
keys = list(sd.keys())
print('Nose model first 5 keys:', keys[:5])
print('Has backbone:', any('backbone' in k for k in keys))
print('Has features:', any('features.' in k for k in keys))
print('Has fc:', any('fc.' in k or 'backbone.fc' in k for k in keys))

# Check breed model
ckpt2 = torch.load('weights/breed_classifier_v3.pth', map_location='cpu', weights_only=True)
sd2 = ckpt2['state_dict'] if 'state_dict' in ckpt2 else ckpt2
keys2 = list(sd2.keys())
print('\nBreed model first 5 keys:', keys2[:5])
print('Has backbone:', any('backbone' in k for k in keys2))
print('Has features:', any('features.' in k for k in keys2))
print('Has fc:', any('fc.' in k or 'backbone.fc' in k for k in keys2))