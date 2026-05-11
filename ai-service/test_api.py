"""Quick test script to verify FastAPI service."""
import sys, os, subprocess, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Start uvicorn server as subprocess
    server_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", "8001"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    print(f"Server started with PID {server_proc.pid}")
    print("Waiting 5s for startup...")
    time.sleep(5)

    if server_proc.poll() is not None:
        stdout, _ = server_proc.communicate()
        print(f"Server exited early with code {server_proc.returncode}")
        print("Output:", stdout[:2000])
        sys.exit(1)

    try:
        base = "http://127.0.0.1:8001"

        print("\n=== Testing /health ===")
        r = urllib.request.urlopen(f"{base}/health", timeout=5)
        print(f"Status: {r.status}, Body: {r.read().decode()}")

        print("\n=== Testing / ===")
        r = urllib.request.urlopen(f"{base}/", timeout=5)
        print(f"Status: {r.status}, Body: {r.read().decode()}")

        print("\n=== Testing /detect/liveness (bad image) ===")
        req = urllib.request.Request(
            f"{base}/detect/liveness",
            data=b'{"image": "invalid"}',
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        r = urllib.request.urlopen(req, timeout=5)
        print(f"Status: {r.status}, Body: {r.read().decode()}")

        print("\n=== All tests passed! ===")
    finally:
        print("\nStopping server...")
        server_proc.terminate()
        server_proc.wait(timeout=5)
        print("Done.")
