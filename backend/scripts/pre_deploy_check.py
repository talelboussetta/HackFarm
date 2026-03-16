"""
HackFarmer — Pre-Deployment Checklist.
Run before any deployment to verify configuration.

Usage:
    cd backend && python scripts/pre_deploy_check.py

Exit code 0 = all pass, 1 = at least one failure.
"""

import base64
import importlib
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

results = []


def check(name: str, fn) -> bool:
    try:
        ok, detail = fn()
        status = "PASS" if ok else "FAIL"
        results.append((name, status, detail))
        return ok
    except Exception as e:
        results.append((name, "FAIL", str(e)))
        return False


# ── 1. FERNET_KEY valid ───────────────────────────────────────

def check_fernet_key():
    key = os.getenv("FERNET_KEY", "")
    if not key:
        return False, "FERNET_KEY not set"
    try:
        decoded = base64.urlsafe_b64decode(key + "==")
        if len(decoded) == 32:
            return True, "Valid 32-byte Fernet key"
        return False, f"Key decoded to {len(decoded)} bytes (expected 32)"
    except Exception as e:
        return False, f"Invalid base64: {e}"


# ── 2. APPWRITE_ENDPOINT reachable ───────────────────────────

def check_appwrite_endpoint():
    endpoint = os.getenv("APPWRITE_ENDPOINT", "")
    if not endpoint:
        return False, "APPWRITE_ENDPOINT not set"
    try:
        import httpx
        r = httpx.get(f"{endpoint}/health", timeout=10)
        if r.status_code == 200:
            return True, f"{endpoint} reachable"
        return False, f"HTTP {r.status_code}"
    except Exception as e:
        return False, f"Connection failed: {e}"


# ── 3. APPWRITE_PROJECT_ID and APPWRITE_API_KEY set ──────────

def check_appwrite_credentials():
    pid = os.getenv("APPWRITE_PROJECT_ID", "")
    key = os.getenv("APPWRITE_API_KEY", "")
    if not pid:
        return False, "APPWRITE_PROJECT_ID not set"
    if not key:
        return False, "APPWRITE_API_KEY not set"
    return True, f"Project: {pid[:8]}..."


# ── 4. All 4 required collections exist ──────────────────────

def check_collections():
    from appwrite.client import Client
    from appwrite.services.databases import Databases

    client = Client()
    client.set_endpoint(os.getenv("APPWRITE_ENDPOINT", ""))
    client.set_project(os.getenv("APPWRITE_PROJECT_ID", ""))
    client.set_key(os.getenv("APPWRITE_API_KEY", ""))

    db = Databases(client)
    db_id = os.getenv("APPWRITE_DATABASE_ID", "hackfarmer-db")

    result = db.list_collections(db_id)
    found = {c["$id"] for c in result["collections"]}
    expected = {"jobs", "agent-runs", "user-api-keys", "job-events"}
    missing = expected - found
    if missing:
        return False, f"Missing: {missing}"
    return True, f"All 4 collections found"


# ── 5. Storage bucket exists ─────────────────────────────────

def check_bucket():
    from appwrite.client import Client
    from appwrite.services.storage import Storage

    client = Client()
    client.set_endpoint(os.getenv("APPWRITE_ENDPOINT", ""))
    client.set_project(os.getenv("APPWRITE_PROJECT_ID", ""))
    client.set_key(os.getenv("APPWRITE_API_KEY", ""))

    stor = Storage(client)
    bucket_id = os.getenv("APPWRITE_ZIP_BUCKET_ID", "generated-zips")

    try:
        stor.get_bucket(bucket_id)
        return True, f"Bucket '{bucket_id}' exists"
    except Exception:
        return False, f"Bucket '{bucket_id}' not found"


# ── 6. FRONTEND_URL set and not localhost ────────────────────

def check_frontend_url():
    url = os.getenv("FRONTEND_URL", "")
    if not url:
        return False, "FRONTEND_URL not set"
    if "localhost" in url or "127.0.0.1" in url:
        return False, f"FRONTEND_URL is localhost: {url}"
    return True, url


# ── 7. (Skipped) LLM keys stored per-user in Appwrite ───────

def check_llm_keys():
    return True, "Skipped — LLM keys stored per-user in Appwrite"


# ── 8. Python version 3.11.x ────────────────────────────────

def check_python_version():
    v = sys.version_info
    if v.major == 3 and v.minor == 11:
        return True, f"Python {v.major}.{v.minor}.{v.micro}"
    return False, f"Python {v.major}.{v.minor}.{v.micro} (expected 3.11.x)"


# ── 9. All required packages importable ──────────────────────

def check_packages():
    required = [
        "fastapi", "uvicorn", "sse_starlette", "pyjwt", "cryptography",
        "httpx", "langgraph", "openai", "chromadb", "sentence_transformers",
        "pymupdf", "docx", "pydantic_settings", "dotenv", "bleach",
        "appwrite", "multipart",
    ]
    missing = []
    for pkg in required:
        try:
            importlib.import_module(pkg)
        except ImportError:
            # Try alternate names
            alt = {"pymupdf": "fitz", "pyjwt": "jwt", "dotenv": "dotenv"}
            alt_name = alt.get(pkg)
            if alt_name:
                try:
                    importlib.import_module(alt_name)
                    continue
                except ImportError:
                    pass
            missing.append(pkg)
    if missing:
        return False, f"Missing: {missing}"
    return True, f"All {len(required)} packages importable"


# ── 10. Pipeline compiles without errors ─────────────────────

def check_pipeline():
    try:
        from src.agents.graph import pipeline
        assert pipeline is not None
        return True, "LangGraph pipeline compiled"
    except Exception as e:
        return False, f"Pipeline error: {e}"


# ── Main ──────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n🌾 HackFarmer — Pre-Deployment Checklist\n")

    check("1. FERNET_KEY valid", check_fernet_key)
    check("2. Appwrite endpoint reachable", check_appwrite_endpoint)
    check("3. Appwrite credentials set", check_appwrite_credentials)
    check("4. Required collections exist", check_collections)
    check("5. Storage bucket exists", check_bucket)
    check("6. FRONTEND_URL set (not localhost)", check_frontend_url)
    check("7. LLM provider keys", check_llm_keys)
    check("8. Python version 3.11.x", check_python_version)
    check("9. Required packages importable", check_packages)
    check("10. Pipeline compiles", check_pipeline)

    # Print summary table
    print(f"{'─' * 60}")
    print(f"{'Check':<45} {'Status':>6}")
    print(f"{'─' * 60}")
    for name, status, detail in results:
        icon = "✅" if status == "PASS" else "❌"
        print(f"  {icon} {name:<41} {status}")
        if status == "FAIL":
            print(f"      → {detail}")
    print(f"{'─' * 60}")

    passed = sum(1 for _, s, _ in results if s == "PASS")
    failed = sum(1 for _, s, _ in results if s == "FAIL")
    print(f"\n  Results: {passed} passed, {failed} failed\n")

    sys.exit(1 if failed > 0 else 0)
