"""
api/routes/auth.py
Login, logout, and /me endpoints.
No role guard needed — these are public or self-authenticated.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from ..auth   import verify_password, create_access_token
from ..deps   import get_current_user
from ..seed   import get_officer_by_email_fallback

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Request / Response schemas ────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email:    str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    role:         str
    name:         str
    officer_id:   str
    district:     str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_db():
    """Returns the MongoDB db object or None."""
    try:
        from ...database import get_db
        return get_db()
    except Exception as exc:
        rel_error = exc
    try:
        from database import get_db
        return get_db()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database unavailable: {rel_error}") from exc


def _lookup_officer(email: str, password: str):
    """
    Returns the officer dict on success, raises HTTPException on failure.
    Tries MongoDB first, then falls back to DEMO_OFFICERS.
    """
    db = _get_db()

    if db is not None:
        try:
            officer = db["officers"].find_one({"email": email}, {"_id": 0})
            if officer:
                pw_hash = officer.get("password_hash", "")
                if not verify_password(password, pw_hash):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Incorrect password",
                    )
                return officer
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Database unavailable: {exc}",
            )

    # ── Fallback: demo accounts ───────────────────────────────────────────────
    demo = get_officer_by_email_fallback(email)
    if not demo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found for that email address",
        )
    if password != demo["plain_password"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )
    return demo


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    """
    Authenticate with email + password.
    Returns a signed JWT and basic profile info.
    """
    officer = _lookup_officer(body.email.strip().lower(), body.password)

    token_payload = {
        "sub":      officer["officer_id"],
        "role":     officer["role"],
        "name":     officer["name"],
        "email":    officer["email"],
        "district": officer.get("district"),
    }
    token = create_access_token(token_payload)

    return TokenResponse(
        access_token=token,
        role=officer["role"],
        name=officer["name"],
        officer_id=officer["officer_id"],
        district=officer.get("district"),
    )


@router.post("/logout")
def logout():
    """
    Stateless JWT — client deletes the token.
    Server acknowledges with 200.
    """
    return {"message": "Logged out. Please delete your local token."}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    """
    Validate an existing token and return the decoded payload.
    Useful for token validation on page refresh.
    """
    return {
        "officer_id": user.get("sub"),
        "role":       user.get("role"),
        "name":       user.get("name"),
        "email":      user.get("email"),
        "district":   user.get("district"),
    }
