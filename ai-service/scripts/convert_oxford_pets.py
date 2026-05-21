"""
Oxford Pets 数据集格式转换脚本

功能：
按官方 train_list.mat / test_list.mat 划分文件，将散落的图片按品种分类到 train/ / val/ / test/ 文件夹

用法（PowerShell）：
    cd F:\swcup2026\ai-service
    .venv\Scripts\Activate.ps1
    python scripts/convert_oxford_pets.py

输入：
    scripts/oxford_pets/           ← 图片散落在同一个文件夹里（Abyssinian_1.jpg 等）
    scripts/list/train_list.mat   ← 官方训练集划分
    scripts/list/test_list.mat    ← 官方测试集划分

输出：
    oxford_pets_split/
    ├── train/
    │   ├── Abyssinian/
    │   │   ├── Abyssinian_1.jpg
    │   │   └── ...
    │   ├── Bombay/
    │   │   └── ...
    │   └── ...（共37类）
    ├── val/
    │   └── ...（从训练集中按10%抽样）
    └── test/
        └── ...
"""

import os
import shutil
import scipy.io
from pathlib import Path
from collections import defaultdict
import random

# ========== 配置区 ==========
# 你的实际目录结构
OXFORD_PETS_DIR = Path(r"F:\swcup2026\ai-service\scripts\oxford_pets")
LIST_DIR = Path(r"F:\swcup2026\ai-service\scripts\list")
OUTPUT_DIR = Path(r"F:\swcup2026\ai-service\oxford_pets_split")
VAL_SPLIT_RATIO = 0.1  # 从训练集中抽10%作为验证集
RANDOM_SEED = 42
# ============================


def load_mat_file(mat_path):
    """读取 .mat 文件，返回文件名前缀列表
    
    Oxford Pets .mat 文件结构：
    - file_list: (12000, 1) 存储所有文件名（可能是 str 或 numpy str 数组）
    - labels: (12000, 1) 存储对应的类别索引（1-37）
    """
    mat = scipy.io.loadmat(mat_path)
    
    file_list = []
    
    # 遍历所有非私有 key
    for key in mat.keys():
        if key.startswith('__'):
            continue
        val = mat[key]
        if not hasattr(val, 'shape') or len(val.shape) != 2:
            continue
        
        # (12000, 1) 形状的数组可能是文件名列表
        if val.shape[1] == 1:
            first = val[0, 0]
            # 如果第一个元素是标量字符串/bytes，说明是文件名数组
            if isinstance(first, (str, bytes)):
                file_list = [str(v[0]) for v in val]
                break
            # 如果是 object 数组，说明可能是字符串数组
            elif hasattr(val, 'dtype') and 'object' in str(val.dtype):
                try:
                    file_list = [str(v[0]) if isinstance(v[0], (str, bytes)) else str(v[0]) for v in val]
                    break
                except:
                    pass
    
    if file_list:
        print(f"  从 key '{key}' 读取到 {len(file_list)} 个文件名")
        print(f"  示例：{file_list[:3]}")
        return file_list
    
    # 备用：打印结构让用户报告
    print(f"  错误：无法解析 {mat_path.name}，打印结构：")
    for key in mat.keys():
        if not key.startswith('__'):
            val = mat[key]
            print(f"    key='{key}', shape={val.shape}, dtype={val.dtype}")
    return None


def build_breed_to_files(images_dir):
    """从实际文件名建立 breed → 文件列表的映射
    Oxford Pets 实际文件名格式: chihuahua_1.jpg, Abyssinian_100.jpg
    breed 名去重后是 chihuahua, abyssinian 等
    """
    all_files = os.listdir(images_dir)
    breed_to_files = defaultdict(list)
    for fname in all_files:
        if not fname.lower().endswith(('.jpg', '.jpeg', '.png')):
            continue
        name = os.path.splitext(fname)[0]
        # 去掉编号（最后一段数字）
        parts = name.rsplit('_', 1)
        if len(parts) == 2 and parts[1].isdigit():
            breed = parts[0].lower()
        else:
            breed = name.lower()
        breed_to_files[breed].append(fname)
    return breed_to_files


def extract_breed_from_imagenet_path(imagenet_path):
    """
    从 ImageNet 格式路径提取品种名
    格式: n02085620-Chihuahua/n02085620_5927.jpg → chihuahua
          n02108915-French_spaniel/n02108915_1234.jpg → french_spaniel
    """
    dirname = os.path.dirname(imagenet_path)
    if '-' in dirname:
        breed = dirname.split('-', 1)[1]
    else:
        breed = dirname
    return breed.lower()


def find_image_file(breed, images_dir):
    """根据品种名找到对应的图片文件（可能有多种扩展名）"""
    candidates = [f for f in os.listdir(images_dir)
                  if f.lower().startswith(breed.replace(' ', '_') + '_')
                  or f.lower().startswith(breed.replace(' ', ''))]
    return candidates


