import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, KeyRound, ChevronRight, Users, Building2, Map, ClipboardCheck, UserCheck, Mail, Loader2, AlertCircle } from 'lucide-react'
import { login } from '../api'
import { useAuth, DEFAULT_PATHS } from '../contexts/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import LanguageToggle from '../components/LanguageToggle'
import { useLanguage } from '../i18n/LanguageContext'

const ROLES = [
  {
    id: 'DFO',
    titleKey: 'login.roleDFO',
    subtitleKey: 'login.roleDFOSub',
    icon: ClipboardCheck,
    accent: 'from-blue-900 to-blue-700',
    border: 'border-blue-700',
    badge: 'bg-tint-blue text-primary-override',
    jurisdiction: 'Ahmedabad District',
  },
  {
    id: 'STATE_ADMIN',
    titleKey: 'login.roleAdmin',
    subtitleKey: 'login.roleAdminSub',
    icon: Map,
    accent: 'from-violet-900 to-violet-700',
    border: 'border-violet-600',
    badge: 'bg-tint-violet text-text-primary',
    jurisdiction: 'Gujarat State',
  },
  {
    id: 'AUDIT',
    titleKey: 'login.roleAudit',
    subtitleKey: 'login.roleAuditSub',
    icon: UserCheck,
    accent: 'from-emerald-900 to-emerald-700',
    border: 'border-emerald-600',
    badge: 'bg-tint-emerald text-emerald-600 dark:text-emerald-400',
    jurisdiction: 'State Audit Cell',
  },
  {
    id: 'SCHEME_VERIFIER',
    titleKey: 'login.roleVerifier',
    subtitleKey: 'login.roleVerifierSub',
    icon: Users,
    accent: 'from-orange-900 to-orange-700',
    border: 'border-orange-600',
    badge: 'bg-tint-orange text-risk-high',
    jurisdiction: 'Ahmedabad District',
  },
  {
    id: 'USER',
    titleKey: 'login.roleUser',
    subtitleKey: 'login.roleUserSub',
    icon: Building2,
    accent: 'from-gray-700 to-gray-600',
    border: 'border-border-subtle',
    badge: 'bg-surface-low text-text-secondary',
    jurisdiction: 'Sanand, Ahmedabad',
  },
]

// map from ROLES id → demo credentials
const DEMO_CREDS = {
  DFO:            { email: 'dfo@eduguard.in',      password: 'dfo@1234' },
  STATE_ADMIN:    { email: 'admin@eduguard.in',    password: 'admin@1234' },
  AUDIT:          { email: 'audit@eduguard.in',    password: 'audit@1234' },
  SCHEME_VERIFIER:{ email: 'verifier@eduguard.in', password: 'verifier@1234' },
  USER:           { email: 'user@eduguard.in',     password: 'user@1234' },
}

export default function Login() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  const { t } = useLanguage()
  const [selectedRole, setSelectedRole] = useState('DFO')
  const [email, setEmail]     = useState('dfo@eduguard.in')
  const [password, setPassword] = useState('dfo@1234')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // When user picks a role, auto-fill demo credentials
  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId)
    const creds = DEMO_CREDS[roleId]
    if (creds) {
      setEmail(creds.email)
      setPassword(creds.password)
    }
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError(t('login.emailRequired'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await login(email.trim().toLowerCase(), password)
      // Map backend roles to frontend role IDs
      const backendToFrontend = {
        DFO:            'DFO',
        STATE_ADMIN:    'STATE_ADMIN',
        AUDIT:          'AUDIT_OFFICER',
        SCHEME_VERIFIER:'SCHEME_VERIFIER',
        USER:           'USER',
      }
      const frontendRole = backendToFrontend[data.role] || data.role
      authLogin(frontendRole, data)
      navigate(DEFAULT_PATHS[frontendRole] || '/dfo/dashboard', { replace: true })
    } catch (err) {
      const msg = err?.response?.data?.detail || t('login.loginFailed')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const role = ROLES.find(r => r.id === selectedRole)
  return (
    <div className="min-h-screen bg-shell flex font-sans relative">
      {/* Theme + Language toggle — floating top-right */}
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
            <span className="text-white font-bold text-2xl tracking-tight">{t('login.brandTitle')}</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            {t('login.brandHeadline')}<br />{t('login.brandHeadlineLine2')}
          </h1>
          <p className="text-blue-200/80 text-sm leading-relaxed max-w-xs">
            {t('login.brandDesc')}
          </p>
        </div>
        <div className="relative z-10 space-y-3">
          {[t('login.stat1'), t('login.stat2'), t('login.stat3')].map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-blue-300/70 text-xs font-data">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              {s}
            </div>
          ))}
          <p className="text-blue-400/40 text-[10px] font-mono pt-4 uppercase tracking-widest">
            {t('login.brandFooter')}
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-workspace">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">{t('login.selectRole')}</h2>
            <p className="text-sm text-text-secondary mt-1 font-data">{t('login.selectRoleDesc')}</p>
          </div>

          {/* Role selector grid */}
          <div className="space-y-2 mb-8">
            {ROLES.map((r) => {
              const Icon = r.icon
              const active = selectedRole === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleRoleSelect(r.id)}
                  className={`w-full flex items-center gap-4 p-3.5 rounded-lg border-2 text-left transition-all ${
                    active
                      ? `border-primary-override bg-tint-blue shadow-sm`
                      : 'border-border-subtle bg-surface-lowest hover:border-border-subtle hover:bg-surface-low'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${r.accent} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={16} className="text-white" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${active ? 'text-primary-override' : 'text-text-primary'}`}>{t(r.titleKey)}</p>
                    <p className="text-xs text-text-secondary font-data truncate">{t(r.subtitleKey)}</p>
                  </div>
                  {active && <ChevronRight size={16} className="text-primary-override flex-shrink-0" />}
                </button>
              )
            })}
          </div>

          {/* Auth form */}
          <form onSubmit={handleSubmit} className="bg-surface-lowest rounded-xl shadow-sm border border-border-subtle p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${role.accent}`} />
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest font-data">{t(role.titleKey)}</span>
              <span className="text-xs text-text-secondary font-data">· {role.jurisdiction}</span>
            </div>

            {/* Email field */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('login.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="officer@eduguard.in"
                  className="w-full pl-9 pr-4 py-2.5 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30 focus:border-primary-override transition-all"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('login.password')}</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="Enter key (or leave blank)"
                  className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30 focus:border-primary-override transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-tint-red border border-border-subtle rounded-lg px-3 py-2">
                <AlertCircle size={14} className="text-risk-critical flex-shrink-0" />
                <p className="text-xs text-risk-critical font-data">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-b from-primary-override to-shell text-white text-sm font-bold rounded-lg shadow hover:shadow-lg hover:from-blue-900 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              {loading ? t('login.authenticating') : t('login.authenticate')}
            </button>

            <p className="text-[10px] text-text-secondary/50 font-data text-center">
              {t('login.autoFill')}
            </p>
          </form>

          <p className="text-[10px] font-mono text-text-secondary/40 text-center mt-6 uppercase leading-relaxed">
            {t('login.warning')}
          </p>
        </div>
      </div>
    </div>
  )
}
