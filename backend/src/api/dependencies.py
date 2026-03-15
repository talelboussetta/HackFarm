from appwrite.services.account import Account
from fastapi import HTTPException, Request
from src.appwrite_client import build_session_client

async def get_current_user(request: Request) -> dict:
    """
    Verify Appwrite session from cookie or Authorization header.
    Appwrite sets a cookie named: a_session_{project_id}
    Also accept session token from X-Appwrite-Session header for API clients.
    Returns: {id: str, name: str, email: str}
    Raises: HTTP 401 if session invalid or missing
    """
    # Try cookie first (browser clients)
    project_id = request.app.state.appwrite_project_id  \
                 if hasattr(request.app.state, 'appwrite_project_id') \
                 else None
    session_token = None
    
    # Appwrite cookie name follows pattern: a_session_{project_id_lowercase}
    for cookie_name, cookie_val in request.cookies.items():
        if cookie_name.startswith("a_session_"):
            session_token = cookie_val
            break
    
    # Fall back to header
    if not session_token:
        session_token = request.headers.get("X-Appwrite-Session")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        user_client = build_session_client(session_token)
        account = Account(user_client)
        user = account.get()
        return {"id": user["$id"], "name": user["name"], 
                "email": user.get("email", "")}
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
