# Cursor Prompt Snippets

## Start any new file
```
Before writing any code, read:
@docs/agent-contracts.md
@backend/src/agents/state.py
@backend/src/core/config.py

Now implement [FILENAME] following the immutable rules in .cursorrules.
Stay inside this file's responsibility. Do not reach into other layers.
```

## Implement an agent
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

## Debug a broken agent
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

## Implement a frontend component
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

## Validate the LangGraph graph
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

## Before touching the DB models
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

## Add a new API endpoint
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

## End of day checkpoint
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
