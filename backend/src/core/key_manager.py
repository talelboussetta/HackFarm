"""
HackFarmer — Key manager.
Retrieves and decrypts LLM API keys for a given user.
"""

from sqlalchemy.orm import Session

from src.core.encryption import decrypt
from src.store.db import SessionLocal, UserApiKey


def get_user_llm_providers(user_id: str) -> list[dict]:
    """
    Return [{provider, decrypted_key}] for all *valid* keys of this user.
    Used by LLMRouter at job start time.
    """
    db: Session = SessionLocal()
    try:
        keys = (
            db.query(UserApiKey)
            .filter(UserApiKey.user_id == user_id, UserApiKey.is_valid.is_(True))
            .all()
        )
        return [
            {"provider": k.provider, "decrypted_key": decrypt(k.encrypted_key)}
            for k in keys
        ]
    finally:
        db.close()
