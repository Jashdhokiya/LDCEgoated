"""
Full integration test — loads real data, simulates detectors, tests AI layer on real flags.
Tests:
  1. Name normalizer against real beneficiary name variants
  2. Evidence generator (live Groq API) for real flagged transactions
  3. Report generator with real flag data
"""
import json
import sys
import os
from datetime import datetime, date
from collections import defaultdict

sys.path.insert(0, '.')

# Load real data
print("=" * 70)
print("LOADING REAL DATA...")
print("=" * 70)

beneficiaries = json.load(open("data/beneficiaries.json"))
payments = json.load(open("data/payment_ledger.json"))
death_registry = json.load(open("data/death_registry.json"))
udise_records = json.load(open("data/udise_records.json"))

print(f"  Beneficiaries: {len(beneficiaries)}")
print(f"  Payments: {len(payments)}")
print(f"  Death records: {len(death_registry)}")
print(f"  UDISE records: {len(udise_records)}")

# Build indexes
ben_by_id = {b["beneficiary_id"]: b for b in beneficiaries}
udise_by_id = {u["beneficiary_id"]: u for u in udise_records}
payments_by_id = defaultdict(list)
for p in payments:
    payments_by_id[p["beneficiary_id"]].append(p)
death_by_aadhaar = {d["aadhaar_hash"]: d for d in death_registry}

# ====================================================================
# TEST 1: Name Normalizer on real name variants
# ====================================================================
print("\n" + "=" * 70)
print("TEST 1: NAME NORMALIZER — Real Name Variants")
print("=" * 70)

from ai_layer.name_normalizer import is_likely_same_person

# Find beneficiaries with name_variants and test matching
tested = 0
passed = 0
for ben in beneficiaries[:200]:  # Test first 200
    if ben.get("name_variants") and len(ben["name_variants"]) > 0:
        for variant in ben["name_variants"]:
            result = is_likely_same_person(ben["name"], variant)
            tested += 1
            if result["is_match"]:
                passed += 1
            else:
                print(f"  MISS: {ben['name']} vs {variant} -> {result['similarity_score']:.3f}")

print(f"  Tested {tested} name-variant pairs, {passed}/{tested} matched ({passed/tested*100:.1f}%)")

# ====================================================================
# TEST 2: Simulate deceased detection & generate evidence
# ====================================================================
print("\n" + "=" * 70)
print("TEST 2: DECEASED DETECTION + AI EVIDENCE")
print("=" * 70)

from ai_layer.evidence_generator import generate_evidence

deceased_flags = []
for payment in payments:
    ben = ben_by_id.get(payment["beneficiary_id"])
    if not ben:
        continue
    death_record = death_by_aadhaar.get(ben["aadhaar_hash"])
    if not death_record:
        continue
    payment_date = datetime.fromisoformat(payment["payment_date"]).date()
    death_date = datetime.fromisoformat(death_record["death_date"]).date()
    if payment_date > death_date:
        days_post_mortem = (payment_date - death_date).days
        deceased_flags.append({
            "beneficiary_id": ben["beneficiary_id"],
            "beneficiary_name": ben["name"],
            "district": ben["district"],
            "scheme": payment["scheme"],
            "payment_id": payment["payment_id"],
            "payment_amount": payment["amount"],
            "payment_date": payment["payment_date"],
            "leakage_type": "DECEASED",
            "risk_score": min(100, 85 + int(days_post_mortem * 0.1)),
            "evidence_data": {
                "death_date": death_record["death_date"],
                "days_post_mortem": days_post_mortem,
                "payment_date": payment["payment_date"],
                "amount": payment["amount"],
                "scheme": payment["scheme"]
            }
        })

print(f"  Deceased flags found: {len(deceased_flags)} (expected ~45)")

# Generate AI evidence for first 3 deceased flags
if deceased_flags:
    print("\n  Generating AI evidence for first 3 DECEASED flags...")
    for flag in deceased_flags[:3]:
        evidence = generate_evidence(flag)
        print(f"\n  [{flag['beneficiary_name']} | {flag['district']} | {flag['scheme']}]")
        print(f"  {evidence}")

# ====================================================================
# TEST 3: Simulate undrawn detection & generate evidence
# ====================================================================
print("\n" + "=" * 70)
print("TEST 3: UNDRAWN DETECTION + AI EVIDENCE")
print("=" * 70)

TODAY = date(2025, 4, 18)
THRESHOLD = 60
undrawn_flags = []

