"""
HackFarmer — Architect agent.
Reads project_name, mvp_features, constraints, domain from state,
calls LLM with architect.txt prompt, returns architecture fields only.
"""

import json
import logging
import re
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

_DEFAULT_TECH_STACK = {
    "frontend": "React + Vite",
    "backend": "FastAPI",
    "database": "SQLite",
    "auth": "JWT",
}


async def architect(state: ProjectState) -> dict:
    job_id = state["job_id"]
    try:
        return await _architect_impl(state)
    except Exception as e:
        log.error(f"architect CRASHED: {type(e).__name__}: {e}", exc_info=True)
        publish(job_id, "agent_failed", {"agent": "architect", "error": f"Unexpected: {e}"})
        return {"errors": [f"architect: {type(e).__name__}: {e}"]}


async def _architect_impl(state: ProjectState) -> dict:
    job_id = state["job_id"]

    # Step 1: publish agent_start
    publish(job_id, "agent_start", {
        "agent": "architect",
        "message": "Designing system architecture...",
        "estimated_seconds": 25,
    })

    # Step 2: create AgentRun document in Appwrite
    agent_run_id = None
    try:
        doc = databases.create_document(DB, "agent-runs", ID.unique(), {
            "jobId": job_id,
            "agentName": "architect",
            "status": "running",
            "retryCount": 0,
            "runDuration": 0,
            "outputFormat": "json",
            "startedAt": datetime.now(timezone.utc).isoformat(),
        })
        agent_run_id = doc["$id"]
    except Exception as e:
        log.warning(f"Failed to create agent-run doc: {e}")

    # Step 3: load architect.txt and fill placeholders
    prompt_path = Path(__file__).parent.parent / "llm" / "prompts" / "architect.txt"
    template = prompt_path.read_text()
    mvp_str = json.dumps(state["mvp_features"], indent=2)[:3000]
    constraints_str = json.dumps(state["constraints"], indent=2)[:1000]
    prompt = (
        template
        .replace("{project_name}", state["project_name"])
        .replace("{mvp_features}", mvp_str)
        .replace("{constraints}", constraints_str)
        .replace("{domain}", state["domain"])
    )

    # Step 4: publish agent_thinking
    publish(job_id, "agent_thinking", {
        "agent": "architect",
        "message": "Designing API surface...",
    })

    # Step 5: call LLM with timeout + retry (temperature=0.3 — consistency over creativity)
    raw = None
    max_retries = 2
    for attempt in range(max_retries):
        try:
            publish(job_id, "agent_thinking", {
                "agent": "architect",
                "message": f"Calling LLM (attempt {attempt + 1})..." if attempt > 0 else "Calling LLM for architecture design...",
            })
            raw = await asyncio.wait_for(
                state["llm"].complete(prompt, response_format="json", temperature=0.3, agent_name="architect"),
                timeout=120,
            )
            publish(job_id, "agent_thinking", {
                "agent": "architect",
                "message": f"LLM responded ({len(raw)} chars), parsing architecture...",
            })
            break
        except asyncio.TimeoutError:
            log.warning(f"architect: LLM call timed out (attempt {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                publish(job_id, "agent_thinking", {
                    "agent": "architect",
                    "message": f"Retrying architecture design (attempt {attempt + 2})...",
                })
                continue
            publish(job_id, "agent_failed", {
                "agent": "architect", "error": "LLM call timed out after retries", "retry_count": max_retries,
            })
            if agent_run_id:
                try:
                    databases.update_document(DB, "agent-runs", agent_run_id, {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    pass
            return {"errors": ["architect: LLM timed out"]}
        except Exception as e:
            publish(job_id, "agent_failed", {
                "agent": "architect", "error": str(e), "retry_count": attempt,
            })
            if agent_run_id:
                try:
                    databases.update_document(DB, "agent-runs", agent_run_id, {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    pass
            return {"errors": [f"architect: {e}"]}

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
        error_msg = "architect: LLM returned non-JSON response"
        publish(job_id, "agent_failed", {
            "agent": "architect", "error": error_msg, "retry_count": 0,
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
    tech_stack = data.get("tech_stack", _DEFAULT_TECH_STACK)
    # api_contracts is now IMMUTABLE — no downstream agent may modify this field
    api_contracts = data.get("api_contracts", {})
    component_map = data.get("component_map", {"frontend": [], "backend": []})
    database_schema = data.get("database_schema", {})
    endpoint_count = len(api_contracts)
    component_count = len(component_map.get("frontend", [])) + len(component_map.get("backend", []))

    # Step 8: publish detailed thinking updates
    publish(job_id, "agent_thinking", {
        "agent": "architect",
        "message": f"Tech stack: {tech_stack.get('frontend', '?')} + {tech_stack.get('backend', '?')} + {tech_stack.get('database', '?')}",
    })

    if api_contracts:
        endpoints_str = ", ".join(list(api_contracts.keys())[:4])
        publish(job_id, "agent_thinking", {
            "agent": "architect",
            "message": f"API endpoints ({endpoint_count}): {endpoints_str}",
        })

    fe_components = component_map.get("frontend", [])
    be_components = component_map.get("backend", [])
    if fe_components:
        fe_str = ", ".join([c.split("/")[-1] for c in fe_components[:4]])
        publish(job_id, "agent_thinking", {
            "agent": "architect",
            "message": f"Frontend components ({len(fe_components)}): {fe_str}",
        })
    if be_components:
        be_str = ", ".join([c.split("/")[-1] for c in be_components[:4]])
        publish(job_id, "agent_thinking", {
            "agent": "architect",
            "message": f"Backend modules ({len(be_components)}): {be_str}",
        })

    if database_schema:
        tables_str = ", ".join(list(database_schema.keys())[:5])
        publish(job_id, "agent_thinking", {
            "agent": "architect",
            "message": f"Database tables ({len(database_schema)}): {tables_str}",
        })

    # Step 9: update AgentRun + publish agent_done
    if agent_run_id:
        try:
            databases.update_document(DB, "agent-runs", agent_run_id, {
                "status": "completed",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "outputSummary": f"Designed {endpoint_count} endpoints, {component_count} components",
            })
        except Exception as e:
            log.warning(f"Failed to update agent-run doc: {e}")

    publish(job_id, "agent_done", {
        "agent": "architect",
        "summary": f"Designed {endpoint_count} endpoints, {component_count} components",
        "tech_stack": tech_stack,
        "endpoint_count": endpoint_count,
        "component_count": component_count,
        "api_endpoints": list(api_contracts.keys())[:8],
        "database_tables": list(database_schema.keys()),
    })

    # Step 10: return ONLY the fields this agent sets
    return {
        "tech_stack": tech_stack,
        "api_contracts": api_contracts,
        "component_map": component_map,
        "database_schema": database_schema,
    }
