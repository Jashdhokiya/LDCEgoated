"""Pydantic models and shared enums for EduGuard DBT."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class CaseStatus(str, Enum):
    """Canonical lifecycle states for cases promoted from flags."""

    OPEN = "OPEN"
    ASSIGNED_TO_VERIFIER = "ASSIGNED_TO_VERIFIER"
    VERIFICATION_SUBMITTED = "VERIFICATION_SUBMITTED"
    AUDIT_REVIEW = "AUDIT_REVIEW"
    RESOLVED = "RESOLVED"
    FRAUD_CONFIRMED = "FRAUD_CONFIRMED"


# Backward-compatible alias for older route code that may still refer to StatusEnum.
StatusEnum = CaseStatus


class UDISERecord(BaseModel):
    """School enrollment record embedded inside a Student document."""

    udise_code: str
    school_name: str
    standard: int
    stream: str
    attendance_pct: Optional[float] = None
    marks_pct: float = 0.0
    enrollment_status: str = "ACTIVE"
    academic_year: str = "2024-25"


class InstitutionModel(BaseModel):
    """Institution master record stored in MongoDB."""

    institution_id: str
    name: str
    district: str
    taluka: Optional[str] = None
    udise_code: Optional[str] = None
    institution_type: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class OfficerModel(BaseModel):
    """Officer master record used for auth and assignments."""

    officer_id: str
    name: str
    role: str
    email: str
    district: Optional[str] = None
    jurisdiction: Optional[dict[str, Any]] = None
    contact: Optional[dict[str, Any]] = None
    is_active: bool = True
    active_cases: int = 0
    password_hash: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SchemeModel(BaseModel):
    """Scheme rule document mirrored from MongoDB."""

    scheme_code: str
    name: str
    eligible_gender: Optional[List[str]] = None
    eligible_standards: List[int] = Field(default_factory=list)
    eligible_streams: Optional[List[str]] = None
    min_marks_pct: Optional[float] = None
    amount_fixed: Optional[int] = None
    amount_variable: bool = False
    amount_tiers: List[dict[str, Any]] = Field(default_factory=list)
    incompatible_with: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


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
    udise: Optional[UDISERecord] = None
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
    """Raw anomaly flag raised by a detector."""

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
    evidence_data: Optional[dict[str, Any]] = None
    recommended_action: Optional[str] = None
    status: CaseStatus = CaseStatus.OPEN
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class InvestigationModel(BaseModel):
    """Promoted case created from a flag and tracked through review."""

    investigation_id: Optional[str] = None
    flag_id: str
    beneficiary_id: Optional[str] = None
    status: CaseStatus = CaseStatus.OPEN
    assigned_verifier_id: Optional[str] = None
    field_report: Optional[str] = None
    audit_report: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


def compute_scheme_eligibility(student: dict, udise: Optional[dict]) -> List[str]:
    """
    Given a student dict and their UDISE record, return the list of scheme
    codes they are eligible for. Uses the same rules as scheme_rules.py.
    """
    from detectors.scheme_rules import SCHEMES

    eligible: List[str] = []
    if udise is None:
        return eligible

    for code, scheme in SCHEMES.items():
        if scheme["eligible_gender"] and student.get("gender") not in scheme["eligible_gender"]:
            continue
        if udise.get("standard") not in scheme["eligible_standards"]:
            continue
        if scheme["eligible_streams"] and udise.get("stream") not in scheme["eligible_streams"]:
            continue
        if scheme["min_marks_pct"] and (udise.get("marks_pct", 0) < scheme["min_marks_pct"]):
            continue
        eligible.append(code)

    return eligible
