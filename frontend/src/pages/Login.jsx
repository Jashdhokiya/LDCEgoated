import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, KeyRound, ChevronRight, ChevronLeft, Users, Map, ClipboardCheck, UserCheck, Loader2, AlertCircle, User, Fingerprint } from 'lucide-react'
import { loginOfficer, loginUser, registerUser, getGeography } from '../api'
import { useAuth, DEFAULT_PATHS } from '../contexts/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import LanguageToggle from '../components/LanguageToggle'
import { useLanguage } from '../i18n/LanguageContext'
import gujaratMap from '../assets/GJ_MAP_LOGIN_PAGE.png'

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
  const [userTab, setUserTab]       = useState('login')   // 'login' | 'register'

  // Officer flow state
  const [selectedRole, setSelectedRole]     = useState(null)
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedTaluka, setSelectedTaluka]     = useState('')
  const [password, setPassword]     = useState('')

  // User flow state
  const [aadhaarHash, setAadhaarHash] = useState('')
  const [userName, setUserName]     = useState('')
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
  const currentRoleLabel = currentRole ? t(`login.officerRoles.${currentRole.id}`) : ''

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
    if (!password) { setError(t('login.passwordRequired')); return }
    setLoading(true); setError('')
    try {
      const data = await loginOfficer(selectedRole, selectedDistrict, selectedTaluka, password)
      const frontendRole = BACKEND_TO_FRONTEND[data.role] || data.role
      authLogin(frontendRole, data)
      navigate(DEFAULT_PATHS[frontendRole] || '/dfo/dashboard', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.detail || t('login.loginFailed'))
    } finally { setLoading(false) }
  }

  // ── User login submit ─────────────────────────────────────────────────
  const handleUserLogin = async () => {
    if (!aadhaarHash || !userPassword) { setError(t('login.allFieldsRequired')); return }
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
      setError(err?.response?.data?.detail || t('login.loginFailed'))
    } finally { setLoading(false) }
  }

  // ── User register submit ──────────────────────────────────────────────
  const handleUserRegister = async () => {
    if (!userName || !aadhaarHash || !userPassword) { setError(t('login.allFieldsRequired')); return }
    if (userPassword !== confirmPassword) { setError(t('login.passwordMismatch')); return }
    if (userPassword.length < 6) { setError(t('login.passwordMinLength')); return }
    setLoading(true); setError('')
    try {
      const data = await registerUser(userName, aadhaarHash, userPassword)
      authLogin('USER', data)
      navigate('/user/complete-profile', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.detail || t('login.registrationFailed'))
    } finally { setLoading(false) }
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div className="login-page min-h-screen bg-shell flex font-sans relative overflow-hidden">
      <div className="login-bg-orb login-bg-orb--one" aria-hidden="true" />
      <div className="login-bg-orb login-bg-orb--two" aria-hidden="true" />
      <div className="login-bg-grid" aria-hidden="true" />

      {/* Theme + Language toggle */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle variant="navbar" />
        <ThemeToggle variant="navbar" />
      </div>

      {/* Left panel — branding */}
      <div className="hidden lg:flex w-[44%] flex-col justify-between p-12 login-brand-panel relative overflow-hidden bg-[#0A1128]">
        {/* Map Background */}
        <img 
          src={gujaratMap}
          alt=""
          className="absolute z-0 pointer-events-none blur-[2px] opacity-50 mix-blend-screen"
          style={{
            top: '40%',
            right: '-15%',
            transform: 'translateY(-50%) scale(0.95)',
            height: '95%',
            width: 'auto',
            objectFit: 'contain'
          }}
        />
        <div className="login-brand-noise z-0" />
        <div className="relative z-10 login-enter login-enter--1">
          <span className="login-security-pill">{t('login.authNetwork')}</span>
          <div className="flex items-center gap-3 mb-16">
            <Shield className="text-blue-400" size={32} strokeWidth={2} />
            <span className="text-white font-bold text-2xl tracking-tight">EduGuard</span>
          </div>
          <h1 className="login-brand-title text-4xl font-bold text-white leading-tight mb-4">
            {t('login.brandTitleMain')}<br />{t('login.brandTitleSub')}
          </h1>
          <p className="text-blue-200/80 text-sm leading-relaxed max-w-xs">
            {t('login.govEdDept')}<br />
            {t('login.realTimeFraudDesc')}
          </p>
        </div>
        <div className="relative z-10 space-y-3 login-enter login-enter--2">
          {[t('login.statEngines'), t('login.statDistricts'), t('login.statMonitoring')].map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-blue-300/70 text-xs font-data">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-workspace/90 login-workspace-panel">
        <div className="w-full max-w-lg">
          <div className="login-card-shell login-enter login-enter--1">
            <div className="mb-5">
              <p className="login-card-kicker">{t('login.accessConsole')}</p>
            </div>

          {/* ── STEP: Choose account type ──────────────────────────────── */}
          {step === 'choose' && (
            <>
              <BackButton onClick={() => navigate('/')} />
              <div className="mb-8">
                <h2 className="login-heading text-3xl font-bold text-text-primary tracking-tight">{t('login.welcome')}</h2>
                <p className="text-sm text-text-secondary mt-1 font-data">{t('login.chooseAccountType')}</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => { setStep('officer-role') }}
                  className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-border-subtle bg-surface-lowest hover:border-blue-500 hover:bg-tint-blue transition-all text-left group login-portal-card">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-900 to-blue-600 flex items-center justify-center">
                    <Shield size={22} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-text-primary">{t('login.officerPortal')}</p>
                    <p className="text-xs text-text-secondary font-data">{t('login.officerPortalDesc')}</p>
                  </div>
                  <ChevronRight size={18} className="text-text-secondary group-hover:text-blue-500 transition-colors" />
                </button>

                <button onClick={() => { setStep('user-auth') }}
                  className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-border-subtle bg-surface-lowest hover:border-emerald-500 hover:bg-tint-emerald transition-all text-left group login-portal-card">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-900 to-emerald-600 flex items-center justify-center">
                    <User size={22} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-text-primary">{t('login.citizenPortal')}</p>
                    <p className="text-xs text-text-secondary font-data">{t('login.citizenPortalDesc')}</p>
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
                <h2 className="text-xl font-bold text-text-primary">{t('login.selectYourRole')}</h2>
                <p className="text-xs text-text-secondary font-data mt-1">{t('login.chooseOfficerDesignation')}</p>
              </div>
              <div className="space-y-2">
                {OFFICER_ROLES.map(r => {
                  const Icon = r.icon
                  const roleLabel = t(`login.officerRoles.${r.id}`)
                  return (
                    <button key={r.id} onClick={() => {
                      setSelectedRole(r.id); setError('')
                      if (!r.needsDistrict && !r.needsTaluka) setStep('officer-password')
                      else setStep('officer-district')
                    }}
                        className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-border-subtle bg-surface-lowest hover:border-primary-override hover:bg-tint-blue transition-all text-left group login-portal-card">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${r.accent} flex items-center justify-center`}>
                        <Icon size={16} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-text-primary">{roleLabel}</p>
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
                <h2 className="text-xl font-bold text-text-primary">{t('login.selectDistrict')}</h2>
                <p className="text-xs text-text-secondary font-data mt-1">{currentRoleLabel}</p>
              </div>
              <select value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setSelectedTaluka(''); setError('') }}
                className="w-full p-3 bg-surface-lowest border border-border-subtle rounded-lg text-sm text-text-primary font-data outline-none focus:ring-2 focus:ring-primary-override/30 mb-4">
                <option value="">— {t('login.chooseDistrict')} —</option>
                {geography.map(g => <option key={g.district} value={g.district}>{g.district}</option>)}
              </select>
              {selectedDistrict && (
                <button onClick={() => {
                  if (!selectedDistrict) { setError(t('login.selectDistrictError')); return }
                  if (currentRole?.needsTaluka) setStep('officer-taluka')
                  else setStep('officer-password')
                }}
                  className="w-full py-3 bg-gradient-to-b from-primary-override to-blue-900 text-white text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2">
                  {t('login.continue')} <ChevronRight size={16} />
                </button>
              )}
            </>
          )}

          {/* ── STEP: Officer — choose taluka ──────────────────────────── */}
          {step === 'officer-taluka' && (
            <>
              <BackButton onClick={goBack} />
              <div className="mb-6">
                <h2 className="text-xl font-bold text-text-primary">{t('login.selectTaluka')}</h2>
                <p className="text-xs text-text-secondary font-data mt-1">{currentRoleLabel} · {selectedDistrict}</p>
              </div>
              <select value={selectedTaluka} onChange={e => { setSelectedTaluka(e.target.value); setError('') }}
                className="w-full p-3 bg-surface-lowest border border-border-subtle rounded-lg text-sm text-text-primary font-data outline-none focus:ring-2 focus:ring-primary-override/30 mb-4">
                <option value="">— {t('login.chooseTaluka')} —</option>
                {districtTalukas.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {selectedTaluka && (
                <button onClick={() => setStep('officer-password')}
                  className="w-full py-3 bg-gradient-to-b from-primary-override to-blue-900 text-white text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2">
                  {t('login.continue')} <ChevronRight size={16} />
                </button>
              )}
            </>
          )}

          {/* ── STEP: Officer — enter password ─────────────────────────── */}
          {step === 'officer-password' && (
            <>
              <BackButton onClick={goBack} />
              <div className="mb-6">
                <h2 className="text-xl font-bold text-text-primary">{t('login.enterPassword')}</h2>
                <p className="text-xs text-text-secondary font-data mt-1">
                  {currentRoleLabel}
                  {selectedDistrict && ` · ${selectedDistrict}`}
                  {selectedTaluka && ` · ${selectedTaluka}`}
                </p>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                  <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder={t('login.enterPasswordPlaceholder')}
                    className="w-full pl-10 pr-4 py-3 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30"
                    onKeyDown={e => e.key === 'Enter' && handleOfficerLogin()}
                  />
                </div>
                <ErrorMessage error={error} />
                <button onClick={handleOfficerLogin} disabled={loading}
                    className="w-full py-3 bg-gradient-to-b from-primary-override to-blue-900 text-white text-sm font-bold rounded-lg shadow hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 login-cta-button">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                  {loading ? t('login.authenticating') : t('login.signIn')}
                </button>
              </div>
            </>
          )}

          {/* ── STEP: User — login or register ─────────────────────────── */}
          {step === 'user-auth' && (
            <>
              <BackButton onClick={goBack} />
              <div className="mb-6">
                <h2 className="text-xl font-bold text-text-primary">{t('login.citizenPortal')}</h2>
                <p className="text-xs text-text-secondary font-data mt-1">{t('login.citizenAuthDesc')}</p>
              </div>

              {/* Tabs */}
              <div className="flex mb-6 bg-surface-low rounded-lg p-1">
                <button onClick={() => { setUserTab('login'); setError('') }}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${userTab === 'login' ? 'bg-surface-lowest text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>
                  {t('login.loginTab')}
                </button>
                <button onClick={() => { setUserTab('register'); setError('') }}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${userTab === 'register' ? 'bg-surface-lowest text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>
                  {t('login.registerTab')}
                </button>
              </div>

              <div className="space-y-4">
                {/* Aadhaar hash field (both tabs) */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('login.aadhaarNumber')}</label>
                  <div className="relative">
                    <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                    <input type="text" value={aadhaarHash} onChange={e => { setAadhaarHash(e.target.value); setError('') }}
                      placeholder={t('login.aadhaarPlaceholder')}
                      maxLength={12}
                      className="w-full pl-10 pr-4 py-3 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30"
                    />
                  </div>
                </div>

                {/* Name (register only) */}
                {userTab === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('login.fullNameAsPerAadhaar')}</label>
                    <input type="text" value={userName} onChange={e => { setUserName(e.target.value); setError('') }}
                      placeholder={t('login.fullNamePlaceholder')}
                      className="w-full px-4 py-3 bg-surface-lowest border border-border-subtle text-sm text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30"
                    />
                  </div>
                )}

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('login.passwordLabel')}</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                    <input type="password" value={userPassword} onChange={e => { setUserPassword(e.target.value); setError('') }}
                      placeholder={userTab === 'register' ? t('login.passwordCreatePlaceholder') : t('login.enterPasswordPlaceholder')}
                      className="w-full pl-10 pr-4 py-3 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30"
                      onKeyDown={e => e.key === 'Enter' && userTab === 'login' && handleUserLogin()}
                    />
                  </div>
                </div>

                {/* Confirm password (register only) */}
                {userTab === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('login.confirmPassword')}</label>
                    <input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                      placeholder={t('login.reenterPassword')}
                      className="w-full px-4 py-3 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30"
                      onKeyDown={e => e.key === 'Enter' && handleUserRegister()}
                    />
                  </div>
                )}

                <ErrorMessage error={error} />

                {userTab === 'login' ? (
                  <button onClick={handleUserLogin} disabled={loading}
                    className="w-full py-3 bg-gradient-to-b from-emerald-700 to-emerald-900 text-white text-sm font-bold rounded-lg shadow hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 login-cta-button">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                    {loading ? t('login.signingIn') : t('login.signIn')}
                  </button>
                ) : (
                  <button onClick={handleUserRegister} disabled={loading}
                    className="w-full py-3 bg-gradient-to-b from-emerald-700 to-emerald-900 text-white text-sm font-bold rounded-lg shadow hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 login-cta-button">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                    {loading ? t('login.creatingAccount') : t('login.createAccount')}
                  </button>
                )}
              </div>
            </>
          )}

          <p className="text-[10px] font-mono text-text-secondary/40 text-center mt-6 uppercase leading-relaxed">
            {t('common.govGujarat')} · {t('common.deptEducation')} · {t('login.authorizedAccessOnly')}
          </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Small components ─────────────────────────────────────────────────────────

function BackButton({ onClick }) {
  const { t } = useLanguage()

  return (
    <button onClick={onClick} className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary mb-4 transition-colors font-data">
      <ChevronLeft size={14} /> {t('common.back')}
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
