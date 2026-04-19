#!/usr/bin/env python3
"""
generate_data.py — EduGuard DBT Synthetic Dataset Generator
Run once:  python generate_data.py
Outputs:   /data/*.json
"""

import hashlib, json, os, random
from collections import defaultdict
from datetime import date, timedelta

SEED = 42
random.seed(SEED)
NUM_BEN = 26000
TODAY = date(2025, 4, 18)
ACADEMIC_YEAR = "2024-25"

DISTRICTS = [
    "Ahmedabad","Surat","Vadodara","Rajkot","Gandhinagar","Bhavnagar",
    "Jamnagar","Junagadh","Anand","Mehsana","Patan","Banaskantha",
    "Sabarkantha","Kheda","Panchmahals","Dahod","Bharuch","Navsari",
    "Valsad","Tapi","Narmada","Chhota Udaipur","Aravalli","Morbi",
    "Botad","Gir Somnath","Devbhoomi Dwarka","Porbandar",
]

TALUKAS = {
    "Ahmedabad":["Daskroi","Dhandhuka","Sanand","Bavla"],
    "Surat":["Choryasi","Olpad","Kamrej","Mangrol"],
    "Vadodara":["Padra","Karjan","Savli","Dabhoi"],
    "Rajkot":["Lodhika","Kotda Sangani","Jasdan","Gondal"],
    "Gandhinagar":["Kalol","Dehgam","Mansa"],
    "Bhavnagar":["Ghogha","Sihor","Palitana","Talaja"],
    "Jamnagar":["Lalpur","Dhrol","Kalavad"],
    "Junagadh":["Vanthali","Visavadar","Manavadar","Keshod"],
    "Anand":["Borsad","Petlad","Umreth","Sojitra"],
    "Mehsana":["Visnagar","Kheralu","Unjha","Vijapur"],
    "Patan":["Chanasma","Siddhpur","Harij"],
    "Banaskantha":["Palanpur","Deesa","Dhanera","Tharad"],
    "Sabarkantha":["Himatnagar","Idar","Khedbrahma","Prantij"],
    "Kheda":["Nadiad","Kapadvanj","Thasra","Mahudha"],
    "Panchmahals":["Godhra","Halol","Kalol","Shehera"],
    "Dahod":["Jhalod","Limkheda","Garbada"],
    "Bharuch":["Jambusar","Amod","Anklesvar","Hansot"],
    "Navsari":["Chikhli","Gandevi","Jalalpor"],
    "Valsad":["Pardi","Umbergaon","Dharampur","Kaprada"],
    "Tapi":["Vyara","Songadh","Valod"],
    "Narmada":["Rajpipla","Dediapada","Tilakwada"],
    "Chhota Udaipur":["Bodeli","Kavant","Nasvadi"],
    "Aravalli":["Modasa","Bayad","Dhansura","Meghraj"],
    "Morbi":["Wankaner","Halvad","Tankara"],
    "Botad":["Gadhada","Barwala","Ranpur"],
    "Gir Somnath":["Veraval","Sutrapada","Una"],
    "Devbhoomi Dwarka":["Khambhalia","Bhanvad","Kalyanpur"],
    "Porbandar":["Kutiyana","Ranavav","Porbandar City"],
}

FIRST_F = ["Riya","Priya","Kavya","Drashti","Mital","Hetal","Bhumika",
    "Foram","Nidhi","Kinjal","Riddhi","Siddhi","Dhara","Pooja",
    "Ankita","Shreya","Payal","Mansi","Rutvi","Dhruti",
    "Zalak","Ishani","Khushi","Nency"]
FIRST_M = ["Viral","Harsh","Darshan","Karan","Rohan","Parth","Jay",
    "Dhruv","Arjun","Ravi","Nikhil","Sagar","Chirag","Mihir",
    "Yash","Prem","Deep","Raj","Veer","Kishan"]
SURNAMES = ["Patel","Shah","Modi","Desai","Joshi","Trivedi","Pandya",
    "Mehta","Parmar","Solanki","Vaghela","Chauhan","Rathod",
    "Thakor","Baria","Damor","Vasava","Gamit","Chaudhary"]

SCH_PRE = ["Shri","Smt.","Dr.","Sarvodaya","Saraswati","Gyan","Pragati","Vikas"]
SCH_DEI = ["Krishna","Narayan","Laxmi","Ambika","Gayatri","Swami Vivekanand",
    "Ganesh","Patel","Sardar","Mahatma","Tagore","Raman"]
SCH_SUF = ["School","Vidyalaya","High School","Madhyamik Shala"]

CASTE_W = {"General":0.25,"OBC":0.40,"SC":0.10,"ST":0.15,"EWS":0.10}

