"""
scripts/seed_mongo.py
─────────────────────────────────────────────────────
Seeds MongoDB with:
  - beneficiaries, payment_ledger, death_registry, udise (from JSON files)
  - schemes (3 core + scheme_rules.json)
  - officers: 1 DFO/district, 1 verifier/taluka, 1-3 audit/district, 1 state admin
  - institutions (demo data)
  - geography (districts + talukas reference)

Officer passwords:
  DFO:             <district_lowercase>@123     e.g. ahmedabad@123
  SCHEME_VERIFIER: <taluka_lowercase>@123       e.g. daskroi@123
  AUDIT:           <taluka_lowercase>@123       e.g. sanand@123
  STATE_ADMIN:     admin@123

Usage:  python scripts/seed_mongo.py
"""

import json, os, sys, time, random
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
ROOT_DIR = Path(__file__).parent.parent

# ─── Load .env ────────────────────────────────────────────────────────────────
env_path = ROOT_DIR / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "EduGuard")

if not MONGO_URI:
    print("❌  No MONGO_URI found in .env")
    sys.exit(1)

try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure, BulkWriteError
except ImportError:
    print("❌  pymongo not installed. Run:  pip install 'pymongo[srv]'")
    sys.exit(1)

print(f"📡  Connecting to MongoDB…")
print(f"    URI : {MONGO_URI[:50]}…")
print(f"    DB  : {MONGO_DB_NAME}")

try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10_000, connectTimeoutMS=10_000)
    client.admin.command("ping")
    print("✅  Connected!\n")
except ConnectionFailure as e:
    print(f"❌  Connection failed: {e}")
    sys.exit(1)

db = client[MONGO_DB_NAME]

# ─── Password hashing ────────────────────────────────────────────────────────
# Use bcrypt directly — passlib crashes on newer bcrypt versions
try:
    import bcrypt as _bcrypt
    def hash_pw(pw):
        return _bcrypt.hashpw(pw.encode('utf-8'), _bcrypt.gensalt()).decode('utf-8')
    # Quick test
    hash_pw("test")
    print("   Using bcrypt for password hashing")
except Exception:
    import hashlib
    def hash_pw(pw): return hashlib.sha256(pw.encode()).hexdigest()
    print("   WARNING: bcrypt unavailable, using SHA-256 (login may not work)")

