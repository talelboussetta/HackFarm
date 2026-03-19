"""
HackFarmer — ZIP download endpoint.
Streams the generated ZIP from Appwrite Storage.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from src.api.dependencies import get_current_user
from src.appwrite_client import databases
from src.core.config import settings

router = APIRouter()
DB = settings.APPWRITE_DATABASE_ID
log = logging.getLogger(__name__)


@router.get("/{job_id}")
async def download_zip(job_id: str, user: dict = Depends(get_current_user)):
    """ZIP downloads are disabled."""
    try:
        job = databases.get_document(DB, "jobs", job_id)
    except Exception:
        raise HTTPException(404, "Job not found")
    if job.get("userId") != user["id"]:
        raise HTTPException(403, "Not your job")

    raise HTTPException(410, "ZIP downloads are disabled")
