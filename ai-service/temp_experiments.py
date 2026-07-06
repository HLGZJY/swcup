"""快速实验脚本 - 多组参数对比测试"""
import subprocess
import sys
from pathlib import Path

# 实验配置 - 每次跑一组，循序渐进
EXPERIMENTS = [
    # 实验1: 小batch + 低lr，30轮
    {
        "name": "exp1_batch32_lr0.0005_epoch30",
        "args": [
            "--data-oxford", "oxford_pets_split/train",
            "--data-stanford", "Stanford_Dogs",
            "--epochs", "30",
            "--batch", "32",
            "--lr", "0.0005",
            "--embed-dim", "512",
            "--num-classes", "157",
            "--output", "weights/exp1_breed_classifier.pth",
            "--device", "cuda",
            "--no-freeze-backbone",
        ]
    },
    # 实验2: 更小的batch，更稳定的学习
    {
        "name": "exp2_batch16_lr0.0005_epoch35",
        "args": [
            "--data-oxford", "oxford_pets_split/train",
            "--data-stanford", "Stanford_Dogs",
            "--epochs", "35",
            "--batch", "16",
            "--lr", "0.0005",
            "--embed-dim", "512",
            "--num-classes", "157",
            "--output", "weights/exp2_breed_classifier.pth",
            "--device", "cuda",
            "--no-freeze-backbone",
        ]
    },
    # 实验3: 稍微提高lr
    {
        "name": "exp3_batch32_lr0.001_epoch35",
        "args": [
            "--data-oxford", "oxford_pets_split/train",
            "--data-stanford", "Stanford_Dogs",
            "--epochs", "35",
            "--batch", "32",
            "--lr", "0.001",
            "--embed-dim", "512",
            "--num-classes", "157",
            "--output", "weights/exp3_breed_classifier.pth",
            "--device", "cuda",
            "--no-freeze-backbone",
        ]
    },
    # 实验4: 中等batch + 低lr，看能不能稳定在更高准确率
    {
        "name": "exp4_batch32_lr0.0008_epoch40",
        "args": [
            "--data-oxford", "oxford_pets_split/train",
            "--data-stanford", "Stanford_Dogs",
            "--epochs", "40",
            "--batch", "32",
            "--lr", "0.0008",
            "--embed-dim", "512",
            "--num-classes", "157",
            "--output", "weights/exp4_breed_classifier.pth",
            "--device", "cuda",
            "--no-freeze-backbone",
        ]
    },
]

def run_experiment(exp_config):
    name = exp_config["name"]
    args = exp_config["args"]

    print(f"\n{'='*60}")
    print(f"开始实验: {name}")
    print(f"参数: {args}")
    print(f"{'='*60}\n")

    cmd = [sys.executable, "-m", "src.scripts.train_breed"] + args
    result = subprocess.run(cmd, cwd=Path(__file__).parent)

    if result.returncode != 0:
        print(f"实验 {name} 失败!")
        return False

    # 评测
    print(f"\n评测模型: weights/{name.replace('exp', '')}_breed_classifier.pth...")
    eval_cmd = [
        sys.executable, "-m", "src.scripts.evaluate_breed",
        "--model", f"weights/{name.replace('exp', '')}_breed_classifier.pth".replace("exp", "").replace("_breed_classifier", "_breed_classifier"),
        "--data", "oxford_pets_split/test",
        "--device", "cuda"
    ]
    # 修正评测模型路径
    model_path = f"weights/{name}_breed_classifier.pth"
    eval_cmd = [
        sys.executable, "-m", "src.scripts.evaluate_breed",
        "--model", "weights/" + name + ".pth",
        "--data", "oxford_pets_split/test",
        "--device", "cuda"
    ]

    result = subprocess.run(eval_cmd, cwd=Path(__file__).parent)
    return result.returncode == 0

if __name__ == "__main__":
    # 只运行第一个实验
    exp = EXPERIMENTS[0]
    run_experiment(exp)