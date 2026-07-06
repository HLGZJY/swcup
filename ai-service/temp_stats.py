from pathlib import Path
oxford = list(Path('oxford_pets_split/train').glob('*/*.jpg')) + list(Path('oxford_pets_split/train').glob('*/*.jpeg')) + list(Path('oxford_pets_split/train').glob('*/*.png'))
stanford = list(Path('Stanford_Dogs').glob('*/*.jpg')) + list(Path('Stanford_Dogs').glob('*/*.jpeg')) + list(Path('Stanford_Dogs').glob('*/*.png'))
print(f"Oxford: {len(oxford)}, Stanford: {len(stanford)}, Total: {len(oxford)+len(stanford)}")
oxford_classes = len([d for d in Path('oxford_pets_split/train').iterdir() if d.is_dir()])
stanford_classes = len([d for d in Path('Stanford_Dogs').iterdir() if d.is_dir()])
print(f"Oxford classes: {oxford_classes}, Stanford classes: {stanford_classes}, Total: {oxford_classes+stanford_classes}")