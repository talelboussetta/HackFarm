"""
HackFarmer — FastAPI application.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.src.core.config import settings
from backend.src.store.db import create_all

from backend.src.api.routes.auth import router as auth_router
from backend.src.api.routes.jobs import router as jobs_router
from backend.src.api.routes.stream import router as stream_router
from backend.src.api.routes.settings import router as settings_router
from backend.src.api.routes.downloads import router as downloads_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    create_all()
    yield


app = FastAPI(
    title="HackFarmer API",
    description="Multi-agent hackathon project generator",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(jobs_router, prefix="/api/jobs", tags=["jobs"])
app.include_router(stream_router, prefix="/stream", tags=["stream"])
app.include_router(settings_router)
app.include_router(downloads_router, prefix="/api/downloads", tags=["downloads"])


@app.get("/health")
async def health():
    return {"status": "healthy"}
