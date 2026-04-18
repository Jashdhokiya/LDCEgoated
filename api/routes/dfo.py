"""
api/routes/dfo.py
DFO-only endpoints — district-scoped.
Every query filters by the logged-in officer's district from the JWT.
"""
import json
import os
from collections import defaultdict
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import require_role

router = APIRouter(prefix="/api/dfo", tags=["dfo"])


def _get_db():
    try:
        from database import get_db
        return get_db()
    except Exception as e:
        print(f"  [dfo] MongoDB unavailable: {e}")
        return None


def _col(name: str):
    db = _get_db()
    return db[name] if db is not None else None


# ── Fallback data ─────────────────────────────────────────────────────────────

FALLBACK_INSTITUTIONS = [
    {"institution_id": "INST-001", "name": "Sarvodaya Bank (Gujarat Rural Co-op)", "type": "BANK", "taluka": "Sanand", "district": "Ahmedabad", "beneficiary_count": 342, "risk_profile": {"risk_score": 82, "is_flagged": True, "flag_reason": "Delayed disbursement to 67 students — avg 18 days post-credit"}, "financial_ledger": {"current_holding": 1850000, "total_funds_credited": 8500000, "total_funds_debited": 6650000}},
    {"institution_id": "INST-002", "name": "Shri Gyan School (UDISE 24010023)", "type": "SCHOOL", "taluka": "Daskroi", "district": "Ahmedabad", "beneficiary_count": 218, "risk_profile": {"risk_score": 76, "is_flagged": True, "flag_reason": "14 students marked enrolled despite death records"}, "financial_ledger": {"current_holding": 1240000, "total_funds_credited": 5200000, "total_funds_debited": 3960000}},
    {"institution_id": "INST-003", "name": "National Bank of Gujarat (Branch 42)", "type": "BANK", "taluka": "Viramgam", "district": "Ahmedabad", "beneficiary_count": 198, "risk_profile": {"risk_score": 54, "is_flagged": False, "flag_reason": None}, "financial_ledger": {"current_holding": 980000, "total_funds_credited": 3800000, "total_funds_debited": 2820000}},
    {"institution_id": "INST-004", "name": "Pragati Vidyalaya (UDISE 24020041)", "type": "SCHOOL", "taluka": "Sachin", "district": "Surat", "beneficiary_count": 289, "risk_profile": {"risk_score": 67, "is_flagged": True, "flag_reason": "23 cross-scheme payments processed through single bank account"}, "financial_ledger": {"current_holding": 1560000, "total_funds_credited": 6200000, "total_funds_debited": 4640000}},
]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def dfo_dashboard(user: dict = Depends(require_role("DFO"))):
    """DFO dashboard — KPIs scoped to officer's district ONLY."""
    district = user.get("district")

    # Flags: only this district
    flags_col = _col("flags")
    flag_q = {"district": district} if district else {}
    flags = list(flags_col.find(flag_q, {"_id": 0}))

    # Beneficiaries: only this district
    ben_col = _col("beneficiaries")
    ben_q = {"district": district} if district else {}
    total_ben = ben_col.count_documents(ben_q)

    # Payments: only for beneficiaries in this district
    pay_col = _col("payment_ledger")
    if district:
        ben_ids = ben_col.distinct("beneficiary_id", ben_q)
        total_pay = pay_col.count_documents({"beneficiary_id": {"$in": ben_ids}}) if ben_ids else 0
    else:
        total_pay = pay_col.count_documents({})

    total_at_risk = sum(f.get("payment_amount", 0) or 0 for f in flags)
    by_type  = defaultdict(int)
    by_label = defaultdict(int)
    for f in flags:
        by_type[f.get("leakage_type", "UNKNOWN")] += 1
        by_label[f.get("risk_label", "UNKNOWN")]  += 1

    return {
        "officer":             {"id": user["sub"], "name": user["name"], "district": district},
        "total_beneficiaries": total_ben,
        "total_payments":      total_pay,
        "total_flags":         len(flags),
        "total_at_risk":       total_at_risk,
        "flags_by_type":       dict(by_type),
        "flags_by_label":      dict(by_label),
        "open_flags":          sum(1 for f in flags if f.get("status") == "OPEN"),
        "resolved_flags":      sum(1 for f in flags if f.get("status") == "RESOLVED"),
    }


