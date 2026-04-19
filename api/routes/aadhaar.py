"""
api/routes/aadhaar.py
─────────────────────
Aadhaar OTP Verification via Sandbox.co.in API.

SANDBOX API DOCS: https://docs.sandbox.co.in/aadhaar
Sandbox test Aadhaar: 999999990019  (OTP: 123456 in sandbox mode)

REAL UIDAI PRODUCTION:
  To use real UIDAI API you need:
  1. Register as a Licensed KYC User Agency (KUA) with UIDAI
  2. Get Auth API v2.5 credentials from UIDAI
  3. Implement AES+RSA encrypted OTP flow (complex, requires HSM)
  For this project we use Sandbox.co.in which proxies UIDAI's API.

Flow:
  POST /api/aadhaar/send-otp      { aadhaar_number }  -> { transaction_id }
  POST /api/aadhaar/verify-otp    { transaction_id, otp } -> { verified: true, name, dob, ... }
"""
import os
import re
import requests
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import require_role

router = APIRouter(prefix="/api/aadhaar", tags=["aadhaar"])

# ── Sandbox.co.in credentials ───────────────────────────────────────────────
# Sign up free at https://dashboard.sandbox.co.in/
# Set these in your .env:
#   SANDBOX_API_KEY=your_key_here
#   SANDBOX_API_SECRET=your_secret_here
#   SANDBOX_ENV=sandbox   (or 'production' when live)

SANDBOX_BASE  = "https://api.sandbox.co.in"
SANDBOX_KEY   = os.getenv("SANDBOX_API_KEY", "")
SANDBOX_SECRET= os.getenv("SANDBOX_API_SECRET", "")
SANDBOX_ENV   = os.getenv("SANDBOX_ENV", "sandbox")   # sandbox | production

# ── Pydantic models ──────────────────────────────────────────────────────────

class AadhaarOTPRequest(BaseModel):
    aadhaar_number: str   # 12-digit Aadhaar number

class AadhaarVerifyRequest(BaseModel):
    transaction_id: str   # From send-otp response
    otp: str              # OTP received on Aadhaar-linked mobile


# ── Helpers ──────────────────────────────────────────────────────────────────

