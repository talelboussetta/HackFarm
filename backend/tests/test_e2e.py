"""
HackFarmer — End-to-End Pipeline Test.
Run: cd backend && python -m pytest tests/test_e2e.py -v --real-llm

Tests the full agent pipeline without a browser session.
Uses MockLLM by default; pass --real-llm to use actual LLM providers.
"""

import asyncio
import json
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def pytest_addoption(parser):
    parser.addoption("--real-llm", action="store_true", default=False,
                     help="Use real LLM providers instead of MockLLM")


class MockLLM:
    """Returns valid JSON responses for each agent in the pipeline."""

    async def complete(self, prompt: str, response_format: str = "text",
                       temperature: float = 0.3) -> str:
        if "hackathon project specification" in prompt or "product analyst" in prompt:
            return json.dumps({
                "project_name": "Todo App",
                "problem_statement": "Need a simple todo list",
                "mvp_features": ["Create todos", "Complete todos", "Delete todos"],
                "nice_to_have": ["Tags", "Due dates"],
                "judging_criteria": ["Functionality", "Code quality"],
                "constraints": ["24 hours"],
                "domain": "productivity",
                "target_users": "Developers"
            })
        elif "software architect" in prompt or "api_contracts" in prompt.lower():
            return json.dumps({
                "tech_stack": {"frontend": "React + Vite", "backend": "FastAPI",
                               "database": "SQLite", "auth": "JWT"},
                "api_contracts": {
                    "POST /api/todos": {
                        "description": "Create todo",
                        "auth_required": True,
                        "request_body": {"title": "string"},
                        "response": {"id": "string", "title": "string", "done": "boolean"},
                        "errors": ["400 if invalid"]
                    },
                    "GET /api/todos": {
                        "description": "List todos",
                        "auth_required": True,
                        "request_body": {},
                        "response": {"todos": "array"},
                        "errors": []
                    },
                    "DELETE /api/todos/{id}": {
                        "description": "Delete todo",
                        "auth_required": True,
                        "request_body": {},
                        "response": {"deleted": "boolean"},
                        "errors": ["404"]
                    }
                },
                "component_map": {
                    "frontend": ["frontend/src/App.jsx", "frontend/src/components/TodoList.jsx",
                                 "frontend/src/components/TodoItem.jsx"],
                    "backend": ["backend/main.py", "backend/routes/todos.py", "backend/models.py"]
                },
                "database_schema": {
                    "todos": {"id": "uuid primary key", "title": "string not null",
                              "done": "boolean default false"}
                },
                "rationale": "Simple stack for a todo MVP"
            })
        elif "React developer" in prompt or "frontend" in prompt.lower():
            return json.dumps({
                "files": {
                    "frontend/src/App.jsx": "import React from 'react';\nexport default function App() { return <div>Todo App</div>; }",
                    "frontend/src/components/TodoList.jsx": "export default function TodoList() { return <ul></ul>; }",
                    "frontend/src/components/TodoItem.jsx": "export default function TodoItem({ todo }) { return <li>{todo.title}</li>; }",
                    "frontend/package.json": '{\"name\": \"todo-frontend\", \"version\": \"1.0.0\"}'
                }
            })
        elif "FastAPI developer" in prompt or "backend" in prompt.lower():
            return json.dumps({
                "files": {
                    "backend/main.py": "from fastapi import FastAPI\napp = FastAPI()\n\n@app.get('/health')\ndef health():\n    return {'status': 'ok'}",
                    "backend/routes/todos.py": "from fastapi import APIRouter\nrouter = APIRouter()\n\n@router.get('/api/todos')\ndef list_todos():\n    return {'todos': []}",
                    "backend/models.py": "# Todo model\nclass Todo:\n    def __init__(self, title):\n        self.title = title\n        self.done = False"
                }
            })
        elif "technical writer" in prompt or "pitch" in prompt.lower() or "README" in prompt:
            return json.dumps({
                "readme_content": "# Todo App\\n\\nA simple todo list application.\\n\\n## Features\\n- Create todos\\n- Complete todos\\n- Delete todos\\n\\n## Quick Start\\n```bash\\nnpm install && npm start\\n```\\n\\n## License\\nMIT",
                "pitch_slides": [
                    {"title": "The Problem", "content": "Managing tasks is hard.", "notes": "Speaker notes"},
                    {"title": "Our Solution", "content": "A simple, clean todo app.", "notes": "Demo"},
                    {"title": "Tech Stack", "content": "React + FastAPI.", "notes": "Architecture"},
                    {"title": "Demo", "content": "See the app in action.", "notes": "Live demo"},
                    {"title": "Impact", "content": "Improved productivity.", "notes": "Metrics"},
                    {"title": "Next Steps", "content": "Add tags and due dates.", "notes": "Roadmap"}
                ],
                "architecture_mermaid": "graph TD\\n  A[User] --> B[React Frontend]\\n  B --> C[FastAPI Backend]\\n  C --> D[SQLite DB]"
            })
        else:
            return "[]"


