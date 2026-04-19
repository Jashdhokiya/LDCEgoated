"""
api/main.py
EduGuard FastAPI application — entry point.

Start with:
    uvicorn api.main:app --reload --port 8000

All routes require a valid JWT Bearer token EXCEPT:
  POST /api/auth/login
  GET  /api/health
"""
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()  # must happen BEFORE importing modules that read env vars

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Route modules ─────────────────────────────────────────────────────────────
from .routes.auth     import router as auth_router
from .routes.analysis import router as analysis_router
from .routes.dfo      import router as dfo_router
from .routes.admin    import router as admin_router
from .routes.verifier import router as verifier_router
from .routes.audit    import router as audit_router
from .routes.user     import router as user_router
from .routes.aadhaar  import router as aadhaar_router


# ── Startup / shutdown lifecycle ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Seed demo officers into MongoDB on startup (if available)."""
    try:
        from .database import get_db, is_mongo_available
        if is_mongo_available():
            db = get_db()
            from .seed import seed_officers
            await seed_officers(db)
            print("[startup] Officer seed complete (MongoDB)")
        else:
            print("[startup] MongoDB unavailable — using demo fallback accounts")
    except Exception as e:
        print(f"[startup] Seed skipped: {e}")
    yield
    # Shutdown — nothing to clean up


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="EduGuard DBT API",
    version="2.0.0",
    description=(
        "Gujarat education scheme fraud detection backend. "
        "All routes except /api/auth/login and /api/health require a Bearer JWT."
    ),
    lifespan=lifespan,
)

# CORS — allow all during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ──────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(analysis_router)
app.include_router(dfo_router)
app.include_router(admin_router)
app.include_router(verifier_router)
app.include_router(audit_router)
app.include_router(user_router)
app.include_router(aadhaar_router)


# ── Public endpoints ──────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    """Public health check — no auth required."""
    try:
        from .database import get_db, is_mongo_available
        mongo_ok = is_mongo_available()
        if mongo_ok:
            db = get_db()
            flag_count  = db["flags"].count_documents({})
            officer_count = db["officers"].count_documents({})
        else:
            flag_count = officer_count = 0
    except Exception:
        mongo_ok = False
        flag_count = officer_count = 0

    return {
        "status":          "ok",
        "version":         "2.0.0",
        "mongo_connected": mongo_ok,
        "flag_count":      flag_count,
        "officer_count":   officer_count,
        "auth_required":   True,
        "demo_credentials": {
            "DFO":            "dfo@eduguard.in / dfo@1234",
            "STATE_ADMIN":    "admin@eduguard.in / admin@1234",
            "SCHEME_VERIFIER":"verifier@eduguard.in / verifier@1234",
            "AUDIT":          "audit@eduguard.in / audit@1234",
            "USER":           "user@eduguard.in / user@1234",
        },
    }


@app.get("/api/public/landing-stats")
async def landing_stats():
    """Public homepage KPIs derived from DB; safe fallback when DB is unavailable."""
    try:
        from .database import get_db, is_mongo_available
        mongo_ok = is_mongo_available()
        if not mongo_ok:
            raise RuntimeError("MongoDB unavailable")

        db = get_db()
        beneficiaries = db["beneficiaries"].count_documents({})
        flags_count = db["flags"].count_documents({})
        districts_count = len(db["beneficiaries"].distinct("district", {"district": {"$nin": [None, ""]}}))

        # Sum payment amounts from flags as amount at risk.
        total_at_risk = 0
        for f in db["flags"].find({}, {"payment_amount": 1, "_id": 0}):
            total_at_risk += f.get("payment_amount", 0) or 0

        return {
            "beneficiaries": beneficiaries,
            "total_amount_at_risk": total_at_risk,
            "flags": flags_count,
            "districts": districts_count,
            "mongo_connected": True,
        }
    except Exception:
        return {
            "beneficiaries": 0,
            "total_amount_at_risk": 0,
            "flags": 0,
            "districts": 0,
            "mongo_connected": False,
        }


@app.get("/")
async def root():
    return {
        "api": "EduGuard DBT v2.0",
        "docs": "/docs",
        "health": "/api/health",
        "login": "POST /api/auth/login",
    }
