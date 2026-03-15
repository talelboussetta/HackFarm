"""
HackFarmer — LangGraph StateGraph definition.

Topology (from .cursorrules):
  analyst → architect → [frontend_agent + backend_agent + business_agent] (parallel)
  → integrator → validator → conditional:
    score >= 70 OR retry_count >= 3 → github_agent → END
    score < 70 AND retry_count < 3  → integrator (retry_count += 1)
"""

import asyncio
import logging

from langgraph.graph import StateGraph, END

from src.agents.state import ProjectState
from src.core.events import publish

logger = logging.getLogger(__name__)


# ── Stub agent functions ─────────────────────────────────────
# Each emits events and returns only the fields it owns.

async def analyst(state: ProjectState) -> dict:
    job_id = state["job_id"]
    publish(job_id, "agent_start", {
        "agent": "analyst", "message": "Analyzing spec...", "estimated_seconds": 10
    })
    await asyncio.sleep(0.3)
    publish(job_id, "agent_done", {
        "agent": "analyst", "summary": "Found 2 features across 1 category"
    })
    return {
        "project_name": "Test Project",
        "problem_statement": "Test problem",
        "mvp_features": ["Feature 1", "Feature 2"],
        "judging_criteria": [],
        "constraints": [],
        "domain": "other",
    }


async def architect(state: ProjectState) -> dict:
    job_id = state["job_id"]
    publish(job_id, "agent_start", {
        "agent": "architect", "message": "Designing architecture...", "estimated_seconds": 15
    })
    await asyncio.sleep(0.3)
    publish(job_id, "agent_done", {
        "agent": "architect", "summary": "Designed 1 endpoint, 2 component groups"
    })
    return {
        "api_contracts": {"GET /api/health": {"description": "health check"}},
        "component_map": {"frontend": [], "backend": []},
        "tech_stack": {"frontend": "React", "backend": "FastAPI"},
        "database_schema": {},
    }


async def frontend_agent(state: ProjectState) -> dict:
    job_id = state["job_id"]
    publish(job_id, "agent_start", {
        "agent": "frontend_agent", "message": "Generating frontend...", "estimated_seconds": 20
    })
    await asyncio.sleep(0.3)
    publish(job_id, "agent_done", {
        "agent": "frontend_agent", "summary": "Generated 1 file",
        "files_generated": ["frontend/src/App.jsx"]
    })
    return {
        "generated_files": {"frontend/src/App.jsx": "// stub"},
    }


async def backend_agent(state: ProjectState) -> dict:
    job_id = state["job_id"]
    publish(job_id, "agent_start", {
        "agent": "backend_agent", "message": "Generating backend...", "estimated_seconds": 20
    })
    await asyncio.sleep(0.3)
    publish(job_id, "agent_done", {
        "agent": "backend_agent", "summary": "Generated 1 file",
        "files_generated": ["backend/main.py"]
    })
    return {
        "generated_files": {"backend/main.py": "# stub"},
    }


async def business_agent(state: ProjectState) -> dict:
    job_id = state["job_id"]
    publish(job_id, "agent_start", {
        "agent": "business_agent", "message": "Writing README and pitch...", "estimated_seconds": 15
    })
    await asyncio.sleep(0.3)
    publish(job_id, "agent_done", {
        "agent": "business_agent", "summary": "Generated README, pitch, and diagram"
    })
    return {
        "readme_content": "# Test Project\n\nStub README",
        "pitch_slides": [],
        "architecture_mermaid": "graph TD\n  A-->B",
    }


async def integrator(state: ProjectState) -> dict:
    job_id = state["job_id"]
    publish(job_id, "agent_start", {
        "agent": "integrator", "message": "Integrating files...", "estimated_seconds": 10
    })
    await asyncio.sleep(0.3)
    publish(job_id, "agent_done", {
        "agent": "integrator", "summary": "Added dependency files"
    })
    return {
        "generated_files": {"requirements.txt": "fastapi\nuvicorn"},
    }


async def validator(state: ProjectState) -> dict:
    job_id = state["job_id"]
    publish(job_id, "agent_start", {
        "agent": "validator", "message": "Validating output...", "estimated_seconds": 5
    })
    await asyncio.sleep(0.3)
    publish(job_id, "agent_done", {
        "agent": "validator", "summary": "Score: 85/100, 0 issues found"
    })
    return {
        "validation_score": 85,
        "validation_issues": [],
    }


async def github_agent(state: ProjectState) -> dict:
    job_id = state["job_id"]
    publish(job_id, "agent_start", {
        "agent": "github_agent", "message": "Pushing to GitHub...", "estimated_seconds": 10
    })
    await asyncio.sleep(0.3)
    publish(job_id, "job_complete", {
        "github_url": "https://github.com/stub/repo",
        "zip_path": "",
        "file_count": 3,
        "validation_score": state.get("validation_score", 0),
        "total_seconds": 5,
    })

    return {
        "github_url": "https://github.com/stub/repo",
        "status": "complete",
    }


# ── Conditional routing ──────────────────────────────────────

def route_after_validation(state: ProjectState) -> str:
    """Decide whether to push to GitHub or retry integration."""
    if state["validation_score"] >= 70 or state["retry_count"] >= 3:
        return "github_agent"
    return "integrator"


# ── Build the graph ──────────────────────────────────────────

graph = StateGraph(ProjectState)

# Add all agent nodes
graph.add_node("analyst", analyst)
graph.add_node("architect", architect)
graph.add_node("frontend_agent", frontend_agent)
graph.add_node("backend_agent", backend_agent)
graph.add_node("business_agent", business_agent)
graph.add_node("integrator", integrator)
graph.add_node("validator", validator)
graph.add_node("github_agent", github_agent)

# ── Edges ─────────────────────────────────────────────────────
# analyst → architect
graph.add_edge("analyst", "architect")

# architect → [frontend, backend, business] (parallel fan-out)
graph.add_edge("architect", "frontend_agent")
graph.add_edge("architect", "backend_agent")
graph.add_edge("architect", "business_agent")

# [frontend, backend, business] → integrator (fan-in)
graph.add_edge("frontend_agent", "integrator")
graph.add_edge("backend_agent", "integrator")
graph.add_edge("business_agent", "integrator")

# integrator → validator
graph.add_edge("integrator", "validator")

# validator → conditional
graph.add_conditional_edges(
    "validator",
    route_after_validation,
    {"github_agent": "github_agent", "integrator": "integrator"},
)

# github_agent → END
graph.add_edge("github_agent", END)

# Entry point
graph.set_entry_point("analyst")

# Compile
pipeline = graph.compile()
