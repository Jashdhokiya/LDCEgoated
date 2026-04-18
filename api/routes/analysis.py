"""
api/routes/analysis.py
Core detection-engine routes — protected to DFO role.
POST /api/run-analysis
GET  /api/flags
GET  /api/flag/{flag_id}
PATCH /api/flag/{flag_id}/status
GET  /api/stats
GET  /api/report
"""
import time
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import PlainTextResponse

from ..deps import require_role, get_current_user

router = APIRouter(tags=["analysis"])

# ── In-memory flag store (populated after run-analysis) ────────────────────
_flag_store: dict = {}

# ── Lazy imports to avoid circular deps ─────────────────────────────────────

def _load_detectors():
    from detectors.cross_scheme_detector import detect_cross_scheme
    from detectors.data_loader           import load_all
    from detectors.deceased_detector     import detect_deceased
    from detectors.duplicate_detector    import detect_duplicates
    from detectors.risk_scorer           import compute_risk_score
    from detectors.undrawn_detector      import detect_undrawn
    return detect_deceased, detect_duplicates, detect_undrawn, detect_cross_scheme, compute_risk_score, load_all


def _get_db():
    try:
        from database import get_db
        return get_db()
    except Exception as e:
        print(f"  [analysis] MongoDB unavailable: {e}")
        return None


def _col(name: str):
    db = _get_db()
    return db[name] if db is not None else None


def _fallback_evidence(flag: dict) -> str:
    lt = flag.get("leakage_type", "")
    ed = flag.get("evidence_data") or {}
    if lt == "DECEASED":
        return (f"Student received ₹{flag.get('payment_amount',0):,} under {flag.get('scheme')} "
                f"on {flag.get('payment_date')}. Death registry: {ed.get('death_date')}. "
                f"Payment {ed.get('days_post_mortem')} days post-mortem.")
    if lt == "DUPLICATE":
        return (f"Duplicate identity. Primary: {ed.get('primary_name')} "
                f"({ed.get('primary_district')}). Method: {ed.get('match_method')}.")
    if lt == "UNDRAWN":
        return (f"₹{flag.get('payment_amount',0):,} credited {flag.get('payment_date')} — "
                f"undrawn for {ed.get('days_pending')} days (threshold: {ed.get('threshold_days')}).")
    if lt == "CROSS_SCHEME":
        return (f"Drawing {ed.get('scheme_a')} (₹{ed.get('amount_a',0):,}) and "
                f"{ed.get('scheme_b')} (₹{ed.get('amount_b',0):,}) simultaneously.")
    return "Anomaly detected. Manual review required."


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/api/run-analysis")
async def run_analysis(body: dict, user: dict = Depends(require_role("DFO", "STATE_ADMIN"))):
    global _flag_store
    start = time.time()

    try:
        detect_deceased, detect_duplicates, detect_undrawn, detect_cross_scheme, compute_risk_score, load_all = _load_detectors()
    except ImportError as e:
        raise HTTPException(500, f"Detector import failed: {e}")

    try:
        from ai_layer.evidence_generator import generate_evidence
    except Exception:
        generate_evidence = None

    raw_flags = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(detect_deceased), ex.submit(detect_duplicates),
                ex.submit(detect_undrawn), ex.submit(detect_cross_scheme)]
        for f in futs:
            raw_flags.extend(f.result())

    enriched = []
    for raw in raw_flags:
        score, label, action = compute_risk_score(raw)
        try:
            evidence = generate_evidence(raw, label=label) if generate_evidence else _fallback_evidence(raw)
        except Exception:
            evidence = _fallback_evidence(raw)
        enriched.append({**raw, "risk_score": score, "risk_label": label,
                          "evidence": evidence, "recommended_action": action, "status": "OPEN"})

    enriched.sort(key=lambda x: x["risk_score"], reverse=True)
    _flag_store.clear()
    for idx, flag in enumerate(enriched, start=1):
        fid = f"F-{idx:04d}"
        flag["flag_id"] = fid
        _flag_store[fid] = flag

    col = _col("flags")
    if col is not None:
        try:
            col.delete_many({})
            if enriched:
                col.insert_many([{k: v for k, v in f.items() if k != "_id"} for f in enriched])
        except Exception as e:
            print(f"  [analysis] MongoDB write error: {e}")

    elapsed = time.time() - start
    data = load_all()
    return {
        "run_id":                   body.get("run_id", str(uuid.uuid4())),
        "total_transactions":       len(data.get("payments", [])),
        "flagged_count":            len(enriched),
        "processing_time_seconds":  round(elapsed, 2),
        "flags":                    enriched,
        "run_by":                   user.get("name"),
    }


