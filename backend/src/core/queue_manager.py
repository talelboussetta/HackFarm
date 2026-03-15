"""
HackFarmer — Queue Manager.

Global semaphore for concurrency control and per-user job queuing.
No Redis, no Celery — pure asyncio inside the FastAPI process.
"""

import asyncio
import logging

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.core.config import settings
from src.store.db import SessionLocal, Job

logger = logging.getLogger(__name__)

_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_JOBS)


class GlobalSemaphore:
    """Async context manager that acquires/releases the global job semaphore."""

    async def __aenter__(self):
        await _semaphore.acquire()
        return self

    async def __aexit__(self, *args):
        _semaphore.release()


def can_run_job(user_id: str, db: Session) -> bool:
    """Returns True if the user has no currently running job."""
    count = (
        db.query(Job)
        .filter(Job.user_id == user_id, Job.status == "running")
        .count()
    )
    return count == 0


async def promote_queued_jobs(db: Session) -> list[str]:
    """
    For each user who has a queued job but no running job,
    promote their oldest queued job to running.
    Returns list of promoted job IDs.
    """
    promoted = []

    # 1. Find all user_ids that have at least one queued job
    queued_users = (
        db.query(Job.user_id)
        .filter(Job.status == "queued")
        .distinct()
        .all()
    )

    for (uid,) in queued_users:
        # 2. Check if this user has a running job
        running_count = (
            db.query(Job)
            .filter(Job.user_id == uid, Job.status == "running")
            .count()
        )
        if running_count > 0:
            continue

        # 3. Get their oldest queued job
        oldest = (
            db.query(Job)
            .filter(Job.user_id == uid, Job.status == "queued")
            .order_by(Job.created_at.asc())
            .first()
        )
        if oldest:
            oldest.status = "running"
            promoted.append(oldest.id)

    if promoted:
        db.commit()

    return promoted


async def start_queue_poller() -> None:
    """Poll every 30 seconds, promoting queued jobs for eligible users."""
    while True:
        await asyncio.sleep(30)
        db = SessionLocal()
        try:
            promoted = await promote_queued_jobs(db)
            if promoted:
                logger.info(f"[Queue] Promoted jobs: {promoted}")
        except Exception as e:
            logger.error(f"[Queue] Poller error: {e}")
        finally:
            db.close()
