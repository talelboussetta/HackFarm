import json
import logging
from datetime import datetime, timezone
from src.appwrite_client import databases
from src.core.config import settings

log = logging.getLogger(__name__)

VALID_EVENT_TYPES = {
    "agent_start", "agent_thinking", "agent_done", "agent_failed",
    "job_complete", "job_failed", "job_queued", "heartbeat"
}

def publish(job_id: str, event_type: str, payload: dict) -> None:
    """
    Write event to Appwrite job-events collection.
    Appwrite Realtime delivers it to all subscribed frontend clients automatically.
    Signature unchanged from SSE version \u2014 all agents call this the same way.
    """
    if event_type not in VALID_EVENT_TYPES:
        raise ValueError(f"Invalid event type: {event_type}. Must be one of: {VALID_EVENT_TYPES}")

    try:
        databases.create_document(
            database_id=settings.APPWRITE_DATABASE_ID,
            collection_id="job-events",
            document_id="unique()",
            data={
                "job_id": job_id,
                "event_type": event_type,
                "payload": json.dumps(payload),
            }
        )
    except Exception as e:
        # Events are best-effort \u2014 log warning but NEVER crash the pipeline
        log.warning(f"Event publish failed (non-fatal) job={job_id} type={event_type}: {e}")
