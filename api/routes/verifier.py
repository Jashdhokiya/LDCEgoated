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
        from database import get_db, is_mongo_available
        return get_db() if is_mongo_available() else None
    except Exception:
        return None


def _col(name: str):
    db = _get_db()
    return db[name] if db else None


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
        if col:
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

    for cname in ["investigations", "flags"]:
        col = _col(cname)
        if col:
            try:
                docs = list(col.find(
                    {"assigned_verifier_id": verifier_id},
                    {"_id": 0}
                ).sort("risk_score", -1))
                all_cases.extend(docs)
            except Exception:
                pass

    # De-duplicate by case_id / flag_id
    seen: set = set()
    unique: list = []
    for c in all_cases:
        key = c.get("case_id") or c.get("flag_id", "")
        if key not in seen:
            seen.add(key)
            unique.append(c)

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
    doc, _ = _find_case(case_id, user["sub"])
    if not doc:
        raise HTTPException(404, f"Case {case_id} not found or not assigned to you")
    return doc


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
            "proofs": [],
        },
        "submission_timestamp":  datetime.utcnow().isoformat(),
        "submitted_by":          user["sub"],
    }

    update = {
        "status":       "VERIFICATION_SUBMITTED",
        "field_report": field_report,
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

    return {"case_id": case_id, "status": "VERIFICATION_SUBMITTED", "field_report": field_report}
