"""
HackFarmer — Jobs API routes.

POST /api/jobs       — create job, launch pipeline
GET  /api/jobs       — list current user's jobs
GET  /api/jobs/{id}  — full job + agent_runs
DELETE /api/jobs/{id} — cancel/soft-delete
"""

import asyncio
import re
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from src.store.db import get_db, Job, AgentRun, UserApiKey, User, SessionLocal
from src.api.dependencies import get_current_user
from src.core.events import event_bus
from src.core.queue_manager import GlobalSemaphore, can_run_job
from src.core.key_manager import get_user_llm_providers
from src.llm.router import LLMRouter
from src.ingestion.pdf_parser import parse_pdf
from src.ingestion.docx_parser import parse_docx
from src.ingestion.normalizer import normalize_to_initial_state
from src.agents.graph import pipeline

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_REPO_NAME = re.compile(r"^[a-zA-Z0-9_.-]+$")


# ── POST /api/jobs ────────────────────────────────────────────

@router.post("")
async def create_job(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    file: UploadFile | None = File(None),
    prompt: str | None = Form(None),
    repo_name: str = Form(...),
    repo_private: bool = Form(False),
    retention_days: int = Form(30),
):
    """Create a new job and launch the agent pipeline."""

    # Validation 1: exactly one of file or prompt
    if file and prompt:
        raise HTTPException(400, "Provide either a file or a prompt, not both")
    if not file and not prompt:
        raise HTTPException(400, "Provide either a file or a prompt")

    # Validation 2: repo_name
    if not repo_name or not VALID_REPO_NAME.match(repo_name):
        raise HTTPException(400, "Invalid repo name (alphanumeric, hyphens, dots, underscores only)")

    # Validation 3: user must have at least one valid API key
    key_count = (
        db.query(UserApiKey)
        .filter(UserApiKey.user_id == user.id, UserApiKey.is_valid.is_(True))
        .count()
    )
    if key_count == 0:
        raise HTTPException(400, "Add at least one API key in Settings before generating")

    # Validation 4: can user run a job right now?
    if not can_run_job(user.id, db):
        # Create a queued job
        job = Job(
            user_id=user.id,
            status="queued",
            input_type="text",
            repo_name=repo_name,
            repo_private=repo_private,
            retention_days=retention_days,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return {"job_id": job.id, "status": "queued"}

    # Parse input
    if file:
        file_bytes = await file.read()
        filename = file.filename or ""
        if filename.lower().endswith(".pdf"):
            raw_text = parse_pdf(file_bytes)
            input_type = "pdf"
        elif filename.lower().endswith(".docx"):
            raw_text = parse_docx(file_bytes)
            input_type = "docx"
        else:
            raise HTTPException(400, "Unsupported file type. Upload PDF or DOCX.")
    else:
        raw_text = prompt  # type: ignore
        input_type = "text"

    # Create job in DB
    job = Job(
        user_id=user.id,
        status="running",
        input_type=input_type,
        repo_name=repo_name,
        repo_private=repo_private,
        retention_days=retention_days,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Launch pipeline in background
    asyncio.create_task(
        run_pipeline_task(job.id, user.id, raw_text, input_type)
    )

    return {"job_id": job.id, "status": "running"}


# ── GET /api/jobs ─────────────────────────────────────────────

@router.get("")
async def list_jobs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all of the current user's jobs, newest first."""
    jobs = (
        db.query(Job)
        .filter(Job.user_id == user.id)
        .order_by(Job.created_at.desc())
        .all()
    )
    return [
        {
            "id": j.id,
            "status": j.status,
            "input_type": j.input_type,
            "repo_name": j.repo_name,
            "repo_private": j.repo_private,
            "github_url": j.github_url,
            "zip_path": j.zip_path,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            "error_message": j.error_message,
        }
        for j in jobs
    ]


# ── GET /api/jobs/{job_id} ────────────────────────────────────

@router.get("/{job_id}")
async def get_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return full job details + nested agent_runs list."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.user_id != user.id:
        raise HTTPException(403, "Not your job")

    agent_runs = (
        db.query(AgentRun)
        .filter(AgentRun.job_id == job_id)
        .order_by(AgentRun.started_at.asc())
        .all()
    )

    return {
        "id": job.id,
        "status": job.status,
        "input_type": job.input_type,
        "repo_name": job.repo_name,
        "repo_private": job.repo_private,
        "github_url": job.github_url,
        "zip_path": job.zip_path,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "agent_runs": [
            {
                "id": r.id,
                "agent_name": r.agent_name,
                "status": r.status,
                "retry_count": r.retry_count,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "output_summary": r.output_summary,
            }
            for r in agent_runs
        ],
    }


# ── DELETE /api/jobs/{job_id} ─────────────────────────────────

@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel or soft-delete a job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.user_id != user.id:
        raise HTTPException(403, "Not your job")

    if job.status in ("queued", "running"):
        job.status = "failed"
        job.error_message = "Cancelled by user"
    else:
        job.error_message = "Deleted by user"

    db.commit()
    return {"deleted": True}


# ── Background pipeline task ────────────────────────────────

async def run_pipeline_task(
    job_id: str,
    user_id: str,
    raw_text: str,
    input_type: str,
) -> None:
    """Run the full agent pipeline in the background."""
    db = SessionLocal()
    try:
        async with GlobalSemaphore():
            # Build LLM router with user's keys
            providers = get_user_llm_providers(user_id)
            llm = LLMRouter(providers)

            # Build initial state
            initial_state = normalize_to_initial_state(
                raw_text, input_type, job_id, user_id
            )
            initial_state["llm"] = llm

            # Run the pipeline
            result = await pipeline.ainvoke(initial_state)

            # Update job with results
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                return

            if result.get("errors"):
                job.status = "partial"
                job.error_message = "; ".join(result["errors"][:3])
            else:
                job.status = "complete"

            job.github_url = result.get("github_url")
            job.completed_at = datetime.now(timezone.utc)
            db.commit()

    except Exception as e:
        logger.error(f"[Pipeline] Job {job_id} failed: {e}")
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(e)[:500]
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
        event_bus.publish(
            job_id, "job_failed", {"error": str(e), "last_agent": "unknown"}
        )
    finally:
        db.close()
        # Fire n8n webhook (non-critical, import inline to avoid circular)
        from src.integrations.n8n import fire_webhook

        fire_webhook({"job_id": job_id, "status": "complete"})
