"""
api/routes/auth.py
Authentication endpoints:
  POST /api/auth/login        — officer or user login
  POST /api/auth/register     — citizen registration (aadhaar-based)
  POST /api/auth/logout       — stateless (client deletes token)
  GET  /api/auth/me           — validate token
  GET  /api/auth/geography    — districts + talukas for dropdowns
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from ..auth import verify_password, hash_password, create_access_token
from ..deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── MongoDB helper ────────────────────────────────────────────────────────────

def _get_db():
    """Returns the MongoDB db object or None."""
    try:
        from database import get_db
        return get_db()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail=f"Database unavailable: {exc}"
        ) from exc


# ── Request schemas ───────────────────────────────────────────────────────────

class OfficerLoginRequest(BaseModel):
    mode: str = "officer"          # "officer"
    role: str                      # DFO | SCHEME_VERIFIER | AUDIT | STATE_ADMIN
    district: Optional[str] = None
    taluka: Optional[str] = None
    password: str

class UserLoginRequest(BaseModel):
    mode: str = "user"             # "user"
    aadhaar_hash: str
    password: str

class UserRegisterRequest(BaseModel):
    name: str
    aadhaar_hash: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    officer_id: str
    district: str | None = None
    profile_complete: bool = True


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/login")
def login(body: dict):
    """
    Unified login endpoint.
    Body must contain `mode`: "officer" or "user".
    """
    mode = body.get("mode", "officer")

    if mode == "officer":
        return _login_officer(body)
    elif mode == "user":
        return _login_user(body)
    else:
        raise HTTPException(400, "mode must be 'officer' or 'user'")


def _login_officer(body: dict):
    role = body.get("role", "").strip()
    district = body.get("district", "").strip() or None
    taluka = body.get("taluka", "").strip() or None
    password = body.get("password", "")

    if not role:
        raise HTTPException(400, "role is required")
    if not password:
        raise HTTPException(400, "password is required")

    # STATE_ADMIN doesn't need district/taluka
    if role == "STATE_ADMIN":
        district = None
        taluka = None
    elif role == "DFO":
        if not district:
            raise HTTPException(400, "district is required for DFO")
        taluka = None
    elif role in ("SCHEME_VERIFIER", "AUDIT"):
        if not district:
            raise HTTPException(400, "district is required")
        if not taluka:
            raise HTTPException(400, "taluka is required")
    else:
        raise HTTPException(400, f"Unknown role: {role}")

    db = _get_db()
    if db is None:
        raise HTTPException(503, "Database unavailable")

    # Build query
    query = {"role": role}
    if district:
        query["district"] = district
    if taluka:
        query["taluka"] = taluka

    officer = db["officers"].find_one(query, {"_id": 0})
    if not officer:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            f"No {role} officer found for {district or ''} {taluka or ''}".strip()
        )

    if not verify_password(password, officer.get("password_hash", "")):
        # Fallback: check against demo plain passwords (match by role)
        from ..seed import DEMO_OFFICERS
        demo = next((o for o in DEMO_OFFICERS if o.get("role") == role), None)
        if not demo or password != demo.get("plain_password", ""):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect password")

    token_payload = {
        "sub":      officer["officer_id"],
        "role":     officer["role"],
        "name":     officer["name"],
        "email":    officer.get("email", ""),
        "district": officer.get("district"),
        "taluka":   officer.get("taluka"),
    }
    token = create_access_token(token_payload)

    return {
        "access_token": token,
        "token_type":   "bearer",
        "role":         officer["role"],
        "name":         officer["name"],
        "officer_id":   officer["officer_id"],
        "district":     officer.get("district"),
        "profile_complete": True,
    }


def _login_user(body: dict):
    aadhaar_hash = body.get("aadhaar_hash", "").strip()
    password = body.get("password", "")

    if not aadhaar_hash:
        raise HTTPException(400, "aadhaar_hash is required")
    if not password:
        raise HTTPException(400, "password is required")

    db = _get_db()
    if db is None:
        raise HTTPException(503, "Database unavailable")

    user = db["users"].find_one({"aadhaar_hash": aadhaar_hash}, {"_id": 0})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No account found. Please register first.")

    if not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect password")

    profile_complete = user.get("profile_complete", False)

    token_payload = {
        "sub":      user["user_id"],
        "role":     "USER",
        "name":     user["name"],
        "email":    "",
        "district": user.get("district"),
        "profile_complete": profile_complete,
    }
    token = create_access_token(token_payload)

    return {
        "access_token":   token,
        "token_type":     "bearer",
        "role":           "USER",
        "name":           user["name"],
        "officer_id":     user["user_id"],
        "district":       user.get("district"),
        "profile_complete": profile_complete,
    }


@router.post("/register")
def register(body: UserRegisterRequest):
    """
    Register a new citizen account.
    Minimal info: name + aadhaar_hash + password.
    Profile completion happens AFTER first login.
    """
    db = _get_db()
    if db is None:
        raise HTTPException(503, "Database unavailable")

    # Check if already registered
    existing = db["users"].find_one({"aadhaar_hash": body.aadhaar_hash})
    if existing:
        raise HTTPException(409, "An account with this Aadhaar already exists. Please login.")

    import uuid
    user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"

    user_doc = {
        "user_id":          user_id,
        "name":             body.name.strip(),
        "aadhaar_hash":     body.aadhaar_hash.strip(),
        "password_hash":    hash_password(body.password),
        "profile_complete": False,
        "kyc_complete":     False,
        "created_at":       datetime.utcnow().isoformat(),
        # These will be filled during profile completion
        "phone":            None,
        "district":         None,
        "taluka":           None,
        "gender":           None,
        "dob":              None,
        "caste_category":   None,
        "income":           None,
        "bank":             None,
    }

    db["users"].insert_one(user_doc)

    # Auto-login after registration
    token_payload = {
        "sub":      user_id,
        "role":     "USER",
        "name":     body.name.strip(),
        "email":    "",
        "district": None,
        "profile_complete": False,
    }
    token = create_access_token(token_payload)

    return {
        "access_token":   token,
        "token_type":     "bearer",
        "role":           "USER",
        "name":           body.name.strip(),
        "officer_id":     user_id,
        "district":       None,
        "profile_complete": False,
        "message":        "Registration successful. Please complete your profile.",
    }


@router.post("/logout")
def logout():
    return {"message": "Logged out. Please delete your local token."}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    # Re-check profile_complete from DB for users
    profile_complete = user.get("profile_complete", True)
    if user.get("role") == "USER":
        db = _get_db()
        if db is not None:
            u = db["users"].find_one({"user_id": user["sub"]}, {"profile_complete": 1})
            if u:
                profile_complete = u.get("profile_complete", False)

    return {
        "officer_id":       user.get("sub"),
        "role":             user.get("role"),
        "name":             user.get("name"),
        "email":            user.get("email"),
        "district":         user.get("district"),
        "profile_complete": profile_complete,
    }


@router.get("/geography")
def get_geography():
    """Public endpoint — returns districts + talukas for login dropdowns."""
    db = _get_db()
    if db is None:
        raise HTTPException(503, "Database unavailable")

    docs = list(db["geography"].find({}, {"_id": 0}).sort("district", 1))
    return docs