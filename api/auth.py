"""
api/auth.py
JWT token creation / verification and password hashing helpers.
"""
import os
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY  = os.getenv("JWT_SECRET", "eduguard-secret-key-CHANGE-in-prod-2026")
ALGORITHM   = "HS256"
TOKEN_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "8"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password helpers ────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── Token helpers ────────────────────────────────────────────────────────────

def create_access_token(payload: dict, expires_delta: Optional[timedelta] = None) -> str:
    data = payload.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=TOKEN_HOURS))
    data["exp"] = expire
    data["iat"] = datetime.utcnow()
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Raises JWTError on invalid / expired token."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
