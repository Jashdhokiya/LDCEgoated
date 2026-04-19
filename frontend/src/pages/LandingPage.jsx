import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, ArrowRight, BarChart3, Map, CheckCircle, BookOpen, Users, SearchCheck, Flag, MapPin } from 'lucide-react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import * as topojson from 'topojson-client'
import ThemeToggle from '../components/ThemeToggle'
import LanguageToggle from '../components/LanguageToggle'
import { useLanguage } from '../i18n/LanguageContext'
import { getLandingStats } from '../api'

export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [countProgress, setCountProgress] = useState(0)
  const [stats, setStats] = useState({
    beneficiaries: 0,
    total_amount_at_risk: 0,
    flags: 0,
    districts: 0,
  })
  const [heroMapGeo, setHeroMapGeo] = useState(null)

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

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const data = await getLandingStats()
      if (!mounted || !data) return
      setStats({
        beneficiaries: Number(data.beneficiaries || 0),
        total_amount_at_risk: Number(data.total_amount_at_risk || 0),
        flags: Number(data.flags || 0),
        districts: Number(data.districts || 0),
      })
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    fetch('/gujarat.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((topo) => {
        if (!mounted || !topo?.objects?.gujarat) return
        const geo = topojson.feature(topo, topo.objects.gujarat)
        setHeroMapGeo(geo)
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const hasData =
      stats.beneficiaries > 0 ||
      stats.total_amount_at_risk > 0 ||
      stats.flags > 0 ||
      stats.districts > 0

    if (!hasData) {
      setCountProgress(0)
      return
    }

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCountProgress(1)
      return
    }

    let rafId = 0
    const durationMs = 1200
    const start = performance.now()

    const tick = (now) => {
      const elapsed = now - start
      const linear = Math.min(elapsed / durationMs, 1)
      // Ease-out for a smooth finish.
      const eased = 1 - Math.pow(1 - linear, 3)
      setCountProgress(eased)
      if (linear < 1) {
        rafId = requestAnimationFrame(tick)
      }
    }

    setCountProgress(0)
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [stats])

  const displayStats = useMemo(() => {
    const animatedBeneficiaries = Math.round(stats.beneficiaries * countProgress)
    const animatedRiskLakh = Math.round((stats.total_amount_at_risk * countProgress) / 100000)
    const animatedFlags = Math.round(stats.flags * countProgress)
    const animatedDistricts = Math.round(stats.districts * countProgress)

    return [
      {
        value: animatedBeneficiaries.toLocaleString('en-IN'),
        labelKey: 'landing.statBeneficiaries',
        icon: Users,
      },
      {
        value: `₹${animatedRiskLakh.toLocaleString('en-IN')} Lakh`,
        labelKey: 'landing.statAnomalies',
        icon: SearchCheck,
      },
      {
        value: animatedFlags.toLocaleString('en-IN'),
        labelKey: 'landing.statFlags',
        icon: Flag,
      },
      {
        value: animatedDistricts.toLocaleString('en-IN'),
        labelKey: 'landing.statDistricts',
        icon: MapPin,
      },
    ]
  }, [stats, countProgress])

  return (
    <div className="landing-page min-h-screen bg-surface-lowest font-sans text-text-primary flex flex-col">

      {/* Top Banner (State Colors) */}
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-[#FF9933] dark:bg-[#FF9933]"></div>
        <div className="flex-1 bg-white dark:bg-white"></div>
        <div className="flex-1 bg-[#138808] dark:bg-[#138808]"></div>
      </div>

      {/* Nav */}
      <nav className="landing-fade-in flex items-center justify-between px-5 md:px-8 py-4 border-b border-border-subtle bg-surface-lowest shadow-sm">
        <div className="flex items-center gap-3">
          <Shield className="text-primary-override" size={28} strokeWidth={2.5} />
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight text-primary-override leading-tight">EduGuard DBT</span>
            <span className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">{t('common.govGujarat')}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <LanguageToggle variant="navbar" />
          <ThemeToggle variant="navbar" />
          <button
            onClick={() => navigate('/login')}
            className="landing-button flex items-center gap-2 px-5 py-2.5 bg-primary-override hover:brightness-110 text-white text-sm font-semibold rounded transition"
          >
            {t('landing.accessPortal')} <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1">
        <section className="landing-hero-panel relative overflow-hidden">
          <div className="landing-hero-map" aria-hidden="true">
            {heroMapGeo && (
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ center: [71.5, 22.4], scale: 4300 }}
                width={1120}
                height={760}
                style={{ width: '100%', height: '100%' }}
              >
                <Geographies geography={heroMapGeo}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        style={{
                          default: { fill: '#dbe8f6', stroke: '#adc2dd', strokeWidth: 0.9, outline: 'none' },
                          hover: { fill: '#dbe8f6', stroke: '#adc2dd', strokeWidth: 0.9, outline: 'none' },
                          pressed: { fill: '#dbe8f6', stroke: '#adc2dd', strokeWidth: 0.9, outline: 'none' },
                        }}
                      />
                    ))
                  }
                </Geographies>
              </ComposableMap>
            )}
          </div>

          <div className="landing-hero relative px-6 py-20 md:py-24 text-center max-w-5xl mx-auto">
            <h1 className="landing-hero-title text-4xl md:text-6xl font-bold text-[#0d1320] tracking-tight mb-6 leading-tight">
              {t('landing.title')} <br /> {t('landing.titleLine2')}
            </h1>
            <p className="landing-hero-subtitle text-lg md:text-xl text-text-secondary leading-relaxed mb-10 max-w-3xl mx-auto">
              {t('landing.subtitle')}
            </p>
            <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="landing-button flex items-center gap-2 px-8 py-3.5 bg-primary-override hover:brightness-110 text-white font-semibold rounded transition text-base shadow-sm hover:shadow-md"
            >
              {t('landing.loginToDashboard')} <ArrowRight size={18} />
            </button>
            <a href="#features" className="landing-button px-8 py-3.5 border border-primary-override/60 hover:brightness-95 text-primary-override font-semibold rounded transition text-base bg-surface-lowest hover:bg-surface-low">
              {t('landing.learnMore')}
            </a>
          </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="landing-reveal landing-stats-strip py-10 border-y border-border-subtle" style={{ animationDelay: '120ms' }}>
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 px-8 text-left">
            {displayStats.map((s, i) => (
              <div key={i} className="landing-stat flex items-center gap-4" style={{ animationDelay: `${180 + i * 90}ms` }}>
                <div className="w-12 h-12 rounded-full border border-white/35 text-white flex items-center justify-center flex-shrink-0">
                  <s.icon size={26} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-5xl leading-none font-bold text-white mb-1">{s.value}</p>
                  <p className="text-sm text-white/85 font-medium tracking-wide uppercase">{t(s.labelKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="landing-reveal py-24 px-8 max-w-6xl mx-auto" style={{ animationDelay: '160ms' }}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-override mb-4">{t('landing.coreCapabilities')}</h2>
            <p className="text-text-secondary max-w-2xl mx-auto">{t('landing.coreCapabilitiesDesc')}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="landing-feature-card flex gap-6 p-8 bg-surface-lowest border border-border-subtle rounded-xl shadow-sm hover:shadow-md transition-shadow" style={{ animationDelay: `${220 + i * 90}ms` }}>
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
        <section id="roles" className="landing-reveal py-20 px-8 bg-surface-low border-t border-border-subtle" style={{ animationDelay: '200ms' }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-primary-override mb-4">{t('landing.accessControl')}</h2>
              <p className="text-text-secondary">{t('landing.accessControlDesc')}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              {ROLES.map((r, i) => (
                <div key={i} className="landing-role-card flex items-start gap-4 p-5 bg-surface-lowest border border-border-subtle rounded-xl shadow-sm w-full md:w-[340px]" style={{ animationDelay: `${250 + i * 70}ms` }}>
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
      <footer className="landing-reveal bg-surface-lowest py-10 border-t border-border-subtle text-center px-6" style={{ animationDelay: '240ms' }}>
        <Shield className="text-text-secondary mx-auto mb-4" size={32} />
        <p className="text-sm text-text-secondary font-semibold mb-2 uppercase tracking-wider">
          {t('landing.footerGov')}
        </p>
        <p className="text-xs text-text-secondary mb-1">
          {t('landing.footerPlatform')}
        </p>
        <p className="text-xs text-text-secondary/80">
          {t('landing.footerWarning')}
        </p>
      </footer>
    </div>
  )
}
