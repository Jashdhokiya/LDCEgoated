import requests
import json

base_url = "http://localhost:8000"
login_data = {
    "mode": "officer",
    "role": "DFO",
    "district": "Ahmedabad",
    "password": "dfo@1234"
}

print("Logging in...")
res = requests.post(f"{base_url}/api/auth/login", json=login_data)
if res.status_code != 200:
    print("Login failed:", res.text)
    exit(1)

token = res.json().get("access_token")
print("Login successful.")

headers = {"Authorization": f"Bearer {token}"}
print("Fetching support tickets...")
res2 = requests.get(f"{base_url}/api/dfo/support-tickets", headers=headers)
print("Status:", res2.status_code)
if res2.status_code == 200:
    print("Tickets:", json.dumps(res2.json(), indent=2))
else:
    print("Error:", res2.text)
