import { useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Shield, LayoutDashboard, List, Map, FileText, Building2, AlertTriangle, BookOpen, BarChart3, LogOut, UserCircle, CheckCircle, ChevronDown, User, Megaphone, MessageSquare } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import LanguageToggle from './LanguageToggle'
import { useLanguage } from '../i18n/LanguageContext'

const DFO_NAV = [
  { path: '/dfo/dashboard',            label: 'Overview',            labelKey: 'sidebar.overview',         icon: LayoutDashboard },
  { path: '/dfo/queue',                label: 'Investigation Queue', labelKey: 'sidebar.investigationQueue', icon: List },
  { path: '/dfo/institution-reports',  label: 'Audit Reports',       labelKey: 'sidebar.auditReports',      icon: FileText },
  { path: '/dfo/flagged-institutions', label: 'Flagged Institutions',labelKey: 'sidebar.flaggedInstitutions', icon: AlertTriangle },
  { path: '/dfo/complaints',           label: 'Public Complaints',   labelKey: 'sidebar.complaints',         icon: MessageSquare },
]

const ADMIN_NAV = [
  { path: '/admin/gujarat-map',      label: 'Gujarat Heatmap',  labelKey: 'sidebar.gujaratHeatmap',  icon: Map },
  { path: '/admin/district-overview',label: 'District Overview', labelKey: 'sidebar.districtOverview', icon: BarChart3 },
  { path: '/admin/rules-engine',     label: 'Rules Engine',     labelKey: 'sidebar.rulesEngine',     icon: BookOpen },
  { path: '/admin/announcements',    label: 'Announcements',    icon: Megaphone },
]

const AUDIT_NAV = [
  { path: '/audit/overview',       label: 'Overview',          labelKey: 'sidebar.overview',        icon: LayoutDashboard },
  { path: '/audit/middlemen', label: 'Middlemen',  labelKey: 'sidebar.middlemen', icon: List },
  { path: '/audit/report',         label: 'Generate Report',   labelKey: 'sidebar.generateReport',  icon: FileText },
]

const VERIFIER_NAV = [
  { path: '/verifier/my-cases',    label: 'My Open Cases',     labelKey: 'sidebar.myOpenCases',     icon: List },
  { path: '/verifier/closed',      label: 'Closed Cases',      labelKey: 'sidebar.closedCases',     icon: CheckCircle },
]

const USER_NAV = [
  { path: '/user/dashboard',      label: 'My Dashboard',      labelKey: 'sidebar.myDashboard',     icon: LayoutDashboard },
  { path: '/user/profile',        label: 'My Profile',        icon: UserCircle },
]

const NAV_BY_ROLE = {
  DFO:             DFO_NAV,
  STATE_ADMIN:     ADMIN_NAV,
  AUDIT_OFFICER:   AUDIT_NAV,
  SCHEME_VERIFIER: VERIFIER_NAV,
  USER:            USER_NAV,
}

const SIDEBAR_BG = {
  DFO:             'bg-[#121a2f]',
  STATE_ADMIN:     'bg-shell',
  AUDIT_OFFICER:   'bg-shell',
  SCHEME_VERIFIER: 'bg-shell',
  USER:            'bg-shell',
}

const ACTIVE_CLASS = {
  DFO:             'bg-white/10 text-white',
  STATE_ADMIN:     'bg-white/10 text-white',
  AUDIT_OFFICER:   'bg-white/10 text-white',
  SCHEME_VERIFIER: 'bg-white/10 text-white',
  USER:            'bg-white/10 text-white',
}

export default function Sidebar({ role, officer, onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const navItems    = NAV_BY_ROLE[role] || DFO_NAV
  const sidebarBg   = SIDEBAR_BG[role]   || 'bg-[#121a2f]'
  const activeClass = ACTIVE_CLASS[role]  || 'bg-white/10 text-white'

  const [width, setWidth] = useState(256)

  const startResizing = useCallback((e) => {
    e.preventDefault()
    
    const handleMouseMove = (moveEvent) => {
      setWidth(Math.min(Math.max(200, moveEvent.clientX), 480))
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'default'
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
  }, [])

  return (
    <aside 
      style={{ width: `${width}px` }}
      className={`shrink-0 ${sidebarBg} text-white flex flex-col shadow-2xl z-10 relative border-r border-border-subtle`}
    >
      {/* Resizer Handle */}
      <div 
        onMouseDown={startResizing}
        className="absolute top-0 -right-1.5 w-3 h-full cursor-col-resize hover:bg-blue-500/20 z-50 transition-colors"
      />

      {/* Profile Header */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {officer?.avatar ? (
              <img src={officer.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={20} className="text-white/60" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-white/60 font-sans leading-none truncate">{t(`roles.${role}`) || 'District Fraud Officer'} -</span>
            <span className="text-sm font-sans font-medium text-white leading-tight mt-0.5 truncate">{officer?.name || 'Divya Patel'}</span>
          </div>
        </div>
      </div>

      {/* Brand */}
      <div className="px-5 py-6 flex items-start gap-3">
        <Shield className="text-white/90 mt-1 flex-shrink-0" size={32} strokeWidth={2} />
        <div className="min-w-0">
          <span className="font-bold text-xl tracking-tight font-sans text-white block leading-none mb-1 truncate">{t('sidebar.brand') || 'EduGuard'}</span>
          <p className="text-[10px] text-white/60 leading-tight font-sans line-clamp-2">
            {t('common.govGujarat') || 'Government of Gujarat'}<br />{t('common.dbtLeakage') || 'DBT Leakage Detection'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto mt-2">
        {navItems.map(item => {
          const Icon   = item.icon
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all rounded-lg font-sans overflow-hidden
                ${active
                  ? activeClass
                  : 'text-white/65 hover:bg-white/5 hover:text-white'
                }`}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
              <span className={`truncate ${active ? 'font-semibold' : 'font-medium'}`}>{t(item.labelKey) || item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 space-y-2">
        <LanguageToggle variant="sidebar" />
        <ThemeToggle variant="sidebar" />
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/65 hover:text-white hover:bg-white/5 rounded-lg transition-all font-sans overflow-hidden"
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span className="truncate">{t('common.signOut') || 'Sign out'}</span>
        </button>
      </div>
    </aside>
  )
}
