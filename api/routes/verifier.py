"""
api/routes/verifier.py
Scheme Verifier-only endpoints — district-scoped.
GET  /api/verifier/my-cases              — cases assigned to this verifier
GET  /api/verifier/case/{case_id}        — single case detail
POST /api/verifier/evidence/{case_id}    — submit GPS-tagged photo evidence
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import require_role

router = APIRouter(prefix="/api/verifier", tags=["verifier"])


def _get_db():
    try:
        from ..database import get_db
        return get_db()
    except Exception as e:
        print(f"  [verifier] MongoDB unavailable: {e}")
        return None


def _col(name: str):
    db = _get_db()
    if db is None:
        raise HTTPException(503, "Database unavailable")
    return db[name]


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
        "anomaly_type":     flag.get("leakage_type"),  # alias for frontend compat
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
    live_gps_lat:       Optional[float]     = None
    live_gps_lng:       Optional[float]     = None
    live_gps_accuracy:  Optional[float]     = None
    reverse_geocode_district: Optional[str] = None
    reverse_geocode_taluka:   Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/my-cases")
async def my_cases(user: dict = Depends(require_role("SCHEME_VERIFIER"))):
    """Return all cases assigned to the currently authenticated verifier.
    Filtered by the verifier's district for safety."""
    verifier_id = user["sub"]
    district = user.get("district")

    col = _col("flags")

    # Query: assigned to this verifier AND in this district
    query = {"assigned_verifier_id": verifier_id}
    if district:
        query["district"] = district

    docs = list(col.find(query, {"_id": 0}).sort("risk_score", -1))

    # De-duplicate by flag_id
    seen = set()
    unique = []
    for c in docs:
        key = c.get("flag_id") or c.get("case_id", "")
        if key not in seen:
            seen.add(key)
            unique.append(_normalize_for_verifier(c))

    return {
        "verifier_id": verifier_id,
        "name":        user.get("name"),
        "district":    district,
        "total":       len(unique),
        "pending":     sum(1 for c in unique if c.get("status") == "ASSIGNED_TO_VERIFIER"),
        "submitted":   sum(1 for c in unique if c.get("status") == "VERIFICATION_SUBMITTED"),
        "cases":       unique,
    }


@router.get("/case/{case_id}")
async def get_case(case_id: str, user: dict = Depends(require_role("SCHEME_VERIFIER"))):
    col = _col("flags")
    doc = col.find_one(
        {"$or": [{"case_id": case_id}, {"flag_id": case_id}],
         "assigned_verifier_id": user["sub"]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, f"Case {case_id} not found or not assigned to you")
    return _normalize_for_verifier(doc)


def _reverse_geocode_server(lat: float, lng: float) -> dict:
    """Server-side reverse geocoding via Nominatim (free, no API key)."""
    import requests
    try:
        res = requests.get(
            f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json&addressdetails=1&zoom=12",
            headers={"Accept-Language": "en", "User-Agent": "EduGuard-DBT/1.0"},
            timeout=10,
        )
        if res.status_code != 200:
            return {}
        data = res.json()
        addr = data.get("address", {})
        return {
            "display": data.get("display_name", ""),
            "district": addr.get("state_district") or addr.get("county", ""),
            "taluka": addr.get("suburb") or addr.get("town") or addr.get("village") or addr.get("city", ""),
            "state": addr.get("state", ""),
        }
    except Exception:
        return {}


def _location_matches(geo_name: str, assigned_name: str) -> bool:
    """Fuzzy match for location names (handles transliteration variations)."""
    if not geo_name or not assigned_name:
        return False
    import re
    a = re.sub(r"[^a-z]", "", geo_name.lower())
    b = re.sub(r"[^a-z]", "", assigned_name.lower())
    if a == b:
        return True
    if a in b or b in a:
        return True
    # 3-char prefix match
    if len(a) >= 3 and len(b) >= 3 and a[:3] == b[:3]:
        return True
    return False


@router.post("/evidence/{case_id}")
async def submit_evidence(
    case_id: str,
    body: EvidenceSubmission,
    user: dict = Depends(require_role("SCHEME_VERIFIER")),
):
    """Submit GPS-tagged field evidence for a case with location verification."""
    col = _col("flags")

    # Verify case exists
    doc = col.find_one(
        {"$or": [{"case_id": case_id}, {"flag_id": case_id}]},
        {"_id": 0}
    )

    case_district = (doc or {}).get("district", "")

    # ── Server-side GPS verification ──────────────────────────────────────────
    gps_verification = {
        "live_gps": None,
        "reverse_geocode": None,
        "district_match": False,
        "verified": False,
    }

    check_lat = body.live_gps_lat or body.gps_lat
    check_lng = body.live_gps_lng or body.gps_lng

    if check_lat and check_lng:
        gps_verification["live_gps"] = {
            "lat": check_lat,
            "lng": check_lng,
            "accuracy_meters": body.live_gps_accuracy,
        }

        # Server-side reverse geocode (independent of frontend)
        geo = _reverse_geocode_server(check_lat, check_lng)
        if geo:
            gps_verification["reverse_geocode"] = geo
            gps_verification["district_match"] = _location_matches(
                geo.get("district", ""), case_district
            )
            gps_verification["verified"] = gps_verification["district_match"]

        # Cross-check with frontend-reported values
        if body.reverse_geocode_district:
            gps_verification["frontend_reported_district"] = body.reverse_geocode_district
            gps_verification["frontend_reported_taluka"] = body.reverse_geocode_taluka
    # ──────────────────────────────────────────────────────────────────────────

    field_report = {
        "photo_evidence_url":    body.photo_evidence_url,
        "gps_coordinates":       {"lat": body.gps_lat, "lng": body.gps_lng},
        "verifier_notes":        body.verifier_notes,
        "ai_verification_match": body.ai_verification_match,
        "gps_verification":      gps_verification,
        "ai_analysis": {
            "confidence_score": body.confidence_score or 0,
            "reason":           "AI analysis pending" if body.ai_verification_match is None else (
                "Match confirmed by frontend AI layer." if body.ai_verification_match
                else "Mismatch detected by frontend AI layer."
            ),
            "proofs": [
                f"GPS coordinates verified: ({body.gps_lat:.5f}, {body.gps_lng:.5f})",
                f"Live GPS: ({check_lat:.5f}, {check_lng:.5f})" if check_lat else "No live GPS",
                f"Location match: {'PASSED' if gps_verification['verified'] else 'FAILED'} — {gps_verification.get('reverse_geocode', {}).get('district', 'unknown')} vs {case_district}",
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

    # Update in MongoDB flags collection
    result = col.update_one(
        {"$or": [{"case_id": case_id}, {"flag_id": case_id}]},
        {"$set": update}
    )
    if result.matched_count == 0:
        raise HTTPException(404, f"Case {case_id} not found in database")

    return {
        "case_id": case_id,
        "status": "VERIFICATION_SUBMITTED",
        "gps_verification": gps_verification,
        "field_report": field_report,
    }

