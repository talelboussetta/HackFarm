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
from sqlalchemy.orm import Session

from backend.src.core.encryption import encrypt, decrypt
from backend.src.store.db import get_db, User, UserApiKey
from backend.src.api.dependencies import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return configured providers with masked keys."""
    keys = db.query(UserApiKey).filter(UserApiKey.user_id == user.id).all()
    return [
        {
            "provider": k.provider,
            "masked_key": _mask_key(decrypt(k.encrypted_key)),
            "is_valid": k.is_valid,
            "last_used": k.last_used.isoformat() if k.last_used else None,
        }
        for k in keys
    ]


# ── POST /settings/keys ──────────────────────────────────────

@router.post("/keys")
async def upsert_key(
    body: KeyCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Encrypt and upsert an API key (one per provider per user)."""
    existing = (
        db.query(UserApiKey)
        .filter(UserApiKey.user_id == user.id, UserApiKey.provider == body.provider)
        .first()
    )

    encrypted = encrypt(body.key)

    if existing:
        existing.encrypted_key = encrypted
        existing.is_valid = True
    else:
        existing = UserApiKey(
            user_id=user.id,
            provider=body.provider,
            encrypted_key=encrypted,
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)

    return {
        "provider": existing.provider,
        "masked_key": _mask_key(body.key),
        "is_valid": existing.is_valid,
    }


# ── DELETE /settings/keys/{provider} ──────────────────────────

@router.delete("/keys/{provider}")
async def delete_key(
    provider: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a provider key for the current user."""
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    key = (
        db.query(UserApiKey)
        .filter(UserApiKey.user_id == user.id, UserApiKey.provider == provider)
        .first()
    )
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    db.delete(key)
    db.commit()
    return {"deleted": True}


# ── POST /settings/keys/{provider}/test ───────────────────────

@router.post("/keys/{provider}/test")
async def test_key(
    provider: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Make a minimal LLM call to verify the stored key works.
    Uses httpx directly — not the LLM router.
    """
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    key_row = (
        db.query(UserApiKey)
        .filter(UserApiKey.user_id == user.id, UserApiKey.provider == provider)
        .first()
    )
    if not key_row:
        raise HTTPException(status_code=404, detail="Key not found")

    decrypted_key = decrypt(key_row.encrypted_key)
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
                key_row.is_valid = True
                key_row.last_used = datetime.now(timezone.utc)
                db.commit()
                return {"valid": True}
            else:
                key_row.is_valid = False
                db.commit()
                return {"valid": False, "error": f"Unexpected response: {content}"}

    except Exception as exc:
        key_row.is_valid = False
        db.commit()
        return {"valid": False, "error": str(exc)}
