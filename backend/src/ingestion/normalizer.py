"""
HackFarmer — Input normalizer.
Converts raw text + metadata into a full ProjectState dict with correct defaults.
"""


def normalize_to_initial_state(
    text: str,
    input_type: str,
    job_id: str,
    user_id: str,
) -> dict:
    """
    Build an initial ProjectState dict with all fields set to defaults.
    The `llm` field is set to None — the job launcher must inject it before pipeline.ainvoke().
    """
    return {
        # Identity
        "job_id": job_id,
        "user_id": user_id,
        "llm": None,
        # Input
        "raw_text": text,
        "input_type": input_type,
        # Analyst outputs
        "project_name": "",
        "problem_statement": "",
        "mvp_features": [],
        "judging_criteria": [],
        "constraints": [],
        "domain": "",
        # Architect outputs
        "api_contracts": {},
        "component_map": {},
        "tech_stack": {},
        "database_schema": {},
        # Code-gen outputs
        "generated_files": {},
        # Business outputs
        "readme_content": "",
        "pitch_slides": [],
        "architecture_mermaid": "",
        # Validator outputs
        "validation_score": 0,
        "validation_issues": [],
        # Control
        "retry_count": 0,
        "errors": [],
        "status": "running",
        "github_url": None,
        "repo_name": "",
        "repo_private": False,
    }