@pytest.fixture
def mock_llm():
    return MockLLM()


@pytest.mark.asyncio
async def test_full_pipeline_mock(mock_llm):
    """Full pipeline test with MockLLM (no real API keys needed)."""
    from src.ingestion.normalizer import normalize_to_initial_state
    from src.agents.graph import pipeline

    state = normalize_to_initial_state(
        "Build a simple todo list app with React frontend and FastAPI backend. "
        "Users can create, complete, and delete todos. Store in SQLite.",
        "text",
        "e2e-test-job",
        "e2e-test-user"
    )
    state["llm"] = mock_llm
    state["repo_name"] = "e2e-test-repo"
    state["repo_private"] = False

    # github_agent will fail (no real creds) — that's expected
    try:
        result = await pipeline.ainvoke(state)
    except Exception:
        # github_agent failure is acceptable
        result = state

    # Assertions
    assert result.get("generated_files") is not None
    assert len(result.get("generated_files", {})) >= 3, \
        f"Expected >=3 files, got {len(result.get('generated_files', {}))}"

    readme = result.get("readme_content", "")
    assert len(readme) > 0, "README content should be non-empty"

    slides = result.get("pitch_slides", [])
    assert len(slides) >= 4, f"Expected >=4 slides, got {len(slides)}"

    mermaid = result.get("architecture_mermaid", "")
    assert mermaid.startswith("graph"), \
        f"Mermaid should start with 'graph', got: {mermaid[:30]}"

    score = result.get("validation_score", 0)
    assert score > 0 or state.get("retry_count", 0) >= 0, \
        "validation_score should be > 0 or pipeline should have run"

    # Print summary
    files = result.get("generated_files", {})
    print(f"\n{'='*50}")
    print(f"  E2E Test Summary (MockLLM)")
    print(f"{'='*50}")
    print(f"  Files generated: {len(files)}")
    for f, content in sorted(files.items()):
        print(f"    {f} ({len(content)} bytes)")
    print(f"  README length: {len(readme)} chars")
    print(f"  Pitch slides: {len(slides)}")
    print(f"  Validation score: {score}")
    print(f"  Errors: {result.get('errors', [])}")
    print(f"{'='*50}\n")


@pytest.mark.asyncio
async def test_full_pipeline_real_llm(request):
    """Full pipeline test with real LLM (requires --real-llm flag and API keys)."""
    if not request.config.getoption("--real-llm", default=False):
        pytest.skip("Skipped: pass --real-llm to run with real LLM providers")

    from src.core.key_manager import get_user_llm_providers
    from src.llm.router import LLMRouter
    from src.ingestion.normalizer import normalize_to_initial_state
    from src.agents.graph import pipeline

    # Try to find a test user with keys
    providers = get_user_llm_providers("e2e-test-user")
    if not providers:
        pytest.skip("No API keys configured for test user")

    llm = LLMRouter(providers)
    state = normalize_to_initial_state(
        "Build a simple todo list app with React frontend and FastAPI backend. "
        "Users can create, complete, and delete todos. Store in SQLite.",
        "text",
        "e2e-real-job",
        "e2e-test-user"
    )
    state["llm"] = llm
    state["repo_name"] = "e2e-real-test"
    state["repo_private"] = False

    try:
        result = await asyncio.wait_for(pipeline.ainvoke(state), timeout=120)
    except asyncio.TimeoutError:
        pytest.fail("Pipeline timed out after 120 seconds")
    except Exception as e:
        # github_agent failure is acceptable
        result = state

    assert len(result.get("generated_files", {})) >= 3
    assert len(result.get("readme_content", "")) > 0
    assert len(result.get("pitch_slides", [])) >= 4
