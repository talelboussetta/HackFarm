# HackFarm Deployment & Repo State (Mar 17, 2026)

## Current State
- Branch: dev (default main)
- Backend: FastAPI + LangGraph; LLM router now falls back on invalid JSON responses; job_complete events emitted on success.
- Frontend: React/Vite; job view uses Realtime + polling fallback for pipeline events.
- BaaS: Appwrite (collections/bucket via `backend/scripts/setup_appwrite.py`).
- CI/CD: `.github/workflows/deploy.yml` targets Heroku (backend) and Appwrite Sites (frontend).

## Readiness
- API smoke tests: `cd backend && python -m pytest test_backend_routes.py` ✅ expected pass.
- Integration (requires Appwrite + FERNET_KEY): `cd backend && python -m pytest backend/tests/test_phase3a.py`.
- Pipeline E2E: `cd backend && python -m pytest backend/tests/test_e2e.py` (add `--real-llm` for live keys).
- Frontend build: `cd frontend && npm install && npm run build`.
- Containers: `docker compose up --build` (after env files are set).
- Pre-flight: `python backend/scripts/pre_deploy_check.py` should pass.

## Config Checklist
- Set env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID, APPWRITE_ZIP_BUCKET_ID, FERNET_KEY, FRONTEND_URL.
- Frontend `.env.local`: VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID.
- LLM keys (Gemini/Groq/OpenRouter) stored via Settings.
- GitHub OAuth enabled in Appwrite (provider: GitHub) for job creation/push.

## Deployment Notes
- Backend → Heroku: push from backend folder; ensure config vars set.
- Frontend → Appwrite Sites: `npm run build` then `appwrite deploy site --siteId <id> --path dist/`.
- Artifacts: ZIP stored in Appwrite bucket `generated-zips`; job_complete events carry `zip_file_id` and `github_url`.

## Recent Fixes
- LLM router: invalid JSON triggers fallback; avoids agent failures.
- Jobs: publish `job_complete` on successful pipeline to unblock UI file/architecture loading.
- Frontend stream: polling fallback keeps agent graph live when Realtime drops.
