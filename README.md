<div align="center">
  
# 🛡️ EduGuard

**Automated DBT Auditing & Leakage Detection Platform**

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

EduGuard is an intelligent platform designed for cross-referencing and auditing Direct Benefit Transfer (DBT) payments within the state of Gujarat. It helps investigators track educational scheme disbursements and flag anomalies like duplicate records, deceased beneficiaries, or suspicious cross-scheme overlaps using rapid computational AI detection.

---
</div>

## 📂 Project Architecture

The platform follows a decoupled architecture, isolating the high-speed detection engines from the end-user interfaces.

| Directory | Core Purpose                                                              |
| :-------- | :------------------------------------------------------------------------ |
| **`api/`**        | ⚡ **Backend Engine** — FastAPI app with modular routes, JWT auth, and database schemas. |
| **`frontend/`**   | 🎨 **User Interface** — React & Vite dashboards separated by authorization roles (DFO, Audit, Verifier). |
| **`detectors/`**  | 🕵️ **Anomaly Algorithms** — Python logic executing blazing fast cross-checks and transliteration. |
| **`ai_layer/`**   | 🤖 **Intelligence Services** — Native LLM pipelines for auto-generating evidence reports on anomalies. |
| **`docs/`**       | 📖 **Documentation** — Deep dive architectural guides and developer personas. |
| **`scripts/`**    | 🛠️ **Utility Tools** — Database seeding, generating synthetic datasets, and system cleanup. |
| **`tests/`**       | 🧪 **Backend Diagnostics** — Automated testing routines for validation. |
| **`data/`**       | 📊 **Mapping Conf** — Static JSON configuration assets and geography references. |


## 🚀 Quickstart Guide

Spin up both systems asynchronously with hot-reloading active. Make sure your local MongoDB instance is accessible via the `.env` configuration.

### 1. Launch the Backend
Open a terminal at the project root and execute the startup batch script:
```bash
> .\start_backend.bat
```
*The endpoint will deploy locally on `http://127.0.0.1:8000`.*

### 2. Launch the Frontend
In a secondary terminal, enter the frontend package environment and start Vite:
```bash
> cd frontend
> npm run dev
```
*The browser dashboard will open automatically.*

---
<div align="center">
  <p><i>Empowering local officers with precise operational insights.</i></p>
</div>
