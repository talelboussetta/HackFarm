from datetime import datetime, timezone
import asyncio, logging, re
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from appwrite.query import Query
from appwrite.id import ID
from src.api.dependencies import get_current_user
from src.appwrite_client import databases, storage
from src.core.config import settings
from src.core.events import publish
from src.core.queue_manager import GlobalSemaphore, can_run_job
from src.core.key_manager import get_user_llm_providers
from src.ingestion.pdf_parser import parse_pdf
from src.ingestion.docx_parser import parse_docx
from src.ingestion.normalizer import normalize_to_initial_state
from src.llm.router import LLMRouter
from src.agents.graph import pipeline

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
DB = settings.APPWRITE_DATABASE_ID
log = logging.getLogger(__name__)

VALID_REPO_NAME = re.compile(r"^[a-zA-Z0-9_.-]+$")

# ── POST /api/jobs ────────────────────────────────────────────

@router.post("")
@limiter.limit("10/hour")
async def create_job(
    request: Request,
    user: dict = Depends(get_current_user),
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
    if len(repo_name) > 100:
        raise HTTPException(400, "Repo name too long (max 100 characters)")

    # Validation 3: user must have at least one valid API key
    providers = get_user_llm_providers(user["id"])
    if not providers:
        raise HTTPException(400, "Add at least one API key in Settings before generating a project")

    # Parse input (do this before status check to fail early if invalid)
    if file:
        # MIME type check
        if file.content_type not in ALLOWED_MIME:
            raise HTTPException(400, "Invalid file type")
        file_bytes = await file.read()
        # File size check (10MB max)
        if len(file_bytes) > 10 * 1024 * 1024:
            raise HTTPException(400, "File too large (max 10MB)")
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
        raw_text = prompt
        input_type = "text"

    # Sanitize input text
    raw_text = raw_text[:15000]
    raw_text = raw_text.encode("utf-8", errors="ignore").decode("utf-8")
    raw_text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', raw_text)

    # Validation 4: can user run a job right now?
    if not can_run_job(user["id"]):
        # Create a queued job
        job = databases.create_document(
            DB, "jobs", ID.unique(),
            {
                "userId": user["id"],
                "status": "queued",
                "inputType": input_type,
                "repoName": repo_name,
                "repoPrivate": repo_private,
                "retentionDays": retention_days,
                "jobTitle": repo_name,
                "priority": "low",
            }
        )
        publish(job["$id"], "job_queued", {"message": "Job queued due to concurrency limits"})
        return {"job_id": job["$id"], "status": "queued"}

    # Create job with status="running"
    job = databases.create_document(
        DB, "jobs", ID.unique(),
        {
            "userId": user["id"],
            "status": "running",
            "inputType": input_type,
            "repoName": repo_name,
            "repoPrivate": repo_private,
            "retentionDays": retention_days,
            "jobTitle": repo_name,
            "priority": "low",
        }
    )

    # Launch pipeline in background
    asyncio.create_task(
        run_pipeline_task(job["$id"], user["id"], raw_text, input_type,
                          repo_name, repo_private, retention_days)
    )

    return {"job_id": job["$id"], "status": "running"}


# ── GET /api/jobs ─────────────────────────────────────────────

@router.get("")
async def list_jobs(
    user: dict = Depends(get_current_user),
):
    """Return all of the current user's jobs, newest first."""
    result = databases.list_documents(
        DB, "jobs",
        [Query.equal("userId", user["id"]), Query.order_desc("$createdAt"), Query.limit(50)]
    )
    return [
        {
            "id": j["$id"],
            "status": j["status"],
            "input_type": j["inputType"],
            "repo_name": j["repoName"],
            "repo_private": j["repoPrivate"],
            "github_url": j.get("githubUrl"),
            "zip_path": j.get("zipFileId"),
            "created_at": j["$createdAt"],
            "completed_at": j.get("completedAt"),
            "error_message": j.get("errorMessage"),
        }
        for j in result["documents"]
    ]


# ── GET /api/jobs/{job_id} ────────────────────────────────────

@router.get("/{job_id}")
async def get_job(
    job_id: str,
    user: dict = Depends(get_current_user),
):
    """Return full job details + nested agent_runs list."""
    try:
        job = databases.get_document(DB, "jobs", job_id)
    except Exception:
        raise HTTPException(404, "Job not found")
        
    if job["userId"] != user["id"]:
        raise HTTPException(403, "Not your job")

    agent_runs = databases.list_documents(
        DB, "agent-runs",
        [Query.equal("jobId", job_id), Query.order_asc("startedAt")]
    )

    return {
        "id": job["$id"],
        "status": job["status"],
        "input_type": job["inputType"],
        "repo_name": job["repoName"],
        "repo_private": job["repoPrivate"],
        "github_url": job.get("githubUrl"),
        "zip_path": job.get("zipFileId"),
        "error_message": job.get("errorMessage"),
        "created_at": job["$createdAt"],
        "completed_at": job.get("completedAt"),
        "agent_runs": [
            {
                "id": r["$id"],
                "agent_name": r["agentName"],
                "status": r["status"],
                "retry_count": r["retryCount"],
                "started_at": r.get("startedAt"),
                "completed_at": r.get("completedAt"),
                "output_summary": r.get("outputSummary"),
            }
            for r in agent_runs["documents"]
        ],
    }


# ── DELETE /api/jobs/{job_id} ─────────────────────────────────

@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    user: dict = Depends(get_current_user),
):
    """Cancel a running job or delete a completed/failed job."""
    try:
        job = databases.get_document(DB, "jobs", job_id)
    except Exception:
        raise HTTPException(404, "Job not found")
        
    if job["userId"] != user["id"]:
        raise HTTPException(403, "Not your job")

    if job["status"] in ("queued", "running"):
        # Cancel: mark as failed so the pipeline stops
        databases.update_document(DB, "jobs", job_id, {
            "status": "failed",
            "errorMessage": "Cancelled by user"
        })

    # Delete the job document
    try:
        databases.delete_document(DB, "jobs", job_id)
    except Exception as e:
        log.warning(f"Could not delete job document {job_id}: {e}")

    # Clean up related events (best-effort)
    try:
        events = databases.list_documents(DB, "job-events", [Query.equal("jobId", job_id), Query.limit(100)])
        for doc in events["documents"]:
            try:
                databases.delete_document(DB, "job-events", doc["$id"])
            except Exception:
                pass
    except Exception:
        pass

    # Clean up agent-runs (best-effort)
    try:
        runs = databases.list_documents(DB, "agent-runs", [Query.equal("jobId", job_id), Query.limit(50)])
        for doc in runs["documents"]:
            try:
                databases.delete_document(DB, "agent-runs", doc["$id"])
            except Exception:
                pass
    except Exception:
        pass

    return {"deleted": True}