sha = lambda t: hashlib.sha256(t.encode()).hexdigest()
rdate = lambda s,e: s+timedelta(days=random.randint(0,(e-s).days))
clamp = lambda v,lo,hi: max(lo,min(hi,v))

def name_variants(first, surname, gender):
    sfx = "ben" if gender=="F" else "bhai"
    v1 = f"{first}{sfx} {surname}"
    elong = first.replace("i","ee").replace("a","aa")
    if elong == first: elong = first+"a"
    return [v1, f"{elong} {surname}"]

def gen_beneficiaries():
    bens = []
    per = NUM_BEN // len(DISTRICTS)
    rem = NUM_BEN % len(DISTRICTS)
    seq = 0
    for di, dist in enumerate(DISTRICTS):
        cnt = per + (1 if di < rem else 0)
        dc = di + 1
        for _ in range(cnt):
            seq += 1
            bid = f"BEN-GJ-{dc:02d}-{seq:04d}"
            g = "F" if random.random() < 0.70 else "M"
            fn = random.choice(FIRST_F if g=="F" else FIRST_M)
            sn = random.choice(SURNAMES)
            bens.append({
                "beneficiary_id": bid,
                "aadhaar_hash": sha(f"FAKE-{bid}-AADHAAR"),
                "name": f"{fn} {sn}",
                "name_variants": name_variants(fn, sn, g),
                "dob": rdate(date(2006,1,1), date(2009,12,31)).isoformat(),
                "gender": g,
                "caste_category": random.choices(list(CASTE_W.keys()), weights=list(CASTE_W.values()))[0],
                "district": dist,
                "taluka": random.choice(TALUKAS[dist]),
                "bank_account_hash": sha(f"FAKE-{bid}-BANK"),
                "is_deceased": False, "death_date": None,
            })
    return bens

def gen_udise(bens):
    recs = []
    for i, b in enumerate(bens):
        dc = DISTRICTS.index(b["district"])+1
        std = random.choice([9,10,11,12])
        stream = "General" if std<=10 else random.choice(["Science","Commerce","Arts"])
        recs.append({
            "beneficiary_id": b["beneficiary_id"],
            "udise_code": f"24{dc:02d}{i:07d}",
            "school_name": f"{random.choice(SCH_PRE)} {random.choice(SCH_DEI)} {random.choice(SCH_SUF)}",
            "standard": std, "stream": stream,
            "attendance_pct": clamp(round(random.gauss(82,10),1),40,100),
            "marks_pct": clamp(round(random.gauss(78,15),1),35,100),
            "enrollment_status": "ACTIVE",
            "academic_year": ACADEMIC_YEAR,
        })
    return recs

def gen_payments(bens, udise):
    pays = []
    umap = {u["beneficiary_id"]: u for u in udise}
    bmap = {b["beneficiary_id"]: b for b in bens}
    seq = 0
    for b in bens:
        u = umap[b["beneficiary_id"]]
        nly_ok = b["gender"]=="F" and u["standard"] in [9,10,11,12]
        nsvsy_ok = b["gender"]=="F" and u["standard"] in [11,12] and u["stream"]=="Science"

        if nly_ok and nsvsy_ok:
            seq += 1
            pd = rdate(date(2024,7,1), date(2025,3,31))
            pays.append({"payment_id":f"PAY-{seq:06d}","beneficiary_id":b["beneficiary_id"],
                "scheme":"NLY","amount":25000,"payment_date":pd.isoformat(),
                "credit_date":pd.isoformat(),
                "withdrawal_date":(pd+timedelta(days=random.randint(1,30))).isoformat(),
                "bank_account_hash":b["bank_account_hash"],
                "payment_status":"WITHDRAWN"})
        elif nly_ok:
            seq += 1
            pd = rdate(date(2024,7,1), date(2025,3,31))
            pays.append({"payment_id":f"PAY-{seq:06d}","beneficiary_id":b["beneficiary_id"],
                "scheme":"NLY","amount":25000,"payment_date":pd.isoformat(),
                "credit_date":pd.isoformat(),
                "withdrawal_date":(pd+timedelta(days=random.randint(1,30))).isoformat(),
                "bank_account_hash":b["bank_account_hash"],
                "payment_status":"WITHDRAWN"})

        if u["marks_pct"] >= 75:
            amt = 20000 if u["marks_pct"]>=90 else (10000 if u["marks_pct"]>=80 else 5000)
            seq += 1
            pd = rdate(date(2024,7,1), date(2025,3,31))
            pays.append({"payment_id":f"PAY-{seq:06d}","beneficiary_id":b["beneficiary_id"],
                "scheme":"MGMS","amount":amt,"payment_date":pd.isoformat(),
                "credit_date":pd.isoformat(),
                "withdrawal_date":(pd+timedelta(days=random.randint(1,30))).isoformat(),
                "bank_account_hash":b["bank_account_hash"],
                "payment_status":"WITHDRAWN"})
    return pays, seq

