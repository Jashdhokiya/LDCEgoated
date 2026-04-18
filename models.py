"""
models.py — Pydantic data models for EduGuard DBT
Single common ID: beneficiary_id is the universal identifier per student.
"""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Embedded sub-model
# ---------------------------------------------------------------------------

class UDISERecord(BaseModel):
    """School enrollment record embedded inside a Student document."""
    udise_code: str
    school_name: str
    standard: int
    stream: str
    marks_pct: float
    enrollment_status: str = "ACTIVE"
    academic_year: str = "2024-25"


# ---------------------------------------------------------------------------
# Core collections
# ---------------------------------------------------------------------------

class StudentModel(BaseModel):
    """
    Unified student document.
    `beneficiary_id` is the single common ID used across all collections.
    """
    beneficiary_id: str = Field(..., description="Universal unique ID for the student")
    aadhaar_hash: str
    name: str
    dob: Optional[str] = None
    gender: str
    caste_category: Optional[str] = None
    district: str
    taluka: Optional[str] = None
    bank_account_hash: Optional[str] = None
    is_deceased: bool = False
    death_date: Optional[str] = None

    # Embedded UDISE data
    udise: Optional[UDISERecord] = None

    # Scheme tracking
    schemes_taken: List[str] = Field(
        default_factory=list,
        description="Scheme codes the student has received payments under",
    )
    schemes_eligible: List[str] = Field(
        default_factory=list,
        description="Scheme codes the student qualifies for based on eligibility rules",
    )
    eligible_but_not_taken: List[str] = Field(
        default_factory=list,
        description="Schemes the student is eligible for but has NOT yet received",
    )

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class PaymentModel(BaseModel):
    """Individual payment / disbursement record."""
    payment_id: str
    beneficiary_id: str = Field(..., description="FK → StudentModel.beneficiary_id")
    scheme: str
    amount: int
    payment_date: Optional[str] = None
    credit_date: Optional[str] = None
    withdrawal_date: Optional[str] = None
    bank_account_hash: Optional[str] = None
    payment_status: str = "CREDITED"


class DeathRecordModel(BaseModel):
    """Death registry entry linked to a student."""
    beneficiary_id: str
    aadhaar_hash: str
    name: str
    death_date: str
    district: str
    registration_source: str = "Municipal Corporation"


class FlagModel(BaseModel):
    """Investigation flag raised by a detector."""
    flag_id: str
    beneficiary_id: str
    beneficiary_name: str
    district: str
    taluka: Optional[str] = None
    scheme: str
    payment_id: Optional[str] = None
    payment_amount: Optional[int] = 0
    payment_date: Optional[str] = None
    leakage_type: str
    risk_score: int = 0
    risk_label: str = "MEDIUM"
    evidence: Optional[str] = None
    evidence_data: Optional[dict] = None
    recommended_action: Optional[str] = None
    status: str = "OPEN"
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Scheme eligibility helper
# ---------------------------------------------------------------------------

def compute_scheme_eligibility(student: dict, udise: Optional[dict]) -> List[str]:
    """
    Given a student dict and their UDISE record, return the list of scheme
    codes they are eligible for.  Uses the same rules as scheme_rules.py.
    """
    from detectors.scheme_rules import SCHEMES

    eligible: List[str] = []
    if udise is None:
        return eligible

    for code, scheme in SCHEMES.items():
        # Gender check
        if scheme["eligible_gender"] and student.get("gender") not in scheme["eligible_gender"]:
            continue
        # Standard check
        if udise.get("standard") not in scheme["eligible_standards"]:
            continue
        # Stream check
        if scheme["eligible_streams"] and udise.get("stream") not in scheme["eligible_streams"]:
            continue
        # Marks check
        if scheme["min_marks_pct"] and (udise.get("marks_pct", 0) < scheme["min_marks_pct"]):
            continue
        eligible.append(code)

    return eligible
