/**
 * frontend/src/api.js
 * Centralised API client.
 *
 * - Reads/writes the JWT from localStorage under key "eduguard_token"
 * - Attaches Authorization: Bearer <token> to every request
 * - On 401 → dispatches a custom "auth:expired" event so the app can reset
 */
import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const TOKEN_KEY = 'eduguard_token'
const USER_KEY  = 'eduguard_user'

// ── Token helpers ─────────────────────────────────────────────────────────────

export const tokenStore = {
  get:    ()        => localStorage.getItem(TOKEN_KEY),
  set:    (t)       => localStorage.setItem(TOKEN_KEY, t),
  clear:  ()        => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) },
  getUser:()        => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null } },
  setUser:(u)       => localStorage.setItem(USER_KEY, JSON.stringify(u)),
}

// ── Axios instance ────────────────────────────────────────────────────────────

const client = axios.create({ baseURL: BASE })

client.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      tokenStore.clear()
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    return Promise.reject(err)
  }
)

// ── Safe wrapper ──────────────────────────────────────────────────────────────

async function safe(fn, fallback = null) {
  try {
    const res = await fn()
    return res.data
  } catch (err) {
    if (err.response?.status === 403) {
      console.warn('[api] 403 Forbidden — check your role')
    }
    return fallback
  }
}

// ── AUTH — Officer login (by role + district + taluka + password) ─────────────

export async function loginOfficer(role, district, taluka, password) {
  const res = await axios.post(`${BASE}/api/auth/login`, {
    mode: 'officer',
    role,
    district: district || '',
    taluka: taluka || '',
    password,
  })
  const data = res.data
  tokenStore.set(data.access_token)
  tokenStore.setUser({
    officer_id: data.officer_id,
    role:       data.role,
    name:       data.name,
    district:   data.district,
    profile_complete: data.profile_complete ?? true,
  })
  return data
}

// ── AUTH — User login (by aadhaar_hash + password) ────────────────────────────

export async function loginUser(aadhaarHash, password) {
  const res = await axios.post(`${BASE}/api/auth/login`, {
    mode: 'user',
    aadhaar_hash: aadhaarHash,
    password,
  })
  const data = res.data
  tokenStore.set(data.access_token)
  tokenStore.setUser({
    officer_id: data.officer_id,
    role:       data.role,
    name:       data.name,
    district:   data.district,
    profile_complete: data.profile_complete ?? false,
  })
  return data
}

// ── AUTH — User registration (aadhaar + name + password) ──────────────────────

export async function registerUser(name, email, aadhaarHash, password) {
  const res = await axios.post(`${BASE}/api/auth/register`, {
    name,
    email,
    aadhaar_hash: aadhaarHash,
    password,
  })
  return res.data
}

export async function verifyMagicLink(token) {
  const res = await axios.post(`${BASE}/api/auth/verify-magic-link`, {
    token,
  })
  const data = res.data
  tokenStore.set(data.access_token)
  tokenStore.setUser({
    officer_id: data.officer_id,
    role:       data.role,
    name:       data.name,
    district:   data.district,
    profile_complete: data.profile_complete ?? false,
  })
  return data
}

// ── AUTH — Legacy login (still used by some components) ───────────────────────

export async function login(email, password) {
  // Backwards compat: treat as officer login with email-derived info
  return loginOfficer('DFO', '', '', password)
}

export async function logout() {
  await safe(() => client.post('/api/auth/logout'))
  tokenStore.clear()
}

export async function getMe() {
  return safe(() => client.get('/api/auth/me'))
}

// ── Geography (for login dropdowns) ──────────────────────────────────────────

export async function getGeography() {
  return safe(() => client.get('/api/auth/geography'), [])
}

// ── HEALTH ────────────────────────────────────────────────────────────────────

export async function getHealth() {
  return safe(() => client.get('/api/health'), { status: 'unknown' })
}

export async function getLandingStats() {
  return safe(() => client.get('/api/public/landing-stats'), {
    beneficiaries: 0,
    total_amount_at_risk: 0,
    flags: 0,
    districts: 0,
    mongo_connected: false,
  })
}

