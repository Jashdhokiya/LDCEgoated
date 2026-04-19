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
        _client = Groq(
            api_key=os.getenv("GROQ_API_KEY"),
            timeout=45.0,
        )
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
DETAILED_INVESTIGATIVE_PROMPT = """You are a senior forensic investigator for the Gujarat State Audit Department. 
Your task is to generate a high-impact Intelligence Report for a flagged DBT transaction.

Structure your response as exactly 3-4 highly detailed, bulleted investigative findings.
Each finding must start with a bold category (e.g. **Discrepancy Detected**, **Data Correlation**, **Policy Violation**).

Rules:
- Be extremely specific: mention specific dates, ID numbers, and currency amounts.
- Highlight the exact conflict between two or more data sources (e.g., U-DISE vs. Bank Ledger).
- Use professional, punchy investigative language.
- Mention specific departmental circulars or policy thresholds if applicable.
- The tone should be authoritative and ready for legal or administrative action.
"""

def generate_evidence(flag: dict, label: str = None, detailed: bool = False) -> str:
    """
    Generate AI evidence string for a single flag.
    Only uses Groq for CRITICAL flags or if 'detailed' is requested.
    """
    if label != "CRITICAL" and not detailed:
        return _template_evidence(flag)

    lt = flag["leakage_type"]
    system_prompt = DETAILED_INVESTIGATIVE_PROMPT if detailed else EVIDENCE_SYSTEM_PROMPT
    
    # Build a structured prompt with all relevant facts
    facts = _build_facts_string(flag)
    
    prompt = f"""Generate a { 'detailed Intelligence Report' if detailed else 'short evidence citation'} for this flagged transaction:

LEAKAGE TYPE: {lt}
{facts}

Provide the findings as described in your system instructions."""
    
    try:
        response = _get_client().chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=500 if detailed else 200,
            messages=[
                {"role": "system", "content": system_prompt},
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
