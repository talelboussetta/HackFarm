"""
HackFarmer — SSE stream endpoint.

GET /stream/events/{job_id}
Replays past events from DB, then streams live events via EventBus.
"""

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from src.store.db import get_db, Job, JobEvent, User
from src.api.dependencies import get_current_user
from src.core.events import event_bus

router = APIRouter()


@router.get("/events/{job_id}")
async def stream_events(
    job_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """SSE endpoint — replay past events then stream live ones."""

    # 1. Fetch job
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # 2. Verify ownership
    if job.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your job")

    # 3. Fetch all past events
    past_events = (
        db.query(JobEvent)
        .filter(JobEvent.job_id == job_id)
        .order_by(JobEvent.created_at.asc())
        .all()
    )

    async def event_generator():
        # a. Replay past events
        for row in past_events:
            yield {"event": row.event_type, "data": row.payload}

        # b. If job is terminal, send stream_end and return
        if job.status in ("complete", "failed", "partial"):
            yield {"event": "stream_end", "data": "{}"}
            return

        # c. Subscribe to live events
        queue = event_bus.subscribe(job_id)

        # d. Stream live events
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    yield {
                        "event": "heartbeat",
                        "data": json.dumps({"active_agents": []}),
                    }
                    continue

                yield {
                    "event": event["type"],
                    "data": json.dumps(event["payload"]),
                }

                if event["type"] in ("job_complete", "job_failed"):
                    break
        finally:
            # e. Unsubscribe
            event_bus.unsubscribe(job_id, queue)

    return EventSourceResponse(
        event_generator(), media_type="text/event-stream"
    )
