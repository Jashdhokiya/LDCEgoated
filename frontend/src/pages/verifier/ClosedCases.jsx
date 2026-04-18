import { useState, useEffect } from 'react'
import { CheckCircle, Loader2, MapPin, Clock } from 'lucide-react'
import { getMyCases } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'

const ANOMALY_LABELS = {
  DEAD_BENEFICIARY: 'Deceased Beneficiary',
  DECEASED: 'Deceased Beneficiary',
  DUPLICATE: 'Duplicate Identity',
  UNDRAWN: 'Undrawn Funds',
  CROSS_SCHEME: 'Cross-Scheme Violation',
}

export default function ClosedCases() {
  const { t } = useLanguage()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyCases().then(data => {
      const caseList = data?.cases || []
      // Show only submitted/resolved cases
      const closed = caseList.filter(c =>
        c.status === 'VERIFICATION_SUBMITTED' || c.status === 'RESOLVED' || c.status === 'AUDIT_REVIEW'
      )
      setCases(closed)
      setLoading(false)
    })
  }, [])

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
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t('verifier.closedCases')}</h1>
          <p className="text-sm text-text-secondary mt-1 font-data">
            Cases you have submitted evidence for — awaiting DFO/Audit review
          </p>
        </div>
        <div className="px-4 py-2.5 bg-surface-lowest rounded-xl border border-border-subtle shadow-sm text-center min-w-[80px]">
          <p className="text-2xl font-bold text-emerald-600">{cases.length}</p>
          <p className="text-xs text-text-secondary font-data">Closed</p>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="bg-surface-lowest rounded-xl border border-border-subtle p-12 text-center">
          <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
          <p className="text-text-secondary font-data text-sm">{t('verifier.noClosed')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map(c => {
            const type = c.anomaly_type || c.leakage_type || 'UNKNOWN'
            const statusLabel = c.status === 'VERIFICATION_SUBMITTED' ? 'Evidence Submitted'
              : c.status === 'RESOLVED' ? 'Resolved'
              : c.status === 'AUDIT_REVIEW' ? 'Under Audit Review'
              : c.status
            const statusColor = c.status === 'RESOLVED' ? 'text-emerald-600 bg-tint-emerald'
              : c.status === 'AUDIT_REVIEW' ? 'text-blue-600 bg-tint-blue'
              : 'text-yellow-600 bg-tint-yellow'
            return (
              <div key={c.case_id || c.flag_id} className="bg-surface-lowest rounded-xl border border-border-subtle shadow-sm p-5 flex items-center gap-5">
                <div className="w-1 self-stretch rounded-full bg-emerald-400" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono font-bold text-text-secondary">{c.case_id || c.flag_id}</span>
                    <span className="text-[10px] font-data text-text-secondary">· {c.scheme || '—'}</span>
                  </div>
                  <h3 className="font-bold text-text-primary text-sm">{c.beneficiary_name || c.target_entity?.name || '—'}</h3>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-text-secondary font-data">
                    <span className="flex items-center gap-1"><MapPin size={11} />{c.district}</span>
                    <span>{ANOMALY_LABELS[type] || type}</span>
                    <span className="font-mono">₹{(c.amount || c.payment_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  {c.assigned_date && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-text-secondary font-data">
                      <Clock size={10} />{t('verifier.assigned')}: {c.assigned_date}
                    </div>
                  )}
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border border-border-subtle flex items-center gap-1.5 ${statusColor}`}>
                  <CheckCircle size={12} /> {statusLabel}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
