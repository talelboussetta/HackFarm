from appwrite.query import Query
from src.appwrite_client import databases
from src.core.encryption import decrypt
from src.core.config import settings

def get_user_llm_providers(user_id: str) -> list[dict]:
    """
    Return [{provider, decrypted_key}] for all *valid* keys of this user.
    Used by LLMRouter at job start time.
    """
    result = databases.list_documents(
        settings.APPWRITE_DATABASE_ID,
        "user-api-keys",
        [Query.equal("userId", user_id), Query.equal("isValid", True)]
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
