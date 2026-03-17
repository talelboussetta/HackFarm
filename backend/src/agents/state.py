from typing import Annotated, TypedDict, List, Dict, Any, Optional
import operator

class ProjectState(TypedDict):
    job_id: str
    user_id: str
    llm: Any  # LLMRouter instance
    raw_text: str
    input_type: str  # text / pdf / docx
    project_name: str
    problem_statement: str
    mvp_features: List[str]
    judging_criteria: List[str]
    constraints: List[str]
    domain: str
    api_contracts: Dict[str, Any]  # IMMUTABLE after architect sets it
    component_map: Dict[str, List[str]]
    tech_stack: Dict[str, str]
    database_schema: Dict[str, Any]
    generated_files: Annotated[Dict[str, str], operator.or_]  # merge semantics
    readme_content: str
    pitch_slides: List[Dict[str, str]]
    architecture_mermaid: str
    validation_score: int
    validation_issues: List[str]
    retry_count: int
    errors: Annotated[List[str], operator.add]  # parallel agents append errors
    status: str
    github_url: Optional[str]
    repo_name: str
    repo_private: bool
    refinement_feedback: Optional[str]
