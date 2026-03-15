# Prompt Engineering Rules for Agent Prompts

Every file in src/llm/prompts/ must follow these rules:

## Structure
1. Role sentence: "You are a [role]. Your task is to [specific task]."
2. Input block: clearly labeled input variables using {variable_name} placeholders
3. Rules block: 3-5 specific constraints the LLM must follow
4. Output schema: exact JSON schema with field names, types, and descriptions
5. Termination line: "Respond with ONLY valid JSON. No markdown. No explanation. No code fences."
6. Examples block: one good example and one bad example for the most error-prone field

## JSON schema format
Always include: field name, type, description, and a concrete example value.
Mark required fields explicitly.
For arrays: specify what each element looks like.

## Common mistakes to prevent (include these as explicit rules in prompts)
- Never invent API endpoints not in the provided api_contracts
- Never use library versions not in the provided tech_stack
- File paths must use forward slashes and start with frontend/ or backend/
- All import paths must be relative (./X not X)
- Python files must include all necessary imports at the top

## Token budget awareness
analyst.txt:       ~500 tokens input, ~300 tokens output
architect.txt:     ~800 tokens input, ~600 tokens output
frontend_agent.txt: ~1200 tokens input, ~2000 tokens output (largest)
backend_agent.txt:  ~1200 tokens input, ~2000 tokens output (largest)
business_agent.txt: ~600 tokens input, ~800 tokens output
integrator.txt:    ~1500 tokens input, ~500 tokens output (reads file list, not content)
validator.txt:     ~2000 tokens input, ~200 tokens output
```

---

## Layer 3 — MCP Servers

These are the MCP servers to connect in Cursor. Each one gives the AI direct access to live data rather than having to ask you.

**Connect these in Cursor Settings → MCP:**

**1. GitHub MCP**
The most important one. Lets Cursor read your actual repo structure, open issues, check what files exist, and understand your real codebase state — not a hallucinated version of it.
```
Name: github
URL or command: npx @modelcontextprotocol/server-github
Env: GITHUB_PERSONAL_ACCESS_TOKEN=your_pat
```
Use it for: "check what's already in the agents/ folder before implementing the next agent," "look at the current state.py before adding a field."

**2. Filesystem MCP**
Lets Cursor read and write files directly without copy-pasting. Critical for a project with 40+ files.
```
Name: filesystem
URL or command: npx @modelcontextprotocol/server-filesystem
Args: /absolute/path/to/hackfarmer
```
Use it for: reading existing files before editing, checking if a file already exists, verifying the folder structure matches the spec.

**3. PostgreSQL/SQLite MCP**
Lets Cursor inspect your actual database schema and run test queries during development.
```
Name: sqlite
URL or command: npx @modelcontextprotocol/server-sqlite
Args: --db-path /absolute/path/to/hackfarmer.db
```
Use it for: "check what's in the jobs table right now," "verify the foreign key is set up correctly," debugging stuck jobs during development.

**4. Fetch MCP**
Lets Cursor fetch live documentation pages — GitHub API docs, LangGraph docs, FastAPI docs — rather than relying on training data that may be outdated.
```
Name: fetch
URL or command: npx @modelcontextprotocol/server-fetch
```
Use it for: "fetch the current LangGraph StateGraph docs before implementing the graph," "check the GitHub Git Trees API spec before building the push function."

**5. Memory MCP**
Persistent knowledge graph that remembers decisions across conversations. As you make architectural decisions, Cursor stores them and recalls them in future sessions.
```
Name: memory
URL or command: npx @modelcontextprotocol/server-memory
```
Use it for: storing every architectural decision you make, error patterns you've encountered, which validation gates have passed.

**You already have Slack connected** — use it to receive n8n job completion notifications during testing without leaving your IDE.

---

## Layer 4 — Prompt Snippet Library

Save these as Cursor snippets or keep them in `/docs/cursor-prompts.md`. Use them verbatim.

**Snippet: Start any new file**
```
Before writing any code, read:
@docs/agent-contracts.md
@backend/src/agents/state.py
@backend/src/core/config.py

Now implement [FILENAME] following the immutable rules in .cursorrules.
Stay inside this file's responsibility. Do not reach into other layers.
```

**Snippet: Implement an agent**
```
Read these files first:
@backend/src/agents/state.py
@backend/src/agents/graph.py
@backend/src/core/events.py
@backend/src/llm/router.py
@docs/agent-contracts.md

Implement [AGENT_NAME] in backend/src/agents/[agent_name].py.

This agent reads from state: [LIST FIELDS]
This agent writes to state: [LIST FIELDS]
The prompt template goes in: backend/src/llm/prompts/[agent_name].txt

Follow the event emission sequence from agent-contracts.md exactly.
Validate JSON response keys before setting state. Use safe defaults for missing keys.
Catch all exceptions — never let an agent crash the pipeline.
```

**Snippet: Debug a broken agent**
```
The [AGENT_NAME] agent is failing. Here is the error:
[PASTE ERROR]

Read these files:
@backend/src/agents/[agent_name].py
@backend/src/llm/prompts/[agent_name].txt
@backend/src/agents/state.py

Check:
1. Does the LLM prompt ask for exactly the JSON fields the agent tries to parse?
2. Does the agent handle missing JSON keys gracefully?
3. Is every event emission correct (agent_start, thinking, done/failed)?
4. Is the return value a dict of only the changed fields, not the full state?

Do not change the state field names. Do not change the event schema.
```

**Snippet: Implement a frontend component**
```
Read first:
@frontend/src/store/useAppStore.js
@frontend/src/lib/api.js
@frontend/src/hooks/useJobStream.js (if this component uses SSE)
@docs/event-types.md (if this component renders events)

