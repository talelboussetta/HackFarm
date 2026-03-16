# HackFarmer — Repository Status Report

> **Generated:** 2026-03-16  
> **Branch:** `main` | **Default:** `dev`  
> **Repo:** [talelboussetta/HackFarm](https://github.com/talelboussetta/HackFarm)

---

## 📊 Summary

| Area | Status |
|------|--------|
| Backend (FastAPI) | ✅ Clean — forbidden deps removed, agents fixed |
| Frontend (React/Vite) | ✅ Build-ready — imports & Dockerfile fixed |
| Tests — API routes | ✅ **9/9 passed** |
| Tests — Phase 3A | ⏳ Requires live Appwrite instance |
| Tests — E2E pipeline | ⏳ Requires live Appwrite + LLM keys |
| CI/CD (deploy.yml) | ✅ Updated — Heroku + Appwrite Sites |
| Docker Compose | ✅ 3 services configured |
| Appwrite Setup Script | ✅ Created — idempotent |
| Pre-deploy Checklist | ✅ Created — 10 checks |
| README | ✅ Rewritten with setup guide & API ref |

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────────────┐     ┌───────────┐
│  React SPA  │────▶│  FastAPI Backend (8000)   │────▶│ Appwrite  │
│  Vite :3000 │◀────│  LangGraph Pipeline       │◀────│   BaaS    │
└─────────────┘ SSE └──────────────────────────┘     └───────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │  LLM APIs   │
                    │ OpenAI/etc  │
                    └─────────────┘
```

---

## 📁 Project Structure

```
HackFarm/
├── backend/
│   ├── main.py                    # Uvicorn entry point
│   ├── requirements.txt           # 20 packages (no SQLAlchemy)
│   ├── Dockerfile / Procfile      # Heroku deploy
│   ├── runtime.txt                # Python 3.11.7
│   ├── src/
│   │   ├── agents/                # 8 LangGraph agents
│   │   │   ├── analyst.py
│   │   │   ├── architect.py
│   │   │   ├── frontend_agent.py
│   │   │   ├── backend_agent.py
│   │   │   ├── business_agent.py
│   │   │   ├── integrator.py
│   │   │   ├── validator.py
│   │   │   ├── github_agent.py
│   │   │   ├── graph.py           # StateGraph definition
│   │   │   └── state.py           # ProjectState TypedDict
│   │   ├── api/
│   │   │   ├── main.py            # FastAPI app + CORS + lifespan
│   │   │   └── routes/
│   │   │       ├── auth.py        # /api/auth/*
│   │   │       ├── jobs.py        # /api/jobs/*
│   │   │       ├── stream.py      # /api/stream/* (SSE)
│   │   │       ├── settings.py    # /api/settings/*
│   │   │       └── downloads.py   # /api/downloads/*
│   │   ├── core/                  # Config, encryption, events
│   │   ├── ingestion/             # normalizer.py
│   │   └── store/                 # db.py & context_store.py (deprecated)
│   ├── scripts/
│   │   ├── setup_appwrite.py      # Create collections & bucket
│   │   └── pre_deploy_check.py    # 10 pre-deploy validations
│   └── tests/
│       ├── test_phase3a.py        # 10 unit/integration tests
│       └── test_e2e.py            # Full pipeline test (MockLLM)
├── frontend/
│   ├── package.json               # React 18 + Vite 6
│   ├── Dockerfile                 # node:20-alpine
│   ├── vite.config.js             # Proxy /api → backend:8000
│   └── src/
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── Job.jsx
│       │   ├── History.jsx
│       │   └── Settings.jsx
│       ├── components/
│       │   ├── AgentPipelineGraph.jsx  # ReactFlow pipeline viz
│       │   ├── AgentDrawer.jsx
│       │   ├── Navbar.jsx
│       │   ├── Layout.jsx
│       │   └── Button.jsx
│       └── animations/            # 7 Lottie JSON placeholders
├── docker-compose.yml             # backend + frontend + n8n
├── .github/workflows/deploy.yml   # CI/CD to Heroku
├── test_backend_routes.py         # 9 API smoke tests (pytest)
└── README.md                      # Full setup & API documentation
```

---

## ✅ Changes Completed (13-Prompt Overhaul)

### Phase 3 — Backend Fixes

| # | Task | Status | Details |
|---|------|--------|---------|
| P1 | Fix requirements.txt | ✅ Done | Removed `sqlalchemy`, `aiosqlite`, `alembic` (banned per .cursorrules) |
| P2 | Remove dead code + fix normalizer | ✅ Done | Deprecated `db.py` & `context_store.py`; added `repo_name`/`repo_private` defaults to normalizer |
| P3 | Fix github_agent identities call | ✅ Done | Safe `.get()` for token, clear error on missing token, fixed username extraction |
| P4 | Phase 3A tests | ✅ Code ready | Requires live Appwrite to execute |

### Phase 4 — Frontend Fixes

| # | Task | Status | Details |
|---|------|--------|---------|
| P5 | Animation placeholders | ✅ Done | All 7 Lottie JSONs already existed |
| P6 | Dockerfile + CSS import | ✅ Done | `node:20-alpine`, `@xyflow/react/dist/style.css` |
| P7 | Job.jsx code tab | ✅ Done | Replaced fake viewer with empty state + download button; removed unused imports |

### Phase 5 — Tests

| # | Task | Status | Details |
|---|------|--------|---------|
| P8 | E2E pipeline test | ✅ Created | `backend/tests/test_e2e.py` with MockLLM, `--real-llm` flag |
| P9 | API smoke tests | ✅ **9/9 passing** | `test_backend_routes.py` — mocked auth, all endpoints |

### Phase 6 — Deployment

| # | Task | Status | Details |
|---|------|--------|---------|
| P10 | Fix deploy.yml | ✅ Done | Heroku v3.13.15, config vars, node 20, workflow_dispatch |
| P11 | Appwrite setup script | ✅ Created | `backend/scripts/setup_appwrite.py` — idempotent |

### Phase 7 — Documentation

| # | Task | Status | Details |
|---|------|--------|---------|
| P12 | README rewrite | ✅ Done | Tech stack, setup guide, Mermaid diagram, API reference |
| P13 | Pre-deploy checklist | ✅ Created | `backend/scripts/pre_deploy_check.py` — 10 checks |

---

## 🧪 Test Results

### API Route Tests (`test_backend_routes.py`)

```
test_backend_routes.py::test_health                PASSED
test_backend_routes.py::test_list_jobs_empty        PASSED
test_backend_routes.py::test_create_job_no_keys     PASSED
test_backend_routes.py::test_get_job_not_found      PASSED
test_backend_routes.py::test_list_keys_empty        PASSED
test_backend_routes.py::test_upsert_key             PASSED
test_backend_routes.py::test_delete_key_not_found   PASSED
test_backend_routes.py::test_test_key_not_found     PASSED
test_backend_routes.py::test_jobs_requires_auth     PASSED
────────────────────────────────────────────────────
9 passed, 23 warnings in 20.33s
```

### Phase 3A Tests (`backend/tests/test_phase3a.py`)

| # | Test | Status |
|---|------|--------|
| 1 | Appwrite has all 5 required collections | ⏳ Needs Appwrite |
| 2 | Encryption round-trip | ⏳ Needs `FERNET_KEY` |
| 3 | Normalizer produces valid state | ⏳ Needs Appwrite |
| 4 | LLMRouter raises on empty providers | ⏳ Needs env |
| 5 | Appwrite event publish works | ⏳ Needs Appwrite |
| 6 | Publish rejects invalid event types | ⏳ Needs Appwrite |
| 7 | can_run_job returns True for fresh user | ⏳ Needs Appwrite |
| 8 | Graph compiles and pipeline runs | ⏳ Needs Appwrite |
| 9 | Pipeline emits events | ⏳ Needs Appwrite |
| 10 | All 7 agents ran | ⏳ Needs Appwrite |

---

## 📦 Key Dependencies

### Backend (Python 3.11.7)

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.115.6 | REST API framework |
| uvicorn | 0.34.0 | ASGI server |
| langgraph | 0.2.60 | Agent pipeline orchestration |
| openai | 1.58.1 | LLM API client |
| chromadb | 0.5.23 | Vector store (RAG) |
| sentence-transformers | 3.3.1 | Embeddings |
| appwrite | ≥6.0.0 | BaaS (auth, database, storage) |
| cryptography | 44.0.0 | Fernet encryption for API keys |
| pydantic-settings | 2.7.1 | Configuration management |

### Frontend (Node 20)

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.3.x | UI framework |
| vite | 6.0.x | Build tool & dev server |
| zustand | latest | State management |
| @xyflow/react | 12.x | Pipeline graph visualization |
| appwrite | latest | Client SDK for auth |
| framer-motion | latest | Animations |
| tailwindcss | latest | Utility CSS |

---

## ⚠️ Known Issues / Tech Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| `backend/.env.example` has legacy fields | Low | `DATABASE_URL`, `JWT_SECRET_KEY`, `GITHUB_CLIENT_ID/SECRET` — unused but present |
| `backend/src/store/db.py` deprecated | Low | Content replaced with comment; file kept to avoid import breakage |
| `backend/src/store/context_store.py` deprecated | Low | Same as above |
| `backend/src/core/config.py` legacy fields | Low | Still defines unused SQLite/JWT/GitHub OAuth config |
| Phase 3A/E2E tests untested | Medium | Require live Appwrite instance + credentials |
| Frontend build not verified locally | Medium | `npm run build` needs to be run |
| `hackfarmer.db` may exist | Low | SQLite artifact from old code — can be deleted |

---

## 🚀 Next Steps (Pre-Deployment)

1. **Set up Appwrite** — Run `python backend/scripts/setup_appwrite.py` with credentials
2. **Run pre-deploy checks** — `python backend/scripts/pre_deploy_check.py`
3. **Verify frontend build** — `cd frontend && npm install && npm run build`
4. **Run Phase 3A tests** — `cd backend && python -m pytest tests/test_phase3a.py -v`
5. **Clean up legacy config** — Remove unused env vars from `.env.example` and `config.py`
6. **Deploy** — Push to trigger `.github/workflows/deploy.yml` or use `docker-compose up`

---

## 🔐 Required Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `APPWRITE_ENDPOINT` | ✅ | Appwrite API URL |
| `APPWRITE_PROJECT_ID` | ✅ | Appwrite project ID |
| `APPWRITE_API_KEY` | ✅ | Appwrite server API key |
| `APPWRITE_DATABASE_ID` | ✅ | Database ID |
| `APPWRITE_BUCKET_ID` | ✅ | Storage bucket ID |
| `FERNET_KEY` | ✅ | Encryption key for user API keys |
| `FRONTEND_URL` | ✅ | Frontend URL for CORS |
| `MAX_CONCURRENT_JOBS` | ❌ | Default: 3 |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_APPWRITE_ENDPOINT` | ✅ | Appwrite API URL |
| `VITE_APPWRITE_PROJECT_ID` | ✅ | Appwrite project ID |
| `VITE_API_BASE_URL` | ✅ | Backend API URL |