def plant_deceased(bens, udise, pays, n=45):
    umap = {u["beneficiary_id"]:u for u in udise}
    pmap = defaultdict(list)
    for p in pays: pmap[p["beneficiary_id"]].append(p)
    # Only pick beneficiaries that HAVE payments
    eligible = [i for i,b in enumerate(bens) if pmap.get(b["beneficiary_id"])]
    chosen = random.sample(eligible, n)
    registry = []
    for idx in chosen:
        b = bens[idx]
        earliest = min(date.fromisoformat(p["payment_date"]) for p in pmap[b["beneficiary_id"]])
        dd = earliest - timedelta(days=random.randint(30,180))
        b["is_deceased"] = True
        b["death_date"] = dd.isoformat()
        umap[b["beneficiary_id"]]["enrollment_status"] = "DECEASED"
        registry.append({"beneficiary_id":b["beneficiary_id"],"aadhaar_hash":b["aadhaar_hash"],
            "name":b["name"],"death_date":dd.isoformat(),"district":b["district"],
            "registration_source":"Municipal Corporation"})
    return registry

def plant_duplicates(bens, udise, pays, pay_seq, n=87):
    chosen = random.sample(range(len(bens)), n)
    umap = {u["beneficiary_id"]:u for u in udise}
    for idx in chosen:
        orig = bens[idx]
        ou = umap[orig["beneficiary_id"]]
        did = orig["beneficiary_id"]+"-DUP"
        nd = random.choice([d for d in DISTRICTS if d!=orig["district"]])
        ndc = DISTRICTS.index(nd)+1
        bens.append({
            "beneficiary_id":did,"aadhaar_hash":orig["aadhaar_hash"],
            "name":orig["name_variants"][0],"name_variants":orig["name_variants"],
            "dob":orig["dob"],"gender":orig["gender"],
            "caste_category":orig["caste_category"],"district":nd,
            "taluka":random.choice(TALUKAS[nd]),
            "bank_account_hash":sha(f"FAKE-{did}-BANK"),
            "is_deceased":False,"death_date":None,
        })
        udise.append({
            "beneficiary_id":did,
            "udise_code":f"24{ndc:02d}{random.randint(1000000,9999999)}",
            "school_name":f"{random.choice(SCH_PRE)} {random.choice(SCH_DEI)} {random.choice(SCH_SUF)}",
            "standard":ou["standard"],"stream":ou["stream"],
            "attendance_pct":clamp(round(random.gauss(82,10),1),40,100),
            "marks_pct":ou["marks_pct"],
            "enrollment_status":"ACTIVE","academic_year":ACADEMIC_YEAR,
        })
        orig_pays = [p for p in pays if p["beneficiary_id"]==orig["beneficiary_id"]]
        if orig_pays:
            t = random.choice(orig_pays)
            pay_seq += 1
            pd = rdate(date(2024,7,1), date(2025,3,31))
            pays.append({"payment_id":f"PAY-{pay_seq:06d}","beneficiary_id":did,
                "scheme":t["scheme"],"amount":t["amount"],"payment_date":pd.isoformat(),
                "credit_date":pd.isoformat(),
                "withdrawal_date":(pd+timedelta(days=random.randint(1,30))).isoformat(),
                "bank_account_hash":sha(f"FAKE-{did}-BANK"),
                "payment_status":"WITHDRAWN"})
    return pay_seq

def plant_undrawn(pays, n=93):
    eligible = [i for i,p in enumerate(pays) if p["withdrawal_date"] is not None]
    for idx in random.sample(eligible, n):
        p = pays[idx]
        p["payment_date"] = rdate(date(2024,7,1), date(2025,2,15)).isoformat()
        p["credit_date"] = p["payment_date"]
        p["withdrawal_date"] = None
        p["payment_status"] = "CREDITED"

