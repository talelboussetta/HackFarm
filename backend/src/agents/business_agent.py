"""
HackFarmer — Business agent.
Generates README, pitch slides, and architecture Mermaid diagram.
"""

import json
import logging
import re
import bleach
import asyncio
from datetime import datetime, timezone
from pathlib import Path

from src.agents.state import ProjectState
from appwrite.id import ID
from src.appwrite_client import databases
from src.core.config import settings
from src.core.events import publish

log = logging.getLogger(__name__)
DB = settings.APPWRITE_DATABASE_ID


async def business_agent(state: ProjectState) -> dict:
    job_id = state["job_id"]
    try:
        return await _business_agent_impl(state)
    except Exception as e:
        log.error(f"business_agent CRASHED: {type(e).__name__}: {e}", exc_info=True)
        publish(job_id, "agent_failed", {"agent": "business_agent", "error": f"Unexpected: {e}"})
        return {"errors": [f"business_agent: {type(e).__name__}: {e}"]}


async def _business_agent_impl(state: ProjectState) -> dict:
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
        doc = databases.create_document(DB, "agent-runs", ID.unique(), {
            "jobId": job_id,
            "agentName": "business_agent",
            "status": "running",
            "retryCount": 0,
            "runDuration": 0,
            "outputFormat": "json",
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

    # Step 5: call LLM with timeout + retry
    raw = None
    max_retries = 2
    for attempt in range(max_retries):
        try:
            publish(job_id, "agent_thinking", {
                "agent": "business_agent",
                "message": f"Calling LLM (attempt {attempt + 1})..." if attempt > 0 else "Calling LLM to generate business docs...",
            })
            raw = await asyncio.wait_for(
                state["llm"].complete(prompt, response_format="json", temperature=0.4, agent_name="business_agent"),
                timeout=120,
            )
            publish(job_id, "agent_thinking", {
                "agent": "business_agent",
                "message": f"LLM responded ({len(raw)} chars), parsing documents...",
            })
            break
        except asyncio.TimeoutError:
            log.warning(f"business_agent: LLM call timed out (attempt {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                publish(job_id, "agent_thinking", {
                    "agent": "business_agent",
                    "message": f"LLM timed out, retrying (attempt {attempt + 2})...",
                })
                continue
            publish(job_id, "agent_failed", {
                "agent": "business_agent", "error": "LLM call timed out after retries", "retry_count": max_retries,
            })
            if agent_run_id:
                try:
                    databases.update_document(DB, "agent-runs", agent_run_id, {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    pass
            return {"errors": ["business_agent: LLM timed out"]}
        except Exception as e:
            publish(job_id, "agent_failed", {
                "agent": "business_agent", "error": str(e), "retry_count": attempt,
            })
            if agent_run_id:
                try:
                    databases.update_document(DB, "agent-runs", agent_run_id, {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    pass
            return {"errors": [f"business_agent: {e}"]}

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
        return {"errors": [error_msg]}

    # Step 7: extract fields with safe defaults
    readme_content = data.get("readme_content", f"# {state.get('project_name', 'Project')}\n")
    ALLOWED_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'br', 'a']
    readme_content = bleach.clean(readme_content, tags=ALLOWED_TAGS, strip=True)
    pitch_slides = data.get("pitch_slides", [])
    architecture_mermaid = data.get("architecture_mermaid", "graph TD\n  A[User] --> B[App]")

    if not isinstance(pitch_slides, list):
        pitch_slides = []

    for slide in pitch_slides:
        if isinstance(slide, dict):
            for field in ("title", "content", "speaker_notes"):
                if field in slide and isinstance(slide[field], str):
                    slide[field] = bleach.clean(slide[field], tags=ALLOWED_TAGS, strip=True)

    slide_count = len(pitch_slides)

    publish(job_id, "agent_thinking", {
        "agent": "business_agent",
        "message": f"README: {len(readme_content)} chars | Slides: {slide_count} | Architecture diagram: {'Yes' if architecture_mermaid else 'No'}",
    })
    if pitch_slides:
        slide_titles = ", ".join([s.get("title", "Untitled") for s in pitch_slides[:4] if isinstance(s, dict)])
        publish(job_id, "agent_thinking", {
            "agent": "business_agent",
            "message": f"Pitch slides: {slide_titles}",
        })

    # Step 8: update AgentRun + publish agent_done
    if agent_run_id:
        try:
            databases.update_document(DB, "agent-runs", agent_run_id, {
                "status": "completed",
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
