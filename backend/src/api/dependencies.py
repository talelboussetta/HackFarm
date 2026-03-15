"""
HackFarmer — FastAPI dependencies.
"""

from datetime import datetime, timezone

import jwt
from fastapi import HTTPException, Request, Depends
from sqlalchemy.orm import Session

from src.core.config import settings
from src.store.db import get_db, User


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    Read hf_session cookie → validate JWT → fetch User from DB → return User.
    Raises HTTP 401 if any step fails.
    """
    token = request.cookies.get("hf_session")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Not authenticated")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return user
