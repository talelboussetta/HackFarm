"""
HackFarmer — ZIP download endpoint.
Placeholder — will be implemented in Phase 3.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/{job_id}")
async def download_zip(job_id: str):
    return {"message": f"Download for job {job_id} — not yet implemented"}
