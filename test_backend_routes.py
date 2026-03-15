import requests
import time

BASE_URL = "http://localhost:8000"

def test_health():
    try:
        r = requests.get(f"{BASE_URL}/health")
        print(f"Health check: {r.status_code} - {r.json()}")
    except Exception as e:
        print(f"Health check failed: {e}")

if __name__ == "__main__":
    test_health()
    # To test actual job creation, we'd need an Appwrite session cookie/token.
    # Since we don't have one easily here, we'll verify the routes exist.
    print("Backend routes verify:")
    endpoints = [
        ("GET", "/api/jobs"),
        ("POST", "/api/jobs"),
        ("GET", "/settings/keys"),
    ]
    for method, path in endpoints:
        r = requests.request(method, f"{BASE_URL}{path}")
        print(f"{method} {path}: {r.status_code} (Expected 401 if auth working)")
