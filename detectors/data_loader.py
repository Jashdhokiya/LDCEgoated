import json
import os
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List

from .mock_data import (
    MOCK_BENEFICIARIES,
    MOCK_DEATH_REGISTRY,
    MOCK_PAYMENTS,
    MOCK_UDISE,
)

DATA_PATH = Path(os.getenv("DATA_PATH", "./data"))

_cache: Dict[str, Any] = {}
_lock = Lock()


def _read_json(path: Path) -> List[dict]:
    if not path.exists():
        raise FileNotFoundError(f"Missing data file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _load_or_mock(filename: str, mock_data: List[dict]) -> List[dict]:
    try:
        return _read_json(DATA_PATH / filename)
    except FileNotFoundError:
        return mock_data


def _try_load_from_mongo() -> bool:
    """
    Attempt to load all datasets from MongoDB Atlas.
    Returns True if successful, False otherwise.
    Data is placed directly into ``_cache``.
    """
    try:
        from database import is_mongo_available

        if not is_mongo_available():
            return False

        from database import (
            get_deaths_collection,
            get_payments_collection,
            get_students_collection,
            get_udise_collection,
        )

        students_raw = list(get_students_collection().find({}, {"_id": 0}))
        if not students_raw:
            return False  # empty DB → fall back

        payments_raw = list(get_payments_collection().find({}, {"_id": 0}))
        deaths_raw = list(get_deaths_collection().find({}, {"_id": 0}))

        # Re-map student docs to the flat shapes expected by detectors.
        beneficiaries: List[dict] = []
        udise: List[dict] = []

        for s in students_raw:
            ben = {
                "beneficiary_id": s["beneficiary_id"],
                "aadhaar_hash": s.get("aadhaar_hash", ""),
                "name": s.get("name", ""),
                "name_variants": s.get("name_variants", []),
                "dob": s.get("dob"),
                "gender": s.get("gender", ""),
                "caste_category": s.get("caste_category"),
                "district": s.get("district", ""),
                "taluka": s.get("taluka"),
                "bank_account_hash": s.get("bank_account_hash"),
                "is_deceased": s.get("is_deceased", False),
                "death_date": s.get("death_date"),
            }
            beneficiaries.append(ben)

            u = s.get("udise")
            if u:
                udise.append(
                    {
                        "beneficiary_id": s["beneficiary_id"],
                        "udise_code": u.get("udise_code", ""),
                        "school_name": u.get("school_name", ""),
                        "standard": u.get("standard", 0),
                        "stream": u.get("stream", ""),
                        "attendance_pct": u.get("attendance_pct", 0),
                        "marks_pct": u.get("marks_pct", 0),
                        "enrollment_status": u.get("enrollment_status", "ACTIVE"),
                        "academic_year": u.get("academic_year", "2024-25"),
                    }
                )

        # Some seed paths store UDISE as a separate collection instead of
        # embedding under each student record.
        if not udise:
            udise = list(get_udise_collection().find({}, {"_id": 0}))

        # Map payments back to the legacy shape (amount key stays "amount")
        payments: List[dict] = []
        for p in payments_raw:
            payments.append(
                {
                    "payment_id": p.get("payment_id"),
                    "beneficiary_id": p.get("beneficiary_id"),
                    "scheme": p.get("scheme"),
                    "amount": p.get("amount", 0),
                    "payment_date": p.get("payment_date"),
                    "credit_date": p.get("credit_date"),
                    "withdrawal_date": p.get("withdrawal_date"),
                    "bank_account_hash": p.get("bank_account_hash"),
                    "payment_status": p.get("payment_status", "CREDITED"),
                }
            )

        death_registry = deaths_raw

        # Populate cache in the same format as the JSON-file path.
        _cache["beneficiaries"] = beneficiaries
        _cache["udise"] = udise
        _cache["payments"] = payments
        _cache["death_registry"] = death_registry
        _cache["_source"] = "mongodb"

        return True

    except Exception:
        return False


def load_all() -> Dict[str, Any]:
    """Load all datasets once and build O(1) lookup indexes.

    Priority order:
        1. MongoDB Atlas (if MONGO_URI is set and reachable)
        2. Local JSON files under DATA_PATH
        3. Built-in mock data
    """
    if _cache:
        return _cache

    with _lock:
        if _cache:
            return _cache

        # --- Try MongoDB first ---
        if not _try_load_from_mongo():
            # --- Fallback: JSON files / mock data ---
            _cache["beneficiaries"] = _load_or_mock(
                "beneficiaries.json", MOCK_BENEFICIARIES
            )
            _cache["udise"] = _load_or_mock("udise_records.json", MOCK_UDISE)
            _cache["payments"] = _load_or_mock("payment_ledger.json", MOCK_PAYMENTS)
            _cache["death_registry"] = _load_or_mock(
                "death_registry.json", MOCK_DEATH_REGISTRY
            )
            _cache["_source"] = "json"

        # --- Build O(1) lookup indexes (same as before) ---
        _cache["beneficiary_by_id"] = {
            b["beneficiary_id"]: b
            for b in _cache["beneficiaries"]
            if "beneficiary_id" in b
        }
        _cache["udise_by_id"] = {
            u["beneficiary_id"]: u
            for u in _cache["udise"]
            if "beneficiary_id" in u
        }

        payments_by_id: Dict[str, List[dict]] = {}
        for payment in _cache["payments"]:
            beneficiary_id = payment.get("beneficiary_id")
            if beneficiary_id is None:
                continue
            payments_by_id.setdefault(beneficiary_id, []).append(payment)
        _cache["payments_by_id"] = payments_by_id

        _cache["death_by_aadhaar"] = {
            d["aadhaar_hash"]: d
            for d in _cache["death_registry"]
            if "aadhaar_hash" in d
        }

        source = _cache.get("_source", "unknown")
        print(f"  [data_loader] Loaded from: {source}")

        return _cache


def clear_cache() -> None:
    """Clear cache for tests or explicit reloads."""
    with _lock:
        _cache.clear()
