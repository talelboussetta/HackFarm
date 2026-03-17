from appwrite.query import Query
from src.appwrite_client import databases
from src.core.encryption import decrypt
from src.core.config import settings

def get_user_llm_providers(user_id: str) -> list[dict]:
    """
    Return [{provider, decrypted_key}] for all keys of this user.
    Used by LLMRouter at job start time.
    We load ALL keys (not just isValid=True) because the test endpoint
    can be overly strict — the actual LLM router handles failures with fallback.
    """
    result = databases.list_documents(
        settings.APPWRITE_DATABASE_ID,
        "user-api-keys",
        [Query.equal("userId", user_id)]
    )
    providers = []
    for doc in result["documents"]:
        try:
            providers.append({
                "provider": doc["provider"],
                "decrypted_key": decrypt(doc["encryptedKey"])
            })
        except Exception:
            continue  # skip corrupted key, don't crash
    return providers
