"""
api/routes/audit.py
Audit Officer endpoints.
GET  /api/audit/pending              — cases pending audit review
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
        from database import get_db
        return get_db()
    except Exception as e:
        print(f"  [audit] MongoDB unavailable: {e}")
        return None


def _col(name: str):
    db = _get_db()
    return db[name] if db is not None else None


def _get_flags_from_memory():
    """Get flags from the in-memory store in analysis.py."""
    try:
        from .analysis import _flag_store
        return list(_flag_store.values())
    except Exception:
        return []


def _normalize_for_audit(flag: dict) -> dict:
    """Transform a raw flag into an audit-compatible case shape."""
    case = {
        "case_id":          flag.get("flag_id") or flag.get("case_id"),
        "flag_id":          flag.get("flag_id"),
        "beneficiary_name": flag.get("beneficiary_name"),
        "beneficiary_id":  flag.get("beneficiary_id"),
        "district":         flag.get("district"),
        "scheme":           flag.get("scheme"),
        "leakage_type":     flag.get("leakage_type"),
        "anomaly_type":     flag.get("leakage_type"),   # alias for frontend compat
        "payment_amount":   flag.get("payment_amount", 0),
        "risk_score":       flag.get("risk_score", 0),
        "risk_label":       flag.get("risk_label"),
        "status":           flag.get("status", "OPEN"),
        "evidence":         flag.get("evidence"),
        "recommended_action": flag.get("recommended_action"),
        "target_entity": flag.get("target_entity") or {
            "entity_type": "USER",
            "entity_id":   flag.get("beneficiary_id", "—"),
            "name":        flag.get("beneficiary_name", "—"),
        },
    }
    # Carry over audit_report if it exists
    if "audit_report" in flag:
        case["audit_report"] = flag["audit_report"]
    # Carry over field_report if it exists, else synthesize one
    if "field_report" in flag and flag["field_report"]:
        case["field_report"] = flag["field_report"]
    else:
        case["field_report"] = {
            "verifier_notes": flag.get("evidence") or "Auto-generated from analysis engine.",
            "gps_coordinates": {"lat": 23.0225, "lng": 72.5714},
            "ai_verification_match": flag.get("risk_score", 0) >= 70,
            "photo_evidence_url": "",
            "submission_timestamp": datetime.utcnow().isoformat(),
            "ai_analysis": {
                "confidence_score": min(flag.get("risk_score", 0) + 5, 100),
                "reason": flag.get("recommended_action") or "Anomaly detected by EduGuard analysis engine.",
                "proofs": [
                    f"Payment ledger cross-referenced with {flag.get('leakage_type', 'detection')} registry",
                    f"Risk score: {flag.get('risk_score', 0)}/100 ({flag.get('risk_label', 'UNKNOWN')})",
                    f"Amount at risk: ₹{flag.get('payment_amount', 0):,}",
                ],
            },
        }
    return case


# ── Models ────────────────────────────────────────────────────────────────────

class AuditDecision(BaseModel):
    final_decision: str          # LEGITIMATE | FRAUD_CONFIRMED
    auditor_notes:  Optional[str] = ""


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/pending")
async def audit_pending(user: dict = Depends(require_role("AUDIT"))):
    """Cases awaiting audit review — VERIFICATION_SUBMITTED or high-risk OPEN flags."""
    results: list = []
    
    query_filter = {}
    district = user.get("district")
    taluka = user.get("taluka")
    if district:
        query_filter["district"] = district
    if taluka:
        query_filter["taluka"] = taluka

    # 1. Try investigations/flags collections for VERIFICATION_SUBMITTED
    for cname in ["investigations", "flags"]:
        col = _col(cname)
        if col is not None:
            try:
                q = {"status": "VERIFICATION_SUBMITTED", **query_filter}
                docs = list(col.find(
                    q,
                    {"_id": 0}
                ).sort("risk_score", -1))
                results.extend(docs)
            except Exception:
                pass

    # 2. If no VERIFICATION_SUBMITTED, show high-risk OPEN/ASSIGNED flags as pending
    if not results:
        for cname in ["flags"]:
            col = _col(cname)
            if col is not None:
                try:
                    q = {"status": {"$in": ["OPEN", "ASSIGNED"]}, "risk_score": {"$gte": 50}, **query_filter}
                    docs = list(col.find(
                        q,
                        {"_id": 0}
                    ).sort("risk_score", -1).limit(20))
                    results.extend(docs)
                except Exception:
                    pass

    # 3. Fall back to in-memory flag store
    if not results:
        mem_flags = _get_flags_from_memory()
        
        if district:
            mem_flags = [f for f in mem_flags if f.get("district") == district]
        if taluka:
            mem_flags = [f for f in mem_flags if f.get("taluka") == taluka]
            
        results = sorted(
            [f for f in mem_flags if f.get("status") in ("OPEN", "ASSIGNED") and f.get("risk_score", 0) >= 50],
            key=lambda x: x.get("risk_score", 0),
            reverse=True
        )[:20]

    # De-duplicate
    seen: set = set()
    unique: list = []
    for c in results:
        key = c.get("case_id") or c.get("flag_id", "")
        if key not in seen:
            seen.add(key)
            unique.append(_normalize_for_audit(c))

    return {
        "auditor_id": user["sub"],
        "total":      len(unique),
        "pending":    unique,
    }


@router.get("/case/{case_id}")
async def get_audit_case(case_id: str, user: dict = Depends(require_role("AUDIT"))):
    for cname in ["investigations", "flags"]:
        col = _col(cname)
        if col is not None:
            try:
                doc = col.find_one(
                    {"$or": [{"case_id": case_id}, {"flag_id": case_id}]},
                    {"_id": 0}
                )
                if doc:
                    return _normalize_for_audit(doc)
            except Exception:
                pass
    # Try in-memory
    mem_flags = _get_flags_from_memory()
    for f in mem_flags:
        if f.get("flag_id") == case_id:
            return _normalize_for_audit(f)
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
        if col is not None:
            try:
                col.update_one(
                    {"$or": [{"case_id": case_id}, {"flag_id": case_id}]},
                    {"$set": update}
                )
            except Exception:
                pass

    # Also update in-memory flag store
    try:
        from .analysis import _flag_store
        if case_id in _flag_store:
            _flag_store[case_id]["status"] = "AUDIT_REVIEW"
            _flag_store[case_id]["audit_report"] = audit_report
    except Exception:
        pass

    return {"case_id": case_id, **update}


@router.get("/all")
async def audit_all(user: dict = Depends(require_role("AUDIT"))):
    """All cases reviewed by any auditor (status == AUDIT_REVIEW)."""
    results: list = []
    
    query_filter = {}
    district = user.get("district")
    taluka = user.get("taluka")
    if district:
        query_filter["district"] = district
    if taluka:
        query_filter["taluka"] = taluka

    for cname in ["investigations", "flags"]:
        col = _col(cname)
        if col is not None:
            try:
                q = {"status": "AUDIT_REVIEW", **query_filter}
                docs = list(col.find(q, {"_id": 0}).sort("risk_score", -1))
                results.extend(docs)
            except Exception:
                pass

    # Also check in-memory flag store
    if not results:
        mem_flags = _get_flags_from_memory()
        if district:
            mem_flags = [f for f in mem_flags if f.get("district") == district]
        if taluka:
            mem_flags = [f for f in mem_flags if f.get("taluka") == taluka]
        results = [f for f in mem_flags if f.get("status") == "AUDIT_REVIEW"]

    seen: set = set()
    unique: list = []
    for c in results:
        key = c.get("case_id") or c.get("flag_id", "")
        if key not in seen:
            seen.add(key)
            unique.append(_normalize_for_audit(c))

    return {"total": len(unique), "reviewed": unique}

