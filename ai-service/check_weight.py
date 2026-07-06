import torch

ckpt = torch.load('weights/nose_v3_sgd.pth', map_location='cpu', weights_only=False)
print('Keys in checkpoint:')
for k in list(ckpt['state_dict'].keys())[:20]:
    print(f'  {k}')
print(f'\nTotal keys: {len(ckpt["state_dict"])}')
print(f'embedding_dim: {ckpt.get("embedding_dim", "N/A")}')
print(f'num_classes: {ckpt.get("num_classes", "N/A")}')
print(f'Has backbone.: {any("backbone." in k for k in ckpt["state_dict"].keys())}')