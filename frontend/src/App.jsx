import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth, DEFAULT_PATHS } from './contexts/AuthContext'
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
import CompleteProfile from './pages/user/CompleteProfile'

// Audit Officer
import AuditOfficerDashboard from './pages/audit/AuditOfficerDashboard'
import AuditVerifierQueue from './pages/audit/AuditVerifierQueue'

// Scheme Verifier
import SchemeVerifierDashboard from './pages/verifier/SchemeVerifierDashboard'
import SubmitEvidence from './pages/verifier/SubmitEvidence'

// ── Loading spinner shown while session is being restored ────────────────
function LoadingScreen() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-shell flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-blue-300 text-sm font-data">{t('common.restoring') || 'Restoring session…'}</p>
      </div>
    </div>
  )
}

// ── Redirects authenticated users away from public pages ─────────────────
function PublicRoute({ children }) {
  const { role, loading, officer } = useAuth()
  if (loading) return <LoadingScreen />
  if (role) {
    // If user role and profile not complete, send to complete-profile
    if (role === 'USER' && !officer?.profile_complete) {
      return <Navigate to="/user/complete-profile" replace />
    }
    return <Navigate to={DEFAULT_PATHS[role] || '/dfo/dashboard'} replace />
  }
  return children
}

// ── Wraps all authenticated routes with sidebar + auth check ─────────────
function ProtectedLayout() {
  const { role, officer, logout, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!role) return <Navigate to="/login" replace />

  // If USER and profile not complete, force profile completion
  if (role === 'USER' && !officer?.profile_complete) {
    return <Navigate to="/user/complete-profile" replace />
  }

  return (
    <div className="flex h-screen bg-workspace text-text-primary">
      <Sidebar role={role} officer={officer} onLogout={logout} />
      <main className="flex-1 overflow-auto bg-workspace">
        <Outlet />
      </main>
    </div>
  )
}

// ── Profile completion guard (allows access only if logged in but profile incomplete)
function ProfileCompletionGuard({ children }) {
  const { role, officer, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!role) return <Navigate to="/login" replace />
  // If profile is already complete, go to dashboard
  if (role === 'USER' && officer?.profile_complete) {
    return <Navigate to="/user/dashboard" replace />
  }
  // If not USER role, go to their dashboard
  if (role !== 'USER') {
    return <Navigate to={DEFAULT_PATHS[role]} replace />
  }
  return children
}

// ── Root App ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Profile completion — outside sidebar layout */}
      <Route path="/user/complete-profile" element={
        <ProfileCompletionGuard><CompleteProfile /></ProfileCompletionGuard>
      } />

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
        <Route path="/audit/verifier-queue" element={<AuditVerifierQueue />} />

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
