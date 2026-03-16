"""
HackFarmer — API endpoint smoke tests.
Run: cd backend && python -m pytest tests/test_backend_routes.py -v

Tests all REST API endpoints with mocked auth.
"""

import os
import sys
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

FAKE_USER = {"id": "test-user-123", "name": "Test User", "email": "test@example.com"}


@pytest.fixture
def client():
    """Create a test client with mocked Appwrite auth."""
    from src.api.main import app
    from src.api.dependencies import get_current_user
    from fastapi.testclient import TestClient

    async def mock_get_current_user():
        return FAKE_USER

    app.dependency_overrides[get_current_user] = mock_get_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def unauth_client():
    """Create a test client WITHOUT auth override."""
    from src.api.main import app
    from fastapi.testclient import TestClient

    app.dependency_overrides.clear()
    with TestClient(app) as c:
        yield c


# ── Health check ──────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"


# ── GET /api/jobs ─────────────────────────────────────────────

def test_list_jobs_empty(client):
    """New user should see empty job list."""
    with patch("src.api.routes.jobs.databases") as mock_db:
        mock_db.list_documents.return_value = {"total": 0, "documents": []}
        r = client.get("/api/jobs")
        assert r.status_code == 200
        assert r.json() == []


# ── POST /api/jobs → 400 ─────────────────────────────────────

def test_create_job_no_keys(client):
    """Should return 400 if user has no API keys configured."""
    with patch("src.api.routes.jobs.get_user_llm_providers", return_value=[]):
        r = client.post("/api/jobs", data={
            "prompt": "Build a todo app",
            "repo_name": "test-repo",
            "repo_private": "false",
        })
        assert r.status_code == 400
        data = r.json()
        assert "API key" in data["detail"] or "api key" in data["detail"].lower()


# ── GET /api/jobs/{fake_id} → 404 ────────────────────────────

def test_get_job_not_found(client):
    """Non-existent job should return 404."""
    with patch("src.api.routes.jobs.databases") as mock_db:
        mock_db.get_document.side_effect = Exception("Not found")
        r = client.get("/api/jobs/nonexistent-job-id")
        assert r.status_code == 404


# ── GET /settings/keys → 200 ─────────────────────────────────

def test_list_keys_empty(client):
    """New user should see empty keys list."""
    with patch("src.api.routes.settings.databases") as mock_db:
        mock_db.list_documents.return_value = {"total": 0, "documents": []}
        r = client.get("/settings/keys")
        assert r.status_code == 200
        assert r.json() == []


# ── POST /settings/keys → 200 ────────────────────────────────

def test_upsert_key(client):
    """Adding a valid key should succeed."""
    with patch("src.api.routes.settings.databases") as mock_db, \
         patch("src.api.routes.settings.encrypt", return_value="encrypted-key"):
        mock_db.list_documents.return_value = {"total": 0, "documents": []}
        mock_db.create_document.return_value = {
            "$id": "key-1",
            "provider": "gemini",
            "encryptedKey": "encrypted-key",
            "isValid": True,
            "lastUsed": None,
        }
        r = client.post("/settings/keys", json={
            "provider": "gemini",
            "key": "test-api-key-12345"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["provider"] == "gemini"
        assert data["is_valid"] is True


# ── DELETE /settings/keys/gemini → 404 ───────────────────────

def test_delete_key_not_found(client):
    """Deleting a non-existent key should return 404."""
    with patch("src.api.routes.settings.databases") as mock_db:
        mock_db.list_documents.return_value = {"total": 0, "documents": []}
        r = client.delete("/settings/keys/gemini")
        assert r.status_code == 404


# ── POST /settings/keys/gemini/test → 404 ────────────────────

def test_test_key_not_found(client):
    """Testing a non-existent key should return 404."""
    with patch("src.api.routes.settings.databases") as mock_db:
        mock_db.list_documents.return_value = {"total": 0, "documents": []}
        r = client.post("/settings/keys/gemini/test")
        assert r.status_code == 404


# ── Auth required ─────────────────────────────────────────────

def test_jobs_requires_auth(unauth_client):
    """Endpoints should return 401 without auth."""
    r = unauth_client.get("/api/jobs")
    assert r.status_code == 401

