import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, KeyRound, ChevronRight, ChevronLeft, Users, Building2, Map, ClipboardCheck, UserCheck, Loader2, AlertCircle, User, Fingerprint } from 'lucide-react'
import { loginOfficer, loginUser, registerUser, getGeography } from '../api'
import { useAuth, DEFAULT_PATHS } from '../contexts/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import LanguageToggle from '../components/LanguageToggle'
import { useLanguage } from '../i18n/LanguageContext'

// ── Officer role configs ─────────────────────────────────────────────────────
const OFFICER_ROLES = [
  { id: 'DFO',             label: 'District Fraud Officer',           icon: ClipboardCheck, accent: 'from-blue-900 to-blue-700',    needsDistrict: true,  needsTaluka: false },
  { id: 'SCHEME_VERIFIER', label: 'Scheme Verifier',                 icon: Users,          accent: 'from-orange-900 to-orange-700', needsDistrict: true,  needsTaluka: true },
  { id: 'AUDIT',           label: 'Audit Officer',                   icon: UserCheck,      accent: 'from-emerald-900 to-emerald-700', needsDistrict: true,  needsTaluka: true },
  { id: 'STATE_ADMIN',     label: 'State Administrator',             icon: Map,            accent: 'from-violet-900 to-violet-700', needsDistrict: false, needsTaluka: false },
]

const BACKEND_TO_FRONTEND = {
  DFO: 'DFO', STATE_ADMIN: 'STATE_ADMIN', AUDIT: 'AUDIT_OFFICER', SCHEME_VERIFIER: 'SCHEME_VERIFIER', USER: 'USER',
}

