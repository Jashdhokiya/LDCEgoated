import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getInvestigations } from '../../api'
import { RiskBadge, LeakageBadge } from '../../components/RiskBadge'
import { useLanguage } from '../../i18n/LanguageContext'

const STATUS_TABS = [
  { key: null,            label: 'All Cases' },
  { key: 'OPEN',          label: 'Open' },
  { key: 'ASSIGNED',      label: 'Assigned' },
  { key: 'ASSIGNED_TO_VERIFIER', label: 'With Verifier' },
  { key: 'VERIFICATION_SUBMITTED', label: 'Evidence Submitted' },
  { key: 'AUDIT_REVIEW',  label: 'Audit Reviewed' },
  { key: 'RESOLVED',      label: 'Resolved' },
]

export default function InvestigationQueue() {
  const { t } = useLanguage()
  const [cases, setCases] = useState([])
  const [activeTab, setActiveTab] = useState(null)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = activeTab ? { status: activeTab } : {}
    getInvestigations(params).then(res => {
      const list = res?.cases || (Array.isArray(res) ? res : [])
      setCases(list)
      setLoading(false)
    }).catch(e => {
      console.error(e)
      setLoading(false)
    })
  }, [activeTab])

  const getRiskColor = (label) => {
    if (label === 'CRITICAL') return 'bg-risk-critical'
    if (label === 'HIGH') return 'bg-risk-high'
    if (label === 'MEDIUM') return 'bg-risk-medium'
    return 'bg-risk-low'
  }

  const getStatusBadge = (status) => {
    const styles = {
      OPEN: 'bg-tint-blue text-primary-override',
      ASSIGNED: 'bg-tint-orange text-orange-700',
      ASSIGNED_TO_VERIFIER: 'bg-tint-orange text-orange-700',
      VERIFICATION_SUBMITTED: 'bg-tint-yellow text-yellow-700',
      AUDIT_REVIEW: 'bg-tint-green text-emerald-700',
      RESOLVED: 'bg-surface-low text-text-secondary',
    }
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles[status] || 'bg-surface-low text-text-secondary'}`}>
        {status?.replace(/_/g, ' ') || 'UNKNOWN'}
      </span>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold font-sans text-text-primary tracking-tight mb-6">{t('queue.title')}</h1>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key ?? 'all'}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
              activeTab === tab.key
                ? 'bg-primary-override text-white dark:text-shell border-primary-override'
                : 'bg-surface-lowest text-text-secondary border-border-subtle hover:border-primary-override'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="bg-surface-lowest rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-secondary font-data">{t('queue.loadingFlags')}</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface text-text-secondary text-sm font-bold uppercase tracking-widest font-sans">
                <th className="p-4 font-bold">{t('queue.flagId')}</th>
                <th className="p-4 font-bold">{t('queue.beneficiary')}</th>
                <th className="p-4 font-bold">{t('queue.districtScheme')}</th>
                <th className="p-4 font-bold">{t('queue.leakageType')}</th>
                <th className="p-4 font-bold">{t('queue.amount')}</th>
                <th className="p-4 font-bold">{t('queue.riskScore')}</th>
                <th className="p-4 font-bold">{t('queue.status')}</th>
                <th className="p-4 font-bold">Audit</th>
                <th className="p-4 font-bold">{t('queue.action')}</th>
              </tr>
            </thead>
            <tbody className="font-data text-sm">
              {cases.map((c, idx) => (
                <tr key={c.case_id || c.flag_id} className={`${idx % 2 === 0 ? 'bg-surface-lowest' : 'bg-surface-low'}`}>
                  <td className="p-4 font-mono font-medium text-text-secondary">{c.case_id || c.flag_id}</td>
                  <td className="p-4 font-sans font-bold text-text-primary">{c.beneficiary_name || c.target_entity?.name || '—'}</td>
                  <td className="p-4">
                    <div className="text-text-primary">{c.district}</div>
                    <div className="text-xs text-text-secondary">{c.scheme}</div>
                  </td>
                  <td className="p-4"><LeakageBadge type={c.leakage_type || c.anomaly_type} /></td>
                  <td className="p-4 font-mono font-medium">₹{(c.payment_amount || c.amount || 0)?.toLocaleString('en-IN')}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold font-sans">{c.risk_score}/100</span>
                      <div className="w-[100px] bg-surface-low h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getRiskColor(c.risk_label)}`} 
                          style={{ width: `${c.risk_score}%` }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{getStatusBadge(c.status)}</td>
                  <td className="p-4">
                    {c.audit_report ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.audit_report.final_decision === 'LEGITIMATE' 
                          ? 'bg-tint-green text-emerald-700' 
                          : 'bg-tint-red text-risk-critical'
                      }`}>
                        {c.audit_report.final_decision}
                      </span>
                    ) : (
                      <span className="text-xs text-text-secondary">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => navigate(`/dfo/case/${c.case_id || c.flag_id}`)} 
                      className="text-primary-override hover:underline font-sans font-semibold text-sm"
                    >
                      {t('common.review')}
                    </button>
                  </td>
                </tr>
              ))}
              {cases.length === 0 && (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-text-secondary">{t('queue.noFlags')}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
