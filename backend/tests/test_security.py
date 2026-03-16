"""
HackFarmer — Security tests.
Verifies that API keys, secrets, and internal details never leak
in API responses, logs, or error messages.
"""

import json
import os
import re
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

# Set test env before importing app
os.environ.setdefault("APPWRITE_PROJECT_ID", "test-project")
os.environ.setdefault("APPWRITE_API_KEY", "test-api-key")
os.environ.setdefault("FERNET_KEY", "")  # will generate below

# Generate a valid Fernet key for tests
from cryptography.fernet import Fernet

TEST_FERNET_KEY = Fernet.generate_key().decode()
os.environ["FERNET_KEY"] = TEST_FERNET_KEY

from src.core.encryption import encrypt

# ── Sensitive values used in tests ──
FAKE_API_KEY = "sk-super-secret-key-12345-abcdef"
FAKE_ENCRYPTED = encrypt(FAKE_API_KEY)
FAKE_USER = {"id": "user123", "name": "Test User", "email": "test@test.com"}

FORBIDDEN_FIELDS = {"key", "encryptedKey", "decryptedKey", "api_key", "token", "secret", "password"}


def _mock_get_current_user():
    """Override auth dependency to return a fake user."""
    async def _fake(request=None):
        return FAKE_USER
    return _fake


@pytest.fixture
def client():
    """Create test client with mocked auth and Appwrite."""
    from src.api.dependencies import get_current_user
    from src.api.main import app

    app.dependency_overrides[get_current_user] = _mock_get_current_user()
    yield TestClient(app)
    app.dependency_overrides.clear()


# ─── AUDIT 1: API KEY EXPOSURE ─────────────────────────────────


class TestKeysNeverLeakInResponse:
    """GET /api/settings/keys must only return masked keys."""

    def test_list_keys_returns_masked(self, client):
        mock_docs = {
            "total": 1,
            "documents": [
                {
                    "$id": "doc1",
                    "provider": "groq",
                    "encryptedKey": FAKE_ENCRYPTED,
                    "isValid": True,
                    "lastUsed": None,
                }
            ],
        }
        with patch("src.api.routes.settings.databases") as mock_db:
            mock_db.list_documents.return_value = mock_docs
            resp = client.get("/api/settings/keys")

        assert resp.status_code == 200
        body = resp.json()
        body_str = json.dumps(body)

        # Full key must never appear
        assert FAKE_API_KEY not in body_str
        # Encrypted key must never appear
        assert FAKE_ENCRYPTED not in body_str
        # Forbidden field names must not be present as JSON keys
        for item in body:
            for field in FORBIDDEN_FIELDS:
                assert field not in item, f"Forbidden field '{field}' found in response"
        # Masked key should be present and short
        assert body[0]["masked_key"].startswith("***")
        assert len(body[0]["masked_key"]) <= 10

    def test_list_keys_no_extra_fields(self, client):
        mock_docs = {
            "total": 1,
            "documents": [
                {
                    "$id": "doc1",
                    "provider": "gemini",
                    "encryptedKey": FAKE_ENCRYPTED,
                    "isValid": True,
                    "lastUsed": None,
                }
            ],
        }
        with patch("src.api.routes.settings.databases") as mock_db:
            mock_db.list_documents.return_value = mock_docs
            resp = client.get("/api/settings/keys")

        body = resp.json()
        allowed_fields = {"provider", "masked_key", "is_valid", "last_used"}
        for item in body:
            assert set(item.keys()) == allowed_fields


class TestSubmittedKeyNotEchoed:
    """POST /api/settings/keys must not echo back the submitted key."""

    def test_upsert_key_masks_response(self, client):
        with patch("src.api.routes.settings.databases") as mock_db:
            mock_db.list_documents.return_value = {"total": 0, "documents": []}
            mock_db.create_document.return_value = {
                "$id": "new_doc",
                "provider": "groq",
                "encryptedKey": FAKE_ENCRYPTED,
                "isValid": True,
            }
            resp = client.post(
                "/api/settings/keys",
                json={"provider": "groq", "key": FAKE_API_KEY},
            )

        assert resp.status_code == 200
        body_str = resp.text

        # Full key must not appear in response
        assert FAKE_API_KEY not in body_str
        # Only first part should NOT appear (last 6 can appear masked)
        assert "sk-super-secret" not in body_str


# ─── AUDIT 2: NETWORK TAB EXPOSURE ────────────────────────────