# ─── Gujarat Districts & Talukas ──────────────────────────────────────────────
GUJARAT_GEOGRAPHY = {
    "Ahmedabad":    ["Ahmedabad City", "Daskroi", "Sanand", "Bavla", "Dholka", "Viramgam", "Detroj-Rampura", "Mandal"],
    "Amreli":       ["Amreli", "Lathi", "Liliya", "Savarkundla", "Jafrabad", "Rajula", "Babra", "Khambha", "Bagasara", "Dhari", "Kunkavav"],
    "Anand":        ["Anand", "Petlad", "Borsad", "Khambhat", "Sojitra", "Umreth", "Tarapur", "Anklav"],
    "Aravalli":     ["Modasa", "Dhansura", "Bayad", "Bhiloda", "Meghraj", "Malpur"],
    "Banaskantha":  ["Palanpur", "Deesa", "Danta", "Vadgam", "Kankrej", "Tharad", "Dhanera", "Bhabhar", "Amirgadh", "Deodar", "Vav", "Suigam", "Lakhani"],
    "Bharuch":      ["Bharuch", "Ankleshwar", "Amod", "Hansot", "Jambusar", "Jhagadia", "Netrang", "Vagra", "Valia"],
    "Bhavnagar":    ["Bhavnagar", "Botad", "Gadhada", "Ghogha", "Mahuva", "Palitana", "Sihor", "Talaja", "Umrala", "Vallabhipur"],
    "Botad":        ["Botad", "Gadhada", "Barvala", "Ranpur"],
    "Chhota Udaipur": ["Chhota Udaipur", "Bodeli", "Sankheda", "Jetpur Pavi", "Kavant", "Nasvadi"],
    "Dahod":        ["Dahod", "Devgadh Baria", "Dhanpur", "Fatehpura", "Garbada", "Jhalod", "Limkheda", "Sanjeli", "Singvad"],
    "Dang":         ["Ahwa", "Subir", "Waghai"],
    "Devbhoomi Dwarka": ["Khambhalia", "Dwarka", "Bhanvad", "Kalyanpur", "Okhamandal"],
    "Gandhinagar":  ["Gandhinagar", "Dehgam", "Kalol", "Mansa"],
    "Gir Somnath":  ["Veraval", "Una", "Kodinar", "Sutrapada", "Talala", "Gir Gadhada"],
    "Jamnagar":     ["Jamnagar", "Dhrol", "Jodiya", "Kalavad", "Lalpur", "Jamjodhpur"],
    "Junagadh":     ["Junagadh", "Bhesan", "Keshod", "Malia-Hatina", "Manavadar", "Mangrol", "Mendarda", "Vanthali", "Visavadar"],
    "Kutch":        ["Bhuj", "Anjar", "Bhachau", "Gandhidham", "Lakhpat", "Mandvi", "Mundra", "Nakhatrana", "Rapar", "Abdasa"],
    "Kheda":        ["Nadiad", "Kapadvanj", "Kathlal", "Kheda", "Mahudha", "Matar", "Mehmedabad", "Thasra", "Vaso", "Galteshwar"],
    "Mahisagar":    ["Lunawada", "Kadana", "Khanpur", "Santrampur", "Virpur", "Balasinor"],
    "Mehsana":      ["Mehsana", "Becharaji", "Kadi", "Kheralu", "Satlasana", "Unjha", "Vadnagar", "Vijapur", "Visnagar"],
    "Morbi":        ["Morbi", "Halvad", "Maliya", "Tankara", "Wankaner"],
    "Narmada":      ["Rajpipla", "Dediapada", "Nandod", "Sagbara", "Tilakwada"],
    "Navsari":      ["Navsari", "Chikhli", "Gandevi", "Jalalpore", "Khergam", "Vansda"],
    "Panchmahal":   ["Godhra", "Halol", "Jambughoda", "Kalol", "Lunawada", "Morva Hadaf", "Shehera"],
    "Patan":        ["Patan", "Chanasma", "Harij", "Radhanpur", "Santalpur", "Saraswati", "Shankheshwar", "Sidhpur"],
    "Porbandar":    ["Porbandar", "Kutiyana", "Ranavav"],
    "Rajkot":       ["Rajkot", "Dhoraji", "Gondal", "Jamkandorna", "Jasdan", "Jetpur", "Kotda Sangani", "Lodhika", "Morbi", "Paddhari", "Tankara", "Upleta", "Vinchhiya", "Wankaner"],
    "Sabarkantha":  ["Himmatnagar", "Idar", "Khedbrahma", "Prantij", "Talod", "Vadali", "Vijaynagar"],
    "Surat":        ["Surat City", "Bardoli", "Choryasi", "Kamrej", "Mahuva", "Mandvi", "Mangrol", "Olpad", "Palsana", "Umarpada"],
    "Surendranagar":["Surendranagar", "Chotila", "Dasada", "Dhrangadhra", "Halvad", "Lakhtar", "Limbdi", "Muli", "Sayla", "Thangadh", "Wadhwan"],
    "Tapi":         ["Vyara", "Dolvan", "Kukarmunda", "Nizar", "Songadh", "Uchchhal", "Valod"],
    "Vadodara":     ["Vadodara City", "Dabhoi", "Karjan", "Padra", "Savli", "Shinor", "Vaghodia"],
    "Valsad":       ["Valsad", "Dharampur", "Kaprada", "Pardi", "Umbergaon", "Vapi"],
}

