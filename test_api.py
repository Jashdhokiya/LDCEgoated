"""Quick API smoke test — run while uvicorn is up."""
import requests

BASE = "http://localhost:8000"

# 1) Login
login = requests.post(f"{BASE}/api/auth/login", json={"email": "dfo@eduguard.in", "password": "dfo@1234"})
print(f"LOGIN: {login.status_code} role={login.json().get('role')}")
token = login.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}

# 2) /me
me = requests.get(f"{BASE}/api/auth/me", headers=H)
print(f"ME: {me.status_code} => {me.json()}")

# 3) Institutions
inst = requests.get(f"{BASE}/api/dfo/institutions", headers=H)
print(f"INSTITUTIONS: {inst.status_code} count={len(inst.json())}")
if inst.json():
    print(f"  first: {inst.json()[0].get('name')}")

# 4) Run analysis
print("Running analysis (may take 10-30s)...")
try:
    analysis = requests.post(f"{BASE}/api/run-analysis", json={"run_id": "test-001"}, headers=H, timeout=120)
    print(f"ANALYSIS: {analysis.status_code}")
    if analysis.status_code == 200:
        d = analysis.json()
        print(f"  flagged_count: {d.get('flagged_count')}")
        print(f"  total_transactions: {d.get('total_transactions')}")
        print(f"  time: {d.get('processing_time_seconds')}s")
    else:
        print(f"  ERROR: {analysis.text[:800]}")
except Exception as e:
    print(f"  EXCEPTION: {e}")
