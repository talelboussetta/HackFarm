"""
HackFarmer — GitHub OAuth 2.0 authentication routes.

Endpoints:
  GET  /auth/github   → redirect to GitHub authorization
  GET  /auth/callback → exchange code, upsert user, set JWT cookie
  GET  /auth/me       → return current user info
  POST /auth/logout   → clear session cookie
"""

import secrets
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from src.core.config import settings
from src.core.encryption import encrypt
from src.store.db import get_db, User
from src.api.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"


def _create_jwt(user: User) -> str:
    """Issue a JWT containing user id, username, and expiration."""
    payload = {
        "sub": user.id,
        "github_username": user.username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ── GET /auth/github ──────────────────────────────────────────

@router.get("/github")
async def github_login(response: Response):
    """Generate random state, store in cookie, redirect to GitHub."""
    state = secrets.token_urlsafe(32)

    redirect_url = (
        f"{GITHUB_AUTHORIZE_URL}"
        f"?client_id={settings.GITHUB_CLIENT_ID}"
        f"&scope=repo%20user:email"
        f"&state={state}"
        f"&redirect_uri={settings.GITHUB_REDIRECT_URI}"
    )

    resp = RedirectResponse(url=redirect_url, status_code=302)
    resp.set_cookie(
        key="oauth_state",
        value=state,
        max_age=600,  # 10 minutes
        httponly=True,
        samesite="lax",
    )
    return resp


# ── GET /auth/callback ────────────────────────────────────────

@router.get("/callback")
async def github_callback(
    request: Request,
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    """
    1. Verify state matches cookie (CSRF protection)
    2. Exchange code for access token
    3. Fetch GitHub user profile
    4. Upsert user in DB
    5. Encrypt GitHub token
    6. Issue JWT and set httpOnly cookie
    7. Redirect to frontend
    """
    # 1. CSRF check
    stored_state = request.cookies.get("oauth_state")
    if not stored_state or stored_state != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state — possible CSRF")

    # 2. Exchange code for token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()

    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Failed to get access token from GitHub")

    # 3. Fetch user profile
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            GITHUB_USER_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )
        gh_user = user_resp.json()

    github_id = str(gh_user["id"])
    username = gh_user.get("login", "")
    avatar_url = gh_user.get("avatar_url", "")

    # 4. Upsert user
    user = db.query(User).filter(User.github_id == github_id).first()
    if user:
        user.last_login = datetime.now(timezone.utc)
        user.username = username
        user.avatar_url = avatar_url
        user.encrypted_gh_token = encrypt(access_token)
    else:
        user = User(
            github_id=github_id,
            username=username,
            avatar_url=avatar_url,
            encrypted_gh_token=encrypt(access_token),
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    # 6. Issue JWT
    token = _create_jwt(user)

    # 7. Set cookie and redirect
    resp = RedirectResponse(url=f"{settings.FRONTEND_URL}/", status_code=302)
    resp.set_cookie(
        key="hf_session",
        value=token,
        httponly=True,
        samesite="strict",
        secure=False,  # set True in production with HTTPS
        max_age=settings.JWT_EXPIRE_HOURS * 3600,
    )
    # Clear the oauth_state cookie
    resp.delete_cookie("oauth_state")
    return resp


# ── GET /auth/me ──────────────────────────────────────────────

@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Return current user info — never the token."""
    return {
        "id": user.id,
        "username": user.username,
        "avatar_url": user.avatar_url,
    }


# ── POST /auth/logout ────────────────────────────────────────

@router.post("/logout")
async def logout(user: User = Depends(get_current_user)):
    """Clear the session cookie."""
    resp = Response(status_code=200)
    resp.delete_cookie("hf_session")
    return resp
