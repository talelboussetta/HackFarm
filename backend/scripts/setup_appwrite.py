"""
HackFarmer — Appwrite Setup Script.
Creates all required collections, indexes, and storage bucket.

Usage:
    cd backend && python scripts/setup_appwrite.py

Requires APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY in .env.
Idempotent — skips resources that already exist.
"""

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.storage import Storage
from appwrite.permission import Permission
from appwrite.role import Role

# ── Config ────────────────────────────────────────────────────

ENDPOINT = os.getenv("APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1")
PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID", "")
API_KEY = os.getenv("APPWRITE_API_KEY", "")
DATABASE_ID = os.getenv("APPWRITE_DATABASE_ID", "hackfarmer-db")
BUCKET_ID = os.getenv("APPWRITE_ZIP_BUCKET_ID", "generated-zips")

if not PROJECT_ID or not API_KEY:
    print("ERROR: APPWRITE_PROJECT_ID and APPWRITE_API_KEY must be set")
    sys.exit(1)

# ── Client ────────────────────────────────────────────────────

client = Client()
client.set_endpoint(ENDPOINT)
client.set_project(PROJECT_ID)
client.set_key(API_KEY)

databases = Databases(client)
storage = Storage(client)


def collection_exists(db_id: str, coll_id: str) -> bool:
    try:
        databases.get_collection(db_id, coll_id)
        return True
    except Exception:
        return False


def bucket_exists(bucket_id: str) -> bool:
    try:
        storage.get_bucket(bucket_id)
        return True
    except Exception:
        return False


def wait_for_attribute(db_id: str, coll_id: str, key: str, retries: int = 10):
    """Wait for an attribute to become available."""
    for _ in range(retries):
        try:
            attr = databases.get_attribute(db_id, coll_id, key)
            if attr.get("status", "") != "processing":
                return
        except Exception:
            pass
        time.sleep(1)


def create_string_attr(db_id, coll_id, key, size, required=False, default=None):
    try:
        kwargs = {
            "database_id": db_id,
            "collection_id": coll_id,
            "key": key,
            "size": size,
            "required": required,
        }
        if default is not None:
            kwargs["default"] = default
        databases.create_string_attribute(**kwargs)
        wait_for_attribute(db_id, coll_id, key)
        print(f"    + {key} (string, {size})")
    except Exception as e:
        if "already exists" in str(e).lower():
            print(f"    ~ {key} (exists)")
        else:
            print(f"    ! {key}: {e}")


def create_bool_attr(db_id, coll_id, key, required=False, default=None):
    try:
        kwargs = {
            "database_id": db_id,
            "collection_id": coll_id,
            "key": key,
            "required": required,
        }
        if default is not None:
            kwargs["default"] = default
        databases.create_boolean_attribute(**kwargs)
        wait_for_attribute(db_id, coll_id, key)
        print(f"    + {key} (boolean)")
    except Exception as e:
        if "already exists" in str(e).lower():
            print(f"    ~ {key} (exists)")
        else:
            print(f"    ! {key}: {e}")


def create_int_attr(db_id, coll_id, key, required=False, default=None):
    try:
        kwargs = {
            "database_id": db_id,
            "collection_id": coll_id,
            "key": key,
            "required": required,
        }
        if default is not None:
            kwargs["default"] = default
        databases.create_integer_attribute(**kwargs)
        wait_for_attribute(db_id, coll_id, key)
        print(f"    + {key} (integer)")
    except Exception as e:
        if "already exists" in str(e).lower():
            print(f"    ~ {key} (exists)")
        else:
            print(f"    ! {key}: {e}")


def create_index(db_id, coll_id, key, attributes=None, orders=None):
    try:
        attrs = attributes or [key]
        ords = orders or ["ASC"] * len(attrs)
        idx_key = f"idx_{key}" if not attributes else f"idx_{'_'.join(attributes)}"
        databases.create_index(
            database_id=db_id,
            collection_id=coll_id,
            key=idx_key,
            type="key",
            attributes=attrs,
            orders=ords,
        )
        print(f"    + index: {idx_key}")
    except Exception as e:
        if "already exists" in str(e).lower():
            print(f"    ~ index: idx_{key} (exists)")
        else:
            print(f"    ! index {key}: {e}")


# ── Database ──────────────────────────────────────────────────

def ensure_database():
    try:
        databases.get(DATABASE_ID)
        print(f"✓ Database '{DATABASE_ID}' exists")
    except Exception:
        databases.create(DATABASE_ID, DATABASE_ID)
        print(f"+ Created database '{DATABASE_ID}'")


# ── Collections ───────────────────────────────────────────────

