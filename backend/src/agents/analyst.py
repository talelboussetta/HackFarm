"""
HackFarmer — Analyst agent.
Reads raw_text from state, calls LLM with analyst.txt prompt,
parses JSON response, returns dict of changed fields only.
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


async def analyst(state: ProjectState) -> dict:
    job_id = state["job_id"]
    try:
        return await _analyst_impl(state)
    except Exception as e:
        log.error(f"analyst CRASHED: {type(e).__name__}: {e}", exc_info=True)
        publish(job_id, "agent_failed", {"agent": "analyst", "error": f"Unexpected: {e}"})
        return {"errors": state.get("errors", []) + [f"analyst: {type(e).__name__}: {e}"]}


async def _analyst_impl(state: ProjectState) -> dict:
    job_id = state["job_id"]

    # Step 1: publish agent_start
    publish(job_id, "agent_start", {
        "agent": "analyst",
        "message": "Reading your specification...",
        "estimated_seconds": 20,
    })

    # Step 2: create AgentRun document in Appwrite
    agent_run_id = None
    try:
        doc = databases.create_document(DB, "agent-runs", ID.unique(), {
            "jobId": job_id,
            "agentName": "analyst",
            "status": "running",
            "retryCount": 0,
            "runDuration": 0,
            "outputFormat": "json",
            "startedAt": datetime.now(timezone.utc).isoformat(),
        })
        agent_run_id = doc["$id"]
    except Exception as e:
        log.warning(f"Failed to create agent-run doc: {e}")

    # Step 3: load analyst.txt, fill {raw_text} placeholder
    prompt_path = Path(__file__).parent.parent / "llm" / "prompts" / "analyst.txt"
    template = prompt_path.read_text()
    prompt = template.replace("{raw_text}", state["raw_text"][:8000])

    # Step 4: publish agent_thinking
    publish(job_id, "agent_thinking", {
        "agent": "analyst",
        "message": "Extracting features and constraints...",
    })

    # Step 5: call LLM with timeout + retry
    raw = None
    max_retries = 2
    for attempt in range(max_retries):
        try:
            publish(job_id, "agent_thinking", {
                "agent": "analyst",
                "message": f"Calling LLM (attempt {attempt + 1})..." if attempt > 0 else "Calling LLM to analyze specification...",
            })
            raw = await asyncio.wait_for(
                state["llm"].complete(prompt, response_format="json", agent_name="analyst"),
                timeout=120,
            )
            publish(job_id, "agent_thinking", {
                "agent": "analyst",
                "message": f"LLM responded ({len(raw)} chars), parsing JSON...",
            })
            break
        except asyncio.TimeoutError:
            log.warning(f"analyst: LLM call timed out (attempt {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                publish(job_id, "agent_thinking", {
                    "agent": "analyst",
                    "message": f"LLM timed out, retrying (attempt {attempt + 2})...",
                })
                continue
            publish(job_id, "agent_failed", {
                "agent": "analyst", "error": "LLM call timed out after retries", "retry_count": max_retries,
            })
            if agent_run_id:
                try:
                    databases.update_document(DB, "agent-runs", agent_run_id, {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    pass
            return {"errors": state.get("errors", []) + ["analyst: LLM timed out"]}
        except Exception as e:
            publish(job_id, "agent_failed", {
                "agent": "analyst", "error": str(e), "retry_count": attempt,
            })
            if agent_run_id:
                try:
                    databases.update_document(DB, "agent-runs", agent_run_id, {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    pass
            return {"errors": state.get("errors", []) + [f"analyst: {e}"]}

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
        error_msg = "analyst: LLM returned non-JSON response"
        publish(job_id, "agent_failed", {
            "agent": "analyst", "error": error_msg, "retry_count": 0,
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
    project_name = data.get("project_name", "Unnamed Project")
    problem_statement = data.get("problem_statement", "")
    mvp_features = data.get("mvp_features", [])
    judging_criteria = data.get("judging_criteria", [])
    constraints = data.get("constraints", [])
    domain = data.get("domain", "other")

    # Step 8: publish detailed thinking updates with extracted data
    publish(job_id, "agent_thinking", {
        "agent": "analyst",
        "message": f"Project: \"{project_name}\" | Domain: {domain}",
    })

    if mvp_features:
        features_str = ", ".join(mvp_features[:5])
        publish(job_id, "agent_thinking", {
            "agent": "analyst",
            "message": f"MVP Features ({len(mvp_features)}): {features_str}",
        })

    if constraints:
        constraints_str = ", ".join(constraints[:3])
        publish(job_id, "agent_thinking", {
            "agent": "analyst",
            "message": f"Constraints: {constraints_str}",
        })

    if judging_criteria:
        criteria_str = ", ".join(judging_criteria[:3])
        publish(job_id, "agent_thinking", {
            "agent": "analyst",
            "message": f"Judging criteria: {criteria_str}",
        })

    # Step 9: update AgentRun + publish agent_done
    if agent_run_id:
        try:
            databases.update_document(DB, "agent-runs", agent_run_id, {
                "status": "done",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "outputSummary": f"Found {len(mvp_features)} features, domain: {domain}",
            })
        except Exception as e:
            log.warning(f"Failed to update agent-run doc: {e}")

    publish(job_id, "agent_done", {
        "agent": "analyst",
        "summary": f"Extracted {len(mvp_features)} MVP features across {domain} domain",
        "mvp_features": mvp_features,
        "project_name": project_name,
        "domain": domain,
        "constraints": constraints,
        "judging_criteria": judging_criteria,
    })

    # Step 10: return ONLY the fields this agent sets
    return {
        "project_name": project_name,
        "problem_statement": problem_statement,
        "mvp_features": mvp_features,
        "judging_criteria": judging_criteria,
        "constraints": constraints,
        "domain": domain,
    }
