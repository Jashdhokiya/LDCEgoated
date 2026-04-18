import { useLocation, useNavigate } from 'react-router-dom'
import { Shield, LayoutDashboard, List, Map, FileText, Building2, AlertTriangle, BookOpen, BarChart3, LogOut, UserCircle } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import LanguageToggle from './LanguageToggle'
import { useLanguage } from '../i18n/LanguageContext'

const DFO_NAV = [
  { path: '/dfo/dashboard',            label: 'Overview',            labelKey: 'sidebar.overview',         icon: LayoutDashboard },
  { path: '/dfo/queue',                label: 'Investigation Queue', labelKey: 'sidebar.investigationQueue', icon: List },
  { path: '/dfo/middlemen',            label: 'Middlemen',           labelKey: 'sidebar.middlemen',        icon: Building2 },
  { path: '/dfo/flagged-institutions', label: 'Flagged Institutions',labelKey: 'sidebar.flaggedInstitutions', icon: AlertTriangle },
  { path: '/dfo/heatmap',              label: 'Risk Heatmap',        labelKey: 'sidebar.riskHeatmap',      icon: Map },
  { path: '/dfo/report',               label: 'Audit Report',        labelKey: 'sidebar.auditReport',      icon: FileText },
]

const ADMIN_NAV = [
  { path: '/admin/gujarat-map',      label: 'Gujarat Heatmap',  labelKey: 'sidebar.gujaratHeatmap',  icon: Map },
  { path: '/admin/district-overview',label: 'District Overview', labelKey: 'sidebar.districtOverview', icon: BarChart3 },
  { path: '/admin/rules-engine',     label: 'Rules Engine',     labelKey: 'sidebar.rulesEngine',     icon: BookOpen },
]

const AUDIT_NAV = [
  { path: '/audit/overview',       label: 'Overview',          labelKey: 'sidebar.overview',        icon: LayoutDashboard },
  { path: '/audit/report',         label: 'Generate Report',   labelKey: 'sidebar.generateReport',  icon: FileText },
  { path: '/audit/verifier-queue', label: 'Verifier Reports',  labelKey: 'sidebar.verifierReports', icon: List },
]

const VERIFIER_NAV = [
  { path: '/verifier/my-cases',    label: 'My Open Cases',     labelKey: 'sidebar.myOpenCases',     icon: List },
]

const USER_NAV = [
  { path: '/user/dashboard',      label: 'My Dashboard',      labelKey: 'sidebar.myDashboard',     icon: UserCircle },
]

const NAV_BY_ROLE = {
  DFO:             DFO_NAV,
  STATE_ADMIN:     ADMIN_NAV,
  AUDIT_OFFICER:   AUDIT_NAV,
  SCHEME_VERIFIER: VERIFIER_NAV,
  USER:            USER_NAV,
}

const ROLE_ACCENT = {
  DFO:             'bg-blue-500',
  STATE_ADMIN:     'bg-violet-500',
  AUDIT_OFFICER:   'bg-emerald-500',
  SCHEME_VERIFIER: 'bg-orange-500',
  USER:            'bg-gray-500',
}

const SIDEBAR_BG = {
  DFO:             'bg-shell',
  STATE_ADMIN:     'bg-shell',
  AUDIT_OFFICER:   'bg-shell',
  SCHEME_VERIFIER: 'bg-shell',
  USER:            'bg-shell',
}

const ACTIVE_CLASS = {
  DFO:             'border-blue-400 text-white',
  STATE_ADMIN:     'border-violet-400 text-white',
  AUDIT_OFFICER:   'border-emerald-400 text-white',
  SCHEME_VERIFIER: 'border-orange-400 text-white',
  USER:            'border-gray-400 text-white',
}

export default function Sidebar({ role, officer, onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const navItems    = NAV_BY_ROLE[role] || DFO_NAV
  const accentDot   = ROLE_ACCENT[role]  || 'bg-blue-500'
  const sidebarBg   = SIDEBAR_BG[role]   || 'bg-shell'
  const activeClass = ACTIVE_CLASS[role]  || 'border-blue-400 text-white'

  // Build the role badge label dynamically from officer data
  const district = officer?.district
  const roleName = t(`roles.${role}`) || role
  const badgeLabel = district ? `${roleName} — ${district}` : roleName

  return (
    <aside className={`w-64 ${sidebarBg} text-text-inverse flex flex-col shadow-2xl z-10 relative`}>
      {/* Brand */}
      <div className="p-5 pt-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="text-blue-400" size={26} strokeWidth={2.5} />
          <span className="font-bold text-xl tracking-tight font-sans">{t('sidebar.brand') || 'EduGuard'}</span>
        </div>
        <p className="text-xs text-white/50 leading-relaxed font-data">
          {t('common.govGujarat') || 'Government of Gujarat'}<br />{t('common.dbtLeakage') || 'DBT Leakage Detection'}
        </p>
      </div>

      {/* Role badge — shows actual officer name + district */}
      <div className="mx-5 mt-2 mb-4 px-3 py-2 bg-surface-lowest/5 border border-white/10 rounded-md">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${accentDot} flex-shrink-0`} />
          <span className="text-xs text-white/90 font-mono truncate">{badgeLabel}</span>
        </div>
        {officer?.name && (
          <p className="text-[10px] text-white/50 font-data mt-1 ml-4 truncate">{officer.name}</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon   = item.icon
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all rounded-md font-sans border-l-2
                ${active
                  ? `bg-surface-lowest/10 ${activeClass} border-l-2`
                  : 'text-white/55 hover:bg-surface-lowest/5 hover:text-white border-transparent'
                }`}
            >
              <Icon size={17} strokeWidth={active ? 2.5 : 2} />
              <span className={active ? 'font-semibold' : 'font-medium'}>{t(item.labelKey) || item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 space-y-0.5">
        <LanguageToggle variant="sidebar" />
        <ThemeToggle variant="sidebar" />
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/40 hover:text-white/70 hover:bg-surface-lowest/5 rounded-md transition-all font-data"
        >
          <LogOut size={14} />
          {t('common.signOut') || 'Sign out'}
        </button>
        <p className="text-[10px] text-white/25 font-data mt-2 px-3">{t('common.systemReady') || 'AY 2024–25 · System Ready'}</p>
      </div>
    </aside>
  )
}
