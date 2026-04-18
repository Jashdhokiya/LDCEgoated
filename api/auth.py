"""
api/auth.py
JWT token creation / verification and password hashing helpers.

NOTE: We use native `bcrypt` instead of passlib.CryptContext because
passlib's bcrypt backend crashes with bcrypt>=4.0 ("error reading bcrypt
version" / AttributeError: module 'bcrypt' has no attribute '__about__').
"""
import os
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
import bcrypt

SECRET_KEY  = os.getenv("JWT_SECRET", "eduguard-secret-key-CHANGE-in-prod-2026")
ALGORITHM   = "HS256"
TOKEN_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "8"))


# ── Password helpers ────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    # bcrypt max input is 72 bytes
    if len(plain) > 72:
        plain = plain[:72]
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    if len(plain) > 72:
        plain = plain[:72]
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


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
