"""
HackFarmer — Validator agent.
Pure Python static analysis — no LLM call.
Checks syntax, imports, and endpoint consistency.
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

# Standard library modules to exclude from requirements check
_STDLIB = {
    "os", "sys", "json", "re", "ast", "math", "datetime", "time", "uuid",
    "hashlib", "base64", "io", "pathlib", "typing", "collections",
    "functools", "itertools", "contextlib", "logging", "asyncio",
    "dataclasses", "enum", "copy", "traceback", "string", "textwrap",
    "abc", "operator", "shutil", "tempfile", "glob", "csv", "sqlite3",
}


def _check_python_syntax(files: dict) -> tuple[int, list[str]]:
    """Parse all .py files with ast. Returns (pass_count, issues)."""
    passed = 0
    issues = []
    for path, content in files.items():
        if not path.endswith(".py"):
            continue
        try:
            ast.parse(content)
            passed += 1
        except SyntaxError as e:
            issues.append(f"Syntax error in {path}: line {e.lineno}: {e.msg}")
    return passed, issues


def _check_python_imports(files: dict) -> list[str]:
    """Check that imports in .py files exist in requirements.txt."""
    req_content = files.get("requirements.txt", "")
    req_packages = set()
    for line in req_content.splitlines():
        line = line.strip().lower()
        if line and not line.startswith("#"):
            # Strip version specs: "fastapi>=0.100" → "fastapi"
            pkg = re.split(r'[>=<!\[\]~;]', line)[0].strip()
            req_packages.add(pkg)
            # Also add common import aliases
            req_packages.add(pkg.replace("-", "_"))

    issues = []
    for path, content in files.items():
        if not path.endswith(".py"):
            continue
        try:
            tree = ast.parse(content)
        except SyntaxError:
            continue

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    mod = alias.name.split(".")[0].lower()
                    if mod not in _STDLIB and mod not in req_packages:
                        # Skip project-local imports
                        if not mod.startswith(("src", "app", "routes", "models", "config")):
                            issues.append(f"Import '{mod}' in {path} not in requirements.txt")
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    mod = node.module.split(".")[0].lower()
                    if mod not in _STDLIB and mod not in req_packages:
                        if not mod.startswith(("src", "app", "routes", "models", "config")):
                            issues.append(f"Import '{mod}' in {path} not in requirements.txt")
    return issues


def _check_jsx_imports(files: dict) -> list[str]:
    """Check that relative JSX component imports reference existing files."""
    issues = []
    jsx_files = {k for k in files if k.endswith(".jsx") or k.endswith(".js")}

    for path, content in files.items():
        if not (path.endswith(".jsx") or path.endswith(".js")):
            continue
        # Match: import X from './Something' or import X from '../components/Something'
        for match in re.finditer(r"""import\s+.*?\s+from\s+['"](\.\.?/.+?)['"]""", content):
            import_path = match.group(1)
            # Resolve relative to the file's directory
            dir_parts = path.rsplit("/", 1)[0] if "/" in path else ""
            if import_path.startswith("./"):
                resolved = f"{dir_parts}/{import_path[2:]}"
            elif import_path.startswith("../"):
                parent = dir_parts.rsplit("/", 1)[0] if "/" in dir_parts else ""
                resolved = f"{parent}/{import_path[3:]}"
            else:
                continue

            # Check with and without extension
            candidates = [resolved, f"{resolved}.jsx", f"{resolved}.js", f"{resolved}/index.jsx"]
            if not any(c in jsx_files for c in candidates):
                issues.append(f"JSX import '{import_path}' in {path} — file not found")
    return issues


def _check_api_endpoints(files: dict, api_contracts: dict) -> list[str]:
    """Check that endpoints called in frontend match api_contracts keys."""
    if not api_contracts:
        return []

    # Extract endpoint paths from api_contracts (e.g., "GET /api/todos" → "/api/todos")
    contract_paths = set()
    for key in api_contracts:
        parts = key.strip().split(" ", 1)
        if len(parts) == 2:
            contract_paths.add(parts[1])
        else:
            contract_paths.add(key)

    issues = []
    for path, content in files.items():
        if not path.startswith("frontend/"):
            continue
        # Match fetch("/api/something" or fetch('/api/something'
        for match in re.finditer(r"""fetch\s*\(\s*[`'"](\/api\/[^'"`\s]+)""", content):
            endpoint = match.group(1)
            # Strip query params
            endpoint = endpoint.split("?")[0]
            # Remove dynamic segments like /api/todos/${id} → /api/todos/:id
            endpoint = re.sub(r'\$\{[^}]+\}', ':id', endpoint)
            if endpoint not in contract_paths:
                # Fuzzy: check if any contract path starts with a similar prefix
                if not any(endpoint.startswith(cp.rsplit("/", 1)[0]) for cp in contract_paths if "/" in cp):
                    issues.append(f"Frontend calls '{endpoint}' in {path} — not in api_contracts")
    return issues


async def validator(state: ProjectState) -> dict:
    job_id = state["job_id"]

    # Step 1: publish agent_start
    publish(job_id, "agent_start", {
        "agent": "validator",
        "message": "Validating generated code...",
        "estimated_seconds": 10,
    })

    # Step 2: create AgentRun document
    agent_run_id = None
    try:
        doc = databases.create_document(DB, "agent-runs", "unique()", {
            "jobId": job_id,
            "agentName": "validator",
            "status": "running",
            "retryCount": 0,
            "runDuration": 0,
            "outputFormat": "json",
            "startedAt": datetime.now(timezone.utc).isoformat(),
        })
        agent_run_id = doc["$id"]
    except Exception as e:
        log.warning(f"Failed to create agent-run doc: {e}")

    generated_files = state.get("generated_files", {})
    api_contracts = state.get("api_contracts", {})
    all_issues = []

    # Check 1: Python syntax
    publish(job_id, "agent_thinking", {
        "agent": "validator",
        "message": "Running syntax checks...",
    })
    syntax_passed, syntax_issues = _check_python_syntax(generated_files)
    all_issues.extend(syntax_issues)

    # Check 2: Python imports vs requirements.txt
    import_issues = _check_python_imports(generated_files)
    all_issues.extend(import_issues)

    # Check 3: JSX imports
    jsx_issues = _check_jsx_imports(generated_files)
    all_issues.extend(jsx_issues)

    # Check 4: API endpoint consistency
    endpoint_issues = _check_api_endpoints(generated_files, api_contracts)
    all_issues.extend(endpoint_issues)

    # Score calculation: start at 100, deduct per issue type
    score = 100
    score -= len(syntax_issues) * 10
    score -= len(import_issues) * 5
    score -= len(jsx_issues) * 5
    score -= len(endpoint_issues) * 10
    score = max(0, min(100, score))

    # Deduplicate issues
    all_issues = list(dict.fromkeys(all_issues))

    # Step 3: update AgentRun + publish agent_done
    if agent_run_id:
        try:
            databases.update_document(DB, "agent-runs", agent_run_id, {
                "status": "done",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "outputSummary": f"Score: {score}/100, {len(all_issues)} issues found",
            })
        except Exception as e:
            log.warning(f"Failed to update agent-run doc: {e}")

    publish(job_id, "agent_done", {
        "agent": "validator",
        "summary": f"Score: {score}/100, {len(all_issues)} issues found",
    })

    return {
        "validation_score": score,
        "validation_issues": all_issues,
    }
