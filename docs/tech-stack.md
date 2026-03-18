# HackFarm Technology Stack

This document inventories the technologies used across the HackFarm platform and the feature(s) each one enables.

## Backend (FastAPI + Python 3.11)
- **FastAPI 0.115.6 + Uvicorn 0.34.0** — HTTP API, async routing, dependency injection, CORS (src/api/main.py)
- **pydantic-settings + python-dotenv** — typed env config, secrets loading (src/core/config.py)
- **Slowapi** — lightweight rate limiting middleware (src/api/main.py)
- **Sentry SDK** — optional error monitoring (src/core/config.py, src/api/main.py)

## Agents & Orchestration
- **LangGraph 0.2.60** — StateGraph pipeline: analyst → architect → (frontend_agent | backend_agent | business_agent in parallel) → integrator → validator → conditional github_agent (src/agents/graph.py, src/agents/refine_graph.py)
- **ProjectState TypedDict** — single source of truth for agent state (src/agents/state.py)
- **Event bus** — emits agent_start/agent_thinking/agent_done/agent_failed around every node (src/core/events.py)

## LLM Integration
- **OpenAI SDK 1.58.1** — unified AsyncOpenAI client (src/llm/router.py)
- **Providers** — Gemini (gemini-2.0-flash), Groq (llama-3.3-70b-versatile), OpenRouter (llama-3.3-70b-instruct:free) with priority + fallback chains (src/llm/router.py)
- **Prompt files** — one .txt per agent (src/llm/prompts/*)

## Data, Storage, and Vectors
- **Appwrite 15.3.0** — BaaS for auth + data (src/appwrite_client.py, scripts/setup_appwrite.py)
  - Collections: jobs, agent-runs, user-api-keys, job-events (database: hackfarmer-db)
  - Storage bucket: generated ZIPs
- **ChromaDB + sentence-transformers** — local CPU embeddings and vector store for context (requirements)
- **zipfile (stdlib)** — bundles generated_files into downloadable archives (src/core/zip_builder.py)

## Auth, Security, and Compliance
- **Appwrite OAuth (GitHub provider)** — session cookies validated via Account.get() (src/api/dependencies.py)
- **Cryptography (Fernet)** — encrypt/decrypt user LLM API keys at rest (src/core/encryption.py)
- **PyJWT** — JWT helper (fallback/compat)
- **Validation** — Pydantic on backend, Zod on frontend (hooks and forms)
- **HTML sanitization** — Bleach cleans reveal.js pitch HTML (business agent output)
- **CORS** — configured through FastAPI middleware (src/api/main.py)

## Realtime & Events
- **Appwrite Realtime** — WebSocket feed on job-events collection; publish() syncs Appwrite + frontend (src/core/events.py)
- **useJobStream hook** — subscribes client to agent_start/agent_thinking/agent_done/job_complete/job_failed/job_queued/heartbeat (frontend/src/hooks/useJobStream.js)

## Queueing & Concurrency
- **asyncio.Semaphore** — global max 3 concurrent jobs; per-user 1 running; promotion poller every 30s (src/core/queue_manager.py)

## Document Ingestion
- **PyMuPDF (fitz)** — PDF text extraction (src/ingestion/pdf_parser.py)
- **python-docx** — DOCX text extraction (src/ingestion/docx_parser.py)
- **Normalizer** — unifies raw text into ProjectState (src/ingestion/normalizer.py)

## GitHub Automation
- **httpx-based GitHub client** — create repos, push files via Trees API (src/integrations/github.py)
- **GitHub agent** — pushes deliverables when validation passes (src/agents/github_agent.py)

## Frontend (React 18 + Vite)
- **Vite 6** — dev server and production bundling (frontend/vite.config.js)
- **React 18 + React Router 7** — SPA routes: Landing, Home, Job dashboard, History, Settings, Admin, AgentStage (frontend/src/App.jsx)
- **Zustand** — global app store (frontend/src/store/useAppStore.js)
- **TailwindCSS 3 + PostCSS** — dark glassmorphism design system (frontend/tailwind.config.js, frontend/src/index.css)
- **Framer Motion** — motion/animations with spring physics (components/pages)
- **Radix UI** — accessible dialogs, tooltips, progress (frontend/package.json)
- **lucide-react** — iconography (components/pages)
- **react-dropzone** — file uploads for PDF/DOCX/text (frontend/src/pages/Home.jsx)
- **react-syntax-highlighter + highlight.js** — code preview (frontend/src/components/CodeViewer.jsx)
- **mermaid** — renders architecture graphs (frontend/src/pages/Job.jsx)
- **@xyflow/react** — pipeline visualization (frontend/src/components/AgentPipelineGraph.jsx)
- **Appwrite JS SDK** — OAuth, account checks, Realtime subscription (frontend/src/lib/appwrite.js)
- **sonner + canvas-confetti** — toasts and completion celebration
- **react-markdown + dompurify** — safe README/pitch rendering
- **Zod** — client-side validation
- **Lottie React + lenis** — splash animation and smooth scrolling

## DevOps, Deploy, and Ops
- **Docker / multi-stage builds** — backend Dockerfile (uvicorn), frontend Dockerfile & Dockerfile.prod (Vite build + static serve)
- **docker-compose.yml & docker-compose.prod.yml** — local + prod orchestration for api/frontend
- **Heroku** — Procfile and runtime.txt for backend deployment; container push/release workflow (per last commands)
- **Environment management** — .env files for Appwrite, Fernet key, LLM providers, n8n webhook, GitHub token
- **Pre-deploy script** — validates required services and packages (backend/scripts/pre_deploy_check.py)

## Realtime & Automation Integrations
- **n8n (webhook fire-and-forget)** — optional notifications/cleanup (src/integrations/n8n.py)

## Testing & Quality
- **pytest + pytest-asyncio** — unit and e2e coverage (backend/tests/test_e2e.py, test_phase3a.py, test_security.py)

## Deliverables Generated
- **README content, architecture mermaid, reveal.js pitch slides, code bundles (ZIP)** — produced by agent pipeline, stored via Appwrite and downloadable

## Design System (Frontend)
- **Colors** — background #0a0a0a, surfaces #111/#1a1a1a, borders rgba(255,255,255,0.08), accents blue/green/amber/red
- **Typography** — Space Grotesk (headings), DM Sans (body), JetBrains Mono (code)
- **Card treatment** — glassmorphism (rgba(255,255,255,0.04) + blur)
- **Animation rules** — framer-motion with spring physics; avoid ease-linear for UI elements
