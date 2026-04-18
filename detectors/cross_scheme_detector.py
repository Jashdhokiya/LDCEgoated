from collections import defaultdict
from typing import Any, Dict, List

from .data_loader import load_all
from .scheme_rules import CROSS_SCHEME_FORBIDDEN_PAIRS


def detect_cross_scheme() -> List[Dict[str, Any]]:
    data = load_all()
    flags: List[Dict[str, Any]] = []

    payments_by_ben: Dict[str, List[dict]] = defaultdict(list)
    for payment in data["payments"]:
        ben_id = payment.get("beneficiary_id")
        if ben_id is not None:
            payments_by_ben[ben_id].append(payment)

    for ben_id, payments in payments_by_ben.items():
        schemes_drawn = {p.get("scheme") for p in payments if p.get("scheme")}

        for scheme_a, scheme_b in CROSS_SCHEME_FORBIDDEN_PAIRS:
            if scheme_a in schemes_drawn and scheme_b in schemes_drawn:
                ben = data["beneficiary_by_id"].get(ben_id)
                if not ben:
                    continue

                payment_a = next((p for p in payments if p.get("scheme") == scheme_a), None)
                payment_b = next((p for p in payments if p.get("scheme") == scheme_b), None)
                if not payment_a or not payment_b:
                    continue

                amount_a = payment_a.get("amount", 0) or 0
                amount_b = payment_b.get("amount", 0) or 0
                total = amount_a + amount_b

                flags.append(
                    {
                        "beneficiary_id": ben_id,
                        "beneficiary_name": ben.get("name", "Unknown"),
                        "district": ben.get("district", "Unknown"),
                        "taluka": ben.get("taluka", "Unknown"),
                        "scheme": f"{scheme_a}+{scheme_b}",
                        "payment_id": payment_a.get("payment_id"),
                        "payment_amount": total,
                        "payment_date": payment_a.get("payment_date"),
                        "leakage_type": "CROSS_SCHEME",
                        "evidence_data": {
                            "scheme_a": scheme_a,
                            "scheme_b": scheme_b,
                            "amount_a": amount_a,
                            "amount_b": amount_b,
                            "total_amount": total,
                            "payment_date_a": payment_a.get("payment_date"),
                            "payment_date_b": payment_b.get("payment_date"),
                            "rule_violated": (
                                f"Simultaneous drawing of {scheme_a} and {scheme_b} is prohibited"
                            ),
                        },
                    }
                )

    return flags