def _sandbox_auth() -> str:
    """Get Sandbox.co.in access token (cached per process)."""
    if not SANDBOX_KEY or not SANDBOX_SECRET:
        raise HTTPException(
            503,
            detail={
                "error": "AADHAAR_NOT_CONFIGURED",
                "message": (
                    "Aadhaar API keys not set. "
                    "Add SANDBOX_API_KEY and SANDBOX_API_SECRET to .env. "
                    "Get free keys at https://dashboard.sandbox.co.in/"
                ),
                "sandbox_test": {
                    "aadhaar": "999999990019",
                    "otp": "123456",
                    "note": "Use these test values in sandbox mode"
                }
            }
        )
    try:
        res = requests.post(
            f"{SANDBOX_BASE}/authenticate",
            json={"_env": SANDBOX_ENV},
            headers={
                "x-api-key": SANDBOX_KEY,
                "x-api-secret": SANDBOX_SECRET,
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        data = res.json()
        token = data.get("data", {}).get("token") or data.get("access_token")
        if not token:
            raise HTTPException(502, f"Sandbox auth failed: {data}")
        return token
    except requests.RequestException as e:
        raise HTTPException(502, f"Aadhaar API unreachable: {e}")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/send-otp")
async def send_otp(
    body: AadhaarOTPRequest,
    user: dict = Depends(require_role("USER")),
):
    """
    Step 1 of Aadhaar verification.
    Sends OTP to the mobile number registered with the given Aadhaar.
    Returns a transaction_id to use in verify-otp.
    """
    # Validate format
    aadhaar = re.sub(r"\s+", "", body.aadhaar_number)
    if not re.fullmatch(r"\d{12}", aadhaar):
        raise HTTPException(400, "Aadhaar must be exactly 12 digits")

    # If keys not configured — return demo mode response
    if not SANDBOX_KEY:
        return {
            "success": True,
            "demo_mode": True,
            "transaction_id": f"DEMO-TXN-{aadhaar[-4:]}",
            "message": (
                "DEMO MODE: Aadhaar API keys not configured. "
                "Use OTP '123456' to complete demo verification. "
                "Configure SANDBOX_API_KEY in .env for real OTPs."
            ),
        }

    token = _sandbox_auth()
    try:
        res = requests.post(
            f"{SANDBOX_BASE}/kyc/aadhaar/okyc/otp",
            json={"_env": SANDBOX_ENV, "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request", "aadhaar_number": aadhaar},
            headers={
                "x-api-key": SANDBOX_KEY,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        data = res.json()
        if res.status_code not in (200, 201, 202):
            raise HTTPException(res.status_code, f"Aadhaar OTP error: {data}")

        txn_id = (
            data.get("data", {}).get("transaction_id")
            or data.get("data", {}).get("request_id")
            or data.get("transaction_id")
        )
        return {
            "success": True,
            "demo_mode": False,
            "transaction_id": txn_id,
            "message": "OTP sent to your Aadhaar-linked mobile number.",
        }
    except requests.RequestException as e:
        raise HTTPException(502, f"Aadhaar API error: {e}")


@router.post("/verify-otp")
async def verify_otp(
    body: AadhaarVerifyRequest,
    user: dict = Depends(require_role("USER")),
):
    """
    Step 2 of Aadhaar verification.
    Verifies the OTP and returns extracted Aadhaar data (name, dob, gender, address).
    """
    if not body.transaction_id or not body.otp:
        raise HTTPException(400, "transaction_id and otp are required")

    # Demo mode (no keys configured)
    if not SANDBOX_KEY or body.transaction_id.startswith("DEMO-TXN-"):
        if body.otp == "123456":
            return {
                "success": True,
                "demo_mode": True,
                "verified": True,
                "name": user.get("name", "Demo User"),
                "dob": "1998-01-01",
                "gender": "M",
                "address": "Demo Address, Gujarat, India",
                "care_of": "",
                "message": "DEMO: Aadhaar verified (sandbox mode).",
            }
        raise HTTPException(400, "Invalid OTP (demo mode: use '123456')")

    token = _sandbox_auth()
    try:
        res = requests.post(
            f"{SANDBOX_BASE}/kyc/aadhaar/okyc/otp/verify",
            json={
                "_env": SANDBOX_ENV,
                "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
                "request_id": body.transaction_id,
                "otp": body.otp,
            },
            headers={
                "x-api-key": SANDBOX_KEY,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        data = res.json()
        if res.status_code not in (200, 201):
            msg = data.get("message") or str(data)
            raise HTTPException(400, f"OTP verification failed: {msg}")

        d = data.get("data", {})
        return {
            "success": True,
            "demo_mode": False,
            "verified": True,
            "name": d.get("name") or d.get("full_name"),
            "dob": d.get("dob") or d.get("date_of_birth"),
            "gender": d.get("gender"),
            "address": d.get("address", {}).get("combined") or str(d.get("address", "")),
            "care_of": d.get("care_of"),
            "message": "Aadhaar verified successfully.",
        }
    except requests.RequestException as e:
        raise HTTPException(502, f"Aadhaar API error: {e}")


@router.get("/status")
async def aadhaar_api_status():
    """Public endpoint — check if Aadhaar API is configured."""
    return {
        "configured": bool(SANDBOX_KEY and SANDBOX_SECRET),
        "mode": SANDBOX_ENV,
        "provider": "Sandbox.co.in (UIDAI proxy)",
        "demo_aadhaar": "999999990019",
        "demo_otp": "123456",
        "signup_url": "https://dashboard.sandbox.co.in/",
    }
