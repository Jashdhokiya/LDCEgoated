import { useState, useEffect } from 'react'
import { CheckCircle, Clock, AlertTriangle, FileCheck, ChevronRight, RefreshCw, Shield, Camera, User, Phone, MapPin, CreditCard, X, Loader2, Check, XCircle } from 'lucide-react'
import { getUser, faceVerifyKYC, completeKYC } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'
import WebcamCapture from '../../components/WebcamCapture'

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
  const [step, setStep] = useState(1)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)

  const hasFaceRef = user?.face_enrolled

  const INFO_ROWS = [
    { icon: User, label: t('userDashboard.fullName'), value: user?.full_name || user?.name || '—' },
    { icon: CreditCard, label: t('userDashboard.aadhaar'), value: user?.aadhaar_display || 'XXXX-XXXX-XXXX' },
    { icon: Phone, label: t('userDashboard.mobile'), value: user?.phone || '—' },
    { icon: MapPin, label: t('userDashboard.address'), value: `${user?.demographics?.taluka || '—'}, ${user?.demographics?.district || '—'}` },
    { icon: Shield, label: t('userDashboard.category'), value: user?.demographics?.category || '—' },
    { icon: CreditCard, label: t('userDashboard.bankAccount'), value: `${user?.bank?.bank || '—'} · ${user?.bank?.account_display || '—'}` },
  ]

  const handleFaceCapture = async (base64) => {
    setVerifying(true)
    try {
      const res = await faceVerifyKYC(base64)
      setVerifyResult(res)
      setStep(3)
    } catch (err) {
      setVerifyResult({ success: false, confidence: 0, details: err?.response?.data?.detail || 'Verification failed', message: 'Error' })
      setStep(3)
    } finally { setVerifying(false) }
  }

  const handleBasicKYC = async () => {
    setVerifying(true)
    try {
      await completeKYC()
      setVerifyResult({ success: true, confidence: 100, details: 'Basic KYC completed', message: 'Done' })
      setStep(3)
    } catch (err) {
      setVerifyResult({ success: false, confidence: 0, details: err?.response?.data?.detail || 'Failed', message: 'Error' })
      setStep(3)
    } finally { setVerifying(false) }
  }

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
          {!verifying && <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors"><X size={18} /></button>}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-1">
          {[t('userDashboard.verifyInfo'), 'Face Scan', t('userDashboard.complete')].map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="w-full flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-all ${
                  step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-primary-override text-white' : 'bg-surface-low text-text-secondary'
                }`}>{step > i + 1 ? <Check size={14} /> : i + 1}</div>
                <span className={`text-[10px] font-data ${step === i + 1 ? 'text-primary-override font-bold' : 'text-text-secondary'}`}>{s}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-px mx-1 mb-5 ${step > i + 1 ? 'bg-emerald-400' : 'bg-surface-low'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Review info */}
        {step === 1 && (
          <div className="px-6 py-5">
            <p className="text-sm font-data text-text-secondary mb-4 leading-relaxed">{t('userDashboard.reviewInfo')}</p>
            <div className="space-y-3 mb-4">
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
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-4 ${hasFaceRef ? 'bg-tint-emerald' : 'bg-tint-yellow'}`}>
              <Camera size={14} className={hasFaceRef ? 'text-emerald-600' : 'text-yellow-600'} />
              <span className={`text-xs font-data font-bold ${hasFaceRef ? 'text-emerald-600' : 'text-yellow-600'}`}>
                Face ID: {hasFaceRef ? 'Enrolled — face verification available' : 'Not enrolled — basic KYC only'}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-border-subtle text-sm font-semibold text-text-secondary rounded-xl hover:bg-surface-low transition-all">{t('common.cancel')}</button>
              {hasFaceRef ? (
                <button onClick={() => setStep(2)} className="flex-1 py-2.5 bg-primary-override text-white text-sm font-bold rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2">
                  <Camera size={14} /> Verify Face
                </button>
              ) : (
                <button onClick={handleBasicKYC} disabled={verifying} className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {verifying ? 'Verifying…' : 'Complete Basic KYC'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Real webcam face verification */}
        {step === 2 && (
          <div className="px-6 py-6 flex flex-col items-center">
            <p className="text-sm font-data text-text-secondary mb-4 text-center">
              Position your face in the camera. Your photo will be matched against your enrolled Face ID using AI face recognition.
            </p>
            {verifying ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-primary-override/30 flex items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-primary-override" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary-override flex items-center justify-center">
                    <Shield size={14} className="text-white" />
                  </div>
                </div>
                <p className="text-sm font-bold text-text-primary">Analyzing Face…</p>
                <p className="text-xs text-text-secondary font-data">Running multi-metric face verification</p>
              </div>
            ) : (
              <WebcamCapture mode="verify" onCapture={handleFaceCapture} onCancel={() => setStep(1)} disabled={verifying} />
            )}
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && verifyResult && (
          <div className="px-6 py-8 flex flex-col items-center text-center">
            {verifyResult.success ? (
              <>
                <div className="w-16 h-16 rounded-full bg-tint-emerald flex items-center justify-center mb-4">
                  <CheckCircle size={32} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-text-primary font-sans mb-1">{t('userDashboard.kycSuccess')}</h3>
                <p className="text-sm text-text-secondary font-data leading-relaxed mb-2">{t('userDashboard.kycSuccessDesc')}</p>
                {verifyResult.confidence > 0 && verifyResult.confidence < 100 && (
                  <div className="w-full max-w-xs bg-surface-low rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-text-secondary font-data">AI Confidence</span>
                      <span className="text-lg font-bold text-emerald-600 font-mono">{verifyResult.confidence}%</span>
                    </div>
                    <div className="h-2 bg-surface-lowest rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${verifyResult.confidence}%` }} />
                    </div>
                    {verifyResult.breakdown && (
                      <div className="mt-3 space-y-1">
                        {Object.entries(verifyResult.breakdown).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between text-[10px] font-data">
                            <span className="text-text-secondary capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="text-text-primary font-mono">{val}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <span className="block text-xs font-bold text-emerald-600 mb-4">
                  {t('userDashboard.newExpiry')} {new Date(Date.now() + 365 * 86400000).toLocaleDateString('en-IN')}
                </span>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-tint-red flex items-center justify-center mb-4">
                  <XCircle size={32} className="text-risk-critical" />
                </div>
                <h3 className="text-lg font-bold text-text-primary font-sans mb-1">Verification Failed</h3>
                <p className="text-sm text-text-secondary font-data leading-relaxed mb-2">{verifyResult.details || verifyResult.message}</p>
                {verifyResult.confidence > 0 && (
                  <p className="text-xs text-text-secondary font-mono mb-4">Confidence: {verifyResult.confidence}% (min required: 55%)</p>
                )}
              </>
            )}
            <div className="flex gap-3 w-full">
              {!verifyResult.success && (
                <button onClick={() => { setVerifyResult(null); setStep(2) }} className="flex-1 py-3 border border-border-subtle text-text-primary text-sm font-bold rounded-xl hover:bg-surface-low transition-all">
                  Try Again
                </button>
              )}
              <button onClick={() => { if (verifyResult.success) onComplete(verifyResult); onClose() }}
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${verifyResult.success ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border border-border-subtle text-text-secondary hover:bg-surface-low'}`}>
                {verifyResult.success ? t('common.done') : 'Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



// ─── KYC Card ──────────────────────────────────────────────────────────────────
function KYCCard({ kyc, onOpenModal }) {
  const { t } = useLanguage()
  const { is_kyc_compliant = false, days_remaining = 0, kyc_expiry_date = '—', last_kyc_date = '—' } = kyc || {}
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
    getUser().then(data => {
      setUser(data)
      setLoading(false)
    })
  }, [])

  const handleKYCComplete = async () => {
    if (user) {
      try {
        await completeKYC()
        setUser(prev => ({
          ...prev,
          kyc_complete: true,
          kyc_profile: {
            ...prev.kyc_profile,
            is_kyc_compliant: true,
            days_remaining: 90,
            kyc_expiry_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
            last_kyc_date: new Date().toISOString().split('T')[0],
          },
        }))
      } catch (e) {
        console.error('KYC error:', e)
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
            {t('userDashboard.welcome')} {(user?.full_name || user?.name || 'User').split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-text-secondary mt-1 font-data">
            {user?.user_id} · {user?.demographics?.taluka || '—'}, {user?.demographics?.district || '—'} · DBT Beneficiary Portal
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
            <KYCCard kyc={user?.kyc_profile} onOpenModal={() => setShowKYCModal(true)} />
          )}

          {/* Scheme Tracker */}
          <div className="bg-surface-lowest rounded-xl shadow-sm border border-border-subtle overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <h2 className="font-bold text-text-primary font-sans">{t('userDashboard.mySchemeApplications')}</h2>
              <span className="text-xs text-text-secondary font-data">{(user?.registered_schemes || []).length} {t('userDashboard.registered')}</span>
            </div>
            <div className="divide-y divide-border-subtle">
              {(user?.registered_schemes || []).map(scheme => {
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
                        <h3 className="font-bold text-text-primary text-sm leading-snug">{scheme.name || scheme.scheme_id}</h3>
                        <p className="text-xs text-text-secondary font-data mt-1">Registered: {scheme.registration_date || scheme.payment_date || '—'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold text-text-primary font-sans">₹{(scheme.amount || scheme.payment_amount || 0).toLocaleString('en-IN')}</p>
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
