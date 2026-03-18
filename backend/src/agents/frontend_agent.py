"""
HackFarmer — Frontend code-gen agent.
Reads api_contracts and component_map from state, calls LLM to generate React files.
"""

import json
import logging
import re
import asyncio
from datetime import datetime, timezone
from pathlib import Path

import sentry_sdk
from src.agents.state import ProjectState
from appwrite.id import ID
from src.appwrite_client import databases
from src.core.config import settings
from src.core.events import publish

log = logging.getLogger(__name__)
DB = settings.APPWRITE_DATABASE_ID


async def frontend_agent(state: ProjectState) -> dict:
    job_id = state["job_id"]
    try:
        return await _frontend_agent_impl(state)
    except Exception as e:
        sentry_sdk.set_tag("agent", "frontend_agent")
        sentry_sdk.capture_exception(e)
        log.error(f"frontend_agent CRASHED: {type(e).__name__}: {e}", exc_info=True)
        publish(job_id, "agent_failed", {"agent": "frontend_agent", "error": f"Unexpected: {e}"})
        return {"errors": [f"frontend_agent: {type(e).__name__}: {e}"]}


async def _frontend_agent_impl(state: ProjectState) -> dict:
    job_id = state["job_id"]

    # Step 1: publish agent_start
    publish(job_id, "agent_start", {
        "agent": "frontend_agent",
        "message": "Generating frontend code...",
        "estimated_seconds": 30,
    })

    if not state.get("api_contracts"):
        publish(job_id, "agent_failed", {
            "agent": "frontend_agent",
            "error": "api_contracts missing — architect must run first",
        })
        return {"errors": ["frontend_agent: api_contracts missing"]}

    # Step 2: create AgentRun document
    agent_run_id = None
    try:
        doc = databases.create_document(DB, "agent-runs", ID.unique(), {
            "jobId": job_id,
            "agentName": "frontend_agent",
            "status": "running",
            "retryCount": 0,
            "runDuration": 0,
            "outputFormat": "json",
            "startedAt": datetime.now(timezone.utc).isoformat(),
        })
        agent_run_id = doc["$id"]
    except Exception as e:
        sentry_sdk.set_tag("agent", "frontend_agent")
        sentry_sdk.capture_exception(e)
        log.warning(f"Failed to create agent-run doc: {e}")

    # Step 3: load prompt and fill placeholders
    prompt_path = Path(__file__).parent.parent / "llm" / "prompts" / "frontend_agent.txt"
    template = prompt_path.read_text()
    fe_components = state.get("component_map", {}).get("frontend", [])
    prompt = (
        template
        .replace("{api_contracts}", json.dumps(state["api_contracts"], indent=2)[:4000])
        .replace("{component_map}", json.dumps(fe_components, indent=2))
        .replace("{tech_stack}", state.get("tech_stack", {}).get("frontend", "React + Vite"))
    )

    # Step 4: publish thinking events
    publish(job_id, "agent_thinking", {
        "agent": "frontend_agent",
        "message": f"Planning {len(fe_components)} frontend components...",
    })
    if fe_components:
        comp_str = ", ".join([c.split("/")[-1] for c in fe_components[:5]])
        publish(job_id, "agent_thinking", {
            "agent": "frontend_agent",
            "message": f"Components to generate: {comp_str}",
        })

    # Step 5: call LLM with timeout + retry
    raw = None
    max_retries = 2
    for attempt in range(max_retries):
        try:
            publish(job_id, "agent_thinking", {
                "agent": "frontend_agent",
                "message": f"Calling LLM (attempt {attempt + 1})..." if attempt > 0 else "Calling LLM to generate React code...",
            })
            raw = await asyncio.wait_for(
                state["llm"].complete(prompt, response_format="json", temperature=0.3, agent_name="frontend_agent"),
                timeout=120,
            )
            publish(job_id, "agent_thinking", {
                "agent": "frontend_agent",
                "message": f"LLM responded ({len(raw)} chars), parsing files...",
            })
            break
        except asyncio.TimeoutError:
            log.warning(f"frontend_agent: LLM call timed out (attempt {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                publish(job_id, "agent_thinking", {
                    "agent": "frontend_agent",
                    "message": f"LLM timed out, retrying (attempt {attempt + 2})...",
                })
                continue
            publish(job_id, "agent_failed", {
                "agent": "frontend_agent", "error": "LLM call timed out after retries", "retry_count": max_retries,
            })
            if agent_run_id:
                try:
                    databases.update_document(DB, "agent-runs", agent_run_id, {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    pass
            return {"errors": ["frontend_agent: LLM timed out"]}
        except Exception as e:
            sentry_sdk.set_tag("agent", "frontend_agent")
            sentry_sdk.capture_exception(e)
            publish(job_id, "agent_failed", {
                "agent": "frontend_agent", "error": str(e), "retry_count": attempt,
            })
            if agent_run_id:
                try:
                    databases.update_document(DB, "agent-runs", agent_run_id, {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    pass
            return {"errors": [f"frontend_agent: {e}"]}

    publish(job_id, "agent_thinking", {
        "agent": "frontend_agent",
        "message": "Generating component files...",
    })

    # Step 6: parse JSON safely
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except json.JSONDecodeError:
                data = None
        else:
            data = None

    if data is None:
        error_msg = "frontend_agent: LLM returned non-JSON response"
        publish(job_id, "agent_failed", {
            "agent": "frontend_agent", "error": error_msg, "retry_count": 0,
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

    # Step 7: extract files — only keep frontend/ paths
    raw_files = data.get("files", data)
    if not isinstance(raw_files, dict):
        raw_files = {}
    generated_files = {
        k: v for k, v in raw_files.items()
        if k.startswith("frontend/") and isinstance(v, str)
    }

    file_count = len(generated_files)
    file_list = list(generated_files.keys())

    publish(job_id, "agent_thinking", {
        "agent": "frontend_agent",
        "message": f"Extracted {file_count} frontend files, validating paths...",
    })

    if file_list:
        files_str = ", ".join([f.split("/")[-1] for f in file_list[:6]])
        publish(job_id, "agent_thinking", {
            "agent": "frontend_agent",
            "message": f"Generated: {files_str}",
        })

    # Step 8: update AgentRun + publish agent_done
    if agent_run_id:
        try:
            databases.update_document(DB, "agent-runs", agent_run_id, {
                "status": "completed",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "outputSummary": f"Generated {file_count} files",
            })
        except Exception as e:
            sentry_sdk.set_tag("agent", "frontend_agent")
            sentry_sdk.capture_exception(e)
            log.warning(f"Failed to update agent-run doc: {e}")

    publish(job_id, "agent_done", {
        "agent": "frontend_agent",
        "summary": f"Generated {file_count} files",
        "files_generated": file_list,
    })

    return {"generated_files": generated_files}
