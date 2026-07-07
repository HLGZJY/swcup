
"""conftest for comments tests.

让 ``from comments.X import Y`` 能找到 ai-service/comments/X.py
不动现有 pytest.ini 配置。
"""
import sys
from pathlib import Path

# 把 ai-service/ 加入 sys.path,使得 ``import comments.dict_loader`` 走 ai-service/comments
_AI_SERVICE = Path(__file__).resolve().parents[2]
if str(_AI_SERVICE) not in sys.path:
    sys.path.insert(0, str(_AI_SERVICE))

# 默认 dicts dir 指到生产数据(用户通常调这里测试)
import os
os.environ.setdefault("DICTS_DIR", str(_AI_SERVICE / "data" / "dicts"))