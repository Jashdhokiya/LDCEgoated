import os
import uuid
import unittest
from datetime import datetime, timedelta

import requests
from jose import jwt


BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
JWT_SECRET = os.getenv("TEST_JWT_SECRET", "eduguard-test-secret")
JWT_ALGO = "HS256"
TIMEOUT = 60
LONG_TIMEOUT = 600


def make_officer_headers(sub: str, role: str, name: str, district: str | None = None, taluka: str | None = None):
    payload = {
        "sub": sub,
        "role": role,
        "name": name,
        "email": "",
        "district": district,
        "taluka": taluka,
        "exp": datetime.utcnow() + timedelta(hours=4),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)
    return {"Authorization": f"Bearer {token}"}


class AllEndpointsCoverageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = requests.Session()

        # Seed a real USER account for USER-only endpoints.
        cls.user_email = f"autotest_{uuid.uuid4().hex[:8]}@example.com"
        cls.user_aadhaar = f"aadhaar_{uuid.uuid4().hex[:16]}"
        cls.user_password = "User@1234"

        register_payload = {
            "name": "Auto Test User",
            "email": cls.user_email,
            "aadhaar_hash": cls.user_aadhaar,
            "password": cls.user_password,
        }
        reg = cls.s.post(f"{BASE_URL}/api/auth/register", json=register_payload, timeout=TIMEOUT)
        if reg.status_code not in (200, 409):
            reg.raise_for_status()

        user_login_payload = {
            "mode": "user",
            "aadhaar_hash": cls.user_aadhaar,
            "password": cls.user_password,
        }
        user_login = cls.s.post(f"{BASE_URL}/api/auth/login", json=user_login_payload, timeout=TIMEOUT)
        user_login.raise_for_status()
        cls.user_login_json = user_login.json()
        cls.user_headers = {"Authorization": f"Bearer {cls.user_login_json['access_token']}"}

        # Real DFO login (also covers auth/login officer mode).
        dfo_login_payload = {
            "mode": "officer",
            "role": "DFO",
            "district": "Ahmedabad",
            "password": "dfo@1234",
        }
        dfo_login = cls.s.post(f"{BASE_URL}/api/auth/login", json=dfo_login_payload, timeout=TIMEOUT)
        dfo_login.raise_for_status()
        cls.dfo_headers = {"Authorization": f"Bearer {dfo_login.json()['access_token']}"}

        # Synthetic tokens for role-only coverage of protected routes.
        cls.admin_headers = make_officer_headers("OFF-0001", "STATE_ADMIN", "Admin", "Gandhinagar", None)
        cls.audit_headers = make_officer_headers("OFF-3011", "AUDIT", "Auditor", "Ahmedabad", "Kalol")
        cls.verifier_headers = make_officer_headers("OFF-2091", "SCHEME_VERIFIER", "Verifier", "Ahmedabad", "Sanand")

        cls.case_id = None
        cls.beneficiary_id = None

    @classmethod
    def tearDownClass(cls):
        cls.s.close()

    def _assert_status(self, response, allowed: tuple[int, ...], label: str):
        self.assertIn(response.status_code, allowed, msg=f"{label} unexpected status {response.status_code}: {response.text[:400]}")

    def test_all_endpoints(self):
        # ---- app endpoints ----
        r = self.s.get(f"{BASE_URL}/", timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /")

        r = self.s.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/health")

        # ---- auth endpoints ----
        r = self.s.get(f"{BASE_URL}/api/auth/geography", timeout=TIMEOUT)
        self._assert_status(r, (200, 503), "GET /api/auth/geography")

        # Officer login already covered in setUpClass; verify endpoint behavior is stable.
        r = self.s.post(
            f"{BASE_URL}/api/auth/login",
            json={"mode": "officer", "role": "DFO", "district": "Ahmedabad", "password": "dfo@1234"},
            timeout=TIMEOUT,
        )
        self._assert_status(r, (200,), "POST /api/auth/login (officer)")

        # User login also covered in setUpClass; execute once more for endpoint coverage.
        r = self.s.post(
            f"{BASE_URL}/api/auth/login",
            json={"mode": "user", "aadhaar_hash": self.user_aadhaar, "password": self.user_password},
            timeout=TIMEOUT,
        )
        self._assert_status(r, (200,), "POST /api/auth/login (user)")

        r = self.s.post(
            f"{BASE_URL}/api/auth/verify-magic-link",
            json={"token": "invalid-token-for-coverage"},
            timeout=TIMEOUT,
        )
        self._assert_status(r, (400,), "POST /api/auth/verify-magic-link")

        r = self.s.post(f"{BASE_URL}/api/auth/logout", timeout=TIMEOUT)
        self._assert_status(r, (200,), "POST /api/auth/logout")

        r = self.s.get(f"{BASE_URL}/api/auth/me", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/auth/me (officer)")

        r = self.s.get(f"{BASE_URL}/api/auth/me", headers=self.user_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/auth/me (user)")

        # ---- analysis endpoints ----
        run = self.s.post(
            f"{BASE_URL}/api/run-analysis",
            json={"run_id": "all-endpoints"},
            headers=self.dfo_headers,
            timeout=LONG_TIMEOUT,
        )
        self._assert_status(run, (200,), "POST /api/run-analysis")
        run_json = run.json()
        if run_json.get("flags"):
            self.case_id = run_json["flags"][0].get("flag_id")
            self.beneficiary_id = run_json["flags"][0].get("beneficiary_id")

        r = self.s.get(f"{BASE_URL}/api/flags", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/flags")
        flags = r.json() if r.status_code == 200 else []
        if not self.case_id and flags:
            self.case_id = flags[0].get("flag_id")
            self.beneficiary_id = flags[0].get("beneficiary_id")

        case_id = self.case_id or "F-NOT-FOUND"

        r = self.s.get(f"{BASE_URL}/api/flag/{case_id}", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200, 404), "GET /api/flag/{flag_id}")

        r = self.s.post(
            f"{BASE_URL}/api/flag/{case_id}/generate-evidence",
            headers=self.dfo_headers,
            timeout=TIMEOUT,
        )
        self._assert_status(r, (200, 404), "POST /api/flag/{flag_id}/generate-evidence")

        r = self.s.patch(
            f"{BASE_URL}/api/flag/{case_id}/status",
            json={"status": "ASSIGNED"},
            headers=self.dfo_headers,
            timeout=TIMEOUT,
        )
        self._assert_status(r, (200, 404), "PATCH /api/flag/{flag_id}/status")

        r = self.s.get(f"{BASE_URL}/api/stats", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/stats")

        r = self.s.get(f"{BASE_URL}/api/report", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/report")

        # ---- dfo endpoints ----
        r = self.s.get(f"{BASE_URL}/api/dfo/dashboard", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/dfo/dashboard")

        r = self.s.get(f"{BASE_URL}/api/dfo/investigations", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/dfo/investigations")

        r = self.s.get(f"{BASE_URL}/api/dfo/investigations/{case_id}", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200, 404), "GET /api/dfo/investigations/{case_id}")

        r = self.s.patch(
            f"{BASE_URL}/api/dfo/investigations/{case_id}/assign",
            json={"verifier_id": "OFF-2091"},
            headers=self.dfo_headers,
            timeout=TIMEOUT,
        )
        self._assert_status(r, (200, 404), "PATCH /api/dfo/investigations/{case_id}/assign")

        r = self.s.get(f"{BASE_URL}/api/dfo/institutions", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/dfo/institutions")

        r = self.s.get(f"{BASE_URL}/api/dfo/verifiers", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/dfo/verifiers")

        r = self.s.get(f"{BASE_URL}/api/dfo/students", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/dfo/students")
        students_payload = r.json() if r.status_code == 200 else {}
        student_id = self.beneficiary_id
        if not student_id:
            students = students_payload.get("students") or []
            if students:
                student_id = students[0].get("beneficiary_id")
        student_id = student_id or "BEN-NOT-FOUND"

        r = self.s.get(f"{BASE_URL}/api/dfo/student/{student_id}", headers=self.dfo_headers, timeout=TIMEOUT)
        self._assert_status(r, (200, 404), "GET /api/dfo/student/{beneficiary_id}")

        # ---- verifier endpoints ----
        r = self.s.get(f"{BASE_URL}/api/verifier/my-cases", headers=self.verifier_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/verifier/my-cases")

        r = self.s.get(f"{BASE_URL}/api/verifier/case/{case_id}", headers=self.verifier_headers, timeout=TIMEOUT)
        self._assert_status(r, (200, 404), "GET /api/verifier/case/{case_id}")

        evidence_payload = {
            "photo_evidence_url": "https://example.com/proof.jpg",
            "gps_lat": 23.0225,
            "gps_lng": 72.5714,
            "verifier_notes": "Auto endpoint coverage submission",
            "ai_verification_match": True,
            "confidence_score": 87.0,
        }
        r = self.s.post(
            f"{BASE_URL}/api/verifier/evidence/{case_id}",
            json=evidence_payload,
            headers=self.verifier_headers,
            timeout=TIMEOUT,
        )
        self._assert_status(r, (200, 404), "POST /api/verifier/evidence/{case_id}")

        # ---- audit endpoints ----
        r = self.s.get(f"{BASE_URL}/api/audit/pending", headers=self.audit_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/audit/pending")

        r = self.s.get(f"{BASE_URL}/api/audit/case/{case_id}", headers=self.audit_headers, timeout=TIMEOUT)
        self._assert_status(r, (200, 404), "GET /api/audit/case/{case_id}")

        r = self.s.post(
            f"{BASE_URL}/api/audit/{case_id}/decide",
            json={"final_decision": "LEGITIMATE", "auditor_notes": "Automated endpoint coverage decision"},
            headers=self.audit_headers,
            timeout=TIMEOUT,
        )
        self._assert_status(r, (200, 404), "POST /api/audit/{case_id}/decide")

        r = self.s.get(f"{BASE_URL}/api/audit/all", headers=self.audit_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/audit/all")

        # ---- admin endpoints ----
        r = self.s.get(f"{BASE_URL}/api/admin/overview", headers=self.admin_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/admin/overview")

        r = self.s.get(f"{BASE_URL}/api/admin/district-stats", headers=self.admin_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/admin/district-stats")

        r = self.s.get(f"{BASE_URL}/api/admin/schemes", headers=self.admin_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/admin/schemes")

        r = self.s.patch(
            f"{BASE_URL}/api/admin/schemes/NLY",
            json={"status": "ACTIVE"},
            headers=self.admin_headers,
            timeout=TIMEOUT,
        )
        self._assert_status(r, (200, 404), "PATCH /api/admin/schemes/{scheme_id}")

        r = self.s.get(f"{BASE_URL}/api/admin/officers", headers=self.admin_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/admin/officers")

        # ---- user endpoints ----
        r = self.s.get(f"{BASE_URL}/api/user/profile", headers=self.user_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/user/profile")

        r = self.s.put(
            f"{BASE_URL}/api/user/complete-profile",
            json={
                "phone": "9999999999",
                "district": "Ahmedabad",
                "taluka": "Daskroi",
                "gender": "F",
                "dob": "2008-01-01",
                "caste_category": "OBC",
                "income": 120000,
                "bank_name": "Test Bank",
                "bank_account_display": "1234",
                "bank_ifsc": "TEST0001234",
                "face_photo": "",
            },
            headers=self.user_headers,
            timeout=TIMEOUT,
        )
        self._assert_status(r, (400, 403), "PUT /api/user/complete-profile")

        r = self.s.post(f"{BASE_URL}/api/user/kyc", headers=self.user_headers, timeout=TIMEOUT)
        self._assert_status(r, (200, 400), "POST /api/user/kyc")

        r = self.s.post(
            f"{BASE_URL}/api/user/face-kyc",
            json={"face_photo": "not-a-valid-image"},
            headers=self.user_headers,
            timeout=TIMEOUT,
        )
        self._assert_status(r, (200, 400), "POST /api/user/face-kyc")

        r = self.s.post(
            f"{BASE_URL}/api/user/upload-face",
            json={"face_photo": "not-a-valid-image"},
            headers=self.user_headers,
            timeout=TIMEOUT,
        )
        self._assert_status(r, (200, 400), "POST /api/user/upload-face")

        r = self.s.get(f"{BASE_URL}/api/user/schemes", headers=self.user_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/user/schemes")

        r = self.s.get(f"{BASE_URL}/api/user/payments", headers=self.user_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/user/payments")

        r = self.s.get(f"{BASE_URL}/api/user/eligible-schemes", headers=self.user_headers, timeout=TIMEOUT)
        self._assert_status(r, (200,), "GET /api/user/eligible-schemes")

        r = self.s.get(f"{BASE_URL}/api/user/scheme-preferences", headers=self.user_headers, timeout=TIMEOUT)
        self._assert_status(r, (200, 404), "GET /api/user/scheme-preferences")

        r = self.s.post(f"{BASE_URL}/api/user/schemes/NLY/opt-in", headers=self.user_headers, timeout=TIMEOUT)
        self._assert_status(r, (200, 400, 403, 404), "POST /api/user/schemes/{scheme_id}/opt-in")

        r = self.s.post(f"{BASE_URL}/api/user/schemes/NLY/opt-out", headers=self.user_headers, timeout=TIMEOUT)
        self._assert_status(r, (200, 404), "POST /api/user/schemes/{scheme_id}/opt-out")


if __name__ == "__main__":
    unittest.main(verbosity=2)