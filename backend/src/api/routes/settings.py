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
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from appwrite.query import Query
from appwrite.id import ID

from src.core.encryption import encrypt, decrypt
from src.api.dependencies import get_current_user
from src.appwrite_client import databases
from src.core.config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

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


def _mask_key(key: str) -> str:
    """Show only the last 6 characters."""
    if len(key) <= 6:
        return "***"
    return "***" + key[-6:]


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
            "masked_key": _mask_key(decrypt(k["encryptedKey"])),
            "is_valid": k["isValid"],
            "last_used": k["lastUsed"] if k.get("lastUsed") else None,
        }
        for k in result["documents"]
    ]


# ── POST /settings/keys ──────────────────────────────────────

@router.post("/keys")
async def upsert_key(
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
        "masked_key": _mask_key(body.key),
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
async def test_key(
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
            resp.raise_for_status()
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
        return {"valid": False, "error": str(exc)}
