"""
API 测试脚本
使用 curl 测试各端点
"""
import requests
import base64
import json
import sys

BASE_URL = "http://localhost:8000"


def test_health():
    r = requests.post(f"{BASE_URL}/health")
    print(f"[health] {r.status_code} {r.json()}")
    assert r.status_code == 200


def test_liveness(image_path: str = "tests/test_dog.jpg"):
    with open(image_path, "rb") as f:
        img_bytes = f.read()
    img_b64 = base64.b64encode(img_bytes).decode()

    r = requests.post(
        f"{BASE_URL}/detect/liveness",
        json={"image": img_b64}
    )
    print(f"[liveness] {r.status_code} {r.json()}")
    assert r.status_code == 200


def test_extract(image_path: str = "tests/test_dog.jpg"):
    with open(image_path, "rb") as f:
        img_bytes = f.read()
    img_b64 = base64.b64encode(img_bytes).decode()

    r = requests.post(
        f"{BASE_URL}/extract/feature",
        json={"image": img_b64}
    )
    print(f"[extract] {r.status_code} vector.shape={r.json()['shape']}")
    assert r.status_code == 200
    return r.json()["vector"]


def test_compare():
    vec_a = [0.1] * 512
    vec_b = [0.1] * 512
    r = requests.post(
        f"{BASE_URL}/compare",
        json={"vector_a": vec_a, "vector_b": vec_b}
    )
    print(f"[compare] {r.status_code} {r.json()}")
    assert r.status_code == 200


if __name__ == "__main__":
    print("=== AI Service API Tests ===")
    test_health()
    test_compare()
    try:
        test_liveness()
        test_extract()
    except FileNotFoundError:
        print("[skip] test image not found, skipping image tests")
