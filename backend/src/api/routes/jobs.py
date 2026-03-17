from datetime import datetime, timezone
import asyncio, base64, io, json, logging, re, zipfile
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import PlainTextResponse
from appwrite.query import Query
from appwrite.id import ID
from src.api.dependencies import get_current_user
from src.appwrite_client import databases, storage, users_service
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
GITHUB_REPO_RE = re.compile(r"github\.com/([^/]+)/([^/]+)")

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
    model_preference: str | None = Form(None),
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

    # Validation 3b: daily job limit (10 jobs/day per user)
    DAILY_JOB_LIMIT = 10
    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        today_jobs = databases.list_documents(
            DB, "jobs",
            [
                Query.equal("userId", user["id"]),
                Query.greater_than_equal("$createdAt", today_start),
                Query.limit(1),
            ]
        )
        if today_jobs["total"] >= DAILY_JOB_LIMIT:
            raise HTTPException(429, f"Daily limit reached ({DAILY_JOB_LIMIT} jobs/day). Try again tomorrow.")
    except HTTPException:
        raise
    except Exception as e:
        log.warning(f"Could not check daily limit: {e}")

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
                          repo_name, repo_private, retention_days,
                          model_preference=model_preference)
    )

    return {"job_id": job["$id"], "status": "running"}


# ── GET /api/jobs ─────────────────────────────────────────────

@router.get("")
async def list_jobs(
    user: dict = Depends(get_current_user),
    offset: int = 0,
    limit: int = 20,
):
    """Return the current user's jobs, newest first, with pagination."""
    limit = min(limit, 100)  # cap at 100
    offset = max(offset, 0)
    result = databases.list_documents(
        DB, "jobs",
        [
            Query.equal("userId", user["id"]),
            Query.order_desc("$createdAt"),
            Query.limit(limit),
            Query.offset(offset),
        ]
    )
    return {
        "jobs": [
            {
                "id": j["$id"],
                "status": j["status"],
                "input_type": j["inputType"],
                "repo_name": j["repoName"],
                "repo_private": j["repoPrivate"],
                "github_url": j.get("githubUrl"),
                "created_at": j["$createdAt"],
                "completed_at": j.get("completedAt"),
                "error_message": j.get("errorMessage"),
                "token_usage": j.get("tokenUsage"),
            }
            for j in result["documents"]
        ],
        "total": result["total"],
        "offset": offset,
        "limit": limit,
    }


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


# ── GET /api/jobs/{job_id}/files ──────────────────────────────

def _get_zip_bytes(job: dict) -> bytes:
    """Download the ZIP from Appwrite Storage for a given job."""
    zip_file_id = None
    try:
        recent = databases.list_documents(
            DB,
            "job-events",
            [
                Query.equal("jobId", job["$id"]),
                Query.equal("eventType", "job_complete"),
                Query.order_desc("$createdAt"),
                Query.limit(1),
            ],
        )
        docs = recent.get("documents", [])
        if docs:
            payload = json.loads(docs[0].get("payload") or "{}")
            zip_file_id = payload.get("zip_file_id")
    except Exception:
        zip_file_id = None
    if not zip_file_id:
        raise HTTPException(404, "ZIP not available — job may still be running")
    try:
        return storage.get_file_download(
            bucket_id=settings.APPWRITE_ZIP_BUCKET_ID,
            file_id=zip_file_id,
        )
    except Exception:
        raise HTTPException(500, "Failed to retrieve ZIP file")


def _parse_github_repo(job: dict) -> tuple[str, str]:
    github_url = (job.get("githubUrl") or "").strip()
    m = GITHUB_REPO_RE.search(github_url)
    if not m:
        raise HTTPException(404, "Repository URL not available for this job")
    return m.group(1), m.group(2).removesuffix(".git")


def _get_user_github_token(user_id: str) -> str | None:
    try:
        identities = users_service.list_identities(queries=[Query.equal("userId", user_id)])
        github_identity = next(
            (i for i in identities.get("identities", []) if i.get("provider") == "github"),
            None,
        )
        return (github_identity or {}).get("providerAccessToken") or None
    except Exception:
        return None


async def _list_github_files(job: dict, user: dict) -> list[dict]:
    owner, repo = _parse_github_repo(job)
    token = _get_user_github_token(user["id"])
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        for ref in ("main", "master"):
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/git/trees/{ref}",
                params={"recursive": "1"},
                headers=headers,
            )
            if resp.status_code == 404:
                continue
            if resp.status_code == 403:
                raise HTTPException(403, "Cannot access repository files (permission denied)")
            if not resp.is_success:
                raise HTTPException(502, f"Failed to load repository tree ({resp.status_code})")
            tree = resp.json().get("tree", [])
            return sorted(
                [
                    {"path": item["path"], "size": int(item.get("size") or 0)}
                    for item in tree
                    if item.get("type") == "blob"
                ],
                key=lambda f: f["path"],
            )
    raise HTTPException(404, "No repository branch found for file listing")


