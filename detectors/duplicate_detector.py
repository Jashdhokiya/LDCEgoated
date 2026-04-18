from collections import defaultdict
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen
import json
import os
from typing import Any, Dict, List, Optional

from .data_loader import load_all

NORMALIZER_URL = os.getenv("NORMALIZER_URL", "http://localhost:8000/api/normalize-names")
REQUEST_TIMEOUT_SECONDS = 1.5
FUZZY_DISTANCE_THRESHOLD = 1
MAX_FUZZY_FLAGS = 100


def levenshtein(s1: str, s2: str) -> int:
    """Simple edit distance fallback."""
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)

    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (c1 != c2)))
        prev = curr
    return prev[-1]


def normalize_name_local(name: str) -> str:
    """Local fallback normalization."""
    n = (name or "").lower().strip()
    for suffix in ["ben", "bhai", "bhen", "bha"]:
        if n.endswith(suffix):
            n = n[: -len(suffix)]
    n = n.replace("aa", "a").replace("ee", "i").replace("oo", "u")
    n = n.replace("sh", "s").replace("th", "t")
    return "".join(ch for ch in n if ch.isalnum())


def _normalize_names_remote(names: List[str]) -> Optional[Dict[str, str]]:
    """Try Person 3 name normalizer endpoint; return None on any failure."""
    try:
        request = Request(
            NORMALIZER_URL,
            data=json.dumps({"names": names}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if isinstance(payload, dict) and isinstance(payload.get("normalized"), dict):
            return payload["normalized"]
        if isinstance(payload, dict):
            return {k: v for k, v in payload.items() if isinstance(v, str)}
        return None
    except (HTTPError, URLError, TimeoutError, ValueError, OSError):
        return None


def detect_duplicates() -> List[Dict[str, Any]]:
    data = load_all()
    flags: List[Dict[str, Any]] = []
    seen_pairs = set()

    beneficiaries = data["beneficiaries"]

    # Method A: exact Aadhaar collisions
    by_aadhaar: Dict[str, List[dict]] = defaultdict(list)
    for ben in beneficiaries:
        aadhaar_hash = ben.get("aadhaar_hash")
        if aadhaar_hash:
            by_aadhaar[aadhaar_hash].append(ben)

    for _, group in by_aadhaar.items():
        if len(group) <= 1:
            continue

        primary = sorted(group, key=lambda x: x.get("beneficiary_id", ""))[0]
        for dup in sorted(group, key=lambda x: x.get("beneficiary_id", ""))[1:]:
            pair_key = tuple(
                sorted([primary.get("beneficiary_id", ""), dup.get("beneficiary_id", "")])
            )
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            dup_payments = data["payments_by_id"].get(dup.get("beneficiary_id"), [])
            total_at_risk = sum((p.get("amount", 0) or 0) for p in dup_payments)

            flags.append(
                {
                    "beneficiary_id": dup.get("beneficiary_id"),
                    "beneficiary_name": dup.get("name", "Unknown"),
                    "district": dup.get("district", "Unknown"),
                    "taluka": dup.get("taluka", "Unknown"),
                    "scheme": dup_payments[0].get("scheme", "UNKNOWN") if dup_payments else "UNKNOWN",
                    "payment_id": dup_payments[0].get("payment_id") if dup_payments else None,
                    "payment_amount": total_at_risk,
                    "payment_date": dup_payments[0].get("payment_date") if dup_payments else None,
                    "leakage_type": "DUPLICATE",
                    "evidence_data": {
                        "match_method": "AADHAAR_EXACT",
                        "primary_id": primary.get("beneficiary_id"),
                        "primary_name": primary.get("name"),
                        "primary_district": primary.get("district"),
                        "duplicate_id": dup.get("beneficiary_id"),
                        "duplicate_name": dup.get("name"),
                        "duplicate_district": dup.get("district"),
                        "total_at_risk": total_at_risk,
                    },
                }
            )

    # Method B1: exact bank account match across the dataset.
    by_bank: Dict[str, List[dict]] = defaultdict(list)
    for ben in beneficiaries:
        bank_hash = ben.get("bank_account_hash")
        if bank_hash:
            by_bank[bank_hash].append(ben)

    for _, group in by_bank.items():
        if len(group) <= 1:
            continue
        base = sorted(group, key=lambda x: x.get("beneficiary_id", ""))[0]
        for dup in sorted(group, key=lambda x: x.get("beneficiary_id", ""))[1:]:
            pair_key = tuple(
                sorted([base.get("beneficiary_id", ""), dup.get("beneficiary_id", "")])
            )
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            flags.append(
                {
                    "beneficiary_id": dup.get("beneficiary_id"),
                    "beneficiary_name": dup.get("name", "Unknown"),
                    "district": dup.get("district", "Unknown"),
                    "taluka": dup.get("taluka", "Unknown"),
                    "scheme": "MULTI",
                    "payment_id": None,
                    "payment_amount": 0,
                    "payment_date": None,
                    "leakage_type": "DUPLICATE",
                    "evidence_data": {
                        "match_method": "BANK_ACCOUNT_EXACT",
                        "primary_name": base.get("name"),
                        "duplicate_name": dup.get("name"),
                        "shared_bank_account": True,
                    },
                }
            )

    # Method B2: fuzzy name match — cross-district only to catch real fraud
    # Only consider beneficiaries that have payments (reduces noise dramatically)
    bens_with_payments = [
        b for b in beneficiaries if b.get("beneficiary_id") in data["payments_by_id"]
    ]

    all_names = [b.get("name", "") for b in bens_with_payments]
    remote_norm = _normalize_names_remote(all_names) or {}

    normalized_entries = []
    for ben in bens_with_payments:
        original_name = ben.get("name", "")
        normalized_name = remote_norm.get(original_name) or normalize_name_local(original_name)
        normalized_entries.append((ben, normalized_name))

    # Bucket by exact normalized name for O(1) exact-norm matches
    by_norm: Dict[str, List[tuple]] = defaultdict(list)
    for ben, norm in normalized_entries:
        if norm:
            by_norm[norm].append(ben)

    fuzzy_flag_count = 0

    # Exact normalized name match across different districts
    for norm, group in by_norm.items():
        if len(group) <= 1:
            continue
        # Only flag cross-district matches
        primary = group[0]
        for dup in group[1:]:
            if primary.get("district") == dup.get("district"):
                continue
            pair_key = tuple(
                sorted([primary.get("beneficiary_id", ""), dup.get("beneficiary_id", "")])
            )
            if pair_key in seen_pairs:
                continue
            # Skip exact Aadhaar matches (already handled by Method A)
            if primary.get("aadhaar_hash") and primary.get("aadhaar_hash") == dup.get("aadhaar_hash"):
                continue
            seen_pairs.add(pair_key)

            dup_payments = data["payments_by_id"].get(dup.get("beneficiary_id"), [])
            total_at_risk = sum((p.get("amount", 0) or 0) for p in dup_payments)

            flags.append(
                {
                    "beneficiary_id": dup.get("beneficiary_id"),
                    "beneficiary_name": dup.get("name", "Unknown"),
                    "district": dup.get("district", "Unknown"),
                    "taluka": dup.get("taluka", "Unknown"),
                    "scheme": dup_payments[0].get("scheme", "MULTI") if dup_payments else "MULTI",
                    "payment_id": dup_payments[0].get("payment_id") if dup_payments else None,
                    "payment_amount": total_at_risk,
                    "payment_date": dup_payments[0].get("payment_date") if dup_payments else None,
                    "leakage_type": "DUPLICATE",
                    "evidence_data": {
                        "match_method": "FUZZY_NAME",
                        "primary_name": primary.get("name"),
                        "primary_district": primary.get("district"),
                        "duplicate_name": dup.get("name"),
                        "duplicate_district": dup.get("district"),
                        "normalized_primary": norm,
                        "normalized_duplicate": norm,
                        "distance": 0,
                        "total_at_risk": total_at_risk,
                    },
                }
            )
            fuzzy_flag_count += 1
            if fuzzy_flag_count >= MAX_FUZZY_FLAGS:
                break
        if fuzzy_flag_count >= MAX_FUZZY_FLAGS:
            break

    # Near-match (edit distance = 1) across different districts — capped
    if fuzzy_flag_count < MAX_FUZZY_FLAGS:
        norm_keys = list(by_norm.keys())
        # Bucket by (first_char, length) for efficient near-match search
        buckets: Dict[tuple, List[str]] = defaultdict(list)
        for nk in norm_keys:
            if nk:
                buckets[(nk[0], len(nk))].append(nk)

        for (first_char, base_len), norms_in_bucket in buckets.items():
            if fuzzy_flag_count >= MAX_FUZZY_FLAGS:
                break
            candidate_norms = []
            for ckey in [(first_char, base_len - 1), (first_char, base_len), (first_char, base_len + 1)]:
                candidate_norms.extend(buckets.get(ckey, []))

            for i, n1 in enumerate(norms_in_bucket):
                if fuzzy_flag_count >= MAX_FUZZY_FLAGS:
                    break
                for n2 in candidate_norms:
                    if n1 >= n2:  # avoid duplicate comparisons
                        continue
                    if abs(len(n1) - len(n2)) > FUZZY_DISTANCE_THRESHOLD:
                        continue
                    distance = levenshtein(n1, n2)
                    if distance > FUZZY_DISTANCE_THRESHOLD:
                        continue

                    # Get cross-district pairs from these two normalized names
                    for b1 in by_norm[n1]:
                        if fuzzy_flag_count >= MAX_FUZZY_FLAGS:
                            break
                        for b2 in by_norm[n2]:
                            if b1.get("district") == b2.get("district"):
                                continue
                            pair_key = tuple(
                                sorted([b1.get("beneficiary_id", ""), b2.get("beneficiary_id", "")])
                            )
                            if pair_key in seen_pairs:
                                continue
                            if b1.get("aadhaar_hash") and b1.get("aadhaar_hash") == b2.get("aadhaar_hash"):
                                continue
                            seen_pairs.add(pair_key)

                            dup = b2
                            primary = b1
                            dup_payments = data["payments_by_id"].get(dup.get("beneficiary_id"), [])
                            total_at_risk = sum((p.get("amount", 0) or 0) for p in dup_payments)

                            flags.append(
                                {
                                    "beneficiary_id": dup.get("beneficiary_id"),
                                    "beneficiary_name": dup.get("name", "Unknown"),
                                    "district": dup.get("district", "Unknown"),
                                    "taluka": dup.get("taluka", "Unknown"),
                                    "scheme": dup_payments[0].get("scheme", "MULTI") if dup_payments else "MULTI",
                                    "payment_id": dup_payments[0].get("payment_id") if dup_payments else None,
                                    "payment_amount": total_at_risk,
                                    "payment_date": dup_payments[0].get("payment_date") if dup_payments else None,
                                    "leakage_type": "DUPLICATE",
                                    "evidence_data": {
                                        "match_method": "FUZZY_NAME",
                                        "primary_name": primary.get("name"),
                                        "primary_district": primary.get("district"),
                                        "duplicate_name": dup.get("name"),
                                        "duplicate_district": dup.get("district"),
                                        "normalized_primary": n1,
                                        "normalized_duplicate": n2,
                                        "distance": distance,
                                        "total_at_risk": total_at_risk,
                                    },
                                }
                            )
                            fuzzy_flag_count += 1
                            if fuzzy_flag_count >= MAX_FUZZY_FLAGS:
                                break

    return flags
