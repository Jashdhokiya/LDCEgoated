import requests
import json

base_url = "http://localhost:8000"
login_data = {
    "mode": "user",
    "aadhaar_hash": "a4d339d6cc8f796d1ebccf8f5337e6f366b5952d43e5d31518b6e6cf6289b7cf",
    "password": "user@1234"
}

res = requests.post(f"{base_url}/api/auth/login", json=login_data)
if res.status_code != 200:
    print("User Login failed:", res.text)
    exit(1)

token = res.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}

support_data = {
    "subject": "Test Complaint from Script",
    "message": "This is a test to verify the endpoint is fixed."
}
res2 = requests.post(f"{base_url}/api/user/support", headers=headers, json=support_data)
print("Create ticket status:", res2.status_code)
print("Create ticket response:", res2.text)

