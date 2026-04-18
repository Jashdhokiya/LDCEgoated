from collections import defaultdict
from typing import Any, Dict, List

from database import get_db, is_mongo_available

from .data_loader import load_all


def _load_cross_scheme_forbidden_pairs() -> List[tuple[str, str]]:
    """Load forbidden scheme pairs from MongoDB, falling back to local rules."""
    pairs: List[tuple[str, str]] = []
    seen_pairs = set()

    def _add_pair(left: str, right: str) -> None:
        pair = (str(left), str(right))
        reverse_pair = (pair[1], pair[0])
        if pair in seen_pairs or reverse_pair in seen_pairs:
            return
        seen_pairs.add(pair)
        pairs.append(pair)

    if is_mongo_available():
        try:
            db = get_db()
            for collection_name in ("scheme_rules", "schemes"):
                collection = db[collection_name]
                docs = list(collection.find({}, {"_id": 0}))
                if not docs:
                    continue

                for doc in docs:
                    if doc.get("scheme_code") == "_config":
                        for pair in doc.get("cross_scheme_forbidden_pairs", []):
                            if isinstance(pair, (list, tuple)) and len(pair) == 2:
                                _add_pair(pair[0], pair[1])

                    scheme_code = doc.get("scheme_code")
                    incompatible_with = doc.get("incompatible_with", [])
                    if scheme_code and incompatible_with:
                        for incompatible in incompatible_with:
                            _add_pair(scheme_code, incompatible)

                if pairs:
                    return pairs
        except Exception:
            pass

    from .scheme_rules import CROSS_SCHEME_FORBIDDEN_PAIRS

    return [(str(a), str(b)) for a, b in CROSS_SCHEME_FORBIDDEN_PAIRS]


def detect_cross_scheme() -> List[Dict[str, Any]]:
    data = load_all()
    flags: List[Dict[str, Any]] = []
    forbidden_pairs = _load_cross_scheme_forbidden_pairs()

    payments_by_ben: Dict[str, List[dict]] = defaultdict(list)
    for payment in data["payments"]:
        ben_id = payment.get("beneficiary_id")
        if ben_id is not None:
            payments_by_ben[ben_id].append(payment)

    for ben_id, payments in payments_by_ben.items():
        schemes_drawn = {p.get("scheme") for p in payments if p.get("scheme")}

        for scheme_a, scheme_b in forbidden_pairs:
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