# ─── Gujarati first names / last names for officer generation ─────────────────
FIRST_NAMES_M = ["Rajesh","Amit","Sunil","Vikram","Nitin","Kiran","Hardik","Jignesh","Chirag","Bhavin","Darshan","Hiren","Mehul","Paresh","Yogesh","Alpesh","Dhaval","Nilesh","Kamlesh","Pankaj","Sagar","Vipul","Jayesh","Dinesh","Rakesh"]
FIRST_NAMES_F = ["Priya","Nisha","Komal","Renu","Pooja","Ankita","Swati","Neha","Divya","Hetal","Jagruti","Mansi","Kinjal","Riddhi","Sonal","Meera","Kajal","Vaishali","Bhavna","Kruti"]
LAST_NAMES = ["Patel","Shah","Desai","Joshi","Mehta","Trivedi","Bhatt","Sharma","Parmar","Chauhan","Rathod","Solanki","Thakor","Raval","Modi","Nagar","Pandya","Dave","Vyas","Gajjar"]

random.seed(42)  # reproducible names

def _rand_name():
    first = random.choice(FIRST_NAMES_M + FIRST_NAMES_F)
    last = random.choice(LAST_NAMES)
    return f"{first} {last}"


# ─── JSON helpers ─────────────────────────────────────────────────────────────
def load_json(filename):
    path = DATA_DIR / filename
    if not path.exists():
        print(f"   ⚠️  {filename} not found — skipping")
        return None
    print(f"   📂  Loading {filename}  ({path.stat().st_size // 1024} KB)…", end="", flush=True)
    data = json.loads(path.read_text(encoding="utf-8"))
    print(f"  {len(data) if isinstance(data, list) else '1'} records")
    return data


def seed_collection(col_name, docs):
    col = db[col_name]
    col.drop()
    if not docs:
        print(f"   🗑️  Dropped  {col_name}  (empty)")
        return
    if isinstance(docs, dict):
        docs = [docs]
    t0 = time.time()
    chunk = 500
    total = 0
    for i in range(0, len(docs), chunk):
        try:
            db[col_name].insert_many(docs[i:i+chunk], ordered=False)
            total += len(docs[i:i+chunk])
        except BulkWriteError as bwe:
            total += bwe.details.get("nInserted", 0)
    elapsed = time.time() - t0
    print(f"   ✅  {col_name}: {total} docs  ({elapsed:.1f}s)")


# ═══════════════════════════════════════════════════════════════════════════════
print("=" * 60)
print("  SEEDING EDUGUARD DATABASE")
print("=" * 60)

# ─── 1. Data from JSON files ──────────────────────────────────────────────────
print("\n── Data Collections ──")
seed_collection("beneficiaries", load_json("beneficiaries.json"))
seed_collection("payment_ledger", load_json("payment_ledger.json"))
seed_collection("death_registry", load_json("death_registry.json"))
seed_collection("udise", load_json("udise_records.json"))

# ─── 2. Schemes ──────────────────────────────────────────────────────────────
print("\n── Schemes ──")
CORE_SCHEMES = [
    {"scheme_id": "NLY",   "name": "Namo Lakshmi Yojana",                   "status": "ACTIVE",
     "eligibility_rules": {"gender": ["F"], "standards": [9,10,11,12], "streams": None, "min_marks_pct": None, "amount_fixed": 25000},
     "mutual_exclusions": ["NSVSY"]},
    {"scheme_id": "NSVSY", "name": "Namo Saraswati Vigyan Sadhana Yojana",  "status": "ACTIVE",
     "eligibility_rules": {"gender": ["F"], "standards": [11,12], "streams": ["Science"], "min_marks_pct": None, "amount_fixed": 10000},
     "mutual_exclusions": ["NLY"]},
    {"scheme_id": "MGMS",  "name": "Mukhyamantri Gyan Sadhana Merit Scholarship", "status": "ACTIVE",
     "eligibility_rules": {"gender": None, "standards": [9,10,11,12], "streams": None, "min_marks_pct": 75.0,
                            "amount_tiers": [{"min_marks": 90,"amount": 20000}, {"min_marks": 80,"amount": 10000}, {"min_marks": 75,"amount": 5000}]},
     "mutual_exclusions": []},
]
seed_collection("schemes", CORE_SCHEMES)

