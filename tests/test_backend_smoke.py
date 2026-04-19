import os
import unittest

import requests


BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
TIMEOUT = 60
ANALYSIS_TIMEOUT = 600


class BackendSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.session = requests.Session()

        health = cls.session.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
        health.raise_for_status()
        cls.health = health.json()

        login_payload = {
            "mode": "officer",
            "role": "DFO",
            "district": "Ahmedabad",
            "password": "dfo@1234",
        }
        login = cls.session.post(f"{BASE_URL}/api/auth/login", json=login_payload, timeout=TIMEOUT)
        login.raise_for_status()
        cls.login = login.json()
        cls.headers = {"Authorization": f"Bearer {cls.login['access_token']}"}

    @classmethod
    def tearDownClass(cls):
        cls.session.close()

    def test_health_endpoint(self):
        self.assertEqual(self.health["status"], "ok")
        self.assertTrue(self.health["mongo_connected"])
        self.assertEqual(self.health["officer_count"], 7)

    def test_login_and_me(self):
        self.assertEqual(self.login["role"], "DFO")
        self.assertEqual(self.login["district"], "Ahmedabad")

        me = self.session.get(f"{BASE_URL}/api/auth/me", headers=self.headers, timeout=TIMEOUT)
        me.raise_for_status()
        payload = me.json()

        self.assertEqual(payload["role"], "DFO")
        self.assertEqual(payload["name"], self.login["name"])
        self.assertEqual(payload["district"], "Ahmedabad")

    def test_dfo_institutions_route(self):
        response = self.session.get(f"{BASE_URL}/api/dfo/institutions", headers=self.headers, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()

        self.assertIsInstance(data, list)

    def test_run_analysis_generates_flags(self):
        response = self.session.post(
            f"{BASE_URL}/api/run-analysis",
            json={"run_id": "pytest-smoke"},
            headers=self.headers,
            timeout=ANALYSIS_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        self.assertEqual(data["run_id"], "pytest-smoke")
        self.assertGreater(data["total_transactions"], 0)
        self.assertGreaterEqual(data["flagged_count"], 0)
        self.assertGreater(data["processing_time_seconds"], 0)
        self.assertIsInstance(data["flags"], list)


if __name__ == "__main__":
    unittest.main(verbosity=2)