import { Shield, ArrowRight, BarChart3, Map, CheckCircle, BookOpen, Users } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import LanguageToggle from '../components/LanguageToggle'
import { useLanguage } from '../i18n/LanguageContext'

export default function LandingPage({ onEnter }) {
  const { t } = useLanguage()

  const FEATURES = [
    { icon: BarChart3, titleKey: 'landing.feature1Title', descKey: 'landing.feature1Desc' },
    { icon: Map, titleKey: 'landing.feature2Title', descKey: 'landing.feature2Desc' },
    { icon: CheckCircle, titleKey: 'landing.feature3Title', descKey: 'landing.feature3Desc' },
    { icon: BookOpen, titleKey: 'landing.feature4Title', descKey: 'landing.feature4Desc' },
  ]

  const ROLES = [
    { labelKey: 'landing.roleUser', descKey: 'landing.roleUserDesc', color: 'bg-gray-500' },
    { labelKey: 'landing.roleDFO', descKey: 'landing.roleDFODesc', color: 'bg-blue-700' },
    { labelKey: 'landing.roleAdmin', descKey: 'landing.roleAdminDesc', color: 'bg-violet-700' },
    { labelKey: 'landing.roleVerifier', descKey: 'landing.roleVerifierDesc', color: 'bg-orange-600' },
    { labelKey: 'landing.roleAudit', descKey: 'landing.roleAuditDesc', color: 'bg-emerald-700' },
  ]

  return (
    <div className="min-h-screen bg-surface-lowest font-sans text-text-primary flex flex-col">
      {/* Top Banner (State Colors) */}
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-[#FF9933]"></div>
        <div className="flex-1 bg-surface-lowest"></div>
        <div className="flex-1 bg-[#138808]"></div>
      </div>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-border-subtle bg-surface-lowest shadow-sm">
        <div className="flex items-center gap-3">
          <Shield className="text-primary-override" size={28} strokeWidth={2.5} />
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight text-primary-override leading-tight">EduGuard DBT</span>
            <span className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">{t('common.govGujarat')}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:block text-xs text-text-secondary font-medium tracking-wide">
            {t('common.deptEducation')}
          </span>
          <LanguageToggle variant="navbar" />
          <ThemeToggle variant="navbar" />
          <button
            onClick={onEnter}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-override hover:bg-blue-900 text-white text-sm font-semibold rounded transition-colors"
          >
            {t('landing.accessPortal')} <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1">
        <section className="px-6 py-24 text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-primary-override tracking-tight mb-6 leading-tight">
            {t('landing.title')} <br /> {t('landing.titleLine2')}
          </h1>
          <p className="text-lg md:text-xl text-text-secondary leading-relaxed mb-10 max-w-3xl mx-auto">
            {t('landing.subtitle')}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onEnter}
              className="flex items-center gap-2 px-8 py-3.5 bg-primary-override hover:bg-blue-900 text-white font-semibold rounded transition-colors text-base shadow-sm hover:shadow-md"
            >
              {t('landing.loginToDashboard')} <ArrowRight size={18} />
            </button>
            <a href="#features" className="px-8 py-3.5 border border-border-subtle hover:border-gray-400 text-text-secondary font-medium rounded transition-colors text-base bg-surface-lowest hover:bg-surface-low">
              {t('landing.learnMore')}
            </a>
          </div>
        </section>

        {/* Stats bar */}
        <section className="bg-primary-override py-12 border-y border-blue-900">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 px-8 text-center">
            {[
              { value: '8,087', labelKey: 'landing.statBeneficiaries' },
              { value: '₹2.7Cr', labelKey: 'landing.statAnomalies' },
              { value: '185', labelKey: 'landing.statFlags' },
              { value: '33', labelKey: 'landing.statDistricts' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center">
                <p className="text-4xl font-bold text-white mb-2">{s.value}</p>
                <p className="text-sm text-blue-200 font-medium tracking-wide uppercase">{t(s.labelKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-8 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-override mb-4">{t('landing.coreCapabilities')}</h2>
            <p className="text-text-secondary max-w-2xl mx-auto">{t('landing.coreCapabilitiesDesc')}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="flex gap-6 p-8 bg-surface-lowest border border-border-subtle rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 rounded-full bg-tint-blue flex items-center justify-center flex-shrink-0 border border-border-subtle">
                    <Icon size={28} className="text-primary-override" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary text-xl mb-3">{t(f.titleKey)}</h3>
                    <p className="text-text-secondary leading-relaxed">{t(f.descKey)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="py-20 px-8 bg-surface-low border-t border-border-subtle">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-primary-override mb-4">{t('landing.accessControl')}</h2>
              <p className="text-text-secondary">{t('landing.accessControlDesc')}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              {ROLES.map((r, i) => (
                <div key={i} className="flex items-start gap-4 p-5 bg-surface-lowest border border-border-subtle rounded-xl shadow-sm w-full md:w-[340px]">
                  <div className={`w-3.5 h-3.5 rounded-full mt-1.5 flex-shrink-0 ${r.color}`} />
                  <div>
                    <p className="font-semibold text-text-primary text-lg mb-1">{t(r.labelKey)}</p>
                    <p className="text-sm text-text-secondary leading-relaxed">{t(r.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-lowest py-10 border-t border-border-subtle text-center px-6">
        <Shield className="text-gray-300 mx-auto mb-4" size={32} />
        <p className="text-sm text-text-secondary font-semibold mb-2 uppercase tracking-wider">
          {t('landing.footerGov')}
        </p>
        <p className="text-xs text-text-secondary mb-1">
          {t('landing.footerPlatform')}
        </p>
        <p className="text-xs text-gray-400">
          {t('landing.footerWarning')}
        </p>
      </footer>
    </div>
  )
}
