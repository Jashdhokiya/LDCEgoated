#!/usr/bin/env python3
"""
seed_db.py — Load JSON data files into MongoDB Atlas and compute scheme fields.

Usage:
    python seed_db.py

Reads data/*.json, builds unified Student documents with schemes_taken /
schemes_eligible / eligible_but_not_taken, and inserts into MongoDB.
"""

import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# Ensure project root is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.database import (
    get_db,
    get_deaths_collection,
    get_flags_collection,
    get_payments_collection,
    get_students_collection,
    close_connection,
)
from models import compute_scheme_eligibility

DATA_DIR = Path(os.path.dirname(os.path.abspath(__file__))) / "data"


def _read_json(filename: str) -> list:
    path = DATA_DIR / filename
    if not path.exists():
        print(f"  ⚠  {filename} not found — skipping")
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def seed():
    print("=" * 60)
    print("EduGuard DBT — MongoDB Seeder")
    print("=" * 60)

    # ------------------------------------------------------------------
    # 1. Load JSON files
    # ------------------------------------------------------------------
    print("\n[1/6] Loading JSON data …")
    beneficiaries = _read_json("beneficiaries.json")
    udise_records = _read_json("udise_records.json")
    payments = _read_json("payment_ledger.json")
    death_registry = _read_json("death_registry.json")

    print(f"      Beneficiaries : {len(beneficiaries)}")
    print(f"      UDISE records : {len(udise_records)}")
    print(f"      Payments      : {len(payments)}")
    print(f"      Death registry: {len(death_registry)}")

    # ------------------------------------------------------------------
    # 2. Build lookup maps
    # ------------------------------------------------------------------
    print("[2/6] Building lookup indexes …")
    udise_by_id = {u["beneficiary_id"]: u for u in udise_records}

    # schemes_taken: which schemes does each beneficiary have payments for?
    schemes_taken_map: dict[str, set[str]] = defaultdict(set)
    for p in payments:
        bid = p.get("beneficiary_id")
        scheme = p.get("scheme")
        if bid and scheme:
            schemes_taken_map[bid].add(scheme)

    # ------------------------------------------------------------------
    # 3. Build Student documents
    # ------------------------------------------------------------------
    print("[3/6] Building unified Student documents …")
    now = datetime.utcnow()
    student_docs = []

    for ben in beneficiaries:
        bid = ben["beneficiary_id"]
        udise = udise_by_id.get(bid)

        # Compute scheme eligibility
        schemes_eligible = compute_scheme_eligibility(ben, udise)
        taken = sorted(schemes_taken_map.get(bid, set()))
        eligible_not_taken = sorted(set(schemes_eligible) - set(taken))

        doc = {
            "beneficiary_id": bid,
            "aadhaar_hash": ben.get("aadhaar_hash", ""),
            "name": ben.get("name", ""),
            "dob": ben.get("dob"),
            "gender": ben.get("gender", ""),
            "caste_category": ben.get("caste_category"),
            "district": ben.get("district", ""),
            "taluka": ben.get("taluka"),
            "bank_account_hash": ben.get("bank_account_hash"),
            "is_deceased": ben.get("is_deceased", False),
            "death_date": ben.get("death_date"),
            # Embedded UDISE (without attendance)
            "udise": {
                "udise_code": udise.get("udise_code", ""),
                "school_name": udise.get("school_name", ""),
                "standard": udise.get("standard", 0),
                "stream": udise.get("stream", ""),
                "marks_pct": udise.get("marks_pct", 0),
                "enrollment_status": udise.get("enrollment_status", "ACTIVE"),
                "academic_year": udise.get("academic_year", "2024-25"),
            }
            if udise
            else None,
            # Scheme tracking
            "schemes_taken": taken,
            "schemes_eligible": sorted(schemes_eligible),
            "eligible_but_not_taken": eligible_not_taken,
            "created_at": now,
            "updated_at": now,
        }
        student_docs.append(doc)

    print(f"      Built {len(student_docs)} student documents")

    # ------------------------------------------------------------------
    # 4. Prepare Payment documents
    # ------------------------------------------------------------------
    print("[4/6] Preparing payment documents …")
    payment_docs = []
    for p in payments:
        payment_docs.append(
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

    # ------------------------------------------------------------------
    # 5. Drop existing collections and insert
    # ------------------------------------------------------------------
    print("[5/6] Inserting into MongoDB Atlas …")

    db = get_db()
    print(f"      Database: {db.name}")

    # Drop old data
    for coll_name in ["students", "payments", "death_registry", "flags"]:
        db.drop_collection(coll_name)
        print(f"      Dropped collection: {coll_name}")

    # Insert students
    if student_docs:
        get_students_collection().insert_many(student_docs)
        print(f"      ✓ students: {len(student_docs)} inserted")

    # Insert payments
    if payment_docs:
        get_payments_collection().insert_many(payment_docs)
        print(f"      ✓ payments: {len(payment_docs)} inserted")

    # Insert death registry
    if death_registry:
        get_deaths_collection().insert_many(death_registry)
        print(f"      ✓ death_registry: {len(death_registry)} inserted")

    # ------------------------------------------------------------------
    # 6. Create indexes
    # ------------------------------------------------------------------
    print("[6/6] Creating indexes …")

    students = get_students_collection()
    students.create_index("beneficiary_id", unique=True)
    students.create_index("aadhaar_hash")
    students.create_index("district")
    students.create_index("schemes_taken")
    students.create_index("schemes_eligible")
    print("      ✓ students indexes created")

    pay_coll = get_payments_collection()
    pay_coll.create_index("payment_id", unique=True)
    pay_coll.create_index("beneficiary_id")
    pay_coll.create_index("scheme")
    print("      ✓ payments indexes created")

    deaths = get_deaths_collection()
    deaths.create_index("aadhaar_hash")
    deaths.create_index("beneficiary_id")
    print("      ✓ death_registry indexes created")

    flags = get_flags_collection()
    flags.create_index("flag_id", unique=True, sparse=True)
    flags.create_index("beneficiary_id")
    flags.create_index("risk_score")
    print("      ✓ flags indexes created")

    # ------------------------------------------------------------------
    # Verification
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)
    print(f"Students collection     : {students.count_documents({})}")
    print(f"Payments collection     : {pay_coll.count_documents({})}")
    print(f"Death registry          : {deaths.count_documents({})}")
    print(f"With NLY taken          : {students.count_documents({'schemes_taken': 'NLY'})}")
    print(f"With MGMS taken         : {students.count_documents({'schemes_taken': 'MGMS'})}")
    print(f"Eligible but not taken  : {students.count_documents({'eligible_but_not_taken': {'$ne': []}})}")
    print(f"Deceased students       : {students.count_documents({'is_deceased': True})}")

    print("\n✅ Seeding complete!")
    close_connection()


if __name__ == "__main__":
    seed()
