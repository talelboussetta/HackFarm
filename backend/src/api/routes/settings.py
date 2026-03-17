"""
HackFarmer — API key management routes.

Endpoints:
  GET    /settings/keys              → list configured providers (masked)
  POST   /settings/keys              → add/update a provider key
  DELETE /settings/keys/{provider}   → remove a provider key
  POST   /settings/keys/{provider}/test → test a stored key with a live LLM call
"""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator
from appwrite.query import Query
from appwrite.id import ID

from slowapi import Limiter
from slowapi.util import get_remote_address

from src.core.encryption import encrypt, decrypt
from src.api.dependencies import get_current_user
from src.appwrite_client import databases
from src.core.config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

limiter = Limiter(key_func=get_remote_address)

ALLOWED_PROVIDERS = {"gemini", "groq", "openrouter"}

# Provider → (base_url, model, header_builder)
PROVIDER_CONFIG = {
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "model": "gemini-2.0-flash",
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "model": "llama-3.3-70b-versatile",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "model": "meta-llama/llama-3.3-70b-instruct:free",
    },
}


class KeyCreateRequest(BaseModel):
    provider: str
    key: str

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        if v not in ALLOWED_PROVIDERS:
            raise ValueError(f"Provider must be one of: {', '.join(ALLOWED_PROVIDERS)}")
        return v


def _mask_key(raw_encrypted: str) -> str:
    """Decrypt and mask — only last 6 chars survive."""
    try:
        full = decrypt(raw_encrypted)
        if len(full) <= 6:
            return "***"
        return "***" + full[-6:]
    except Exception:
        return "***[corrupted]"


# ── GET /settings/keys ────────────────────────────────────────

@router.get("/keys")
async def list_keys(
    user: dict = Depends(get_current_user),
):
    """Return configured providers with masked keys."""
    db_id = settings.APPWRITE_DATABASE_ID
    result = databases.list_documents(
        db_id, "user-api-keys",
        [Query.equal("userId", user["id"])]
    )
    return [
        {
            "provider": k["provider"],
            "masked_key": _mask_key(k["encryptedKey"]),
            "is_valid": k["isValid"],
            "last_used": k["lastUsed"] if k.get("lastUsed") else None,
        }
        for k in result["documents"]
    ]


# ── POST /settings/keys ──────────────────────────────────────

@router.post("/keys")
@limiter.limit("30/hour")
async def upsert_key(
    request: Request,
    body: KeyCreateRequest,
    user: dict = Depends(get_current_user),
):
    """Encrypt and upsert an API key (one per provider per user)."""
    db_id = settings.APPWRITE_DATABASE_ID
    
    # Check for existing
    result = databases.list_documents(
        db_id, "user-api-keys",
        [Query.equal("userId", user["id"]), Query.equal("provider", body.provider)]
    )

    encrypted = encrypt(body.key)

    if result["total"] > 0:
        doc = result["documents"][0]
        updated = databases.update_document(
            db_id, "user-api-keys", doc["$id"],
            {
                "encryptedKey": encrypted,
                "isValid": True,
            }
        )
    else:
        updated = databases.create_document(
            db_id, "user-api-keys", ID.unique(),
            {
                "userId": user["id"],
                "provider": body.provider,
                "encryptedKey": encrypted,
                "isValid": True,
            }
        )

    return {
        "provider": updated["provider"],
        "masked_key": _mask_key(encrypted),
        "is_valid": updated["isValid"],
    }


# ── DELETE /settings/keys/{provider} ──────────────────────────

@router.delete("/keys/{provider}")
async def delete_key(
    provider: str,
    user: dict = Depends(get_current_user),
):
    """Delete a provider key for the current user."""
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    db_id = settings.APPWRITE_DATABASE_ID
    result = databases.list_documents(
        db_id, "user-api-keys",
        [Query.equal("userId", user["id"]), Query.equal("provider", provider)]
    )
    
    if result["total"] == 0:
        raise HTTPException(status_code=404, detail="Key not found")

    databases.delete_document(db_id, "user-api-keys", result["documents"][0]["$id"])
    return {"deleted": True}


# ── POST /settings/keys/{provider}/test ───────────────────────

@router.post("/keys/{provider}/test")
@limiter.limit("20/hour")
async def test_key(
    request: Request,
    provider: str,
    user: dict = Depends(get_current_user),
):
    """
    Make a minimal LLM call to verify the stored key works.
    Uses httpx directly — not the LLM router.
    """
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    db_id = settings.APPWRITE_DATABASE_ID
    result = databases.list_documents(
        db_id, "user-api-keys",
        [Query.equal("userId", user["id"]), Query.equal("provider", provider)]
    )
    
    if result["total"] == 0:
        raise HTTPException(status_code=404, detail="Key not found")

    doc = result["documents"][0]
    decrypted_key = decrypt(doc["encryptedKey"])
    cfg = PROVIDER_CONFIG[provider]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{cfg['base_url'].rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {decrypted_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": cfg["model"],
                    "messages": [{"role": "user", "content": "Reply with the single word: ok"}],
                    "max_tokens": 10,
                },
            )
            if resp.status_code >= 400:
                # Parse error message from provider
                try:
                    err_data = resp.json()
                    if isinstance(err_data, list):
                        err_data = err_data[0]
                    err_msg = err_data.get("error", {}).get("message", resp.text[:200])
                except Exception:
                    err_msg = resp.text[:200]
                # Don't mark as invalid for rate limits (429) — key is still valid
                if resp.status_code != 429:
                    databases.update_document(
                        db_id, "user-api-keys", doc["$id"],
                        {"isValid": False}
                    )
                return {"valid": False, "error": f"[{resp.status_code}] {err_msg}"}

            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip().lower()

            if "ok" in content:
                databases.update_document(
                    db_id, "user-api-keys", doc["$id"],
                    {
                        "isValid": True,
                        "lastUsed": datetime.now(timezone.utc).isoformat()
                    }
                )
                return {"valid": True}
            else:
                databases.update_document(
                    db_id, "user-api-keys", doc["$id"],
                    {"isValid": False}
                )
                return {"valid": False, "error": f"Unexpected response: {content}"}

    except Exception as exc:
        databases.update_document(
            db_id, "user-api-keys", doc["$id"],
            {"isValid": False}
        )
        error_msg = str(exc)
        # Sanitize: never leak key values in error messages
        if decrypted_key and decrypted_key in error_msg:
            error_msg = error_msg.replace(decrypted_key, "***")
        return {"valid": False, "error": error_msg[:200]}
