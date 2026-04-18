# scheme_rules.py
# Single source of truth for all scheme eligibility logic

SCHEMES = {
    "NLY": {
        "name": "Namo Lakshmi Yojana",
        "eligible_gender": ["F"],
        "eligible_standards": [9, 10, 11, 12],
        "eligible_streams": None,  # None = any stream
        "min_marks_pct": None,
        "amount_fixed": 25000,
        "amount_variable": False,
        "incompatible_with": ["NSVSY"],  # cannot draw both simultaneously
        "description": "Financial support for girls in secondary education"
    },
    "NSVSY": {
        "name": "Namo Saraswati Vigyan Sadhana Yojana",
        "eligible_gender": ["F"],
        "eligible_standards": [11, 12],
        "eligible_streams": ["Science"],
        "min_marks_pct": None,
        "amount_fixed": 10000,
        "amount_variable": False,
        "incompatible_with": ["NLY"],
        "description": "Support for girls pursuing Science stream"
    },
    "MGMS": {
        "name": "Mukhyamantri Gyan Sadhana Merit Scholarship",
        "eligible_gender": None,  # None = any gender
        "eligible_standards": [9, 10, 11, 12],
        "eligible_streams": None,
        "min_marks_pct": 75.0,
        "amount_variable": True,
        "amount_tiers": [
            {"min_marks": 90, "amount": 20000},
            {"min_marks": 80, "amount": 10000},
            {"min_marks": 75, "amount": 5000},
        ],
        "incompatible_with": [],
        "description": "Merit-based scholarship for high-scoring students"
    }
}

UNDRAWN_THRESHOLD_DAYS = 60  # flag if not withdrawn within this many days
CROSS_SCHEME_FORBIDDEN_PAIRS = [("NLY", "NSVSY")]

def is_eligible(beneficiary, udise_record, scheme_code):
    """Returns (bool, reason_string)"""
    scheme = SCHEMES[scheme_code]
    
    if scheme["eligible_gender"] and beneficiary["gender"] not in scheme["eligible_gender"]:
        return False, f"Gender {beneficiary['gender']} not eligible for {scheme_code}"
    
    if udise_record["standard"] not in scheme["eligible_standards"]:
        return False, f"Standard {udise_record['standard']} not eligible for {scheme_code}"
    
    if scheme["eligible_streams"] and udise_record["stream"] not in scheme["eligible_streams"]:
        return False, f"Stream {udise_record['stream']} not eligible for {scheme_code}"
    
    if scheme["min_marks_pct"] and udise_record["marks_pct"] < scheme["min_marks_pct"]:
        return False, f"Marks {udise_record['marks_pct']}% below minimum {scheme['min_marks_pct']}%"
    
    return True, "Eligible"

def get_amount(udise_record, scheme_code):
    scheme = SCHEMES[scheme_code]
    if not scheme["amount_variable"]:
        return scheme["amount_fixed"]
    for tier in scheme["amount_tiers"]:
        if udise_record["marks_pct"] >= tier["min_marks"]:
            return tier["amount"]
    return 0
