"""
api/routes/dfo.py
DFO-only endpoints.
GET  /api/dfo/dashboard        — aggregated KPIs
GET  /api/dfo/investigations   — all investigations (investigations ≈ flags)
GET  /api/dfo/investigations/{case_id}
POST /api/dfo/investigations   — create a new investigation from a flag
PATCH /api/dfo/investigations/{case_id}/assign
GET  /api/dfo/institutions     — middlemen/institutions list
GET  /api/dfo/verifiers        — available scheme verifiers
GET  /api/dfo/students         — beneficiary list
GET  /api/dfo/student/{id}     — single beneficiary detail
"""
import json
import os
import uuid
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import require_role
from ..seed import DEMO_OFFICERS
from models import CaseStatus, InvestigationModel

router = APIRouter(prefix="/api/dfo", tags=["dfo"])

DATA_PATH = os.getenv("DATA_PATH", "./data")

# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_json(filename: str, default=None):
    try:
        with open(os.path.join(DATA_PATH, filename), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default if default is not None else []


def _get_db():
    try:
        from database import get_db
        return get_db()
    except Exception as e:
        raise HTTPException(503, f"Database unavailable: {e}")


def _col(name: str):
    db = _get_db()
    return db[name] if db is not None else None


def _get_open_flag(flag_id: str):
    col = _col("flags")
    if col is None:
        return None
    try:
        return col.find_one({"flag_id": flag_id, "status": CaseStatus.OPEN.value}, {"_id": 0})
    except Exception:
        return None


def _get_investigation(case_id: str):
    col = _col("investigations")
    if col is None:
        return None
    try:
        return col.find_one(
            {"$or": [{"case_id": case_id}, {"investigation_id": case_id}, {"flag_id": case_id}]},
            {"_id": 0},
        )
    except Exception:
        return None


class InvestigationCreateRequest(BaseModel):
    flag_id: str
    verifier_id: Optional[str] = None


def _promote_flag_to_investigation(flag_id: str, verifier_id: Optional[str], assigned_by: str):
    flag_doc = _get_open_flag(flag_id)
    if not flag_doc:
        raise HTTPException(404, "Open flag not found")

    investigation_id = f"INV-{uuid.uuid4().hex[:10].upper()}"
    now = __import__("datetime").datetime.utcnow().isoformat()
    investigation = InvestigationModel(
        investigation_id=investigation_id,
        flag_id=flag_doc["flag_id"],
        beneficiary_id=flag_doc.get("beneficiary_id"),
        status=CaseStatus.ASSIGNED_TO_VERIFIER if verifier_id else CaseStatus.OPEN,
        assigned_verifier_id=verifier_id,
        created_at=__import__("datetime").datetime.utcnow(),
        updated_at=__import__("datetime").datetime.utcnow(),
    ).model_dump()
    investigation["case_id"] = investigation_id
    investigation.update({k: v for k, v in flag_doc.items() if k not in {"_id"}})
    investigation["flag_id"] = flag_doc["flag_id"]
    investigation["status"] = (CaseStatus.ASSIGNED_TO_VERIFIER.value if verifier_id else CaseStatus.OPEN.value)
    investigation["assigned_verifier_id"] = verifier_id
    investigation["assigned_by"] = assigned_by
    investigation["assigned_at"] = now if verifier_id else None

    inv_col = _col("investigations")
    flag_col = _col("flags")
    if inv_col is None or flag_col is None:
        raise HTTPException(503, "Database unavailable")

    try:
        inv_col.insert_one(investigation)
        flag_col.update_one(
            {"flag_id": flag_id},
            {"$set": {"status": investigation["status"], "promoted_to_investigation": True, "investigation_id": investigation_id}},
        )
    except Exception as exc:
        raise HTTPException(503, f"Database unavailable: {exc}")

    return investigation


# ── Fallback data ─────────────────────────────────────────────────────────────

FALLBACK_INSTITUTIONS = [
    {"institution_id": "INST-001", "name": "Sarvodaya Bank (Gujarat Rural Co-op)", "type": "BANK", "taluka": "Sanand", "district": "Ahmedabad", "beneficiary_count": 342, "risk_profile": {"risk_score": 82, "is_flagged": True, "flag_reason": "Delayed disbursement to 67 students — avg 18 days post-credit"}, "financial_ledger": {"current_holding": 1850000, "total_funds_credited": 8500000}},
    {"institution_id": "INST-002", "name": "Shri Gyan School (UDISE 24010023)", "type": "SCHOOL", "taluka": "Daskroi", "district": "Ahmedabad", "beneficiary_count": 218, "risk_profile": {"risk_score": 76, "is_flagged": True, "flag_reason": "14 students marked enrolled despite death records"}, "financial_ledger": {"current_holding": 1240000, "total_funds_credited": 5200000}},
    {"institution_id": "INST-003", "name": "National Bank of Gujarat (Branch 42)", "type": "BANK", "taluka": "Viramgam", "district": "Ahmedabad", "beneficiary_count": 198, "risk_profile": {"risk_score": 54, "is_flagged": False, "flag_reason": None}, "financial_ledger": {"current_holding": 980000, "total_funds_credited": 3800000}},
    {"institution_id": "INST-004", "name": "Pragati Vidyalaya (UDISE 24020041)", "type": "SCHOOL", "taluka": "Sachin", "district": "Surat", "beneficiary_count": 289, "risk_profile": {"risk_score": 67, "is_flagged": True, "flag_reason": "23 cross-scheme payments processed through single bank account"}, "financial_ledger": {"current_holding": 1560000, "total_funds_credited": 6200000}},
]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def dfo_dashboard(user: dict = Depends(require_role("DFO"))):
    """DFO dashboard — aggregated KPIs from the flag store + beneficiary counts."""
    flags_col = _col("flags")
    flags: list = []
    if flags_col is not None:
        try:
            flags = list(flags_col.find({}, {"_id": 0}))
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")

    # Try MongoDB first for beneficiary / payment counts
    ben_col = _col("beneficiaries")
    pay_col = _col("payment_ledger")
    total_ben = 0
    total_pay = 0
    if ben_col is not None:
        try:
            total_ben = ben_col.count_documents({})
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")
    if pay_col is not None:
        try:
            total_pay = pay_col.count_documents({})
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")
    # Fallback to JSON if MongoDB returned 0
    if total_ben == 0:
        total_ben = len(_load_json("beneficiaries.json"))
    if total_pay == 0:
        total_pay = len(_load_json("payment_ledger.json"))

    total_at_risk = sum(f.get("payment_amount", 0) or 0 for f in flags)
    by_type       = defaultdict(int)
    by_label      = defaultdict(int)
    for f in flags:
        by_type[f.get("leakage_type", "UNKNOWN")] += 1
        by_label[f.get("risk_label", "UNKNOWN")]  += 1

    return {
        "officer":          {"id": user["sub"], "name": user["name"], "district": user.get("district")},
        "total_beneficiaries": total_ben,
        "total_payments":   total_pay,
        "total_flags":      len(flags),
        "total_at_risk":    total_at_risk,
        "flags_by_type":    dict(by_type),
        "flags_by_label":   dict(by_label),
        "open_flags":       sum(1 for f in flags if f.get("status") == "OPEN"),
        "resolved_flags":   sum(1 for f in flags if f.get("status") == "RESOLVED"),
    }


@router.get("/investigations")
async def list_investigations(
    status:  Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    leakage_type: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(require_role("DFO", "SCHEME_VERIFIER", "AUDIT")),
):
    query: dict = {}
    if status:
        query["status"] = status
    if district:
        query["district"] = district
    if leakage_type:
        query["leakage_type"] = leakage_type

    cases: list = []
    total = 0

    if status and status != CaseStatus.OPEN.value:
        col = _col("investigations")
        if col is None:
            raise HTTPException(503, "Database unavailable")
        try:
            total = col.count_documents(query)
            cases = list(col.find(query, {"_id": 0}).sort("risk_score", -1).skip(skip).limit(limit))
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")
        return {"total": total, "cases": cases}

    flag_col = _col("flags")
    inv_col = _col("investigations")
    if flag_col is None and inv_col is None:
        raise HTTPException(503, "Database unavailable")

    try:
        if flag_col is not None:
            flag_query = dict(query)
            flag_query["$or"] = [
                {"status": {"$exists": False}},
                {"status": CaseStatus.OPEN.value},
            ]
            flags = list(flag_col.find(flag_query, {"_id": 0}).sort("risk_score", -1))
            cases.extend(flags)
            total += flag_col.count_documents(flag_query)

        if inv_col is not None:
            inv_query = dict(query)
            inv_query["status"] = {"$ne": CaseStatus.OPEN.value}
            investigations = list(inv_col.find(inv_query, {"_id": 0}).sort("risk_score", -1))
            cases.extend(investigations)
            total += inv_col.count_documents(inv_query)
    except Exception as exc:
        raise HTTPException(503, f"Database unavailable: {exc}")

    cases = sorted(cases, key=lambda item: item.get("risk_score", 0), reverse=True)
    return {"total": total, "cases": cases[skip:skip + limit]}


@router.get("/investigations/{case_id}")
async def get_investigation(case_id: str, user: dict = Depends(require_role("DFO"))):
    doc = _get_investigation(case_id)
    if doc:
        return doc

    flag_col = _col("flags")
    if flag_col is not None:
        try:
            doc = flag_col.find_one({"flag_id": case_id}, {"_id": 0})
            if doc:
                return doc
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")
    raise HTTPException(404, "Case not found")


@router.post("/investigations")
async def create_investigation(
    body: InvestigationCreateRequest,
    user: dict = Depends(require_role("DFO")),
):
    return _promote_flag_to_investigation(body.flag_id, body.verifier_id, user["sub"])


@router.patch("/investigations/{case_id}/assign")
async def assign_investigation(
    case_id: str,
    body: dict,
    user: dict = Depends(require_role("DFO")),
):
    verifier_id = body.get("verifier_id")
    if not verifier_id:
        raise HTTPException(400, "verifier_id is required")

    investigation = _get_investigation(case_id)
    if not investigation:
        investigation = _promote_flag_to_investigation(case_id, verifier_id, user["sub"])
        return investigation

    update = {
        "status": CaseStatus.ASSIGNED_TO_VERIFIER.value,
        "assigned_verifier_id": verifier_id,
        "assigned_by": user["sub"],
        "assigned_at": __import__("datetime").datetime.utcnow().isoformat(),
    }
    inv_col = _col("investigations")
    flag_col = _col("flags")
    if inv_col is None or flag_col is None:
        raise HTTPException(503, "Database unavailable")
    try:
        inv_col.update_one({"$or": [{"case_id": case_id}, {"investigation_id": case_id}, {"flag_id": case_id}]}, {"$set": update})
        flag_col.update_one({"flag_id": investigation.get("flag_id", case_id)}, {"$set": update})
    except Exception as exc:
        raise HTTPException(503, f"Database unavailable: {exc}")
    return {"case_id": case_id, **update}


@router.get("/institutions")
async def get_institutions(
    flagged_only: bool = False,
    user: dict = Depends(require_role("DFO")),
):
    col = _col("institutions")
    query = {"risk_profile.is_flagged": True} if flagged_only else {}
    if col is not None:
        try:
            docs = list(col.find(query, {"_id": 0}))
            if docs:
                return docs
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")

    data = FALLBACK_INSTITUTIONS
    if flagged_only:
        data = [i for i in data if i["risk_profile"]["is_flagged"]]
    return data


@router.get("/verifiers")
async def get_verifiers(user: dict = Depends(require_role("DFO"))):
    col = _col("officers")
    if col is not None:
        try:
            docs = list(col.find({"role": "SCHEME_VERIFIER", "is_active": True}, {"_id": 0, "password_hash": 0}))
            if docs:
                return docs
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")
    return [
        {k: v for k, v in o.items() if k != "plain_password"}
        for o in DEMO_OFFICERS
        if o["role"] == "SCHEME_VERIFIER"
    ]


@router.get("/students")
async def get_students(
    district: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    user: dict = Depends(require_role("DFO")),
):
    col = _col("beneficiaries")
    query = {"district": district} if district else {}
    if col is not None:
        try:
            docs = list(col.find(query, {"_id": 0}).skip(skip).limit(limit))
            total = col.count_documents(query)
            return {"total": total, "students": docs}
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")
    raw = _load_json("beneficiaries.json")
    if district:
        raw = [b for b in raw if b.get("district") == district]
    return {"total": len(raw), "students": raw[skip:skip+limit]}


@router.get("/student/{beneficiary_id}")
async def get_student(beneficiary_id: str, user: dict = Depends(require_role("DFO"))):
    col = _col("beneficiaries")
    if col is not None:
        try:
            doc = col.find_one({"beneficiary_id": beneficiary_id}, {"_id": 0})
            if doc:
                return doc
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")
    for item in _load_json("beneficiaries.json"):
        if item.get("beneficiary_id") == beneficiary_id:
            return item
    raise HTTPException(404, "Beneficiary not found")