# ── Background task run_pipeline_task ───

PIPELINE_TIMEOUT_SECONDS = 600  # 10 minutes max per pipeline run


async def run_pipeline_task(job_id, user_id, raw_text, input_type,
                             repo_name, repo_private, retention_days):
  async with GlobalSemaphore():
    try:
      providers = get_user_llm_providers(user_id)
      if not providers:
          raise ValueError("No valid LLM API keys found. Add keys in Settings and try again.")
      llm = LLMRouter(providers)
      # Build initial state
      state = normalize_to_initial_state(raw_text, input_type, job_id, user_id)
      state["llm"] = llm
      state["repo_name"] = repo_name  # pass through for github_agent
      state["repo_private"] = repo_private

      # Run the pipeline with a timeout
      try:
          result = await asyncio.wait_for(
              pipeline.ainvoke(state),
              timeout=PIPELINE_TIMEOUT_SECONDS,
          )
      except asyncio.TimeoutError:
          raise TimeoutError(
              f"Pipeline timed out after {PIPELINE_TIMEOUT_SECONDS // 60} minutes"
          )

      final_status = "failed" if result.get("errors") else "completed"
      error_msg = "; ".join(result.get("errors", [])[:3]) if result.get("errors") else None
      databases.update_document(DB, "jobs", job_id, {
          "status": final_status,
          "githubUrl": result.get("github_url", ""),
          "completedAt": datetime.now(timezone.utc).isoformat(),
          "errorMessage": error_msg
      })
      # Only emit job_failed for partial — github_agent already emits job_complete on success
      if result.get("errors"):
          publish(job_id, "job_failed", {"error": error_msg or "Some agents failed", "last_agent": "unknown"})
    except Exception as e:
      log.error(f"Pipeline failed job={job_id}: {type(e).__name__}: {e}", exc_info=True)
      error_str = f"{type(e).__name__}: {str(e)[:400]}"
      publish(job_id, "job_failed", {"error": error_str, "last_agent": "unknown"})
      try:
          databases.update_document(DB, "jobs", job_id, {
              "status": "failed",
              "errorMessage": error_str,
              "completedAt": datetime.now(timezone.utc).isoformat()
          })
      except Exception:
          pass
    finally:
      try:
        from src.integrations.n8n import fire_webhook
        fire_webhook({"job_id": job_id})
      except Exception:
        pass