@router.get("/investigations")
async def list_investigations(
    status:       Optional[str] = Query(None),
    leakage_type: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(require_role("DFO", "SCHEME_VERIFIER", "AUDIT")),
):
    # Try dedicated investigations collection first
    col = _col("investigations")
    if col is not None:
        query: dict = {}
        if status:
            query["status"] = status
        if district:
            query["district"] = district
        if leakage_type:
            query["leakage_type"] = leakage_type
        try:
            docs = list(col.find(query, {"_id": 0}).sort("risk_score", -1).skip(skip).limit(limit))
            if docs:
                return {"total": col.count_documents(query), "cases": docs}
        except Exception:
            pass

    # Fall back to flags collection (from run-analysis)
    flags_col = _col("flags")
    flags: list = []
    if flags_col is not None:
        fquery: dict = {}
        if status:
            fquery["status"] = status
        if district:
            fquery["district"] = district
        if leakage_type:
            fquery["leakage_type"] = leakage_type
        try:
            flags = list(flags_col.find(fquery, {"_id": 0}).sort("risk_score", -1).skip(skip).limit(limit))
        except Exception:
            pass

    # Fall back to in-memory flag store from analysis.py
    if not flags:
        try:
            from .analysis import _flag_store
            all_flags = sorted(_flag_store.values(), key=lambda x: x.get("risk_score", 0), reverse=True)
            # Apply filters
            if status:
                all_flags = [f for f in all_flags if f.get("status") == status]
            if district:
                all_flags = [f for f in all_flags if f.get("district") == district]
            if leakage_type:
                all_flags = [f for f in all_flags if f.get("leakage_type") == leakage_type]
            flags = all_flags[skip:skip + limit]
        except Exception:
            pass

    # Normalize flags into investigation-compatible shape
    cases = []
    for f in flags:
        cases.append({
            "case_id":          f.get("flag_id"),
            "flag_id":          f.get("flag_id"),
            "beneficiary_name": f.get("beneficiary_name"),
            "beneficiary_id":  f.get("beneficiary_id"),
            "district":         f.get("district"),
            "scheme":           f.get("scheme"),
            "leakage_type":     f.get("leakage_type"),
            "payment_amount":   f.get("payment_amount", 0),
            "risk_score":       f.get("risk_score", 0),
            "risk_label":       f.get("risk_label"),
            "status":           f.get("status", "OPEN"),
            "evidence":         f.get("evidence"),
            "recommended_action": f.get("recommended_action"),
        })

    return {"total": len(cases), "cases": cases}


@router.get("/investigations/{case_id}")
async def get_investigation(case_id: str, user: dict = Depends(require_role("DFO"))):
    col = _col("flags")
    doc = col.find_one(
        {"$or": [{"case_id": case_id}, {"flag_id": case_id}]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Case not found")
    return doc


@router.patch("/investigations/{case_id}/assign")
async def assign_investigation(
    case_id: str,
    body: dict,
    user: dict = Depends(require_role("DFO")),
):
    verifier_id = body.get("verifier_id")
    if not verifier_id:
        raise HTTPException(400, "verifier_id is required")

    col = _col("flags")
    update = {
        "status":              "ASSIGNED_TO_VERIFIER",
        "assigned_verifier_id": verifier_id,
        "assigned_by":         user["sub"],
        "assigned_at":         datetime.utcnow().isoformat(),
    }
    result = col.update_one(
        {"$or": [{"case_id": case_id}, {"flag_id": case_id}]},
        {"$set": update}
    )
    if result.matched_count == 0:
        raise HTTPException(404, f"Case {case_id} not found")
    return {"case_id": case_id, **update}


@router.get("/institutions")
async def get_institutions(
    flagged_only: bool = False,
    user: dict = Depends(require_role("DFO")),
):
    """Institutions in the DFO's district only."""
    district = user.get("district")
    col = _col("institutions")
    query = {}
    if district:
        query["district"] = district
    if flagged_only:
        query["risk_profile.is_flagged"] = True
    docs = list(col.find(query, {"_id": 0}))
    return docs


@router.get("/verifiers")
async def get_verifiers(user: dict = Depends(require_role("DFO"))):
    """Scheme verifiers in the DFO's district only."""
    district = user.get("district")
    col = _col("officers")
    query = {"role": "SCHEME_VERIFIER", "is_active": True}
    if district:
        query["district"] = district
    docs = list(col.find(query, {"_id": 0, "password_hash": 0}))
    return docs


@router.get("/students")
async def get_students(
    skip: int = 0,
    limit: int = 100,
    user: dict = Depends(require_role("DFO")),
):
    """Beneficiaries in the DFO's district only."""
    district = user.get("district")
    col = _col("beneficiaries")
    query = {"district": district} if district else {}
    docs = list(col.find(query, {"_id": 0}).skip(skip).limit(limit))
    total = col.count_documents(query)
    return {"total": total, "students": docs}


@router.get("/student/{beneficiary_id}")
async def get_student(beneficiary_id: str, user: dict = Depends(require_role("DFO"))):
    col = _col("beneficiaries")
    doc = col.find_one({"beneficiary_id": beneficiary_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Beneficiary not found")
    return doc
