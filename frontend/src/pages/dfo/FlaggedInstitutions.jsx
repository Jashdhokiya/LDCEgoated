import { useState, useEffect } from 'react'
import { AlertTriangle, ExternalLink, FileSearch, Loader2 } from 'lucide-react'
import { getInstitutions } from '../../api'
import AssignCaseModal from '../../components/AssignCaseModal'
import { useLanguage } from '../../i18n/LanguageContext'

const RISK_BG = (score) => {
  if (score >= 75) return 'border-l-4 border-risk-critical bg-tint-red'
  if (score >= 50) return 'border-l-4 border-risk-high bg-tint-orange'
  return 'border-l-4 border-risk-medium bg-tint-yellow'
}

export default function FlaggedInstitutions() {
  const { t } = useLanguage()
  const [flagged, setFlagged] = useState([])
  const [loading, setLoading] = useState(true)
  const [assignModal, setAssignModal] = useState(null)
  const [referred, setReferred] = useState(new Set())

  useEffect(() => {
    getInstitutions({ flagged_only: true }).then(data => {
      const sorted = (Array.isArray(data) ? data : [])
        .filter(i => i.risk_profile?.is_flagged)
        .sort((a, b) => b.risk_profile.risk_score - a.risk_profile.risk_score)
      setFlagged(sorted)
      setLoading(false)
    })
  }, [])

  return (
    <div className="p-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-sans text-text-primary tracking-tight flex items-center gap-3">
            <AlertTriangle size={26} className="text-risk-critical" />
            {t('flaggedInst.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1 font-data">
            {flagged.length} {t('flaggedInst.subtitle')}
          </p>
        </div>
        <div className="px-5 py-3 bg-tint-red rounded-xl border border-border-subtle text-center">
          <p className="text-3xl font-bold text-risk-critical font-sans">{flagged.length}</p>
          <p className="text-xs text-risk-critical font-data">{t('common.flagged')}</p>
        </div>
      </div>

      {/* Grid of flagged institutions */}
      <div className="grid grid-cols-1 gap-4">
        {flagged.map(inst => (
          <div key={inst.institution_id} className={`bg-surface-lowest rounded-xl overflow-hidden shadow-sm ${RISK_BG(inst.risk_profile.risk_score)}`}>
            <div className="px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                {/* Left section */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-text-secondary font-mono">{inst.institution_id}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-low text-text-secondary">{inst.type.replace('_', ' ')}</span>
                  </div>
                  <h3 className="text-lg font-bold text-text-primary font-sans">{inst.name}</h3>
                  <p className="text-sm text-text-secondary font-data mt-0.5">{inst.taluka}, Ahmedabad · {inst.beneficiary_count} beneficiaries</p>

                  {/* Flag reason */}
                  <div className="flex items-start gap-2 mt-3 bg-tint-red border border-border-subtle rounded-lg px-3 py-2">
                    <AlertTriangle size={14} className="text-risk-critical mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-risk-critical font-data font-medium">{inst.risk_profile.flag_reason}</p>
                  </div>
                </div>

                {/* Right section — stats */}
                <div className="flex gap-4 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-2xl font-bold font-sans" style={{
                      color: inst.risk_profile.risk_score >= 75 ? '#E63946' : inst.risk_profile.risk_score >= 50 ? '#F5A623' : '#EAB308'
                    }}>{inst.risk_profile.risk_score}</p>
                    <p className="text-xs text-text-secondary font-data">Risk Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-text-primary font-sans">
                      ₹{(inst.financial_ledger.current_holding / 1000).toFixed(0)}K
                    </p>
                    <p className="text-xs text-text-secondary font-data">{t('middlemen.holding')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-text-primary font-sans">
                      ₹{(inst.financial_ledger.total_funds_credited / 100000).toFixed(1)}L
                    </p>
                    <p className="text-xs text-text-secondary font-data">{t('middlemen.credited')}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border-subtle">
                <button
                  onClick={() => setAssignModal(inst)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-override text-white text-xs font-bold rounded-lg hover:bg-blue-900 transition-all"
                >
                  <FileSearch size={13} />
                  {t('flaggedInst.assignToVerifier')}
                </button>
                <button
                  onClick={() => setReferred(s => new Set([...s, inst.institution_id]))}
                  disabled={referred.has(inst.institution_id)}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
                    referred.has(inst.institution_id)
                      ? 'border-border-subtle bg-tint-emerald text-emerald-600 cursor-not-allowed'
                      : 'border-border-subtle text-text-secondary hover:border-border-subtle hover:bg-surface-low'
                  }`}
                >
                  <ExternalLink size={13} />
                  {referred.has(inst.institution_id) ? t('flaggedInst.referredAudit') : t('flaggedInst.referToAudit')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {assignModal && (
        <AssignCaseModal
          caseId={assignModal.institution_id}
          caseName={`${assignModal.name} — ${assignModal.risk_profile.flag_reason}`}
          onClose={() => setAssignModal(null)}
          onAssigned={() => setAssignModal(null)}
        />
      )}
    </div>
  )
}
