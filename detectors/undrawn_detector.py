from datetime import date, datetime
from typing import Any, Dict, List

from .data_loader import load_all

THRESHOLD_DAYS = 60

def detect_undrawn() -> List[Dict[str, Any]]:
    data = load_all()
    flags: List[Dict[str, Any]] = []

    for payment in data["payments"]:
        if payment.get("withdrawal_date") is not None:
            continue
        if payment.get("payment_status") == "RETURNED":
            continue

        try:
            payment_date = datetime.fromisoformat(payment["payment_date"]).date()
        except (KeyError, TypeError, ValueError):
            continue

        days_pending = (date.today() - payment_date).days
        if days_pending < THRESHOLD_DAYS:
            continue

        ben = data["beneficiary_by_id"].get(payment.get("beneficiary_id"))
        if not ben:
            continue

        udise = data["udise_by_id"].get(payment.get("beneficiary_id"), {})

        flags.append(
            {
                "beneficiary_id": ben["beneficiary_id"],
                "beneficiary_name": ben.get("name", "Unknown"),
                "district": ben.get("district", "Unknown"),
                "taluka": ben.get("taluka", "Unknown"),
                "scheme": payment.get("scheme", "UNKNOWN"),
                "payment_id": payment.get("payment_id"),
                "payment_amount": payment.get("amount", 0),
                "payment_date": payment.get("payment_date"),
                "leakage_type": "UNDRAWN",
                "evidence_data": {
                    "days_pending": days_pending,
                    "threshold_days": THRESHOLD_DAYS,
                    "payment_status": payment.get("payment_status"),
                    "school": udise.get("school_name", "Unknown"),
                    "enrollment_status": udise.get("enrollment_status", "Unknown"),
                    "attendance_pct": udise.get("attendance_pct"),
                },
            }
        )

    return flags