def setup_jobs():
    coll_id = "jobs"
    if collection_exists(DATABASE_ID, coll_id):
        print(f"  ✓ Collection '{coll_id}' exists")
        return

    databases.create_collection(
        database_id=DATABASE_ID,
        collection_id=coll_id,
        name="Jobs",
        permissions=[
            Permission.read(Role.users()),
            Permission.create(Role.users()),
            Permission.update(Role.users()),
        ],
    )
    print(f"  + Created collection '{coll_id}'")

    create_string_attr(DATABASE_ID, coll_id, "userId", 36, required=True)
    create_string_attr(DATABASE_ID, coll_id, "status", 20, required=True, default="queued")
    create_string_attr(DATABASE_ID, coll_id, "inputType", 10, required=True)
    create_string_attr(DATABASE_ID, coll_id, "repoName", 100, required=True)
    create_string_attr(DATABASE_ID, coll_id, "jobTitle", 100, required=True)
    create_string_attr(DATABASE_ID, coll_id, "priority", 10, default="low")
    create_bool_attr(DATABASE_ID, coll_id, "repoPrivate", required=True, default=False)
    create_string_attr(DATABASE_ID, coll_id, "githubUrl", 200)
    create_string_attr(DATABASE_ID, coll_id, "zipFileId", 36)
    create_int_attr(DATABASE_ID, coll_id, "retentionDays", default=30)
    create_string_attr(DATABASE_ID, coll_id, "errorMessage", 500)
    create_string_attr(DATABASE_ID, coll_id, "completedAt", 30)

    time.sleep(2)
    create_index(DATABASE_ID, coll_id, "userId")
    create_index(DATABASE_ID, coll_id, "status")


def setup_agent_runs():
    coll_id = "agent-runs"
    if not collection_exists(DATABASE_ID, coll_id):
        databases.create_collection(
            database_id=DATABASE_ID,
            collection_id=coll_id,
            name="Agent Runs",
            permissions=[
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
            ],
        )
        print(f"  + Created collection '{coll_id}'")
    else:
        print(f"  ✓ Collection '{coll_id}' exists — adding missing attributes")

    create_string_attr(DATABASE_ID, coll_id, "jobId", 36, required=True)
    create_string_attr(DATABASE_ID, coll_id, "agentName", 30, required=True)
    create_string_attr(DATABASE_ID, coll_id, "status", 20, default="waiting")
    create_int_attr(DATABASE_ID, coll_id, "retryCount", default=0)
    create_int_attr(DATABASE_ID, coll_id, "runDuration", default=0)
    create_string_attr(DATABASE_ID, coll_id, "outputFormat", 20, default="json")
    create_string_attr(DATABASE_ID, coll_id, "startedAt", 30)
    create_string_attr(DATABASE_ID, coll_id, "completedAt", 30)
    create_string_attr(DATABASE_ID, coll_id, "outputSummary", 500)

    time.sleep(2)
    create_index(DATABASE_ID, coll_id, "jobId")


def setup_user_api_keys():
    coll_id = "user-api-keys"
    if collection_exists(DATABASE_ID, coll_id):
        print(f"  ✓ Collection '{coll_id}' exists")
        return

    databases.create_collection(
        database_id=DATABASE_ID,
        collection_id=coll_id,
        name="User API Keys",
        permissions=[
            Permission.read(Role.users()),
            Permission.create(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users()),
        ],
    )
    print(f"  + Created collection '{coll_id}'")

    create_string_attr(DATABASE_ID, coll_id, "userId", 36, required=True)
    create_string_attr(DATABASE_ID, coll_id, "provider", 20, required=True)
    create_string_attr(DATABASE_ID, coll_id, "encryptedKey", 1000, required=True)
    create_bool_attr(DATABASE_ID, coll_id, "isValid", default=True)
    create_string_attr(DATABASE_ID, coll_id, "lastUsed", 30)

    time.sleep(2)
    create_index(DATABASE_ID, coll_id, "userId")
    create_index(DATABASE_ID, coll_id, "userId_provider",
                 attributes=["userId", "provider"], orders=["ASC", "ASC"])


def setup_job_events():
    coll_id = "job-events"
    if not collection_exists(DATABASE_ID, coll_id):
        databases.create_collection(
            database_id=DATABASE_ID,
            collection_id=coll_id,
            name="Job Events",
            permissions=[
                Permission.read(Role.users()),
                Permission.create(Role.users()),
            ],
        )
        print(f"  + Created collection '{coll_id}'")
    else:
        print(f"  ✓ Collection '{coll_id}' exists — adding missing attributes")

    create_string_attr(DATABASE_ID, coll_id, "jobId", 36, required=True)
    create_string_attr(DATABASE_ID, coll_id, "eventType", 30, required=True)
    create_string_attr(DATABASE_ID, coll_id, "payload", 5000, default="{}")
    create_string_attr(DATABASE_ID, coll_id, "agentName", 30)

    time.sleep(2)
    create_index(DATABASE_ID, coll_id, "jobId")


# ── Storage ───────────────────────────────────────────────────

def setup_storage():
    if bucket_exists(BUCKET_ID):
        print(f"  ✓ Bucket '{BUCKET_ID}' exists")
        return

    storage.create_bucket(
        bucket_id=BUCKET_ID,
        name="Generated ZIPs",
        permissions=[
            Permission.read(Role.users()),
            Permission.create(Role.users()),
        ],
        file_security=True,
        maximum_file_size=50 * 1024 * 1024,  # 50MB
        allowed_file_extensions=["zip"],
        encryption=True,
    )
    print(f"  + Created bucket '{BUCKET_ID}'")


# ── Main ──────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n🌾 HackFarmer — Appwrite Setup\n")
    print(f"  Endpoint:  {ENDPOINT}")
    print(f"  Project:   {PROJECT_ID}")
    print(f"  Database:  {DATABASE_ID}")
    print()

    ensure_database()
    print("\n  Setting up collections...")
    setup_jobs()
    setup_agent_runs()
    setup_user_api_keys()
    setup_job_events()

    print("\n  Setting up storage...")
    setup_storage()

    print("\n✅ Setup complete!\n")
