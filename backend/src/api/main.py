"""
HackFarmer — FastAPI application.
"""

import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from src.core.config import settings
from src.core.queue_manager import start_queue_poller
from src.appwrite_client import databases

from src.api.routes.auth import router as auth_router
from src.api.routes.jobs import router as jobs_router
from src.api.routes.stream import router as stream_router
from src.api.routes.settings import router as settings_router
from src.api.routes.downloads import router as downloads_router
from src.api.routes.admin import router as admin_router

# ── Logging ───────────────────────────────────────────────────
LOG_FORMAT = '%(asctime)s %(levelname)s [%(name)s] %(message)s'
if os.getenv("ENVIRONMENT") == "production":
    logging.basicConfig(level=logging.WARNING, format=LOG_FORMAT)
    logging.getLogger("uvicorn.access").setLevel(logging.ERROR)
    logging.getLogger("httpx").setLevel(logging.WARNING)
else:
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)

log = logging.getLogger(__name__)

# ── Sentry ────────────────────────────────────────────────────
if settings.SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.2,
        send_default_pii=True,
    )
    log.info("Sentry initialized")

# ── Rate limiter ──────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Appwrite SDK is synchronous — run in thread with timeout so startup
    # doesn't hang if Appwrite Cloud is unreachable.
    try:
        await asyncio.wait_for(
            asyncio.to_thread(databases.list_collections, settings.APPWRITE_DATABASE_ID),
            timeout=10.0,
        )
        log.info("Appwrite connected")
    except Exception as e:
        log.error(f"Appwrite connection failed (server will start anyway): {e}")

    # Recover stuck jobs from a previous crash (mark running → failed)
    try:
        from appwrite.query import Query
        stuck = await asyncio.wait_for(
            asyncio.to_thread(
                databases.list_documents,
                settings.APPWRITE_DATABASE_ID, "jobs",
                [Query.equal("status", "running"), Query.limit(50)],
            ),
            timeout=10.0,
        )
        for job in stuck["documents"]:
            await asyncio.to_thread(
                databases.update_document,
                settings.APPWRITE_DATABASE_ID, "jobs", job["$id"],
                {"status": "failed", "errorMessage": "Server restarted — job interrupted"},
            )
            log.warning(f"Recovered stuck job {job['$id']}")
    except Exception as e:
        log.warning(f"Stuck job recovery skipped: {e}")

    poller_task = asyncio.create_task(start_queue_poller())
    yield
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
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────
ALLOWED_ORIGINS = [o.strip() for o in settings.FRONTEND_URL.split(",") if o.strip()]
if not ALLOWED_ORIGINS:
    ALLOWED_ORIGINS = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Appwrite-Session", "Cookie", "Authorization"],
)


# ── Security headers middleware ───────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
    if os.getenv("ENVIRONMENT") == "production":
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response


# ── Request logging middleware ────────────────────────────────
@app.middleware("http")
async def request_logging(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - start) * 1000)
    if not request.url.path.startswith("/health"):
        log.info(
            f"rid={request_id} {request.method} {request.url.path} "
            f"→ {response.status_code} ({elapsed_ms}ms)"
        )
    response.headers["X-Request-Id"] = request_id
    return response


# ── Global exception handler ─────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if os.getenv("ENVIRONMENT", "development") == "production":
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)[:200]},
    )


# ── Routes ────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(stream_router, prefix="/stream", tags=["stream"])
app.include_router(settings_router)
app.include_router(downloads_router, prefix="/api/downloads", tags=["downloads"])
app.include_router(admin_router)


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/internal/health")
async def internal_health():
    return {"status": "ok", "appwrite": "connected"}