Implement [COMPONENT_NAME] in frontend/src/components/[ComponentName].jsx.

Design tokens from .cursorrules apply. Use framer-motion for all animations.
Use lucide-react for icons. Use Tailwind for all styling — no inline styles.
Every interactive element needs a hover state and a disabled state.
Every async operation needs a loading state and an error state.
```

**Snippet: Validate the LangGraph graph**
```
Read:
@backend/src/agents/graph.py
@backend/src/agents/state.py
@docs/agent-contracts.md

Check that:
1. The graph topology matches exactly: analyst → architect → [3 parallel] → integrator → validator → conditional → github_agent
2. The conditional edge function checks retry_count from state, not from any LLM response
3. The join semantics are correct — integrator only runs after all three parallel agents complete
4. No node modifies api_contracts after architect sets it
5. generated_files uses Annotated[dict, operator.or_] for merge semantics in state.py

List any violations found.
```

**Snippet: Before touching the DB models**
```
Read:
@backend/src/store/db.py
@backend/src/api/dependencies.py

I need to [DESCRIBE CHANGE].

Before making any changes:
1. List every file that imports from db.py
2. Check if this change requires an alembic migration or just create_all() is enough
3. Verify the new field names don't conflict with existing ones

Do not rename existing fields. Do not change existing foreign key relationships.
```

**Snippet: Add a new API endpoint**
```
Read:
@backend/src/api/dependencies.py
@backend/src/store/db.py
@docs/api-reference.md

Add endpoint [METHOD] [PATH] to [ROUTER FILE].

Requirements: [describe what it does]
Auth required: yes/no
Returns: [describe response shape]

Check docs/api-reference.md first — if this endpoint already exists there under
a different name, implement that version instead of creating a duplicate.
After implementing, add the endpoint to docs/api-reference.md.
```

**Snippet: End of day checkpoint**
```
Update .cursorrules:
- Set "Phase:" to [current phase name]
- Set "Done:" to include [what you just finished]
- Set "Next:" to [very next specific task]

Then update memory MCP with:
- Any architectural decisions made today
- Any patterns that caused bugs
- Which validation gates passed
```

---

## Layer 5 — Agent Prompt Files

These are the actual `.txt` files that live in `backend/src/llm/prompts/`. The structure every file must follow:

**`analyst.txt`**
```
You are a senior product analyst. Your task is to read a hackathon project 
specification and extract structured information that a development team will 
use to build the project.

INPUT:
Project specification text:
{raw_text}

RULES:
1. Extract only information explicitly stated or clearly implied in the spec.
2. If the spec does not mention a judging criterion, leave judging_criteria empty.
3. mvp_features must be implementable in a hackathon timeframe (1-3 days).
4. domain must be one of: fintech, health, education, productivity, sustainability, 
   social, developer-tools, ecommerce, logistics, entertainment, other.
5. project_name should be 2-4 words, memorable, reflects the core value proposition.

OUTPUT SCHEMA:
{
  "project_name": string,          // 2-4 word name
  "problem_statement": string,     // one sentence, the core problem being solved
  "mvp_features": [string],        // 3-6 features, each a concrete user action
  "nice_to_have": [string],        // 1-3 features, clearly optional
  "judging_criteria": [string],    // what judges will score, from the spec
  "constraints": [string],         // required tech, forbidden tech, team size, time
  "domain": string,                // one value from the allowed list above
  "target_users": string           // one sentence describing who uses this
}

EXAMPLE — good mvp_features item: "User can upload a CSV file and see a chart"
EXAMPLE — bad mvp_features item: "Advanced analytics dashboard with ML insights"

Respond with ONLY valid JSON matching the schema above. No markdown. No explanation. 
No code fences. No text before or after the JSON object.
```

**`architect.txt`**
```
You are a senior software architect. Your task is to design a minimal, 
implementable system architecture for a hackathon project.

INPUT:
Project name: {project_name}
Core features: {mvp_features}
Constraints: {constraints}
Domain: {domain}

RULES:
1. Choose the simplest stack that delivers the features. Never over-engineer.
2. API contracts must be complete: every endpoint needs a request shape and response shape.
3. component_map lists file paths only — not content. Paths use forward slashes.
4. Frontend paths start with "frontend/src/". Backend paths start with "backend/".
5. Maximum 8 API endpoints for an MVP. If you need more, simplify the features.
6. database_schema must match what the backend can implement in a day.

OUTPUT SCHEMA:
{
  "tech_stack": {
    "frontend": string,   // e.g. "React 18 + Vite + Tailwind CSS"
    "backend": string,    // e.g. "FastAPI + Python 3.11"
    "database": string,   // e.g. "SQLite"
    "auth": string        // e.g. "JWT" or "none"
  },
  "api_contracts": {
    "POST /api/[resource]": {
      "description": string,
      "auth_required": bool,
      "request_body": { "field": "type" },
      "response": { "field": "type" },
      "errors": ["404 if not found"]
    }
  },
  "component_map": {
    "frontend": ["frontend/src/App.jsx", "frontend/src/components/X.jsx"],
    "backend": ["backend/main.py", "backend/routes/x.py", "backend/models.py"]
  },
  "database_schema": {
    "table_name": {
      "id": "uuid primary key",
      "field_name": "type + constraints"
    }
  },
  "rationale": string  // one paragraph: why this stack for this specific project
}

Respond with ONLY valid JSON. No markdown. No explanation. No code fences.