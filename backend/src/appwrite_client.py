from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.storage import Storage
from appwrite.services.users import Users
from src.core.config import settings

def _build_client() -> Client:
    c = Client()
    c.set_endpoint(settings.APPWRITE_ENDPOINT)
    c.set_project(settings.APPWRITE_PROJECT_ID)
    c.set_key(settings.APPWRITE_API_KEY)
    return c

# Module-level singletons - used across all backend files
_client = _build_client()
databases = Databases(_client)
storage = Storage(_client)
users_service = Users(_client)

def build_session_client(session_token: str) -> Client:
    """
    Build a per-request client authenticated as the user.
    Accepts JWT tokens (from account.createJWT(), start with 'eyJ') OR
    raw session secrets (from cookieFallback localStorage).
    """
    c = Client()
    c.set_endpoint(settings.APPWRITE_ENDPOINT)
    c.set_project(settings.APPWRITE_PROJECT_ID)
    # JWT tokens are base64url-encoded JSON — always start with 'eyJ'
    if session_token.startswith("eyJ"):
        c.set_jwt(session_token)
    else:
        c.set_session(session_token)
    return c
