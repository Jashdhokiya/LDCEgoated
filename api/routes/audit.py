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
from models import CaseStatus

router = APIRouter(prefix="/api/audit", tags=["audit"])


def _get_db():
    try:
        from database import get_db
        return get_db()
    except Exception as e:
        raise HTTPException(503, f"Database unavailable: {e}")


def _col(name: str):
    db = _get_db()
    return db[name] if db is not None else None


def _find_investigation(case_id: str):
    col = _col("investigations")
    if col is None:
        return None
    try:
        return col.find_one(
            {"$or": [{"case_id": case_id}, {"investigation_id": case_id}, {"flag_id": case_id}]},
            {"_id": 0},
        )
    except Exception as exc:
        raise HTTPException(503, f"Database unavailable: {exc}")


# ── Models ────────────────────────────────────────────────────────────────────

class AuditDecision(BaseModel):
    final_decision: str          # LEGITIMATE | FRAUD_CONFIRMED
    auditor_notes:  Optional[str] = ""


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/pending")
async def audit_pending(user: dict = Depends(require_role("AUDIT"))):
    """All cases awaiting audit review (status == VERIFICATION_SUBMITTED)."""
    results: list = []
    col = _col("investigations")
    if col is not None:
        try:
            docs = list(col.find({"status": CaseStatus.VERIFICATION_SUBMITTED.value}, {"_id": 0}).sort("risk_score", -1))
            results.extend(docs)
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")

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
    doc = _find_investigation(case_id)
    if doc:
        return doc

    flag_col = _col("flags")
    if flag_col is not None:
        try:
            doc = flag_col.find_one({"flag_id": case_id}, {"_id": 0})
            if doc:
                return doc
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")
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
        "status":        CaseStatus.FRAUD_CONFIRMED.value if body.final_decision == "FRAUD_CONFIRMED" else CaseStatus.RESOLVED.value,
        "audit_report":  audit_report,
    }

    investigation = _find_investigation(case_id)

    inv_col = _col("investigations")
    flag_col = _col("flags")
    if inv_col is None or flag_col is None:
        raise HTTPException(503, "Database unavailable")
    try:
        inv_col.update_one(
            {"$or": [{"case_id": case_id}, {"investigation_id": case_id}, {"flag_id": case_id}]},
            {"$set": update}
        )
        if investigation and investigation.get("flag_id"):
            flag_col.update_one(
                {"flag_id": investigation["flag_id"]},
                {"$set": update}
            )
    except Exception as exc:
        raise HTTPException(503, f"Database unavailable: {exc}")

    return {"case_id": case_id, **update}


@router.get("/all")
async def audit_all(user: dict = Depends(require_role("AUDIT"))):
    """All cases reviewed by any auditor (status == AUDIT_REVIEW)."""
    results: list = []
    col = _col("investigations")
    if col is not None:
        try:
            docs = list(col.find({"status": CaseStatus.RESOLVED.value}, {"_id": 0}).sort("risk_score", -1))
            results.extend(docs)
            docs = list(col.find({"status": CaseStatus.FRAUD_CONFIRMED.value}, {"_id": 0}).sort("risk_score", -1))
            results.extend(docs)
        except Exception as exc:
            raise HTTPException(503, f"Database unavailable: {exc}")

    seen: set = set()
    unique: list = []
    for c in results:
        key = c.get("case_id") or c.get("flag_id", "")
        if key not in seen:
            seen.add(key)
            unique.append(c)

    return {"total": len(unique), "reviewed": unique}
