from fastapi import APIRouter, Request
from src.api.dependencies import get_current_user
import logging

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/me")
async def auth_me(request: Request):
    """Debug endpoint — returns the authenticated user or a detailed error."""
    try:
        user = await get_current_user(request)
        return {"ok": True, "user": user}
    except Exception as e:
        token = request.headers.get("X-Appwrite-Session", "")
        return {
            "ok": False,
            "error": str(e),
            "token_type": "JWT" if token.startswith("eyJ") else "session" if token else "none",
            "token_preview": token[:25] + "..." if len(token) > 25 else token or "(none)",
        }