// ── ANALYSIS (DFO / Admin / Audit) ───────────────────────────────────────────

export async function runAnalysis(runId = 'demo-001') {
  return safe(() => client.post('/api/run-analysis', { run_id: runId }), null)
}

export async function getFlags() {
  return safe(() => client.get('/api/flags'), [])
}

export async function getFlag(flagId) {
  return safe(() => client.get(`/api/flag/${flagId}`), null)
}

export async function updateFlagStatus(flagId, status) {
  return safe(() => client.patch(`/api/flag/${flagId}/status`, { status }), null)
}

export async function getStats() {
  return safe(() => client.get('/api/stats'), {
    by_leakage_type: {}, by_district: {}, by_scheme: {}, total_amount_at_risk: 0
  })
}

export async function getReport() {
  return safe(() => client.get('/api/report'), 'Report unavailable')
}

// ── DFO ───────────────────────────────────────────────────────────────────────

export async function getDFODashboard() {
  return safe(() => client.get('/api/dfo/dashboard'), null)
}

export async function getInvestigations(params = {}) {
  return safe(() => client.get('/api/dfo/investigations', { params }), { total: 0, cases: [] })
}

export async function getInvestigation(caseId) {
  return safe(() => client.get(`/api/dfo/investigations/${caseId}`), null)
}

export async function assignInvestigation(caseId, verifierId) {
  return safe(() => client.patch(`/api/dfo/investigations/${caseId}/assign`, { verifier_id: verifierId }), null)
}

export async function getInstitutions(params = {}) {
  return safe(() => client.get('/api/dfo/institutions', { params }), [])
}

export async function getVerifiers() {
  return safe(() => client.get('/api/dfo/verifiers'), [])
}

export async function getSupportTickets() {
  return safe(() => client.get('/api/dfo/support-tickets'), [])
}

export async function updateSupportTicket(ticketId, data) {
  return safe(() => client.patch(`/api/dfo/support-tickets/${ticketId}`, data), null)
}

export async function getStudents(params = {}) {
  return safe(() => client.get('/api/dfo/students', { params }), { total: 0, students: [] })
}

export async function getStudent(id) {
  return safe(() => client.get(`/api/dfo/student/${id}`), null)
}

// ── STATE ADMIN ───────────────────────────────────────────────────────────────

export async function getAdminOverview() {
  return safe(() => client.get('/api/admin/overview'), null)
}

export async function getDistrictStats() {
  return safe(() => client.get('/api/admin/district-stats'), [])
}

export async function getSchemes() {
  return safe(() => client.get('/api/admin/schemes'), [])
}

export async function updateScheme(schemeId, payload) {
  return safe(() => client.patch(`/api/admin/schemes/${schemeId}`, payload), null)
}

export async function getOfficers() {
  return safe(() => client.get('/api/admin/officers'), [])
}

export async function getAdminAnnouncements() {
  return safe(() => client.get('/api/admin/announcements'), [])
}

export async function createAdminAnnouncement(payload) {
  return safe(() => client.post('/api/admin/announcements', payload), null)
}

// ── SCHEME VERIFIER ───────────────────────────────────────────────────────────

export async function getMyCases() {
  return safe(() => client.get('/api/verifier/my-cases'), { total: 0, cases: [] })
}

export async function getVerifierCase(caseId) {
  return safe(() => client.get(`/api/verifier/case/${caseId}`), null)
}

export async function submitEvidence(caseId, evidencePayload) {
  return safe(() => client.post(`/api/verifier/evidence/${caseId}`, evidencePayload), null)
}

// ── AUDIT ─────────────────────────────────────────────────────────────────────

export async function getAuditPending() {
  return safe(() => client.get('/api/audit/pending'), { total: 0, pending: [] })
}

export async function getAuditCase(caseId) {
  return safe(() => client.get(`/api/audit/case/${caseId}`), null)
}

export async function auditDecide(caseId, finalDecision, auditorNotes = '') {
  return safe(() => client.post(`/api/audit/${caseId}/decide`, {
    final_decision: finalDecision,
    auditor_notes:  auditorNotes,
  }), null)
}

export async function getAuditHistory() {
  return safe(() => client.get('/api/audit/all'), { total: 0, reviewed: [] })
}

