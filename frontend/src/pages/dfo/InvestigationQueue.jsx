import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getFlags } from '../../api'
import { RiskBadge, LeakageBadge } from '../../components/RiskBadge'
import AssignCaseModal from '../../components/AssignCaseModal'
import { useLanguage } from '../../i18n/LanguageContext'

export default function InvestigationQueue() {
  const { t } = useLanguage()
  const [flags, setFlags] = useState([])
  const [assignModal, setAssignModal] = useState(null)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  const refreshFlags = () => {
    setLoading(true)
    getFlags().then(data => {
      setFlags(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(e => {
      console.error(e)
      setLoading(false)
    })
  }

  useEffect(() => {
    refreshFlags()
  }, [])

  const handleStatusChange = async (flagId, newStatus) => {
    try {
      await api.updateFlagStatus(flagId, newStatus)
      setFlags(prev => prev.map(f => f.flag_id === flagId ? { ...f, status: newStatus } : f))
    } catch (e) {
      console.error(e)
    }
  }

  const handleAssigned = () => {
    setAssignModal(null)
    refreshFlags()
  }

  const getRiskColor = (label) => {
    if (label === 'CRITICAL') return 'bg-risk-critical'
    if (label === 'HIGH') return 'bg-risk-high'
    if (label === 'MEDIUM') return 'bg-risk-medium'
    return 'bg-risk-low'
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold font-sans text-text-primary tracking-tight mb-6">{t('queue.title')}</h1>
      
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
                <th className="p-4 font-bold">{t('queue.action')}</th>
              </tr>
            </thead>
            <tbody className="font-data text-sm">
              {flags.map((flag, idx) => (
                <tr key={flag.flag_id} className={`${idx % 2 === 0 ? 'bg-surface-lowest' : 'bg-surface-low'}`}>
                  <td className="p-4 font-mono font-medium text-text-secondary">{flag.flag_id}</td>
                  <td className="p-4 font-sans font-bold text-text-primary">{flag.beneficiary_name}</td>
                  <td className="p-4">
                    <div className="text-text-primary">{flag.district}</div>
                    <div className="text-xs text-text-secondary">{flag.scheme}</div>
                  </td>
                  <td className="p-4"><LeakageBadge type={flag.leakage_type} /></td>
                  <td className="p-4 font-mono font-medium">₹{flag.payment_amount?.toLocaleString('en-IN')}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold font-sans">{flag.risk_score}/100</span>
                      <div className="w-[100px] bg-surface-low h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getRiskColor(flag.risk_label)}`} 
                          style={{ width: `${flag.risk_score}%` }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <select 
                      value={flag.status || 'OPEN'} 
                      onChange={(e) => handleStatusChange(flag.flag_id, e.target.value)}
                      className="bg-surface-lowest border border-border-subtle text-text-primary text-xs rounded p-1 font-sans font-medium outline-none focus:ring-2 focus:ring-primary-override"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="ASSIGNED">ASSIGNED</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setAssignModal(flag)}
                        className="text-primary-override hover:underline font-sans font-semibold text-sm text-left"
                      >
                        {t('assignModal.title')}
                      </button>
                      <button 
                        onClick={() => navigate(`/dfo/case/${flag.flag_id}`)} 
                        className="text-primary-override hover:underline font-sans font-semibold text-sm text-left"
                      >
                        {t('common.review')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {flags.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-text-secondary">{t('queue.noFlags')}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {assignModal && (
        <AssignCaseModal
          caseId={assignModal.flag_id}
          caseName={`${assignModal.beneficiary_name} — ${assignModal.scheme}`}
          onClose={() => setAssignModal(null)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  )
}
