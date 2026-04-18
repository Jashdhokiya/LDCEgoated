"""
api/routes/audit.py
Audit Officer endpoints.
GET  /api/audit/pending              — cases with VERIFICATION_SUBMITTED status
GET  /api/audit/case/{case_id}       — single case for review
POST /api/audit/{case_id}/decide     — mark LEGITIMATE or FRAUD_CONFIRMED
GET  /api/audit/all                  — all cases this auditor has reviewed
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import require_role

router = APIRouter(prefix="/api/audit", tags=["audit"])


def _get_db():
    try:
        from database import get_db, is_mongo_available
        return get_db() if is_mongo_available() else None
    except Exception:
        return None


def _col(name: str):
    db = _get_db()
    return db[name] if db else None


# ── Models ────────────────────────────────────────────────────────────────────

class AuditDecision(BaseModel):
    final_decision: str          # LEGITIMATE | FRAUD_CONFIRMED
    auditor_notes:  Optional[str] = ""


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/pending")
async def audit_pending(user: dict = Depends(require_role("AUDIT"))):
    """All cases awaiting audit review (status == VERIFICATION_SUBMITTED)."""
    results: list = []
    for cname in ["investigations", "flags"]:
        col = _col(cname)
        if col:
            try:
                docs = list(col.find(
                    {"status": "VERIFICATION_SUBMITTED"},
                    {"_id": 0}
                ).sort("risk_score", -1))
                results.extend(docs)
            except Exception:
                pass

    # De-duplicate
    seen: set = set()
    unique: list = []
    for c in results:
        key = c.get("case_id") or c.get("flag_id", "")
        if key not in seen:
            seen.add(key)
            unique.append(c)

    return {
        "auditor_id": user["sub"],
        "total":      len(unique),
        "pending":    unique,
    }


@router.get("/case/{case_id}")
async def get_audit_case(case_id: str, user: dict = Depends(require_role("AUDIT"))):
    for cname in ["investigations", "flags"]:
        col = _col(cname)
        if col:
            try:
                doc = col.find_one(
                    {"$or": [{"case_id": case_id}, {"flag_id": case_id}]},
                    {"_id": 0}
                )
                if doc:
                    return doc
            except Exception:
                pass
    raise HTTPException(404, f"Case {case_id} not found")


@router.post("/{case_id}/decide")
async def audit_decide(
    case_id: str,
    body: AuditDecision,
    user: dict = Depends(require_role("AUDIT")),
):
    valid = {"LEGITIMATE", "FRAUD_CONFIRMED"}
    if body.final_decision not in valid:
        raise HTTPException(400, f"final_decision must be one of {valid}")

    audit_report = {
        "final_decision":  body.final_decision,
        "auditor_notes":   body.auditor_notes or "",
        "reviewed_by":     user["sub"],
        "reviewed_at":     datetime.utcnow().isoformat(),
    }
    update = {
        "status":        "AUDIT_REVIEW",
        "audit_report":  audit_report,
    }

    for cname in ["investigations", "flags"]:
        col = _col(cname)
        if col:
            try:
                col.update_one(
                    {"$or": [{"case_id": case_id}, {"flag_id": case_id}]},
                    {"$set": update}
                )
            except Exception:
                pass

    return {"case_id": case_id, **update}


@router.get("/all")
async def audit_all(user: dict = Depends(require_role("AUDIT"))):
    """All cases reviewed by any auditor (status == AUDIT_REVIEW)."""
    results: list = []
    for cname in ["investigations", "flags"]:
        col = _col(cname)
        if col:
            try:
                docs = list(col.find({"status": "AUDIT_REVIEW"}, {"_id": 0}).sort("risk_score", -1))
                results.extend(docs)
            except Exception:
                pass

    seen: set = set()
    unique: list = []
    for c in results:
        key = c.get("case_id") or c.get("flag_id", "")
        if key not in seen:
            seen.add(key)
            unique.append(c)

    return {"total": len(unique), "reviewed": unique}
