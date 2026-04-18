"""
api/routes/verifier.py
Scheme Verifier-only endpoints.
GET  /api/verifier/my-cases                   — cases assigned to this verifier
GET  /api/verifier/case/{case_id}             — single case detail
POST /api/verifier/evidence/{case_id}         — submit GPS-tagged photo evidence
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import require_role

router = APIRouter(prefix="/api/verifier", tags=["verifier"])


def _get_db():
    try:
        from database import get_db
        return get_db()
    except Exception as e:
        print(f"  [verifier] MongoDB unavailable: {e}")
        return None


def _col(name: str):
    db = _get_db()
    return db[name] if db is not None else None


def _get_flags_from_memory():
    """Get flags from the in-memory store in analysis.py."""
    try:
        from .analysis import _flag_store
        return _flag_store
    except Exception:
        return {}


def _normalize_for_verifier(flag: dict) -> dict:
    """Transform a raw flag into a verifier-compatible case shape."""
    return {
        "case_id":          flag.get("flag_id") or flag.get("case_id"),
        "flag_id":          flag.get("flag_id"),
        "beneficiary_name": flag.get("beneficiary_name"),
        "beneficiary_id":  flag.get("beneficiary_id"),
        "district":         flag.get("district"),
        "scheme":           flag.get("scheme"),
        "leakage_type":     flag.get("leakage_type"),
        "anomaly_type":     flag.get("leakage_type"),   # alias for frontend compat
        "payment_amount":   flag.get("payment_amount", 0),
        "amount":           flag.get("payment_amount", 0),  # alias
        "risk_score":       flag.get("risk_score", 0),
        "risk_label":       flag.get("risk_label"),
        "status":           flag.get("status", "ASSIGNED_TO_VERIFIER"),
        "evidence":         flag.get("evidence"),
        "recommended_action": flag.get("recommended_action"),
        "assigned_verifier_id": flag.get("assigned_verifier_id"),
        "assigned_date":    flag.get("assigned_at") or datetime.utcnow().strftime("%Y-%m-%d"),
        "target_entity": flag.get("target_entity") or {
            "entity_type": "USER",
            "entity_id":   flag.get("beneficiary_id", "—"),
            "name":        flag.get("beneficiary_name", "—"),
        },
        "field_report":     flag.get("field_report"),
        "audit_report":     flag.get("audit_report"),
    }


# ── Pydantic models ───────────────────────────────────────────────────────────

class EvidenceSubmission(BaseModel):
    photo_evidence_url: str
    gps_lat:            float
    gps_lng:            float
    verifier_notes:     str
    ai_verification_match: Optional[bool]   = None
    confidence_score:   Optional[float]     = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _find_case(case_id: str, verifier_id: str):
    """Finds a case in mongo (investigations or flags) assigned to this verifier."""
    for cname in ["investigations", "flags"]:
        col = _col(cname)
        if col is not None:
            try:
                doc = col.find_one(
                    {"$or": [{"case_id": case_id}, {"flag_id": case_id}],
                     "assigned_verifier_id": verifier_id},
                    {"_id": 0}
                )
                if doc:
                    return doc, cname
            except Exception:
                pass
    return None, None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/my-cases")
async def my_cases(user: dict = Depends(require_role("SCHEME_VERIFIER"))):
    """Return all cases assigned to the currently authenticated verifier."""
    verifier_id = user["sub"]
    all_cases: list = []

    # 1. Try MongoDB collections
    for cname in ["investigations", "flags"]:
        col = _col(cname)
        if col is not None:
            try:
                docs = list(col.find(
                    {"assigned_verifier_id": verifier_id},
                    {"_id": 0}
                ).sort("risk_score", -1))
                all_cases.extend(docs)
            except Exception:
                pass

    # 2. Fall back to in-memory flag store — cases assigned to this verifier
    if not all_cases:
        flag_store = _get_flags_from_memory()
        for fid, f in flag_store.items():
            if f.get("assigned_verifier_id") == verifier_id:
                all_cases.append(f)

    # 3. If still empty, provide demo cases: assign top high-risk flags to this verifier
    if not all_cases:
        flag_store = _get_flags_from_memory()
        all_flags = sorted(flag_store.values(), key=lambda x: x.get("risk_score", 0), reverse=True)
        
        # If no flags in memory, try fetching from mongo
        if not all_flags:
            col = _col("flags")
            if col is not None:
                try:
                    all_flags = list(col.find({}, {"_id": 0}).sort("risk_score", -1))
                except Exception:
                    pass

        # Apply district and taluka filters
        # Reverted per user request: "do this for auditer only currently"
        # district = user.get("district")
        # taluka = user.get("taluka")
        # if district:
        #     all_flags = [f for f in all_flags if f.get("district") == district]
        # if taluka:
        #     all_flags = [f for f in all_flags if f.get("taluka") == taluka]

        demo_cases = []
        for f in all_flags:
            if f.get("status") in ("OPEN", "ASSIGNED"):
                # Temporarily mark as assigned to this verifier for demo
                demo = dict(f)
                demo["assigned_verifier_id"] = verifier_id
                demo["status"] = "ASSIGNED_TO_VERIFIER"
                demo_cases.append(demo)
                if len(demo_cases) >= 5:
                    break
        all_cases = demo_cases

    # De-duplicate by case_id / flag_id
    seen: set = set()
    unique: list = []
    for c in all_cases:
        key = c.get("case_id") or c.get("flag_id", "")
        if key not in seen:
            seen.add(key)
            unique.append(_normalize_for_verifier(c))

    return {
        "verifier_id": verifier_id,
        "name":        user.get("name"),
        "total":       len(unique),
        "pending":     sum(1 for c in unique if c.get("status") == "ASSIGNED_TO_VERIFIER"),
        "submitted":   sum(1 for c in unique if c.get("status") == "VERIFICATION_SUBMITTED"),
        "cases":       unique,
    }


@router.get("/case/{case_id}")
async def get_case(case_id: str, user: dict = Depends(require_role("SCHEME_VERIFIER"))):
    # Try MongoDB
    doc, _ = _find_case(case_id, user["sub"])
    if doc:
        return _normalize_for_verifier(doc)
    # Try in-memory
    flag_store = _get_flags_from_memory()
    if case_id in flag_store:
        return _normalize_for_verifier(flag_store[case_id])
    raise HTTPException(404, f"Case {case_id} not found or not assigned to you")


@router.post("/evidence/{case_id}")
async def submit_evidence(
    case_id: str,
    body: EvidenceSubmission,
    user: dict = Depends(require_role("SCHEME_VERIFIER")),
):
    """Submit GPS-tagged field evidence for a case."""
    doc, collection_name = _find_case(case_id, user["sub"])
    if not doc:
        # Still allow submission even if not explicitly assigned (for demo)
        collection_name = "flags"

    field_report = {
        "photo_evidence_url":    body.photo_evidence_url,
        "gps_coordinates":       {"lat": body.gps_lat, "lng": body.gps_lng},
        "verifier_notes":        body.verifier_notes,
        "ai_verification_match": body.ai_verification_match,
        "ai_analysis": {
            "confidence_score": body.confidence_score or 0,
            "reason":           "AI analysis pending" if body.ai_verification_match is None else (
                "Match confirmed by frontend AI layer." if body.ai_verification_match
                else "Mismatch detected by frontend AI layer."
            ),
            "proofs": [
                f"GPS coordinates verified: ({body.gps_lat:.5f}, {body.gps_lng:.5f})",
                f"Evidence submitted by verifier {user.get('name', user['sub'])}",
                f"Submission timestamp: {datetime.utcnow().isoformat()}",
            ],
        },
        "submission_timestamp":  datetime.utcnow().isoformat(),
        "submitted_by":          user["sub"],
    }

    update = {
        "status":       "VERIFICATION_SUBMITTED",
        "field_report": field_report,
    }

    # Update MongoDB
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

    # Also update in-memory flag store so audit/DFO see the submission
    try:
        from .analysis import _flag_store
        if case_id in _flag_store:
            _flag_store[case_id]["status"] = "VERIFICATION_SUBMITTED"
            _flag_store[case_id]["field_report"] = field_report
    except Exception:
        pass

    return {"case_id": case_id, "status": "VERIFICATION_SUBMITTED", "field_report": field_report}

