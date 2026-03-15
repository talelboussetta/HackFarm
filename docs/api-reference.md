# API Endpoints Reference

## Auth
GET  /auth/github          → redirect to GitHub OAuth
GET  /auth/callback        → OAuth callback, sets hf_session cookie
GET  /auth/me              → {id, username, avatar_url}  [auth required]
POST /auth/logout          → clears cookie  [auth required]

## Jobs
POST /jobs                 → create job, launch pipeline  [auth required]
     body: multipart/form-data
       file?: File (PDF or DOCX)
       prompt?: string
       repo_name: string
       repo_private: bool (default false)
       retention_days: int (7 | 30 | 0=forever)
     response: {job_id, status: "queued"}

GET  /jobs                 → [{id, status, repo_name, github_url, created_at}]
GET  /jobs/:id             → full job + agent_runs[]  [owner only]
DELETE /jobs/:id           → cancel queued job or delete completed job

## Streaming
GET  /jobs/:id/stream      → SSE stream  [auth required, owner only]
     Replays past events from DB first, then live stream if still running

## Downloads
GET  /jobs/:id/download    → ZIP file stream  [auth required, owner only]

## Settings
GET  /settings/keys        → [{provider, masked_key, is_valid, last_used}]
POST /settings/keys        → {provider, key} → store encrypted
DELETE /settings/keys/:provider
POST /settings/keys/:provider/test → {valid: bool, error?: string}

## Internal (not exposed to frontend)
GET  /internal/health      → {status: "ok"}
GET  /internal/expired-jobs → called by n8n cleanup workflow