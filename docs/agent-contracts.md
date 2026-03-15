# Agent I/O Contracts

## analyst
Reads:  raw_text, input_type
Writes: project_name, problem_statement, mvp_features[],
        judging_criteria[], constraints[], domain
Emits:  agent_start → agent_thinking ("Extracting judging criteria...")
                    → agent_thinking ("Identifying core MVP features...")
                    → agent_done (summary: "Found N features across M categories")

## architect
Reads:  project_name, mvp_features, constraints, domain
Writes: api_contracts{}, component_map{}, tech_stack{}, database_schema{}
NOTE:   api_contracts is IMMUTABLE after this agent. No agent reads it to modify it.
Emits:  agent_start → agent_thinking ("Designing API surface...")
                    → agent_thinking ("Mapping component responsibilities...")
                    → agent_done (summary: "Designed N endpoints, M components")

## frontend_agent
Reads:  api_contracts, component_map.frontend[], tech_stack.frontend
Writes: generated_files{} — React files only
        Keys like: "frontend/src/App.jsx", "frontend/src/components/X.jsx"
Rule:   Only generates endpoints listed in api_contracts. Never invents new ones.
Emits:  agent_start → agent_thinking (per major component)
                    → agent_done (summary: "Generated N files")

## backend_agent
Reads:  api_contracts, database_schema, tech_stack.backend, component_map.backend[]
Writes: generated_files{} — Python files only
        Keys like: "backend/main.py", "backend/routes/items.py"
Rule:   Implements exactly the endpoints in api_contracts, same shapes as frontend expects.
Emits:  agent_start → agent_thinking (per route group)
                    → agent_done (summary: "Generated N files, M endpoints")

## business_agent
Reads:  project_name, problem_statement, mvp_features, judging_criteria, tech_stack
Writes: readme_content (markdown string),
        pitch_slides ([{title, content, notes}]),
        architecture_mermaid (valid mermaid graph TD string)
Emits:  agent_start → agent_thinking ("Writing README...")
                    → agent_thinking ("Building pitch narrative...")
                    → agent_done

## integrator
Reads:  generated_files (all), api_contracts, tech_stack, database_schema
Writes: generated_files — ADDS these files (never overwrites frontend/backend files):
        "requirements.txt", "frontend/package.json",
        ".gitignore", ".env.example", "docker-compose.yml"
        Also fixes any mismatched import paths it detects.
Emits:  agent_start → agent_thinking ("Checking import consistency...")
                    → agent_thinking ("Generating dependency files...")
                    → agent_done

## validator
Reads:  generated_files
Writes: validation_score (0-100), validation_issues ([string])
Checks: Python ast.parse() on .py files (syntax),
        every import in .py files exists in requirements.txt,
        every JSX component imported exists in generated_files keys,
        every API endpoint called in frontend exists in api_contracts
Emits:  agent_start → agent_thinking ("Running syntax checks...")
                    → agent_done (summary: "Score: N/100, M issues found")

## github_agent
Reads:  job_id, user_id, generated_files, readme_content, project_name
Action: retrieves user GitHub token from DB (decrypt),
        creates repo via REST API,
        pushes all files via Git Trees API (one atomic commit),
        builds ZIP via zip_builder,
        updates Job in DB (github_url, zip_path, status=complete),
        fires n8n webhook (fire-and-forget)
Writes: github_url in state
Emits:  agent_start → agent_thinking ("Creating repository...")
                    → agent_thinking ("Pushing N files...")
                    → job_complete {github_url, zip_path, file_count}