class TestJobsNoKeyExposure:
    """GET /api/jobs must not expose any key-related fields."""

    def test_list_jobs_clean(self, client):
        mock_jobs = {
            "total": 1,
            "documents": [
                {
                    "$id": "job1",
                    "userId": FAKE_USER["id"],
                    "status": "completed",
                    "inputType": "text",
                    "repoName": "test-repo",
                    "repoPrivate": False,
                    "githubUrl": "https://github.com/test/test-repo",
                    "zipFileId": None,
                    "$createdAt": "2024-01-01T00:00:00Z",
                    "completedAt": "2024-01-01T00:05:00Z",
                    "errorMessage": None,
                }
            ],
        }
        with patch("src.api.routes.jobs.databases") as mock_db:
            mock_db.list_documents.return_value = mock_jobs
            resp = client.get("/api/jobs")

        body_str = json.dumps(resp.json())
        for field in FORBIDDEN_FIELDS:
            assert field not in body_str, f"Forbidden field '{field}' in jobs response"


# ─── AUDIT 3: SECURITY HEADERS ────────────────────────────────


class TestSecurityHeaders:
    """All responses must include security headers."""

    def test_health_has_security_headers(self, client):
        resp = client.get("/health")
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("X-Frame-Options") == "DENY"
        assert resp.headers.get("X-XSS-Protection") == "1; mode=block"
        assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "geolocation=()" in resp.headers.get("Permissions-Policy", "")


# ─── AUDIT 4: IDOR PROTECTION ─────────────────────────────────


class TestIDORProtection:
    """Verify ownership checks on job endpoints."""

    def test_get_job_wrong_user(self, client):
        """Accessing another user's job returns 403."""
        mock_job = {
            "$id": "job1",
            "userId": "OTHER_USER_ID",
            "status": "completed",
            "inputType": "text",
            "repoName": "their-repo",
            "repoPrivate": False,
        }
        with patch("src.api.routes.jobs.databases") as mock_db:
            mock_db.get_document.return_value = mock_job
            resp = client.get("/api/jobs/job1")

        assert resp.status_code == 403

    def test_delete_job_wrong_user(self, client):
        """Deleting another user's job returns 403."""
        mock_job = {
            "$id": "job1",
            "userId": "OTHER_USER_ID",
            "status": "completed",
        }
        with patch("src.api.routes.jobs.databases") as mock_db:
            mock_db.get_document.return_value = mock_job
            resp = client.delete("/api/jobs/job1")

        assert resp.status_code == 403

    def test_download_wrong_user(self, client):
        """Downloading another user's ZIP returns 403."""
        mock_job = {
            "$id": "job1",
            "userId": "OTHER_USER_ID",
            "status": "completed",
            "zipFileId": "zip1",
        }
        with patch("src.api.routes.downloads.databases") as mock_db:
            mock_db.get_document.return_value = mock_job
            resp = client.get("/api/downloads/job1")

        assert resp.status_code == 403


# ─── AUDIT 5: INPUT VALIDATION ─────────────────────────────────


class TestInputValidation:
    """Verify input validation on job creation."""

    def test_repo_name_too_long(self, client):
        long_name = "a" * 101
        with patch("src.api.routes.jobs.get_user_llm_providers", return_value=[{"provider": "groq", "decrypted_key": "x"}]):
            resp = client.post(
                "/api/jobs",
                data={"prompt": "test", "repo_name": long_name},
            )
        assert resp.status_code == 400
        assert "too long" in resp.json()["detail"].lower()

    def test_repo_name_injection(self, client):
        with patch("src.api.routes.jobs.get_user_llm_providers", return_value=[{"provider": "groq", "decrypted_key": "x"}]):
            resp = client.post(
                "/api/jobs",
                data={"prompt": "test", "repo_name": "../../etc/passwd"},
            )
        assert resp.status_code == 400


# ─── AUDIT 6: NO HARDCODED SECRETS ────────────────────────────


class TestNoHardcodedSecrets:
    """Scan source code for hardcoded secrets."""

    def test_no_hardcoded_api_keys(self):
        src_dir = os.path.join(os.path.dirname(__file__), "..", "src")
        secret_patterns = [
            re.compile(r'sk-[a-zA-Z0-9]{20,}'),
            re.compile(r'gsk_[a-zA-Z0-9]{20,}'),
            re.compile(r'AIza[a-zA-Z0-9_-]{35}'),
        ]
        for root, _dirs, files in os.walk(src_dir):
            for f in files:
                if not f.endswith(".py"):
                    continue
                path = os.path.join(root, f)
                content = open(path, "r", encoding="utf-8", errors="ignore").read()
                for pat in secret_patterns:
                    match = pat.search(content)
                    assert match is None, f"Potential secret in {path}: {match.group()[:20]}..."

    def test_no_print_statements_in_routes(self):
        routes_dir = os.path.join(os.path.dirname(__file__), "..", "src", "api", "routes")
        for f in os.listdir(routes_dir):
            if not f.endswith(".py"):
                continue
            path = os.path.join(routes_dir, f)
            content = open(path, "r", encoding="utf-8").read()
            # Allow print in non-route files but flag in routes
            lines = content.split("\n")
            for i, line in enumerate(lines, 1):
                stripped = line.strip()
                if stripped.startswith("print(") and not stripped.startswith("#"):
                    assert False, f"print() in {f}:{i} — use logger instead"
