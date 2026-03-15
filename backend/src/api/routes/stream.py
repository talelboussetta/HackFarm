"""
HackFarmer — SSE streaming endpoint.
Placeholder — will be implemented in Phase 3.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/events/{job_id}")
async def stream_events(job_id: str):
    return {"message": f"SSE stream for job {job_id} — not yet implemented"}
