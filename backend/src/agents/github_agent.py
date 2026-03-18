"""
HackFarmer — GitHub push agent.
Creates a GitHub repo, pushes all generated files, builds ZIP,
uploads ZIP to Appwrite Storage, and emits job_complete.
"""

import logging
from datetime import datetime, timezone
from io import BytesIO

from appwrite.input_file import InputFile
from appwrite.id import ID

import sentry_sdk
from src.agents.state import ProjectState
from src.appwrite_client import databases, storage, users_service
from src.core.config import settings
from src.core.events import publish
from src.core.zip_builder import build_zip
from src.integrations.github import GitHubClient

log = logging.getLogger(__name__)
DB = settings.APPWRITE_DATABASE_ID


async def github_agent(state: ProjectState) -> dict:
    job_id = state["job_id"]
    try:
        return await _github_agent_impl(state)
    except Exception as e:
        sentry_sdk.set_tag("agent", "github_agent")
        sentry_sdk.capture_exception(e)
        log.error(f"github_agent CRASHED: {type(e).__name__}: {e}", exc_info=True)
        publish(job_id, "agent_failed", {"agent": "github_agent", "error": f"Unexpected: {e}"})
        return {"errors": [f"github_agent: {type(e).__name__}: {e}"]}


async def _github_agent_impl(state: ProjectState) -> dict:
    job_id = state["job_id"]
    user_id = state["user_id"]

    # Step 1: publish agent_start
    publish(job_id, "agent_start", {
        "agent": "github_agent",
        "message": "Pushing to GitHub...",
        "estimated_seconds": 20,
    })

    # Step 2: create AgentRun document
    agent_run_id = None
    try:
        doc = databases.create_document(DB, "agent-runs", ID.unique(), {
            "jobId": job_id,
            "agentName": "github_agent",
            "status": "running",
            "retryCount": 0,
            "runDuration": 0,
            "outputFormat": "json",
            "startedAt": datetime.now(timezone.utc).isoformat(),
        })
        agent_run_id = doc["$id"]
    except Exception as e:
        sentry_sdk.set_tag("agent", "github_agent")
        sentry_sdk.capture_exception(e)
        log.warning(f"Failed to create agent-run doc: {e}")

    # Step 3: retrieve GitHub token from Appwrite identities
    try:
        from appwrite.query import Query as AQ
        identities = users_service.list_identities(
            queries=[AQ.equal("userId", user_id)]
        )
        github_identity = next(
            (i for i in identities["identities"] if i["provider"] == "github"),
            None
        )
        if not github_identity:
            raise ValueError("No GitHub identity found for user")
        token = github_identity.get("providerAccessToken", "")
        if not token:
            raise ValueError(
                "GitHub token not available — user must re-authenticate "
                "with GitHub OAuth scope including repo access."
            )
        appwrite_user = users_service.get(user_id)
        raw_name = appwrite_user.get("name", "").strip()
        username = raw_name.split()[0].lower() if raw_name else user_id[:20]
    except Exception as e:
        sentry_sdk.set_tag("agent", "github_agent")
        sentry_sdk.capture_exception(e)
        error_msg = f"github_agent: Failed to retrieve GitHub credentials: {e}"
        publish(job_id, "agent_failed", {
            "agent": "github_agent", "error": error_msg, "retry_count": 0,
        })
        if agent_run_id:
            try:
                databases.update_document(DB, "agent-runs", agent_run_id, {
                    "status": "failed",
                    "completedAt": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                pass
        return {"errors": [error_msg]}

    publish(job_id, "agent_thinking", {
        "agent": "github_agent",
        "message": f"Retrieved GitHub token for user, creating repo...",
    })

    client = GitHubClient(token, username)
    repo_name = state.get("repo_name", state.get("project_name", "hackathon-project"))
    repo_private = state.get("repo_private", False)
    project_name = state.get("project_name", repo_name)
    existing_github_url = (state.get("github_url") or "").strip()

    # Step 4: create repo (or reuse existing repo during refine)
    full_name = None
    github_url = None
    if "github.com/" in existing_github_url:
        tail = existing_github_url.split("github.com/", 1)[1].strip("/")
        parts = tail.split("/")
        if len(parts) >= 2:
            full_name = f"{parts[0]}/{parts[1]}"
            github_url = f"https://github.com/{full_name}"
            publish(job_id, "agent_thinking", {
                "agent": "github_agent",
                "message": f"Reusing existing repository {full_name}...",
            })

    if not full_name:
        publish(job_id, "agent_thinking", {
            "agent": "github_agent",
            "message": "Creating repository...",
        })
        try:
            full_name = await client.create_repo(
                name=repo_name,
                description=f"{project_name} — generated by HackFarmer",
                private=repo_private,
            )
            github_url = f"https://github.com/{full_name}"
        except Exception as e:
            sentry_sdk.set_tag("agent", "github_agent")
            sentry_sdk.capture_exception(e)
            error_msg = f"github_agent: Failed to create repo: {e}"
            publish(job_id, "agent_failed", {
                "agent": "github_agent", "error": error_msg, "retry_count": 0,
            })
            if agent_run_id:
                try:
                    databases.update_document(DB, "agent-runs", agent_run_id, {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    pass
            return {"errors": [error_msg]}

    # Step 5: push all generated files + README.md
    all_files = dict(state.get("generated_files", {}))
    readme = state.get("readme_content", "")
    refinement_feedback = (state.get("refinement_feedback") or "").strip()
    if existing_github_url and refinement_feedback:
        try:
            existing_readme = await client.get_file_content(full_name, "README.md")
        except Exception:
            existing_readme = None
        if existing_readme:
            all_files["README.md"] = (
                existing_readme.rstrip()
                + "\n\n## Refinement Update\n\n"
                + refinement_feedback
                + "\n"
            )
        elif readme:
            all_files["README.md"] = readme
    elif readme:
        all_files["README.md"] = readme

    publish(job_id, "agent_thinking", {
        "agent": "github_agent",
        "message": f"Pushing {len(all_files)} files...",
    })

    try:
        commit_sha = await client.push_files(
            repo=full_name,
            files=all_files,
            message="Refinement update — generated by HackFarmer 🚜" if existing_github_url else "Initial commit — generated by HackFarmer 🚜",
        )
    except Exception as e:
        sentry_sdk.set_tag("agent", "github_agent")
        sentry_sdk.capture_exception(e)
        error_msg = f"github_agent: Failed to push files: {e}"
        publish(job_id, "agent_failed", {
            "agent": "github_agent", "error": error_msg, "retry_count": 0,
        })
        if agent_run_id:
            try:
                databases.update_document(DB, "agent-runs", agent_run_id, {
                    "status": "failed",
                    "completedAt": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                pass
        return {
            "github_url": github_url,
            "errors": [error_msg],
        }

    publish(job_id, "agent_thinking", {
        "agent": "github_agent",
        "message": f"✓ Pushed {len(all_files)} files to {full_name} (commit: {commit_sha[:8] if commit_sha else '?'})",
    })

    # Step 6: build ZIP and upload to Appwrite Storage
    publish(job_id, "agent_thinking", {
        "agent": "github_agent",
        "message": "Building ZIP archive...",
    })
    zip_file_id = None
    try:
        zip_bytes = build_zip(job_id, all_files)
        result = storage.create_file(
            bucket_id=settings.APPWRITE_ZIP_BUCKET_ID,
            file_id=ID.unique(),
            file=InputFile.from_bytes(zip_bytes, filename=f"{repo_name}.zip"),
        )
        zip_file_id = result["$id"]
    except Exception as e:
        sentry_sdk.set_tag("agent", "github_agent")
        sentry_sdk.capture_exception(e)
        log.warning(f"ZIP upload failed (non-fatal): {e}")

    # Step 7: update job document
    try:
        update_data = {
            "status": "completed",
            "githubUrl": github_url,
            "completedAt": datetime.now(timezone.utc).isoformat(),
        }
        databases.update_document(DB, "jobs", job_id, update_data)
    except Exception as e:
        sentry_sdk.set_tag("agent", "github_agent")
        sentry_sdk.capture_exception(e)
        log.warning(f"Job update failed: {e}")

    # Step 8: update AgentRun + emit job_complete
    if agent_run_id:
        try:
            databases.update_document(DB, "agent-runs", agent_run_id, {
                "status": "completed",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "outputSummary": f"Pushed {len(all_files)} files to {full_name}",
            })
        except Exception as e:
            sentry_sdk.set_tag("agent", "github_agent")
            sentry_sdk.capture_exception(e)
            log.warning(f"Failed to update agent-run doc: {e}")

    publish(job_id, "job_complete", {
        "github_url": github_url,
        "zip_file_id": zip_file_id or "",
        "file_count": len(all_files),
        "validation_score": state.get("validation_score", 0),
        "architecture_mermaid": state.get("architecture_mermaid", ""),
        "readme_content": state.get("readme_content", ""),
        "pitch_slides": state.get("pitch_slides", []),
    })

    return {
        "github_url": github_url,
        "status": "completed",
    }
