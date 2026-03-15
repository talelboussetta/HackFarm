"""
HackFarmer — LangGraph StateGraph definition.

Topology (from .cursorrules):
  analyst → architect → [frontend_agent + backend_agent + business_agent] (parallel)
  → integrator → validator → conditional:
    score >= 70 OR retry_count >= 3 → github_agent → END
    score < 70 AND retry_count < 3  → integrator (retry_count += 1)
"""

import logging

from langgraph.graph import StateGraph, END

from src.agents.state import ProjectState
from src.agents.analyst import analyst
from src.agents.architect import architect
from src.agents.frontend_agent import frontend_agent
from src.agents.backend_agent import backend_agent
from src.agents.business_agent import business_agent
from src.agents.integrator import integrator
from src.agents.validator import validator
from src.agents.github_agent import github_agent

logger = logging.getLogger(__name__)


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
