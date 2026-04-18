"""
api/routes/admin.py
State Admin-only endpoints.
GET   /api/admin/overview         — state-level KPIs
GET   /api/admin/district-stats   — per-district heatmap
GET   /api/admin/schemes          — all scheme configs
PATCH /api/admin/schemes/{id}     — update scheme rules
GET   /api/admin/officers         — list all officers
"""
import json
import os
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import require_role

router = APIRouter(prefix="/api/admin", tags=["admin"])

DATA_PATH = os.getenv("DATA_PATH", "./data")


def _load_json(filename: str, default=None):
    try:
        with open(os.path.join(DATA_PATH, filename), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default if default is not None else []


def _get_db():
    try:
        from database import get_db, is_mongo_available
        return get_db() if is_mongo_available() else None
    except Exception:
        return None


def _col(name: str):
    db = _get_db()
    return db[name] if db else None


# ── Fallback district stats ───────────────────────────────────────────────────

FALLBACK_DISTRICT_STATS = [
    {"district": "Ahmedabad",   "total_flags": 89, "deceased": 12, "duplicate": 31, "undrawn": 34, "cross_scheme": 12, "amount_at_risk": 2355000},
    {"district": "Surat",       "total_flags": 67, "deceased": 8,  "duplicate": 22, "undrawn": 27, "cross_scheme": 10, "amount_at_risk": 1750000},
    {"district": "Vadodara",    "total_flags": 42, "deceased": 5,  "duplicate": 18, "undrawn": 14, "cross_scheme": 5,  "amount_at_risk": 1100000},
    {"district": "Rajkot",      "total_flags": 35, "deceased": 4,  "duplicate": 13, "undrawn": 12, "cross_scheme": 6,  "amount_at_risk": 875000},
    {"district": "Gandhinagar", "total_flags": 14, "deceased": 2,  "duplicate": 4,  "undrawn": 7,  "cross_scheme": 1,  "amount_at_risk": 340000},
    {"district": "Bhavnagar",   "total_flags": 12, "deceased": 2,  "duplicate": 3,  "undrawn": 6,  "cross_scheme": 1,  "amount_at_risk": 290000},
    {"district": "Jamnagar",    "total_flags": 9,  "deceased": 1,  "duplicate": 3,  "undrawn": 4,  "cross_scheme": 1,  "amount_at_risk": 210000},
    {"district": "Junagadh",    "total_flags": 7,  "deceased": 1,  "duplicate": 2,  "undrawn": 4,  "cross_scheme": 0,  "amount_at_risk": 180000},
    {"district": "Anand",       "total_flags": 6,  "deceased": 1,  "duplicate": 2,  "undrawn": 2,  "cross_scheme": 1,  "amount_at_risk": 145000},
    {"district": "Mehsana",     "total_flags": 5,  "deceased": 0,  "duplicate": 2,  "undrawn": 3,  "cross_scheme": 0,  "amount_at_risk": 125000},
    {"district": "Patan",       "total_flags": 4,  "deceased": 1,  "duplicate": 1,  "undrawn": 2,  "cross_scheme": 0,  "amount_at_risk": 95000},
    {"district": "Banaskantha", "total_flags": 3,  "deceased": 0,  "duplicate": 1,  "undrawn": 2,  "cross_scheme": 0,  "amount_at_risk": 75000},
]

FALLBACK_SCHEMES = [
    {"scheme_id": "NLY",   "name": "Namo Lakshmi Yojana",                   "status": "ACTIVE", "eligibility_rules": {"gender": ["F"], "standards": [9,10,11,12], "streams": None, "min_marks_pct": None, "amount_fixed": 25000}, "mutual_exclusions": ["NSVSY"]},
    {"scheme_id": "NSVSY", "name": "Namo Saraswati Vigyan Sadhana Yojana",  "status": "ACTIVE", "eligibility_rules": {"gender": ["F"], "standards": [11,12], "streams": ["Science"], "min_marks_pct": None, "amount_fixed": 10000}, "mutual_exclusions": ["NLY"]},
    {"scheme_id": "MGMS",  "name": "Mukhyamantri Gyan Sadhana Merit Scholarship", "status": "ACTIVE", "eligibility_rules": {"gender": None, "standards": [9,10,11,12], "streams": None, "min_marks_pct": 75.0, "amount_tiers": [{"min_marks": 90,"amount": 20000}, {"min_marks": 80,"amount": 10000}, {"min_marks": 75,"amount": 5000}]}, "mutual_exclusions": []},
]


# ── Pydantic models ───────────────────────────────────────────────────────────

class SchemeUpdateBody(BaseModel):
    status:              Optional[str]  = None
    eligibility_rules:   Optional[dict] = None
    mutual_exclusions:   Optional[list] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/overview")
async def state_overview(user: dict = Depends(require_role("STATE_ADMIN"))):
    flags_col = _col("flags")
    flags: list = []
    if flags_col:
        try:
            flags = list(flags_col.find({}, {"_id": 0}))
        except Exception:
            pass

    beneficiaries = _load_json("beneficiaries.json")
    payments      = _load_json("payment_ledger.json")
    total_at_risk = sum(f.get("payment_amount", 0) or 0 for f in flags)
    by_label      = defaultdict(int)
    for f in flags:
        by_label[f.get("risk_label", "UNKNOWN")] += 1

    return {
        "total_beneficiaries": len(beneficiaries),
        "total_payments":      len(payments),
        "total_flags":         len(flags),
        "total_at_risk":       total_at_risk,
        "flags_by_label":      dict(by_label),
        "schemes_active":      3,
        "districts_affected":  len({f.get("district") for f in flags if f.get("district")}),
    }


@router.get("/district-stats")
async def district_stats(user: dict = Depends(require_role("STATE_ADMIN"))):
    flags_col = _col("flags")
    if flags_col:
        try:
            flags = list(flags_col.find({}, {"_id": 0}))
            if flags:
                agg: dict = {}
                for f in flags:
                    d = f.get("district", "Unknown")
                    lt = f.get("leakage_type", "")
                    amt = f.get("payment_amount", 0) or 0
                    if d not in agg:
                        agg[d] = {"district": d, "total_flags": 0, "deceased": 0, "duplicate": 0, "undrawn": 0, "cross_scheme": 0, "amount_at_risk": 0}
                    agg[d]["total_flags"] += 1
                    agg[d]["amount_at_risk"] += amt
                    key = {"DECEASED": "deceased", "DUPLICATE": "duplicate", "UNDRAWN": "undrawn", "CROSS_SCHEME": "cross_scheme"}.get(lt)
                    if key:
                        agg[d][key] += 1
                return sorted(agg.values(), key=lambda x: x["total_flags"], reverse=True)
        except Exception:
            pass
    return FALLBACK_DISTRICT_STATS


@router.get("/schemes")
async def get_schemes(user: dict = Depends(require_role("STATE_ADMIN"))):
    col = _col("schemes")
    if col:
        try:
            docs = list(col.find({}, {"_id": 0}))
            if docs:
                return docs
        except Exception:
            pass
    raw = _load_json("scheme_rules.json")
    if isinstance(raw, dict):
        return [{"scheme_id": k, **v} for k, v in raw.items()] or FALLBACK_SCHEMES
    return raw or FALLBACK_SCHEMES


@router.patch("/schemes/{scheme_id}")
async def update_scheme(
    scheme_id: str,
    body: SchemeUpdateBody,
    user: dict = Depends(require_role("STATE_ADMIN")),
):
    update: dict = {}
    if body.status:
        update["status"] = body.status
    if body.eligibility_rules:
        update["eligibility_rules"] = body.eligibility_rules
    if body.mutual_exclusions is not None:
        update["mutual_exclusions"] = body.mutual_exclusions

    col = _col("schemes")
    if col:
        try:
            col.update_one({"scheme_id": scheme_id}, {"$set": update}, upsert=True)
            return col.find_one({"scheme_id": scheme_id}, {"_id": 0})
        except Exception:
            pass

    base = next((s for s in FALLBACK_SCHEMES if s["scheme_id"] == scheme_id), None)
    if not base:
        raise HTTPException(404, f"Scheme {scheme_id} not found")
    return {**base, **update}


@router.get("/officers")
async def list_officers(user: dict = Depends(require_role("STATE_ADMIN"))):
    from ..seed import DEMO_OFFICERS
    col = _col("officers")
    if col:
        try:
            docs = list(col.find({}, {"_id": 0, "password_hash": 0}))
            if docs:
                return docs
        except Exception:
            pass
    return [{k: v for k, v in o.items() if k != "plain_password"} for o in DEMO_OFFICERS]
