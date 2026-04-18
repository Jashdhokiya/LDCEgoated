import { useState, useEffect } from 'react'
import { useLanguage } from './i18n/LanguageContext'
import Sidebar from './components/Sidebar'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'

// DFO
import Dashboard from './pages/dfo/Dashboard'
import InvestigationQueue from './pages/dfo/InvestigationQueue'
import CaseDetail from './pages/dfo/CaseDetail'
import Heatmap from './pages/dfo/Heatmap'
import AuditReport from './pages/dfo/AuditReport'
import MiddlemenList from './pages/dfo/MiddlemenList'
import FlaggedInstitutions from './pages/dfo/FlaggedInstitutions'

// State Admin
import GujaratHeatmap from './pages/admin/GujaratHeatmap'
import RulesEngine from './pages/admin/RulesEngine'
import DistrictOverview from './pages/admin/DistrictOverview'

// General User
import UserDashboard from './pages/user/UserDashboard'

// Audit Officer
import AuditOfficerDashboard from './pages/audit/AuditOfficerDashboard'

// Scheme Verifier
import SchemeVerifierDashboard from './pages/verifier/SchemeVerifierDashboard'
import SubmitEvidence from './pages/verifier/SubmitEvidence'

const DEFAULT_PAGE = {
  DFO:             'dashboard',
  STATE_ADMIN:     'gujarat-map',
  AUDIT_OFFICER:   'audit-overview',
  SCHEME_VERIFIER: 'my-cases',
  USER:            'user-dashboard',
}

export default function App() {
  const { t } = useLanguage()
  // Start restoring immediately if token exists — prevents flash to landing
  const [stage, setStage] = useState(() => tokenStore.get() ? 'restoring' : 'landing')
  const [role, setRole]   = useState(null)
  const [officer, setOfficer] = useState(null)  // decoded JWT payload
  const [activePage, setActivePage] = useState('dashboard')
  const [selectedFlagId, setSelectedFlagId] = useState(null)
  const [analysisData, setAnalysisData]     = useState(null)
  const [selectedVerifierCase, setSelectedVerifierCase] = useState(null)

  // ── Restore session from localStorage on page load ────────────────────
  useEffect(() => {
    const storedUser = tokenStore.getUser()
    const token = tokenStore.get()
    if (token && storedUser) {
      const backendToFrontend = {
        DFO: 'DFO', STATE_ADMIN: 'STATE_ADMIN',
        AUDIT: 'AUDIT_OFFICER', SCHEME_VERIFIER: 'SCHEME_VERIFIER', USER: 'USER',
      }
      const frontendRole = backendToFrontend[storedUser.role] || storedUser.role
      // Validate token server-side in background
      getMe().then(me => {
        if (me?.role) {
          setOfficer(storedUser)
          setRole(frontendRole)
          setActivePage(DEFAULT_PAGE[frontendRole] || 'dashboard')
          setStage('app')
        } else {
          tokenStore.clear()
          setStage('landing')
        }
      }).catch(() => { tokenStore.clear(); setStage('landing') })
    } else if (stage === 'restoring') {
      // Token was missing or invalid — go to landing
      setStage('landing')
    }

    // Listen for token expiry (emitted by axios 401 interceptor)
    const onExpired = () => {
      setRole(null)
      setOfficer(null)
      setActivePage('dashboard')
      setAnalysisData(null)
      setStage('login')
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  const handleLogin = (selectedRole, data) => {
    setRole(selectedRole)
    setOfficer(data || null)
    setActivePage(DEFAULT_PAGE[selectedRole] || 'dashboard')
    setStage('app')
  }

  const handleLogout = async () => {
    await apiLogout()
    setRole(null)
    setOfficer(null)
    setActivePage('dashboard')
    setAnalysisData(null)
    setStage('landing')
  }

  const openCase = (flagId) => {
    setSelectedFlagId(flagId)
    setActivePage('case')
  }

  // ── Restoring session — show brief loading ────────────────────────────
  if (stage === 'restoring') return (
    <div className="min-h-screen bg-shell flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-blue-300 text-sm font-data">{t('common.restoring')}</p>
      </div>
    </div>
  )
}

// ── Redirects authenticated users away from public pages ─────────────────
function PublicRoute({ children }) {
  const { role, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (role) return <Navigate to={DEFAULT_PATHS[role] || '/dfo/dashboard'} replace />
  return children
}

// ── Wraps all authenticated routes with sidebar + auth check ─────────────
function ProtectedLayout() {
  const { role, officer, logout, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!role) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen bg-workspace text-text-primary">
      <Sidebar role={role} officer={officer} onLogout={logout} />
      <main className="flex-1 overflow-auto bg-workspace">
        <Outlet />
      </main>
    </div>
  )
}

// ── Root App ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Protected routes — all share sidebar layout */}
      <Route element={<ProtectedLayout />}>
        {/* DFO */}
        <Route path="/dfo/dashboard" element={<Dashboard />} />
        <Route path="/dfo/queue" element={<InvestigationQueue />} />
        <Route path="/dfo/case/:flagId" element={<CaseDetail />} />
        <Route path="/dfo/heatmap" element={<Heatmap />} />
        <Route path="/dfo/report" element={<AuditReport />} />
        <Route path="/dfo/middlemen" element={<MiddlemenList />} />
        <Route path="/dfo/flagged-institutions" element={<FlaggedInstitutions />} />

        {/* State Admin */}
        <Route path="/admin/gujarat-map" element={<GujaratHeatmap />} />
        <Route path="/admin/rules-engine" element={<RulesEngine />} />
        <Route path="/admin/district-overview" element={<DistrictOverview />} />

        {/* Audit Officer */}
        <Route path="/audit/overview" element={<AuditOfficerDashboard />} />
        <Route path="/audit/report" element={<AuditReport />} />
        <Route path="/audit/verifier-queue" element={<InvestigationQueue />} />

        {/* Scheme Verifier */}
        <Route path="/verifier/my-cases" element={<SchemeVerifierDashboard />} />
        <Route path="/verifier/submit-evidence" element={<SubmitEvidence />} />

        {/* General User */}
        <Route path="/user/dashboard" element={<UserDashboard />} />
      </Route>

      {/* Catch-all → landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
