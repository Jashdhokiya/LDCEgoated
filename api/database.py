"""
database.py — MongoDB Atlas connection singleton for EduGuard DBT.
"""
import os
from dotenv import load_dotenv

load_dotenv()

_client = None
_db = None

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "EduGuard")



def get_client():
    """Lazy-initialised MongoClient singleton."""
    global _client
    if _client is None:
        from pymongo import MongoClient
        _client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=8000,
            connectTimeoutMS=8000,
        )
        _client.admin.command("ping")
    return _client


def get_db():
    """Return the application database. Raises if Mongo is unavailable."""
    global _db
    if _db is None:
        _db = get_client()[MONGO_DB_NAME]
    return _db


# ---- Safe collection accessors (return None if Mongo is unavailable) --------

def _safe_col(name: str):
    """Return a collection or None if MongoDB is unavailable."""
    try:
        return get_db()[name]
    except Exception:
        return None


def get_students_collection():
    return _safe_col("students")


def get_payments_collection():
    return _safe_col("payments")


def get_deaths_collection():
    return _safe_col("death_registry")


def get_flags_collection():
    return _safe_col("flags")


def get_udise_collection():
    return _safe_col("udise")


def get_institutions_collection():
    return _safe_col("institutions")


def get_officers_collection():
    return _safe_col("officers")


# ---- Health check -----------------------------------------------------------

def is_mongo_available() -> bool:
    """Return True if MongoDB Atlas is reachable."""
    try:
        get_client().admin.command("ping")
        return True
    except Exception:
        return False


def close_connection():
    """Explicitly close the client."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
