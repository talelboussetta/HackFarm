"""
HackFarmer — SSE EventBus (pub/sub).

In-process pub/sub for broadcasting job events to SSE streams.
Each subscriber gets an asyncio.Queue for a specific job_id.
Events are also persisted to the JobEvent table.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

VALID_EVENT_TYPES = {
    "agent_start",
    "agent_thinking",
    "agent_done",
    "agent_failed",
    "job_complete",
    "job_failed",
    "job_queued",
    "heartbeat",
}


class EventBus:
    """In-process pub/sub keyed by job_id."""

    def __init__(self):
        # job_id → set of asyncio.Queue
        self._subscribers: dict[str, set[asyncio.Queue]] = {}

    def subscribe(self, job_id: str) -> asyncio.Queue:
        """Create a new queue for a subscriber of the given job_id."""
        queue: asyncio.Queue = asyncio.Queue()
        if job_id not in self._subscribers:
            self._subscribers[job_id] = set()
        self._subscribers[job_id].add(queue)
        logger.debug(f"[EventBus] Subscriber added for job {job_id}")
        return queue

    def unsubscribe(self, job_id: str, queue: asyncio.Queue) -> None:
        """Remove a subscriber queue."""
        if job_id in self._subscribers:
            self._subscribers[job_id].discard(queue)
            if not self._subscribers[job_id]:
                del self._subscribers[job_id]
        logger.debug(f"[EventBus] Subscriber removed for job {job_id}")

    def publish(self, job_id: str, event_type: str, payload: dict[str, Any]) -> None:
        """
        Broadcast an event to all subscribers of a job.
        Also persists the event to the JobEvent table.
        """
        if event_type not in VALID_EVENT_TYPES:
            raise ValueError(
                f"Invalid event type: {event_type}. "
                f"Must be one of: {', '.join(sorted(VALID_EVENT_TYPES))}"
            )

        event = {
            "type": event_type,
            "payload": payload,
            "job_id": job_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Persist to DB (import inline to avoid circular imports)
        try:
            from src.store.db import SessionLocal, JobEvent

            db = SessionLocal()
            try:
                db_event = JobEvent(
                    job_id=job_id,
                    event_type=event_type,
                    payload=json.dumps(payload),
                )
                db.add(db_event)
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"[EventBus] Failed to persist event: {e}")

        # Broadcast to in-memory subscribers
        if job_id in self._subscribers:
            for queue in self._subscribers[job_id]:
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning(f"[EventBus] Queue full for job {job_id}")


# Global singleton
event_bus = EventBus()


async def start_heartbeat_task() -> None:
    """Periodically send heartbeat events to all active subscriptions."""
    while True:
        await asyncio.sleep(15)
        for job_id in list(event_bus._subscribers.keys()):
            try:
                event_bus.publish(job_id, "heartbeat", {"active_agents": []})
            except Exception:
                pass
