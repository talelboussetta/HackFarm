from fastapi import APIRouter
router = APIRouter(prefix="/auth", tags=["auth"])
# Auth is handled by Appwrite SDK on the frontend.
# This router is kept for any future server-side auth utilities only.
# The old /auth/github, /auth/callback, /auth/me, /auth/logout endpoints
# are all replaced by Appwrite's SDK methods in the frontend.
