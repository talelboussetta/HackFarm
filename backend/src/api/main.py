"""
HackFarmer — FastAPI application.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.core.queue_manager import start_queue_poller
from src.appwrite_client import databases

from src.api.routes.auth import router as auth_router
from src.api.routes.jobs import router as jobs_router
from src.api.routes.stream import router as stream_router
from src.api.routes.settings import router as settings_router
from src.api.routes.downloads import router as downloads_router

log = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Startup
    try:
        databases.list_collections(settings.APPWRITE_DATABASE_ID)
        print("✓ Appwrite connected")
    except Exception as e:
        print(f"✗ Appwrite connection failed: {e}")

    poller_task = asyncio.create_task(start_queue_poller())

    yield

    # Shutdown
    poller_task.cancel()
    try:
        await poller_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="HackFarmer API",
    description="Multi-agent hackathon project generator",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.appwrite_project_id = settings.APPWRITE_PROJECT_ID

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(jobs_router) # jobs_router has its own prefix now
app.include_router(stream_router, prefix="/stream", tags=["stream"])
app.include_router(settings_router)
app.include_router(downloads_router, prefix="/api/downloads", tags=["downloads"])


@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/internal/health")
async def internal_health():
    return {"status": "ok", "appwrite": "connected"}
