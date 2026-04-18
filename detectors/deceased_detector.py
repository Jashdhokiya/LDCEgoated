from datetime import datetime
from typing import Any, Dict, List

from .data_loader import load_all


def detect_deceased() -> List[Dict[str, Any]]:
    """
    Flag payments made after a beneficiary's death date.
    Ground truth: payment_date > death_date for same aadhaar_hash.
    """
    data = load_all()
    flags: List[Dict[str, Any]] = []

    for payment in data["payments"]:
        ben = data["beneficiary_by_id"].get(payment.get("beneficiary_id"))
        if not ben:
            continue

        death_record = data["death_by_aadhaar"].get(ben.get("aadhaar_hash"))
        if not death_record:
            continue

        try:
            payment_date = datetime.fromisoformat(payment["payment_date"]).date()
            death_date = datetime.fromisoformat(death_record["death_date"]).date()
        except (KeyError, TypeError, ValueError):
            continue

        if payment_date > death_date:
            days_post_mortem = (payment_date - death_date).days
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
                    "leakage_type": "DECEASED",
                    "evidence_data": {
                        "death_date": death_record.get("death_date"),
                        "days_post_mortem": days_post_mortem,
                        "payment_date": payment.get("payment_date"),
                        "amount": payment.get("amount", 0),
                        "scheme": payment.get("scheme", "UNKNOWN"),
                    },
                }
            )

    return flags
