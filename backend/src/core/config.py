"""
HackFarmer — Application configuration via pydantic-settings.
All settings are loaded from environment variables or .env file.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Environment ───────────────────────────────────────────
    ENVIRONMENT: str = "development"

    # ── Frontend ───────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:3000"

    # ── Encryption (Fernet) ────────────────────────────────────
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    FERNET_KEY: str = ""

    # ── n8n ────────────────────────────────────────────────────
    N8N_WEBHOOK_URL: str = ""

    # ── Concurrency ────────────────────────────────────────────
    MAX_CONCURRENT_JOBS: int = 3

    # ── Appwrite (BaaS) ────────────────────────────────────────
    APPWRITE_ENDPOINT: str = "https://cloud.appwrite.io/v1"
    APPWRITE_PROJECT_ID: str = ""
    APPWRITE_API_KEY: str = ""
    APPWRITE_DATABASE_ID: str = "hackfarmer-db"
    APPWRITE_ZIP_BUCKET_ID: str = "generated-zips"

    # ── Sentry DSN (optional) ──────────────────────────────────
    SENTRY_DSN: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
