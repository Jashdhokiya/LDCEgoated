"""
api/deps.py
FastAPI dependency injection — auth guards used by every protected route.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError

from .auth import decode_token

_security = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    """
    Validates the Bearer token and returns the decoded JWT payload.
    Raises 401 if missing or invalid.
    """
    try:
        payload = decode_token(credentials.credentials)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token invalid or expired: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        from database import get_db

        db = get_db()
        if db is None:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")

        role = payload.get("role")
        sub_id = payload.get("sub")

        if role == "USER":
            user_doc = db["users"].find_one({"user_id": sub_id}, {"_id": 0, "password_hash": 0})
            if not user_doc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User account not found or revoked",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        else:
            officer_doc = db["officers"].find_one({"officer_id": sub_id}, {"_id": 0, "password_hash": 0})
            if not officer_doc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Officer account not found or revoked",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            if not officer_doc.get("is_active", False):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Officer account is disabled",
                    headers={"WWW-Authenticate": "Bearer"},
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database unavailable: {exc}")

    return payload


def require_role(*allowed_roles: str):
    """
    Factory that returns a FastAPI dependency which:
    1. Validates the JWT (delegates to get_current_user)
    2. Checks the role claim against allowed_roles
    3. Returns the payload dict on success
    """
    def _guard(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Your role '{user.get('role')}' is not permitted. "
                    f"Required: {list(allowed_roles)}"
                ),
            )
        return user
    return _guard


# ── Convenience shorthand guards ────────────────────────────────────────────

dfo_only       = require_role("DFO")
admin_only     = require_role("STATE_ADMIN")
verifier_only  = require_role("SCHEME_VERIFIER")
audit_only     = require_role("AUDIT")
user_only      = require_role("USER")
# Any authenticated officer (all internal staff roles)
any_officer    = require_role("DFO", "STATE_ADMIN", "SCHEME_VERIFIER", "AUDIT")
# DFO can also see audit things
dfo_or_audit   = require_role("DFO", "AUDIT")
