import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, FileImage, List, Clock, AlertTriangle, CheckCircle, ChevronRight, Loader2 } from 'lucide-react'
import { getMyCases } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'

const ANOMALY_LABELS = {
  DEAD_BENEFICIARY: 'Deceased Beneficiary',
  DECEASED: 'Deceased Beneficiary',
  DUPLICATE: 'Duplicate Identity',
  UNDRAWN: 'Undrawn Funds',
  CROSS_SCHEME: 'Cross-Scheme Violation',
}

const PRIORITY = {
  DEAD_BENEFICIARY: { label: 'Critical', color: 'bg-tint-red text-risk-critical border-border-subtle' },
  DECEASED: { label: 'Critical', color: 'bg-tint-red text-risk-critical border-border-subtle' },
  DUPLICATE: { label: 'High', color: 'bg-tint-orange text-risk-high border-border-subtle' },
  UNDRAWN: { label: 'Medium', color: 'bg-tint-yellow text-risk-medium border-border-subtle' },
  CROSS_SCHEME: { label: 'Medium', color: 'bg-tint-blue text-primary-override border-border-subtle' },
}

const STRIPE_COLORS = {
  DEAD_BENEFICIARY: 'bg-red-500',
  DECEASED: 'bg-red-500',
  DUPLICATE: 'bg-orange-400',
  CROSS_SCHEME: 'bg-blue-400',
}

export default function SchemeVerifierDashboard() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(new Set())

  useEffect(() => {
    // Fetch only cases assigned to the currently logged-in verifier
    getMyCases().then(data => {
      const caseList = data?.cases || []
      setCases(caseList)
      setLoading(false)
    })
  }, [])

  const getCaseId = (c) => c.case_id || c.flag_id
  const getName = (c) => c.beneficiary_name || c.target_entity?.name || c.target_entity?.entity_id || '—'
  const getType = (c) => c.anomaly_type || c.leakage_type || 'UNKNOWN'
  const getAmount = (c) => c.amount || c.payment_amount || 0

  const pending  = cases.filter(c =>
    (c.status === 'ASSIGNED_TO_VERIFIER' || c.status === 'ASSIGNED') && !submitted.has(getCaseId(c))
  )
  const done = cases.filter(c =>
    c.status === 'VERIFICATION_SUBMITTED' || submitted.has(getCaseId(c))
  )

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary-override" />
      </div>
    )
  }

  return (
    <div className="p-8 pb-20 font-sans max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t('verifier.title')}</h1>
          <p className="text-sm text-text-secondary mt-1 font-data">
            {t('verifier.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          {[
            { label: t('verifier.pending'), value: pending.length, color: 'text-orange-600' },
            { label: t('verifier.submitted'), value: done.length, color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="px-4 py-2.5 bg-surface-lowest rounded-xl border border-border-subtle shadow-sm text-center min-w-[80px]">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-text-secondary font-data">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pending cases */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="text-orange-500" />
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest font-data">{t('verifier.pendingSubmission')}</h2>
        </div>
        {pending.length === 0 ? (
          <div className="bg-surface-lowest rounded-xl border border-border-subtle p-8 text-center text-text-secondary font-data text-sm">
            {t('verifier.noPending')}
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(c => {
              const type = getType(c)
              const pri = PRIORITY[type] || PRIORITY.DUPLICATE
              const stripe = STRIPE_COLORS[type] || 'bg-yellow-400'
              return (
                <div key={getCaseId(c)} className="bg-surface-lowest rounded-xl border border-border-subtle shadow-sm p-5 flex items-center gap-5 hover:shadow-md transition-shadow">
                  {/* Priority stripe */}
                  <div className={`w-1 self-stretch rounded-full ${stripe}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-text-secondary">{getCaseId(c)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pri.color}`}>{pri.label}</span>
                      <span className="text-[10px] font-data text-text-secondary">· {c.scheme || '—'}</span>
                    </div>
                    <h3 className="font-bold text-text-primary text-sm">{getName(c)}</h3>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-text-secondary font-data">
                      <span className="flex items-center gap-1"><MapPin size={11} />{c.district}</span>
                      <span>{ANOMALY_LABELS[type] || type}</span>
                      <span className="font-mono text-risk-critical">₹{getAmount(c).toLocaleString('en-IN')}</span>
                    </div>
                    {c.assigned_date && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-text-secondary font-data">
                        <Clock size={10} />{t('verifier.assigned')}: {c.assigned_date}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => navigate('/verifier/submit-evidence', { state: { caseData: c } })}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary-override text-white text-xs font-bold rounded-lg hover:bg-blue-900 transition-colors shadow-sm whitespace-nowrap"
                  >
                    <FileImage size={14} /> {t('verifier.submitEvidenceBtn')} <ChevronRight size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Submitted cases */}
      {done.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={16} className="text-emerald-500" />
            <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest font-data">{t('verifier.submitted')}</h2>
          </div>
          <div className="space-y-2">
            {done.map(c => (
              <div key={getCaseId(c)} className="bg-surface-lowest rounded-xl border border-border-subtle p-4 flex items-center gap-4 opacity-70">
                <div className="w-1 self-stretch rounded-full bg-emerald-400" />
                <div className="flex-1">
                  <span className="text-xs font-mono text-text-secondary">{getCaseId(c)}</span>
                  <p className="text-sm font-bold text-text-primary">{getName(c)}</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-tint-emerald px-3 py-1.5 rounded-full border border-border-subtle flex items-center gap-1.5">
                  <CheckCircle size={12} /> {t('verifier.submitted')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