async def _get_github_file_content(job: dict, user: dict, filepath: str) -> str:
    owner, repo = _parse_github_repo(job)
    token = _get_user_github_token(user["id"])
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        for ref in ("main", "master"):
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/contents/{filepath}",
                params={"ref": ref},
                headers=headers,
            )
            if resp.status_code == 404:
                continue
            if resp.status_code == 403:
                raise HTTPException(403, "Cannot access repository file content")
            if not resp.is_success:
                raise HTTPException(502, f"Failed to load repository file ({resp.status_code})")
            payload = resp.json()
            if payload.get("encoding") == "base64":
                raw = payload.get("content", "").replace("\n", "")
                return base64.b64decode(raw).decode("utf-8", errors="replace")
            return payload.get("content", "")
    raise HTTPException(404, f"File not found: {filepath}")


@router.get("/{job_id}/files")
async def list_files(job_id: str, user: dict = Depends(get_current_user)):
    """Return the list of files inside the generated ZIP with metadata."""
    try:
        job = databases.get_document(DB, "jobs", job_id)
    except Exception:
        raise HTTPException(404, "Job not found")
    if job["userId"] != user["id"]:
        raise HTTPException(403, "Not your job")

    try:
        raw = _get_zip_bytes(job)
        with zipfile.ZipFile(io.BytesIO(raw), "r") as zf:
            files = []
            for info in zf.infolist():
                if info.is_dir():
                    continue
                files.append({
                    "path": info.filename,
                    "size": info.file_size,
                })
        return {"files": sorted(files, key=lambda f: f["path"])}
    except HTTPException:
        return {"files": await _list_github_files(job, user)}


@router.get("/{job_id}/files/{filepath:path}")
async def get_file_content(
    job_id: str,
    filepath: str,
    user: dict = Depends(get_current_user),
):
    """Return the content of a single file from the generated ZIP."""
    try:
        job = databases.get_document(DB, "jobs", job_id)
    except Exception:
        raise HTTPException(404, "Job not found")
    if job["userId"] != user["id"]:
        raise HTTPException(403, "Not your job")

    try:
        raw = _get_zip_bytes(job)
        with zipfile.ZipFile(io.BytesIO(raw), "r") as zf:
            if filepath not in zf.namelist():
                raise HTTPException(404, f"File not found: {filepath}")
            content = zf.read(filepath).decode("utf-8", errors="replace")
        return PlainTextResponse(content)
    except HTTPException:
        return PlainTextResponse(await _get_github_file_content(job, user, filepath))


# ── GET /api/jobs/stats ───────────────────────────────────────

@router.get("-stats")
async def get_user_stats(user: dict = Depends(get_current_user)):
    """Return aggregate stats for the current user's dashboard."""
    user_id = user["id"]
    try:
        all_jobs = databases.list_documents(
            DB, "jobs",
            [Query.equal("userId", user_id), Query.limit(500)],
        )
    except Exception:
        raise HTTPException(500, "Failed to fetch stats")

    docs = all_jobs.get("documents", [])
    total = len(docs)
    completed = sum(1 for d in docs if d.get("status") == "completed")
    failed = sum(1 for d in docs if d.get("status") == "failed")
    running = sum(1 for d in docs if d.get("status") == "running")

    return {
        "total_projects": total,
        "completed": completed,
        "failed": failed,
        "running": running,
        "success_rate": round(completed / total * 100) if total else 0,
    }


# ── POST /api/jobs/{job_id}/refine ────────────────────────────

