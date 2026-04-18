"""
scripts/fix_verifier_active_cases.py
────────────────────────────────────
Sets active_cases = 0 for all SCHEME_VERIFIER officers.
The seed script was setting random(0,5) which is fake data.

Usage:  python scripts/fix_verifier_active_cases.py
"""
import os, sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent

# Load .env
env_path = ROOT_DIR / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "EduGuard")

if not MONGO_URI:
    print("❌  No MONGO_URI found in .env")
    sys.exit(1)

try:
    from pymongo import MongoClient
except ImportError:
    print("❌  pymongo not installed.")
    sys.exit(1)

print(f"Connecting to MongoDB...")
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[MONGO_DB_NAME]

col = db["officers"]

# Count before
count = col.count_documents({"role": "SCHEME_VERIFIER", "active_cases": {"$ne": 0}})
print(f"   Found {count} SCHEME_VERIFIER officers with non-zero active_cases")

# Update all SCHEME_VERIFIER active_cases to 0
result = col.update_many(
    {"role": "SCHEME_VERIFIER"},
    {"$set": {"active_cases": 0}}
)

print(f"Updated {result.modified_count} SCHEME_VERIFIER officers -> active_cases = 0")

# Verify
remaining = col.count_documents({"role": "SCHEME_VERIFIER", "active_cases": {"$ne": 0}})
print(f"   Remaining with non-zero: {remaining}")

client.close()
print("Done.")
