"""
HackFarmer — Refinement Pipeline.

A lighter pipeline that skips analyst + architect and re-runs the
coding agents with user feedback injected into the raw_text.

Topology:
  [frontend_agent + backend_agent + business_agent] (parallel)
  → integrator → validator → github_agent → END
"""

import logging

from langgraph.graph import StateGraph, END, START

from src.agents.state import ProjectState
from src.agents.frontend_agent import frontend_agent
from src.agents.backend_agent import backend_agent
from src.agents.business_agent import business_agent
from src.agents.integrator import integrator
from src.agents.validator import validator
from src.agents.github_agent import github_agent

logger = logging.getLogger(__name__)


# ── Build the refinement graph ───────────────────────────────

refine_graph = StateGraph(ProjectState)

refine_graph.add_node("frontend_agent", frontend_agent)
refine_graph.add_node("backend_agent", backend_agent)
refine_graph.add_node("business_agent", business_agent)
refine_graph.add_node("integrator", integrator)
refine_graph.add_node("validator", validator)
refine_graph.add_node("github_agent", github_agent)

# fan-out: entry → [frontend, backend, business]
refine_graph.add_edge(START, "frontend_agent")
refine_graph.add_edge(START, "backend_agent")
refine_graph.add_edge(START, "business_agent")

# fan-in → integrator → validator → github → END
refine_graph.add_edge("frontend_agent", "integrator")
refine_graph.add_edge("backend_agent", "integrator")
refine_graph.add_edge("business_agent", "integrator")
refine_graph.add_edge("integrator", "validator")
refine_graph.add_edge("validator", "github_agent")
refine_graph.add_edge("github_agent", END)

refine_pipeline = refine_graph.compile()
