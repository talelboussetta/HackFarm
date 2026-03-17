"""
HackFarmer — Admin analytics routes.
Protected by ADMIN_USER_IDS config — only listed user IDs can access.
"""

import logging
from collections import Counter
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from appwrite.query import Query

from src.api.dependencies import get_current_user
from src.appwrite_client import databases
from src.core.config import settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

DB = settings.APPWRITE_DATABASE_ID


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Raise 403 unless the requesting user is in ADMIN_USER_IDS."""
    allowed = [uid.strip() for uid in settings.ADMIN_USER_IDS.split(",") if uid.strip()]
    if not allowed:
        raise HTTPException(403, "Admin access not configured")
    if user["id"] not in allowed:
        raise HTTPException(403, "Admin access required")
    return user


# ── GET /api/admin/stats ──────────────────────────────────────

@router.get("/stats")
async def admin_stats(_admin: dict = Depends(require_admin)):
    """Platform-wide analytics: job volumes, success rates, agent performance."""

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=7)).isoformat()
    month_start = (now - timedelta(days=30)).isoformat()

    # ── Job counts ───────────────────────────────────────────
    def count_jobs(filters):
        try:
            return databases.list_documents(DB, "jobs", filters + [Query.limit(1)])["total"]
        except Exception:
            return 0

    total_jobs      = count_jobs([])
    jobs_today      = count_jobs([Query.greater_than_equal("$createdAt", today_start)])
    jobs_this_week  = count_jobs([Query.greater_than_equal("$createdAt", week_start)])
    jobs_this_month = count_jobs([Query.greater_than_equal("$createdAt", month_start)])
    completed       = count_jobs([Query.equal("status", "completed")])
    failed          = count_jobs([Query.equal("status", "failed")])
    running         = count_jobs([Query.equal("status", "running")])

    success_rate = round(completed / total_jobs * 100) if total_jobs else 0

    # ── Unique users (approximate via recent jobs) ────────────
    unique_users = set()
    try:
        recent = databases.list_documents(
            DB, "jobs",
            [Query.greater_than_equal("$createdAt", month_start), Query.limit(100)],
        )
        for doc in recent["documents"]:
            unique_users.add(doc.get("userId", ""))
    except Exception:
        pass

    # ── Agent performance (last 200 agent-runs) ───────────────
    agent_stats: dict = {}
    try:
        runs = databases.list_documents(
            DB, "agent-runs",
            [Query.order_desc("$createdAt"), Query.limit(200)],
        )
        durations: dict[str, list] = {}
        failures: dict[str, int] = {}
        for run in runs["documents"]:
            name = run.get("agentName", "unknown")
            dur = run.get("runDuration", 0) or 0
            status = run.get("status", "")
            durations.setdefault(name, []).append(dur)
            if status == "failed":
                failures[name] = failures.get(name, 0) + 1

        for name, durs in durations.items():
            agent_stats[name] = {
                "runs": len(durs),
                "avg_duration_s": round(sum(durs) / len(durs), 1) if durs else 0,
                "failures": failures.get(name, 0),
            }
    except Exception as e:
        log.warning(f"agent-runs query failed: {e}")

    # ── Daily job volume (last 7 days) ────────────────────────
    daily_volume: list[dict] = []
    try:
        all_recent = databases.list_documents(
            DB, "jobs",
            [Query.greater_than_equal("$createdAt", week_start), Query.limit(100)],
        )
        day_counts: Counter = Counter()
        for doc in all_recent["documents"]:
            created = doc.get("$createdAt", "")
            if created:
                day = created[:10]  # "YYYY-MM-DD"
                day_counts[day] += 1

        for i in range(7):
            day = (now - timedelta(days=6 - i)).strftime("%Y-%m-%d")
            daily_volume.append({"date": day, "count": day_counts.get(day, 0)})
    except Exception:
        pass

    # ── Most common repo name keywords (proxy for project types) ─
    popular_keywords: list[dict] = []
    try:
        sample = databases.list_documents(
            DB, "jobs",
            [Query.equal("status", "completed"), Query.limit(100)],
        )
        words: Counter = Counter()
        stop = {"app", "my", "the", "test", "demo", "project", "new", "a", "an"}
        for doc in sample["documents"]:
            name = (doc.get("repoName") or "").lower().replace("-", " ").replace("_", " ")
            for word in name.split():
                if word not in stop and len(word) > 2:
                    words[word] += 1
        popular_keywords = [{"word": w, "count": c} for w, c in words.most_common(10)]
    except Exception:
        pass

    return {
        "jobs": {
            "total": total_jobs,
            "today": jobs_today,
            "this_week": jobs_this_week,
            "this_month": jobs_this_month,
            "completed": completed,
            "failed": failed,
            "running": running,
            "success_rate": success_rate,
        },
        "users": {
            "active_this_month": len(unique_users),
        },
        "agents": agent_stats,
        "daily_volume": daily_volume,
        "popular_keywords": popular_keywords,
    }
