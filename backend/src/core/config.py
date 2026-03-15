"""
HackFarmer — Application configuration via pydantic-settings.
All settings are loaded from environment variables or .env file.
"""

import secrets
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ───────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./hackfarmer.db"

    # ── GitHub OAuth ───────────────────────────────────────────
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:8000/auth/callback"

    # ── JWT ────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

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

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