# ─── 3. Geography reference ──────────────────────────────────────────────────
print("\n── Geography ──")
geo_docs = []
for district, talukas in GUJARAT_GEOGRAPHY.items():
    geo_docs.append({"district": district, "talukas": talukas})
seed_collection("geography", geo_docs)

# ─── 4. Officers ──────────────────────────────────────────────────────────────
print("\n── Officers ──")
print("   Generating officers for all districts & talukas…")

officer_counter = 0
all_officers = []

# State Admin (single)
officer_counter += 1
all_officers.append({
    "officer_id": f"OFF-{officer_counter:04d}",
    "name": "Rekha Sharma",
    "role": "STATE_ADMIN",
    "email": "admin@eduguard.in",
    "district": "Gandhinagar",
    "taluka": None,
    "password_hash": hash_pw("admin@123"),
    "is_active": True,
    "active_cases": 0,
})

# DFO — one per district
for district in GUJARAT_GEOGRAPHY:
    officer_counter += 1
    pw = district.lower().replace(" ", "") + "@123"
    all_officers.append({
        "officer_id": f"DFO-{district[:3].upper()}-{officer_counter:04d}",
        "name": _rand_name(),
        "role": "DFO",
        "email": f"dfo.{district.lower().replace(' ', '')}@eduguard.in",
        "district": district,
        "taluka": None,
        "password_hash": hash_pw(pw),
        "is_active": True,
        "active_cases": 0,
    })

# Scheme Verifier — 2-3 per taluka
for district, talukas in GUJARAT_GEOGRAPHY.items():
    for taluka in talukas:
        for _ in range(random.randint(2, 3)):
            officer_counter += 1
            pw = taluka.lower().replace(" ", "").replace("-", "") + "@123"
            all_officers.append({
                "officer_id": f"SV-{taluka[:3].upper()}-{officer_counter:04d}",
                "name": _rand_name(),
                "role": "SCHEME_VERIFIER",
                "email": f"sv.{taluka.lower().replace(' ', '')}.{district.lower().replace(' ', '')}@eduguard.in",
                "district": district,
                "taluka": taluka,
                "password_hash": hash_pw(pw),
                "is_active": True,
                "active_cases": random.randint(0, 5),
            })

# Audit Officer — 1 per taluka
for district, talukas in GUJARAT_GEOGRAPHY.items():
    for taluka in talukas:
        officer_counter += 1
        pw = taluka.lower().replace(" ", "").replace("-", "") + "@123"
        all_officers.append({
            "officer_id": f"AUD-{taluka[:3].upper()}-{officer_counter:04d}",
            "name": _rand_name(),
            "role": "AUDIT",
            "email": f"audit.{taluka.lower().replace(' ', '')}.{district.lower().replace(' ', '')}@eduguard.in",
            "district": district,
            "taluka": taluka,
            "password_hash": hash_pw(pw),
            "is_active": True,
            "active_cases": 0,
        })

print(f"   Total officers generated: {len(all_officers)}")
print(f"     STATE_ADMIN:     {sum(1 for o in all_officers if o['role']=='STATE_ADMIN')}")
print(f"     DFO:             {sum(1 for o in all_officers if o['role']=='DFO')}")
print(f"     SCHEME_VERIFIER: {sum(1 for o in all_officers if o['role']=='SCHEME_VERIFIER')}")
print(f"     AUDIT:           {sum(1 for o in all_officers if o['role']=='AUDIT')}")

seed_collection("officers", all_officers)

