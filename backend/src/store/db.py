"""
HackFarmer — SQLAlchemy models + async session factory.

Models:
  User, UserApiKey, Job, AgentRun, GeneratedFile, JobEvent

Usage:
  from backend.src.store.db import get_db, create_all
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

from backend.src.core.config import settings

# ── Engine & Session ──────────────────────────────────────────

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite only
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ── Helpers ───────────────────────────────────────────────────

def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Models ────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    github_id = Column(String, unique=True, nullable=False)
    username = Column(String, nullable=False)
    avatar_url = Column(String, default="")
    encrypted_gh_token = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    last_login = Column(DateTime, default=_utcnow)

    # relationships
    api_keys = relationship("UserApiKey", back_populates="user", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")


class UserApiKey(Base):
    __tablename__ = "user_api_keys"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False)  # gemini / groq / openrouter
    encrypted_key = Column(Text, nullable=False)
    is_valid = Column(Boolean, default=True)
    last_used = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="api_keys")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="queued")  # queued/running/complete/partial/failed
    input_type = Column(String, nullable=False)  # text / pdf / docx
    repo_name = Column(String, default="")
    repo_private = Column(Boolean, default=False)
    github_url = Column(String, nullable=True)
    zip_path = Column(String, nullable=True)
    retention_days = Column(Integer, default=30)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="jobs")
    agent_runs = relationship("AgentRun", back_populates="job", cascade="all, delete-orphan")
    generated_files = relationship("GeneratedFile", back_populates="job", cascade="all, delete-orphan")
    events = relationship("JobEvent", back_populates="job", cascade="all, delete-orphan")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(String, primary_key=True, default=_uuid)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)
    agent_name = Column(String, nullable=False)
    status = Column(String, default="waiting")  # waiting/running/done/failed
    retry_count = Column(Integer, default=0)
    started_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)
    output_summary = Column(Text, nullable=True)

    job = relationship("Job", back_populates="agent_runs")


class GeneratedFile(Base):
    __tablename__ = "generated_files"

    id = Column(String, primary_key=True, default=_uuid)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)
    file_path = Column(String, nullable=False)
    agent_name = Column(String, nullable=False)
    size_bytes = Column(Integer, default=0)

    job = relationship("Job", back_populates="generated_files")


class JobEvent(Base):
    __tablename__ = "job_events"

    id = Column(String, primary_key=True, default=_uuid)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)
    event_type = Column(String, nullable=False)
    payload = Column(Text, default="{}")  # stored as JSON string
    created_at = Column(DateTime, default=_utcnow)

    job = relationship("Job", back_populates="events")


# ── Database utilities ────────────────────────────────────────

def create_all() -> None:
    """Create all tables. Called on application startup."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency — yields a DB session and closes it after."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
