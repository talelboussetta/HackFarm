from appwrite.services.account import Account
from fastapi import HTTPException, Request
from src.appwrite_client import build_session_client
import logging

log = logging.getLogger(__name__)

async def get_current_user(request: Request) -> dict:
    """
    Verify Appwrite session from JWT header or session cookie.
    The frontend sends a JWT via X-Appwrite-Session header (from account.createJWT()).
    Falls back to cookie-based auth for browser sessions.
    Returns: {id: str, name: str, email: str}
    Raises: HTTP 401 if session invalid or missing
    """
    session_token = None

    # 1. Check X-Appwrite-Session header (JWT from frontend SDK)
    session_token = request.headers.get("X-Appwrite-Session")

    # 2. Fall back to Appwrite session cookie
    if not session_token:
        for cookie_name, cookie_val in request.cookies.items():
            if cookie_name.startswith("a_session_"):
                session_token = cookie_val
                break

    if not session_token:
        log.warning("get_current_user: no session token in header or cookie [%s %s]",
                    request.method, request.url.path)
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        user_client = build_session_client(session_token)
        user_account = Account(user_client)
        user = user_account.get()
        return {"id": user["$id"], "name": user["name"],
                "email": user.get("email", "")}
    except Exception as exc:
        log.warning("get_current_user: Appwrite rejected token — %s [%s %s]",
                    exc, request.method, request.url.path)
        raise HTTPException(status_code=401, detail="Not authenticated")

