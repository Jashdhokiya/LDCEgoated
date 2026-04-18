"""
api/seed.py
Seeds demo officer/user accounts into MongoDB on startup.
Also provides the DEMO_OFFICERS constant used as a fallback
when MongoDB is unavailable.
"""
from .auth import hash_password

# ── Demo accounts (role → account record) ────────────────────────────────────
# Passwords are stored as bcrypt hashes in MongoDB;
# the plain-text is listed here ONLY for auto-seeding and fallback login.

DEMO_OFFICERS = [
    {
        "officer_id":   "OFF-1042",
        "name":         "Sanjay Desai",
        "role":         "DFO",
        "email":        "dfo@eduguard.in",
        "plain_password": "dfo@1234",
        "district":     "Ahmedabad",
        "jurisdiction": {"level": "DISTRICT", "region_code": "Ahmedabad"},
        "contact":      {"email": "sanjay.dfo@gujarat.gov.in", "phone": "+919876543210"},
        "is_active":    True,
        "active_cases": 0,
    },
    {
        "officer_id":   "OFF-0001",
        "name":         "Rekha Sharma",
        "role":         "STATE_ADMIN",
        "email":        "admin@eduguard.in",
        "plain_password": "admin@1234",
        "district":     "Gandhinagar",
        "jurisdiction": {"level": "STATE", "region_code": "Gujarat"},
        "contact":      {"email": "admin@eduguard.in", "phone": "+919876500001"},
        "is_active":    True,
        "active_cases": 0,
    },
    {
        "officer_id":   "OFF-2091",
        "name":         "Pooja Rathod",
        "role":         "SCHEME_VERIFIER",
        "email":        "verifier@eduguard.in",
        "plain_password": "verifier@1234",
        "district":     "Ahmedabad",
        "jurisdiction": {"level": "DISTRICT", "region_code": "Ahmedabad"},
        "contact":      {"email": "pooja.verifier@gujarat.gov.in", "phone": "+919876543211"},
        "is_active":    True,
        "active_cases": 3,
    },
    {
        "officer_id":   "OFF-3011",
        "name":         "Amit Joshi",
        "role":         "AUDIT",
        "email":        "audit@eduguard.in",
        "plain_password": "audit@1234",
        "district":     "Gandhinagar",
        "taluka":       "Kalol",
        "jurisdiction": {"level": "STATE", "region_code": "Gujarat"},
        "contact":      {"email": "amit.audit@gujarat.gov.in", "phone": "+919876543212"},
        "is_active":    True,
        "active_cases": 0,
    },
    {
        "officer_id":   "USR-GJ-001",
        "name":         "Karan Patel",
        "role":         "USER",
        "email":        "user@eduguard.in",
        "plain_password": "user@1234",
        "district":     "Ahmedabad",
        "jurisdiction": {"level": "DISTRICT", "region_code": "Ahmedabad"},
        "contact":      {"email": "karan@example.com", "phone": "+919876543213"},
        "is_active":    True,
        "active_cases": 0,
    },
    # Extra verifiers (can log in via officer_id if needed)
    {
        "officer_id":   "OFF-2092",
        "name":         "Mihir Shah",
        "role":         "SCHEME_VERIFIER",
        "email":        "verifier2@eduguard.in",
        "plain_password": "verifier@1234",
        "district":     "Ahmedabad",
        "jurisdiction": {"level": "DISTRICT", "region_code": "Ahmedabad"},
        "contact":      {"email": "mihir.verifier@gujarat.gov.in", "phone": "+919876543214"},
        "is_active":    True,
        "active_cases": 1,
    },
    {
        "officer_id":   "OFF-2093",
        "name":         "Alpa Trivedi",
        "role":         "SCHEME_VERIFIER",
        "email":        "verifier3@eduguard.in",
        "plain_password": "verifier@1234",
        "district":     "Ahmedabad",
        "jurisdiction": {"level": "DISTRICT", "region_code": "Ahmedabad"},
        "contact":      {"email": "alpa.verifier@gujarat.gov.in", "phone": "+919876543215"},
        "is_active":    True,
        "active_cases": 5,
    },
]

# Quick lookup index used by the fallback login path
_EMAIL_INDEX: dict = {}


def _build_index():
    global _EMAIL_INDEX
    for o in DEMO_OFFICERS:
        _EMAIL_INDEX[o["email"]] = o


_build_index()


def get_officer_by_email_fallback(email: str):
    """Returns the officer dict (with plain_password) or None. Used when MongoDB is down."""
    return _EMAIL_INDEX.get(email)


async def seed_officers(db):
    """
    Called once at startup. Inserts each demo officer into MongoDB
    (with hashed password) if they don't already exist.
    Also refreshes password hashes to ensure native bcrypt format.
    """
    if db is None:
        return
    col = db["officers"]
    for officer in DEMO_OFFICERS:
        existing = col.find_one({"email": officer["email"]})
        if not existing:
            doc = {k: v for k, v in officer.items() if k != "plain_password"}
            doc["password_hash"] = hash_password(officer["plain_password"])
            col.insert_one(doc)
            print(f"  [seed] Created officer: {officer['email']} ({officer['role']})")
        else:
            # Refresh password hash to native bcrypt format (fixes passlib->bcrypt migration)
            col.update_one(
                {"officer_id": officer["officer_id"]},
                {"$set": {"password_hash": hash_password(officer["plain_password"])}}
            )