@router.get("/api/flags")
async def get_flags(user: dict = Depends(require_role("DFO", "STATE_ADMIN", "AUDIT"))):
    col = _col("flags")
    if col is not None:
        try:
            docs = list(col.find({}, {"_id": 0}).sort("risk_score", -1))
            if docs:
                return docs
        except Exception:
            pass
    return sorted(_flag_store.values(), key=lambda x: x.get("risk_score", 0), reverse=True)


@router.get("/api/flag/{flag_id}")
async def get_flag(flag_id: str, user: dict = Depends(require_role("DFO", "STATE_ADMIN", "AUDIT"))):
    col = _col("flags")
    if col is not None:
        try:
            doc = col.find_one({"flag_id": flag_id}, {"_id": 0})
            if doc:
                return doc
        except Exception:
            pass
    if flag_id not in _flag_store:
        raise HTTPException(404, "Flag not found")
    return _flag_store[flag_id]


@router.post("/api/flag/{flag_id}/generate-evidence")
async def generate_flag_evidence(flag_id: str,
                                  user: dict = Depends(require_role("DFO", "STATE_ADMIN", "AUDIT"))):
    """Generate AI evidence for a single flag and persist it."""
    # Retrieve the flag
    flag = None
    col = _col("flags")
    if col is not None:
        try:
            flag = col.find_one({"flag_id": flag_id}, {"_id": 0})
        except Exception:
            pass
    if flag is None:
        flag = _flag_store.get(flag_id)
    if flag is None:
        raise HTTPException(404, "Flag not found")

    # Generate evidence
    try:
        from ai_layer.evidence_generator import generate_evidence
        evidence = generate_evidence(flag, label="CRITICAL")   # force AI path
        source = "ai"
    except Exception:
        evidence = _fallback_evidence(flag)
        source = "template"

    # Persist the updated evidence
    if col is not None:
        try:
            col.update_one({"flag_id": flag_id}, {"$set": {"evidence": evidence}})
        except Exception:
            pass
    if flag_id in _flag_store:
        _flag_store[flag_id]["evidence"] = evidence

    return {"evidence": evidence, "source": source}


@router.patch("/api/flag/{flag_id}/status")
async def update_flag_status(flag_id: str, body: dict,
                              user: dict = Depends(require_role("DFO", "AUDIT"))):
    valid = {"OPEN", "ASSIGNED", "RESOLVED"}
    new_status = body.get("status")
    if new_status not in valid:
        raise HTTPException(400, f"Status must be one of {valid}")

    col = _col("flags")
    if col is not None:
        try:
            col.update_one({"flag_id": flag_id}, {"$set": {"status": new_status}})
        except Exception:
            pass

    if flag_id in _flag_store:
        _flag_store[flag_id]["status"] = new_status
        return _flag_store[flag_id]
    return {"flag_id": flag_id, "status": new_status}


@router.get("/api/stats")
async def get_stats(user: dict = Depends(require_role("DFO", "STATE_ADMIN", "AUDIT"))):
    flags = []
    col = _col("flags")
    if col is not None:
        try:
            flags = list(col.find({}, {"_id": 0}))
        except Exception:
            pass
    if not flags:
        flags = list(_flag_store.values())

    by_type = defaultdict(int)
    by_district = defaultdict(int)
    by_scheme = defaultdict(int)
    total_at_risk = 0
    for flag in flags:
        by_type[flag.get("leakage_type", "UNKNOWN")] += 1
        by_district[flag.get("district", "Unknown")] += 1
        scheme = flag.get("scheme", "")
        for s in (scheme.split("+") if "+" in str(scheme) else [scheme]):
            if s:
                by_scheme[s.strip()] += 1
        total_at_risk += flag.get("payment_amount", 0) or 0

    return {
        "by_leakage_type":    dict(by_type),
        "by_district":        dict(by_district),
        "by_scheme":          dict(by_scheme),
        "total_amount_at_risk": total_at_risk,
    }


@router.get("/api/report", response_class=PlainTextResponse)
async def get_report(user: dict = Depends(require_role("DFO", "STATE_ADMIN", "AUDIT"))):
    flags = []
    col = _col("flags")
    if col is not None:
        try:
            flags = list(col.find({}, {"_id": 0}))
        except Exception:
            pass
    if not flags:
        flags = list(_flag_store.values())

    try:
        from ai_layer.report_generator import generate_report
        return generate_report(flags)
    except Exception:
        pass

    total = sum(f.get("payment_amount", 0) or 0 for f in flags)
    by_type = defaultdict(int)
    for f in flags:
        by_type[f.get("leakage_type", "?")] += 1
    lines = [
        "EDUGUARD DBT AUDIT REPORT",
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        f"Generated by: {user.get('name')} ({user.get('role')})",
        "=" * 50,
        f"Total Flags: {len(flags)}",
        f"Total Amount at Risk: ₹{total:,}",
        "",
        "BREAKDOWN BY LEAKAGE TYPE:",
    ]
    for lt, count in by_type.items():
        lines.append(f"  {lt}: {count} cases")
    return "\n".join(lines)
