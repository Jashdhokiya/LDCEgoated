import time
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from detectors.cross_scheme_detector import detect_cross_scheme
from detectors.data_loader import load_all
from detectors.deceased_detector import detect_deceased
from detectors.duplicate_detector import detect_duplicates
from detectors.risk_scorer import compute_risk_score
from detectors.undrawn_detector import detect_undrawn

try:
    from ai_layer.evidence_generator import generate_evidence
except Exception:  # pragma: no cover
    generate_evidence = None

try:
    from ai_layer.report_generator import generate_report
except Exception:  # pragma: no cover
    generate_report = None

# --- MongoDB (optional) ----------------------------------------------------
_mongo_ok = False
try:
    from database import (
        is_mongo_available,
        get_flags_collection,
        get_students_collection,
    )
except Exception:
    is_mongo_available = None
    get_flags_collection = None
    get_students_collection = None

app = FastAPI(title="EduGuard DBT API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_flag_store = {}


@app.on_event("startup")
async def startup():
    global _mongo_ok
    load_all()
    # Check MongoDB availability for flag persistence
    if is_mongo_available:
        try:
            _mongo_ok = is_mongo_available()
            print(f"  [api] MongoDB available: {_mongo_ok}")
        except Exception:
            _mongo_ok = False
            print("  [api] MongoDB not available — using in-memory store")


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

@app.post("/api/run-analysis")
async def run_analysis(body: dict):
    global _mongo_ok
    start = time.time()

    raw_flags = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [
            executor.submit(detect_deceased),
            executor.submit(detect_duplicates),
            executor.submit(detect_undrawn),
            executor.submit(detect_cross_scheme),
        ]
        for future in futures:
            raw_flags.extend(future.result())

    enriched_flags = []
    for raw in raw_flags:
        score, label, action = compute_risk_score(raw)

        try:
            evidence = generate_evidence(raw) if generate_evidence else _fallback_evidence(raw)
        except Exception:
            evidence = _fallback_evidence(raw)

        enriched_flags.append(
            {
                **raw,
                "risk_score": score,
                "risk_label": label,
                "evidence": evidence,
                "recommended_action": action,
                "status": "OPEN",
            }
        )

    enriched_flags.sort(key=lambda x: x["risk_score"], reverse=True)

    # Assign IDs and store
    _flag_store.clear()
    for idx, flag in enumerate(enriched_flags, start=1):
        flag_id = f"F-{idx:04d}"
        flag["flag_id"] = flag_id
        _flag_store[flag_id] = flag

    # Persist to MongoDB if available
    if _mongo_ok and get_flags_collection:
        try:
            coll = get_flags_collection()
            coll.delete_many({})  # clear old flags
            if enriched_flags:
                # Remove any MongoDB-incompatible keys & insert
                docs = [{k: v for k, v in f.items() if k != "_id"} for f in enriched_flags]
                coll.insert_many(docs)
        except Exception as e:
            print(f"  [api] Failed to persist flags to MongoDB: {e}")

    elapsed = time.time() - start
    data = load_all()

    return {
        "run_id": body.get("run_id", str(uuid.uuid4())),
        "total_transactions": len(data["payments"]),
        "flagged_count": len(enriched_flags),
        "processing_time_seconds": round(elapsed, 2),
        "flags": enriched_flags,
    }


# ---------------------------------------------------------------------------
# Flags CRUD
# ---------------------------------------------------------------------------

@app.get("/api/flags")
async def get_flags():
    return sorted(_flag_store.values(), key=lambda x: x["risk_score"], reverse=True)


@app.get("/api/flag/{flag_id}")
async def get_flag(flag_id: str):
    if flag_id not in _flag_store:
        raise HTTPException(404, "Flag not found")
    return _flag_store[flag_id]


@app.patch("/api/flag/{flag_id}/status")
async def update_flag_status(flag_id: str, body: dict):
    if flag_id not in _flag_store:
        raise HTTPException(404, "Flag not found")

    valid_statuses = {"OPEN", "ASSIGNED", "RESOLVED"}
    new_status = body.get("status")
    if new_status not in valid_statuses:
        raise HTTPException(400, f"Status must be one of {valid_statuses}")

    _flag_store[flag_id]["status"] = new_status

    # Sync to MongoDB
    if _mongo_ok and get_flags_collection:
        try:
            get_flags_collection().update_one(
                {"flag_id": flag_id}, {"$set": {"status": new_status}}
            )
        except Exception:
            pass

    return _flag_store[flag_id]


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@app.get("/api/stats")
async def get_stats():
    flags = list(_flag_store.values())
    by_type = defaultdict(int)
    by_district = defaultdict(int)
    by_scheme = defaultdict(int)
    total_at_risk = 0

    for flag in flags:
        by_type[flag["leakage_type"]] += 1
        by_district[flag["district"]] += 1
        scheme_value = flag["scheme"]
        if isinstance(scheme_value, str) and "+" in scheme_value:
            for scheme_code in (part.strip() for part in scheme_value.split("+")):
                if scheme_code:
                    by_scheme[scheme_code] += 1
        elif scheme_value:
            by_scheme[scheme_value] += 1
        total_at_risk += flag.get("payment_amount", 0) or 0

    return {
        "by_leakage_type": dict(by_type),
        "by_district": dict(by_district),
        "by_scheme": dict(by_scheme),
        "total_amount_at_risk": total_at_risk,
    }


# ---------------------------------------------------------------------------
# Students (NEW)
# ---------------------------------------------------------------------------

@app.get("/api/students")
async def list_students(
    district: str = None,
    scheme: str = None,
    eligible_for: str = None,
    skip: int = 0,
    limit: int = 50,
):
    """
    List students with scheme tracking info.
    Reads from MongoDB if available, otherwise synthesises from cache.
    """
    if _mongo_ok and get_students_collection:
        try:
            query: dict = {}
            if district:
                query["district"] = district
            if scheme:
                query["schemes_taken"] = scheme
            if eligible_for:
                query["schemes_eligible"] = eligible_for

            cursor = (
                get_students_collection()
                .find(query, {"_id": 0})
                .skip(skip)
                .limit(limit)
            )
            return list(cursor)
        except Exception:
            pass

    # Fallback: build from in-memory cache
    return _students_from_cache(district, scheme, eligible_for, skip, limit)


@app.get("/api/student/{beneficiary_id}")
async def get_student(beneficiary_id: str):
    """Return a single student with scheme info."""
    if _mongo_ok and get_students_collection:
        try:
            doc = get_students_collection().find_one(
                {"beneficiary_id": beneficiary_id}, {"_id": 0}
            )
            if doc:
                return doc
        except Exception:
            pass

    # Fallback
    data = load_all()
    ben = data["beneficiary_by_id"].get(beneficiary_id)
    if not ben:
        raise HTTPException(404, "Student not found")
    return _enrich_student(ben, data)


def _students_from_cache(district, scheme, eligible_for, skip, limit):
    """Build student list from in-memory cache (fallback path)."""
    from models import compute_scheme_eligibility

    data = load_all()
    results = []
    for ben in data["beneficiaries"]:
        if district and ben.get("district") != district:
            continue
        enriched = _enrich_student(ben, data)
        if scheme and scheme not in enriched.get("schemes_taken", []):
            continue
        if eligible_for and eligible_for not in enriched.get("schemes_eligible", []):
            continue
        results.append(enriched)

    return results[skip : skip + limit]


def _enrich_student(ben: dict, data: dict) -> dict:
    """Add scheme tracking fields to a raw beneficiary dict."""
    from models import compute_scheme_eligibility

    bid = ben["beneficiary_id"]
    udise = data["udise_by_id"].get(bid)
    payments = data["payments_by_id"].get(bid, [])
    taken = sorted({p.get("scheme") for p in payments if p.get("scheme")})
    eligible = sorted(compute_scheme_eligibility(ben, udise))
    not_taken = sorted(set(eligible) - set(taken))

    student = {
        "beneficiary_id": bid,
        "name": ben.get("name", ""),
        "gender": ben.get("gender", ""),
        "district": ben.get("district", ""),
        "taluka": ben.get("taluka"),
        "caste_category": ben.get("caste_category"),
        "is_deceased": ben.get("is_deceased", False),
        "udise": {
            "school_name": udise.get("school_name", "") if udise else "",
            "standard": udise.get("standard", 0) if udise else 0,
            "stream": udise.get("stream", "") if udise else "",
            "marks_pct": udise.get("marks_pct", 0) if udise else 0,
        }
        if udise
        else None,
        "schemes_taken": taken,
        "schemes_eligible": eligible,
        "eligible_but_not_taken": not_taken,
    }
    return student


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

@app.get("/api/report", response_class=PlainTextResponse)
async def get_report():
    flags = list(_flag_store.values())
    try:
        return generate_report(flags) if generate_report else _fallback_report(flags)
    except Exception:
        return _fallback_report(flags)


# ---------------------------------------------------------------------------
# Fallbacks (unchanged)
# ---------------------------------------------------------------------------

def _fallback_evidence(flag):
    leakage_type = flag["leakage_type"]
    evidence_data = flag["evidence_data"]

    if leakage_type == "DECEASED":
        return (
            f"Student received Rs {flag['payment_amount']:,} under {flag['scheme']} on "
            f"{flag['payment_date']}. Death registry shows date of death: "
            f"{evidence_data['death_date']}. Payment issued "
            f"{evidence_data['days_post_mortem']} days post-mortem."
        )

    if leakage_type == "DUPLICATE":
        return (
            "Duplicate identity detected. "
            f"Primary beneficiary: {evidence_data.get('primary_name')} "
            f"({evidence_data.get('primary_district')}). "
            f"Match method: {evidence_data.get('match_method')}."
        )

    if leakage_type == "UNDRAWN":
        return (
            f"Rs {flag['payment_amount']:,} credited on {flag['payment_date']} remains "
            f"undrawn after {evidence_data['days_pending']} days. "
            f"Threshold: {evidence_data['threshold_days']} days."
        )

    if leakage_type == "CROSS_SCHEME":
        return (
            f"Student drawing both {evidence_data['scheme_a']} (Rs {evidence_data['amount_a']:,}) and "
            f"{evidence_data['scheme_b']} (Rs {evidence_data['amount_b']:,}) simultaneously. "
            f"Total: Rs {evidence_data['total_amount']:,}. {evidence_data['rule_violated']}."
        )

    return "Anomaly detected. Manual review required."


def _fallback_report(flags):
    total = sum(flag.get("payment_amount", 0) or 0 for flag in flags)
    by_type = defaultdict(int)
    for flag in flags:
        by_type[flag["leakage_type"]] += 1

    lines = [
        "EDUGUARD DBT AUDIT REPORT",
        "=" * 50,
        f"Total Flags: {len(flags)}",
        f"Total Amount at Risk: Rs {total:,}",
        "",
        "BREAKDOWN BY LEAKAGE TYPE:",
    ]
    for leakage_type, count in by_type.items():
        lines.append(f"  {leakage_type}: {count} cases")
    return "\n".join(lines)
