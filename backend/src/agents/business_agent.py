"""
HackFarmer — Business agent.
Generates README, pitch slides, and architecture Mermaid diagram.
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


async def business_agent(state: ProjectState) -> dict:
    job_id = state["job_id"]

    # Step 1: publish agent_start
    publish(job_id, "agent_start", {
        "agent": "business_agent",
        "message": "Writing README and pitch deck...",
        "estimated_seconds": 25,
    })

    # Step 2: create AgentRun document
    agent_run_id = None
    try:
        doc = databases.create_document(DB, "agent-runs", "unique()", {
            "jobId": job_id,
            "agentName": "business_agent",
            "status": "running",
            "retryCount": 0,
            "startedAt": datetime.now(timezone.utc).isoformat(),
        })
        agent_run_id = doc["$id"]
    except Exception as e:
        log.warning(f"Failed to create agent-run doc: {e}")

    # Step 3: load prompt and fill placeholders
    prompt_path = Path(__file__).parent.parent / "llm" / "prompts" / "business_agent.txt"
    template = prompt_path.read_text()
    prompt = (
        template
        .replace("{project_name}", state.get("project_name", "Unnamed Project"))
        .replace("{problem_statement}", state.get("problem_statement", ""))
        .replace("{mvp_features}", json.dumps(state.get("mvp_features", []), indent=2))
        .replace("{judging_criteria}", json.dumps(state.get("judging_criteria", []), indent=2))
        .replace("{tech_stack}", json.dumps(state.get("tech_stack", {}), indent=2))
    )

    # Step 4: publish thinking
    publish(job_id, "agent_thinking", {
        "agent": "business_agent",
        "message": "Writing README...",
    })

    # Step 5: call LLM
    try:
        raw = await state["llm"].complete(prompt, response_format="json", temperature=0.4)
    except RuntimeError as e:
        publish(job_id, "agent_failed", {
            "agent": "business_agent", "error": str(e), "retry_count": 0,
        })
        if agent_run_id:
            try:
                databases.update_document(DB, "agent-runs", agent_run_id, {
                    "status": "failed",
                    "completedAt": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                pass
        return {"errors": state.get("errors", []) + [f"business_agent: {e}"]}

    publish(job_id, "agent_thinking", {
        "agent": "business_agent",
        "message": "Building pitch narrative...",
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
        error_msg = "business_agent: LLM returned non-JSON response"
        publish(job_id, "agent_failed", {
            "agent": "business_agent", "error": error_msg, "retry_count": 0,
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

    # Step 7: extract fields with safe defaults
    readme_content = data.get("readme_content", f"# {state.get('project_name', 'Project')}\n")
    pitch_slides = data.get("pitch_slides", [])
    architecture_mermaid = data.get("architecture_mermaid", "graph TD\n  A[User] --> B[App]")

    if not isinstance(pitch_slides, list):
        pitch_slides = []

    slide_count = len(pitch_slides)

    # Step 8: update AgentRun + publish agent_done
    if agent_run_id:
        try:
            databases.update_document(DB, "agent-runs", agent_run_id, {
                "status": "done",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "outputSummary": f"Generated README, {slide_count} slides, architecture diagram",
            })
        except Exception as e:
            log.warning(f"Failed to update agent-run doc: {e}")

    publish(job_id, "agent_done", {
        "agent": "business_agent",
        "summary": f"Generated README, {slide_count} pitch slides, and architecture diagram",
        "readme_content": readme_content,
        "architecture_mermaid": architecture_mermaid,
        "pitch_slides": pitch_slides,
    })

    return {
        "readme_content": readme_content,
        "pitch_slides": pitch_slides,
        "architecture_mermaid": architecture_mermaid,
    }
