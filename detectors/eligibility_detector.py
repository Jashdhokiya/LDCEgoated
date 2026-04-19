from typing import Any, Dict, List
from .data_loader import load_all
from .scheme_rules import is_eligible

def detect_ineligibility() -> List[Dict[str, Any]]:
    """
    Detect beneficiaries who received payments but no longer meet the
    eligibility criteria defined in the dynamic Rules Engine.
    """
    data = load_all()
    flags: List[Dict[str, Any]] = []

    schemes = data.get("scheme_by_id", {})
    beneficiaries = data.get("beneficiary_by_id", {})
    udise_records = data.get("udise_by_id", {})
    
    for payment in data.get("payments", []):
        ben_id = payment.get("beneficiary_id")
        scheme_id = payment.get("scheme")
        
        # We need a beneficiary and a scheme definition to check eligibility
        if not ben_id or not scheme_id:
            continue
            
        scheme_config = schemes.get(scheme_id)
        if not scheme_config:
            # If the scheme doesn't exist in our config, we can't check it
            continue
            
        # Get beneficiary and UDISE data
        ben = beneficiaries.get(ben_id)
        if not ben:
            continue
            
        udise = udise_records.get(ben_id, {})
        
        # Check eligibility dynamically against the database rules
        eligible, reason = is_eligible(ben, udise, scheme_config)
        
        if not eligible:
            flags.append(
                {
                    "beneficiary_id": ben_id,
                    "beneficiary_name": ben.get("name", "Unknown"),
                    "district": ben.get("district", "Unknown"),
                    "taluka": ben.get("taluka", "Unknown"),
                    "scheme": scheme_id,
                    "payment_id": payment.get("payment_id"),
                    "payment_amount": payment.get("amount", 0) or 0,
                    "payment_date": payment.get("payment_date"),
                    "leakage_type": "INELIGIBLE",
                    "evidence_data": {
                        "reason": reason,
                        "scheme_name": scheme_config.get("name"),
                        "gender": ben.get("gender"),
                        "standard": udise.get("standard"),
                        "stream": udise.get("stream"),
                        "attendance_pct": udise.get("attendance_pct"),
                        "marks_pct": udise.get("marks_pct"),
                    },
                }
            )

    return flags
