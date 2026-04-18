"""
database.py — MongoDB Atlas connection singleton for EduGuard DBT.

Connection string and database name are read from environment variables:
    MONGO_URI       (default: mongodb://localhost:27017)
    MONGO_DB_NAME   (default: eduguard_dbt)

If the connection fails, callers should fall back to JSON files.
"""

import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

_client = None
_db = None

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://localhost:27017",
)
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "eduguard_dbt")


def get_client():
    """Lazy-initialised MongoClient singleton."""
    global _client
    if _client is None:
        from pymongo import MongoClient

        _client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000,   # fail fast if Atlas unreachable
            connectTimeoutMS=5000,
            tls=True,
            tlsAllowInvalidCertificates=False,
        )
        # Force a round-trip so connection errors surface immediately.
        _client.admin.command("ping")
    return _client


def get_db():
    """Return the application database."""
    global _db
    if _db is None:
        _db = get_client()[MONGO_DB_NAME]
    return _db


# ---- Collection accessors -------------------------------------------------

def get_students_collection():
    return get_db()["students"]


def get_payments_collection():
    return get_db()["payments"]


def get_deaths_collection():
    return get_db()["death_registry"]


def get_flags_collection():
    return get_db()["flags"]


# ---- Health check ----------------------------------------------------------

def is_mongo_available() -> bool:
    """Return True if MongoDB Atlas is reachable."""
    try:
        get_client().admin.command("ping")
        return True
    except Exception:
        return False


def close_connection():
    """Explicitly close the client (useful in scripts / tests)."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
