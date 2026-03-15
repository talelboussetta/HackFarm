# HackFarmer 🌾

> A multi-agent AI system that generates complete hackathon projects from spec documents.

## What it does

Upload a PDF or describe your hackathon project in text. Seven AI agents run in a directed graph (LangGraph) and produce:
- ✅ Working frontend + backend code
- ✅ A README
- ✅ A reveal.js pitch deck
- ✅ A Mermaid architecture diagram

Output is pushed to a new GitHub repo and available as a ZIP download.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI + Python 3.11 + SQLAlchemy + SQLite |
| **Agents** | LangGraph (StateGraph) — 7 nodes |
| **LLM** | OpenAI SDK (unified — Gemini, Groq, OpenRouter) |
| **Auth** | GitHub OAuth 2.0 + JWT |
| **Frontend** | React 18 + Vite + Tailwind CSS + Framer Motion |
| **Real-time** | Server-Sent Events (SSE) |
| **Automation** | n8n (self-hosted) |

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/hackfarmer.git
cd hackfarmer

# 2. Setup backend
cd backend
cp .env.example .env
# Fill in .env values (see comments in file)
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py

# 3. Setup frontend (new terminal)
cd frontend
npm install
npm run dev

# 4. Or use Docker
docker-compose up
```

## Agent Pipeline

```
analyst → architect → [frontend + backend + business] (parallel)
  → integrator → validator → conditional → github_agent → END
```

## Project Structure

```
hackfarmer/
├── backend/src/
│   ├── api/          # FastAPI routes
│   ├── agents/       # LangGraph agent nodes
│   ├── core/         # Config, encryption, events
│   ├── store/        # SQLAlchemy models
│   ├── llm/          # LLM router + prompt templates
│   ├── ingestion/    # PDF/DOCX parsers
│   └── integrations/ # GitHub API, n8n webhooks
├── frontend/src/
│   ├── pages/        # Route pages
│   ├── components/   # React components
│   ├── hooks/        # Custom hooks
│   ├── store/        # Zustand state
│   └── lib/          # API utilities
├── n8n/workflows/    # n8n workflow exports
├── docker-compose.yml
└── .cursorrules
```

## License

MIT
