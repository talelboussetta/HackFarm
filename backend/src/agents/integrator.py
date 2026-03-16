"""
HackFarmer — Integrator agent.
Adds infrastructure files (requirements.txt, package.json, .gitignore, etc.)
and checks import consistency. Never overwrites existing generated files.
"""

import ast
import json
import logging
import re
from datetime import datetime, timezone

from src.agents.state import ProjectState
from src.appwrite_client import databases
from src.core.config import settings
from src.core.events import publish

log = logging.getLogger(__name__)
DB = settings.APPWRITE_DATABASE_ID

# Standard Python packages that don't need to be in requirements.txt
_STDLIB = {
    "os", "sys", "json", "re", "ast", "math", "datetime", "time", "uuid",
    "hashlib", "base64", "io", "pathlib", "typing", "collections",
    "functools", "itertools", "contextlib", "logging", "asyncio",
    "dataclasses", "enum", "copy", "traceback", "string", "textwrap",
    "abc", "operator", "shutil", "tempfile", "glob", "csv", "sqlite3",
}

# Well-known pip package name → import name mappings
_IMPORT_TO_PKG = {
    "fastapi": "fastapi",
    "uvicorn": "uvicorn[standard]",
    "sqlalchemy": "sqlalchemy",
    "pydantic": "pydantic",
    "httpx": "httpx",
    "dotenv": "python-dotenv",
    "jwt": "pyjwt",
    "PIL": "pillow",
    "cv2": "opencv-python",
    "sklearn": "scikit-learn",
    "yaml": "pyyaml",
    "bs4": "beautifulsoup4",
    "starlette": "starlette",
    "jose": "python-jose",
    "passlib": "passlib",
    "aiofiles": "aiofiles",
    "aiosqlite": "aiosqlite",
    "alembic": "alembic",
    "requests": "requests",
    "flask": "flask",
    "django": "django",
    "celery": "celery",
    "redis": "redis",
    "pymongo": "pymongo",
    "boto3": "boto3",
    "stripe": "stripe",
}


def _extract_imports_from_py(content: str) -> set[str]:
    """Extract top-level module names from Python source."""
    modules = set()
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return modules
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                modules.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                modules.add(node.module.split(".")[0])
    return modules


def _build_requirements(generated_files: dict) -> str:
    """Build requirements.txt from imports in generated .py files."""
    all_imports = set()
    for path, content in generated_files.items():
        if path.endswith(".py"):
            all_imports |= _extract_imports_from_py(content)

    # Filter out stdlib and local packages
    third_party = all_imports - _STDLIB
    # Remove project-internal imports (anything that looks like a local module)
    third_party = {m for m in third_party if not m.startswith(("src", "app", "routes", "models", "config"))}

    packages = set()
    for mod in sorted(third_party):
        pkg = _IMPORT_TO_PKG.get(mod, mod)
        packages.add(pkg)

    # Always include core packages
    packages.add("fastapi")
    packages.add("uvicorn[standard]")

    return "\n".join(sorted(packages)) + "\n"


def _build_package_json(tech_stack: dict, project_name: str) -> str:
    """Build a minimal frontend/package.json."""
    fe_stack = tech_stack.get("frontend", "").lower()
    deps = {
        "react": "^18.3.1",
        "react-dom": "^18.3.1",
    }
    dev_deps = {
        "vite": "^6.0.5",
        "@vitejs/plugin-react": "^4.3.4",
    }
    if "tailwind" in fe_stack:
        dev_deps["tailwindcss"] = "^3.4.17"
        dev_deps["autoprefixer"] = "^10.4.20"
        dev_deps["postcss"] = "^8.4.49"
    if "router" in fe_stack or "react-router" in fe_stack:
        deps["react-router-dom"] = "^7.13.1"

    pkg = {
        "name": project_name.lower().replace(" ", "-"),
        "private": True,
        "version": "0.1.0",
        "type": "module",
        "scripts": {
            "dev": "vite",
            "build": "vite build",
            "preview": "vite preview",
        },
        "dependencies": deps,
        "devDependencies": dev_deps,
    }
    return json.dumps(pkg, indent=2) + "\n"


def _build_gitignore() -> str:
    return """# Python
__pycache__/
*.py[cod]
*.egg-info/
dist/
.venv/
venv/
*.db

# Node
node_modules/
dist/
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
"""