export default function Login() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  const { t } = useLanguage()

  // ── State ──────────────────────────────────────────────────────────────
  const [step, setStep]             = useState('choose')  // choose | officer-role | officer-district | officer-taluka | officer-password | user-auth
  const [accountType, setAccountType] = useState(null)    // 'officer' | 'user'
  const [userTab, setUserTab]       = useState('login')   // 'login' | 'register'

  // Officer flow state
  const [selectedRole, setSelectedRole]     = useState(null)
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedTaluka, setSelectedTaluka]     = useState('')
  const [password, setPassword]     = useState('')

  // User flow state
  const [aadhaarHash, setAadhaarHash] = useState('')
  const [userName, setUserName]     = useState('')
  const [userEmail, setUserEmail]   = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Common
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [geography, setGeography]   = useState([])

  // Load geography for dropdowns
  useEffect(() => {
    getGeography().then(g => { if (g && g.length) setGeography(g) })
  }, [])

  const currentRole = OFFICER_ROLES.find(r => r.id === selectedRole)
  const districtTalukas = geography.find(g => g.district === selectedDistrict)?.talukas || []

  // ── Navigation helpers ─────────────────────────────────────────────────
  const goBack = () => {
    setError('')
    if (step === 'officer-role' || step === 'user-auth') setStep('choose')
    else if (step === 'officer-district') setStep('officer-role')
    else if (step === 'officer-taluka') setStep('officer-district')
    else if (step === 'officer-password') {
      if (currentRole?.needsTaluka) setStep('officer-taluka')
      else if (currentRole?.needsDistrict) setStep('officer-district')
      else setStep('officer-role')
    }
  }

  // ── Officer login submit ───────────────────────────────────────────────
  const handleOfficerLogin = async () => {
    if (!password) { setError('Password is required'); return }
    setLoading(true); setError('')
    try {
      const data = await loginOfficer(selectedRole, selectedDistrict, selectedTaluka, password)
      const frontendRole = BACKEND_TO_FRONTEND[data.role] || data.role
      authLogin(frontendRole, data)
      navigate(DEFAULT_PATHS[frontendRole] || '/dfo/dashboard', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.detail || 'Login failed')
    } finally { setLoading(false) }
  }

  // ── User login submit ─────────────────────────────────────────────────
  const handleUserLogin = async () => {
    if (!aadhaarHash || !userPassword) { setError('All fields are required'); return }
    setLoading(true); setError('')
    try {
      const data = await loginUser(aadhaarHash, userPassword)
      const frontendRole = BACKEND_TO_FRONTEND[data.role] || data.role
      authLogin(frontendRole, data)
      if (!data.profile_complete) {
        navigate('/user/complete-profile', { replace: true })
      } else {
        navigate(DEFAULT_PATHS[frontendRole] || '/user/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Login failed')
    } finally { setLoading(false) }
  }

  // ── User register submit ──────────────────────────────────────────────
  const handleUserRegister = async () => {
    if (!userName || !userEmail || !aadhaarHash || !userPassword) { setError('All fields are required'); return }
    if (!/^\S+@\S+\.\S+$/.test(userEmail)) { setError('Please enter a valid email address'); return }
    if (userPassword !== confirmPassword) { setError('Passwords do not match'); return }
    if (userPassword.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    try {
      const data = await registerUser(userName, userEmail, aadhaarHash, userPassword)
      if (data.requires_verification) {
        setUserTab('check-email')
      } else {
        // Fallback if backend doesn't do magic link
        authLogin('USER', data)
        navigate('/user/complete-profile', { replace: true })
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Registration failed')
    } finally { setLoading(false) }
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-shell flex font-sans relative">
      {/* Theme + Language toggle */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle variant="navbar" />
        <ThemeToggle variant="navbar" />
      </div>

      {/* Left panel — branding */}
      <div className="hidden lg:flex w-[44%] flex-col justify-between p-12 bg-gradient-to-b from-[#0d1b2a] to-[#1b3a5b] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <Shield className="text-blue-400" size={32} strokeWidth={2} />
            <span className="text-white font-bold text-2xl tracking-tight">EduGuard</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            DBT Leakage<br />Detection System
          </h1>
          <p className="text-blue-200/80 text-sm leading-relaxed max-w-xs">
            Government of Gujarat — Education Department<br />
            Real-time fraud detection for scholarship disbursement.
          </p>
        </div>
        <div className="relative z-10 space-y-3">
          {['4 detection engines', '33 districts covered', 'Real-time monitoring'].map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-blue-300/70 text-xs font-data">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-workspace">
        <div className="w-full max-w-md">

          {/* ── STEP: Choose account type ──────────────────────────────── */}
          {step === 'choose' && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-text-primary tracking-tight">Welcome to EduGuard</h2>
                <p className="text-sm text-text-secondary mt-1 font-data">Choose your account type to continue</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => { setAccountType('officer'); setStep('officer-role') }}
                  className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-border-subtle bg-surface-lowest hover:border-blue-500 hover:bg-tint-blue transition-all text-left group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-900 to-blue-600 flex items-center justify-center">
                    <Shield size={22} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-text-primary">Officer Portal</p>
                    <p className="text-xs text-text-secondary font-data">DFO, Scheme Verifier, Audit Officer, State Admin</p>
                  </div>
                  <ChevronRight size={18} className="text-text-secondary group-hover:text-blue-500 transition-colors" />
                </button>

                <button onClick={() => { setAccountType('user'); setStep('user-auth') }}
                  className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-border-subtle bg-surface-lowest hover:border-emerald-500 hover:bg-tint-emerald transition-all text-left group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-900 to-emerald-600 flex items-center justify-center">
                    <User size={22} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-text-primary">Citizen Portal</p>
                    <p className="text-xs text-text-secondary font-data">Beneficiary login or new registration</p>
                  </div>
                  <ChevronRight size={18} className="text-text-secondary group-hover:text-emerald-500 transition-colors" />
                </button>
              </div>
            </>
          )}

          {/* ── STEP: Officer — choose role ────────────────────────────── */}
          {step === 'officer-role' && (
            <>
              <BackButton onClick={goBack} />
              <div className="mb-6">
                <h2 className="text-xl font-bold text-text-primary">Select Your Role</h2>
                <p className="text-xs text-text-secondary font-data mt-1">Choose your officer designation</p>
              </div>
              <div className="space-y-2">
                {OFFICER_ROLES.map(r => {
                  const Icon = r.icon
                  return (
                    <button key={r.id} onClick={() => {
                      setSelectedRole(r.id); setError('')
                      if (!r.needsDistrict && !r.needsTaluka) setStep('officer-password')
                      else setStep('officer-district')
                    }}
                      className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-border-subtle bg-surface-lowest hover:border-primary-override hover:bg-tint-blue transition-all text-left group">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${r.accent} flex items-center justify-center`}>
                        <Icon size={16} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-text-primary">{r.label}</p>
                      </div>
                      <ChevronRight size={16} className="text-text-secondary" />
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── STEP: Officer — choose district ────────────────────────── */}
          {step === 'officer-district' && (
            <>
              <BackButton onClick={goBack} />
              <div className="mb-6">
                <h2 className="text-xl font-bold text-text-primary">Select District</h2>
                <p className="text-xs text-text-secondary font-data mt-1">{currentRole?.label}</p>
              </div>
              <select value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setSelectedTaluka(''); setError('') }}
                className="w-full p-3 bg-surface-lowest border border-border-subtle rounded-lg text-sm text-text-primary font-data outline-none focus:ring-2 focus:ring-primary-override/30 mb-4">
                <option value="">— Choose your district —</option>
                {geography.map(g => <option key={g.district} value={g.district}>{g.district}</option>)}
              </select>
              {selectedDistrict && (
                <button onClick={() => {
                  if (!selectedDistrict) { setError('Please select a district'); return }
                  if (currentRole?.needsTaluka) setStep('officer-taluka')
                  else setStep('officer-password')
                }}
                  className="w-full py-3 bg-gradient-to-b from-primary-override to-blue-900 text-white text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2">
                  Continue <ChevronRight size={16} />
                </button>
              )}
            </>
          )}

          {/* ── STEP: Officer — choose taluka ──────────────────────────── */}
          {step === 'officer-taluka' && (
            <>
              <BackButton onClick={goBack} />
              <div className="mb-6">
                <h2 className="text-xl font-bold text-text-primary">Select Taluka</h2>
                <p className="text-xs text-text-secondary font-data mt-1">{currentRole?.label} · {selectedDistrict}</p>
              </div>
              <select value={selectedTaluka} onChange={e => { setSelectedTaluka(e.target.value); setError('') }}
                className="w-full p-3 bg-surface-lowest border border-border-subtle rounded-lg text-sm text-text-primary font-data outline-none focus:ring-2 focus:ring-primary-override/30 mb-4">
                <option value="">— Choose your taluka —</option>
                {districtTalukas.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {selectedTaluka && (
                <button onClick={() => setStep('officer-password')}
                  className="w-full py-3 bg-gradient-to-b from-primary-override to-blue-900 text-white text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2">
                  Continue <ChevronRight size={16} />
                </button>
              )}
            </>
          )}

          {/* ── STEP: Officer — enter password ─────────────────────────── */}
          {step === 'officer-password' && (
            <>
              <BackButton onClick={goBack} />
              <div className="mb-6">
                <h2 className="text-xl font-bold text-text-primary">Enter Password</h2>
                <p className="text-xs text-text-secondary font-data mt-1">
                  {currentRole?.label}
                  {selectedDistrict && ` · ${selectedDistrict}`}
                  {selectedTaluka && ` · ${selectedTaluka}`}
                </p>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                  <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-4 py-3 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30"
                    onKeyDown={e => e.key === 'Enter' && handleOfficerLogin()}
                  />
                </div>
                <ErrorMessage error={error} />
                <button onClick={handleOfficerLogin} disabled={loading}
                  className="w-full py-3 bg-gradient-to-b from-primary-override to-blue-900 text-white text-sm font-bold rounded-lg shadow hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                  {loading ? 'Authenticating…' : 'Sign In'}
                </button>
              </div>
            </>
          )}

          {/* ── STEP: User — login or register ─────────────────────────── */}
          {step === 'user-auth' && (
            <>
              <BackButton onClick={goBack} />
              <div className="mb-6">
                <h2 className="text-xl font-bold text-text-primary">Citizen Portal</h2>
                <p className="text-xs text-text-secondary font-data mt-1">Login to your account or create a new one</p>
              </div>

              {/* Tabs */}
              {userTab !== 'check-email' && (
              <div className="flex mb-6 bg-surface-low rounded-lg p-1">
                <button onClick={() => { setUserTab('login'); setError('') }}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${userTab === 'login' ? 'bg-surface-lowest text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>
                  Login
                </button>
                <button onClick={() => { setUserTab('register'); setError('') }}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${userTab === 'register' ? 'bg-surface-lowest text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>
                  Register
                </button>
              </div>
              )}

              <div className="space-y-4">
                {userTab === 'check-email' ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-700 to-blue-900 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-surface-lowest">
                      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-text-primary mb-2">Check Your Email</h3>
                    <p className="text-sm text-text-secondary">We've sent a magic link to <strong className="text-text-primary">{userEmail}</strong>. Please click the link within 15 minutes to verify your account and complete your profile.</p>
                    <button onClick={() => { setUserTab('login'); setError('') }}
                      className="mt-6 w-full py-3 border border-border-subtle bg-surface-low text-text-primary text-sm font-bold rounded-lg hover:bg-surface-medium transition-all">
                      Return to Login
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Aadhaar hash field (both tabs) */}
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Aadhaar Number</label>
                      <div className="relative">
                        <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                        <input type="text" value={aadhaarHash} onChange={e => { setAadhaarHash(e.target.value); setError('') }}
                          placeholder="Enter your 12-digit Aadhaar"
                          maxLength={12}
                          className="w-full pl-10 pr-4 py-3 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30"
                        />
                      </div>
                    </div>

                    {/* Name (register only) */}
                    {userTab === 'register' && (
                      <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Full Name (as per Aadhaar)</label>
                        <input type="text" value={userName} onChange={e => { setUserName(e.target.value); setError('') }}
                          placeholder="Enter your full name"
                          className="w-full px-4 py-3 bg-surface-lowest border border-border-subtle text-sm text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30"
                        />
                      </div>
                    )}

                    {/* Email (register only) */}
                    {userTab === 'register' && (
                      <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Email Address</label>
                        <input type="email" value={userEmail} onChange={e => { setUserEmail(e.target.value); setError('') }}
                          placeholder="yourname@gmail.com"
                          className="w-full px-4 py-3 bg-surface-lowest border border-border-subtle text-sm text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30"
                        />
                      </div>
                    )}

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Password</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                        <input type="password" value={userPassword} onChange={e => { setUserPassword(e.target.value); setError('') }}
                          placeholder={userTab === 'register' ? 'Create a password (min 6 chars)' : 'Enter your password'}
                          className="w-full pl-10 pr-4 py-3 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30"
                          onKeyDown={e => e.key === 'Enter' && userTab === 'login' && handleUserLogin()}
                        />
                      </div>
                    </div>

                    {/* Confirm password (register only) */}
                    {userTab === 'register' && (
                      <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Confirm Password</label>
                        <input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                          placeholder="Re-enter your password"
                          className="w-full px-4 py-3 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30"
                          onKeyDown={e => e.key === 'Enter' && handleUserRegister()}
                        />
                      </div>
                    )}

                    <ErrorMessage error={error} />

                    {userTab === 'login' ? (
                      <button onClick={handleUserLogin} disabled={loading}
                        className="w-full py-3 bg-gradient-to-b from-emerald-700 to-emerald-900 text-white text-sm font-bold rounded-lg shadow hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                        {loading ? 'Signing in…' : 'Sign In'}
                      </button>
                    ) : (
                      <button onClick={handleUserRegister} disabled={loading}
                        className="w-full py-3 bg-gradient-to-b from-emerald-700 to-emerald-900 text-white text-sm font-bold rounded-lg shadow hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                        {loading ? 'Creating account…' : 'Create Account'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          <p className="text-[10px] font-mono text-text-secondary/40 text-center mt-6 uppercase leading-relaxed">
            Government of Gujarat · Education Department · Authorised access only
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Small components ─────────────────────────────────────────────────────────

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary mb-4 transition-colors font-data">
      <ChevronLeft size={14} /> Back
    </button>
  )
}

function ErrorMessage({ error }) {
  if (!error) return null
  return (
    <div className="flex items-center gap-2 bg-tint-red border border-border-subtle rounded-lg px-3 py-2">
      <AlertCircle size={14} className="text-risk-critical flex-shrink-0" />
      <p className="text-xs text-risk-critical font-data">{error}</p>
    </div>
  )
}