export async function getAuditInstitutions() {
  // Uses the DFO institutions endpoint (now also accessible to AUDIT role)
  return safe(() => client.get('/api/dfo/institutions'), [])
}

export async function submitInstitutionReport(payload) {
  return safe(() => client.post('/api/audit/institution-report', payload), null)
}

export async function getMyInstitutionReports() {
  return safe(() => client.get('/api/audit/institution-reports/for-me'), { total: 0, reports: [] })
}

export async function getDFOInstitutionReports() {
  return safe(() => client.get('/api/audit/institution-reports/for-dfo'), { total: 0, reports: [] })
}

export async function decideDFOReport(reportId, decision, notes = '') {
  return safe(() => client.post(`/api/audit/institution-report/${reportId}/decide`, { decision, notes }), null)
}

// ── USER ──────────────────────────────────────────────────────────────────────

export async function getUser() {
  return safe(() => client.get('/api/user/profile'), null)
}

export async function completeProfile(profileData) {
  const res = await client.put('/api/user/complete-profile', profileData)
  return res.data
}

export async function updateBank(bankData) {
  const res = await client.patch('/api/user/bank', bankData)
  return res.data
}

export async function completeKYC() {
  const res = await client.post('/api/user/kyc')
  return res.data
}

export async function faceVerifyKYC(facePhoto) {
  const res = await client.post('/api/user/face-kyc', { face_photo: facePhoto })
  return res.data
}

export async function uploadFaceReference(facePhoto) {
  const res = await client.post('/api/user/upload-face', { face_photo: facePhoto })
  return res.data
}

export async function getUserSchemes() {
  return safe(() => client.get('/api/user/schemes'), { count: 0, schemes: [] })
}

export async function getUserPayments() {
  return safe(() => client.get('/api/user/payments'), { count: 0, payments: [] })
}

export async function getEligibleSchemes() {
  return safe(() => client.get('/api/user/eligible-schemes'), { eligible: [] })
}

export async function getSchemePreferences() {
  return safe(() => client.get('/api/user/scheme-preferences'), { opted_in_scheme_ids: [], opted_in_schemes: [], count: 0 })
}

export async function optInScheme(schemeId) {
  const res = await client.post(`/api/user/schemes/${schemeId}/opt-in`)
  return res.data
}

export async function optOutScheme(schemeId) {
  const res = await client.post(`/api/user/schemes/${schemeId}/opt-out`)
  return res.data
}

export async function renewKYC() {
  return completeKYC()
}

// ── AADHAAR VERIFICATION ──────────────────────────────────────────────────────

export async function aadhaarSendOTP(aadhaarNumber) {
  const res = await client.post('/api/aadhaar/send-otp', { aadhaar_number: aadhaarNumber })
  return res.data
}

export async function aadhaarVerifyOTP(transactionId, otp) {
  const res = await client.post('/api/aadhaar/verify-otp', { transaction_id: transactionId, otp })
  return res.data
}

export async function aadhaarApiStatus() {
  return safe(() => client.get('/api/aadhaar/status'), { configured: false, demo_aadhaar: '999999990019', demo_otp: '123456' })
}

// ── IFSC LOOKUP (Razorpay public API — no auth needed) ────────────────────────

export async function lookupIFSC(ifsc) {
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`)
    if (!res.ok) return null
    return res.json()  // { BANK, BRANCH, ADDRESS, CITY, DISTRICT, STATE, CONTACT, IFSC }
  } catch {
    return null
  }
}

// ── Legacy compatibility ──────────────────────────────────────────────────────

export const api = {
  runAnalysis:     () => client.post('/api/run-analysis', { run_id: 'demo-001' }),
  getFlags:        () => client.get('/api/flags'),
  getFlag:         (id) => client.get(`/api/flag/${id}`),
  updateFlagStatus:(id, status) => client.patch(`/api/flag/${id}/status`, { status }),
  generateEvidence:(id) => client.post(`/api/flag/${id}/generate-evidence`, {}, { timeout: 60000 }),
  getStats:        () => client.get('/api/stats'),
  getReport:       () => client.get('/api/report'),
}

export default client
