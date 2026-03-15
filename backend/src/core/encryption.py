"""
HackFarmer — Fernet encryption helpers for GitHub tokens and API keys.
"""

from cryptography.fernet import Fernet, InvalidToken

from src.core.config import settings


def _get_fernet() -> Fernet:
    """Return a Fernet instance, generating a key on first run if not set."""
    key = settings.FERNET_KEY
    if not key:
        raise RuntimeError(
            "FERNET_KEY is not set. Generate one with:\n"
            '  python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string and return the Fernet token as a string."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a Fernet token back to the original plaintext string."""
    f = _get_fernet()
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt — invalid token or wrong key") from exc
