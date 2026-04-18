import os
from dotenv import load_dotenv

load_dotenv()

GROQ_MODEL = "llama-3.3-70b-versatile"

_client = None

def _get_client():
    """Lazy initialization of Groq client — only created when first needed."""
    global _client
    if _client is None:
        from groq import Groq
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client

SCHEME_NAMES = {
    "NLY": "Namo Lakshmi Yojana",
    "NSVSY": "Namo Saraswati Vigyan Sadhana Yojana",
    "MGMS": "Mukhyamantri Gyan Sadhana Merit Scholarship"
}

EVIDENCE_SYSTEM_PROMPT = """You are an audit evidence writer for Gujarat's Direct Benefit Transfer 
monitoring system (EduGuard DBT). Your job is to write concise, factual evidence citations for 
flagged transactions that District Finance Officers will use to initiate investigations.

Rules:
- Write exactly 2–3 sentences. No more.
- Be specific: include names, amounts (with ₹ symbol and Indian number formatting), dates, and source databases.
- Reference data sources: U-DISE, Death Registry, Aadhaar records, payment ledger.
- Use formal but clear language a government officer would use.
- Do NOT use bullet points. Write as connected sentences.
- End with the single most important implication (e.g., "Payment must be recovered", "Identity verification required").
"""

def generate_evidence(flag: dict, label: str = None) -> str:
    """
    Generate AI evidence string for a single flag.
    Only uses Groq for CRITICAL flags to prevent rate limiting and timeouts.
    Falls back to template if API fails or for non-critical flags.
    """
    if label != "CRITICAL":
        return _template_evidence(flag)

    lt = flag["leakage_type"]
    ed = flag["evidence_data"]
    name = flag["beneficiary_name"]
    district = flag["district"]
    scheme = SCHEME_NAMES.get(flag["scheme"], flag["scheme"])
    amount = flag.get("payment_amount", 0)
    payment_date = flag.get("payment_date", "unknown date")
    
    # Build a structured prompt with all relevant facts
    facts = _build_facts_string(flag)
    
    prompt = f"""Write an evidence citation for this flagged DBT transaction:

LEAKAGE TYPE: {lt}
{facts}

Write the evidence in 2–3 sentences as described."""
    
    try:
        response = _get_client().chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=200,
            messages=[
                {"role": "system", "content": EVIDENCE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return _template_evidence(flag)

def _build_facts_string(flag: dict) -> str:
    lt = flag["leakage_type"]
    ed = flag["evidence_data"]
    scheme = SCHEME_NAMES.get(flag["scheme"], flag["scheme"])
    amount = f"₹{flag.get('payment_amount', 0):,}"
    
    if lt == "DECEASED":
        return f"""BENEFICIARY: {flag['beneficiary_name']} (ID: {flag['beneficiary_id']}, District: {flag['district']})
SCHEME: {scheme}
PAYMENT: {amount} credited on {flag['payment_date']}
DEATH REGISTRY: Date of death confirmed as {ed['death_date']}
DAYS POST-MORTEM: {ed['days_post_mortem']} days elapsed between death and payment
DATA SOURCES: Payment Ledger, Gujarat Civil Death Registry, U-DISE Enrollment Record"""
    
    elif lt == "DUPLICATE":
        return f"""DUPLICATE BENEFICIARY: {flag['beneficiary_name']} (ID: {flag['beneficiary_id']}, District: {flag['district']})
MATCHES WITH: {ed.get('primary_name', 'Unknown')} (ID: {ed.get('primary_id', 'Unknown')}, District: {ed.get('primary_district', 'Unknown')})
MATCH METHOD: {ed.get('match_method', 'Unknown')}
TOTAL AMOUNT AT RISK: ₹{ed.get('total_at_risk', 0):,}
DATA SOURCES: Aadhaar Registry, U-DISE Enrollment Records, Payment Ledger"""
    
    elif lt == "UNDRAWN":
        return f"""BENEFICIARY: {flag['beneficiary_name']} (ID: {flag['beneficiary_id']}, District: {flag['district']})
SCHEME: {scheme}
PAYMENT: {amount} credited on {flag['payment_date']}
WITHDRAWAL STATUS: Not withdrawn as of today ({ed['days_pending']} days pending; threshold: {ed['threshold_days']} days)
SCHOOL: {ed.get('school', 'Unknown')} | ATTENDANCE: {ed.get('attendance_pct', 'Unknown')}% | ENROLLMENT: {ed.get('enrollment_status', 'Unknown')}
DATA SOURCES: Payment Ledger, Bank Records, U-DISE Attendance Data"""
    
    elif lt == "CROSS_SCHEME":
        return f"""BENEFICIARY: {flag['beneficiary_name']} (ID: {flag['beneficiary_id']}, District: {flag['district']})
SCHEME A: {ed['scheme_a']} — ₹{ed['amount_a']:,} on {ed['payment_date_a']}
SCHEME B: {ed['scheme_b']} — ₹{ed['amount_b']:,} on {ed['payment_date_b']}
TOTAL FRAUDULENT AMOUNT: ₹{ed['total_amount']:,}
RULE VIOLATED: {ed['rule_violated']}
DATA SOURCES: Multi-scheme Payment Ledger, Gujarat DBT Policy Circular 2024"""
    
    return f"LEAKAGE TYPE: {lt}\nAMOUNT: ₹{flag.get('payment_amount',0):,}\nDISTRICT: {flag['district']}"

def _template_evidence(flag: dict) -> str:
    """Fallback template if Groq API is unavailable"""
    lt = flag["leakage_type"]
    ed = flag["evidence_data"]
    scheme = SCHEME_NAMES.get(flag["scheme"], flag["scheme"])
    amount = f"₹{flag.get('payment_amount', 0):,}"
    
    if lt == "DECEASED":
        return (
            f"{flag['beneficiary_name']} (ID: {flag['beneficiary_id']}) received {amount} under "
            f"{scheme} on {flag['payment_date']}. Gujarat Civil Death Registry confirms date of death "
            f"as {ed['death_date']}, making this payment {ed['days_post_mortem']} days post-mortem. "
            f"Payment must be recovered and case referred to District Collector."
        )
    elif lt == "DUPLICATE":
        return (
            f"Beneficiary {flag['beneficiary_name']} (ID: {flag['beneficiary_id']}, {flag['district']}) "
            f"shares Aadhaar identity with {ed.get('primary_name')} ({ed.get('primary_district')}), "
            f"detected via {ed.get('match_method', 'automated matching')}. "
            f"Total amount at risk: ₹{ed.get('total_at_risk', 0):,}. Field verification required."
        )
    elif lt == "UNDRAWN":
        return (
            f"{amount} was credited to {flag['beneficiary_name']} (ID: {flag['beneficiary_id']}) "
            f"under {scheme} on {flag['payment_date']} and remains undrawn after {ed['days_pending']} days. "
            f"U-DISE shows enrollment status as {ed.get('enrollment_status', 'Unknown')} with "
            f"{ed.get('attendance_pct', 'Unknown')}% attendance. Beneficiary contact and field visit required."
        )
    elif lt == "CROSS_SCHEME":
        return (
            f"{flag['beneficiary_name']} (ID: {flag['beneficiary_id']}) has drawn ₹{ed['amount_a']:,} "
            f"under {ed['scheme_a']} and ₹{ed['amount_b']:,} under {ed['scheme_b']} simultaneously, "
            f"totalling ₹{ed['total_amount']:,}. {ed['rule_violated']}. Lower-priority scheme payment must be suspended."
        )
    else:
        return "Anomaly detected. Manual review required."


def generate_batch_evidence(flags: list[dict]) -> list[dict]:
    """
    Process evidence for all flags.
    Uses individual calls (not batch) for simplicity in hackathon.
    """
    for flag in flags:
        flag["evidence"] = generate_evidence(flag)
    return flags
