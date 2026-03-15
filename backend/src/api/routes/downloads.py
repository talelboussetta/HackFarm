"""
HackFarmer — ZIP download endpoint.
Streams the generated ZIP from Appwrite Storage.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from src.api.dependencies import get_current_user
from src.appwrite_client import databases, storage
from src.core.config import settings

router = APIRouter()
DB = settings.APPWRITE_DATABASE_ID
log = logging.getLogger(__name__)


@router.get("/{job_id}")
async def download_zip(job_id: str, user: dict = Depends(get_current_user)):
    """Download the generated ZIP for a completed job."""
    # Get job document
    try:
        job = databases.get_document(DB, "jobs", job_id)
    except Exception:
        raise HTTPException(404, "Job not found")

    # Verify ownership
    if job.get("userId") != user["id"]:
        raise HTTPException(403, "Not your job")

    # Check for zip file
    zip_file_id = job.get("zipFileId")
    if not zip_file_id:
        raise HTTPException(404, "ZIP not available for this job")

    repo_name = job.get("repoName", "project")

    # Download from Appwrite Storage
    try:
        file_bytes = storage.get_file_download(
            bucket_id=settings.APPWRITE_ZIP_BUCKET_ID,
            file_id=zip_file_id,
        )
    except Exception as e:
        log.error(f"Failed to download ZIP from storage: {e}")
        raise HTTPException(500, "Failed to retrieve ZIP file")

    return StreamingResponse(
        iter([file_bytes]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{repo_name}.zip"',
        },
    )
