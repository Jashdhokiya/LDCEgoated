import { useState, useEffect } from 'react'
import { getAuditPending, getAuditHistory } from '../../api'
import { LeakageBadge } from '../../components/RiskBadge'
import { useLanguage } from '../../i18n/LanguageContext'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

export default function AuditVerifierQueue() {
  const { t } = useLanguage()
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')

  useEffect(() => {
    Promise.all([getAuditPending(), getAuditHistory()]).then(([p, r]) => {
      setPending(p?.pending || [])
      setReviewed(r?.reviewed || [])
      setLoading(false)
    })
  }, [])

  const cases = tab === 'pending' ? pending : reviewed

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold font-sans text-text-primary tracking-tight mb-2">
        {t('sidebar.verifierReports') || 'Verifier Reports'}
      </h1>
      <p className="text-sm text-text-secondary font-data mb-6">
        Cases submitted by field verifiers for audit review
      </p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            tab === 'pending'
              ? 'bg-primary-override text-white border-primary-override'
              : 'bg-surface-lowest text-text-secondary border-border-subtle hover:border-primary-override'
          }`}
        >
          Pending Review ({pending.length})
        </button>
        <button
          onClick={() => setTab('reviewed')}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            tab === 'reviewed'
              ? 'bg-primary-override text-white border-primary-override'
              : 'bg-surface-lowest text-text-secondary border-border-subtle hover:border-primary-override'
          }`}
        >
          Already Reviewed ({reviewed.length})
        </button>
      </div>

      <div className="bg-surface-lowest rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-secondary font-data">Loading...</div>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center text-text-secondary font-data">
            {tab === 'pending' ? 'No cases pending audit review.' : 'No reviewed cases yet.'}
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface text-text-secondary text-sm font-bold uppercase tracking-widest font-sans">
                <th className="p-4 font-bold">Case ID</th>
                <th className="p-4 font-bold">Entity</th>
                <th className="p-4 font-bold">Type</th>
                <th className="p-4 font-bold">Risk</th>
                <th className="p-4 font-bold">Status</th>
                {tab === 'reviewed' && <th className="p-4 font-bold">Decision</th>}
              </tr>
            </thead>
            <tbody className="font-data text-sm">
              {cases.map((c, idx) => (
                <tr key={c.case_id || c.flag_id} className={`${idx % 2 === 0 ? 'bg-surface-lowest' : 'bg-surface-low'}`}>
                  <td className="p-4 font-mono font-medium text-text-secondary">{c.case_id || c.flag_id}</td>
                  <td className="p-4 font-sans font-bold text-text-primary">
                    {c.target_entity?.name || c.target_entity?.entity_id || c.beneficiary_name || '—'}
                  </td>
                  <td className="p-4"><LeakageBadge type={c.leakage_type || c.anomaly_type} /></td>
                  <td className="p-4">
                    <span className="text-xs font-bold">{c.risk_score}/100</span>
                  </td>
                  <td className="p-4">
                    <span className="flex items-center gap-1.5 text-xs font-bold">
                      <Clock size={12} className="text-text-secondary" />
                      {c.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  {tab === 'reviewed' && (
                    <td className="p-4">
                      {c.audit_report ? (
                        <span className={`flex items-center gap-1.5 text-xs font-bold ${
                          c.audit_report.final_decision === 'LEGITIMATE' ? 'text-emerald-600' : 'text-risk-critical'
                        }`}>
                          {c.audit_report.final_decision === 'LEGITIMATE'
                            ? <CheckCircle size={14} />
                            : <XCircle size={14} />
                          }
                          {c.audit_report.final_decision}
                        </span>
                      ) : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