@router.post("/{job_id}/refine")
async def refine_job(
    job_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Re-run coding agents with user feedback appended to the original prompt."""
    try:
        job = databases.get_document(DB, "jobs", job_id)
    except Exception:
        raise HTTPException(404, "Job not found")

    if job["userId"] != user["id"]:
        raise HTTPException(403, "Not your job")

    if job["status"] not in ("completed", "failed"):
        raise HTTPException(400, "Can only refine completed or failed jobs")

    body = await request.json()
    feedback = (body.get("feedback") or "").strip()
    if not feedback:
        raise HTTPException(400, "Feedback is required")
    if len(feedback) > 5000:
        raise HTTPException(400, "Feedback too long (max 5000 characters)")

    # Check concurrency
    if not can_run_job(user["id"]):
        raise HTTPException(503, "Server busy — try again in a minute")

    # Mark job as running again
    databases.update_document(DB, "jobs", job_id, {
        "status": "running",
        "errorMessage": None,
    })

    # Notify frontend to reset agent states and job status
    publish(job_id, "job_refining", {"feedback": feedback[:200]})

    # Spawn refinement task
    asyncio.create_task(
        run_refine_task(
            job_id=job_id,
            user_id=user["id"],
            original_prompt=job.get("rawText", ""),
            feedback=feedback,
            repo_name=job.get("repoName", "project"),
            repo_private=job.get("repoPrivate", False),
        )
    )

    return {"status": "refining", "job_id": job_id}


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
                             repo_name, repo_private, retention_days,
                             model_preference=None):
  async with GlobalSemaphore():
    try:
      providers = get_user_llm_providers(user_id)
      if not providers:
          raise ValueError("No valid LLM API keys found. Add keys in Settings and try again.")
      llm = LLMRouter(providers, preferred_provider=model_preference)
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

      # Collect token usage from the LLM router
      usage = llm.token_usage
      token_usage_str = (
          f"in={usage['input_tokens']} out={usage['output_tokens']} "
          f"total={usage['total_tokens']} calls={usage['llm_calls']}"
      )

      databases.update_document(DB, "jobs", job_id, {
          "status": final_status,
          "githubUrl": result.get("github_url", ""),
          "completedAt": datetime.now(timezone.utc).isoformat(),
          "errorMessage": error_msg,
      })
      log.info(f"Pipeline done job={job_id} status={final_status} {token_usage_str}")
      if result.get("errors"):
          publish(job_id, "job_failed", {"error": error_msg or "Some agents failed", "last_agent": "unknown"})
      else:
          publish(job_id, "job_complete", {
              "github_url": result.get("github_url"),
              "zip_file_id": result.get("zip_file_id"),
              "repo_name": repo_name,
              "token_usage": usage,
              "architecture_mermaid": result.get("architecture_mermaid"),
              "readme_content": result.get("readme_content"),
              "pitch_slides": result.get("pitch_slides"),
          })
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


# ── Background task: run_refine_task ─────────────────────────

async def run_refine_task(job_id, user_id, original_prompt, feedback,
                          repo_name, repo_private):
  """Re-run agents with feedback; ensure analysis/architecture context is present."""
  from src.agents.refine_graph import refine_pipeline
  from src.agents.analyst import analyst
  from src.agents.architect import architect

  async with GlobalSemaphore():
    try:
      providers = get_user_llm_providers(user_id)
      if not providers:
          raise ValueError("No valid LLM API keys found.")
      llm = LLMRouter(providers)

      # Re-fetch the job to get existing agent-run data for architectural context
      job = databases.get_document(DB, "jobs", job_id)

      # Build state with feedback injected
      combined_prompt = (
          f"{original_prompt}\n\n"
          f"--- USER REFINEMENT FEEDBACK ---\n"
          f"{feedback}\n"
          f"--- END FEEDBACK ---\n\n"
          f"Please regenerate the code incorporating the feedback above. "
          f"Keep the same architecture and API contracts."
      )

      state = normalize_to_initial_state(combined_prompt, "text", job_id, user_id)
      state["llm"] = llm
      state["repo_name"] = repo_name
      state["repo_private"] = repo_private
      state["github_url"] = job.get("githubUrl", "")
      state["retry_count"] = 0

      # Pre-populate analyst + architect outputs from previous run
      # (fetch from agent-runs so the coding agents have context)
      try:
          runs = databases.list_documents(
              DB, "agent-runs",
              [Query.equal("jobId", job_id), Query.order_asc("startedAt")],
          )
          for run in runs.get("documents", []):
              # Reset status so events render properly
              databases.update_document(DB, "agent-runs", run["$id"], {
                  "status": "pending",
              })
      except Exception:
          pass

      # Rebuild prerequisite context so coding agents always have api_contracts.
      analyst_out = await analyst(state)
      if analyst_out.get("errors"):
          raise ValueError("; ".join(analyst_out["errors"]))
      state.update(analyst_out)

      architect_out = await architect(state)
      if architect_out.get("errors"):
          raise ValueError("; ".join(architect_out["errors"]))
      state.update(architect_out)

      # Run the refinement pipeline (coding agents → integrator → validator → github)
      try:
          result = await asyncio.wait_for(
              refine_pipeline.ainvoke(state),
              timeout=PIPELINE_TIMEOUT_SECONDS,
          )
      except asyncio.TimeoutError:
          raise TimeoutError("Refinement timed out")

      final_status = "failed" if result.get("errors") else "completed"
      error_msg = "; ".join(result.get("errors", [])[:3]) if result.get("errors") else None

      usage = llm.token_usage
      token_usage_str = (
          f"in={usage['input_tokens']} out={usage['output_tokens']} "
          f"total={usage['total_tokens']} calls={usage['llm_calls']}"
      )

      databases.update_document(DB, "jobs", job_id, {
          "status": final_status,
          "githubUrl": result.get("github_url", ""),
          "completedAt": datetime.now(timezone.utc).isoformat(),
          "errorMessage": error_msg,
      })
      log.info(f"Refinement done job={job_id} status={final_status} {token_usage_str}")
      if result.get("errors"):
          publish(job_id, "job_failed", {"error": error_msg or "Refinement failed", "last_agent": "unknown"})
    except Exception as e:
      log.error(f"Refinement failed job={job_id}: {type(e).__name__}: {e}", exc_info=True)
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
