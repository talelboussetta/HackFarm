"""
HackFarmer — Frontend code-gen agent.
Reads api_contracts and component_map from state, calls LLM to generate React files.
"""

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path

from src.agents.state import ProjectState
from src.appwrite_client import databases
from src.core.config import settings
from src.core.events import publish

log = logging.getLogger(__name__)
DB = settings.APPWRITE_DATABASE_ID


async def frontend_agent(state: ProjectState) -> dict:
    job_id = state["job_id"]
    assert state.get("api_contracts"), "api_contracts missing — architect must run first"

    # Step 1: publish agent_start
    publish(job_id, "agent_start", {
        "agent": "frontend_agent",
        "message": "Generating frontend code...",
        "estimated_seconds": 30,
    })

    # Step 2: create AgentRun document
    agent_run_id = None
    try:
        doc = databases.create_document(DB, "agent-runs", "unique()", {
            "jobId": job_id,
            "agentName": "frontend_agent",
            "status": "running",
            "retryCount": 0,
            "startedAt": datetime.now(timezone.utc).isoformat(),
        })
        agent_run_id = doc["$id"]
    except Exception as e:
        log.warning(f"Failed to create agent-run doc: {e}")

    # Step 3: load prompt and fill placeholders
    prompt_path = Path(__file__).parent.parent / "llm" / "prompts" / "frontend_agent.txt"
    template = prompt_path.read_text()
    fe_components = state.get("component_map", {}).get("frontend", [])
    prompt = (
        template
        .replace("{api_contracts}", json.dumps(state["api_contracts"], indent=2))
        .replace("{component_map}", json.dumps(fe_components, indent=2))
        .replace("{tech_stack}", state.get("tech_stack", {}).get("frontend", "React + Vite"))
    )

    # Step 4: publish thinking events
    publish(job_id, "agent_thinking", {
        "agent": "frontend_agent",
        "message": "Generating App.jsx...",
    })

    # Step 5: call LLM
    try:
        raw = await state["llm"].complete(prompt, response_format="json", temperature=0.3)
    except RuntimeError as e:
        publish(job_id, "agent_failed", {
            "agent": "frontend_agent", "error": str(e), "retry_count": 0,
        })
        if agent_run_id:
            try:
                databases.update_document(DB, "agent-runs", agent_run_id, {
                    "status": "failed",
                    "completedAt": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                pass
        return {"errors": state.get("errors", []) + [f"frontend_agent: {e}"]}

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
        return {"errors": state.get("errors", []) + [error_msg]}

    # Step 7: extract files — only keep frontend/ paths
    raw_files = data.get("files", data)
    if not isinstance(raw_files, dict):
        raw_files = {}
    generated_files = {
        k: v for k, v in raw_files.items()
        if k.startswith("frontend/") and isinstance(v, str)
    }

    publish(job_id, "agent_thinking", {
        "agent": "frontend_agent",
        "message": "Finalizing imports...",
    })

    file_count = len(generated_files)
    file_list = list(generated_files.keys())

    # Step 8: update AgentRun + publish agent_done
    if agent_run_id:
        try:
            databases.update_document(DB, "agent-runs", agent_run_id, {
                "status": "done",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "outputSummary": f"Generated {file_count} files",
            })
        except Exception as e:
            log.warning(f"Failed to update agent-run doc: {e}")

    publish(job_id, "agent_done", {
        "agent": "frontend_agent",
        "summary": f"Generated {file_count} files",
        "files_generated": file_list,
    })

    return {"generated_files": generated_files}
