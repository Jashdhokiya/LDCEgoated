"""
api/routes/user.py
General User (citizen) endpoints — all data from MongoDB.
GET  /api/user/profile              — own profile
PUT  /api/user/complete-profile     — mandatory profile completion
POST /api/user/kyc                  — mark KYC complete
GET  /api/user/schemes              — own payment/scheme history
GET  /api/user/payments             — own payment history
GET  /api/user/eligible-schemes     — schemes user qualifies for
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import require_role

router = APIRouter(prefix="/api/user", tags=["user"])


# ── MongoDB helpers ──────────────────────────────────────────────────────────

def _get_db():
    try:
        from database import get_db
        return get_db()
    except Exception as e:
        print(f"  [user] MongoDB unavailable: {e}")
        return None


def _col(name: str):
    db = _get_db()
    if db is None:
        raise HTTPException(503, "Database unavailable")
    return db[name]


# ── Pydantic models ──────────────────────────────────────────────────────────

class ProfileCompletionRequest(BaseModel):
    phone: str
    district: str
    taluka: str
    gender: str                    # M | F | OTHER
    dob: str                       # YYYY-MM-DD
    caste_category: str            # GENERAL | OBC | SC | ST | EWS
    income: Optional[float] = None # annual family income
    bank_name: Optional[str] = None
    bank_account_display: Optional[str] = None  # last 4 digits
    bank_ifsc: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(user: dict = Depends(require_role("USER"))):
    """Returns the authenticated user's profile from the users collection."""
    uid = user["sub"]
    col = _col("users")
    doc = col.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})

    if not doc:
        # Minimal response if somehow not found
        return {
            "user_id": uid,
            "name": user.get("name", "Citizen"),
            "full_name": user.get("name", "Citizen"),
            "profile_complete": False,
            "kyc_complete": False,
            "aadhaar_display": "XXXX-XXXX-XXXX",
            "demographics": {"district": "", "taluka": "", "category": ""},
            "bank": {"bank": "", "account_display": "", "ifsc": ""},
            "registered_schemes": [],
            "kyc_profile": {
                "is_kyc_compliant": False, "days_remaining": 0,
                "kyc_expiry_date": "", "last_kyc_date": "",
                "dynamic_validity_days": 90,
            },
        }

    # Attach payment history as registered_schemes
    pay_col = _col("payment_ledger")
    payments = list(pay_col.find({"beneficiary_id": uid}, {"_id": 0}))
    doc["registered_schemes"] = payments

    # ── Normalize for frontend (UserDashboard.jsx) ────────────────────────
    doc["full_name"] = doc.get("name", user.get("name", "Citizen"))

    # Aadhaar display: mask all but last 4
    raw_aadhaar = doc.get("aadhaar_hash", "")
    if len(raw_aadhaar) >= 4:
        doc["aadhaar_display"] = "XXXX-XXXX-" + raw_aadhaar[-4:]
    else:
        doc["aadhaar_display"] = "XXXX-XXXX-XXXX"

    # Demographics sub-object
    doc["demographics"] = {
        "district": doc.get("district", ""),
        "taluka": doc.get("taluka", ""),
        "category": doc.get("caste_category", ""),
    }

    # Bank sub-object (frontend expects bank.bank, backend stores bank.bank_name)
    bank = doc.get("bank") or {}
    doc["bank"] = {
        "bank": bank.get("bank_name", bank.get("bank", "")),
        "bank_name": bank.get("bank_name", ""),
        "account_display": bank.get("account_display", ""),
        "ifsc": bank.get("ifsc", ""),
    }

    # KYC profile defaults
    if "kyc_profile" not in doc or not doc["kyc_profile"]:
        doc["kyc_profile"] = {
            "is_kyc_compliant": doc.get("kyc_complete", False),
            "days_remaining": 90 if doc.get("kyc_complete") else 0,
            "kyc_expiry_date": "",
            "last_kyc_date": "",
            "dynamic_validity_days": 90,
        }

    return doc


@router.put("/complete-profile")
async def complete_profile(
    body: ProfileCompletionRequest,
    user: dict = Depends(require_role("USER")),
):
    """
    Mandatory profile completion for new citizen accounts.
    Must be called before user can access their dashboard.
    """
    uid = user["sub"]
    col = _col("users")

    existing = col.find_one({"user_id": uid})
    if not existing:
        raise HTTPException(404, "User not found")

    update = {
        "phone":          body.phone.strip(),
        "district":       body.district.strip(),
        "taluka":         body.taluka.strip(),
        "gender":         body.gender.strip().upper(),
        "dob":            body.dob.strip(),
        "caste_category": body.caste_category.strip().upper(),
        "income":         body.income,
        "bank": {
            "bank_name":        body.bank_name or "",
            "account_display":  body.bank_account_display or "",
            "ifsc":             body.bank_ifsc or "",
        },
        "profile_complete": True,
        "profile_completed_at": datetime.utcnow().isoformat(),
    }

    col.update_one({"user_id": uid}, {"$set": update})
    updated = col.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    return updated


@router.post("/kyc")
async def complete_kyc(user: dict = Depends(require_role("USER"))):
    """Mark KYC as complete for the authenticated user."""
    uid = user["sub"]
    col = _col("users")

    existing = col.find_one({"user_id": uid})
    if not existing:
        raise HTTPException(404, "User not found")

    if not existing.get("profile_complete"):
        raise HTTPException(400, "Complete your profile first")

    update = {
        "kyc_complete": True,
        "kyc_completed_at": datetime.utcnow().isoformat(),
        "kyc_profile": {
            "is_kyc_compliant": True,
            "days_remaining": 365,
            "kyc_expiry_date": "2027-04-19",
            "last_kyc_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "dynamic_validity_days": 365,
        },
    }

    col.update_one({"user_id": uid}, {"$set": update})
    return {"message": "KYC completed successfully", "kyc_complete": True}


@router.get("/schemes")
async def get_user_schemes(user: dict = Depends(require_role("USER"))):
    """Returns scheme applications for the authenticated user."""
    uid = user["sub"]
    col = _col("payment_ledger")
    docs = list(col.find({"beneficiary_id": uid}, {"_id": 0}))
    return {"user_id": uid, "count": len(docs), "schemes": docs}


@router.get("/payments")
async def get_user_payments(user: dict = Depends(require_role("USER"))):
    """Returns full payment history for the authenticated user."""
    uid = user["sub"]
    col = _col("payment_ledger")
    docs = list(col.find({"beneficiary_id": uid}, {"_id": 0}).sort("payment_date", -1))
    return {"user_id": uid, "count": len(docs), "payments": docs}


@router.get("/eligible-schemes")
async def get_eligible_schemes(user: dict = Depends(require_role("USER"))):
    """Returns schemes the user is eligible for based on profile data."""
    uid = user["sub"]

    users_col = _col("users")
    profile = users_col.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    if not profile or not profile.get("profile_complete"):
        return {"eligible": [], "message": "Complete your profile to see eligible schemes"}

    schemes_col = _col("schemes")
    all_schemes = list(schemes_col.find({"status": "ACTIVE"}, {"_id": 0}))

    gender = profile.get("gender", "")
    eligible = []

    for s in all_schemes:
        rules = s.get("eligibility_rules", {})
        # Gender check
        allowed_genders = rules.get("gender")
        if allowed_genders and gender not in allowed_genders:
            continue
        eligible.append(s)

    return {"eligible": eligible, "profile": {"gender": gender, "district": profile.get("district"), "caste": profile.get("caste_category")}}
