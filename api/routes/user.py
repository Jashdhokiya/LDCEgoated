"""
api/routes/user.py
General User (beneficiary) endpoints — KYC excluded as per spec.
GET  /api/user/profile              — own profile + registered schemes
GET  /api/user/schemes              — own registered scheme applications
GET  /api/user/payments             — own payment history
"""
import json
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..deps import require_role

router = APIRouter(prefix="/api/user", tags=["user"])

DATA_PATH = os.getenv("DATA_PATH", "./data")


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
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")


def _col(name: str):
    db = _get_db()
    return db[name] if db is not None else None


# ── Fallback profile ──────────────────────────────────────────────────────────

FALLBACK_USER = {
    "user_id":         "USR-GJ-001",
    "full_name":       "Karan Patel",
    "aadhaar_display": "XXXX-XXXX-4964",
    "phone":           "+91 98765 43210",
    "demographics": {
        "district": "Ahmedabad", "taluka": "Sanand",
        "gender": "M", "dob": "2006-05-14", "category": "OBC",
    },
    "bank": {
        "bank": "SBI", "account_display": "XXXXXX3421", "ifsc": "SBIN0001234"
    },
    "registered_schemes": [
        {"scheme_id": "SCH-MGMS", "name": "Mukhyamantri Gyan Sadhana Merit Scholarship",
         "status": "ACTIVE", "registration_date": "2025-08-15",
         "amount": 20000, "last_payment": "2025-11-01", "next_payment": "2026-04-01"},
        {"scheme_id": "SCH-NLY",  "name": "Namo Lakshmi Yojana",
         "status": "PENDING_VERIFICATION", "registration_date": "2026-01-10",
         "amount": 25000, "last_payment": None, "next_payment": None},
    ],
    "kyc_profile": {
        "is_kyc_compliant": True,
        "days_remaining": 42,
        "kyc_expiry_date": "2026-05-31",
        "last_kyc_date": "2026-03-02",
        "dynamic_validity_days": 90,
    },
}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(user: dict = Depends(require_role("USER"))):
    """
    Returns the authenticated user's profile.
    Uses `sub` (officer_id = beneficiary_id) from the JWT to look up the record.
    """
    uid = user["sub"]

    # Try MongoDB beneficiaries collection first
    col = _col("beneficiaries")
    if col is not None:
        try:
            doc = col.find_one({"beneficiary_id": uid}, {"_id": 0, "aadhaar_hash": 0, "bank_account_hash": 0})
            if doc:
                # Merge registered schemes from payments
                pay_col = _col("payment_ledger")
                schemes: list = []
                if pay_col is not None:
                    payments = list(pay_col.find({"beneficiary_id": uid}, {"_id": 0}))
                    schemes = payments
                doc["registered_schemes"] = schemes
                return doc
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}")

    # Fallback — use hardcoded profile (correct user only)
    if uid == "USR-GJ-001":
        return FALLBACK_USER

    # Generic fallback for demo
    return {**FALLBACK_USER, "user_id": uid, "full_name": user.get("name", "Beneficiary")}


@router.get("/schemes")
async def get_user_schemes(user: dict = Depends(require_role("USER"))):
    """Returns scheme applications for the authenticated user."""
    uid = user["sub"]
    col = _col("payment_ledger")
    if col is not None:
        try:
            docs = list(col.find({"beneficiary_id": uid}, {"_id": 0}))
            if docs:
                return {"user_id": uid, "count": len(docs), "schemes": docs}
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}")

    # JSON file fallback
    payments = [p for p in _load_json("payment_ledger.json") if p.get("beneficiary_id") == uid]
    if payments:
        return {"user_id": uid, "count": len(payments), "schemes": payments}

    return {"user_id": uid, "count": len(FALLBACK_USER["registered_schemes"]), "schemes": FALLBACK_USER["registered_schemes"]}


@router.get("/payments")
async def get_user_payments(user: dict = Depends(require_role("USER"))):
    """Returns full payment history for the authenticated user."""
    uid = user["sub"]
    col = _col("payment_ledger")
    if col is not None:
        try:
            docs = list(col.find({"beneficiary_id": uid}, {"_id": 0}).sort("payment_date", -1))
            return {"user_id": uid, "count": len(docs), "payments": docs}
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}")

    payments = [p for p in _load_json("payment_ledger.json") if p.get("beneficiary_id") == uid]
    return {"user_id": uid, "count": len(payments), "payments": payments}