for payment in payments:
    if payment["withdrawal_date"] is not None:
        continue
    if payment["payment_status"] == "RETURNED":
        continue
    payment_date = datetime.fromisoformat(payment["payment_date"]).date()
    days_pending = (TODAY - payment_date).days
    if days_pending < THRESHOLD:
        continue
    ben = ben_by_id.get(payment["beneficiary_id"])
    if not ben:
        continue
    udise = udise_by_id.get(payment["beneficiary_id"], {})
    undrawn_flags.append({
        "beneficiary_id": ben["beneficiary_id"],
        "beneficiary_name": ben["name"],
        "district": ben["district"],
        "scheme": payment["scheme"],
        "payment_id": payment["payment_id"],
        "payment_amount": payment["amount"],
        "payment_date": payment["payment_date"],
        "leakage_type": "UNDRAWN",
        "risk_score": min(100, 40 + int((days_pending - 60) * 0.3)),
        "evidence_data": {
            "days_pending": days_pending,
            "threshold_days": THRESHOLD,
            "payment_status": payment["payment_status"],
            "school": udise.get("school_name", "Unknown"),
            "enrollment_status": udise.get("enrollment_status", "Unknown"),
            "attendance_pct": udise.get("attendance_pct", None)
        }
    })

print(f"  Undrawn flags found: {len(undrawn_flags)} (expected ~93)")

if undrawn_flags:
    print("\n  Generating AI evidence for first 2 UNDRAWN flags...")
    for flag in undrawn_flags[:2]:
        evidence = generate_evidence(flag)
        print(f"\n  [{flag['beneficiary_name']} | {flag['district']} | {flag['scheme']}]")
        print(f"  {evidence}")

# ====================================================================
# TEST 4: Cross-scheme detection + evidence
# ====================================================================
print("\n" + "=" * 70)
print("TEST 4: CROSS-SCHEME DETECTION + AI EVIDENCE")
print("=" * 70)

cross_flags = []
for ben_id, plist in payments_by_id.items():
    schemes = set(p["scheme"] for p in plist)
    if "NLY" in schemes and "NSVSY" in schemes:
        ben = ben_by_id.get(ben_id)
        if not ben:
            continue
        pay_a = next(p for p in plist if p["scheme"] == "NLY")
        pay_b = next(p for p in plist if p["scheme"] == "NSVSY")
        total = pay_a["amount"] + pay_b["amount"]
        cross_flags.append({
            "beneficiary_id": ben_id,
            "beneficiary_name": ben["name"],
            "district": ben["district"],
            "scheme": "NLY+NSVSY",
            "payment_id": pay_a["payment_id"],
            "payment_amount": total,
            "payment_date": pay_a["payment_date"],
            "leakage_type": "CROSS_SCHEME",
            "risk_score": 65,
            "evidence_data": {
                "scheme_a": "NLY",
                "scheme_b": "NSVSY",
                "amount_a": pay_a["amount"],
                "amount_b": pay_b["amount"],
                "total_amount": total,
                "payment_date_a": pay_a["payment_date"],
                "payment_date_b": pay_b["payment_date"],
                "rule_violated": "Simultaneous drawing of NLY and NSVSY is prohibited"
            }
        })

print(f"  Cross-scheme flags found: {len(cross_flags)} (expected ~22)")

if cross_flags:
    print("\n  Generating AI evidence for first 2 CROSS_SCHEME flags...")
    for flag in cross_flags[:2]:
        evidence = generate_evidence(flag)
        print(f"\n  [{flag['beneficiary_name']} | {flag['district']}]")
        print(f"  {evidence}")

# ====================================================================
# TEST 5: Report generation with all real flags
# ====================================================================
print("\n" + "=" * 70)
print("TEST 5: AUDIT REPORT GENERATION")
print("=" * 70)

from ai_layer.report_generator import generate_report

all_flags = deceased_flags + undrawn_flags + cross_flags
print(f"  Total flags for report: {len(all_flags)}")
print("  Generating AI audit report (this may take a few seconds)...")

report = generate_report(all_flags)
print("\n" + "-" * 70)
print(report)
print("-" * 70)

# ====================================================================
# SUMMARY
# ====================================================================
print("\n" + "=" * 70)
print("INTEGRATION TEST SUMMARY")
print("=" * 70)
print(f"  Name normalizer:  {passed}/{tested} matches on real variants")
print(f"  Deceased flags:   {len(deceased_flags)} (target: 45)")
print(f"  Undrawn flags:    {len(undrawn_flags)} (target: 93)")
print(f"  Cross-scheme:     {len(cross_flags)} (target: 22)")
print(f"  Total flags:      {len(all_flags)}")
print(f"  AI report:        {'Generated' if len(report) > 100 else 'FAILED'}")
print("=" * 70)