def _build_env_example(api_contracts: dict) -> str:
    lines = [
        "# Backend",
        "DATABASE_URL=sqlite:///./app.db",
    ]
    # Check if any endpoint requires auth
    has_auth = any(
        ep.get("auth_required", False)
        for ep in api_contracts.values()
        if isinstance(ep, dict)
    )
    if has_auth:
        lines.append("JWT_SECRET_KEY=change-me-in-production")
    lines += [
        "",
        "# Frontend",
        "VITE_API_URL=http://localhost:8000",
    ]
    return "\n".join(lines) + "\n"


def _build_docker_compose(tech_stack: dict) -> str:
    be = tech_stack.get("backend", "FastAPI").lower()
    return f"""version: "3.8"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    volumes:
      - ./backend:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev -- --host
"""


async def integrator(state: ProjectState) -> dict:
    job_id = state["job_id"]

    # Step 1: publish agent_start
    publish(job_id, "agent_start", {
        "agent": "integrator",
        "message": "Integrating files and generating dependencies...",
        "estimated_seconds": 15,
    })

    # Step 2: create AgentRun document
    agent_run_id = None
    try:
        doc = databases.create_document(DB, "agent-runs", "unique()", {
            "jobId": job_id,
            "agentName": "integrator",
            "status": "running",
            "retryCount": 0,
            "runDuration": 0,
            "outputFormat": "json",
            "startedAt": datetime.now(timezone.utc).isoformat(),
        })
        agent_run_id = doc["$id"]
    except Exception as e:
        log.warning(f"Failed to create agent-run doc: {e}")

    existing_files = state.get("generated_files", {})
    tech_stack = state.get("tech_stack", {})
    api_contracts = state.get("api_contracts", {})
    project_name = state.get("project_name", "hackathon-project")

    publish(job_id, "agent_thinking", {
        "agent": "integrator",
        "message": "Checking import consistency...",
    })

    # Step 3: generate infrastructure files (never overwrite existing)
    infra_files = {}

    if "requirements.txt" not in existing_files:
        infra_files["requirements.txt"] = _build_requirements(existing_files)

    if "frontend/package.json" not in existing_files:
        infra_files["frontend/package.json"] = _build_package_json(tech_stack, project_name)

    if ".gitignore" not in existing_files:
        infra_files[".gitignore"] = _build_gitignore()

    if ".env.example" not in existing_files:
        infra_files[".env.example"] = _build_env_example(api_contracts)

    if "docker-compose.yml" not in existing_files:
        infra_files["docker-compose.yml"] = _build_docker_compose(tech_stack)

    publish(job_id, "agent_thinking", {
        "agent": "integrator",
        "message": f"Generating dependency files... ({len(infra_files)} files)",
    })

    # Step 4: optional LLM check for endpoint mismatches
    if state.get("llm") and api_contracts:
        fe_files_content = {
            k: v[:2000] for k, v in existing_files.items()
            if k.startswith("frontend/") and k.endswith(".jsx")
        }
        if fe_files_content:
            try:
                check_prompt = (
                    f"Given these api_contracts: {json.dumps(list(api_contracts.keys()))}\n"
                    f"And these frontend file snippets:\n{json.dumps(fe_files_content, indent=2)}\n\n"
                    "List any fetch/API endpoint path called in the frontend that is NOT "
                    "in api_contracts. Return a JSON array of strings. If none, return []."
                )
                check_raw = await state["llm"].complete(check_prompt, response_format="json")
                mismatches = json.loads(check_raw)
                if isinstance(mismatches, list) and mismatches:
                    log.warning(f"Endpoint mismatches found: {mismatches}")
            except Exception:
                pass  # Non-critical — don't fail the agent

    file_count = len(infra_files)

    # Step 5: update AgentRun + publish agent_done
    if agent_run_id:
        try:
            databases.update_document(DB, "agent-runs", agent_run_id, {
                "status": "done",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "outputSummary": f"Added {file_count} dependency files",
            })
        except Exception as e:
            log.warning(f"Failed to update agent-run doc: {e}")

    publish(job_id, "agent_done", {
        "agent": "integrator",
        "summary": f"Added {file_count} dependency files",
    })

    return {"generated_files": infra_files}
