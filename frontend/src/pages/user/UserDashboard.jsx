import { useState, useRef, useEffect } from 'react'
import { CheckCircle, Clock, AlertTriangle, FileCheck, ChevronRight, RefreshCw, Shield, Camera, User, Phone, MapPin, CreditCard, X, Loader2, Check } from 'lucide-react'
import { getUser, renewKYC } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'

const SCHEME_NEWS = [
  { id: 1, title: 'Namo Lakshmi Yojana — Extended Application Window', date: '2026-04-10', tag: 'NEW', body: 'The application deadline for NLY 2025-26 has been extended to 30 April 2026. Eligible girl students in classes 9–12 can now apply.' },
  { id: 2, title: 'MGMS Disbursement Date Announced', date: '2026-04-05', tag: 'UPDATE', body: 'Merit scholarship payments for AY 2025-26 will be credited on 1 May 2026. Ensure your bank details are confirmed.' },
  { id: 3, title: 'KYC Renewal Reminder', date: '2026-03-28', tag: 'REMINDER', body: 'Beneficiaries must renew their KYC before the expiry date to continue receiving benefits. OTP-based verification is now available.' },
  { id: 4, title: 'New Scheme — Namo Saraswati Vigyan Sadhana Yojana', date: '2026-03-15', tag: 'NEW', body: 'A new annual scholarship of ₹10,000 for girl students pursuing Science stream in std 11–12 is now open for registration.' },
]

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: 'bg-tint-emerald text-emerald-600 dark:text-emerald-400 border-border-subtle', dot: 'bg-emerald-500' },
  PENDING_VERIFICATION: { label: 'Pending Review', color: 'bg-tint-yellow text-yellow-600 dark:text-yellow-400 border-border-subtle', dot: 'bg-yellow-500' },
  SUSPENDED: { label: 'Suspended', color: 'bg-tint-red text-risk-critical border-border-subtle', dot: 'bg-red-500' },
}

const TAG_CONFIG = {
  NEW: 'bg-tint-blue text-primary-override',
  UPDATE: 'bg-tint-violet text-text-primary',
  REMINDER: 'bg-tint-orange text-risk-high',
}