def split_train_val(file_list, val_ratio=0.1, seed=42):
    """从训练集中按比例抽样验证集"""
    random.seed(seed)
    random.shuffle(file_list)
    val_count = max(1, int(len(file_list) * val_ratio))
    return file_list[val_count:], file_list[:val_count]


def build_breed_to_files(images_dir):
    """从实际文件名建立 breed → 文件列表的映射
    Oxford Pets 文件名格式: chihuahua_1.jpg, Abyssinian_100.jpg, american_bulldog_10.jpg
    自动按文件名提取品种名
    """
    all_files = os.listdir(images_dir)
    breed_to_files = defaultdict(list)
    for fname in all_files:
        if not fname.lower().endswith(('.jpg', '.jpeg', '.png')):
            continue
        name = os.path.splitext(fname)[0]  # e.g. "chihuahua_1" or "American_Bulldog_10"
        # 去掉最后一段数字（编号）
        parts = name.rsplit('_', 1)
        if len(parts) == 2 and parts[1].isdigit():
            breed = parts[0].lower()
        else:
            breed = name.lower()
        breed_to_files[breed].append(fname)
    return breed_to_files


def normalize_breed_name(breed: str) -> str:
    """标准化品种名：统一大小写和分隔符"""
    # british_shorthair, great_pyrenees 等已经是小写下划线格式
    # Abyssinian -> abyssinian, American_Bulldog -> american_bulldog
    return breed.replace('-', '_').lower()


def convert():
    print("=" * 50)
    print("Oxford Pets 数据集格式转换")
    print("=" * 50)

    # 1. 扫描实际文件，按文件名提取品种
    print("\n[1/5] 扫描图片目录，按文件名提取品种...")
    breed_to_files = build_breed_to_files(OXFORD_PETS_DIR)
    print(f"  发现 {len(breed_to_files)} 个品种")
    breeds = sorted(breed_to_files.keys())
    print(f"  品种列表: {breeds}")
    total_imgs = sum(len(v) for v in breed_to_files.values())
    print(f"  共 {total_imgs} 张图片")
    for breed, files in list(breed_to_files.items())[:5]:
        print(f"    {breed}: {len(files)} 张，示例: {files[0]}")

    # 2. 打乱每类的图片，分训练集/验证集/测试集
    print("\n[2/5] 打乱数据并划分 train/val/test...")
    random.seed(RANDOM_SEED)
    train_files = []
    val_files = []
    test_files = []

    for breed, files in breed_to_files.items():
        random.shuffle(files)
        n = len(files)
        n_train = int(n * 0.7)
        n_val = int(n * 0.1)
        train_files.extend([(breed, f) for f in files[:n_train]])
        val_files.extend([(breed, f) for f in files[n_train:n_train + n_val]])
        test_files.extend([(breed, f) for f in files[n_train + n_val:]])

    print(f"  训练集: {len(train_files)} 张")
    print(f"  验证集: {len(val_files)} 张")
    print(f"  测试集: {len(test_files)} 张")

    # 3. 创建目录
    print("\n[3/5] 创建目录结构...")
    splits = {'train': train_files, 'val': val_files, 'test': test_files}
    for split_name, file_list in splits.items():
        for breed, fname in file_list:
            (OUTPUT_DIR / split_name / breed).mkdir(parents=True, exist_ok=True)

    # 4. 复制文件
    print("\n[4/5] 复制文件到目标目录...")
    copied = 0
    missing = 0
    for split_name, file_list in splits.items():
        for breed, fname in file_list:
            src = OXFORD_PETS_DIR / fname
            dst = OUTPUT_DIR / split_name / breed / fname
            if src.exists():
                shutil.copy2(src, dst)
                copied += 1
            else:
                missing += 1

    print(f"  成功复制: {copied} 张")
    if missing > 0:
        print(f"  缺失文件: {missing} 张")

    # 5. 完成
    print("\n[5/5] 完成！")
    print(f"\n输出目录: {OUTPUT_DIR}")
    for split in ['train', 'val', 'test']:
        split_dir = OUTPUT_DIR / split
        if split_dir.exists():
            breeds_count = len([d for d in split_dir.iterdir() if d.is_dir()])
            imgs_count = sum(len(list(d.iterdir())) for d in split_dir.iterdir() if d.is_dir())
            print(f"  {split}/ ({breeds_count} 品种, {imgs_count} 张)")

    print(f"\n训练命令（单行）：")
    print(f'python src/scripts/train_stage1.py --data "{OUTPUT_DIR / "train"}" --epochs 30 --batch 32 --lr 0.01 --embed-dim 512 --output "weights/stage1_oxford.pth"')


if __name__ == "__main__":
    convert()
