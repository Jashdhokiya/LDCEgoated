import { Shield, LayoutDashboard, List, Map, FileText, Building2, AlertTriangle, BookOpen, BarChart3, LogOut, UserCircle } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import LanguageToggle from './LanguageToggle'
import { useLanguage } from '../i18n/LanguageContext'

const DFO_NAV = [
  { id: 'dashboard',            labelKey: 'sidebar.overview',            icon: LayoutDashboard },
  { id: 'queue',                labelKey: 'sidebar.investigationQueue',  icon: List },
  { id: 'middlemen',            labelKey: 'sidebar.middlemen',           icon: Building2 },
  { id: 'flagged-institutions', labelKey: 'sidebar.flaggedInstitutions', icon: AlertTriangle },
  { id: 'heatmap',              labelKey: 'sidebar.riskHeatmap',         icon: Map },
  { id: 'report',               labelKey: 'sidebar.auditReport',         icon: FileText },
]

const ADMIN_NAV = [
  { id: 'gujarat-map',      labelKey: 'sidebar.gujaratHeatmap',  icon: Map },
  { id: 'district-overview',labelKey: 'sidebar.districtOverview', icon: BarChart3 },
  { id: 'rules-engine',     labelKey: 'sidebar.rulesEngine',     icon: BookOpen },
]

const AUDIT_NAV = [
  { id: 'audit-overview', labelKey: 'sidebar.overview',          icon: LayoutDashboard },
  { id: 'report',         labelKey: 'sidebar.generateReport',   icon: FileText },
  { id: 'verifier-queue', labelKey: 'sidebar.verifierReports',  icon: List },
]

const VERIFIER_NAV = [
  { id: 'my-cases',       labelKey: 'sidebar.myOpenCases',     icon: List },
]

const USER_NAV = [
  { id: 'user-dashboard', labelKey: 'sidebar.myDashboard',      icon: UserCircle },
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

export default function Sidebar({ activePage, onNavigate, role, onLogout }) {
  const { t } = useLanguage()
  const navItems    = NAV_BY_ROLE[role] || DFO_NAV
  const accentDot   = ROLE_ACCENT[role]  || 'bg-blue-500'
  const sidebarBg   = SIDEBAR_BG[role]   || 'bg-shell'
  const activeClass = ACTIVE_CLASS[role]  || 'border-blue-400 text-white'

  return (
    <aside className={`w-64 ${sidebarBg} text-text-inverse flex flex-col shadow-2xl z-10 relative`}>
      {/* Brand */}
      <div className="p-5 pt-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="text-blue-400" size={26} strokeWidth={2.5} />
          <span className="font-bold text-xl tracking-tight font-sans">{t('sidebar.brand')}</span>
        </div>
        <p className="text-xs text-white/50 leading-relaxed font-data">
          {t('common.govGujarat')}<br />{t('common.dbtLeakage')}
        </p>
      </div>

      {/* Role badge */}
      <div className="mx-5 mt-2 mb-4 px-3 py-2 bg-surface-lowest/5 border border-white/10 rounded-md flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${accentDot} flex-shrink-0`} />
        <span className="text-xs text-white/90 font-mono truncate">{t(`roles.${role}`)}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon   = item.icon
          const active = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all rounded-md font-sans border-l-2
                ${active
                  ? `bg-surface-lowest/10 ${activeClass} border-l-2`
                  : 'text-white/55 hover:bg-surface-lowest/5 hover:text-white border-transparent'
                }`}
            >
              <Icon size={17} strokeWidth={active ? 2.5 : 2} />
              <span className={active ? 'font-semibold' : 'font-medium'}>{t(item.labelKey)}</span>
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
          {t('common.signOut')}
        </button>
        <p className="text-[10px] text-white/25 font-data mt-2 px-3">{t('common.systemReady')}</p>
      </div>
    </aside>
  )
}