// ─── KYC Modal ─────────────────────────────────────────────────────────────────
function KYCModal({ user, onClose, onComplete }) {
  const { t } = useLanguage()
  const [step, setStep] = useState(1) // 1 = review info, 2 = face scan, 3 = done
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const intervalRef = useRef(null)

  const startScan = () => {
    setScanning(true)
    setScanProgress(0)
    intervalRef.current = setInterval(() => {
      setScanProgress(p => {
        if (p >= 100) {
          clearInterval(intervalRef.current)
          setScanning(false)
          setStep(3)
          return 100
        }
        return p + 3
      })
    }, 50)
  }

  const INFO_ROWS = [
    { icon: User, label: t('userDashboard.fullName'), value: user.full_name },
    { icon: CreditCard, label: t('userDashboard.aadhaar'), value: user.aadhaar_display },
    { icon: Phone, label: t('userDashboard.mobile'), value: user.phone },
    { icon: MapPin, label: t('userDashboard.address'), value: `${user.demographics.taluka}, ${user.demographics.district}` },
    { icon: Shield, label: t('userDashboard.category'), value: user.demographics.category },
    { icon: CreditCard, label: t('userDashboard.bankAccount'), value: `${user.bank.bank} · ${user.bank.account_display}` },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface-lowest rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-low">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-primary-override" />
            <div>
              <h2 className="font-bold text-text-primary font-sans text-sm">{t('userDashboard.kycRenewal')}</h2>
              <p className="text-xs text-text-secondary font-data">{t('userDashboard.step')} {step} {t('userDashboard.of')} 3</p>
            </div>
          </div>
          {step !== 2 && (
            <button onClick={onClose} className="text-text-secondary hover:text-text-secondary transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-1">
          {[t('userDashboard.verifyInfo'), t('userDashboard.faceScan'), t('userDashboard.complete')].map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-full flex flex-col items-center`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-all ${
                  step > i + 1 ? 'bg-emerald-500 text-white' :
                  step === i + 1 ? 'bg-primary-override text-white' :
                  'bg-surface-low text-text-secondary'
                }`}>
                  {step > i + 1 ? <Check size={14} /> : i + 1}
                </div>
                <span className={`text-[10px] font-data ${step === i + 1 ? 'text-primary-override font-bold' : 'text-text-secondary'}`}>{s}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-px mx-1 mb-5 ${step > i + 1 ? 'bg-emerald-400' : 'bg-surface-low'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Review info */}
        {step === 1 && (
          <div className="px-6 py-5">
            <p className="text-sm font-data text-text-secondary mb-4 leading-relaxed">
              {t('userDashboard.reviewInfo')}
            </p>
            <div className="space-y-3 mb-6">
              {INFO_ROWS.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 bg-surface-low rounded-lg">
                  <Icon size={16} className="text-text-secondary flex-shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <span className="text-xs text-text-secondary font-data">{label}</span>
                    <span className="text-sm font-bold text-text-primary font-sans">{value}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-border-subtle text-sm font-semibold text-text-secondary rounded-xl hover:bg-surface-low transition-all">
                {t('common.cancel')}
              </button>
              <button onClick={() => setStep(2)} className="flex-1 py-2.5 bg-primary-override text-white text-sm font-bold rounded-xl hover:bg-blue-900 transition-all">
                {t('userDashboard.confirmContinue')}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Face scan */}
        {step === 2 && (
          <div className="px-6 py-6 flex flex-col items-center">
            <p className="text-sm font-data text-text-secondary mb-6 text-center">
              {t('userDashboard.faceScanInstructions')}
            </p>

            {/* Camera simulation */}
            <div className="relative w-56 h-56 rounded-2xl overflow-hidden bg-gray-900 mb-6">
              {/* Simulated camera feed */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-28 h-28 rounded-full bg-gray-700 flex items-center justify-center">
                  <User size={48} className="text-text-secondary" />
                </div>
              </div>

              {/* Scanning overlay */}
              {scanning && (
                <>
                  <div className="absolute inset-0 bg-emerald-500/10" />
                  {/* Scan line */}
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.8)]"
                    style={{ top: `${scanProgress}%`, transition: 'top 0.05s linear' }}
                  />
                </>
              )}

              {/* Corner brackets */}
              {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
                <div key={i} className={`absolute w-6 h-6 ${pos} border-emerald-400`} style={{
                  borderTopWidth: i < 2 ? 2 : 0,
                  borderBottomWidth: i >= 2 ? 2 : 0,
                  borderLeftWidth: i % 2 === 0 ? 2 : 0,
                  borderRightWidth: i % 2 === 1 ? 2 : 0,
                }} />
              ))}

              {/* Progress */}
              {scanning && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                  <span className="text-xs font-mono text-emerald-300 bg-black/50 px-2 py-0.5 rounded-full">
                    {scanProgress}% scanned…
                  </span>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {scanning && (
              <div className="w-full h-1.5 bg-surface-low rounded-full overflow-hidden mb-4">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${scanProgress}%` }} />
              </div>
            )}

            <button
              onClick={startScan}
              disabled={scanning}
              className="w-full py-3 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl transition-all text-sm"
            >
              {scanning ? (
                <><Loader2 size={16} className="animate-spin" /> {t('userDashboard.scanningFace')}</>
              ) : (
                <><Camera size={16} /> {t('userDashboard.startFaceVerification')}</>
              )}
            </button>

            <button onClick={onClose} disabled={scanning} className="mt-2 text-xs text-text-secondary hover:text-text-primary font-data transition-colors">
              {t('common.cancel')}
            </button>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="px-6 py-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-tint-emerald flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-text-primary font-sans mb-1">{t('userDashboard.kycSuccess')}</h3>
            <p className="text-sm text-text-secondary font-data leading-relaxed mb-6">
              {t('userDashboard.kycSuccessDesc')}
              <span className="block mt-1 font-bold text-emerald-600">{t('userDashboard.newExpiry')} {new Date(Date.now() + 90 * 86400000).toLocaleDateString('en-IN')}</span>
            </p>
            <button
              onClick={() => { onComplete(); onClose() }}
              className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all text-sm"
            >
              {t('common.done')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── KYC Card ──────────────────────────────────────────────────────────────────
function KYCCard({ kyc, onOpenModal }) {
  const { t } = useLanguage()
  const { is_kyc_compliant, days_remaining, kyc_expiry_date, last_kyc_date } = kyc
  const isExpiringSoon = days_remaining <= 14
  const isExpired = days_remaining <= 0

  return (
    <div className={`rounded-xl p-5 border-2 ${isExpired ? 'border-risk-critical bg-tint-red' : isExpiringSoon ? 'border-yellow-400 bg-tint-yellow' : 'border-emerald-300 bg-tint-emerald'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={20} className={isExpired ? 'text-risk-critical' : isExpiringSoon ? 'text-yellow-600' : 'text-emerald-600'} />
          <h3 className="font-bold text-text-primary font-sans text-sm">{t('userDashboard.kycStatus')}</h3>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${is_kyc_compliant && !isExpired ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-risk-critical text-white border-risk-critical'}`}>
          {isExpired ? t('userDashboard.expired') : is_kyc_compliant ? t('userDashboard.verified') : t('userDashboard.notVerified')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 font-data text-sm">
        <div><p className="text-xs text-text-secondary mb-0.5">{t('userDashboard.lastVerified')}</p><p className="font-bold text-text-primary">{last_kyc_date}</p></div>
        <div><p className="text-xs text-text-secondary mb-0.5">{t('userDashboard.expiresOn')}</p><p className={`font-bold ${isExpiringSoon ? 'text-yellow-700' : 'text-text-primary'}`}>{kyc_expiry_date}</p></div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-surface-lowest/60 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${isExpiringSoon ? 'bg-yellow-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.max(0, (days_remaining / 90) * 100)}%` }} />
        </div>
        <p className="text-xs text-text-secondary font-data mt-1">
          {days_remaining} {t('userDashboard.daysRemaining')}
          {isExpiringSoon && !isExpired && t('userDashboard.renewalRecommended')}
        </p>
      </div>

      <button
        onClick={onOpenModal}
        className={`w-full py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
          isExpired ? 'bg-risk-critical text-white hover:bg-red-700'
          : isExpiringSoon ? 'bg-yellow-600 text-white hover:bg-yellow-700'
          : 'bg-surface-lowest border border-emerald-300 text-emerald-600 dark:text-emerald-400 hover:bg-tint-emerald'
        }`}
      >
        <RefreshCw size={14} />
        {isExpired ? t('userDashboard.renewNow') : isExpiringSoon ? t('userDashboard.renewSoon') : t('userDashboard.updateKyc')}
      </button>
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────────
export default function UserDashboard() {
  const { t } = useLanguage()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showKYCModal, setShowKYCModal] = useState(false)
  const [kycDone, setKycDone] = useState(false)
  const [readNews, setReadNews] = useState(new Set())

  useEffect(() => {
    getUser('USR-GJ-001').then(data => {
      setUser(data)
      setLoading(false)
    })
  }, [])

  const handleKYCComplete = async () => {
    if (user) {
      const res = await renewKYC(user.user_id, user.kyc_profile?.dynamic_validity_days || 90)
      if (res?.success) {
        setUser(prev => ({
          ...prev,
          kyc_profile: { ...prev.kyc_profile, ...res, is_kyc_compliant: true },
        }))
      }
    }
    setKycDone(true)
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <Loader2 size={28} className="animate-spin text-primary-override" />
          <p className="text-sm font-data">{t('userDashboard.loadingDashboard')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 pb-20 font-sans max-w-6xl mx-auto">
      {/* KYC Modal */}
      {showKYCModal && (
        <KYCModal
          user={user}
          onClose={() => setShowKYCModal(false)}
          onComplete={handleKYCComplete}
        />
      )}

      {/* Greeting */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            {t('userDashboard.welcome')} {user.full_name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-text-secondary mt-1 font-data">
            {user.user_id} · {user.demographics.taluka}, {user.demographics.district} · DBT Beneficiary Portal
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* LEFT: KYC + Scheme Tracker */}
        <div className="col-span-2 space-y-6">
          {/* KYC Card */}
          {kycDone ? (
            <div className="rounded-xl p-5 border-2 border-emerald-300 bg-tint-emerald flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-tint-emerald flex items-center justify-center">
                <CheckCircle size={24} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-emerald-700">{t('userDashboard.kycRenewed')}</p>
                <p className="text-xs text-emerald-600 font-data">{t('userDashboard.kycRenewedDesc')}</p>
              </div>
            </div>
          ) : (
            <KYCCard kyc={user.kyc_profile} onOpenModal={() => setShowKYCModal(true)} />
          )}

          {/* Scheme Tracker */}
          <div className="bg-surface-lowest rounded-xl shadow-sm border border-border-subtle overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <h2 className="font-bold text-text-primary font-sans">{t('userDashboard.mySchemeApplications')}</h2>
              <span className="text-xs text-text-secondary font-data">{user.registered_schemes.length} {t('userDashboard.registered')}</span>
            </div>
            <div className="divide-y divide-border-subtle">
              {user.registered_schemes.map(scheme => {
                const cfg = STATUS_CONFIG[scheme.status] || STATUS_CONFIG.ACTIVE
                return (
                  <div key={scheme.scheme_id} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.color}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          <span className="text-xs text-text-secondary font-mono">{scheme.scheme_id}</span>
                        </div>
                        <h3 className="font-bold text-text-primary text-sm leading-snug">{scheme.name}</h3>
                        <p className="text-xs text-text-secondary font-data mt-1">Registered: {scheme.registration_date}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold text-text-primary font-sans">₹{scheme.amount.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-text-secondary font-data">{t('userDashboard.annualBenefit')}</p>
                      </div>
                    </div>

                    {/* Status timeline */}
                    <div className="mt-4 flex items-center gap-1.5">
                      {[
                        { label: t('userDashboard.applied'), done: true },
                        { label: t('userDashboard.verified'), done: scheme.status !== 'PENDING_VERIFICATION' },
                        { label: t('userDashboard.activeStatus'), done: scheme.status === 'ACTIVE' },
                        { label: t('userDashboard.paymentStep'), done: !!scheme.last_payment },
                      ].map((s, i, arr) => (
                        <div key={s.label} className="flex items-center gap-1.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${s.done ? 'bg-emerald-500 text-white' : 'bg-surface-low text-text-secondary'}`}>
                            {s.done ? '✓' : i + 1}
                          </div>
                          <span className={`text-[10px] font-data ${s.done ? 'text-emerald-600 font-bold' : 'text-text-secondary'}`}>{s.label}</span>
                          {i < arr.length - 1 && <div className={`h-px w-3 ${s.done && arr[i+1].done ? 'bg-emerald-400' : 'bg-surface-low'}`} />}
                        </div>
                      ))}
                    </div>

                    {scheme.next_payment && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-primary-override font-data bg-tint-blue px-3 py-1.5 rounded-lg w-fit">
                        <Clock size={11} /> {t('userDashboard.nextPayment')} {scheme.next_payment}
                      </div>
                    )}
                    {scheme.status === 'PENDING_VERIFICATION' && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400 font-data bg-tint-yellow px-3 py-1.5 rounded-lg w-fit">
                        <AlertTriangle size={11} /> {t('userDashboard.underReview')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Scheme News + Quick Actions */}
        <div className="space-y-4">
          <div className="bg-surface-lowest rounded-xl shadow-sm border border-border-subtle overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border-subtle">
              <h2 className="font-bold text-text-primary font-sans text-sm">{t('userDashboard.schemeNews')}</h2>
            </div>
            <div className="divide-y divide-border-subtle">
              {SCHEME_NEWS.map(news => {
                const isRead = readNews.has(news.id)
                return (
                  <button key={news.id} onClick={() => setReadNews(s => new Set([...s, news.id]))}
                    className={`w-full px-5 py-4 text-left hover:bg-surface-low transition-colors ${isRead ? 'opacity-55' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TAG_CONFIG[news.tag] || 'bg-surface-low text-text-secondary'}`}>{news.tag}</span>
                      <span className="text-[10px] font-mono text-text-secondary">{news.date}</span>
                    </div>
                    <p className="text-sm font-bold font-sans text-text-primary leading-snug mb-1">{news.title}</p>
                    <p className="text-xs text-text-secondary font-data leading-relaxed line-clamp-2">{news.body}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-surface-lowest rounded-xl shadow-sm border border-border-subtle overflow-hidden">
            <div className="px-5 py-3 border-b border-border-subtle">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest font-data">{t('userDashboard.quickActions')}</p>
            </div>
            {[
              { label: t('userDashboard.checkEligibility'), icon: FileCheck },
              { label: t('userDashboard.updateBank'), icon: RefreshCw },
              { label: t('userDashboard.contactDFO'), icon: Phone },
            ].map((a, i) => {
              const Icon = a.icon
              return (
                <button key={i} className="w-full flex items-center justify-between px-5 py-3.5 border-b border-border-subtle hover:bg-surface-low transition-colors">
                  <div className="flex items-center gap-2.5 text-sm font-medium text-text-primary font-sans">
                    <Icon size={15} className="text-text-secondary" /> {a.label}
                  </div>
                  <ChevronRight size={14} className="text-text-secondary/70" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
