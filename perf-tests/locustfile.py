"""鼻纹智救 P0 性能压测 locustfile。

覆盖 TEST-PLAN.md §4 三用例：
- TC-PERF-001：后端 GET /v1/animals 100 并发
- TC-PERF-002：AI POST /extract/feature 50 并发（直连 AI 服务，避免 backend 转发噪声）
- TC-PERF-003：端到端 50 用户采集流（detect+extract+collect）

运行：
  # TC-PERF-001（默认 headless 模式）
  locust -f locustfile.py BackendListUser --headless -u 100 -r 100 -t 30s \
         --host http://localhost:3000 --csv perf001 -L WARNING

  # TC-PERF-002
  locust -f locustfile.py AIExtractUser --headless -u 50 -r 50 -t 30s \
         --host http://localhost:8000 --csv perf002 -L WARNING

  # TC-PERF-003
  locust -f locustfile.py E2ECollectUser --headless -u 50 -r 10 -t 60s \
         --host http://localhost:3000 --csv perf003 -L WARNING

说明（2026-06-19 修复）：
- 原 locustfile 用 /v1/nose/extract、/v1/nose/detect、image_base64 等旧契约，与实际不符。
  真实接口契约：
    AI 服务（http://localhost:8000）：
      POST /extract/feature   body={"image": "<base64>"}
      POST /detect/liveness   body={"image": "<base64>"}
    Backend（http://localhost:3000）：
      POST /v1/nose/collect   body=CollectNoseDto（nose_photo: "<base64>"）
      GET  /v1/animals        query=page,limit
- 因此 TC-PERF-002 直连 AI（更纯的推理压测），TC-PERF-003 E2E 跨 AI 与 backend。
- 启动时通过 <UserClass> 参数选择本次压测的 User 类，避免不同 User 互相干扰。
"""

import json
from pathlib import Path

from locust import HttpUser, task, between, events, tag


FIXTURE_PATH = Path(__file__).parent / "fixture.json"


def _load_fixture():
    """单次加载 fixture（base64 鼻纹图）。"""
    if not FIXTURE_PATH.exists():
        raise RuntimeError(
            f"fixture.json 不存在：{FIXTURE_PATH}（先运行 make_fixture.py）"
        )
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


_FIXTURE = _load_fixture()
_NOSE_B64 = _FIXTURE["image_base64"]


# ============================================================================
# TC-PERF-001：后端单端点 P95（GET /v1/animals）
# ============================================================================
class BackendListUser(HttpUser):
    """TC-PERF-001: 100 并发 GET /v1/animals。"""

    wait_time = between(0, 0.1)  # 减少客户端空转
    weight = 1

    @tag("perf001")
    @task
    def list_animals(self):
        with self.client.get(
            "/v1/animals?page=1&limit=20",
            name="GET /v1/animals (list)",
            catch_response=True,
        ) as r:
            if r.status_code == 200:
                try:
                    body = r.json()
                    if body.get("code") == 0:
                        r.success()
                    else:
                        r.failure(f"业务码异常: {body.get('code')}")
                except Exception as e:
                    r.failure(f"JSON 解析失败: {e}")
            else:
                r.failure(f"HTTP {r.status_code}")


# ============================================================================
# TC-PERF-002：AI 推理 P95（POST /extract/feature，直连 AI 服务）
# ============================================================================
class AIExtractUser(HttpUser):
    """TC-PERF-002: 50 并发 POST /extract/feature（CPU 推理）。"""

    wait_time = between(0, 0)
    weight = 1

    @tag("perf002")
    @task
    def extract_nose(self):
        payload = {"image": _NOSE_B64}
        with self.client.post(
            "/extract/feature",
            json=payload,
            name="POST /extract/feature (AI)",
            catch_response=True,
        ) as r:
            if r.status_code == 200:
                try:
                    body = r.json()
                    # AI ExtractResponse: {vector: [...512], embedding_dim: 512}
                    vec = body.get("vector") or body.get("embedding")
                    if isinstance(vec, list) and len(vec) == 512:
                        r.success()
                    elif body.get("code") == 0:
                        r.success()  # 业务成功也算过
                    else:
                        r.failure(f"业务码异常: {body}")
                except Exception as e:
                    r.failure(f"JSON 解析失败: {e}")
            else:
                r.failure(f"HTTP {r.status_code}: {r.text[:200]}")


# ============================================================================
# TC-PERF-003：端到端 50 用户采集流
#   - AI 直连：/detect/liveness（验清晰度） + /extract/feature（拿向量）
#   - Backend：/v1/nose/collect（采集入库）
# ============================================================================
AI_BASE = "http://localhost:8000"


class E2ECollectUser(HttpUser):
    """TC-PERF-003: 50 并发端到端采集。

    流程：先调 AI /detect/liveness 验清晰度，再调 AI /extract/feature 拿向量，
    最后调 backend /v1/nose/collect 算融合（公开接口）。

    注意：locust 的 HttpUser 只支持一个 host（--host），所以跨 host 的接口
    必须用 requests 库发绝对 URL（仍可被 locust 统计）。
    """

    wait_time = between(0.5, 1.5)
    weight = 1

    @tag("perf003")
    @task
    def collect_flow(self):
        # 1. 清晰度检测（直连 AI，locust 2.x 支持绝对 URL）
        with self.client.post(
            f"{AI_BASE}/detect/liveness",
            json={"image": _NOSE_B64},
            name="POST AI /detect/liveness",
            catch_response=True,
        ) as r:
            if r.status_code != 200:
                r.failure(f"liveness HTTP {r.status_code}")
                return

        # 2. 特征提取（最重的 AI 步骤，直连 AI）
        with self.client.post(
            f"{AI_BASE}/extract/feature",
            json={"image": _NOSE_B64},
            name="POST AI /extract/feature",
            catch_response=True,
        ) as r:
            if r.status_code != 200:
                r.failure(f"extract HTTP {r.status_code}")
                return

        # 3. 采集入库（backend 公开接口）
        with self.client.post(
            "/v1/nose/collect",
            json={
                "nose_photo": _NOSE_B64,
                "species": "dog",
                "location_lat": 39.90,
                "location_lng": 116.40,
                "description": f"locust-e2e-{id(self)}",
            },
            name="POST /v1/nose/collect",
            catch_response=True,
        ) as r:
            if r.status_code in (200, 201):
                r.success()
            else:
                r.failure(f"collect HTTP {r.status_code}: {r.text[:200]}")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("\n[locustfile] fixture 已加载，开始压测\n")