"""把测试鼻纹图转 base64，存到 fixture.json 给 locustfile 用。"""

import base64
import json
import sys
from pathlib import Path

# 用 dir_train 里最小的清晰鼻纹图（约 15KB，避免 locust 客户端带宽成为瓶颈）
NOSE_IMG = (
    Path(__file__).parent.parent
    / "ai-service/dir_train/dir_train/10/10_-Q7Iddl8ScWwzEwmvqvfaAAAACMAARAD.jpg"
)

if not NOSE_IMG.exists():
    print(f"ERROR: 找不到测试图 {NOSE_IMG}", file=sys.stderr)
    sys.exit(1)

b64 = base64.b64encode(NOSE_IMG.read_bytes()).decode("ascii")
out = {
    "filename": NOSE_IMG.name,
    "size_bytes": NOSE_IMG.stat().st_size,
    "image_base64": b64,
}
out_path = Path(__file__).parent / "fixture.json"
out_path.write_text(json.dumps(out, ensure_ascii=False))
print(f"WROTE {out_path} | {out['size_bytes']}B | base64 len={len(b64)}")