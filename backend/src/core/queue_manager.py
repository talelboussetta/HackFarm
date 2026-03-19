from appwrite.query import Query
from src.appwrite_client import databases
from src.core.config import settings
import asyncio
import logging

_semaphore = None  # initialized lazily to avoid event loop issues

def get_semaphore():
    global _semaphore
    if _semaphore is None:
        from src.core.config import settings
        _semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_JOBS)
    return _semaphore

class GlobalSemaphore:
    """Async context manager that acquires/releases the global job semaphore."""
    async def __aenter__(self):
        await get_semaphore().acquire()
        return self
    async def __aexit__(self, *args):
        get_semaphore().release()

def can_run_job(user_id: str) -> bool:
    """Returns True if the user has no currently running job in Appwrite."""
    result = databases.list_documents(
        settings.APPWRITE_DATABASE_ID, "jobs",
        [Query.equal("userId", user_id), Query.equal("status", "running")]
    )
    return result["total"] == 0

def _promote_sync() -> list[str]:
    """Synchronous helper — safe to call from asyncio.to_thread()."""
    queued = databases.list_documents(
        settings.APPWRITE_DATABASE_ID, "jobs",
        [Query.equal("status", "queued"), Query.order_asc("$createdAt"), Query.limit(20)]
    )
    promoted = []
    seen_users = set()
    for job in queued["documents"]:
        uid = job["userId"]
        if uid in seen_users:
            continue
        seen_users.add(uid)
        if can_run_job(uid):
            databases.update_document(
                settings.APPWRITE_DATABASE_ID, "jobs", job["$id"],
                {"status": "running"}
            )
            promoted.append(job["$id"])
    return promoted

async def promote_queued_jobs() -> list[str]:
    """Promote queued jobs and spawn their pipelines as background tasks."""
    promoted = await asyncio.wait_for(asyncio.to_thread(_promote_sync), timeout=15.0)
    if not promoted:
        return promoted

    # Lazy import avoids circular imports.
    from src.api.routes.jobs import run_pipeline_task

    for job_id in promoted:
        try:
            job = await asyncio.wait_for(
                asyncio.to_thread(
                    databases.get_document,
                    settings.APPWRITE_DATABASE_ID,
                    "jobs",
                    job_id,
                ),
                timeout=10.0,
            )
            asyncio.create_task(
                run_pipeline_task(
                    job_id,
                    job["userId"],
                    job.get("rawText", ""),
                    job.get("inputType", "text"),
                    job.get("repoName", "project"),
                    job.get("repoPrivate", False),
                    job.get("retentionDays", 30),
                )
            )
        except Exception as e:
            logging.warning(f"[Queue] Failed to start promoted job {job_id}: {e}")
    return promoted

async def start_queue_poller() -> None:
    """Poll every 30 seconds, promoting queued jobs for eligible users using Appwrite."""
    while True:
        try:
            promoted = await promote_queued_jobs()
            if promoted:
                logging.info(f"[Queue] Poller promoted jobs: {promoted}")
        except Exception as e:
            logging.warning(f"[Queue] Poller error (non-fatal): {e}")
        await asyncio.sleep(30)