# ─── 5. Institutions ─────────────────────────────────────────────────────────
print("\n── Institutions ──")
DEMO_INSTITUTIONS = [
    {"institution_id": "INST-001", "name": "Sarvodaya Bank (Gujarat Rural Co-op)", "type": "BANK", "taluka": "Sanand", "district": "Ahmedabad", "beneficiary_count": 342,
     "risk_profile": {"risk_score": 82, "is_flagged": True, "flag_reason": "Delayed disbursement to 67 students"},
     "financial_ledger": {"current_holding": 1850000, "total_funds_credited": 8500000}},
    {"institution_id": "INST-002", "name": "Shri Gyan School (UDISE 24010023)", "type": "SCHOOL", "taluka": "Daskroi", "district": "Ahmedabad", "beneficiary_count": 218,
     "risk_profile": {"risk_score": 76, "is_flagged": True, "flag_reason": "14 students marked enrolled despite death records"},
     "financial_ledger": {"current_holding": 1240000, "total_funds_credited": 5200000}},
    {"institution_id": "INST-003", "name": "National Bank of Gujarat (Branch 42)", "type": "BANK", "taluka": "Viramgam", "district": "Ahmedabad", "beneficiary_count": 198,
     "risk_profile": {"risk_score": 54, "is_flagged": False, "flag_reason": None},
     "financial_ledger": {"current_holding": 980000, "total_funds_credited": 3800000}},
    {"institution_id": "INST-004", "name": "Pragati Vidyalaya (UDISE 24020041)", "type": "SCHOOL", "taluka": "Sachin", "district": "Surat", "beneficiary_count": 289,
     "risk_profile": {"risk_score": 67, "is_flagged": True, "flag_reason": "23 cross-scheme payments"},
     "financial_ledger": {"current_holding": 1560000, "total_funds_credited": 6200000}},
]
seed_collection("institutions", DEMO_INSTITUTIONS)

# ─── 6. Users collection (for citizen registration) ──────────────────────────
print("\n── Users ──")
db["users"].drop()
print("   🗑️  Dropped  users  (citizens register themselves)")

# ─── 7. Flags — start empty ──────────────────────────────────────────────────
db["flags"].drop()
print("   🗑️  Dropped  flags  (populated by run-analysis)")

# ─── Create indexes ───────────────────────────────────────────────────────────
print("\n── Indexes ──")

db["beneficiaries"].create_index("beneficiary_id", unique=True, background=True)
db["beneficiaries"].create_index("aadhaar_hash", background=True)
db["beneficiaries"].create_index("district", background=True)
print("   ✅  beneficiaries")

db["payment_ledger"].create_index("payment_id", unique=True, background=True)
db["payment_ledger"].create_index("beneficiary_id", background=True)
print("   ✅  payment_ledger")

db["death_registry"].create_index("aadhaar_hash", unique=True, background=True)
print("   ✅  death_registry")

db["udise"].create_index("beneficiary_id", unique=True, background=True)
print("   ✅  udise")

db["officers"].create_index("officer_id", unique=True, background=True)
db["officers"].create_index([("role", 1), ("district", 1), ("taluka", 1)], background=True)
print("   ✅  officers")

db["flags"].create_index("flag_id", background=True)
db["flags"].create_index("status", background=True)
db["flags"].create_index("assigned_verifier_id", background=True)
print("   ✅  flags")

db["institutions"].create_index("institution_id", unique=True, background=True)
print("   ✅  institutions")

db["schemes"].create_index("scheme_id", unique=True, background=True)
print("   ✅  schemes")

db["users"].create_index("aadhaar_hash", unique=True, background=True)
print("   ✅  users")

db["geography"].create_index("district", unique=True, background=True)
print("   ✅  geography")

# ─── Summary ──────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("📊  Collection sizes:")
for col_name in ["beneficiaries", "payment_ledger", "death_registry", "udise", "schemes", "officers", "institutions", "users", "flags", "geography"]:
    count = db[col_name].count_documents({})
    print(f"    {col_name:<20} {count:>6} documents")

print(f"\n✅  Done! {len(all_officers)} officers seeded across {len(GUJARAT_GEOGRAPHY)} districts.")
print("    Restart the backend to use the new data.")
client.close()
