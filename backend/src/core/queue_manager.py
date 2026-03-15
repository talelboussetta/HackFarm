from appwrite.query import Query
from src.appwrite_client import databases
from src.core.config import settings
import asyncio, logging

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

async def promote_queued_jobs() -> list[str]:
    """
    For each user who has a queued job but no running job,
    promote their oldest queued job to running in Appwrite.
    """
    # Find oldest queued jobs
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
        if can_run_job(uid):  # no running job for this user
            databases.update_document(
                settings.APPWRITE_DATABASE_ID, "jobs", job["$id"],
                {"status": "running"}
            )
            promoted.append(job["$id"])
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
