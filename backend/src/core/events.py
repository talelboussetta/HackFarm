import json
import logging
from datetime import datetime, timezone
from appwrite.id import ID
from appwrite.query import Query
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
    Also syncs agent status to the agent-runs collection for high-level tracking.
    """
    if event_type not in VALID_EVENT_TYPES:
        raise ValueError(f"Invalid event type: {event_type}. Must be one of: {VALID_EVENT_TYPES}")

    db_id = settings.APPWRITE_DATABASE_ID
    
    # 1. Store the event raw
    try:
        databases.create_document(
            database_id=db_id,
            collection_id="job-events",
            document_id=ID.unique(),
            data={
                "jobId": job_id,
                "eventType": event_type,
                "payload": json.dumps(payload),
            }
        )
    except Exception as e:
        log.error(f"Event write FAILED job={job_id}: {type(e).__name__}: {e}")

    # 2. Update agent-runs tracking table
    agent_name = payload.get("agent")
    if agent_name and event_type in ("agent_start", "agent_done", "agent_failed"):
        try:
            # Check for existing run for this agent in this job
            existing = databases.list_documents(
                db_id, "agent-runs", 
                [Query.equal("jobId", job_id), Query.equal("agentName", agent_name)]
            )
            
            status_map = {
                "agent_start": "running",
                "agent_done": "completed",
                "agent_failed": "failed"
            }
            
            data = {"status": status_map.get(event_type, "running")}
            if event_type == "agent_start":
                data["startedAt"] = datetime.now(timezone.utc).isoformat()
            elif event_type in ("agent_done", "agent_failed"):
                data["completedAt"] = datetime.now(timezone.utc).isoformat()
            
            if existing["total"] > 0:
                doc_id = existing["documents"][0]["$id"]
                databases.update_document(db_id, "agent-runs", doc_id, data)
            else:
                data.update({
                    "jobId": job_id,
                    "agentName": agent_name,
                    "retryCount": 0,
                    "runDuration": 0,
                    "outputFormat": "json",
                })
                databases.create_document(db_id, "agent-runs", ID.unique(), data)
        except Exception as e:
            log.warning(f"Agent-run sync failed (non-fatal) agent={agent_name}: {e}")