def plant_cross_scheme(bens, udise, pays, pay_seq, n=22):
    """Add NSVSY payment to 22 students who already have NLY and are NSVSY-eligible."""
    umap = {u["beneficiary_id"]:u for u in udise}
    # Find bens with NLY payment AND NSVSY-eligible but no NSVSY payment yet
    has_nly = {p["beneficiary_id"] for p in pays if p["scheme"]=="NLY"}
    has_nsvsy = {p["beneficiary_id"] for p in pays if p["scheme"]=="NSVSY"}
    candidates = []
    for bid in has_nly:
        if bid in has_nsvsy: continue
        u = umap.get(bid)
        if not u: continue
        b = next((x for x in bens if x["beneficiary_id"]==bid), None)
        if not b: continue
        if b["gender"]=="F" and u["standard"] in [11,12] and u["stream"]=="Science":
            candidates.append(bid)
    chosen = random.sample(candidates, min(n, len(candidates)))
    bmap = {b["beneficiary_id"]:b for b in bens}
    for bid in chosen:
        bmap[bid]["schemes_active"] = ["NLY","NSVSY"]
        pay_seq += 1
        pd = rdate(date(2024,7,1), date(2025,3,31))
        pays.append({"payment_id":f"PAY-{pay_seq:06d}","beneficiary_id":bid,
            "scheme":"NSVSY","amount":10000,"payment_date":pd.isoformat(),
            "credit_date":pd.isoformat(),
            "withdrawal_date":(pd+timedelta(days=random.randint(1,30))).isoformat(),
            "bank_account_hash":bmap[bid]["bank_account_hash"],
            "payment_status":"WITHDRAWN"})
    return chosen

def main():
    print("="*60)
    print("EduGuard DBT — Synthetic Data Generator")
    print("="*60)
    sdir = os.path.dirname(os.path.abspath(__file__))
    ddir = os.path.join(os.path.dirname(sdir), "data")
    os.makedirs(ddir, exist_ok=True)

    print("\n[1/7] Generating beneficiaries…")
    bens = gen_beneficiaries()
    print(f"      {len(bens)} beneficiaries")

    print("[2/7] Generating U-DISE records…")
    udise = gen_udise(bens)
    print(f"      {len(udise)} records")

    print("[3/7] Generating payments…")
    pays, pseq = gen_payments(bens, udise)
    print(f"      {len(pays)} payments")

    print("[4/7] Planting 250 deceased anomalies…")
    dreg = plant_deceased(bens, udise, pays, 250)
    print(f"      Death registry: {len(dreg)}")

    print("[5/7] Planting 450 duplicate-identity anomalies…")
    pseq = plant_duplicates(bens, udise, pays, pseq, 450)
    print(f"      Beneficiaries now: {len(bens)}, Payments now: {len(pays)}")

    print("[6/7] Planting 500 undrawn-funds anomalies…")
    plant_undrawn(pays, 500)

    print("[7/7] Planting 150 cross-scheme stacking anomalies…")
    cross = plant_cross_scheme(bens, udise, pays, pseq, 150)
    print(f"      Cross-scheme flagged: {len(cross)}")

    def wj(fn, data):
        p = os.path.join(ddir, fn)
        with open(p,"w",encoding="utf-8") as f: json.dump(data,f,indent=2,ensure_ascii=False)
        print(f"  ✓ {fn}  ({len(data)} records)")

    print("\n── Writing JSON ──")
    wj("beneficiaries.json", bens)
    wj("udise_records.json", udise)
    wj("death_registry.json", dreg)
    wj("payment_ledger.json", pays)

    from detectors.scheme_rules import SCHEMES, UNDRAWN_THRESHOLD_DAYS, CROSS_SCHEME_FORBIDDEN_PAIRS
    sr = {"schemes":SCHEMES,"undrawn_threshold_days":UNDRAWN_THRESHOLD_DAYS,
          "cross_scheme_forbidden_pairs":CROSS_SCHEME_FORBIDDEN_PAIRS}
    with open(os.path.join(ddir,"scheme_rules.json"),"w") as f: json.dump(sr,f,indent=2,ensure_ascii=False)
    print("  ✓ scheme_rules.json")

    # VERIFICATION
    print("\n"+"="*60+"\nVERIFICATION\n"+"="*60)
    print(f"Beneficiaries : {len(bens)}")
    print(f"UDISE records : {len(udise)}")
    print(f"Payments      : {len(pays)}")
    print(f"Death registry: {len(dreg)}")
    undrawn = [p for p in pays if p["withdrawal_date"] is None
               and (TODAY-date.fromisoformat(p["payment_date"])).days>60]
    print(f"Undrawn >60d  : {len(undrawn)}")
    bb = defaultdict(set)
    for p in pays: bb[p["beneficiary_id"]].add(p["scheme"])
    cx = [b for b,s in bb.items() if "NLY" in s and "NSVSY" in s]
    print(f"Cross-scheme  : {len(cx)}")
    ac = defaultdict(int)
    for b in bens: ac[b["aadhaar_hash"]] += 1
    print(f"Dup aadhaar   : {sum(1 for c in ac.values() if c>1)}")
    print("\n✅ Done!")

if __name__ == "__main__":
    main()
